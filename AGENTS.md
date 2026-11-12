# BigR — Canonical engineering and AI-agent rules

**Status:** Standing project policy. **Repository:** https://github.com/87otlto-coder/BigR

Read this file, `docs/PROJECT_CHARTER.md`, `docs/DECISIONS.md`, and `docs/CI_AND_EVIDENCE_POLICY.md` before substantive work. This file is the authoritative operational policy; shorter project instructions must stay aligned with it. The owner decides product direction, significant scope changes, releases, merges, and destructive actions. Agents may make routine, reversible engineering decisions within the agreed scope.

## Mission and boundaries

BigR is a standalone, non-destructive pixel-art graphics scaling/processing library. Initial first-class integration targets are ScummBucket (SCUMM), SpriteMine (NES, starting with verified SMB3 US PRG1 / Revision A), and MK DOS Extractor (DOS MK1–3). It transforms already decoded images, indices, palettes, masks, coordinates, layers and timelines supplied by clients. It does **not** read game archives/ROMs, emulate a game, determine palette ownership, identify sprites or actors, reconstruct scenes, infer animations, or invent timing/positions.

The initial deliverable is a small deterministic nearest-neighbor core, not a remastering app or general UI. Indexed-first preservation is mandatory; RGBA support is complementary. Enhancement filters, aspect correction, cross-language adapters and UI grow only after evidence justifies them. Implementation language and ABI are **undecided**, not predetermined by the existing extractor stacks.

## Non-negotiable rules

1. **Evidence over assumption.** Research existing solutions and licenses before substantial implementation. Differentiate `verified`, `inferred`, `hypothesis`, and `unknown` claims. Carry source-specific `raw`, `captured`, `decoded` classifications unchanged. Do not promote confidence when merely scaling pixels.
2. **Originals are immutable.** Never modify source images, buffers, archives, palette tables, masks, private fixtures, or extractor outputs. Keep native data and derived exports separate, with source hashes and reproducible transformation settings.
3. **Indexed-first fidelity.** Scale indexed pixels and masks exactly at integer factors without flattening to RGBA. Palette binding/interpretation must remain independent. Preserve transparency, palette-known/unknown state, full source dimensions, anchors/origins, offsets, clipping and signed coordinates. Preserve verified layer and animation relationships as supplied.
4. **No invented semantics.** Never infer a missing palette owner, character/component identity, position, layer order, frame, duration or scene composition. Unsupported or ambiguous inputs must be explicit; optional preview defaults are labelled as such, not original timing.
5. **Separate transformation modes.** Lossless integer nearest-neighbor results must remain distinct from pixel-aspect correction, non-integer resampling and any experimental/lossy enhancement. Record the exact method and parameters.
6. **Failures must be visible.** Never silently suppress errors, assertions, unsupported cases, failed exports, invalid inputs or incomplete operations. Never substitute a fallback without labelling it. Report affected assets and diagnostics, continue unaffected independent work only when safe, and never call an unverified operation successful.
7. **Provenance survives processing.** Preserve supplied input IDs, content hashes, source locations, game/revision identifiers, capture/frame references, algorithm/adapter versions, palette choices and uncertainty. Output metadata must identify transformation settings and result hashes. Do not invent missing provenance.
8. **Simple, modular design.** Keep the core independent of extractors, emulator installations, browser UI and desktop UI. Put client-specific schema conversions in separate adapters. Prefer established, license-compatible dependencies to unnecessary reinvention. Never import GPL/copyleft components without assessing obligations.
9. **Quality before expansion.** Small, testable and reproducible changes, negative tests for invalid inputs, and pixel-exact regression coverage. A clean CI check alone does not establish authentic game reproduction; label local integration validation separately.
10. **Compatibility is a contract.** Version stable asset schemas and APIs. Document breaking changes, migration paths and adapter regressions. No silent backwards-incompatible behavior.
11. **Respect licensing and privacy.** Public Git and CI may contain only synthetic, owned or appropriately licensed fixtures. Do not commit or upload commercial ROMs/game files, extracted copyrighted graphics, captures, save states, private fixtures, secrets or tokens, including through logs, caches or artifacts.
12. **Communicate precisely.** State what changed, what was actually tested, the observed results, errors, limitations, unverified claims, branch and commit/PR status, and next action. Avoid claiming comprehensive support on partial evidence.

## Git workflow

- Start every substantive task by checking the latest repository, branches, current commit, existing docs and outstanding work. GitHub state overrides previous-chat assumptions.
- Keep `main` stable. Use `feature/*` for implementation, `research/*` for experiments and `docs/*` for policy/documentation changes. Use focused commits and PRs into `main`.
- **Do not push to or merge into `main` without explicit owner instruction.** Never enable auto-merge, rewrite published history, change visibility, access, branch protections, billing or delete branches/evidence without authorization.
- Avoid unrelated edits. Verify repository operations and resulting files. Do not weaken tests to force green results.
- Update `docs/DECISIONS.md` for architecture changes; `docs/PROJECT_CHARTER.md` for approved scope changes; and this file plus `docs/PROJECT_INSTRUCTIONS.md` together for policy changes.
- Maintain clear PR evidence, exclusions, and risks. No arbitrary research-pass quota; stop when evidence, risk, user input, or approval genuinely requires it.

## Local Windows workspace

Owner develops on Windows. Use the **owner's existing BigR project folder**; its absolute location has not been verified in this repository, so never guess or silently create a checkout in HOME. When configured, keep `SOURCE` (Git/code/docs), `TOOLS` (local utilities), `FIXTURE` (private immutable inputs/research), and `OUTPUT` (generated exports/reports) separate where practical. Verify paths before running or removing files. Provide copy-paste PowerShell commands with working directory and expected outcome when local action is required.

## CI and artifact rules

**Mandatory:** Read `docs/CI_AND_EVIDENCE_POLICY.md` and the 2026-11-11 incident inherited from the three extractor projects before creating, editing, or running Actions. Hosted GitHub Actions must be Windows-only (`windows-latest` or an approved pinned Windows runner); no Ubuntu, macOS, Linux containers or cross-platform OS matrices without owner approval. Prefer `pwsh`. CI defaults to synthetic, deterministic tests with **no uploaded artifacts**, no unnecessary event/version matrices, and a **$0 spend cap**. Do not add a workflow just to have one.

Only if authorized uploads become necessary: opt-in or tightly justified disposable builds, three-day expiry, retention of newest three successful builds per exact artifact type across branches **after** successful producing run and upload, and identity-checked serialized cleanup; never destroy unique evidence. Audit before/after, protect research evidence, and fail closed if deletion cannot be verified. Do not mistake queued GitHub service incidents for code-test failures. See the full policy.
