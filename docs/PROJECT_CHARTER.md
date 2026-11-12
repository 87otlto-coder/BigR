# BigR — Project charter and milestone plan

**Status:** Initial governance and architecture planning (2026-11-12). **Repository:** https://github.com/87otlto-coder/BigR

## Purpose

Build a small, standalone, reusable, deterministic pixel-art processing engine that preserves the original graphical evidence while providing faithful nearest-neighbor HD scaling. The engine is a **graphics transformer**, not an extractor or emulator.

### First-class consumers

| Consumer | Input boundary | Initial emphasis |
| --- | --- | --- |
| ScummBucket | Decoded SCUMM images, transparency, palettes, layers, geometry and verified animation metadata | Original DOS VGA graphics and scene/asset alignment |
| SpriteMine | Decoded NES CHR indices, selected palette metadata, OAM/component geometry, visibility masks and captured frames | SMB3 US PRG1 / Revision A |
| MK DOS Extractor | Indexed graphics, transparency and colour-known masks, candidate/verified palettes, stage layers, sprite origins and available timelines | Verified MK2 intro/isolated graphic/source floor fixtures; MK1/MK3 later |

Each consumer owns source parsing, decoding, scene reconstruction, animation identification, actual palette ownership and hardware/game interpretation. BigR accepts what is provided, preserves uncertainties and does not manufacture facts.

## Design constraints

- Indexed pixels and separate masks are first-class data, not merely RGBA previews.
- Lossless integer nearest-neighbor scaling preserves exact indices/masks and consistently transforms all supplied geometry. Keep original metadata and scaled geometry distinguishable.
- Preserve source-local dimensions even when larger than a game viewport. Never silently crop to a screen.
- Timeline/frame IDs, repeated frames, known durations, origins, offsets and layer relationships remain stable. Unknown timing remains unknown.
- Preserve raw/captured/decoded and verified/inferred/hypothesis/unknown classifications **as provided**. Track provenance, transform settings, version and output hashes.
- Separate pixel-exact scaling from optional aspect-ratio/display correction, non-integer resizing and future lossy pixel-art/AI enhancement.
- No dependency on individual extractor UIs. Portable core suitable for TypeScript/browser, Python/PySide6 and CLI **through future adapters**; no language/API choice has yet been approved.
- Deterministic, non-destructive outputs. Guard memory use for large layers/asset sets; avoid hidden expensive batch operations.
- Synthetic/redistributable data in public Git/CI; private commercial fixtures stay local.

## Milestones and acceptance gates

### M1 — Architecture
Investigate portable implementation choices, API/ABI options and license compatibility. Define versioned asset, palette, mask, coordinate, provenance and timeline contracts; module/repository layout; failure schema; synthetic test strategy. **Exit:** approved design decisions and at least one executable contract-validation fixture, without assuming an extractor's internals.

### M2 — Processing core
Implement pure integer nearest-neighbor scaling of indexed buffers, masks and RGBA buffers, with explicit geometry transforms, validation and limits. **Exit:** exact index/mask/pixel replication and alignment tests; native input unchanged; deterministic outputs on Windows.

### M3 — Verification
Build synthetic NES, SCUMM and MK-like fixtures and negative/adversarial tests (palettes with unknown ownership, 8x8/8x16 flips, multi-component offsets, alpha/masks, wide stage layers, repeated animation frames, invalid dimensions). **Exit:** passing Windows synthetic regression suite and documented unresolved areas. Optionally validate against private independently verified fixtures locally, with no uploads.

### M4 — Integration readiness
Publish stable versioned library API, adapters/contracts for ScummBucket, SpriteMine and MK DOS Extractor, plus reproducible PNG/sequence/sheet and metadata export strategy. **Exit:** client-side contract tests, implementation examples and compatibility report; no forced dependency on any extractor UI.

## Deferred, not promised for the initial core

Advanced pixel-art filters, AI remastering, complete scene reconstruction, interpolation, arbitrary animation inference, polished desktop/browser UI, video encoding and full supported-console/game matrices. Investigate separately after gates are met.

## Principles

Fidelity before enhancement. Evidence before confidence. Reuse before reinvention. Source data remains immutable. A small stable library is more useful than a broad unverified application.
