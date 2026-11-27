# BigR external export contract v1 — Milestone 1

**Status:** Initial, intentionally narrow implementation on `feat/m1-shared-export-contract`. Not yet a general-purpose scene renderer. This contract wraps the existing **P1 `bigr.asset.v1`** package and proven nearest-neighbour library without modifying either one. BigR does not parse ROMs, SCUMM resources, DOS archives or game-native palettes.

## Architecture decision

- **Extractor:** decodes game assets and supplies verified `bigr.asset.v1` payloads; never depends on BigR for native extraction.
- **BigR core (unchanged):** validates raster bytes, SHA-256 payloads, frame metadata, masks and nearest-neighbour scaling.
- **BigR export adapter (new):** a standalone, optional Node CLI consumes a package and emits a file plus machine-readable result. The adapter does not know which extractor produced the package.
- **Windows integration:** an extractor may launch the same BigR installation with `child_process.spawn` or an equivalent process API. No plugin marketplace, shared DLL, service, SDK or extractor modification is required.

## Installation and commands

From the BigR checkout, with Node 22+ and dependencies installed:

```powershell
npm ci
npm run build
node .\bin\bigr-export.mjs capabilities
node .\bin\bigr-export.mjs validate --input "F:\path\to\source-package"
node .\bin\bigr-export.mjs render --input "F:\path\to\source-package" --output "F:\path\to\NEW-export"
node .\bin\bigr-export.mjs render --input "F:\path\to\source-package" --output "F:\path\to\NEW-export-4x" --scale 4
```

The `--scale` factor is **uniform** (X = Y) and defaults to **1** (native pixel dimensions). The P1 legacy command `bin/bigr.mjs --x ... [--y ...]` remains unchanged and retains its independently verified nonuniform scaling behaviour.

## Contract

CLI contract: `bigr.export.cli.v1`  
Input package schema: `bigr.asset.v1` (unchanged, documented in [PACKAGE_V1.md](PACKAGE_V1.md)).

Commands:

| Command | Input | Success | Error |
|---|---|---|---|
| `capabilities` | none | JSON supported commands, raster formats and algorithms | JSON on stderr |
| `validate --input DIR` | existing P1 package | JSON package validity, kind, manifest SHA-256, renderability | JSON on stderr |
| `render --input DIR --output NEW_DIR [--scale N]` | existing P1 **RGBA8 raster** package | `image.png`, `result.json` and identical JSON on stdout | JSON on stderr; no completed export |

The output `result.json` records source asset ID, package schema and canonical source-manifest SHA-256, output format, dimensions, PNG SHA-256, uniform scaling factors, Node/zlib encoder versions, and warnings. No local absolute input or output paths are included in that manifest.

**Do not rely on human-readable CLI text.** Successful standard output contains exactly one JSON object and a newline. Errors contain one JSON object on standard error with `ok: false`, stable `error.code` and a useful message. Extractors should inspect both the exit code and the JSON payload.

Error codes currently used:

| Code | Exit | Meaning |
|---|---:|---|
| `INVALID_ARGUMENTS` | 2 | Invalid, missing or duplicate command options; nested source/destination |
| `UNSUPPORTED_FEATURE` | 3 | Valid input, but requested feature or pixel mode is not implemented |
| `INVALID_PACKAGE` | 4 | Manifest, payload, source path or digest validation failed |
| `DESTINATION_EXISTS` | 5 | Destination already exists; nothing overwritten |
| `INTERNAL_ERROR` | 1 | Unexpected I/O or encoding failure |

## M1 PNG rendering constraints

**Implemented:**

- Native RGBA8 PNG export with all four source channels copied, including exact alpha values.
- Uniform integer nearest-neighbour scaling using the existing BigR core.
- No palette lookup, invented colours, colour interpolation or resized alpha smoothing.
- PNG scanlines use filter type 0 and zlib compression; decoder-visible RGBA values are exact.
- Up to **4,000,000 output pixels** for this first PNG adapter. This bound does not change the core's own limits.
- P1 package validation checks exact declared payload filenames, byte counts, SHA-256 hashes, manifest schema, and non-symlinked source entries.
- Output directory must not exist. Files are staged inside the output parent and published through a final directory rename. No source modification.

**Explicitly unavailable in M1:**

- Indexed8-to-RGBA rendering, even if a candidate or unknown palette is supplied. Palette selection must be source-authoritative and separately designed.
- Compositing a primary evidence/coverage mask into PNG alpha. Mask semantics must not be guessed.
- Animation, per-frame timing, layers, scene composition, sprite sheets, GIF/MP4/WebM, audio, enhancement algorithms and video encoders.
- Reading arbitrary PNGs as input, interpreting game files, and renderer-side SCUMM/MK/NES knowledge.

An RGBA raster with named `evidenceMasks` can be exported: those masks are validated but *not composited*. The result manifest includes a warning. Unlike the current raster-only M1 renderer, `validate` is still able to verify indexed or animation P1 packages, reporting `pngRenderable: false` where appropriate.

## Minimal synthetic extractor demonstration

The following TypeScript code uses the existing BigR **library** to create a valid package in memory; the extractor is responsible for writing its `manifest.json` and its `data/*.bin` payloads to a new directory.

```ts
import { packageAsset, canonicalManifestJson } from "bigr-pixel-core";

const pkg = await packageAsset({
  kind: "raster",
  raster: {
    width: 2, height: 1, format: "rgba8",
    pixels: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 64]),
  },
  provenance: { source: "synthetic-example" },
}, "synthetic-example");
// Write canonicalManifestJson(pkg.manifest) as manifest.json.
// Write pkg.blobs entries at their validated relative data/*.bin paths.
// Then call: node bin/bigr-export.mjs render --input <package> --output <new-dir> --scale 2
```

The resulting PNG must be 4x2: two red pixels followed by two green pixels on each row, with exact alpha 255/64 respectively. The synthetic acceptance test implements that end-to-end, with independent PNG decoding.

## Reproducibility and compatibility

A successful export is visually deterministic for the same source bytes, uniform scale and current renderer. PNG byte hashes should only be compared across the same implementation and compression settings; Node/zlib version differences may alter *compressed* output even when decoded image pixels match. Tests independently inspect the decoded RGBA scanlines, not only the binary digest.

The CLI is an **optional** sidecar. If it is absent, incompatible or missing a desired capability, an extractor must continue offering its own basic native exports. Integration should query `capabilities` rather than guess based on executable name alone.

## Next integration step

Implement a simple opt-in **extractor adapter** that writes one decoded RGBA raster in P1 package form and invokes this CLI. Keep the extractor's existing basic PNG export available as fallback. Verify a private real-source sample without publishing copyrighted data. Indexed palette and mask policies should be established before widening PNG conversion support.

## Validation record

This branch contains synthetic Node CLI tests. **Do not claim they passed until the Windows workflow reports a green run.** The branch is intentionally based on draft P1 rather than main; no upstream branch or game extractor is modified.
