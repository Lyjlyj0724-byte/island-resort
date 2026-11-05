export type Region = 'chiangmai' | 'hongcun' | 'yangshuo' | 'sabah';
export type ScenePoint = [number, number, number];

// One travel route, with equal space for each miniature landscape.
export const regionOrder: Region[] = ['chiangmai', 'hongcun', 'yangshuo', 'sabah'];
export const regionOrigins: Record<Region, ScenePoint> = {
  chiangmai: [-72, 0, 0],
  hongcun: [-24, 0, 0],
  yangshuo: [24, 0, 0],
  sabah: [72, 0, 0],
};
export function regionPoint(region: Region, local: ScenePoint): ScenePoint {
  const origin = regionOrigins[region];
  return [origin[0] + local[0], origin[1] + local[1], origin[2] + local[2]];
}
