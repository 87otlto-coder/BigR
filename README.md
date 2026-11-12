# BigR

**An independent, asset-level pixel-art scaling engine.** BigR transforms graphics that have already been decoded and reconstructed by other tools. It does not decode archives, infer palettes, repair scenes or discover missing animation frames.

## Status

**0.1.0 foundation.** The first implementation offers a browser-compatible TypeScript core with deterministic integer nearest-neighbor scaling for indexed8 and RGBA8 rasters, optional masks, separate X/Y scaling factors, and positioned animation frames. There is **no GUI, PNG/GIF writer, import adapter or AI mode yet**.

## Rules

- Preserve source assets and evidence; output goes into independent buffers.
- Scale indexed pixels without applying or guessing a palette. Keep palette confidence (verified, candidate, unknown).
- Scale masks without thresholding; preserve alpha values, source positions, animation frame order, durations and fixed canvas.
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

## Documentation

- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Draft source asset contract](docs/ASSET_CONTRACT.md)
- [Extractor integration plan](docs/INTEGRATIONS.md)
- [Roadmap and acceptance gates](docs/ROADMAP.md)
- [Development and verification rules](docs/DEVELOPMENT_RULES.md)

## CI and distribution

Windows-only checks run on PRs, pushes to `main`, and manual dispatch. CI has no artifact upload step. No copyrighted ROMs or original game graphics are committed. The npm package is marked `private` while the API and source-license choice remain unsettled.
