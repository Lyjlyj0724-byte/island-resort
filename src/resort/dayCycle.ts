import { Color, MathUtils, Vector3 } from 'three';

export type TimeMode = 'auto' | 'day' | 'sunset' | 'night';
export const DAY_CYCLE_SECONDS = 480;
export const TIME_MODE_HOURS = { day: 14, sunset: 18.15, night: 22 } as const;
export const resortClock = { hour: 14 };
const colorKeys = [
  'zenith',
  'horizon',
  'haze',
  'sunColor',
  'hemiSky',
  'hemiGround',
  'waterDeep',
  'waterMid',
  'waterShallow',
] as const;
const numberKeys = [
  'sunIntensity',
  'hemiIntensity',
  'environmentIntensity',
  'exposure',
  'lamps',
  'night',
  'dusk',
  'stars',
  'sunDisc',
  'moonDisc',
] as const;
export type ResortAtmosphere = Record<(typeof colorKeys)[number], Color> &
  Record<(typeof numberKeys)[number], number> & {
    sunDirection: Vector3;
    solarDirection: Vector3;
    hour: number;
  };
type Palette = Record<(typeof colorKeys)[number], string> &
  Record<(typeof numberKeys)[number], number> & { hour: number; direction: [number, number, number] };

// The upstream island's warm afternoon, pink twilight and blue moonlight, adapted to these larger miniatures.
const palettes: Palette[] = [
  {
    hour: 0,
    zenith: '#08152f',
    horizon: '#294267',
    haze: '#263e58',
    sunColor: '#bacff7',
    hemiSky: '#bacce5',
    hemiGround: '#8996a3',
    waterDeep: '#091b31',
    waterMid: '#123747',
    waterShallow: '#2a5362',
    sunIntensity: 0.68,
    hemiIntensity: 1.65,
    environmentIntensity: 0.42,
    exposure: 1.12,
    lamps: 1,
    night: 1,
    dusk: 0,
    stars: 1,
    sunDisc: 0,
    moonDisc: 1,
    direction: [0.35, 0.62, -0.7],
  },
  {
    hour: 4.8,
    zenith: '#101e40',
    horizon: '#464b75',
    haze: '#35415c',
    sunColor: '#adc0ea',
    hemiSky: '#afc1da',
    hemiGround: '#7c899b',
    waterDeep: '#11223b',
    waterMid: '#243c55',
    waterShallow: '#3c6075',
    sunIntensity: 0.6,
    hemiIntensity: 1.48,
    environmentIntensity: 0.39,
    exposure: 1.1,
    lamps: 1,
    night: 0.9,
    dusk: 0.05,
    stars: 0.8,
    sunDisc: 0,
    moonDisc: 0.7,
    direction: [0.45, 0.55, -0.65],
  },
  {
    hour: 6.1,
    zenith: '#586b9d',
    horizon: '#f1b4ae',
    haze: '#b8a8b4',
    sunColor: '#ffd0af',
    hemiSky: '#cbb8c8',
    hemiGround: '#756e75',
    waterDeep: '#264654',
    waterMid: '#52777d',
    waterShallow: '#b2b6a6',
    sunIntensity: 1.1,
    hemiIntensity: 0.86,
    environmentIntensity: 0.34,
    exposure: 1.03,
    lamps: 0.55,
    night: 0.25,
    dusk: 0.75,
    stars: 0.15,
    sunDisc: 0.65,
    moonDisc: 0,
    direction: [0.84, 0.12, -0.53],
  },
  {
    hour: 7.8,
    zenith: '#83b1d4',
    horizon: '#f5d6a4',
    haze: '#c9d5cb',
    sunColor: '#ffdfa7',
    hemiSky: '#dde4e5',
    hemiGround: '#ac9e7f',
    waterDeep: '#143447',
    waterMid: '#2a786d',
    waterShallow: '#73b8aa',
    sunIntensity: 2.25,
    hemiIntensity: 0.92,
    environmentIntensity: 0.58,
    exposure: 1,
    lamps: 0,
    night: 0,
    dusk: 0.2,
    stars: 0,
    sunDisc: 1,
    moonDisc: 0,
    direction: [0.72, 0.37, -0.53],
  },
  {
    hour: 11.5,
    zenith: '#72a9ce',
    horizon: '#cfdee1',
    haze: '#9fc4cc',
    sunColor: '#fff0db',
    hemiSky: '#e2eeff',
    hemiGround: '#77836b',
    waterDeep: '#173d50',
    waterMid: '#348479',
    waterShallow: '#80c3b2',
    sunIntensity: 2.65,
    hemiIntensity: 0.85,
    environmentIntensity: 0.65,
    exposure: 1,
    lamps: 0,
    night: 0,
    dusk: 0,
    stars: 0,
    sunDisc: 0.9,
    moonDisc: 0,
    direction: [0.15, 0.88, 0.45],
  },
  {
    hour: 14,
    zenith: '#76acd0',
    horizon: '#e0e4d5',
    haze: '#9fc4cc',
    sunColor: '#fff0db',
    hemiSky: '#e2eeff',
    hemiGround: '#77836b',
    waterDeep: '#173d50',
    waterMid: '#348479',
    waterShallow: '#80c3b2',
    sunIntensity: 2.65,
    hemiIntensity: 0.85,
    environmentIntensity: 0.65,
    exposure: 1,
    lamps: 0,
    night: 0,
    dusk: 0,
    stars: 0,
    sunDisc: 0.95,
    moonDisc: 0,
    direction: [-0.5, 0.76, 0.4],
  },
  {
    hour: 16.6,
    zenith: '#819ebf',
    horizon: '#f7d09e',
    haze: '#c9bba3',
    sunColor: '#ffd199',
    hemiSky: '#e6d5c3',
    hemiGround: '#9a886d',
    waterDeep: '#1e4256',
    waterMid: '#4b8585',
    waterShallow: '#b5bd9c',
    sunIntensity: 2.3,
    hemiIntensity: 0.88,
    environmentIntensity: 0.56,
    exposure: 1,
    lamps: 0.03,
    night: 0,
    dusk: 0.4,
    stars: 0,
    sunDisc: 1,
    moonDisc: 0,
    direction: [-0.78, 0.31, 0.55],
  },
  {
    hour: 18.15,
    zenith: '#5e70a1',
    horizon: '#f7b38c',
    haze: '#bc9298',
    sunColor: '#ffa974',
    hemiSky: '#d9aeb2',
    hemiGround: '#82747b',
    waterDeep: '#263b58',
    waterMid: '#64788b',
    waterShallow: '#c7a49c',
    sunIntensity: 1.65,
    hemiIntensity: 0.8,
    environmentIntensity: 0.4,
    exposure: 1.02,
    lamps: 0.48,
    night: 0.12,
    dusk: 1,
    stars: 0.08,
    sunDisc: 0.85,
    moonDisc: 0,
    direction: [-0.84, 0.145, 0.52],
  },
  {
    hour: 19.1,
    zenith: '#28385f',
    horizon: '#b1778f',
    haze: '#655e7d',
    sunColor: '#c8b5da',
    hemiSky: '#b9b9d2',
    hemiGround: '#818397',
    waterDeep: '#142b45',
    waterMid: '#354b67',
    waterShallow: '#786c86',
    sunIntensity: 0.65,
    hemiIntensity: 1.3,
    environmentIntensity: 0.38,
    exposure: 1.09,
    lamps: 0.93,
    night: 0.72,
    dusk: 0.6,
    stars: 0.65,
    sunDisc: 0,
    moonDisc: 0.4,
    direction: [-0.43, 0.36, -0.1],
  },
  {
    hour: 20.3,
    zenith: '#08152f',
    horizon: '#294267',
    haze: '#263e58',
    sunColor: '#bacff7',
    hemiSky: '#bacce5',
    hemiGround: '#8996a3',
    waterDeep: '#091b31',
    waterMid: '#123747',
    waterShallow: '#2a5362',
    sunIntensity: 0.68,
    hemiIntensity: 1.65,
    environmentIntensity: 0.42,
    exposure: 1.12,
    lamps: 1,
    night: 1,
    dusk: 0,
    stars: 1,
    sunDisc: 0,
    moonDisc: 1,
    direction: [0.35, 0.62, -0.7],
  },
];
const keyed = palettes.map((p) => {
  const out = {
    hour: p.hour,
    sunDirection: new Vector3(...p.direction).normalize(),
    solarDirection: new Vector3(),
  } as ResortAtmosphere;
  for (const key of colorKeys) out[key] = new Color(p[key]);
  for (const key of numberKeys) out[key] = p[key];
  return out;
});

export function wrapHour(hour: number) {
  return Number.isFinite(hour) ? MathUtils.euclideanModulo(hour, 24) : 14;
}
export function advanceHour(hour: number, seconds: number, enabled: boolean) {
  return wrapHour(hour + (enabled ? (Math.max(0, Math.min(seconds, 0.1)) * 24) / DAY_CYCLE_SECONDS : 0));
}
export function createAtmosphere(): ResortAtmosphere {
  const out = { hour: 14, sunDirection: new Vector3(), solarDirection: new Vector3() } as ResortAtmosphere;
  for (const key of colorKeys) out[key] = new Color();
  for (const key of numberKeys) out[key] = 0;
  return out;
}
/** Pure, cyclic palette sampling; callers can reuse `out` without per-frame allocations. */
export function sampleAtmosphere(hour: number, out: ResortAtmosphere = createAtmosphere()): ResortAtmosphere {
  const h = wrapHour(hour);
  let i = 0;
  while (i < keyed.length - 1 && h >= keyed[i + 1].hour) i++;
  const a = keyed[i],
    b = keyed[(i + 1) % keyed.length],
    end = i === keyed.length - 1 ? 24 : b.hour;
  const f = MathUtils.smoothstep(h, a.hour, end);
  for (const key of colorKeys) out[key].copy(a[key]).lerp(b[key], f);
  for (const key of numberKeys) out[key] = MathUtils.lerp(a[key], b[key], f);
  out.sunDirection.copy(a.sunDirection).lerp(b.sunDirection, f).normalize();
  const angle = ((h - 6) / 24) * Math.PI * 2;
  out.solarDirection.set(Math.cos(angle) * 0.84, Math.sin(angle) * 0.8, -Math.cos(angle) * 0.55).normalize();
  out.hour = h;
  return out;
}
export const resortAtmosphere = sampleAtmosphere(14);
const target = createAtmosphere();
export function stepResortAtmosphere(mode: TimeMode, delta: number, animate: boolean, reducedMotion = false) {
  if (mode === 'auto') resortClock.hour = advanceHour(resortClock.hour, delta, animate && !reducedMotion);
  else resortClock.hour = TIME_MODE_HOURS[mode];
  sampleAtmosphere(resortClock.hour, target);
  const k = 1 - Math.exp(-Math.max(0, Math.min(delta, 0.1)) * (reducedMotion ? 2.5 : 0.85));
  for (const key of colorKeys) resortAtmosphere[key].lerp(target[key], k);
  for (const key of numberKeys) resortAtmosphere[key] = MathUtils.lerp(resortAtmosphere[key], target[key], k);
  resortAtmosphere.sunDirection.lerp(target.sunDirection, k).normalize();
  resortAtmosphere.solarDirection.lerp(target.solarDirection, k).normalize();
  resortAtmosphere.hour = resortClock.hour;
  return resortAtmosphere;
}

/** Shared shader inputs. Reflector clones uniforms, so update copies with syncWaterAtmosphere. */
export function waterAtmosphereUniforms() {
  return {
    night: { value: 0 },
    evening: { value: 0 },
    sunDirection: { value: resortAtmosphere.sunDirection.clone() },
    sunColor: { value: resortAtmosphere.sunColor.clone() },
    sunPower: { value: 1 },
    skyColor: { value: resortAtmosphere.horizon.clone() },
    waterDeep: { value: resortAtmosphere.waterDeep.clone() },
    waterMid: { value: resortAtmosphere.waterMid.clone() },
    waterShallow: { value: resortAtmosphere.waterShallow.clone() },
  };
}
export function syncWaterAtmosphere(uniforms: Record<string, { value: unknown }>) {
  const a = resortAtmosphere;
  uniforms.night.value = a.night;
  uniforms.evening.value = a.dusk;
  uniforms.sunPower.value = a.sunIntensity / 2.65;
  (uniforms.sunDirection.value as Vector3).copy(a.sunDirection);
  (uniforms.sunColor.value as Color).copy(a.sunColor);
  (uniforms.skyColor.value as Color).copy(a.horizon);
  (uniforms.waterDeep.value as Color).copy(a.waterDeep);
  (uniforms.waterMid.value as Color).copy(a.waterMid);
  (uniforms.waterShallow.value as Color).copy(a.waterShallow);
}
