import { regionPoint } from './regionLayout';
export type ResortView =
  | 'surf'
  | 'garden'
  | 'birthday'
  | 'sunset'
  | 'dining'
  | 'pingpong'
  | 'pool'
  | 'river'
  | 'karst'
  | 'climb'
  | 'scooter'
  | 'suthep'
  | 'trail'
  | 'temple'
  | 'foresttemple'
  | 'san'
  | 'taste'
  | 'moonpond'
  | 'huizhou'
  | 'lakeside'
  | 'courtyard'
  | 'islands'
  | null;
export const closeupViews = {
  surf: { target: regionPoint('sabah', [17, -0.05, 12]), offset: [3.2, 2.7, 4.6] },
  garden: { target: regionPoint('sabah', [9, 2.7, 8]), offset: [-8.5, 7.5, -9.5] },
  birthday: { target: regionPoint('sabah', [1, 1.98, 10.6]), offset: [-1.5, 1.35, 2.6] },
  sunset: { target: regionPoint('sabah', [-14, 2.6, 12]), offset: [-7.5, 3.9, 9] },
  dining: { target: regionPoint('sabah', [-7, 1.9, 4.2]), offset: [0.2, 1.9, 8.2] },
  pingpong: { target: regionPoint('sabah', [-6.4, 1.2, 7.5]), offset: [2.5, 3.3, 2.5] },
  pool: { target: regionPoint('sabah', [-7.8, 1.2, -4.8]), offset: [-5.7, 10, -11.5] },
  river: { target: regionPoint('yangshuo', [0.2, 1.25, 11.4]), offset: [5.5, 4.2, 7.5] },
  karst: { target: regionPoint('yangshuo', [0, 6, -4]), offset: [1.4, 5.5, 34] },
  climb: { target: regionPoint('yangshuo', [-11, 4, 1]), offset: [5, 3.2, 10] },
  scooter: { target: regionPoint('yangshuo', [9, 1.65, 11]), offset: [4.2, 2, -0.8] },
  suthep: { target: regionPoint('chiangmai', [-7, 20.7, -12.8]), offset: [8, 5.6, 11] },
  trail: { target: regionPoint('chiangmai', [-9, 11.5, -2]), offset: [10, 17, 38] },
  temple: { target: regionPoint('chiangmai', [-2, 3.7, 7]), offset: [7, 6, 15] },
  foresttemple: { target: regionPoint('chiangmai', [-9.56, 11.62, -4.08]), offset: [2.4, 1.55, 4.9] },
  san: { target: regionPoint('chiangmai', [9, 2, 11]), offset: [3.5, 2.1, 8] },
  taste: { target: regionPoint('chiangmai', [5, 1.5, 16]), offset: [3.3, 3, 5] },
  moonpond: { target: regionPoint('hongcun', [0, 1.7, 2]), offset: [2, 18, 28] },
  huizhou: { target: regionPoint('hongcun', [-7, 3.65, -2.65]), offset: [2.1, 1.6, 7.5] },
  lakeside: { target: regionPoint('hongcun', [-15.5, 2.5, 9.5]), offset: [6, 4, 10] },
  courtyard: { target: regionPoint('hongcun', [13.6, 2.7, 13.1]), offset: [5.5, 3.2, 7] },
  islands: { target: [0, 3, -2], offset: [8, 90, 178] },
} satisfies Record<
  NonNullable<ResortView>,
  { target: [number, number, number]; offset: [number, number, number] }
>;
