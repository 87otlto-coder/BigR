# BigR development and evidence rules

1. **Never hide errors:** no catch-and-ignore missing palettes, skipped frames, bad masks, timeline gaps, byte-count failures or unsupported modes. Display causes and counts.
2. **Never change originals:** source graphics, indices, masks, provenance and uncertainty are immutable reference evidence. Output uses new buffers and separate files.
3. **Pixels before previews:** tests prove exact indexed bytes, alpha channels and mask bytes; a nice-looking preview is not proof.
4. **Geometry before aesthetics:** test original/scaled coordinates, bbox, fixed canvas, negative/offscreen placement, clipping and layer alignment.
5. **Animation is essential:** preserve A/B/A frame repetition, variable timing and palette state. Verify animated backgrounds in real integrations.
6. **No palette guessing:** candidate/unknown confidence remains candidate/unknown. No implicit transparency rule for index zero.
7. **Determinism:** same assets/options must reproduce byte-identical results; record versions and hashes in future manifests.
8. **Separation of concerns:** extraction and scene reconstruction stay external; rendering/export and enhancements are separate layers.
9. **Windows-first CI:** lightweight Windows-only verification on PR/push/manual triggers, no bulky uploads, concurrency cancellation and visible logs.
10. **Safe fixtures:** no copyrighted game ROMs/graphics, private captures, local private paths or generated gigabyte artifacts committed.
11. **Clear success claims:** local unit tests are not Windows CI or third-party fixture acceptance.
12. **Review breaking contracts:** document schema changes, affected adapters, compatibility and licensing. Public repo visibility does not settle source licensing.

Before merge: inspect tests, errors, memory guardrails, output purity, API changes, integration effects, packaging and any third-party data.
