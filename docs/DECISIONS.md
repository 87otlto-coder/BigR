# BigR — Architecture and product decision log

Use concise ADR entries containing: **Decision; Rationale; Consequences; Status; Date**. Proposed choices are not approved technology commitments. Update when evidence changes a decision rather than silently rewriting history.

## BR-001 — Independent graphics processing engine
- **Status:** Agreed principle, 2026-11-12.
- **Decision:** BigR transforms already reconstructed image assets and metadata; it does not decode ROMs/game archives, emulate hardware or infer game semantics.
- **Rationale:** Protect independent extractor verification and avoid three redundant scalers.
- **Consequences:** Consumer-specific conversions belong in replaceable adapters.

## BR-002 — Indexed-first, immutable and deterministic
- **Status:** Agreed principle, 2026-11-12.
- **Decision:** Treat original indices, independent masks, palette metadata and provenance as canonical. Provide pixel-exact integer nearest-neighbor outputs separately from originals. Support RGBA without making it mandatory.
- **Rationale:** Palette uncertainty and recolouring must survive scaling.
- **Consequences:** Palette flattening and lossy enhancement cannot be the only processing path.

## BR-003 — Evidence, confidence and unknowns
- **Status:** Agreed principle, 2026-11-12.
- **Decision:** Retain provided raw/captured/decoded classifications and verified/inferred/hypothesis/unknown confidence, without guessing missing timings, palettes, groupings or positioning.
- **Rationale:** Verified index bytes do not prove correct display colours, and previews do not prove runtime animation behavior.
- **Consequences:** Missing facts remain visibly missing; fail closed on incompatible inputs.

## BR-004 — Windows-first governance
- **Status:** Inherited standing policy, 2026-11-12.
- **Decision:** Develop for owner's Windows workspace; hosted CI is Windows-only unless approved otherwise. No mandatory Linux/macOS matrices, no routine CI artifact upload, no unapproved paid spending.
- **Rationale:** Align with the verified 2026-11-11 shared incident response in the three extractors.
- **Consequences:** Synthetic CI first; actual game integration remains opt-in and local.

## BR-005 — Versioned cross-project asset contract
- **Status:** Design intent; precise schema/API undecided, 2026-11-12.
- **Decision:** Preserve full source geometry, origin/offsets, masks, indexed/palette data, animation metadata and provenance through an explicitly versioned contract.
- **Rationale:** Three consumers require different adapters without coupling to core logic.
- **Consequences:** Stable schemas need compatibility tests and migration notes for breaking changes.

## Open decisions (Milestone 1)
- Core implementation language, packaging and browser/WASM strategy.
- Exact asset schema types, integer coordinate scaling semantics and metadata representations.
- Export encoding libraries and requirements for indexed PNG/APNG/GIF.
- Stable error taxonomy, resource caps and batch cancellation interface.
- Whether an interactive demo is useful **after** the library's contract is validated.

Do not implement unsettled choices by assumption.
