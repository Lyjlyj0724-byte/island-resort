// The two broad wave phases match Water.tsx's seaNormal in world coordinates.
// The rendered water is a flat plane: small heave keeps the hull in contact
// while its tilt follows the visible, animated water-normal field.
export const SEA_LEVEL = -0.2;
export const SURF_YAW = -0.4;
export function sampleSurfMotion(time: number, worldX: number, worldZ: number) {
  const a = worldX * 0.74 + worldZ * 0.28 - time * 0.72;
  const b = worldX * -0.35 + worldZ * 1.31 + time * 0.51;
  const slopeX = 0.74 * Math.cos(a) * 0.064 - 0.35 * Math.cos(b) * 0.029;
  const slopeZ = 0.28 * Math.cos(a) * 0.064 + 1.31 * Math.cos(b) * 0.029;
  const yaw = SURF_YAW + Math.sin(a * 0.35 + b * 0.2) * 0.018;
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  return {
    y: SEA_LEVEL + 0.015 + Math.sin(a) * 0.018 + Math.sin(b) * 0.008,
    pitch: -Math.atan(slopeX * s + slopeZ * c) * 0.78,
    roll: Math.atan(slopeX * c - slopeZ * s) * 0.8,
    yaw,
    x: Math.sin(b) * 0.025,
    z: Math.sin(a) * 0.035,
  };
}
