import type {
  Animation, AnimationFrame, IntegerScale, JsonValue, Palette, Raster,
  ScaledAnimation, ScaledAnimationFrame, Size,
} from "./types.ts";

/** Intentionally bounded: reject large requests rather than silently clamping them. */
export const MAX_OUTPUT_PIXELS = 64_000_000;
export const MAX_EVIDENCE_MASKS = 16;
export const MAX_RASTER_OUTPUT_BYTES = 512 * 1024 * 1024;

function positiveInt(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function safeMultiply(a: number, b: number, name: string): number {
  const result = a * b;
  if (!Number.isSafeInteger(result)) throw new RangeError(`${name} exceeds safe integer range`);
  return result;
}

function scaleFactors(scale: IntegerScale): { sx: number; sy: number } {
  if (scale === null || typeof scale !== "object") {
    throw new TypeError("scale must be an object with integer x and optional y factors");
  }
  positiveInt(scale.x, "scale.x");
  const sy = scale.y ?? scale.x;
  positiveInt(sy, "scale.y");
  return { sx: scale.x, sy };
}

function checkSize(size: Size, label: string): void {
  positiveInt(size.width, `${label}.width`);
  positiveInt(size.height, `${label}.height`);
}

function checkPixels(width: number, height: number, label: string): number {
  const count = safeMultiply(width, height, `${label} pixel count`);
  if (count > MAX_OUTPUT_PIXELS) {
    throw new RangeError(`${label} exceeds MAX_OUTPUT_PIXELS (${MAX_OUTPUT_PIXELS})`);
  }
  return count;
}

function clonePalette(palette: Palette): Palette {
  if (!Number.isInteger(palette.channels) || ![3, 4].includes(palette.channels)) {
    throw new RangeError("palette.channels must be 3 (RGB) or 4 (RGBA)");
  }
  if (!(palette.entries instanceof Uint8Array) ||
      palette.entries.length === 0 ||
      palette.entries.length % palette.channels !== 0 ||
      palette.entries.length / palette.channels > 256) {
    throw new RangeError("palette.entries must contain 1–256 complete RGB/RGBA entries");
  }
  if (!["verified", "candidate", "unknown"].includes(palette.confidence)) {
    throw new TypeError("palette.confidence must be verified, candidate or unknown");
  }
  return {
    channels: palette.channels,
    entries: new Uint8Array(palette.entries),
    confidence: palette.confidence,
    ...(palette.id === undefined ? {} : { id: palette.id }),
  };
}

function validateRaster(raster: Raster): number {
  if (raster === null || typeof raster !== "object") throw new TypeError("raster is required");
  checkSize(raster, "raster");
  const count = checkPixels(raster.width, raster.height, "input raster");
  if (raster.format !== "indexed8" && raster.format !== "rgba8") {
    throw new TypeError("raster.format must be indexed8 or rgba8");
  }
  const channels = raster.format === "rgba8" ? 4 : 1;
  if (!(raster.pixels instanceof Uint8Array) || raster.pixels.length !== count * channels) {
    throw new RangeError(`raster.pixels must contain exactly ${count * channels} bytes`);
  }
  if (raster.mask !== undefined &&
      (!(raster.mask instanceof Uint8Array) || raster.mask.length !== count)) {
    throw new RangeError(`raster.mask must contain exactly ${count} bytes`);
  }
  if (raster.evidenceMasks !== undefined) {
    const planes = raster.evidenceMasks;
    if (planes === null || typeof planes !== "object" || Array.isArray(planes) ||
        (Object.getPrototypeOf(planes) !== Object.prototype && Object.getPrototypeOf(planes) !== null)) {
      throw new TypeError("raster.evidenceMasks must be a plain object");
    }
    const names = Object.keys(planes);
    if (names.length > MAX_EVIDENCE_MASKS) {
      throw new RangeError("raster.evidenceMasks exceeds MAX_EVIDENCE_MASKS");
    }
    for (const name of names) {
      if (!/^[a-z][a-z0-9_-]{0,39}$/.test(name)) {
        throw new TypeError("invalid evidence mask name: " + name);
      }
      const data = planes[name];
      if (!(data instanceof Uint8Array) || data.length !== count) {
        throw new RangeError("raster.evidenceMasks." + name + " must contain exactly " + count + " bytes");
      }
    }
  }
  if (raster.palette !== undefined) {
    if (raster.format !== "indexed8") throw new TypeError("RGBA rasters cannot have an indexed palette");
    clonePalette(raster.palette);
  }
  return channels;
}

/** Pixel-exact, no interpolation, no palette interpretation and no mask normalization. */
export function scaleRasterNearest(raster: Raster, scale: IntegerScale): Raster {
  const { sx, sy } = scaleFactors(scale);
  const channels = validateRaster(raster);
  const width = safeMultiply(raster.width, sx, "scaled raster width");
  const height = safeMultiply(raster.height, sy, "scaled raster height");
  const outCount = checkPixels(width, height, "output raster");
  const bytes = safeMultiply(outCount, channels, "output raster bytes");
  const evidenceNames = Object.keys(raster.evidenceMasks ?? {}).sort();
  const totalBytes = safeMultiply(outCount, channels + (raster.mask === undefined ? 0 : 1) + evidenceNames.length, "output raster allocated bytes");
  if (totalBytes > MAX_RASTER_OUTPUT_BYTES) {
    throw new RangeError("output raster exceeds MAX_RASTER_OUTPUT_BYTES");
  }
  const pixels = new Uint8Array(bytes);
  const mask = raster.mask === undefined ? undefined : new Uint8Array(outCount);
  const evidenceMasks: Record<string, Uint8Array> | undefined = raster.evidenceMasks === undefined
    ? undefined : {} as Record<string, Uint8Array>;
  if (evidenceMasks !== undefined) {
    for (const name of evidenceNames) evidenceMasks[name] = new Uint8Array(outCount);
  }

  for (let dy = 0; dy < height; dy++) {
    const srcY = Math.floor(dy / sy);
    for (let dx = 0; dx < width; dx++) {
      const srcX = Math.floor(dx / sx);
      const srcOffset = (srcY * raster.width + srcX) * channels;
      const dstOffset = (dy * width + dx) * channels;
      for (let c = 0; c < channels; c++) pixels[dstOffset + c] = raster.pixels[srcOffset + c]!;
      if (mask !== undefined) mask[dy * width + dx] = raster.mask![srcY * raster.width + srcX]!;
      if (evidenceMasks !== undefined) {
        for (const name of evidenceNames) {
          evidenceMasks[name]![dy * width + dx] = raster.evidenceMasks![name]![srcY * raster.width + srcX]!;
        }
      }
    }
  }

  return {
    width, height, format: raster.format, pixels,
    ...(mask === undefined ? {} : { mask }),
    ...(evidenceMasks === undefined ? {} : { evidenceMasks }),
    ...(raster.palette === undefined ? {} : { palette: clonePalette(raster.palette) }),
  };
}

function signedInt(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(cloneJson);
  if (value && typeof value === "object") {
    const result: { [key: string]: JsonValue } = {};
    for (const [key, child] of Object.entries(value)) result[key] = cloneJson(child);
    return result;
  }
  return value;
}

function scaleFrame(frame: AnimationFrame, sx: number, sy: number): ScaledAnimationFrame {
  signedInt(frame.x, "frame.x");
  signedInt(frame.y, "frame.y");
  positiveInt(frame.durationMs, "frame.durationMs");
  if (frame.sourcePlacement !== undefined) {
    signedInt(frame.sourcePlacement.x, "frame.sourcePlacement.x");
    signedInt(frame.sourcePlacement.y, "frame.sourcePlacement.y");
    checkSize(frame.sourcePlacement, "frame.sourcePlacement");
  }
  const raster = scaleRasterNearest(frame.raster, { x: sx, y: sy });
  const x = safeMultiply(frame.x, sx, "scaled frame.x");
  const y = safeMultiply(frame.y, sy, "scaled frame.y");
  return {
    x, y, raster, durationMs: frame.durationMs,
    sourcePlacement: frame.sourcePlacement === undefined
      ? { x: frame.x, y: frame.y, width: frame.raster.width, height: frame.raster.height }
      : { ...frame.sourcePlacement },
    ...(frame.id === undefined ? {} : { id: frame.id }),
    ...(frame.metadata === undefined ? {} : { metadata: cloneJson(frame.metadata) }),
  };
}

/** Scale the fixed canvas and each positioned frame. Never crop, clip, dedupe or retime. */
export function scaleAnimationNearest(animation: Animation, scale: IntegerScale): ScaledAnimation {
  const { sx, sy } = scaleFactors(scale);
  if (animation === null || typeof animation !== "object") throw new TypeError("animation is required");
  checkSize(animation.canvas, "animation.canvas");
  if (animation.sourceCanvas !== undefined) checkSize(animation.sourceCanvas, "animation.sourceCanvas");
  const width = safeMultiply(animation.canvas.width, sx, "scaled canvas width");
  const height = safeMultiply(animation.canvas.height, sy, "scaled canvas height");
  checkPixels(width, height, "output canvas");
  if (!Array.isArray(animation.frames) || animation.frames.length === 0) {
    throw new RangeError("animation.frames must contain at least one frame");
  }
  return {
    canvas: { width, height },
    sourceCanvas: animation.sourceCanvas === undefined
      ? { width: animation.canvas.width, height: animation.canvas.height }
      : { ...animation.sourceCanvas },
    frames: animation.frames.map((frame) => scaleFrame(frame, sx, sy)),
    ...(animation.provenance === undefined ? {} : { provenance: cloneJson(animation.provenance) }),
  };
}
