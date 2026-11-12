import { scaleAnimationNearest, scaleRasterNearest } from "./scale.ts";
import type { Animation, IntegerScale, JsonValue, Palette, Position, Raster, Size } from "./types.ts";

/** V1 is an intentionally narrow, versioned interchange format, not a ROM format. */
export const PACKAGE_SCHEMA = "bigr.asset.v1" as const;
export const MAX_PACKAGE_BYTES = 512 * 1024 * 1024;
export const MAX_PACKAGE_FRAMES = 10_000;

export type SourceAsset =
  | { kind: "raster"; raster: Raster; metadata?: JsonValue; provenance?: JsonValue }
  | { kind: "animation"; animation: Animation; metadata?: JsonValue; provenance?: JsonValue };

export interface PayloadRecord { byteLength: number; sha256: string; }
export interface PaletteRecord { channels: 3 | 4; entries: string; confidence: "verified" | "candidate" | "unknown"; id?: string; }
export interface RasterRecord {
  width: number; height: number; format: "indexed8" | "rgba8";
  pixels: string; mask?: string; palette?: PaletteRecord;
}
export interface FrameRecord {
  x: number; y: number; durationMs: number; raster: RasterRecord;
  sourcePlacement?: Position & Size;
  id?: string; metadata?: JsonValue;
}
export interface DerivationRecord {
  method: "nearest-neighbor";
  scaleX: number; scaleY: number;
  sourceManifestSha256: string;
}
export interface AssetManifestV1 {
  schema: typeof PACKAGE_SCHEMA;
  assetId: string;
  kind: "raster" | "animation";
  payloads: Record<string, PayloadRecord>;
  raster?: RasterRecord;
  animation?: { canvas: Size; sourceCanvas?: Size; frames: FrameRecord[]; provenance?: JsonValue };
  metadata?: JsonValue;
  provenance?: JsonValue;
  derivation?: DerivationRecord;
}
export interface AssetPackage {
  manifest: AssetManifestV1;
  /** Each value is a separate binary payload, relative to the manifest directory. */
  blobs: Record<string, Uint8Array>;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(label + " must be an object");
  }
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], label: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) throw new TypeError(label + " has unsupported field: " + key);
  }
}
function nonEmpty(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) throw new TypeError(label + " must be a non-empty string");
  return value;
}
function integer(value: unknown, label: string, positive = true): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || (positive && value <= 0)) {
    throw new RangeError(label + " must be " + (positive ? "a positive" : "a") + " safe integer");
  }
  return value;
}
function positiveSize(value: unknown, label: string): Size {
  const entry = object(value, label);
  keys(entry, ["width", "height"], label);
  return { width: integer(entry.width, label + ".width"), height: integer(entry.height, label + ".height") };
}
function validateAssetId(value: unknown): string {
  const id = nonEmpty(value, "assetId");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) || id.includes("..")) {
    throw new TypeError("assetId must be 1-128 safe ASCII characters without path separators or '..'");
  }
  return id;
}
function safePath(path: unknown): string {
  if (typeof path !== "string" || !/^data\/[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.bin$/.test(path) || path.includes("..")) {
    throw new TypeError("unsafe payload path: " + String(path));
  }
  return path;
}

/** Canonical JSON makes digest evidence independent of object insertion order. */
export function canonicalJson(value: unknown): string {
  const visited = new WeakSet<object>();
  function encode(item: unknown, depth: number): string {
    if (depth > 64) throw new RangeError("JSON nesting exceeds 64 levels");
    if (item === null) return "null";
    if (typeof item === "string" || typeof item === "boolean") return JSON.stringify(item);
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new TypeError("JSON contains non-finite number");
      return JSON.stringify(item);
    }
    if (typeof item !== "object") throw new TypeError("JSON contains a non-JSON value");
    if (visited.has(item)) throw new TypeError("JSON contains circular or shared object references");
    const prototype = Object.getPrototypeOf(item);
    if (!Array.isArray(item) && prototype !== Object.prototype && prototype !== null) {
      throw new TypeError("JSON contains an unsupported object type");
    }
    visited.add(item);
    const result = Array.isArray(item)
      ? "[" + item.map((child) => encode(child, depth + 1)).join(",") + "]"
      : "{" + Object.keys(item).sort().map((key) =>
          JSON.stringify(key) + ":" + encode((item as Record<string, unknown>)[key], depth + 1)
        ).join(",") + "}";
    visited.delete(item);
    return result;
  }
  return encode(value, 0);
}

function copyJson(value: JsonValue): JsonValue {
  return JSON.parse(canonicalJson(value)) as JsonValue;
}

export async function sha256(bytes: Uint8Array): Promise<string> {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("sha256 expects Uint8Array");
  // Copy into a new ArrayBuffer to support sliced views and all BufferSource variants.
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function canonicalManifestJson(manifest: AssetManifestV1): string {
  validateManifest(manifest);
  return canonicalJson(manifest) + "\n";
}

function validateRasterRecord(value: unknown, label: string, paths: Set<string>): RasterRecord {
  const record = object(value, label);
  keys(record, ["width", "height", "format", "pixels", "mask", "palette"], label);
  positiveSize({ width: record.width, height: record.height }, label);
  if (record.format !== "indexed8" && record.format !== "rgba8") {
    throw new TypeError(label + ".format is not indexed8 or rgba8");
  }
  const pixels = safePath(record.pixels);
  if (paths.has(pixels)) throw new TypeError("duplicate binary reference: " + pixels);
  paths.add(pixels);
  if (record.mask !== undefined) {
    const mask = safePath(record.mask);
    if (paths.has(mask)) throw new TypeError("duplicate binary reference: " + mask);
    paths.add(mask);
  }
  if (record.palette !== undefined) {
    if (record.format !== "indexed8") throw new TypeError("RGBA raster cannot have indexed palette");
    const palette = object(record.palette, label + ".palette");
    keys(palette, ["channels", "entries", "confidence", "id"], label + ".palette");
    if (palette.channels !== 3 && palette.channels !== 4) throw new RangeError("palette.channels must be 3 or 4");
    if (!["verified", "candidate", "unknown"].includes(String(palette.confidence))) {
      throw new TypeError("palette.confidence is invalid");
    }
    const entries = safePath(palette.entries);
    if (paths.has(entries)) throw new TypeError("duplicate binary reference: " + entries);
    paths.add(entries);
    if (palette.id !== undefined) nonEmpty(palette.id, "palette.id");
  }
  return value as RasterRecord;
}

function validateDerivation(value: unknown): void {
  const d = object(value, "derivation");
  keys(d, ["method", "scaleX", "scaleY", "sourceManifestSha256"], "derivation");
  if (d.method !== "nearest-neighbor") throw new TypeError("unsupported derivation.method");
  integer(d.scaleX, "derivation.scaleX");
  integer(d.scaleY, "derivation.scaleY");
  if (typeof d.sourceManifestSha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(d.sourceManifestSha256)) {
    throw new TypeError("derivation.sourceManifestSha256 must be SHA-256");
  }
}

export function validateManifest(value: unknown): asserts value is AssetManifestV1 {
  const m = object(value, "manifest");
  keys(m, ["schema", "assetId", "kind", "raster", "animation", "payloads", "metadata", "provenance", "derivation"], "manifest");
  if (m.schema !== PACKAGE_SCHEMA) throw new TypeError("unsupported package schema: " + String(m.schema));
  validateAssetId(m.assetId);
  if (m.kind !== "raster" && m.kind !== "animation") throw new TypeError("manifest.kind is invalid");
  if (m.metadata !== undefined) canonicalJson(m.metadata);
  if (m.provenance !== undefined) canonicalJson(m.provenance);
  if (m.derivation !== undefined) validateDerivation(m.derivation);
  const used = new Set<string>();
  if (m.kind === "raster") {
    if (m.animation !== undefined) throw new TypeError("raster manifest cannot contain animation");
    validateRasterRecord(m.raster, "manifest.raster", used);
  } else {
    if (m.raster !== undefined) throw new TypeError("animation manifest cannot contain raster");
    const a = object(m.animation, "manifest.animation");
    keys(a, ["canvas", "sourceCanvas", "frames", "provenance"], "manifest.animation");
    positiveSize(a.canvas, "animation.canvas");
    if (a.sourceCanvas !== undefined) positiveSize(a.sourceCanvas, "animation.sourceCanvas");
    if (a.provenance !== undefined) canonicalJson(a.provenance);
    if (!Array.isArray(a.frames) || a.frames.length === 0 || a.frames.length > MAX_PACKAGE_FRAMES) {
      throw new RangeError("animation.frames must contain 1-" + MAX_PACKAGE_FRAMES + " frames");
    }
    for (const [index, raw] of a.frames.entries()) {
      const f = object(raw, "frame " + index);
      keys(f, ["raster", "x", "y", "durationMs", "id", "metadata", "sourcePlacement"], "frame " + index);
      if (f.sourcePlacement !== undefined) {
        const sp = object(f.sourcePlacement, "frame.sourcePlacement");
        keys(sp, ["x", "y", "width", "height"], "frame.sourcePlacement");
        integer(sp.x, "frame.sourcePlacement.x", false);
        integer(sp.y, "frame.sourcePlacement.y", false);
        positiveSize({ width: sp.width, height: sp.height }, "frame.sourcePlacement");
      }
      integer(f.x, "frame.x", false);
      integer(f.y, "frame.y", false);
      integer(f.durationMs, "frame.durationMs");
      if (f.id !== undefined) nonEmpty(f.id, "frame.id");
      if (f.metadata !== undefined) canonicalJson(f.metadata);
      validateRasterRecord(f.raster, "frame " + index + ".raster", used);
    }
  }
  const payloads = object(m.payloads, "manifest.payloads");
  const declared = Object.keys(payloads);
  if (declared.length !== used.size || declared.length > MAX_PACKAGE_FRAMES * 3) {
    throw new RangeError("payload keys do not exactly match asset references");
  }
  let total = 0;
  for (const path of declared) {
    safePath(path);
    if (!used.has(path)) throw new TypeError("orphan binary payload: " + path);
    const descriptor = object(payloads[path], "payload " + path);
    keys(descriptor, ["byteLength", "sha256"], "payload " + path);
    const len = integer(descriptor.byteLength, "payload.byteLength", false);
    if (len <= 0) throw new RangeError("payload.byteLength must be positive");
    if (typeof descriptor.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
      throw new TypeError("payload.sha256 must be lowercase SHA-256");
    }
    total += len;
    if (!Number.isSafeInteger(total) || total > MAX_PACKAGE_BYTES) {
      throw new RangeError("package exceeds MAX_PACKAGE_BYTES");
    }
  }
}

/** Strict parser: unknown fields and unknown versions produce errors, never silent field loss. */
export function parseManifest(json: string): AssetManifestV1 {
  if (typeof json !== "string") throw new TypeError("manifest JSON must be a string");
  const value: unknown = JSON.parse(json);
  validateManifest(value);
  return value;
}

function cloneRaster(raster: Raster): Raster {
  return scaleRasterNearest(raster, { x: 1, y: 1 });
}
function cloneSourceAsset(asset: SourceAsset): SourceAsset {
  if (asset === null || typeof asset !== "object") throw new TypeError("asset is required");
  const common = {
    ...(asset.metadata === undefined ? {} : { metadata: copyJson(asset.metadata) }),
    ...(asset.provenance === undefined ? {} : { provenance: copyJson(asset.provenance) }),
  };
  if (asset.kind === "raster") return { kind: "raster", raster: cloneRaster(asset.raster), ...common };
  if (asset.kind === "animation") {
    const copy = scaleAnimationNearest(asset.animation, { x: 1, y: 1 });
    if (copy.frames.length > MAX_PACKAGE_FRAMES) throw new RangeError("too many animation frames");
    return {
      kind: "animation", ...common,
      animation: {
        canvas: copy.canvas,
        ...(asset.animation.sourceCanvas === undefined ? {} : { sourceCanvas: { ...copy.sourceCanvas } }),
        frames: copy.frames.map((f, i) => ({
          raster: f.raster, x: f.x, y: f.y, durationMs: f.durationMs,
          ...(asset.animation.frames[i]!.sourcePlacement === undefined ? {} : {
            sourcePlacement: { ...f.sourcePlacement },
          }),
          ...(f.id === undefined ? {} : { id: f.id }),
          ...(f.metadata === undefined ? {} : { metadata: f.metadata }),
        })),
        ...(copy.provenance === undefined ? {} : { provenance: copy.provenance }),
      },
    };
  }
  throw new TypeError("asset.kind must be raster or animation");
}

/** Construct a deterministic bundle entirely in memory, with per-blob SHA-256 evidence. */
export async function packageAsset(
  source: SourceAsset, assetId: string, derivation?: DerivationRecord
): Promise<AssetPackage> {
  validateAssetId(assetId);
  if (derivation !== undefined) validateDerivation(derivation);
  const asset = cloneSourceAsset(source);
  const payloads: Record<string, PayloadRecord> = Object.create(null);
  const blobs: Record<string, Uint8Array> = Object.create(null);
  let total = 0;
  async function add(path: string, data: Uint8Array): Promise<string> {
    safePath(path);
    const copy = new Uint8Array(data);
    if (copy.length === 0) throw new RangeError("cannot package empty binary payload");
    total += copy.length;
    if (total > MAX_PACKAGE_BYTES) throw new RangeError("package exceeds MAX_PACKAGE_BYTES");
    blobs[path] = copy;
    payloads[path] = { byteLength: copy.length, sha256: await sha256(copy) };
    return path;
  }
  async function rasterRecord(r: Raster, prefix: string): Promise<RasterRecord> {
    return {
      width: r.width, height: r.height, format: r.format,
      pixels: await add("data/" + prefix + "-pixels.bin", r.pixels),
      ...(r.mask === undefined ? {} : { mask: await add("data/" + prefix + "-mask.bin", r.mask) }),
      ...(r.palette === undefined ? {} : {
        palette: {
          channels: r.palette.channels, confidence: r.palette.confidence,
          entries: await add("data/" + prefix + "-palette.bin", r.palette.entries),
          ...(r.palette.id === undefined ? {} : { id: r.palette.id }),
        },
      }),
    };
  }
  const common = {
    schema: PACKAGE_SCHEMA, assetId, kind: asset.kind, payloads,
    ...(asset.metadata === undefined ? {} : { metadata: asset.metadata }),
    ...(asset.provenance === undefined ? {} : { provenance: asset.provenance }),
    ...(derivation === undefined ? {} : { derivation: { ...derivation } }),
  };
  let manifest: AssetManifestV1;
  if (asset.kind === "raster") {
    manifest = { ...common, kind: "raster", raster: await rasterRecord(asset.raster, "raster") };
  } else {
    const frames: FrameRecord[] = [];
    for (let i = 0; i < asset.animation.frames.length; i++) {
      const f = asset.animation.frames[i]!;
      frames.push({
        x: f.x, y: f.y, durationMs: f.durationMs,
        ...(f.sourcePlacement === undefined ? {} : { sourcePlacement: { ...f.sourcePlacement } }),
        raster: await rasterRecord(f.raster, "frame-" + String(i).padStart(6, "0")),
        ...(f.id === undefined ? {} : { id: f.id }),
        ...(f.metadata === undefined ? {} : { metadata: f.metadata }),
      });
    }
    manifest = {
      ...common, kind: "animation",
      animation: {
        canvas: { ...asset.animation.canvas }, frames,
        ...(asset.animation.sourceCanvas === undefined ? {} : { sourceCanvas: { ...asset.animation.sourceCanvas } }),
        ...(asset.animation.provenance === undefined ? {} : { provenance: asset.animation.provenance }),
      },
    };
  }
  validateManifest(manifest);
  return { manifest, blobs };
}

/** Verify *all* declared SHA-256 payloads and byte lengths before constructing an asset. */
export async function unpackAsset(assetPackage: AssetPackage): Promise<SourceAsset> {
  if (assetPackage === null || typeof assetPackage !== "object") throw new TypeError("package is required");
  const { manifest, blobs } = assetPackage;
  validateManifest(manifest);
  object(blobs, "blobs");
  const declared = Object.keys(manifest.payloads);
  const supplied = Object.keys(blobs);
  if (declared.length !== supplied.length || supplied.some((path) => !Object.hasOwn(manifest.payloads, path))) {
    throw new TypeError("binary payload set does not exactly match manifest");
  }
  // Verify in full before interpreting, to avoid partially accepted bundles.
  for (const path of declared) {
    const bytes = blobs[path];
    const record = manifest.payloads[path]!;
    if (!(bytes instanceof Uint8Array) || bytes.length !== record.byteLength) {
      throw new RangeError("binary byte-length mismatch: " + path);
    }
    if (await sha256(bytes) !== record.sha256) throw new Error("SHA-256 mismatch: " + path);
  }
  function rawRaster(record: RasterRecord): Raster {
    const palette: Palette | undefined = record.palette === undefined ? undefined : {
      channels: record.palette.channels, confidence: record.palette.confidence,
      entries: new Uint8Array(blobs[record.palette.entries]!),
      ...(record.palette.id === undefined ? {} : { id: record.palette.id }),
    };
    return cloneRaster({
      width: record.width, height: record.height, format: record.format,
      pixels: new Uint8Array(blobs[record.pixels]!),
      ...(record.mask === undefined ? {} : { mask: new Uint8Array(blobs[record.mask]!) }),
      ...(palette === undefined ? {} : { palette }),
    });
  }
  const common = {
    ...(manifest.metadata === undefined ? {} : { metadata: copyJson(manifest.metadata) }),
    ...(manifest.provenance === undefined ? {} : { provenance: copyJson(manifest.provenance) }),
  };
  if (manifest.kind === "raster") return { kind: "raster", raster: rawRaster(manifest.raster!), ...common };
  const animation = manifest.animation!;
  return {
    kind: "animation", ...common,
    animation: {
      canvas: { ...animation.canvas },
      ...(animation.sourceCanvas === undefined ? {} : { sourceCanvas: { ...animation.sourceCanvas } }),
      frames: animation.frames.map((f) => ({
        x: f.x, y: f.y, durationMs: f.durationMs, raster: rawRaster(f.raster),
        ...(f.sourcePlacement === undefined ? {} : { sourcePlacement: { ...f.sourcePlacement } }),
        ...(f.id === undefined ? {} : { id: f.id }),
        ...(f.metadata === undefined ? {} : { metadata: copyJson(f.metadata) }),
      })),
      ...(animation.provenance === undefined ? {} : { provenance: copyJson(animation.provenance) }),
    },
  };
}

/** Verify source, scale with the proven core, and record the exact source manifest hash. */
export async function scaleAssetPackage(
  input: AssetPackage, scale: IntegerScale, outputId?: string
): Promise<AssetPackage> {
  const decoded = await unpackAsset(input);
  const factorY = scale.y ?? scale.x;
  const scaled: SourceAsset = decoded.kind === "raster"
    ? {
        kind: "raster", raster: scaleRasterNearest(decoded.raster, scale),
        ...(decoded.metadata === undefined ? {} : { metadata: decoded.metadata }),
        ...(decoded.provenance === undefined ? {} : { provenance: decoded.provenance }),
      }
    : {
        kind: "animation", animation: scaleAnimationNearest(decoded.animation, scale),
        ...(decoded.metadata === undefined ? {} : { metadata: decoded.metadata }),
        ...(decoded.provenance === undefined ? {} : { provenance: decoded.provenance }),
      };
  const sourceManifestSha256 = await sha256(new TextEncoder().encode(canonicalManifestJson(input.manifest)));
  return packageAsset(scaled, outputId ?? (input.manifest.assetId + "-nn-" + scale.x + "x" + factorY), {
    method: "nearest-neighbor", scaleX: scale.x, scaleY: factorY, sourceManifestSha256,
  });
}
