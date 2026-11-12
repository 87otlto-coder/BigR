# BigR binary package v1 (P1 implementation)

This document describes the **implemented package codec** and CLI on the P1 feature branch. The cross-project interchange specification in [ASSET_CONTRACT.md](ASSET_CONTRACT.md) remains a broader design document until externally verified.

## Directory format

A package directory contains exactly:

- \`manifest.json\` — UTF-8 JSON with schema \`bigr.asset.v1\`, an asset ID, \`kind\` (\`raster\` or \`animation\`), asset descriptor, and a \`payloads\` table;
- \`data/*.bin\` — tightly packed, **uncompressed** binary payloads. Every referenced entry has an exact byte length and lowercase SHA-256 digest.

The parser rejects unknown schema versions and unknown structured fields. It never interprets pixels as a game palette or guesses missing metadata. An indexed asset may have no palette; if provided, it retains explicit \`verified\`, \`candidate\`, or \`unknown\` confidence. Pixel index zero has no automatic transparency semantics. Masks are independent, arbitrary byte arrays, copied without thresholding.

## Example manifest (illustrative only)

The SHA-256 field below is a real digest of the **single ASCII byte \`a\`**, not an actual palette or gameplay capture.

\`\`\`json
{
  "schema": "bigr.asset.v1",
  "assetId": "one-pixel-synthetic",
  "kind": "raster",
  "raster": {
    "width": 1,
    "height": 1,
    "format": "indexed8",
    "pixels": "data/raster-pixels.bin"
  },
  "payloads": {
    "data/raster-pixels.bin": {
      "byteLength": 1,
      "sha256": "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb"
    }
  }
}
\`\`\`

Never treat the example as evidence of original game output.

## TypeScript codec

\`\`\`ts
import {
  packageAsset, canonicalManifestJson, unpackAsset, scaleAssetPackage
} from "bigr-pixel-core";

const source = await packageAsset({
  kind: "raster",
  raster: {
    width: 2, height: 1, format: "indexed8",
    pixels: new Uint8Array([3, 8]),
    mask: new Uint8Array([255, 0])
  },
  provenance: { extractor: "synthetic-example", confidence: "unknown" }
}, "example");

const encodedManifest = canonicalManifestJson(source.manifest);
const verifiedAsset = await unpackAsset(source);
const scaled = await scaleAssetPackage(source, { x: 5, y: 6 });
\`\`\`

Each \`packageAsset\` output is an in-memory \`{manifest, blobs}\` object. The caller may save \`canonicalManifestJson(manifest)\` as \`manifest.json\` and each \`blobs[path]\` into the corresponding \`data/\` file. The CLI reads and verifies this layout from disk.

For an animation, frames retain order, variable \`durationMs\`, negative/offscreen placement, frame IDs, metadata and source provenance. The P1 codec preserves \`sourceCanvas\` and \`sourcePlacement\` across repeated scaling stages. It does **not** render composited frames, invent actor states or calculate layer ordering.

## CLI

\`\`\`sh
npm run build
node bin/bigr.mjs --input SOURCE_DIRECTORY --output NEW_DIRECTORY --x 5 --y 6
\`\`\`

\`--y\` defaults to \`--x\` when omitted. Factors must be positive safe integers. For a 320x200 canvas, \`--x 5 --y 6\` produces 1600x1200 with **integer, not interpolated**, pixels. There is no arbitrary fractional aspect-ratio resampling.

Safety:

- Never run against a game ROM: input is a BigR package directory, not a game archive or image file.
- Manifest paths are constrained to safe relative \`data/*.bin\` names. Binary symlinks are rejected by the CLI.
- Every declared payload must match its SHA-256 and byte count; unknown versions, extra/missing payload blobs and other mismatches fail visibly.
- No existing output directory may be overwritten, and output may not nest inside input or vice versa.
- Output is built in a temporary sibling directory, reverified, then renamed to the requested destination. Errors remove temporary output.
- Guardrails: 64-million pixels per raster/canvas (in core), 10,000 frames, and 512 MiB of package payloads.
- No source graphics or fixtures are bundled with BigR; run real-asset acceptance privately.

## Boundaries and follow-up

This is a **binary package implementation**, not real MK2 / MI2 / SMB3 acceptance. P1 is still incomplete until independent verified game assets, color/palette context, layer placement, hashes and timing are tested. The package schema does not yet support multiple palettes for one frame or comprehensive renderer state. Represent those as explicitly typed future versions, not guessed v1 fields. The package license/publication decision and deterministic dependency lockfile are separate hardening tasks.
