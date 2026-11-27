#!/usr/bin/env node
// BigR M1: optional extractor-facing CLI. Preserves the existing P1 CLI unchanged.
// Supports only verified RGBA raster PNG export; never interprets game formats.
import { lstat, mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { deflateSync } from "node:zlib";
import {
  PACKAGE_SCHEMA, canonicalManifestJson, parseManifest, scaleRasterNearest, sha256, unpackAsset,
} from "../dist/index.js";

const CONTRACT = "bigr.export.cli.v1";
const MAX_MANIFEST_BYTES = 10 * 1024 * 1024;
const MAX_PNG_PIXELS = 4_000_000; // Deliberate M1 export bound, lower than the core limit.
const USAGE = [
  "Usage:",
  "  node bin/bigr-export.mjs capabilities",
  "  node bin/bigr-export.mjs validate --input PACKAGE_DIR",
  "  node bin/bigr-export.mjs render --input PACKAGE_DIR --output NEW_DIR [--scale POSITIVE_INTEGER]",
].join("\n");

class ExportError extends Error {
  constructor(code, message, exitCode = 1) {
    super(message);
    this.code = code;
    this.exitCode = exitCode;
  }
}
const fail = (code, message, exitCode = 1) => { throw new ExportError(code, message, exitCode); };
const result = value => process.stdout.write(JSON.stringify(value) + "\n");

function parseArgs(argv) {
  const [command, ...values] = argv;
  if (command === "capabilities" && values.length === 0) return { command };
  if (command !== "validate" && command !== "render") {
    fail("INVALID_ARGUMENTS", USAGE, 2);
  }
  if (values.length % 2 !== 0) fail("INVALID_ARGUMENTS", USAGE, 2);
  const allowed = new Set(command === "validate" ? ["--input"] : ["--input", "--output", "--scale"]);
  const args = new Map();
  for (let i = 0; i < values.length; i += 2) {
    const key = values[i];
    if (!allowed.has(key) || args.has(key) || !values[i + 1]?.length) {
      fail("INVALID_ARGUMENTS", USAGE, 2);
    }
    args.set(key, values[i + 1]);
  }
  if (!args.has("--input") || (command === "render" && !args.has("--output"))) {
    fail("INVALID_ARGUMENTS", USAGE, 2);
  }
  const scale = args.has("--scale") ? Number(args.get("--scale")) : 1;
  if (!Number.isSafeInteger(scale) || scale < 1) {
    fail("INVALID_ARGUMENTS", "--scale must be a positive safe integer", 2);
  }
  const input = resolve(args.get("--input"));
  const output = command === "render" ? resolve(args.get("--output")) : undefined;
  if (output !== undefined) {
    const normal = p => process.platform === "win32" ? p.toLowerCase() : p;
    const a = normal(input), b = normal(output);
    if (a === b || a.startsWith(b + sep) || b.startsWith(a + sep)) {
      fail("INVALID_ARGUMENTS", "Input and output must be separate, non-nested directories", 2);
    }
  }
  return { command, input, output, scale };
}

async function regular(path, kind, label) {
  let entry;
  try { entry = await lstat(path); }
  catch { fail("INVALID_PACKAGE", label + " is missing or inaccessible", 4); }
  if (entry.isSymbolicLink() || (kind === "file" && !entry.isFile()) ||
      (kind === "directory" && !entry.isDirectory())) {
    fail("INVALID_PACKAGE", label + " must be a regular " + kind, 4);
  }
  return entry;
}
async function absent(path) {
  try {
    await lstat(path);
    fail("DESTINATION_EXISTS", "Output directory already exists; no files overwritten", 5);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function loadPackage(input) {
  await regular(input, "directory", "Input package");
  await regular(join(input, "data"), "directory", "Input data/");
  const stat = await regular(join(input, "manifest.json"), "file", "Input manifest.json");
  if (stat.size > MAX_MANIFEST_BYTES) fail("INVALID_PACKAGE", "Manifest exceeds 10 MiB", 4);
  let manifest;
  try { manifest = parseManifest(await readFile(join(input, "manifest.json"), "utf8")); }
  catch (error) { fail("INVALID_PACKAGE", "Manifest invalid: " + error.message, 4); }

  const root = (await readdir(input)).sort();
  if (root.length !== 2 || root[0] !== "data" || root[1] !== "manifest.json") {
    fail("INVALID_PACKAGE", "Input package must contain exactly data/ and manifest.json", 4);
  }
  const expected = Object.keys(manifest.payloads).map(path => path.slice(5)).sort();
  const actual = (await readdir(join(input, "data"))).sort();
  if (actual.length !== expected.length || actual.some((name, i) => name !== expected[i])) {
    fail("INVALID_PACKAGE", "Unlisted or missing binary payload files", 4);
  }
  const blobs = Object.create(null);
  for (const path of Object.keys(manifest.payloads).sort()) {
    // parseManifest enforces data/<safe-file-name>.bin with no separators/traversal.
    if (isAbsolute(path)) fail("INVALID_PACKAGE", "Absolute payload path", 4);
    await regular(join(input, path), "file", "Payload " + path);
    blobs[path] = new Uint8Array(await readFile(join(input, path)));
  }
  let asset;
  try { asset = await unpackAsset({ manifest, blobs }); }
  catch (error) { fail("INVALID_PACKAGE", "Payload verification failed: " + error.message, 4); }
  return { manifest, asset };
}

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const value of bytes) crc = CRC_TABLE[(crc ^ value) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type, contents) {
  const chunk = Buffer.alloc(12 + contents.length);
  chunk.writeUInt32BE(contents.length, 0);
  chunk.write(type, 4, 4, "ascii");
  contents.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + contents.length)), 8 + contents.length);
  return chunk;
}
/** Encode only RGBA8, unfiltered PNG rows; avoids guessed palette/alpha semantics. */
function pngRgba(raster) {
  if (raster.format !== "rgba8") {
    fail("UNSUPPORTED_FEATURE", "PNG export currently requires rgba8; indexed8 needs explicit palette conversion", 3);
  }
  if (raster.mask !== undefined) {
    fail("UNSUPPORTED_FEATURE", "Primary mask semantics are unspecified; explicit compositing is required", 3);
  }
  const pixels = raster.width * raster.height;
  if (pixels > MAX_PNG_PIXELS) fail("UNSUPPORTED_FEATURE", "PNG export exceeds M1 4-million-pixel limit", 3);
  const rowBytes = raster.width * 4;
  const scanlines = Buffer.alloc((rowBytes + 1) * raster.height);
  for (let y = 0; y < raster.height; y++) {
    const destination = y * (rowBytes + 1);
    // Scanline filter byte 0 means None.
    Buffer.from(raster.pixels.subarray(y * rowBytes, (y + 1) * rowBytes))
      .copy(scanlines, destination + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(raster.width, 0);
  header.writeUInt32BE(raster.height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolor RGBA
  const compressed = deflateSync(scanlines, { level: 9 });
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header), pngChunk("IDAT", compressed), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}
async function capabilities() {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  return {
    ok: true, contract: CONTRACT, appVersion: packageJson.version, packageSchema: PACKAGE_SCHEMA,
    commands: ["capabilities", "validate", "render"],
    render: {
      supportedKinds: ["raster"], inputPixelFormats: ["rgba8"], outputFormats: ["png"],
      scalingMethods: ["nearest"], scale: "uniform positive integer (default 1)",
      transparency: "source RGBA alpha preserved; primary masks not composited",
      maxOutputPixels: MAX_PNG_PIXELS,
    },
    unavailable: ["indexed-palette-to-rgba", "animation", "layers", "video", "audio", "enhancement"],
  };
}
async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.command === "capabilities") {
    result(await capabilities());
    return;
  }
  const { manifest, asset } = await loadPackage(options.input);
  const sourceManifestSha256 = await sha256(new TextEncoder().encode(canonicalManifestJson(manifest)));
  if (options.command === "validate") {
    result({
      ok: true, contract: CONTRACT, valid: true, assetId: manifest.assetId,
      packageSchema: manifest.schema, kind: manifest.kind, sourceManifestSha256,
      payloadCount: Object.keys(manifest.payloads).length,
      pngRenderable: asset.kind === "raster" && asset.raster.format === "rgba8" &&
        asset.raster.mask === undefined &&
      BigInt(asset.raster.width) * BigInt(asset.raster.height) <= BigInt(MAX_PNG_PIXELS),
    });
    return;
  }
  await absent(options.output);
  if (asset.kind !== "raster") {
    fail("UNSUPPORTED_FEATURE", "M1 PNG exporter supports raster packages only; animation follows later", 3);
  }
  if (asset.raster.format !== "rgba8") {
    fail("UNSUPPORTED_FEATURE", "PNG export currently requires rgba8; indexed8 needs explicit palette conversion", 3);
  }
  if (asset.raster.mask !== undefined) {
    fail("UNSUPPORTED_FEATURE", "Primary mask semantics are unspecified; explicit compositing is required", 3);
  }
  // Preflight before allocating large scaled buffers. BigInt avoids unsafe multiplication.
  const outputPixels = BigInt(asset.raster.width) * BigInt(asset.raster.height) *
    BigInt(options.scale) * BigInt(options.scale);
  if (outputPixels > BigInt(MAX_PNG_PIXELS)) {
    fail("UNSUPPORTED_FEATURE", "PNG export exceeds M1 4-million-pixel limit", 3);
  }
  const scaled = scaleRasterNearest(asset.raster, { x: options.scale });
  const png = pngRgba(scaled);
  const warnings = Object.keys(asset.raster.evidenceMasks ?? {}).length
    ? ["Evidence masks were verified but not composited into the PNG"] : [];
  const outputSha256 = await sha256(png);
  const exportResult = {
    ok: true, status: "complete", contract: CONTRACT,
    source: { assetId: manifest.assetId, packageSchema: manifest.schema, manifestSha256: sourceManifestSha256 },
    output: {
      path: "image.png", format: "png", pixelFormat: "rgba8",
      width: scaled.width, height: scaled.height, sha256: outputSha256,
    },
    rendering: { method: "nearest", scaleX: options.scale, scaleY: options.scale },
    encoder: { name: "BigR minimal RGBA PNG", node: process.version, zlib: process.versions.zlib },
    warnings,
  };
  const parent = dirname(options.output);
  let temp;
  try {
    await regular(parent, "directory", "Output parent");
    temp = await mkdtemp(join(parent, ".bigr-m1-stage-"));
    await writeFile(join(temp, "image.png"), png, { flag: "wx" });
    await writeFile(join(temp, "result.json"), JSON.stringify(exportResult, null, 2) + "\n", { flag: "wx" });
    await absent(options.output);
    await rename(temp, options.output);
  } catch (error) {
    if (temp) await rm(temp, { recursive: true, force: true });
    throw error;
  }
  result(exportResult);
}

main().catch(error => {
  const code = error instanceof ExportError ? error.code : "INTERNAL_ERROR";
  process.stderr.write(JSON.stringify({ ok: false, contract: CONTRACT,
    error: { code, message: error instanceof ExportError ? error.message : "Unexpected export failure" } }) + "\n");
  process.exitCode = error instanceof ExportError ? error.exitCode : 1;
});
