# BigR

**An independent, asset-level pixel-art scaling engine.** BigR transforms graphics that have already been decoded and reconstructed by other tools. It does not decode archives, infer palettes, repair scenes or discover missing animation frames.

## Status

**0.1.0 development (P1 draft).** The TypeScript core implements deterministic integer nearest-neighbor scaling for indexed8/RGBA8 assets, masks, separate X/Y factors and positioned animation frames. The P1 branch additionally offers `bigr.asset.v1` package import/export, SHA-256 validation and a non-overwriting CLI. **No GUI, raw PNG/GIF reader, game archive decoder or AI mode exists yet.**

## Rules

- Preserve source assets and evidence; output goes into independent buffers.
- Scale indexed pixels without applying or guessing a palette. Keep palette confidence (verified, candidate, unknown).
- Scale primary and separately named forensic evidence masks without thresholding; preserve alpha values, source positions, animation frame order, durations and fixed canvas.
- Fail visibly on invalid input; no automatic clipping, guessing or silent skips.
- Keep future enhancement filters fully separate from verified nearest-neighbor output.

## Quick start

Requires Node 22+ for development.

```sh
npm install
npm run verify
```

```ts
import { scaleRasterNearest } from "bigr-pixel-core";

const output = scaleRasterNearest({
  format: "indexed8",
  width: 2,
  height: 1,
  pixels: new Uint8Array([3, 8]),
}, { x: 5, y: 6 });
// output width 10, height 6; pixel indices preserved exactly.
```

For a 320x200 source animation canvas, integer factors 5x6 create 1600x1200 (4:3). This is independent integer X/Y pixel duplication, **not arbitrary fractional aspect resampling**.

## Versioned package scaling (P1 draft)

Only a **BigR package directory** can be passed to the CLI. Source artwork must first be decoded and verified by an external extractor, and packaged using the library API. A package contains `manifest.json` and referenced `data/*.bin` payloads with SHA-256 hashes.

```sh
npm run build
node bin/bigr.mjs --input ./source-package --output ./scaled-package --x 5 --y 6
```

The output directory **must not already exist**. The CLI verifies every source payload before scaling, independently checks its own output, and publishes into a new directory. It does not overwrite the source. See [package v1 and CLI](docs/PACKAGE_V1.md) for a TypeScript packaging example, limitations and security constraints.

## Documentation

- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Implemented package v1 and CLI](docs/PACKAGE_V1.md)
- [Draft source interoperability contract](docs/ASSET_CONTRACT.md)
- [Extractor integration plan](docs/INTEGRATIONS.md)
- [Roadmap and acceptance gates](docs/ROADMAP.md)
- [Development and verification rules](docs/DEVELOPMENT_RULES.md)

## CI and distribution

Windows-only checks run on PRs, pushes to `main`, and manual dispatch. CI has no artifact upload step. No copyrighted ROMs or original game graphics are committed. The npm package is marked `private` while the API and source-license choice remain unsettled.
