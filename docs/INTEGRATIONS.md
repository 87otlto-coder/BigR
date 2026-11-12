# Integration plan

All integration is **asset-level and downstream of existing extraction**. No BigR dependency should be required for a game extractor to decode or reconstruct native assets.

## 1. MK DOS Extractor — first source-data pilot

Start with independently verified MK2 material: 320x200 intro images, Mountain graphics with explicitly **uncertain palettes**, and verified Tomb/Portal floor layers. The adapter maps pixel bytes, any masks, candidate palettes, sprite/layer origins, stage geometry and provenance into BigR's contract. Validate original index and opacity planes independently from the palette-known evidence mask; preserve each as distinct byte planes. The MK2 P14/P15 floor palette-known masks can be all zero, which does not imply the pixels are transparent. Preserve palette alternatives and uncertainty rather than presenting a guessed RGB preview as authoritative. Expand to MK1/MK3 later.

## 2. ScummBucket — independent scene-animation pilot

Use confirmed Monkey Island 2 DOS VGA room/layer/frame exports, with Room 7 a key evidence target once independent reconstruction is verified upstream. Scale the full canvas and each separately positioned frame with matching factors. Verify palette changes, masks, layering, clipping, original offsets, frame order and timing. **Animated backgrounds are a required integration case**, not an optional effect. BigR cannot infer actor states or compensate for unverified extraction.

## 3. SpriteMine — indexed sprite/animation pilot

Use Super Mario Bros. 3 US PRG1/Revision A data from the existing independent SpriteMine harness. Preserve transparency, masks, origins, indexed pixels, timeline and A/B/A frame order. Scaling passing does **not** prove upstream ROM extraction correct; retain the original SpriteMine evidence separately.

## Operating requirements

- TypeScript/browser consumer interface first; optional Python/CLI bridges may use a shared versioned package, never parallel algorithms.
- No absolute paths or extractor GUI dependencies in the core.
- Never commit copyrighted ROMs, proprietary original assets, user-private captures or bulky exports.
- Use tiny synthetic, redistributable fixtures in BigR CI and separately test user-supplied private game assets.
- Missing data and bad assumptions must be exposed as errors, never silently hidden.
