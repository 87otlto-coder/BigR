import assert from "node:assert/strict";
import test from "node:test";
import { MAX_OUTPUT_PIXELS, scaleAnimationNearest, scaleRasterNearest } from "../src/index.ts";
import type { Animation, Raster } from "../src/index.ts";

const indexed = (pixels: number[], width: number, height: number): Raster => ({
  format: "indexed8", width, height, pixels: Uint8Array.from(pixels),
});

test("indexed pixels, palette uncertainty and mask bytes are enlarged exactly", () => {
  const input: Raster = {
    ...indexed([0, 37, 255, 2], 2, 2),
    mask: Uint8Array.from([0, 17, 128, 255]),
    palette: { channels: 3, entries: Uint8Array.from([3, 2, 1, 4, 5, 6]), confidence: "unknown", id: "candidate-03" },
  };
  const output = scaleRasterNearest(input, { x: 2, y: 3 });
  assert.deepEqual([output.width, output.height], [4, 6]);
  assert.deepEqual([...output.pixels], [
    0, 0, 37, 37, 0, 0, 37, 37, 0, 0, 37, 37,
    255, 255, 2, 2, 255, 255, 2, 2, 255, 255, 2, 2,
  ]);
  assert.deepEqual([...output.mask!], [
    0, 0, 17, 17, 0, 0, 17, 17, 0, 0, 17, 17,
    128, 128, 255, 255, 128, 128, 255, 255, 128, 128, 255, 255,
  ]);
  assert.deepEqual(output.palette, input.palette);
  assert.notStrictEqual(output.palette?.entries, input.palette?.entries);
  assert.notStrictEqual(output.pixels, input.pixels);
  assert.notStrictEqual(output.mask, input.mask);
  output.pixels[0] = 99;
  output.mask![0] = 99;
  output.palette!.entries[0] = 99;
  assert.equal(input.pixels[0], 0);
  assert.equal(input.mask![0], 0);
  assert.equal(input.palette!.entries[0], 3);
});

test("RGBA alpha and all color channels are duplicated, never blended", () => {
  const input: Raster = {
    format: "rgba8", width: 2, height: 1,
    pixels: Uint8Array.from([255, 12, 10, 0, 2, 45, 11, 127]),
  };
  const output = scaleRasterNearest(input, { x: 3 });
  const row = [255, 12, 10, 0, 255, 12, 10, 0, 255, 12, 10, 0,
               2, 45, 11, 127, 2, 45, 11, 127, 2, 45, 11, 127];
  assert.deepEqual([output.width, output.height], [6, 3]);
  for (let y = 0; y < 3; y++) assert.deepEqual([...output.pixels].slice(y * 24, (y + 1) * 24), row);
});

test("320x200 canvas to 1600x1200 uses 5x6 independent integer factors", () => {
  const animation: Animation = {
    canvas: { width: 320, height: 200 },
    frames: [{ x: 1, y: -2, durationMs: 100, raster: indexed([8], 1, 1) }],
  };
  const output = scaleAnimationNearest(animation, { x: 5, y: 6 });
  assert.deepEqual(output.canvas, { width: 1600, height: 1200 });
  assert.deepEqual(output.sourceCanvas, animation.canvas);
  assert.deepEqual([output.frames[0]?.x, output.frames[0]?.y], [5, -12]);
  assert.deepEqual(output.frames[0]?.sourcePlacement, { x: 1, y: -2, width: 1, height: 1 });
});

test("A/B/A order, repeated content, durations, clipping and provenance are preserved", () => {
  const frameA = indexed([4], 1, 1);
  const frameB = indexed([9], 1, 1);
  const animation: Animation = {
    canvas: { width: 2, height: 2 },
    provenance: { game: "test fixture", confidence: "verified" },
    frames: [
      { raster: frameA, id: "A1", x: -1, y: 0, durationMs: 50, metadata: { layer: "foreground" } },
      { raster: frameB, id: "B", x: 2, y: 1, durationMs: 80 },
      { raster: frameA, id: "A2", x: -1, y: 0, durationMs: 120 },
    ],
  };
  const result = scaleAnimationNearest(animation, { x: 2 });
  assert.equal(result.frames.length, 3);
  assert.deepEqual(result.frames.map(f => f.id), ["A1", "B", "A2"]);
  assert.deepEqual(result.frames.map(f => f.durationMs), [50, 80, 120]);
  assert.deepEqual(result.frames.map(f => [f.x, f.y]), [[-2, 0], [4, 2], [-2, 0]]);
  assert.deepEqual(result.frames.map(f => [...f.raster.pixels]), [[4, 4, 4, 4], [9, 9, 9, 9], [4, 4, 4, 4]]);
  assert.deepEqual(result.provenance, animation.provenance);
  assert.notStrictEqual(result.provenance, animation.provenance);
  assert.notStrictEqual(result.frames[0]?.metadata, animation.frames[0]?.metadata);
  assert.deepEqual(result.frames[0]?.sourcePlacement, { x: -1, y: 0, width: 1, height: 1 });
});

test("invalid dimensions, malformed data, oversized buffers and scales fail visibly", () => {
  const good = indexed([2], 1, 1);
  assert.throws(() => scaleRasterNearest(good, { x: 1.5 }), /positive safe integer/);
  assert.throws(() => scaleRasterNearest(good, { x: 0 }), /positive safe integer/);
  assert.throws(() => scaleRasterNearest({ ...good, pixels: new Uint8Array() }, { x: 2 }), /exactly 1 bytes/);
  assert.throws(() => scaleRasterNearest({ ...good, mask: new Uint8Array(2) }, { x: 2 }), /exactly 1 bytes/);
  assert.throws(() => scaleRasterNearest({ ...good, palette: { channels: 3, entries: new Uint8Array(4), confidence: "candidate" } }, { x: 2 }), /complete RGB/);
  assert.throws(() => scaleRasterNearest({ ...good, width: 0 }, { x: 2 }), /positive safe integer/);
  assert.throws(() => scaleRasterNearest({ ...good, format: "rgba8" }, { x: 2 }), /exactly 4 bytes/);
  assert.throws(() => scaleRasterNearest({ ...good, width: 2 ** 53 }, { x: 2 }), /positive safe integer/);
  assert.throws(() => scaleRasterNearest({ ...good, width: MAX_OUTPUT_PIXELS + 1 }, { x: 1 }), /MAX_OUTPUT_PIXELS/);
  assert.throws(() => scaleAnimationNearest({ canvas: { width: 1, height: 1 }, frames: [] }, { x: 2 }), /at least one frame/);
  assert.throws(() => scaleAnimationNearest({ canvas: { width: 1, height: 1 }, frames: [{ raster: good, x: 0.1, y: 0, durationMs: 10 }] }, { x: 2 }), /safe integer/);
});

test("processing same input twice yields byte-identical pixel arrays", () => {
  const source = indexed([7, 0, 19, 3, 6, 42], 3, 2);
  const first = scaleRasterNearest(source, { x: 5, y: 6 });
  const second = scaleRasterNearest(source, { x: 5, y: 6 });
  assert.deepEqual([...first.pixels], [...second.pixels]);
  assert.deepEqual([first.width, first.height], [second.width, second.height]);
});
