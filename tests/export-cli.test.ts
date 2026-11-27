import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateSync } from "node:zlib";
import { canonicalManifestJson, packageAsset } from "../src/index.ts";
import type { SourceAsset } from "../src/index.ts";

const CLI = "bin/bigr-export.mjs";
const original: SourceAsset = {
  kind: "raster",
  raster: {
    width: 2, height: 1, format: "rgba8",
    pixels: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 64]),
  },
  provenance: { source: "synthetic-test-only" },
};
type Run = { status: number | null; stdout: string; stderr: string };
function run(...args: string[]): Run {
  const response = spawnSync(process.execPath, [CLI, ...args], { cwd: process.cwd(), encoding: "utf8" });
  if (response.error) throw response.error;
  return response;
}
function readJson(output: string): Record<string, any> { return JSON.parse(output); }

async function fixture(parent: string, source: SourceAsset, name = "synthetic_rgba"): Promise<string> {
  const dir = join(parent, "package");
  mkdirSync(join(dir, "data"), { recursive: true });
  const pkg = await packageAsset(source, name);
  writeFileSync(join(dir, "manifest.json"), canonicalManifestJson(pkg.manifest));
  for (const [filename, bytes] of Object.entries(pkg.blobs)) writeFileSync(join(dir, filename), bytes);
  return dir;
}
function unpackPng(bytes: Buffer): { width: number; height: number; scanlines: Buffer } {
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  const chunks: Record<string, Buffer[]> = {};
  for (let offset = 8; offset < bytes.length;) {
    const size = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const body = bytes.subarray(offset + 8, offset + 8 + size);
    (chunks[type] ??= []).push(body);
    offset += 12 + size;
    assert.ok(offset <= bytes.length, "PNG chunk extends past end of file");
  }
  assert.equal(chunks.IHDR?.length, 1);
  assert.equal(chunks.IEND?.length, 1);
  const header = chunks.IHDR![0]!;
  assert.equal(header[8], 8, "PNG must use 8-bit samples");
  assert.equal(header[9], 6, "PNG must use truecolor + alpha");
  return {
    width: header.readUInt32BE(0), height: header.readUInt32BE(4),
    scanlines: inflateSync(Buffer.concat(chunks.IDAT!)),
  };
}
test("M1 CLI exposes a machine-readable, conservative capability contract", () => {
  const response = run("capabilities");
  assert.equal(response.status, 0, response.stderr);
  const info = readJson(response.stdout);
  assert.equal(info.ok, true);
  assert.equal(info.contract, "bigr.export.cli.v1");
  assert.equal(info.packageSchema, "bigr.asset.v1");
  assert.deepEqual(info.render.inputPixelFormats, ["rgba8"]);
  assert.deepEqual(info.render.outputFormats, ["png"]);
  assert.deepEqual(info.render.scalingMethods, ["nearest"]);
  assert.ok(info.unavailable.includes("animation"));
  const invalid = run("capabilities", "--ignored");
  assert.equal(invalid.status, 2);
  assert.equal(readJson(invalid.stderr).error.code, "INVALID_ARGUMENTS");
});
test("M1 validates existing asset packages and refuses corrupted payloads", async () => {
  const parent = mkdtempSync(join(tmpdir(), "bigr-m1-validate-"));
  try {
    const input = await fixture(parent, original);
    const success = run("validate", "--input", input);
    assert.equal(success.status, 0, success.stderr);
    const info = readJson(success.stdout);
    assert.equal(info.valid, true);
    assert.equal(info.pngRenderable, true);
    assert.equal(info.assetId, "synthetic_rgba");
    assert.match(info.sourceManifestSha256, /^[0-9a-f]{64}$/);
    writeFileSync(join(input, "data", "raster-pixels.bin"), new Uint8Array(8));
    const corrupt = run("validate", "--input", input);
    assert.equal(corrupt.status, 4);
    assert.equal(readJson(corrupt.stderr).error.code, "INVALID_PACKAGE");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
test("M1 PNG export preserves exact RGBA pixels, uniform scale and provenance hashes", async () => {
  const parent = mkdtempSync(join(tmpdir(), "bigr-m1-export-"));
  try {
    const input = await fixture(parent, original);
    const sourceManifest = readFileSync(join(input, "manifest.json"), "utf8");
    const out = join(parent, "output");
    const first = run("render", "--input", input, "--output", out, "--scale", "2");
    assert.equal(first.status, 0, first.stderr);
    const report = readJson(first.stdout);
    assert.equal(report.ok, true);
    assert.deepEqual([report.output.width, report.output.height], [4, 2]);
    assert.deepEqual(report.rendering, { method: "nearest", scaleX: 2, scaleY: 2 });
    assert.equal(report.source.assetId, "synthetic_rgba");
    assert.match(report.output.sha256, /^[0-9a-f]{64}$/);
    assert.deepEqual(readdirSync(out).sort(), ["image.png", "result.json"]);
    assert.deepEqual(readJson(readFileSync(join(out, "result.json"), "utf8")), report);
    const png = unpackPng(readFileSync(join(out, "image.png")));
    assert.deepEqual([png.width, png.height], [4, 2]);
    const row = [
      0, 255, 0, 0, 255, 255, 0, 0, 255,
      0, 255, 0, 64, 0, 255, 0, 64,
    ];
    // Unfiltered scanline: filter-byte 0 followed by 4 RGBA pixels.
    const expected = Uint8Array.from([...row, ...row]);
    assert.deepEqual([...png.scanlines], [...expected]);
    assert.equal(readFileSync(join(input, "manifest.json"), "utf8"), sourceManifest);
    const repeated = run("render", "--input", input, "--output", out);
    assert.equal(repeated.status, 5, "Existing destination must never be overwritten");
    assert.equal(readJson(repeated.stderr).error.code, "DESTINATION_EXISTS");
    assert.ok(!readdirSync(parent).some(name => name.startsWith(".bigr-m1-stage-")));
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
test("M1 native export defaults to 1x and rejects nested or invalid outputs", async () => {
  const parent = mkdtempSync(join(tmpdir(), "bigr-m1-native-"));
  try {
    const input = await fixture(parent, original);
    const out = join(parent, "native");
    const native = run("render", "--input", input, "--output", out);
    assert.equal(native.status, 0, native.stderr);
    const image = unpackPng(readFileSync(join(out, "image.png")));
    assert.deepEqual([image.width, image.height], [2, 1]);
    assert.deepEqual([...image.scanlines], [0, ...Array.from(original.kind === "raster" ? original.raster.pixels : [])]);
    const nested = run("render", "--input", input, "--output", join(input, "nested"));
    assert.equal(nested.status, 2);
    assert.equal(readJson(nested.stderr).error.code, "INVALID_ARGUMENTS");
    assert.equal(run("render", "--input", input, "--output", join(parent, "bad"), "--scale", "1.5").status, 2);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
test("M1 refuses indexed palette guessing, ambiguous masks and animation packages", async () => {
  for (const [label, asset] of [
    ["indexed", { kind: "raster", raster: {
      width: 1, height: 1, format: "indexed8", pixels: Uint8Array.from([0]),
    } }],
    ["masked", { kind: "raster", raster: {
      width: 1, height: 1, format: "rgba8",
      pixels: Uint8Array.from([255, 0, 0, 255]), mask: Uint8Array.from([128]),
    } }],
    ["animation", { kind: "animation", animation: {
      canvas: { width: 1, height: 1 }, frames: [
        { x: 0, y: 0, durationMs: 80, raster: {
          width: 1, height: 1, format: "rgba8", pixels: Uint8Array.from([0, 0, 0, 255]),
        } },
      ],
    } }],
  ] as const) {
    const parent = mkdtempSync(join(tmpdir(), "bigr-m1-unsupported-"));
    try {
      const input = await fixture(parent, asset as SourceAsset);
      const validation = run("validate", "--input", input);
      assert.equal(validation.status, 0, validation.stderr);
      assert.equal(readJson(validation.stdout).pngRenderable, false);
      const output = join(parent, "output");
      const response = run("render", "--input", input, "--output", output);
      assert.equal(response.status, 3, response.stderr);
      assert.equal(readJson(response.stderr).error.code, "UNSUPPORTED_FEATURE", label);
      assert.ok(!readdirSync(parent).includes("output"));
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  }
});
