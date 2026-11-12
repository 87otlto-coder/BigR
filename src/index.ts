export {
  MAX_OUTPUT_PIXELS, MAX_EVIDENCE_MASKS, MAX_RASTER_OUTPUT_BYTES,
  scaleAnimationNearest, scaleRasterNearest
} from "./scale.ts";
export type {
  Animation, AnimationFrame, IntegerScale, JsonValue, Palette,
  PaletteConfidence, PixelFormat, Position, Raster, ScaledAnimation,
  ScaledAnimationFrame, Size,
} from "./types.ts";

export {
  PACKAGE_SCHEMA, MAX_PACKAGE_BYTES, MAX_PACKAGE_FRAMES,
  canonicalJson, canonicalManifestJson, packageAsset, parseManifest,
  scaleAssetPackage, sha256, unpackAsset, validateManifest,
} from "./package.ts";
export type {
  AssetManifestV1, AssetPackage, DerivationRecord, FrameRecord,
  PaletteRecord, PayloadRecord, RasterRecord, SourceAsset,
} from "./package.ts";
