import { regionOrigins } from './regionLayout';
import { useEffect, useMemo, useRef } from 'react';
import * as T from 'three';
import { useFrame } from '@react-three/fiber';
import { resortAtmosphere } from './dayCycle';
import ChiangMaiTown from './ChiangMaiTown';

type V = [number, number, number];
export type ChiangMaiSpot = 'suthep' | 'trail' | 'temple' | 'san' | 'taste' | 'foresttemple';
type Props = { night: boolean; onSelect: (id: ChiangMaiSpot) => void };

// A little landscape of their memories: the mountain, ancient city and evening
// tables share the scale of the other two islands, rather than a surveyed map.
const ORIGIN = regionOrigins.chiangmai;
const SUMMIT_Y = 20;
const TEMPLE_SCALE = 0.56;
export const MID_SHRINE_POSITION: V = [-9.8, 10.8, -4.1];
const rand = (n: number) => T.MathUtils.euclideanModulo(Math.sin(n * 127.13 + 31.71) * 43758.5453, 1);
const smooth = (a: number, b: number, x: number) => T.MathUtils.smoothstep(x, a, b);
const trailPlan: [number, number][] = [
  [-10, 9.1],
  [-12.2, 7.5],
  [-14.3, 4.7],
  [-14.8, 2],
  [-12.8, 0.8],
  [-10.5, 0.7],
  [-8.8, -0.4],
  [-8, -1],
  [-9.8, -1.3],
  [-12.5, -2.5],
  [-14, -5.5],
  [-13, -6.8],
  [-10.5, -6.7],
  [-7.5, -6.5],
  [-4.6, -7],
  [-5.8, -8.1],
  [-8.8, -8.7],
  [-10.8, -10.5],
  [-9.4, -10.3],
  [-7, -10.78],
];
const trailCurve = new T.CatmullRomCurve3(
  trailPlan.map(([x, z]) => new T.Vector3(x, 0, z)),
  false,
  'centripetal',
);
const shrinePathCurve = new T.CatmullRomCurve3(
  [
    [-13, -6.8],
    [-12.6, -6],
    [-12.7, -5.1],
    [-12.3, -4.35],
    [-11.6, -4.1],
  ].map(([x, z]) => new T.Vector3(x, 0, z)),
  false,
  'centripetal',
);

function naturalHeightAt(x: number, z: number) {
  const forest =
    18.3 * Math.exp(-(((x + 7) / 8.7) ** 2) - ((z + 13) / 11.4) ** 2) +
    4.8 * Math.exp(-(((x - 6.8) / 8.2) ** 2) - ((z + 16) / 8.5) ** 2) +
    1.7 * Math.exp(-(((x + 14) / 5.3) ** 2) - ((z + 7) / 9.3) ** 2);
  const edge = 1 - smooth(0.76, 1.02, Math.sqrt((x / 18) ** 2 + ((z + 1.5) / 22.5) ** 2));
  const townClear = 1 - smooth(-4.8, -2.8, x) * smooth(-3, -0.8, z);
  let h = 0.8 + forest * (1 - smooth(-0.8, 3, z)) * edge * townClear;
  h +=
    (Math.sin(x * 1.2 + z * 0.5) * Math.sin(z * 0.8 - x * 0.25) * 0.19 + Math.sin(x * 2.1 - z * 0.9) * 0.07) *
    smooth(0.82, 2.2, h);
  // A small terrace is nestled into the ridge; the mountain remains dominant.
  const terraceDistance = Math.max(Math.abs(x + 7) - 3.15, Math.abs(z + 13) - 2.2);
  h = T.MathUtils.lerp(h, SUMMIT_Y - 0.055, 1 - smooth(-0.12, 1.15, terraceDistance));
  // A quiet stop halfway up: the little shrine sits on an earthen ledge,
  // with its rear cut into the hillside and soft, planted shoulders below.
  const shrineDistance = Math.max(
    Math.abs(x - MID_SHRINE_POSITION[0]) - 2.02,
    Math.abs(z - MID_SHRINE_POSITION[2]) - 1.42,
  );
  return T.MathUtils.lerp(h, MID_SHRINE_POSITION[1], 1 - smooth(-0.08, 0.68, shrineDistance));
}
const trailSamples = trailCurve.getPoints(440).map((p) => ({ x: p.x, z: p.z, y: naturalHeightAt(p.x, p.z) }));
const shrinePathSamples = shrinePathCurve
  .getPoints(95)
  .map((p) => ({ x: p.x, z: p.z, y: naturalHeightAt(p.x, p.z) }));
function heightAt(x: number, z: number) {
  const natural = naturalHeightAt(x, z);
  let distance = 0.9,
    trailY = natural;
  for (const p of trailSamples) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < distance) {
      distance = d;
      trailY = p.y;
    }
  }
  for (const p of shrinePathSamples) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < distance) {
      distance = d;
      trailY = p.y;
    }
  }
  // Walking-width shelves follow the contours, with softly weathered banks.
  const ground = T.MathUtils.lerp(natural, trailY - 0.015, 1 - smooth(0.3, 0.88, distance));
  // Preserve actual soil contact beneath the shrine: adjacent trail cuts must
  // not hollow out its downhill corners or turn the ledge into a floating slab.
  const shrineFoot = Math.max(
    Math.abs(x - MID_SHRINE_POSITION[0]) - 2.2,
    Math.abs(z - MID_SHRINE_POSITION[2]) - 1.62,
  );
  return T.MathUtils.lerp(ground, MID_SHRINE_POSITION[1], 1 - smooth(0, 0.35, shrineFoot));
}
const TERRAIN_SEGMENTS = 148;
// Retain the original interior lattice, including every trail/terrace sample,
// and extend it far enough to reach the actual island outline on every side.
const TERRAIN_DX = 35.4 / TERRAIN_SEGMENTS,
  TERRAIN_DZ = 41 / TERRAIN_SEGMENTS;
const TERRAIN_MIN_X = -17.7 - 4 * TERRAIN_DX,
  TERRAIN_MIN_Z = -22 - 8 * TERRAIN_DZ;
const TERRAIN_COLS = TERRAIN_SEGMENTS + 8,
  TERRAIN_ROWS = TERRAIN_SEGMENTS + 12;
const FOOT_Y = 0.78,
  SOIL_JOIN_Y = 0.68;
type PlanPoint = { x: number; z: number };
const islandContour = planShape()
  .getPoints()
  .map((p) => ({ x: p.x, z: -p.y }));
if (
  Math.hypot(islandContour[0].x - islandContour.at(-1)!.x, islandContour[0].z - islandContour.at(-1)!.z) <
  1e-7
)
  islandContour.pop();
function coastDistanceAt(x: number, z: number) {
  let distance = Infinity,
    inside = false;
  for (let i = 0, j = islandContour.length - 1; i < islandContour.length; j = i++) {
    const a = islandContour[j],
      b = islandContour[i],
      dx = b.x - a.x,
      dz = b.z - a.z;
    const t = T.MathUtils.clamp(((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz), 0, 1);
    distance = Math.min(distance, Math.hypot(x - a.x - dx * t, z - a.z - dz * t));
    if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) inside = !inside;
  }
  return inside ? distance : -distance;
}
let heightGrid: Float64Array | undefined;
function terrainGrid() {
  if (!heightGrid) {
    heightGrid = new Float64Array((TERRAIN_COLS + 1) * (TERRAIN_ROWS + 1));
    for (let j = 0; j <= TERRAIN_ROWS; j++)
      for (let i = 0; i <= TERRAIN_COLS; i++) {
        const x = TERRAIN_MIN_X + i * TERRAIN_DX,
          z = TERRAIN_MIN_Z + j * TERRAIN_DZ;
        // The old ellipse cut away still-high terrain. Ease the entire foot down
        // to the real shoreline instead; the last cell is buried in the soil cap.
        heightGrid[j * (TERRAIN_COLS + 1) + i] = T.MathUtils.lerp(
          FOOT_Y,
          heightAt(x, z),
          smooth(0.4, 2.4, coastDistanceAt(x, z)),
        );
      }
  }
  return heightGrid;
}
export function renderedGroundAt(x: number, z: number) {
  // Match the actual piecewise-planar terrain triangles, not only the ideal
  // heightfield; this keeps the thin trail skin from disappearing into ridges.
  const grid = terrainGrid(),
    gx = T.MathUtils.clamp((x - TERRAIN_MIN_X) / TERRAIN_DX, 0, TERRAIN_COLS - 0.0001),
    gz = T.MathUtils.clamp((z - TERRAIN_MIN_Z) / TERRAIN_DZ, 0, TERRAIN_ROWS - 0.0001);
  const i = Math.floor(gx),
    j = Math.floor(gz),
    u = gx - i,
    v = gz - j,
    a = j * (TERRAIN_COLS + 1) + i;
  const ha = grid[a],
    hb = grid[a + 1],
    hc = grid[a + TERRAIN_COLS + 1],
    hd = grid[a + TERRAIN_COLS + 2];
  return u + v <= 1 ? ha + (hb - ha) * u + (hc - ha) * v : hd + (hc - hd) * (1 - u) + (hb - hd) * (1 - v);
}
function trailHalfWidth(t: number) {
  const a = Math.max(0, t - 0.001),
    b = Math.min(1, t + 0.001),
    distance = trailCurve.getPoint(a).distanceTo(trailCurve.getPoint(b));
  const turn = trailCurve.getTangent(a).distanceTo(trailCurve.getTangent(b));
  const width = 0.45 + Math.sin(t * 112.2) * 0.04 + Math.sin(t * 349.8) * 0.018;
  // Keep the inside edge from folding over at a tight walking switchback.
  return Math.min(width, turn > 0.0001 ? (0.62 * distance) / turn : width);
}

function planShape() {
  const points: [number, number][] = [
    [-17, -18],
    [-11, -23],
    [4, -23],
    [15, -19],
    [18, -10],
    [17, 2],
    [17.5, 12],
    [11, 18],
    [0, 20],
    [-11, 18],
    [-17, 12],
    [-18, 1],
  ];
  const curve = new T.CatmullRomCurve3(
    points.map(([x, z]) => new T.Vector3(x, -z, 0)),
    true,
    'centripetal',
  );
  const shape = new T.Shape();
  curve.getPoints(130).forEach((p, i) => (i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y)));
  shape.closePath();
  return shape;
}

function earthTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#adb08b';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 450; i++) {
    const x = rand(i + 3) * 512,
      y = rand(i + 600) * 512,
      r = 3 + rand(i + 1200) * 45;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 3 ? '#344e3026' : '#c4af7f33');
    g.addColorStop(1, '#a1aa8200');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 17000; i++) {
    ctx.fillStyle = i % 2 ? '#f3e6b92d' : '#18351e24';
    ctx.fillRect(rand(i + 1800) * 512, rand(i + 19000) * 512, 1, 1 + rand(i + 39000) * 2);
  }
  const tex = new T.CanvasTexture(c);
  tex.colorSpace = T.SRGBColorSpace;
  tex.wrapS = tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(0.075, 0.075);
  tex.anisotropy = 4;
  return tex;
}

function mountainGeometry() {
  const geometry = new T.BufferGeometry(),
    positions: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const vertices = new Map<string, number>();
  const vertex = (x: number, z: number, y = renderedGroundAt(x, z)) => {
    const key = `${Math.round(x * 1e7)},${Math.round(y * 1e7)},${Math.round(z * 1e7)}`,
      known = vertices.get(key);
    if (known !== undefined) return known;
    const id = positions.length / 3;
    vertices.set(key, id);
    positions.push(x, y, z);
    uv.push(x, -z);
    const shade = 0.92 + 0.07 * Math.sin(x * 0.63 + z * 0.44) + 0.035 * Math.sin(x * 3.1 - z * 1.4);
    const color = new T.Color(y > 2 ? '#778a5d' : '#b0b18a').multiplyScalar(shade);
    colors.push(color.r, color.g, color.b);
    return id;
  };
  // Clip only coast cells against the smooth island outline. Interior cells
  // retain the same diagonal as renderedGroundAt and the existing path skin.
  const clipToTriangle = (triangle: PlanPoint[]) => {
    let polygon = islandContour;
    for (let edge = 0; edge < 3 && polygon.length; edge++) {
      const a = triangle[edge],
        b = triangle[(edge + 1) % 3],
        input = polygon;
      polygon = [];
      const side = (p: PlanPoint) => (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
      for (let i = 0, j = input.length - 1; i < input.length; j = i++) {
        const p = input[j],
          q = input[i],
          sp = side(p),
          sq = side(q),
          pin = sp <= 1e-9,
          qin = sq <= 1e-9;
        if (pin !== qin) {
          const t = sp / (sp - sq);
          polygon.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
        }
        if (qin) polygon.push(q);
      }
    }
    return polygon;
  };
  const appendTriangle = (a: PlanPoint, b: PlanPoint, c: PlanPoint) => {
    const signedArea = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
    if (Math.abs(signedArea) < 1e-10) return;
    const ids = [vertex(a.x, a.z), vertex(b.x, b.z), vertex(c.x, c.z)];
    indices.push(...(signedArea < 0 ? ids : [ids[0], ids[2], ids[1]]));
  };
  const coastGrid = new Float64Array((TERRAIN_COLS + 1) * (TERRAIN_ROWS + 1));
  for (let j = 0; j <= TERRAIN_ROWS; j++)
    for (let i = 0; i <= TERRAIN_COLS; i++)
      coastGrid[j * (TERRAIN_COLS + 1) + i] = coastDistanceAt(
        TERRAIN_MIN_X + i * TERRAIN_DX,
        TERRAIN_MIN_Z + j * TERRAIN_DZ,
      );
  const cellDiagonal = Math.hypot(TERRAIN_DX, TERRAIN_DZ);
  for (let j = 0; j < TERRAIN_ROWS; j++)
    for (let i = 0; i < TERRAIN_COLS; i++) {
      const x = TERRAIN_MIN_X + i * TERRAIN_DX,
        z = TERRAIN_MIN_Z + j * TERRAIN_DZ,
        a = j * (TERRAIN_COLS + 1) + i;
      const corners = [
        { x, z },
        { x, z: z + TERRAIN_DZ },
        { x: x + TERRAIN_DX, z },
        { x: x + TERRAIN_DX, z: z + TERRAIN_DZ },
      ];
      const distances = [
        coastGrid[a],
        coastGrid[a + TERRAIN_COLS + 1],
        coastGrid[a + 1],
        coastGrid[a + TERRAIN_COLS + 2],
      ];
      for (const ids of [
        [0, 1, 2],
        [2, 1, 3],
      ]) {
        if (ids.every((id) => distances[id] >= 0)) {
          appendTriangle(corners[ids[0]], corners[ids[1]], corners[ids[2]]);
          continue;
        }
        if (ids.every((id) => distances[id] < -cellDiagonal)) continue;
        const clipped = clipToTriangle(ids.map((id) => corners[id]));
        const faces = T.ShapeUtils.triangulateShape(
          clipped.map((p) => new T.Vector2(p.x, p.z)),
          [],
        );
        for (const [a, b, c] of faces) appendTriangle(clipped[a], clipped[b], clipped[c]);
      }
    }
  // Close the perimeter and underside *inside* the plinth, only 10 cm below
  // the flat foot. The visible hillside is the continuous sloping top above.
  const boundary = new Map<string, [number, number]>();
  for (let i = 0; i < indices.length; i += 3)
    for (let j = 0; j < 3; j++) {
      const a = indices[i + j],
        b = indices[i + ((j + 1) % 3)],
        key = a < b ? `${a},${b}` : `${b},${a}`;
      if (boundary.has(key)) boundary.delete(key);
      else boundary.set(key, [a, b]);
    }
  const bottomCentre = vertex(0, 0, SOIL_JOIN_Y);
  for (const [a, b] of boundary.values()) {
    const lowerA = vertex(positions[a * 3], positions[a * 3 + 2], SOIL_JOIN_Y),
      lowerB = vertex(positions[b * 3], positions[b * 3 + 2], SOIL_JOIN_Y);
    indices.push(a, lowerA, b, b, lowerA, lowerB, lowerA, bottomCentre, lowerB);
  }
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function Terrain() {
  const texture = useMemo(earthTexture, []),
    shape = useMemo(planShape, []);
  const mountain = useMemo(mountainGeometry, []);
  useEffect(
    () => () => {
      texture.dispose();
      mountain.dispose();
    },
    [texture, mountain],
  );
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.43, 0]} receiveShadow castShadow>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 1.12,
              bevelEnabled: true,
              bevelSize: 0.45,
              bevelThickness: 0.1,
              bevelSegments: 3,
              curveSegments: 28,
            },
          ]}
        />
        <meshStandardMaterial
          color="#9d9475"
          roughness={1}
          map={texture}
          bumpMap={texture}
          bumpScale={0.035}
        />
      </mesh>
      <mesh geometry={mountain} receiveShadow castShadow>
        <meshStandardMaterial vertexColors map={texture} bumpMap={texture} bumpScale={0.04} roughness={1} />
      </mesh>
    </>
  );
}

function leafGeometry() {
  const g = new T.IcosahedronGeometry(1, 2),
    p = g.getAttribute('position'),
    color: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      noise =
        0.15 * Math.sin(x * 6.7 + y * 2.1) * Math.sin(z * 5.5 - y * 3.7) +
        0.065 * Math.sin(x * 25 + z * 19) * Math.cos(y * 21);
    p.setXYZ(i, x * (1 + noise), y * (1 + noise), z * (1 + noise));
    const v = 0.7 + 0.3 * rand(i + 371);
    color.push(v, v, v * 0.9);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(color, 3));
  g.computeVertexNormals();
  return g;
}

function Forest() {
  const crowns = useRef<T.InstancedMesh>(null),
    trunks = useRef<T.InstancedMesh>(null),
    rocks = useRef<T.InstancedMesh>(null);
  const leaves = useMemo(leafGeometry, []);
  const points = useMemo(() => {
    const trees: { x: number; z: number; h: number; s: number; turn: number }[] = [
      [-6.8, -4.8],
      [-12.7, -3.1],
    ].map(([x, z], i) => ({ x, z, h: renderedGroundAt(x, z), s: 1.24, turn: i * 2.1 }));
    for (let i = 0; i < 900; i++) {
      const x = -17 + rand(i + 1) * 34,
        z = -22 + rand(i + 2000) * 27;
      if ((x / 17) ** 2 + ((z + 1.5) / 21.6) ** 2 > 0.93) continue;
      if (Math.abs(x + 7) < 3.9 && Math.abs(z + 13) < 2.95) continue;
      if (Math.abs(x - MID_SHRINE_POSITION[0]) < 2.5 && Math.abs(z - MID_SHRINE_POSITION[2]) < 1.85) continue;
      if (x > -3.7 && z > -2.8) continue;
      if (trailSamples.some((p) => Math.hypot(p.x - x, p.z - z) < 1.15)) continue;
      if (shrinePathSamples.some((p) => Math.hypot(p.x - x, p.z - z) < 1)) continue;
      trees.push({
        x,
        z,
        h: renderedGroundAt(x, z),
        s: 0.48 + rand(i + 3000) * 0.63,
        turn: rand(i + 5000) * Math.PI * 2,
      });
      if (trees.length === 210) break;
    }
    return trees;
  }, []);
  useEffect(() => {
    if (!crowns.current || !trunks.current || !rocks.current) return;
    const o = new T.Object3D();
    let c = 0;
    points.forEach((p, i) => {
      o.position.set(p.x, p.h + p.s * 0.8, p.z);
      o.rotation.set(0, p.turn, (rand(i + 7000) - 0.5) * 0.1);
      o.scale.set(p.s * 0.1, p.s * 1.8, p.s * 0.1);
      o.updateMatrix();
      trunks.current!.setMatrixAt(i, o.matrix);
      for (let j = 0; j < 3; j++) {
        o.position.set(
          p.x + Math.sin(p.turn + j * 2.1) * p.s * 0.45,
          p.h + p.s * (1.65 + j * 0.36),
          p.z + Math.cos(p.turn + j * 2.1) * p.s * 0.45,
        );
        o.rotation.set(0.1 * j, p.turn + j, 0.12 * j);
        o.scale.set(p.s * (0.86 - j * 0.04), p.s * (0.81 + j * 0.12), p.s * 0.91);
        o.updateMatrix();
        crowns.current!.setMatrixAt(c, o.matrix);
        crowns.current!.setColorAt(c, new T.Color(['#355735', '#477044', '#5d7949', '#708657'][i % 4]));
        c++;
      }
    });
    trunks.current.count = points.length;
    crowns.current.count = c;
    trunks.current.instanceMatrix.needsUpdate = true;
    crowns.current.instanceMatrix.needsUpdate = true;
    if (crowns.current.instanceColor) crowns.current.instanceColor.needsUpdate = true;
    for (let i = 0; i < 70; i++) {
      const x = -16 + rand(i + 8000) * 30,
        z = -20 + rand(i + 9000) * 18;
      if (
        coastDistanceAt(x, z) < 0.85 ||
        (Math.abs(x + 7) < 3.6 && Math.abs(z + 13) < 2.6) ||
        (Math.abs(x - MID_SHRINE_POSITION[0]) < 2.3 && Math.abs(z - MID_SHRINE_POSITION[2]) < 1.7)
      ) {
        o.scale.setScalar(0);
      } else {
        o.scale.set(
          0.3 + rand(i + 11000) * 0.6,
          0.15 + rand(i + 12000) * 0.35,
          0.25 + rand(i + 13000) * 0.55,
        );
      }
      const normal = new T.Vector3(
        renderedGroundAt(x - 0.16, z) - renderedGroundAt(x + 0.16, z),
        0.32,
        renderedGroundAt(x, z - 0.16) - renderedGroundAt(x, z + 0.16),
      ).normalize();
      o.position.set(x, renderedGroundAt(x, z) + 0.025, z);
      o.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), normal);
      o.rotateY(rand(i + 14000) * 6);
      o.rotateX(rand(i) * 0.15);
      o.updateMatrix();
      rocks.current!.setMatrixAt(i, o.matrix);
    }
    rocks.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  useEffect(() => () => leaves.dispose(), [leaves]);
  return (
    <>
      <instancedMesh ref={trunks} args={[undefined, undefined, 210]} castShadow receiveShadow>
        <cylinderGeometry args={[0.7, 1, 1, 7]} />
        <meshStandardMaterial color="#746c50" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crowns} args={[leaves, undefined, 630]} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.93} />
      </instancedMesh>
      <instancedMesh ref={rocks} args={[undefined, undefined, 70]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 2]} />
        <meshStandardMaterial color="#8f9276" roughness={1} />
      </instancedMesh>
    </>
  );
}

function Box({ at, size, color, turn = 0 }: { at: V; size: V; color: string; turn?: number }) {
  return (
    <mesh position={at} rotation={[0, turn, 0]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}

function Tube({
  points,
  radius,
  color,
  metalness = 0,
}: {
  points: V[];
  radius: number;
  color: string;
  metalness?: number;
}) {
  const geometry = useMemo(
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        Math.max(24, points.length * 5),
        radius,
        8,
        false,
      ),
    [points, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial color={color} metalness={metalness} roughness={metalness ? 0.36 : 0.92} />
    </mesh>
  );
}

function Trail() {
  const stones = useRef<T.InstancedMesh>(null);
  const gate = useMemo(() => {
    // The opening follows the path itself: local -Z leads uphill, while the
    // bamboo posts sit perpendicular to the trail on either shoulder.
    const centre = trailCurve.getPoint(0.012),
      uphill = trailCurve.getTangent(0.012);
    const turn = Math.atan2(-uphill.x, -uphill.z),
      y = renderedGroundAt(centre.x, centre.z);
    const postY = [-1.1, 1.1].map(
      (side) => renderedGroundAt(centre.x + Math.cos(turn) * side, centre.z - Math.sin(turn) * side) - y,
    );
    return { position: [centre.x, y, centre.z] as V, turn, postY };
  }, []);
  const path = useMemo(() => {
    const p: number[] = [],
      uv: number[] = [],
      colors: number[] = [],
      index: number[] = [];
    const count = 1320,
      across = 8;
    for (let i = 0; i <= count; i++) {
      const t = i / count,
        pt = trailCurve.getPoint(t),
        tangent = trailCurve.getTangent(t),
        side = new T.Vector3(-tangent.z, 0, tangent.x).multiplyScalar(trailHalfWidth(t));
      for (let j = 0; j <= across; j++) {
        const s = -1 + (2 * j) / across,
          x = pt.x + side.x * s,
          z = pt.z + side.z * s;
        p.push(x, renderedGroundAt(x, z) + 0.09, z);
        uv.push(j / across, t * 40);
        const c = new T.Color(Math.abs(s) > 0.8 ? '#988264' : i % 7 ? '#c2a273' : '#ab8d64').multiplyScalar(
          0.91 + rand(i * 7 + j) * 0.14,
        );
        colors.push(c.r, c.g, c.b);
      }
      // Across × forward has positive Y; the opposite winding hid the whole
      // dirt strip through back-face culling while leaving loose stones visible.
      if (i < count)
        for (let j = 0; j < across; j++) {
          const a = i * (across + 1) + j;
          index.push(a, a + 1, a + across + 1, a + 1, a + across + 2, a + across + 1);
        }
    }
    // A few shelf creases cross the much finer trail triangles. Lift only those
    // affected vertices enough to clear the underlying terrain at their edges.
    for (let i = 0; i < index.length; i += 3) {
      const ids = [index[i], index[i + 1], index[i + 2]];
      let lift = 0;
      for (const w of [
        [1 / 3, 1 / 3, 1 / 3],
        [0.5, 0.5, 0],
        [0.5, 0, 0.5],
        [0, 0.5, 0.5],
        [0.75, 0.25, 0],
        [0.25, 0.75, 0],
        [0.75, 0, 0.25],
        [0.25, 0, 0.75],
        [0, 0.75, 0.25],
        [0, 0.25, 0.75],
      ]) {
        let x = 0,
          y = 0,
          z = 0;
        for (let j = 0; j < 3; j++) {
          x += p[ids[j] * 3] * w[j];
          y += p[ids[j] * 3 + 1] * w[j];
          z += p[ids[j] * 3 + 2] * w[j];
        }
        lift = Math.max(lift, renderedGroundAt(x, z) + 0.025 - y);
      }
      if (lift > 0)
        ids.forEach((id) => {
          p[id * 3 + 1] += lift;
        });
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    return g;
  }, []);
  const shrinePath = useMemo(() => {
    const positions: number[] = [],
      uv: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const rows = 180,
      cols = 6;
    for (let i = 0; i <= rows; i++) {
      const t = i / rows,
        pt = shrinePathCurve.getPoint(t),
        tan = shrinePathCurve.getTangent(t),
        a = Math.max(0, t - 0.002),
        b = Math.min(1, t + 0.002);
      const turn = shrinePathCurve.getTangent(a).distanceTo(shrinePathCurve.getTangent(b)),
        distance = shrinePathCurve.getPoint(a).distanceTo(shrinePathCurve.getPoint(b));
      const w = Math.min(0.32 + Math.sin(t * 32) * 0.025, turn > 0.0001 ? (0.62 * distance) / turn : 0.35);
      for (let j = 0; j <= cols; j++) {
        const side = -1 + (2 * j) / cols,
          x = pt.x - tan.z * w * side,
          z = pt.z + tan.x * w * side;
        positions.push(x, renderedGroundAt(x, z) + 0.095, z);
        uv.push(j / cols, t * 5);
        const color = new T.Color(Math.abs(side) > 0.8 ? '#988264' : '#bda075').multiplyScalar(
          0.93 + rand(i * 7 + j) * 0.12,
        );
        colors.push(color.r, color.g, color.b);
      }
      if (i < rows)
        for (let j = 0; j < cols; j++) {
          const a = i * (cols + 1) + j;
          indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
        }
    }
    for (let i = 0; i < indices.length; i += 3) {
      const ids = [indices[i], indices[i + 1], indices[i + 2]];
      let lift = 0;
      for (const weights of [
        [1 / 3, 1 / 3, 1 / 3],
        [0.5, 0.5, 0],
        [0.5, 0, 0.5],
        [0, 0.5, 0.5],
      ]) {
        let x = 0,
          y = 0,
          z = 0;
        for (let j = 0; j < 3; j++) {
          x += positions[ids[j] * 3] * weights[j];
          y += positions[ids[j] * 3 + 1] * weights[j];
          z += positions[ids[j] * 3 + 2] * weights[j];
        }
        lift = Math.max(lift, renderedGroundAt(x, z) + 0.025 - y);
      }
      if (lift > 0)
        ids.forEach((id) => {
          positions[id * 3 + 1] += lift;
        });
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  const grit = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#e1d0ad';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 5500; i++) {
      ctx.fillStyle = i % 3 ? '#332d2138' : '#fff6cc4a';
      const s = 0.4 + rand(i + 442) * 2.4;
      ctx.fillRect(rand(i + 190) * 256, rand(i + 6500) * 256, s, s * 0.65);
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }, []);
  const sign = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#c7b894';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = '#796342';
    ctx.lineWidth = 7;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#544a34';
    ctx.font = 'bold 40px Georgia';
    ctx.fillText('MONK’S TRAIL', 256, 110);
    ctx.font = '24px sans-serif';
    ctx.fillText('DOI SUTHEP  ↗', 256, 166);
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => {
    if (!stones.current) return;
    const o = new T.Object3D();
    for (let i = 0; i < 280; i++) {
      const t = 0.04 + rand(i + 3300) * 0.92,
        pt = trailCurve.getPoint(t),
        tangent = trailCurve.getTangent(t),
        across = (rand(i + 3400) - 0.5) * 1.5;
      const x = pt.x - tangent.z * across,
        z = pt.z + tangent.x * across;
      o.position.set(x, renderedGroundAt(x, z) + 0.072, z);
      o.rotation.set((rand(i + 3500) - 0.5) * 0.45, rand(i + 3600) * 6, (rand(i + 3700) - 0.5) * 0.35);
      const s = 0.045 + rand(i + 3800) * 0.12;
      o.scale.set(s, 0.025 + rand(i + 3900) * 0.055, s * (0.65 + rand(i + 4000)));
      o.updateMatrix();
      stones.current.setMatrixAt(i, o.matrix);
      stones.current.setColorAt(i, new T.Color(i % 3 ? '#82745b' : '#9b896a'));
    }
    stones.current.instanceMatrix.needsUpdate = true;
    if (stones.current.instanceColor) stones.current.instanceColor.needsUpdate = true;
  }, []);
  useEffect(
    () => () => {
      path.dispose();
      shrinePath.dispose();
      sign.dispose();
      grit.dispose();
    },
    [path, shrinePath, sign, grit],
  );
  return (
    <>
      <mesh geometry={path} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={grit}
          bumpMap={grit}
          bumpScale={0.045}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh geometry={shrinePath} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={grit}
          bumpMap={grit}
          bumpScale={0.045}
          roughness={1}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <instancedMesh ref={stones} args={[undefined, undefined, 280]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <group position={gate.position} rotation={[0, gate.turn, 0]}>
        {[-1.1, 1.1].map((side, sideIndex) => (
          <group key={side} position={[side, gate.postY[sideIndex], 0]}>
            {[-0.16, 0, 0.16].map((offset, j) => (
              <group key={j}>
                <mesh position={[offset, 1.5, 0]} castShadow>
                  <cylinderGeometry args={[0.075, 0.09, 3, 9]} />
                  <meshStandardMaterial color={j % 2 ? '#a69b6f' : '#b9aa7e'} roughness={1} />
                </mesh>
                {Array.from({ length: 9 }, (_, i) => (
                  <mesh key={i} position={[offset, 0.15 + i * 0.33, 0]}>
                    <cylinderGeometry args={[0.087, 0.088, 0.035, 9]} />
                    <meshStandardMaterial color="#827d50" roughness={0.9} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        ))}
        {[2.75, 2.96].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.07, 0.08, 2.8, 10]} />
            <meshStandardMaterial color="#9c8e63" roughness={0.9} />
          </mesh>
        ))}
        <mesh position={[0, 2.33, 0.08]}>
          <boxGeometry args={[1.72, 0.84, 0.08]} />
          <meshStandardMaterial map={sign} roughness={1} />
        </mesh>
        <mesh position={[-1.1, 0.95, 0.11]}>
          <cylinderGeometry args={[0.14, 0.14, 0.55, 12]} />
          <meshStandardMaterial color="#c97636" roughness={1} />
        </mesh>
        <Box at={[1.58, 0.12, -0.24]} size={[1.25, 0.24, 0.75]} color="#777b60" />
        <Box at={[1.58, 0.44, -0.37]} size={[1.1, 0.09, 0.38]} color="#847151" />
      </group>
      {[0.2, 0.34, 0.48, 0.62, 0.76, 0.89].map((t, i) => {
        const pt = trailCurve.getPoint(t),
          tangent = trailCurve.getTangent(t),
          side = i % 2 ? 1 : -1,
          x = pt.x - tangent.z * 0.84 * side,
          z = pt.z + tangent.x * 0.84 * side;
        return (
          <group key={i} position={[x, renderedGroundAt(x, z), z]}>
            <mesh position={[0, 0.58, 0]} castShadow>
              <cylinderGeometry args={[0.042, 0.067, 1.16, 7]} />
              <meshStandardMaterial color="#6e6954" roughness={1} />
            </mesh>
            <mesh position={[0, 0.86, 0]}>
              <cylinderGeometry args={[0.074, 0.075, 0.23, 8]} />
              <meshStandardMaterial color="#d3853c" roughness={1} />
            </mesh>
            <mesh position={[0.13, 0.8, 0]} rotation={[0, tangent.x, 0.12]}>
              <planeGeometry args={[0.25, 0.12]} />
              <meshStandardMaterial color="#bc7138" side={T.DoubleSide} roughness={1} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function GoldBell({ at = [0, 0, 0], scale = 1 }: { at?: V; scale?: number }) {
  const profile = useMemo(
    () =>
      [
        [1.16, 0],
        [1.16, 0.15],
        [1, 0.2],
        [0.98, 0.34],
        [0.8, 0.42],
        [0.78, 0.53],
        [0.95, 0.62],
        [1.04, 0.78],
        [1.02, 0.92],
        [0.84, 1.16],
        [0.62, 1.47],
        [0.47, 1.8],
        [0.36, 2.12],
        [0.33, 2.34],
        [0.22, 2.42],
        [0.22, 2.6],
        [0.18, 2.66],
        [0.1, 3.16],
        [0.055, 3.65],
        [0, 4.04],
      ].map((p) => new T.Vector2(p[0], p[1])),
    [],
  );
  return (
    <group position={at} scale={scale}>
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          position={[0, 0.09 + i * 0.2, 0]}
          rotation={[0, Math.PI / 8, 0]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[1.54 - i * 0.12, 1.57 - i * 0.12, 0.18, 8]} />
          <meshStandardMaterial color={i % 2 ? '#c99736' : '#d8b45b'} metalness={0.6} roughness={0.37} />
        </mesh>
      ))}
      <mesh position={[0, 0.48, 0]} castShadow>
        <latheGeometry args={[profile, 48]} />
        <meshStandardMaterial color="#d4a52f" metalness={0.78} roughness={0.28} />
      </mesh>
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[0, 3.18 + i * 0.095, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.19 - i * 0.012, 0.022, 6, 32]} />
          <meshStandardMaterial color="#ebc65a" metalness={0.75} roughness={0.31} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[Math.sin((i * Math.PI) / 2) * 1.31, 0.58, Math.cos((i * Math.PI) / 2) * 1.31]}
          rotation={[0, (i * Math.PI) / 2, 0]}
        >
          <boxGeometry args={[0.32, 0.21, 0.07]} />
          <meshStandardMaterial color="#f2cf6d" metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function roofGeometry(width: number, depth: number, rise: number) {
  const p: number[] = [],
    uv: number[] = [],
    index: number[] = [];
  const sections = 16;
  for (let j = 0; j <= sections; j++) {
    const x = -width / 2 + (width * j) / sections,
      t = Math.abs(x) / (width / 2),
      y = rise * (1 - t) + 0.21 * t * t * t;
    for (let i = 0; i < 2; i++) {
      p.push(x, y, (i - 0.5) * depth);
      uv.push(j / sections, i);
    }
  }
  for (let j = 0; j < sections; j++) {
    const a = j * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function TempleHall() {
  const roofs = useMemo(
    () => [roofGeometry(3.3, 4.6, 1.33), roofGeometry(2.55, 3.35, 1.08), roofGeometry(1.8, 2.2, 0.9)],
    [],
  );
  const roofTexture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#963b2c';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 16)
      for (let x = 0; x < 256; x += 8) {
        ctx.fillStyle = rand(x + y) > 0.5 ? '#af5137' : '#893b29';
        ctx.fillRect(x, y, 7, 14);
        ctx.fillStyle = '#d27d4b';
        ctx.fillRect(x, y, 1, 13);
      }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }, []);
  useEffect(
    () => () => {
      roofs.forEach((g) => g.dispose());
      roofTexture.dispose();
    },
    [roofs, roofTexture],
  );
  return (
    <group position={[-3.7, 11.72, -13]}>
      <Box at={[0, 0.15, 0]} size={[3.3, 0.3, 4.7]} color="#c5b89a" />
      <Box at={[0, 1.2, -0.6]} size={[2.5, 1.85, 2.7]} color="#ece0bd" />
      <Box at={[0, 0.35, 1.95]} size={[2.4, 0.18, 0.5]} color="#c4ae82" />
      <Box at={[0, 0.23, 2.23]} size={[2.5, 0.15, 0.25]} color="#d1bc96" />
      <Box at={[0, 1.2, 0.775]} size={[1.2, 1.7, 0.06]} color="#6a3528" />
      <Box at={[0, 1.2, 0.81]} size={[0.055, 1.65, 0.035]} color="#d4b15c" />
      {[-1.25, 1.25].flatMap((x) =>
        [-1.7, -0.7, 0.4, 1.7].map((z) => (
          <group key={`${x},${z}`} position={[x, 0, z]}>
            <mesh position={[0, 1.27, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.11, 2.2, 12]} />
              <meshStandardMaterial color="#823b28" roughness={0.7} />
            </mesh>
            {[0.35, 0.65, 1.8, 2.2].map((y) => (
              <mesh key={y} position={[0, y, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.06, 12]} />
                <meshStandardMaterial color="#d8b65e" metalness={0.5} roughness={0.4} />
              </mesh>
            ))}
          </group>
        )),
      )}
      {roofs.map((g, i) => (
        <group key={i} position={[0, 2.24 + i * 0.54, -i * 0.2]}>
          <mesh geometry={g} castShadow receiveShadow>
            <meshStandardMaterial map={roofTexture} color="#c69b69" side={T.DoubleSide} roughness={0.75} />
          </mesh>
          {[-1, 1].map((side) => (
            <Tube
              key={side}
              points={Array.from({ length: 17 }, (_, j) => {
                const w = [3.3, 2.55, 1.8][i],
                  d = [4.6, 3.35, 2.2][i],
                  r = [1.33, 1.08, 0.9][i],
                  x = -w / 2 + (w * j) / 16,
                  t = Math.abs(x) / (w / 2);
                return [x, r * (1 - t) + 0.21 * t * t * t + 0.02, (side * d) / 2] as V;
              })}
              radius={0.035}
              color="#e0ba5d"
              metalness={0.65}
            />
          ))}
          {[-1, 1].map((side) => (
            <Tube
              key={side + 'finial'}
              points={[
                [0, [1.33, 1.08, 0.9][i], side * [2.3, 1.675, 1.1][i]],
                [0, [1.33, 1.08, 0.9][i] + 0.16, side * ([2.3, 1.675, 1.1][i] + 0.11)],
                [0, [1.33, 1.08, 0.9][i] + 0.47, side * ([2.3, 1.675, 1.1][i] + 0.2)],
                [0, [1.33, 1.08, 0.9][i] + 0.68, side * ([2.3, 1.675, 1.1][i] + 0.13)],
              ]}
              radius={0.045}
              color="#d7ad46"
              metalness={0.6}
            />
          ))}
        </group>
      ))}
    </group>
  );
}

function MountainTemple(_: { night: boolean }) {
  const lantern = useMemo(
    () =>
      new T.MeshStandardMaterial({
        color: '#f0c87b',
        emissive: '#f3b861',
        emissiveIntensity: 0,
        roughness: 0.55,
      }),
    [],
  );
  useFrame(() => {
    lantern.emissiveIntensity = resortAtmosphere.lamps * 1.8;
  });
  useEffect(() => () => lantern.dispose(), [lantern]);
  const paving = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#d6c7a3';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 32)
      for (let x = 0; x < 256; x += 32) {
        ctx.fillStyle = rand(x + y * 18) > 0.5 ? '#d1c29f' : '#dfd1af';
        ctx.fillRect(x + 1, y + 1, 30, 30);
      }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    t.repeat.set(3, 2);
    return t;
  }, []);
  useEffect(() => () => paving.dispose(), [paving]);
  return (
    <group position={[-7, SUMMIT_Y, -13]} scale={TEMPLE_SCALE}>
      <group position={[7, -11.72, 13]}>
        <Box at={[-7, 11.35, -13]} size={[11, 0.7, 7.6]} color="#a69b7a" />
        <mesh position={[-7, 11.72, -13]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[10.9, 7.5]} />
          <meshStandardMaterial map={paving} roughness={0.9} />
        </mesh>
        <GoldBell at={[-9.1, 11.73, -13.5]} scale={1.02} />
        <TempleHall />
        {[-11.9, -2.1].flatMap((x) =>
          [-16.35, -9.55].map((z) => <GoldBell key={`${x},${z}`} at={[x, 11.73, z]} scale={0.18} />),
        )}
        {[-12.3, -1.7].map((x) => (
          <group key={x}>
            <Box at={[x, 11.93, -13]} size={[0.15, 0.37, 7.3]} color="#d7caab" />
            <Box at={[x, 12.38, -13]} size={[0.12, 0.09, 7.3]} color="#d0ac54" />
            {Array.from({ length: 25 }, (_, i) => (
              <mesh key={i} position={[x, 12.2, -16.5 + i * 0.29]}>
                <cylinderGeometry args={[0.025, 0.03, 0.4, 6]} />
                <meshStandardMaterial color="#c5a149" metalness={0.45} />
              </mesh>
            ))}
          </group>
        ))}
        <Box at={[-7, 11.93, -16.65]} size={[10.6, 0.37, 0.15]} color="#d7caab" />
        <Box at={[-7, 12.38, -16.65]} size={[10.6, 0.09, 0.12]} color="#d0ac54" />
        {Array.from({ length: 37 }, (_, i) => (
          <mesh key={i} position={[-12.2 + i * 0.29, 12.2, -16.65]}>
            <cylinderGeometry args={[0.025, 0.03, 0.4, 6]} />
            <meshStandardMaterial color="#c5a149" metalness={0.45} />
          </mesh>
        ))}
        <group position={[-2.2, 11.76, -10.1]}>
          <Box at={[-0.55, 0.8, 0]} size={[0.065, 1.6, 0.065]} color="#9e793f" />
          <Box at={[0.55, 0.8, 0]} size={[0.065, 1.6, 0.065]} color="#9e793f" />
          <Box at={[0, 1.6, 0]} size={[1.3, 0.065, 0.065]} color="#b38a43" />
          {[-0.4, 0, 0.4].map((x) => (
            <group key={x} position={[x, 1.28, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.075, 0.13, 0.2, 20, 1, true]} />
                <meshStandardMaterial color="#a88d53" metalness={0.7} roughness={0.36} side={T.DoubleSide} />
              </mesh>
              <mesh position={[0, -0.13, 0]}>
                <sphereGeometry args={[0.034, 8, 6]} />
                <meshStandardMaterial color="#bba56b" metalness={0.6} />
              </mesh>
              <Tube
                points={[
                  [0, 0.1, 0],
                  [0, 0.24, 0],
                  [0, 0.3, 0],
                ]}
                radius={0.009}
                color="#735b34"
              />
            </group>
          ))}
        </group>
        {[-11.8, -2.2].map((x) => (
          <group key={x} position={[x, 11.73, -11]}>
            <Box at={[0, 0.46, 0]} size={[0.045, 0.92, 0.045]} color="#9b773f" />
            <mesh position={[0, 1.04, 0]} material={lantern}>
              <cylinderGeometry args={[0.13, 0.13, 0.28, 8]} />
            </mesh>
            <mesh position={[0, 1.23, 0]}>
              <coneGeometry args={[0.19, 0.14, 8]} />
              <meshStandardMaterial color="#8d6437" metalness={0.3} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export default function ChiangMaiScene({ night, onSelect }: Props) {
  return (
    <group position={ORIGIN}>
      <Terrain />
      <Forest />
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect('trail');
        }}
      >
        <Trail />
      </group>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect('suthep');
        }}
      >
        <MountainTemple night={night} />
      </group>
      <ChiangMaiTown night={night} onSelect={onSelect} forestTemplePosition={MID_SHRINE_POSITION} />
    </group>
  );
}
