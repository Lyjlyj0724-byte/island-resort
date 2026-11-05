import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { resortAtmosphere } from './dayCycle';

type V = [number, number, number];
type MatKey =
  | 'plaster'
  | 'stone'
  | 'paving'
  | 'roof'
  | 'wood'
  | 'dark'
  | 'red'
  | 'warm'
  | 'leaf'
  | 'bark'
  | 'flower'
  | 'windowAmber'
  | 'windowHoney'
  | 'lamp'
  | 'strip'
  | 'wallGlow'
  | 'groundGlow';
export type HongcunMaterials = Record<MatKey, T.MeshStandardMaterial>;
const rand = (n: number) => T.MathUtils.euclideanModulo(Math.sin(n * 17.31 + 1.53) * 41378.27, 1);

function surface(kind: 'plaster' | 'stone' | 'paving' | 'roof' | 'wood') {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = { plaster: '#eeeee4', stone: '#96978c', paving: '#9e9f91', roof: '#616b65', wood: '#5d5143' }[
    kind
  ];
  x.fillRect(0, 0, 512, 512);
  if (kind === 'plaster') {
    for (let i = 0; i < 460; i++) {
      const px = rand(i) * 512,
        py = rand(i + 800) * 512,
        r = 8 + rand(i + 190) * 35;
      const g = x.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, `rgba(68,77,64,${0.02 + rand(i + 500) * 0.07})`);
      g.addColorStop(1, 'rgba(68,77,64,0)');
      x.fillStyle = g;
      x.fillRect(px - r, py - r, r * 2, r * 2);
    }
    for (let i = 0; i < 25; i++) {
      x.fillStyle = 'rgba(58,70,57,.07)';
      x.fillRect(rand(i + 4000) * 512, 0, 2 + rand(i) * 3, 75 + rand(i + 6000) * 190);
    }
    const damp = x.createLinearGradient(0, 350, 0, 512);
    damp.addColorStop(0, 'rgba(74,83,66,0)');
    damp.addColorStop(0.7, 'rgba(74,83,66,.035)');
    damp.addColorStop(1, 'rgba(74,83,66,.17)');
    x.fillStyle = damp;
    x.fillRect(0, 350, 512, 162);
    for (let i = 0; i < 17; i++) {
      const px = rand(i + 8800) * 512,
        py = rand(i + 9000) * 470;
      x.strokeStyle = 'rgba(69,75,65,.09)';
      x.lineWidth = 0.7;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px - 4, py + 11);
      x.lineTo(px + 1, py + 24);
      x.lineTo(px - 6, py + 39);
      x.stroke();
    }
  } else if (kind === 'stone') {
    for (let row = 0; row < 16; row++)
      for (let col = -1; col < 9; col++) {
        const px = col * 64 + (row % 2) * 32,
          py = row * 32,
          v = rand(row * 30 + col);
        x.fillStyle = `rgb(${110 + v * 36},${114 + v * 33},${107 + v * 29})`;
        x.fillRect(px + 1, py + 1, 61, 29);
        x.fillStyle = 'rgba(220,223,207,.14)';
        x.fillRect(px + 2, py + 2, 59, 2);
      }
    const wet = x.createLinearGradient(0, 256, 0, 512);
    wet.addColorStop(0, 'rgba(31,48,37,0)');
    wet.addColorStop(1, 'rgba(31,48,37,.20)');
    x.fillStyle = wet;
    x.fillRect(0, 256, 512, 256);
  } else if (kind === 'paving') {
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 5; col++) {
        const px = col * 128 + (row % 2) * 64,
          py = row * 64,
          v = rand(row * 17 + col);
        x.fillStyle = `rgb(${163 + v * 23},${163 + v * 24},${146 + v * 24})`;
        x.fillRect(px + 2, py + 2, 124, 60);
        x.fillStyle = 'rgba(232,231,209,.22)';
        x.fillRect(px + 3, py + 3, 121, 2);
      }
  } else if (kind === 'roof') {
    for (let row = 0; row < 16; row++)
      for (let col = 0; col < 32; col++) {
        const px = col * 16,
          py = row * 32,
          v = rand(row * 32 + col);
        const g = x.createLinearGradient(px, 0, px + 16, 0);
        g.addColorStop(0, '#404a47');
        g.addColorStop(0.37, v > 0.6 ? '#8a9186' : '#737f75');
        g.addColorStop(1, '#53625b');
        x.fillStyle = g;
        x.fillRect(px, py, 15, 31);
        x.fillStyle = '#9ba292';
        x.fillRect(px + 3, py + 29, 9, 1);
      }
  } else {
    for (let i = 0; i < 180; i++) {
      x.strokeStyle = 'rgba(27,24,21,.18)';
      const px = rand(i) * 512;
      x.beginPath();
      x.moveTo(px, 0);
      x.bezierCurveTo(px + 5, 120, px - 8, 300, px + 2, 512);
      x.stroke();
    }
  }
  for (let i = 0; i < 13000; i++) {
    x.fillStyle = i % 2 ? 'rgba(255,251,231,.07)' : 'rgba(15,25,20,.08)';
    x.fillRect(rand(i + 99) * 512, rand(i + 28000) * 512, 1 + rand(i + 9) * 2, 1 + rand(i + 5) * 2);
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Baked falloffs make many little pools of warm light without one GPU light per
// window. The geometry sits on the actual façades and paving, so it reflects in
// Moon Pond along with the buildings rather than following the camera.
function glowTexture(wall: boolean) {
  const size = 64,
    data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = (x / (size - 1)) * 2 - 1,
        v = y / (size - 1),
        i = (y * size + x) * 4;
      const side = Math.pow(Math.max(0, 1 - u * u), 2.2);
      const falloff = wall
        ? Math.pow(v, 1.25) * Math.sin(Math.PI * v) * 1.3
        : Math.pow(Math.max(0, 1 - (v * 2 - 1) ** 2), 2);
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(T.MathUtils.clamp(side * falloff, 0, 1) * 255);
    }
  const map = new T.DataTexture(data, size, size);
  map.colorSpace = T.SRGBColorSpace;
  map.needsUpdate = true;
  return map;
}

export function useHongcunMaterials(_night: boolean) {
  const result = useMemo(() => {
    const maps = {
      plaster: surface('plaster'),
      stone: surface('stone'),
      paving: surface('paving'),
      roof: surface('roof'),
      wood: surface('wood'),
      wallGlow: glowTexture(true),
      groundGlow: glowTexture(false),
    };
    const m: HongcunMaterials = {
      plaster: new T.MeshStandardMaterial({
        map: maps.plaster,
        bumpMap: maps.plaster,
        bumpScale: 0.027,
        roughness: 0.96,
        color: '#fffef3',
      }),
      stone: new T.MeshStandardMaterial({
        map: maps.stone,
        bumpMap: maps.stone,
        bumpScale: 0.035,
        roughness: 1,
        color: '#b1b7a6',
      }),
      paving: new T.MeshStandardMaterial({
        map: maps.paving,
        bumpMap: maps.paving,
        bumpScale: 0.025,
        roughness: 1,
        color: '#e5e0cf',
      }),
      roof: new T.MeshStandardMaterial({
        map: maps.roof,
        bumpMap: maps.roof,
        bumpScale: 0.035,
        roughness: 0.88,
        color: '#b3bbaa',
        side: T.DoubleSide,
      }),
      wood: new T.MeshStandardMaterial({
        map: maps.wood,
        bumpMap: maps.wood,
        bumpScale: 0.018,
        roughness: 0.78,
        color: '#ab8c67',
      }),
      dark: new T.MeshStandardMaterial({ color: '#29342e', roughness: 0.88 }),
      red: new T.MeshStandardMaterial({ color: '#a6372b', roughness: 0.8 }),
      warm: new T.MeshStandardMaterial({ color: '#d7b379', roughness: 0.83 }),
      windowAmber: new T.MeshStandardMaterial({
        color: '#57432c',
        emissive: '#ffc06d',
        emissiveIntensity: 0,
        roughness: 0.77,
      }),
      windowHoney: new T.MeshStandardMaterial({
        color: '#514a37',
        emissive: '#ffe1a7',
        emissiveIntensity: 0,
        roughness: 0.8,
      }),
      lamp: new T.MeshStandardMaterial({
        color: '#af432b',
        emissive: '#ff7d32',
        emissiveIntensity: 0,
        roughness: 0.8,
      }),
      strip: new T.MeshStandardMaterial({
        color: '#d5c5a3',
        emissive: '#ffcd88',
        emissiveIntensity: 0,
        roughness: 0.7,
      }),
      wallGlow: new T.MeshStandardMaterial({
        color: '#000000',
        emissive: '#ffc178',
        emissiveIntensity: 1,
        map: maps.wallGlow,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
      groundGlow: new T.MeshStandardMaterial({
        color: '#000000',
        emissive: '#ffd08a',
        emissiveIntensity: 1,
        map: maps.groundGlow,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
      leaf: new T.MeshStandardMaterial({ color: '#e1e6ce', roughness: 0.98 }),
      bark: new T.MeshStandardMaterial({ map: maps.wood, color: '#86765b', roughness: 1 }),
      flower: new T.MeshStandardMaterial({ color: '#f0d4d8', roughness: 0.83, side: T.DoubleSide }),
    };
    return { m, maps };
  }, []);
  useFrame(() => {
    const l = resortAtmosphere.lamps;
    result.m.windowAmber.emissiveIntensity = l * 2.35;
    result.m.windowHoney.emissiveIntensity = l * 1.25;
    result.m.lamp.emissiveIntensity = l * 1.6;
    result.m.strip.emissiveIntensity = l * 3;
    result.m.wallGlow.opacity = l * 0.24;
    result.m.groundGlow.opacity = l * 0.27;
  });
  useEffect(
    () => () => {
      Object.values(result.m).forEach((m) => m.dispose());
      Object.values(result.maps).forEach((t) => t.dispose());
    },
    [result],
  );
  return result.m;
}

type Collector = Record<MatKey, T.BufferGeometry[]>;
function collector(): Collector {
  return {
    plaster: [],
    stone: [],
    paving: [],
    roof: [],
    wood: [],
    dark: [],
    red: [],
    warm: [],
    leaf: [],
    bark: [],
    flower: [],
    windowAmber: [],
    windowHoney: [],
    lamp: [],
    strip: [],
    wallGlow: [],
    groundGlow: [],
  };
}
function add(
  out: Collector,
  key: MatKey,
  g: T.BufferGeometry,
  p: V = [0, 0, 0],
  r: V = [0, 0, 0],
  parent?: T.Matrix4,
) {
  const matrix = new T.Matrix4().compose(
    new T.Vector3(...p),
    new T.Quaternion().setFromEuler(new T.Euler(...r)),
    new T.Vector3(1, 1, 1),
  );
  if (parent) matrix.premultiply(parent);
  g.applyMatrix4(matrix);
  if (g.index) {
    const flat = g.toNonIndexed();
    g.dispose();
    g = flat;
  }
  out[key].push(g);
}
function box(out: Collector, key: MatKey, p: V, s: V, r: V = [0, 0, 0], parent?: T.Matrix4) {
  add(out, key, new T.BoxGeometry(...s), p, r, parent);
}
function beam(out: Collector, key: MatKey, a: V, b: V, radius: number, parent?: T.Matrix4) {
  const av = new T.Vector3(...a),
    bv = new T.Vector3(...b),
    d = bv.clone().sub(av);
  const g = new T.CylinderGeometry(radius * 0.76, radius, d.length(), 7);
  g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()));
  add(out, key, g, av.add(bv).multiplyScalar(0.5).toArray() as V, [0, 0, 0], parent);
}
function finish(out: Collector) {
  return Object.entries(out).flatMap(([key, geometries]) => {
    if (!geometries.length) return [];
    const geo = mergeGeometries(geometries, false)!;
    geometries.forEach((g) => g.dispose());
    geo.computeBoundingSphere();
    return [{ key: key as MatKey, geo }];
  });
}
function Compiled({ build, m }: { build: () => Collector; m: HongcunMaterials }) {
  const groups = useMemo(() => finish(build()), [build]);
  useEffect(() => () => groups.forEach((g) => g.geo.dispose()), [groups]);
  return (
    <>
      {groups.map((g) => (
        <mesh
          key={g.key}
          geometry={g.geo}
          material={m[g.key]}
          castShadow={!g.key.endsWith('Glow')}
          receiveShadow={!g.key.endsWith('Glow')}
          raycast={g.key.endsWith('Glow') ? () => {} : undefined}
        />
      ))}
    </>
  );
}

function roofGeometry(w: number, d: number, h: number) {
  const p = [
    -w / 2,
    h,
    d / 2,
    w / 2,
    h,
    d / 2,
    w / 2,
    h + 1.18,
    0,
    -w / 2,
    h + 1.18,
    0,
    -w / 2,
    h + 1.18,
    0,
    w / 2,
    h + 1.18,
    0,
    w / 2,
    h,
    -d / 2,
    -w / 2,
    h,
    -d / 2,
  ];
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute(
    'uv',
    new T.Float32BufferAttribute(
      [0, 0, w / 3.4, 0, w / 3.4, 0.7, 0, 0.7, 0, 0.7, w / 3.4, 0.7, w / 3.4, 0, 0, 0],
      2,
    ),
  );
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  g.computeVertexNormals();
  return g;
}
function gableGeometry(d: number, h: number) {
  const s = new T.Shape();
  s.moveTo(-d / 2, 0);
  s.lineTo(d / 2, 0);
  s.lineTo(d / 2, h + 0.28);
  s.lineTo(d * 0.29, h + 0.28);
  s.lineTo(d * 0.29, h + 0.77);
  s.lineTo(d * 0.1, h + 0.77);
  s.lineTo(d * 0.1, h + 1.4);
  s.lineTo(-d * 0.1, h + 1.4);
  s.lineTo(-d * 0.1, h + 0.77);
  s.lineTo(-d * 0.29, h + 0.77);
  s.lineTo(-d * 0.29, h + 0.28);
  s.lineTo(-d / 2, h + 0.28);
  s.closePath();
  const g = new T.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  g.translate(-0.09, 0, 0);
  return g;
}

// A half-round shell rather than a solid rod: the open tile mouths remain legible
// beneath the eaves, while long channels and transverse laps describe layered clay.
function barrelGeometry(radius: number, length: number, segments = 6) {
  const positions: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let row = 0; row < 2; row++)
    for (let i = 0; i <= segments; i++) {
      const a = (i / segments) * Math.PI;
      positions.push(Math.cos(a) * radius, Math.sin(a) * radius, (row - 0.5) * length);
      uv.push(i / segments, row * length * 0.8);
      if (row === 0 && i < segments) {
        const j = i + segments + 1;
        indices.push(i, i + 1, j, i + 1, j + 1, j);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function tileLipGeometry(radius: number, count = 4) {
  const p: number[] = [],
    uv: number[] = [],
    index: number[] = [];
  for (let row = 0; row < 2; row++)
    for (let i = 0; i <= count; i++) {
      const a = (i / count) * Math.PI,
        r = radius - row * 0.014;
      p.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      uv.push(i / count, row);
      if (row === 0 && i < count) {
        const j = i + count + 1;
        index.push(i, j, i + 1, i + 1, j, j + 1);
      }
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
function roofDetails(out: Collector, w: number, d: number, h: number, parent: T.Matrix4, feature: boolean) {
  const reach = (d + 0.5) / 2,
    rise = 1.18,
    slope = Math.atan2(rise, reach),
    run = Math.hypot(reach, rise),
    columns = Math.max(10, Math.round((w + 0.3) / (feature ? 0.18 : 0.26)));
  for (const face of [-1, 1]) {
    for (let i = 0; i <= columns; i++) {
      const x = (i / columns - 0.5) * (w + 0.3);
      // Model only the projecting tile ends; the broad slopes retain their bump texture.
      add(
        out,
        'roof',
        barrelGeometry(feature ? 0.044 : 0.055, 0.45, feature ? 6 : 4),
        [x, h + 0.037 + (0.2 * rise) / reach, face * (reach - 0.2)],
        [face * slope, 0, 0],
        parent,
      );
      // The semicircular tile face closes the lip without filling the dark underside.
      add(
        out,
        'roof',
        tileLipGeometry(feature ? 0.047 : 0.058, feature ? 6 : 4),
        [x, h + 0.035, face * (reach + 0.025)],
        [face * slope, 0, 0],
        parent,
      );
    }
    const rows = Math.max(6, Math.round(run / 0.3));
    for (let row = 1; row <= rows; row++) {
      const t = row / rows;
      box(
        out,
        'roof',
        [0, h + rise * (1 - t) + 0.037, face * reach * t],
        [w + 0.32, 0.027, 0.043],
        [face * slope, 0, 0],
        parent,
      );
    }
    for (let i = 0; i < Math.max(6, Math.round(w / 0.34)); i++) {
      const count = Math.max(6, Math.round(w / 0.34)),
        x = (i / (count - 1) - 0.5) * (w - 0.2);
      box(
        out,
        'wood',
        [x, h - 0.075, face * (d / 2 + 0.09)],
        [0.075, 0.11, 0.38],
        [face * slope, 0, 0],
        parent,
      );
    }
  }
  add(out, 'roof', barrelGeometry(0.14, w + 0.44, 10), [0, h + 1.22, 0], [0, Math.PI / 2, 0], parent);
  for (const side of [-1, 1]) {
    const points = [
      [side * (w / 2 - 0.14), h + 1.25, 0],
      [side * (w / 2 + 0.12), h + 1.29, 0],
      [side * (w / 2 + 0.25), h + 1.4, 0],
    ];
    const curve = new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...(p as V))));
    add(out, 'roof', new T.TubeGeometry(curve, 8, 0.047, 5, false), [0, 0, 0], [0, 0, 0], parent);
  }
}
function wallCap(out: Collector, x: number, a: number, b: number, y: number, parent: T.Matrix4) {
  // Fine projecting courses carry a shallow pitched tile cap; only the tips curl up.
  box(out, 'stone', [x, y - 0.005, (a + b) / 2], [0.245, 0.055, b - a + 0.09], [0, 0, 0], parent);
  box(out, 'roof', [x, y + 0.045, (a + b) / 2], [0.34, 0.045, b - a + 0.16], [0, 0, 0], parent);
  add(out, 'roof', barrelGeometry(0.14, b - a + 0.18, 8), [x, y + 0.065, (a + b) / 2], [0, 0, 0], parent);
  if (Math.abs(a) > 0.8) {
    const curve = new T.CatmullRomCurve3([
      new T.Vector3(x, y + 0.1, a + 0.1),
      new T.Vector3(x, y + 0.12, a - 0.055),
      new T.Vector3(x, y + 0.23, a - 0.15),
    ]);
    add(out, 'roof', new T.TubeGeometry(curve, 4, 0.032, 4, false), [0, 0, 0], [0, 0, 0], parent);
  }
}
function flowerPot(out: Collector, x: number, z: number, parent: T.Matrix4, flower = false) {
  add(out, 'stone', new T.CylinderGeometry(0.17, 0.12, 0.28, 10), [x, 0.14, z], [0, 0, 0], parent);
  add(out, 'stone', new T.TorusGeometry(0.165, 0.022, 4, 12), [x, 0.28, z], [Math.PI / 2, 0, 0], parent);
  add(out, 'dark', new T.CylinderGeometry(0.144, 0.144, 0.014, 10), [x, 0.273, z], [0, 0, 0], parent);
  for (let i = 0; i < 5; i++) {
    const a = i * 2.4,
      tx = x + Math.sin(a) * 0.18,
      tz = z + Math.cos(a) * 0.15,
      ty = 0.48 + (i % 2) * 0.11;
    beam(out, 'bark', [x, 0.28, z], [tx, ty, tz], 0.009, parent);
    add(
      out,
      'dark',
      new T.SphereGeometry(1, 7, 5).scale(0.075, 0.16, 0.025),
      [tx, ty - 0.02, tz],
      [0.4 * Math.cos(a), a, 0.4 * Math.sin(a)],
      parent,
    );
    if (flower && i % 2 === 0)
      add(out, 'flower', new T.SphereGeometry(0.055, 7, 5), [tx, ty + 0.12, tz], [0, 0, 0], parent);
  }
}

function house(
  out: Collector,
  x: number,
  z: number,
  w: number,
  d: number,
  h: number,
  turn = 0,
  feature = false,
) {
  const parent = new T.Matrix4().compose(
    new T.Vector3(x, 1.05, z),
    new T.Quaternion().setFromEuler(new T.Euler(0, turn, 0)),
    new T.Vector3(1, 1, 1),
  );
  const variant = Math.floor(rand(x * 8.13 + z * 3.71) * 7);
  box(out, 'plaster', [0, h / 2, 0], [w, h, d], [0, 0, 0], parent);
  box(out, 'stone', [0, 0.34, 0], [w + 0.035, 0.68, d + 0.035], [0, 0, 0], parent);
  box(out, 'stone', [0, 0.7, 0], [w + 0.075, 0.065, d + 0.075], [0, 0, 0], parent);
  add(out, 'roof', roofGeometry(w + 0.38, d + 0.5, h), [0, 0.025, 0], [0, 0, 0], parent);
  for (const side of [-1, 1]) {
    add(out, 'plaster', gableGeometry(d + 0.2, h), [(side * w) / 2, 0, 0], [0, 0, 0], parent);
    for (const [a, b, y] of [
      [-d / 2, -d * 0.29, h + 0.28],
      [-d * 0.29, -d * 0.1, h + 0.77],
      [-d * 0.1, d * 0.1, h + 1.4],
      [d * 0.1, d * 0.29, h + 0.77],
      [d * 0.29, d / 2, h + 0.28],
    ]) {
      wallCap(out, (side * w) / 2, a, b, y, parent);
    }
    box(out, 'dark', [side * (w / 2 + 0.101), h + 0.29, 0], [0.015, 0.28, 0.31], [0, 0, 0], parent);
    for (const dz of [-0.11, 0, 0.11])
      box(out, 'stone', [side * (w / 2 + 0.113), h + 0.29, dz], [0.025, 0.27, 0.024], [0, 0, 0], parent);
  }
  roofDetails(out, w, d, h, parent, feature);
  for (const face of [-1, 1])
    box(out, 'roof', [0, h - 0.01, face * (d / 2 + 0.19)], [w + 0.32, 0.07, 0.12], [0, 0, 0], parent);
  const front = d / 2 + 0.06;
  // A few short concealed channels tuck behind the projecting eaves. Keeping
  // the horse-head walls and most rooflines dark preserves the village silhouette.
  if (feature || variant === 2 || variant === 5) {
    box(out, 'dark', [0, h - 0.125, front + 0.035], [w * 0.73, 0.046, 0.07], [0, 0, 0], parent);
    box(out, 'strip', [0, h - 0.151, front + 0.035], [w * 0.69, 0.014, 0.035], [0, 0, 0], parent);
    add(
      out,
      'wallGlow',
      new T.PlaneGeometry(w * 0.94, h * 0.88),
      [0, h * 0.54, d / 2 + 0.012],
      [0, 0, 0],
      parent,
    );
  }
  // Panelled twin timber doors sit inside a layered, carved grey-stone surround.
  box(out, 'dark', [0, 0.97, front], [0.95, 1.94, 0.075], [0, 0, 0], parent);
  for (const dx of [-0.53, 0.53])
    box(out, 'stone', [dx, 1.01, front + 0.08], [0.12, 2.02, 0.19], [0, 0, 0], parent);
  for (const dx of [-0.61, 0.61])
    box(out, 'stone', [dx, 1.07, front + 0.115], [0.045, 1.99, 0.07], [0, 0, 0], parent);
  box(out, 'stone', [0, 2.08, front + 0.09], [1.32, 0.22, 0.27], [0, 0, 0], parent);
  box(out, 'stone', [0, 2.23, front + 0.14], [1.46, 0.055, 0.36], [0, 0, 0], parent);
  box(out, 'stone', [0, 2.29, front + 0.17], [1.54, 0.05, 0.4], [0, 0, 0], parent);
  box(out, 'roof', [0, 2.35, front + 0.2], [1.63, 0.065, 0.49], [0.08, 0, 0], parent);
  box(out, 'stone', [0, 0.04, front + 0.21], [1.25, 0.08, 0.48], [0, 0, 0], parent);
  for (const dx of [-0.235, 0.235]) {
    box(out, 'wood', [dx, 0.97, front + 0.061], [0.435, 1.81, 0.065], [0, 0, 0], parent);
    for (const dy of [0.42, 1.05, 1.58]) {
      box(out, 'dark', [dx, dy, front + 0.101], [0.32, 0.38, 0.009], [0, 0, 0], parent);
      box(out, 'wood', [dx, dy, front + 0.111], [0.275, 0.335, 0.014], [0, 0, 0], parent);
    }
    for (const xx of [-0.19, 0.19])
      box(out, 'wood', [dx + xx, 0.97, front + 0.12], [0.033, 1.8, 0.018], [0, 0, 0], parent);
    const hx = dx > 0 ? 0.105 : -0.105;
    add(
      out,
      'dark',
      new T.CylinderGeometry(0.038, 0.038, 0.012, 6),
      [hx, 1.06, front + 0.145],
      [Math.PI / 2, 0, 0],
      parent,
    );
    add(out, 'dark', new T.TorusGeometry(0.058, 0.009, 3, 8), [hx, 1.015, front + 0.16], [0, 0, 0], parent);
  }
  // A modest rosette and relief scrolls make the lintel read as carved stone.
  if (feature || variant === 1 || variant === 3) {
    add(out, 'stone', new T.TorusGeometry(0.067, 0.014, 3, 8), [0, 2.09, front + 0.245], [0, 0, 0], parent);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      add(
        out,
        'stone',
        new T.SphereGeometry(1, 6, 4).scale(0.025, 0.045, 0.012),
        [Math.sin(a) * 0.039, 2.09 + Math.cos(a) * 0.039, front + 0.255],
        [0, 0, -a],
        parent,
      );
    }
    for (const side of [-1, 1])
      add(
        out,
        'stone',
        new T.TorusGeometry(0.047, 0.011, 3, 8, Math.PI * 1.65),
        [side * 0.32, 2.09, front + 0.24],
        [0, 0, side * 0.8],
        parent,
      );
  } else box(out, 'stone', [0, 2.09, front + 0.235], [0.39, 0.13, 0.025], [0, 0, 0], parent);
  for (const side of [-1, 1]) {
    const wx = side * w * 0.3,
      wy = feature ? 2.1 : h > 4 ? 2.8 : 2.35,
      windowType = (variant + (side > 0 ? 1 : 0)) % 4;
    const windowMaterial: MatKey =
      windowType === 2
        ? 'windowAmber'
        : windowType === 1
          ? 'windowHoney'
          : windowType === 3 && variant % 2 === 0
            ? 'windowHoney'
            : 'dark';
    box(out, windowMaterial, [wx, wy, front], [0.76, 0.94, 0.045], [0, 0, 0], parent);
    if (windowMaterial !== 'dark') {
      // Paper/curtain folds vary the warm pane without an extra light or material.
      for (const dx of [-0.315, 0.32])
        box(out, 'wood', [wx + dx, wy, front + 0.035], [0.018, 0.89, 0.012], [0, 0, 0], parent);
      add(
        out,
        'wallGlow',
        new T.PlaneGeometry(1.24, 1.85),
        [wx, wy - 0.53, d / 2 + 0.014],
        [0, 0, 0],
        parent,
      );
      add(
        out,
        'groundGlow',
        new T.PlaneGeometry(1.35, 1.05),
        [wx, 0.125, front + 0.58],
        [-Math.PI / 2, 0, 0],
        parent,
      );
    }
    for (const dx of [-0.41, 0.41])
      box(out, 'wood', [wx + dx, wy, front + 0.06], [0.062, 1.06, 0.1], [0, 0, 0], parent);
    for (const dy of [-0.51, 0.51])
      box(out, 'wood', [wx, wy + dy, front + 0.06], [0.88, 0.062, 0.105], [0, 0, 0], parent);
    if (windowType === 0) {
      for (const dx of [-0.19, 0.19]) {
        box(out, 'wood', [wx + dx, wy, front + 0.09], [0.36, 0.92, 0.048], [0, 0, 0], parent);
        for (const dy of [-0.3, 0.3])
          box(out, 'wood', [wx + dx, wy + dy, front + 0.125], [0.31, 0.045, 0.025], [0, 0, 0], parent);
      }
    } else {
      for (const dx of [-0.25, 0, 0.25])
        box(out, 'wood', [wx + dx, wy, front + 0.09], [0.025, 0.88, 0.04], [0, 0, 0], parent);
      for (const dy of [-0.28, 0.28])
        box(out, 'wood', [wx, wy + dy, front + 0.09], [0.76, 0.025, 0.04], [0, 0, 0], parent);
      if (windowType !== 3) {
        for (const direction of [-1, 1])
          box(
            out,
            'wood',
            [wx, wy, front + 0.113],
            [0.36, 0.022, 0.025],
            [0, 0, (direction * Math.PI) / 4],
            parent,
          );
      }
      if (windowType === 3)
        box(out, 'wood', [wx - 0.51, wy, front + 0.16], [0.26, 0.94, 0.045], [0, 0.4, 0], parent);
    }
    box(out, 'stone', [wx, wy - 0.59, front + 0.14], [1.0, 0.085, 0.3], [0, 0, 0], parent);
    box(out, 'stone', [wx, wy - 0.535, front + 0.1], [0.89, 0.035, 0.18], [0, 0, 0], parent);
    box(out, 'roof', [wx, wy + 0.6, front + 0.13], [0.98, 0.065, 0.3], [0.12, 0, 0], parent);
    // The outer village lanes see the quieter rear elevations as well.
    box(
      out,
      side > 0 && variant % 3 === 1 ? 'windowHoney' : 'dark',
      [wx, h * 0.63, -d / 2 - 0.025],
      [0.46, 0.68, 0.055],
      [0, 0, 0],
      parent,
    );
    for (const dx of [-0.2, 0, 0.2])
      box(out, 'wood', [wx + dx, h * 0.63, -d / 2 - 0.065], [0.028, 0.65, 0.035], [0, 0, 0], parent);
    box(out, 'stone', [wx, h * 0.63 - 0.39, -d / 2 - 0.09], [0.62, 0.075, 0.19], [0, 0, 0], parent);
  }
  for (const dx of feature
    ? [-0.76, 0.76]
    : variant === 1 || variant === 4
      ? [variant === 1 ? -0.76 : 0.76]
      : []) {
    add(
      out,
      'lamp',
      new T.SphereGeometry(0.14, 12, 9).scale(1, 0.16 / 0.14, 1),
      [dx, 1.8, front + 0.22],
      [0, 0, 0],
      parent,
    );
    for (const yy of [1.64, 1.96])
      add(
        out,
        'warm',
        new T.CylinderGeometry(0.065, 0.065, 0.027, 8),
        [dx, yy, front + 0.22],
        [0, 0, 0],
        parent,
      );
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      beam(
        out,
        'red',
        [dx + Math.cos(a) * 0.13, 1.68, front + 0.22 + Math.sin(a) * 0.13],
        [dx + Math.cos(a) * 0.13, 1.92, front + 0.22 + Math.sin(a) * 0.13],
        0.006,
        parent,
      );
    }
    beam(out, 'wood', [dx, 2.08, front + 0.1], [dx, 1.98, front + 0.22], 0.018, parent);
    box(out, 'red', [dx, 1.52, front + 0.22], [0.023, 0.19, 0.023], [0, 0, 0], parent);
    add(out, 'wallGlow', new T.PlaneGeometry(0.9, 1.75), [dx, 1.2, d / 2 + 0.017], [0, 0, 0], parent);
    add(
      out,
      'groundGlow',
      new T.PlaneGeometry(1.15, 0.85),
      [dx, 0.127, front + 0.47],
      [-Math.PI / 2, 0, 0],
      parent,
    );
  }
  if (variant === 2 || variant === 5 || feature)
    flowerPot(out, (variant === 5 ? -1 : 1) * (w * 0.34), front + 0.31, parent, feature || variant === 2);
  if (feature) {
    // A little open wooden picture window and red fish, from the supplied photo.
    box(out, 'windowAmber', [0, h - 0.85, front + 0.03], [1.35, 1.04, 0.09], [0, 0, 0], parent);
    // A recessed shelf and inner jambs keep the remembered picture window deep.
    for (const dx of [-0.62, 0.62])
      box(out, 'wood', [dx, h - 0.85, front + 0.091], [0.055, 0.98, 0.03], [0, 0, 0], parent);
    box(out, 'wood', [0, h - 1.07, front + 0.09], [1.28, 0.045, 0.04], [0, 0, 0], parent);
    for (const dx of [-0.39, 0.22])
      box(out, 'dark', [dx, h - 0.94, front + 0.12], [0.1, 0.2, 0.06], [0, 0, 0], parent);
    add(out, 'wallGlow', new T.PlaneGeometry(2.0, 1.8), [0, h - 1.5, d / 2 + 0.02], [0, 0, 0], parent);
    for (const dx of [-0.74, 0.74])
      box(out, 'wood', [dx, h - 0.85, front + 0.23], [0.09, 1.22, 0.44], [0, 0, 0], parent);
    for (const dy of [-0.6, 0.6])
      box(out, 'wood', [0, h - 0.85 + dy, front + 0.22], [1.56, 0.11, 0.42], [0, 0, 0], parent);
    box(out, 'wood', [-0.97, h - 0.85, front + 0.32], [0.38, 1.09, 0.055], [0, 0.45, 0], parent);
    box(out, 'wood', [0.97, h - 0.85, front + 0.32], [0.38, 1.09, 0.055], [0, -0.45, 0], parent);
    add(
      out,
      'red',
      new T.SphereGeometry(1, 12, 8).scale(0.36, 0.17, 0.07),
      [0, h - 1.72, front + 0.13],
      [0, 0, -0.13],
      parent,
    );
    const fishTail = new T.ConeGeometry(0.16, 0.23, 3);
    fishTail.rotateZ(-Math.PI / 2);
    add(out, 'red', fishTail, [0.39, h - 1.72, front + 0.13], [0, 0, 0], parent);
    add(
      out,
      'plaster',
      new T.SphereGeometry(0.05, 8, 6).scale(1, 1, 0.35),
      [-0.21, h - 1.68, front + 0.21],
      [0, 0, 0],
      parent,
    );
    add(
      out,
      'dark',
      new T.SphereGeometry(0.022, 6, 4).scale(1, 1, 0.35),
      [-0.215, h - 1.676, front + 0.229],
      [0, 0, 0],
      parent,
    );
    for (let i = 0; i < 6; i++)
      box(
        out,
        'plaster',
        [-0.08 + (i % 3) * 0.1, h - 1.76 + Math.floor(i / 3) * 0.09, front + 0.202],
        [0.042, 0.035, 0.012],
        [0, 0, 0.22],
        parent,
      );
    box(out, 'wood', [0, h - 1.47, front + 0.28], [1.46, 0.065, 0.4], [0, 0, 0], parent);
  }
}

const buildVillage = () => {
  const out = collector();
  // The dense north bank keeps the characteristic white façades and picture window.
  house(out, -7, -5.05, 4.15, 4.4, 4.35, 0, true);
  house(out, -2.65, -5.35, 3.8, 4.7, 3.65);
  house(out, 1.55, -5.55, 4.05, 5.1, 4.15);
  house(out, 6, -5.25, 4.25, 4.5, 4.75);
  house(out, -11.25, -5.0, 3.2, 4.7, 3.7, -0.13);
  house(out, 10.2, -5.15, 3.35, 4.6, 3.95, 0.12);
  // Unequal blocks and offset alleys replace the two regular rows of the first study.
  house(out, -9.5, -10.8, 4.6, 4.5, 4.1, 0.04);
  house(out, -4.05, -12.0, 4.25, 5.2, 4.7, -0.035);
  house(out, 1.2, -11.1, 4.0, 4.1, 3.8, 0.03);
  house(out, 5.7, -11.5, 4.1, 5.4, 4.4, -0.04);
  house(out, 10.4, -11.4, 3.75, 4.8, 3.65, 0.08);
  // South, east and west façades all face the pond. A continuous narrow lane remains
  // between the shoreline and their doorsteps; roof heights descend towards the front.
  const shoreHouses: [number, number, number, number, number][] = [
    [0.17, 3.65, 3.65, 3.85, 0.02],
    [0.48, 3.5, 3.7, 3.45, -0.03],
    [0.8, 3.7, 3.35, 3.65, 0.015],
    [1.1, 3.3, 3.5, 3.05, -0.035],
    [1.4, 3.25, 3.55, 3.35, 0.01],
    [1.71, 3.25, 3.9, 2.95, 0.035],
    [2.02, 3.5, 3.5, 3.55, -0.025],
    [2.33, 3.6, 3.65, 3.3, 0.02],
    [2.65, 3.55, 3.5, 3.8, -0.02],
    [2.97, 3.65, 3.7, 3.45, 0.025],
  ];
  for (const [a, w, d, h, turnVariation] of shoreHouses) {
    const px = 10 * Math.cos(a),
      pz = -2 + 13 * Math.sin(a),
      normal = new T.Vector2(Math.cos(a) / 10, Math.sin(a) / 13).normalize();
    const setback = 1.48 + d / 2;
    house(
      out,
      px + normal.x * setback,
      pz + normal.y * setback,
      w,
      d,
      h,
      Math.atan2(-normal.x, -normal.y) + turnVariation,
    );
  }
  // Two smaller rear wings read as courtyard compounds, not freestanding clones.
  house(out, -13.25, -11.0, 2.6, 3.8, 3.05, 0.02);
  house(out, 13.7, -10.2, 2.45, 3.35, 2.9, -0.04);
  return out;
};
const buildCourtyard = () => {
  const out = collector();
  house(out, 14.05, 9.2, 3.2, 2.75, 3.05, -0.16);
  // Low courtyard enclosure, paving, table, two chairs and tea cups.
  box(out, 'paving', [13.6, 1.08, 13.05], [4.55, 0.11, 4.6]);
  for (const [x, z, sx, sz] of [
    [11.4, 13.1, 0.18, 4.4],
    [15.8, 13.1, 0.18, 4.4],
    [13.6, 15.3, 4.55, 0.18],
  ]) {
    box(out, 'plaster', [x, 1.65, z], [sx, 1.2, sz]);
    box(out, 'roof', [x, 2.29, z], [sx + 0.12, 0.12, sz + 0.12]);
  }
  for (const x of [11.51, 15.69]) {
    box(out, 'dark', [x, 2.185, 13.1], [0.035, 0.05, 3.7]);
    box(out, 'strip', [x + (x < 13 ? 0.02 : -0.02), 2.165, 13.1], [0.012, 0.017, 3.61]);
    add(
      out,
      'groundGlow',
      new T.PlaneGeometry(1.35, 3.7),
      [x + (x < 13 ? 0.55 : -0.55), 1.151, 13.1],
      [-Math.PI / 2, 0, 0],
    );
  }
  // Two small timber wall lanterns remain recognisable fixtures in daylight.
  for (const x of [11.95, 15.05]) {
    box(out, 'dark', [x, 2.05, 15.165], [0.2, 0.35, 0.13]);
    box(out, 'windowHoney', [x, 2.05, 15.093], [0.14, 0.27, 0.025]);
    box(out, 'wood', [x, 2.05, 15.073], [0.018, 0.29, 0.02]);
    box(out, 'wood', [x, 2.05, 15.072], [0.16, 0.018, 0.02]);
    box(out, 'roof', [x, 2.245, 15.145], [0.28, 0.055, 0.23]);
    add(out, 'wallGlow', new T.PlaneGeometry(1.05, 1.05), [x, 1.68, 15.198], [0, Math.PI, 0]);
    add(out, 'groundGlow', new T.PlaneGeometry(1.4, 1.4), [x, 1.153, 14.62], [-Math.PI / 2, 0, 0]);
  }
  box(out, 'wood', [13.45, 1.98, 13.1], [1.35, 0.12, 0.85]);
  for (const x of [12.9, 14])
    for (const z of [12.8, 13.4]) box(out, 'wood', [x, 1.56, z], [0.07, 0.88, 0.07]);
  for (const x of [12.45, 14.45]) {
    box(out, 'wood', [x, 1.54, 13.1], [0.59, 0.1, 0.59]);
    for (const dx of [-0.23, 0.23])
      for (const dz of [-0.23, 0.23]) box(out, 'wood', [x + dx, 1.3, 13.1 + dz], [0.06, 0.5, 0.06]);
    box(out, 'wood', [x, 1.95, 12.82], [0.59, 0.73, 0.055]);
  }
  for (const x of [13.15, 13.75])
    add(out, 'warm', new T.CylinderGeometry(0.095, 0.07, 0.16, 12), [x, 2.12, 13.1]);
  return out;
};

export default function HongcunArchitecture({
  m,
  onHouse,
  onCourtyard,
}: {
  m: HongcunMaterials;
  onHouse: () => void;
  onCourtyard: () => void;
}) {
  const pictureLight = useRef<T.PointLight>(null),
    courtyardLight = useRef<T.PointLight>(null);
  useFrame(() => {
    if (pictureLight.current) pictureLight.current.intensity = resortAtmosphere.lamps * 3.2;
    if (courtyardLight.current) courtyardLight.current.intensity = resortAtmosphere.lamps * 4.2;
  });
  return (
    <>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onHouse();
        }}
      >
        <Compiled build={buildVillage} m={m} />
      </group>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onCourtyard();
        }}
      >
        <Compiled build={buildCourtyard} m={m} />
      </group>
      <pointLight
        ref={pictureLight}
        position={[-7, 3.85, -2.24]}
        color="#ffcd8d"
        intensity={0}
        distance={5.2}
        decay={2}
      />
      <pointLight
        ref={courtyardLight}
        position={[13.5, 2.9, 13.4]}
        color="#ffce92"
        intensity={0}
        distance={4.8}
        decay={2}
      />
    </>
  );
}
