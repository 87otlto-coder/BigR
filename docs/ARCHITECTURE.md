# BigR architecture — foundation

## Scope boundary

```text
User-supplied game data
  -> external extractor/renderer: decode and reconstruct
  -> portable asset contract: pixels/palette/mask/geometry/timing/provenance
  -> BigR: deterministic, non-destructive asset scaling
  -> external exporter: PNG/spritesheet/GIF/video/browser preview
```

BigR never decodes a game archive, discovers a palette, guesses missing animation frames, repairs source errors, or blends away uncertainty. Scaling remains independent of any extractor's UI. Future integrations must explicitly distinguish source and scaled coordinates.

## Implemented in P0

- Portable TypeScript ES modules, no runtime dependencies.
- Indexed8 and RGBA8 nearest-neighbor raster scaling with **separate positive integer X/Y factors**.
- Mask scaling using the *same* exact mapping as the pixel bytes; mask values are neither normalized nor interpreted.
- Palette entries copied without interpretation, including their verified/candidate/unknown confidence.
- Animation frames scaled in supplied order without deduplication or retiming; fixed canvas, negative/offscreen placement and source placement retained.
- Fresh pixel/mask/palette output buffers; source metadata cloned.
- Explicit errors for malformed lengths/dimensions/scale, and a **64-million-pixel** per-raster/canvas safety ceiling. Never silently clamp.

## Deliberately not implemented yet

Palette rendering; clipping/compositing; fractional aspect conversion; GUI; PNG/GIF/video encoders; bulk CLI; SHA-256 manifest packaging; third-party extractor adapters; edge filters or AI enhancement. An exporter or adapter must not claim that a scaled individual frame is already a correctly composed animation canvas.

## Future enhancement track

Nearest neighbor is the pixel-exact reference. Alternative pixel-art filters and any AI-assisted reconstruction must have separate mode identifiers, independent outputs, comparison tests and opt-in settings. Do not overwrite or rename the verified baseline as an enhanced result.
