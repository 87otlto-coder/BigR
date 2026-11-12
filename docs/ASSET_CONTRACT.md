# Draft asset interchange contract v0.1

The TypeScript model in `src/types.ts` is implemented **in memory**. The portable file package below is a design proposal and is **not yet an importer or exported file format**.

## In-memory interface

- `Raster`: width, height, format `indexed8|rgba8`, row-major byte-packed `Uint8Array` pixels. Optional one-byte-per-pixel mask; values are copied exactly.
- `Palette`: optional for indexed data. RGB or RGBA entry bytes, `verified|candidate|unknown` confidence, optional source identifier. No color inference in BigR.
- `Animation`: original fixed canvas, ordered frames with signed x/y offsets, positive integer durationMs, optional IDs, JSON-compatible metadata and provenance.
- `ScaledAnimation`: scaled canvas plus `sourceCanvas`; scaled frames include unscaled `sourcePlacement`. Negative/off-canvas positions remain valid.

## Proposed portable package

```json
{
  "contractVersion": "0.1-draft",
  "assetId": "illustrative-asset",
  "format": "indexed8",
  "canvas": {"width": 320, "height": 200},
  "source": {"extractor": "external-tool", "confidence": "candidate"},
  "frames": [
    {
      "id": "frame000", "x": -2, "y": 12,
      "width": 16, "height": 20, "durationMs": 100,
      "pixelRef": "frames/000.indexed8", "maskRef": "frames/000.mask8"
    }
  ]
}
```

Example only; not evidence of a real extraction. Typed-array payloads will live in referenced binary files, validated by byte lengths and hashes. The frozen package schema must explicitly represent palette switches/variants, uncertain metadata, masks, sprite origins, layers, source coordinates, animation timing and provenance.

## Adapter invariants

1. Verify input byte counts and SHA-256 hashes before scaling; never trust an unverified manifest.
2. Make units explicit: source vs output placement, origins, offsets, bounding boxes, collision/mask positions, and layer coordinates.
3. Never assume index 0 means transparency. Carry palette certainty and source masks independently.
4. Never silently drop unknown fields or unsupported schema versions: preserve them in a sidecar or fail visibly.
5. Preserve frame order, duplicates and supplied timing; do not confuse a cropped frame with a full-canvas render.
6. Provenance records identify the source, scaling version/factors and output hashes. Never overwrite original files.

Draft contract versions may change. All breaking changes need explicit versioning, migration notes and adapter verification.
