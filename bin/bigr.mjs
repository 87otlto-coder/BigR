#!/usr/bin/env node
// BigR CLI: versioned packages only. Never reads game ROMs or overwrites a source tree.
import { lstat, mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { canonicalManifestJson, parseManifest, scaleAssetPackage, unpackAsset } from "../dist/index.js";

const usage = "Usage: node bin/bigr.mjs --input PACKAGE_DIR --output NEW_DIR --x POSITIVE_INTEGER [--y POSITIVE_INTEGER]";
function args(argv) {
  const map = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!["--input", "--output", "--x", "--y"].includes(key) || i + 1 >= argv.length || map.has(key)) {
      throw new Error("Invalid or repeated CLI option: " + key + "\n" + usage);
    }
    map.set(key, argv[i + 1]);
  }
  for (const required of ["--input", "--output", "--x"]) {
    if (!map.has(required)) throw new Error("Missing " + required + "\n" + usage);
  }
  const x = Number(map.get("--x"));
  const y = map.has("--y") ? Number(map.get("--y")) : x;
  if (!Number.isSafeInteger(x) || x <= 0 || !Number.isSafeInteger(y) || y <= 0) {
    throw new RangeError("scale factors must be positive safe integers");
  }
  const input = resolve(map.get("--input"));
  const output = resolve(map.get("--output"));
  if (input === output || output.startsWith(input + sep) || input.startsWith(output + sep)) {
    throw new Error("input and output directories must be separate, non-nested paths");
  }
  return { input, output, x, y };
}
async function requireRegularDirectory(path) {
  const entry = await lstat(path);
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error("Directory must be real and not a symlink: " + path);
  }
}
async function requireRegularFile(path) {
  const entry = await lstat(path);
  if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("File must be regular and not a symlink: " + path);
}
async function assertNotExisting(path) {
  try {
    await lstat(path);
    throw new Error("Destination already exists; refusing to overwrite: " + path);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}
async function main() {
  const { input, output, x, y } = args(process.argv.slice(2));
  await requireRegularDirectory(input);
  await requireRegularDirectory(join(input, "data"));
  await requireRegularFile(join(input, "manifest.json"));
  const manifestInfo = await lstat(join(input, "manifest.json"));
  if (manifestInfo.size > 10 * 1024 * 1024) throw new RangeError("manifest exceeds 10 MiB limit");
  const raw = await readFile(join(input, "manifest.json"), "utf8");
  const manifest = parseManifest(raw);
  const expected = Object.keys(manifest.payloads).map(path => path.slice("data/".length)).sort();
  const actual = (await readdir(join(input, "data"))).sort();
  if (actual.length !== expected.length || actual.some((name, index) => name !== expected[index])) {
    throw new Error("unexpected, missing, or unlisted source payload files in data/");
  }
  const blobs = Object.create(null);
  for (const path of Object.keys(manifest.payloads).sort()) {
    // parseManifest validates that paths are data/<safe-name>.bin, with no traversal.
    if (isAbsolute(path)) throw new Error("Unexpected absolute payload path");
    const filename = join(input, path);
    await requireRegularFile(filename);
    blobs[path] = new Uint8Array(await readFile(filename));
  }
  const scaled = await scaleAssetPackage({ manifest, blobs }, { x, y });
  await unpackAsset(scaled); // Verify own output before publishing anything.
  await assertNotExisting(output);
  const parent = dirname(output);
  // Staging is on the destination volume; a successful rename publishes one complete directory.
  const temp = await mkdtemp(join(parent, ".bigr-stage-"));
  try {
    await mkdir(join(temp, "data"));
    for (const [path, bytes] of Object.entries(scaled.blobs)) {
      await writeFile(join(temp, path), bytes, { flag: "wx" });
    }
    await writeFile(join(temp, "manifest.json"), canonicalManifestJson(scaled.manifest), { flag: "wx" });
    await assertNotExisting(output);
    await rename(temp, output);
  } catch (error) {
    await rm(temp, { recursive: true, force: true });
    throw error;
  }
  process.stdout.write("BigR scaled " + manifest.assetId + " -> " + scaled.manifest.assetId +
    " (nearest " + x + "x" + y + "), manifest and SHA-256 payloads verified.\n");
}

main().catch(error => {
  process.stderr.write("BigR failed: " + (error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
});
