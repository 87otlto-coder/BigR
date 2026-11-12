import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  PACKAGE_SCHEMA, MAX_PACKAGE_BYTES, canonicalJson, canonicalManifestJson,
  packageAsset, parseManifest, scaleAssetPackage, sha256, unpackAsset, validateManifest,
} from "../src/index.ts";
import type { Animation, AssetPackage, SourceAsset } from "../src/index.ts";

function example(): SourceAsset {
  return {
    kind: "raster",
    raster: {
      width: 2, height: 1, format: "indexed8",
      pixels: Uint8Array.from([0, 251]),
      mask: Uint8Array.from([4, 255]),
      palette: { channels: 3, entries: Uint8Array.from([1, 2, 3, 200, 80, 7]), confidence: "unknown", id: "unverified-01" },
    },
    metadata: { z: 0, source: "synthetic", flags: [false, null, 4.25] },
    provenance: { origin: "synthetic-test", confidence: "candidate" },
  };
}
function animated(): SourceAsset {
  const a = { width: 1, height: 1, format: "indexed8" as const, pixels: Uint8Array.from([12]) };
  const b = { width: 1, height: 1, format: "indexed8" as const, pixels: Uint8Array.from([18]) };
  const animation: Animation = {
    canvas: { width: 320, height: 200 },
    provenance: { engine: "synthetic", states: ["A", "B", "A"] },
    frames: [
      { id: "A0", x: -2, y: 3, durationMs: 40, raster: a, metadata: { phase: 1 } },
      { id: "B", x: 319, y: 190, durationMs: 67, raster: b },
      { id: "A1", x: -2, y: 3, durationMs: 40, raster: a },
    ],
  };
  return { kind: "animation", animation, metadata: { scene: 7 } };
}
function payloadNames(pkg: AssetPackage): string[] { return Object.keys(pkg.blobs).sort(); }
function copyPackage(pkg: AssetPackage): AssetPackage {
  return {
    manifest: JSON.parse(canonicalManifestJson(pkg.manifest)),
    blobs: Object.fromEntries(Object.entries(pkg.blobs).map(([path, bytes]) => [path, new Uint8Array(bytes)])),
  };
}
test("canonical JSON orders keys and rejects unsupported metadata without inventing information", () => {
  assert.equal(canonicalJson({ z: [3, { b: 2, a: 1 }], a: true }), '{"a":true,"z":[3,{"a":1,"b":2}]}');
  assert.throws(() => canonicalJson({ bad: NaN }), /non-finite/);
  assert.throws(() => canonicalJson({ bad: undefined }), /non-JSON/);
  const loop: Record<string, unknown> = {};
  loop.loop = loop;
  assert.throws(() => canonicalJson(loop), /circular/);
  assert.equal(PACKAGE_SCHEMA, "bigr.asset.v1");
});
test("sha256 matches a known reference digest", async () => {
  assert.equal(await sha256(new TextEncoder().encode("abc")), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
test("indexed pixels, arbitrary mask bytes and unknown palette survive round trip unchanged", async () => {
  const input = example();
  const packed = await packageAsset(input, "fixture_raster");
  const manifestText = canonicalManifestJson(packed.manifest);
  assert.equal(manifestText, canonicalManifestJson(parseManifest(manifestText)));
  assert.deepEqual(payloadNames(packed), [
    "data/raster-mask.bin", "data/raster-palette.bin", "data/raster-pixels.bin",
  ]);
  const restored = await unpackAsset(packed);
  assert.deepEqual(restored, input);
  assert.notStrictEqual(restored, input);
  if (restored.kind !== "raster" || input.kind !== "raster") throw new Error("wrong asset kind");
  restored.raster.pixels[0] = 42;
  restored.raster.mask![0] = 99;
  restored.raster.palette!.entries[0] = 44;
  assert.equal(input.raster.pixels[0], 0);
  assert.equal(input.raster.mask![0], 4);
  assert.equal(input.raster.palette!.entries[0], 1);
  assert.equal(packed.blobs["data/raster-pixels.bin"]![0], 0);
});
test("source-to-output hashes, scaled bytes and consistent animation geometry survive two stages", async () => {
  const source = await packageAsset(animated(), "synthetic_room_7");
  const once = await scaleAssetPackage(source, { x: 5, y: 6 });
  const onceDecoded = await unpackAsset(once);
  assert.equal(once.manifest.assetId, "synthetic_room_7-nn-5x6");
  assert.deepEqual(once.manifest.derivation, {
    method: "nearest-neighbor", scaleX: 5, scaleY: 6,
    sourceManifestSha256: await sha256(new TextEncoder().encode(canonicalManifestJson(source.manifest))),
  });
  if (onceDecoded.kind !== "animation") throw new Error("wrong asset kind");
  assert.deepEqual(onceDecoded.animation.canvas, { width: 1600, height: 1200 });
  assert.deepEqual(onceDecoded.animation.sourceCanvas, { width: 320, height: 200 });
  assert.deepEqual(onceDecoded.animation.frames.map(f => [f.x, f.y, f.durationMs, f.id]), [
    [-10, 18, 40, "A0"], [1595, 1140, 67, "B"], [-10, 18, 40, "A1"],
  ]);
  assert.deepEqual(onceDecoded.animation.frames[0]!.sourcePlacement, { x: -2, y: 3, width: 1, height: 1 });
  const twice = await scaleAssetPackage(once, { x: 2, y: 2 });
  const twiceDecoded = await unpackAsset(twice);
  if (twiceDecoded.kind !== "animation") throw new Error("wrong asset kind");
  assert.deepEqual(twiceDecoded.animation.canvas, { width: 3200, height: 2400 });
  assert.deepEqual(twiceDecoded.animation.sourceCanvas, { width: 320, height: 200 });
  assert.deepEqual(twiceDecoded.animation.frames.map(f => [f.x, f.y]), [[-20, 36], [3190, 2280], [-20, 36]]);
  assert.deepEqual(twiceDecoded.animation.frames[0]!.sourcePlacement, { x: -2, y: 3, width: 1, height: 1 });
  assert.deepEqual(twiceDecoded.animation.frames.map(f => f.durationMs), [40, 67, 40]);
});
test("identical source, options and metadata are byte-for-byte deterministic", async () => {
  const p1 = await packageAsset(example(), "repeatable");
  const p2 = await packageAsset(example(), "repeatable");
  assert.equal(canonicalManifestJson(p1.manifest), canonicalManifestJson(p2.manifest));
  for (const path of payloadNames(p1)) assert.deepEqual(p1.blobs[path], p2.blobs[path]);
  const a = await scaleAssetPackage(p1, { x: 2, y: 3 });
  const b = await scaleAssetPackage(p2, { x: 2, y: 3 });
  assert.equal(canonicalManifestJson(a.manifest), canonicalManifestJson(b.manifest));
});
test("corrupted, truncated, missing, extra or orphan payloads are rejected visibly", async () => {
  const pkg = await packageAsset(example(), "check_failure");
  const path = "data/raster-pixels.bin";
  const corrupt = copyPackage(pkg);
  corrupt.blobs[path]![0] ^= 1;
  await assert.rejects(unpackAsset(corrupt), /SHA-256 mismatch/);
  const truncated = copyPackage(pkg);
  truncated.blobs[path] = new Uint8Array(1);
  await assert.rejects(unpackAsset(truncated), /byte-length mismatch/);
  const missing = copyPackage(pkg);
  delete missing.blobs[path];
  await assert.rejects(unpackAsset(missing), /does not exactly match/);
  const extra = copyPackage(pkg);
  extra.blobs["data/orphan.bin"] = Uint8Array.from([9]);
  await assert.rejects(unpackAsset(extra), /does not exactly match/);
  const orphanManifest = copyPackage(pkg);
  orphanManifest.manifest.payloads["data/unreferenced.bin"] = { byteLength: 1, sha256: "f".repeat(64) };
  assert.throws(() => validateManifest(orphanManifest.manifest), /keys do not exactly match/);
});
test("untrusted manifests fail explicitly on version, path, fields and inflated payload size", async () => {
  const pkg = await packageAsset(example(), "unsafe");
  const manifest = pkg.manifest;
  assert.throws(() => parseManifest('{"schema":"bigr.asset.v2"}'), /unsupported package schema/);
  assert.throws(() => parseManifest('{"schema":"bigr.asset.v1","assetId":"../secret"}'), /assetId/);
  assert.throws(() => validateManifest({ ...manifest, surprise: "ignored?" }), /unsupported field/);
  const wrongPath = copyPackage(pkg).manifest;
  wrongPath.raster!.pixels = "../escape.bin";
  assert.throws(() => validateManifest(wrongPath), /unsafe payload path/);
  const oversized = copyPackage(pkg).manifest;
  oversized.payloads["data/raster-pixels.bin"]!.byteLength = MAX_PACKAGE_BYTES + 1;
  assert.throws(() => validateManifest(oversized), /MAX_PACKAGE_BYTES/);
  const wrongBytes = copyPackage(pkg);
  wrongBytes.manifest.raster!.width = 3;
  await assert.rejects(unpackAsset(wrongBytes), /exactly 3 bytes/);
});
test("filesystem CLI scales private synthetic bundles without overwriting source or destination", async () => {
  const parent = mkdtempSync(join(tmpdir(), "bigr-p1-"));
  try {
    const inputDir = join(parent, "input");
    const outputDir = join(parent, "output");
    mkdirSync(join(inputDir, "data"), { recursive: true });
    const pkg = await packageAsset(example(), "cli_source");
    const inputText = canonicalManifestJson(pkg.manifest);
    writeFileSync(join(inputDir, "manifest.json"), inputText);
    for (const [name, bytes] of Object.entries(pkg.blobs)) {
      writeFileSync(join(inputDir, name), bytes);
    }
    function run(output = outputDir) {
      return spawnSync(process.execPath, [
        "bin/bigr.mjs", "--input", inputDir, "--output", output, "--x", "5", "--y", "6",
      ], { cwd: process.cwd(), encoding: "utf8" });
    }
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(readFileSync(join(inputDir, "manifest.json"), "utf8"), inputText);
    const files = readdirSync(join(outputDir, "data")).sort();
    assert.equal(files.length, 3);
    const outManifest = parseManifest(readFileSync(join(outputDir, "manifest.json"), "utf8"));
    const blobs = Object.fromEntries(files.map(name => [
      "data/" + name, new Uint8Array(readFileSync(join(outputDir, "data", name))),
    ]));
    const decoded = await unpackAsset({ manifest: outManifest, blobs });
    if (decoded.kind !== "raster") throw new Error("wrong asset kind");
    assert.deepEqual([decoded.raster.width, decoded.raster.height], [10, 6]);
    assert.equal(decoded.raster.mask![0], 4);
    assert.equal(decoded.raster.palette!.confidence, "unknown");
    assert.equal(run().status, 1, "CLI must refuse overwriting destination");
    const unlisted = join(inputDir, "data", "unlisted.bin");
    writeFileSync(unlisted, Uint8Array.from([1]));
    const rejectedExtra = run(join(parent, "must-not-exist"));
    assert.equal(rejectedExtra.status, 1, "CLI must refuse unlisted files");
    assert.match(rejectedExtra.stderr, /unlisted source payload files/);
    unlinkSync(unlisted);
    assert.ok(!readdirSync(parent).some(name => name.startsWith(".bigr-stage-")), "staging directory leaked");
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});
