# BigR

**A standalone, evidence-preserving pixel-art scaling engine.**

BigR is being designed as a shared processing library for [ScummBucket](https://github.com/87otlto-coder/Scummbucket), [SpriteMine](https://github.com/87otlto-coder/SpriteMine), and [MK DOS Archive / Extractor](https://github.com/87otlto-coder/mk-dos-archive).

The first goal is deterministic, **indexed-first nearest-neighbor scaling** of supplied decoded graphics. BigR will preserve original palette indices, masks, transparency, geometry, animation metadata, uncertainty and provenance. It will not decode games, infer palette ownership or fabricate animation information.

## Status

**Governance and architecture planning.** No processing engine, stable API, integration or validated export is claimed yet. The programming language and cross-language packaging are not decided.

## Initial milestones

1. **Architecture:** Select technology; document versioned asset contract, failure semantics and module boundaries.
2. **Processing core:** Implement exact integer nearest-neighbor scaling of indexed pixels, masks and RGBA images.
3. **Verification:** Synthetic NES/SCUMM/MK-inspired fixtures, negative cases and optional private local integration validation.
4. **Integration readiness:** Stable client adapters/API contracts, compatibility tests and non-destructive export workflow.

## Project documents

- [AGENTS.md](AGENTS.md) — canonical rules for AI agents and engineering work.
- [Project charter](docs/PROJECT_CHARTER.md) — mission, boundaries and acceptance milestones.
- [Architecture decisions](docs/DECISIONS.md) — agreed principles and unresolved choices.
- [Short project instructions](docs/PROJECT_INSTRUCTIONS.md) — companion agent context.
- [CI and evidence policy](docs/CI_AND_EVIDENCE_POLICY.md) — Windows-only, $0, private data and artifact retention rules.

## Development policy

Work on review branches and PRs. No merges into `main` without owner approval. Windows-first; GitHub Actions Windows-only if introduced. No routine build artifacts. Keep proprietary ROMs, original commercial game files and extracted copyrighted assets outside this public repository.

BigR's asset-processing algorithms are intentionally separate from the extractor applications and their UIs.
