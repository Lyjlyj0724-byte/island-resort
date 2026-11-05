// Shared local coordinates keep water, wet banks, paths and vegetation aligned.
export const RIVER_WATER_Y = 0.77;
export const riverCenter = (z: number) => Math.sin(z * 0.105) * 3.5 - 0.7;
export const riverHalfWidth = (z: number) =>
  3.1 + Math.cos(z * 0.085) * 0.85 + 0.65 * Math.exp(-Math.pow((z + 3) / 7, 2));
export const riverEdge = (z: number, side: number) =>
  riverCenter(z) +
  side * (riverHalfWidth(z) + Math.sin(z * 0.47 + side * 0.9) * 0.14 + Math.sin(z * 1.13 + side * 2) * 0.055);
