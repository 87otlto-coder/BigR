# Roadmap — evidence-gated milestones

## P0 — Core foundation (this PR)

Implement and test indexed8/RGBA8 pixel-exact integer nearest-neighbor scaling, masks, independent axis factors, positioned animation frame data, fixed canvas, timing, palette uncertainty and source provenance. Document architecture, integration contract, rules and Windows CI.

**Exit:** local and Windows CI tests/typecheck/build pass. No claim of real-game acceptance.

## P1 — Portable asset packaging and MK2 evidence

Freeze versioned binary + JSON package with hashes; import/export and batch CLI; enforce safe memory budgets and deterministic output manifests. Integrate user-supplied, independently verified MK2 320x200 intro, uncertain-palette Mountain art and verified Tomb/Portal stage layers. Test pixel and mask matching, geometry, palette variants and provenance. Do not add copyrighted fixtures to GitHub.

**Exit:** reproducible MK2 source-to-output evidence, no hidden skips.

## P2 — Animated scenes and SpriteMine

Create adapter tests against verified ScummBucket MI2 DOS VGA Room 7 animated-scene reconstruction; evaluate fixed canvas, frame order/durations, palette state, masking, origin, layer placement and clipping. Validate SpriteMine SMB3 PRG1/Revision A indexed sprites/animations against its separate harness evidence. Preserve source truth.

**Exit:** explicit cross-tool acceptance reports with hashes and alignment checks.

## P3 — Aspect, exporters and usability

Define fractional aspect correction with explicit rounding/coordinate policy. Add controlled PNG/spritesheet/GIF/video exporters, preview UI and batch jobs. Extend coverage to MK1/MK3 and other games only as evidence is available.

## P4 — Enhanced HD track

Evaluate established pixel-art methods first. Offer opt-in filters and possibly AI-assisted enhancement only after nearest-neighbor fidelity is proven. Keep results separately named and side-by-side comparable.

**Not initial goals:** 12K targets, asset hallucination, custom archive decoders, full UI or AI upscaling.
