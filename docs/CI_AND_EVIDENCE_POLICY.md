# BigR — Windows CI, artifact and evidence policy

**Inherited baseline:** 2026-11-11 incident and Windows-only policy adopted by ScummBucket, SpriteMine and MK DOS Archive. Source reference: https://github.com/87otlto-coder/mk-dos-archive/blob/main/docs/ACTIONS_INCIDENT_2026-11-11.md

## Incident that must not repeat

MK DOS Archive retained 316 GitHub Actions artifacts (~4,722 MiB), dominated by 226 routine disposable browser builds (~4,720 MiB). The shared corrective policy established Windows-only hosted CI, opt-in uploads, short expiry, exact-type retention and preservation of unique research evidence. Service-side queued jobs are not equivalent to code failures. BigR starts with **no Actions workflow or artifact upload**, deliberately.

## Rules for all agents

1. **Windows-only:** All new or modified hosted jobs use `runs-on: windows-latest` (or approved pinned Windows runner), not Ubuntu, Linux containers, macOS or an OS matrix without explicit owner approval. Prefer `pwsh`; verify actual hosted Windows behavior.
2. **Necessary checks only:** Add CI only when it provides meaningful automated verification. Use synthetic/redistributable fixtures. Avoid duplicate push/PR triggers, redundant versions, emulator/game requirements or artifact-producing defaults.
3. **Zero-cost posture:** Retain the owner's $0 spending budget. Do not change budgets or resource settings. Keep permissions least-privileged. Do not create release attachments or upload archives as routine side effects.
4. **Private evidence boundary:** Never expose source ROMs, game archives, extracted copyrighted graphics, private captures, save states, tokens, input buffers or derived fixtures in commits, logs, caches, artifacts or release downloads. Public test data must be synthetic or explicitly redistributable.
5. **Preserve irreplaceable records:** Source revisions, tool versions, hashes, offsets, palette/capture/timing observations, scripts and verifiers must remain reproducible. Before expiring a sole copy, identify owner, recoverability and durable copies, verify checksum and obtain approval.
6. **Authorized disposable uploads only:** If later required, uploads must be opt-in or justified, scoped to intended files, set `retention-days: 3` where supported, and be associated with a successful run. Keep the newest **three successful disposable builds of each exact artifact type** across branches. Do not equate different hashes with irreplaceable evidence.
7. **Safe cleanup:** Upload and verify the new build first; only then serialize deletion of exact, known older disposable IDs. Inventory names, IDs, sizes, digests and producing runs before deletion. Verify a fresh after-state, use bounded read-only reconciliation retries for eventual consistency, and fail closed if uncertain. Never delete the only working build after a failed replacement. Never delete protected research evidence automatically.
8. **Truthful incident handling:** Distinguish failed tests, unsupported commands, authentication/billing issues, GitHub service incidents, queued builds and artifacts problems. Check status and logs; don't spam reruns or conceal failures. Report concrete results.

**This document does not authorize adding CI workflows or uploading artifacts.** An approved, minimal test workflow can be introduced during implementation, after contract/test plans are agreed.
