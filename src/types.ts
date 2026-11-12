/** Pixels are not color-converted by the BigR core. */
export type PixelFormat = "indexed8" | "rgba8";

/** Palette confidence belongs to the extractor, never to the scaling engine. */
export type PaletteConfidence = "verified" | "candidate" | "unknown";

export interface Palette {
  /** RGB = 3 or RGBA = 4 bytes per entry. No palette is required for indexed scaling. */
  channels: 3 | 4;
  entries: Uint8Array;
  confidence: PaletteConfidence;
  id?: string;
}

export interface Raster {
  width: number;
  height: number;
  format: PixelFormat;
  /** Row-major, tightly packed: 1 byte/pixel for indexed8, 4 for rgba8. */
  pixels: Uint8Array;
  /** Optional one-byte-per-pixel source mask. Values are copied exactly, not thresholded. */
  mask?: Uint8Array;
  /** Named, uninterpreted byte planes such as "palette-known"; each is width*height bytes. */
  evidenceMasks?: Record<string, Uint8Array>;
  /** Indexed pixels remain indexed; this palette, when supplied, is copied unchanged. */
  palette?: Palette;
}

/** Data supplied by an extractor is passed through; BigR must not invent it. */
export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export interface Position { x: number; y: number; }
export interface Size { width: number; height: number; }

export interface AnimationFrame extends Position {
  raster: Raster;
  /** Optional original-space geometry retained across multiple scaling stages. */
  sourcePlacement?: Position & Size;
  /** Positive duration in whole milliseconds; no deduplication or timing inference. */
  durationMs: number;
  id?: string;
  metadata?: JsonValue;
}

export interface Animation {
  /** All frames share the original, fixed animation canvas. */
  canvas: Size;
  /** Optional original-space canvas from an earlier scaling stage. */
  sourceCanvas?: Size;
  /** Supplied frame order must be preserved, including A/B/A loops. */
  frames: AnimationFrame[];
  provenance?: JsonValue;
}

/** Initial verified baseline: positive integer scaling only, independently per axis. */
export interface IntegerScale { x: number; y?: number; }

/** Output records original coordinates explicitly, including off-canvas positions. */
export interface ScaledAnimationFrame extends AnimationFrame {
  sourcePlacement: Position & Size;
}

export interface ScaledAnimation extends Animation {
  sourceCanvas: Size;
  frames: ScaledAnimationFrame[];
}
