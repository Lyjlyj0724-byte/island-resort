import { regionOrigins } from './regionLayout';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import ElectricScooter from './ElectricScooter';
import LiRiverWater from './LiRiverWater';
import LiRiverBanks from './LiRiverBanks';
import { riverCenter, riverHalfWidth, riverEdge } from './riverLayout';

type V = [number, number, number];
type YangshuoSpot = 'river' | 'karst' | 'climb' | 'scooter';
type Props = { night: boolean; onSelect: (id: YangshuoSpot) => void };

// This is a memory landscape, sharing the resort's world-unit scale. All
// geometry and water detail are local and deterministic; no remote assets.
const ORIGIN = regionOrigins.yangshuo;
const random = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function planShape(points: [number, number][]) {
  const curve = new T.CatmullRomCurve3(
    points.map(([x, z]) => new T.Vector3(x, -z, 0)),
    true,
    'centripetal',
  );
  const s = new T.Shape();
  curve.getPoints(150).forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  s.closePath();
  return s;
}

function stoneTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b5b6a4';
  ctx.fillRect(0, 0, 512, 512);
  // Long pale weathering streaks, hairline fissures, and fine limestone grain.
  for (let i = 0; i < 170; i++) {
    const x = random(i + 2) * 512,
      y = random(i + 1000) * 512;
    ctx.strokeStyle = i % 3 ? 'rgba(40,47,39,.19)' : 'rgba(244,239,214,.39)';
    ctx.lineWidth = 0.6 + random(i + 2000) * 4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + 5, y + 40, x - 3, y + 110, x + 2, y + 180);
    ctx.stroke();
  }
  for (let i = 0; i < 18000; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(24,42,28,.10)' : 'rgba(255,255,226,.13)';
    ctx.fillRect(random(i + 5000) * 512, random(i + 27000) * 512, 1, 1 + random(i + 53000) * 3);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function meadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#849367';
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 360; i++) {
    const x = random(i + 400) * 512,
      y = random(i + 1600) * 512,
      r = 8 + random(i + 2300) * 40;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, i % 3 ? 'rgba(48,71,33,.22)' : 'rgba(178,166,117,.28)');
    gradient.addColorStop(1, 'rgba(100,110,70,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 17000; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(35,56,22,.12)' : 'rgba(211,201,148,.16)';
    ctx.fillRect(random(i + 700) * 512, random(i + 23000) * 512, 1, 1 + random(i + 44000) * 2);
  }
  const t = new T.CanvasTexture(canvas);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(0.055, 0.055);
  t.anisotropy = 4;
  return t;
}

function foliageGeometry() {
  const g = new T.IcosahedronGeometry(1, 3),
    p = g.getAttribute('position'),
    colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i);
    const lobes = Math.sin(x * 6.3 + y * 2) * Math.sin(z * 5.2 - y * 3.7) * 0.19;
    const leaves = Math.sin(x * 27.1 + z * 3.8) * Math.sin(y * 24.7 - z * 18.2) * 0.1;
    const r = 1 + lobes + leaves;
    p.setXYZ(i, x * r, y * r, z * r);
    const shade = 0.64 + (0.5 + 0.5 * Math.sin(x * 23.3 + z * 11.4) * Math.sin(y * 25.1 - x * 5)) * 0.35;
    colors.push(shade, shade, shade * 0.88);
  }
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

function Box({ at, size, color, rotation = 0 }: { at: V; size: V; color: string; rotation?: number }) {
  return (
    <mesh position={at} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.82} />
    </mesh>
  );
}

function Rod({ from, to, radius, color }: { from: V; to: V; radius: number; color: string }) {
  const start = new T.Vector3(...from),
    end = new T.Vector3(...to);
  const delta = end.clone().sub(start);
  return (
    <mesh
      position={start.add(end).multiplyScalar(0.5)}
      quaternion={new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize())}
      castShadow
    >
      <cylinderGeometry args={[radius, radius, delta.length(), 8]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

function LandscapeBase() {
  const shape = useMemo(
    () =>
      planShape([
        [-16, -20],
        [-7, -23],
        [8, -22],
        [16, -17],
        [18, -5],
        [16, 9],
        [11, 18],
        [0, 21],
        [-12, 18],
        [-17, 7],
        [-18, -7],
      ]),
    [],
  );
  const meadow = useMemo(meadowTexture, []);
  useEffect(() => () => meadow.dispose(), [meadow]);
  return (
    <>
      <mesh position={[0, -0.55, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow castShadow>
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 1.04,
              bevelEnabled: true,
              bevelSize: 0.65,
              bevelThickness: 0.16,
              bevelSegments: 3,
              curveSegments: 36,
            },
          ]}
        />
        <meshStandardMaterial color="#71765b" roughness={1} />
      </mesh>
      <mesh position={[0, 0.7, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <shapeGeometry args={[shape, 36]} />
        <meshStandardMaterial color="#b1bd99" map={meadow} bumpMap={meadow} bumpScale={0.035} roughness={1} />
      </mesh>
    </>
  );
}

type Peak = { at: V; radius: number; height: number; seed: number; stretch?: number };
const peaks: Peak[] = [
  { at: [-10, 0.75, -13], radius: 5.3, height: 20.2, seed: 3, stretch: 0.87 },
  { at: [-5, 0.75, -19], radius: 3.7, height: 15.8, seed: 8, stretch: 0.8 },
  { at: [6.8, 0.75, -14], radius: 4.3, height: 17.8, seed: 13, stretch: 0.9 },
  { at: [12, 0.75, -8], radius: 4.8, height: 13.5, seed: 24, stretch: 0.76 },
  { at: [-13, 0.75, -2], radius: 4.6, height: 12.2, seed: 33, stretch: 0.85 },
  { at: [11, 0.75, 1.5], radius: 3.6, height: 8.7, seed: 42, stretch: 0.8 },
  { at: [1.9, 0.75, -21], radius: 2.6, height: 12.8, seed: 54, stretch: 0.85 },
];

function peakRadius(t: number, angle: number, seed: number) {
  // Towers keep their steep flanks until the upper shoulder, with a rounded,
  // asymmetric crown instead of a cone silhouette.
  const shoulder = t < 0.68 ? 1 - t * 0.26 : Math.pow(Math.max(0, 1 - (t - 0.68) / 0.32), 0.51) * 0.823;
  const ribs = Math.sin(angle * 7 + seed) * 0.064 + Math.sin(angle * 13 - seed * 0.3) * 0.032;
  const ledges = Math.sin(t * 28 + angle * 3 + seed) * 0.033 + Math.sin(t * 73 - angle * 5) * 0.012;
  const buttresses = Math.sin(angle * 3.2 + seed + t * 2) * 0.085 + Math.sin(angle * 5 - seed + t * 4) * 0.04;
  return shoulder * (1 + ribs + ledges + buttresses) * (0.94 + Math.sin(angle * 3 + seed) * 0.065);
}

function peakGeometry(peak: Peak) {
  const rows = 50,
    columns = 96,
    p: number[] = [],
    uv: number[] = [],
    colors: number[] = [],
    indices: number[] = [];
  const rock = new T.Color('#b3b4a8'),
    deepRock = new T.Color('#59685f'),
    green = new T.Color('#405b36'),
    brightGreen = new T.Color('#697e4c');
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    for (let c = 0; c <= columns; c++) {
      const angle = (c / columns) * Math.PI * 2,
        rad = peakRadius(t, angle, peak.seed) * peak.radius;
      const offsetX = Math.sin(t * 2.4 + peak.seed) * t * 0.8,
        offsetZ = Math.sin(t * 3 + peak.seed * 2) * t * 0.65;
      p.push(
        Math.cos(angle) * rad + offsetX,
        t * peak.height,
        Math.sin(angle) * rad * (peak.stretch ?? 1) + offsetZ,
      );
      uv.push((c / columns) * 3, t * 2.3);
      const rough =
        0.5 + Math.sin(angle * 35 + peak.seed + Math.sin(t * 19) * 0.6) * Math.sin(t * 87 + angle * 3) * 0.5;
      const bareFace = Math.sin(angle * 1.7 + peak.seed * 0.65) + Math.sin(t * 10 + angle * 4) * 0.22;
      const vegetation = Math.max(
        T.MathUtils.smoothstep(t, 0.67, 0.84),
        T.MathUtils.smoothstep(bareFace, 0.18, 0.58),
        1 - T.MathUtils.smoothstep(t, 0.06, 0.16),
      );
      const color = deepRock
        .clone()
        .lerp(rock, rough * 0.39 + 0.18)
        .lerp(green.clone().lerp(brightGreen, rough * 0.6), vegetation);
      color.multiplyScalar(0.92 + Math.sin(angle * 31 + peak.seed) * 0.07);
      colors.push(color.r, color.g, color.b);
      if (r < rows && c < columns) {
        const a = r * (columns + 1) + c,
          b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

function LimestonePeaks() {
  const geometries = useMemo(() => peaks.map(peakGeometry), []);
  const texture = useMemo(stoneTexture, []);
  useEffect(
    () => () => {
      geometries.forEach((g) => g.dispose());
      texture.dispose();
    },
    [geometries, texture],
  );
  return (
    <>
      {peaks.map((peak, i) => (
        <mesh key={peak.seed} geometry={geometries[i]} position={peak.at} castShadow receiveShadow>
          <meshStandardMaterial
            vertexColors
            map={texture}
            bumpMap={texture}
            bumpScale={0.16}
            roughness={0.98}
          />
        </mesh>
      ))}
    </>
  );
}

function Greenery() {
  const leaves = useRef<T.InstancedMesh>(null),
    trunks = useRef<T.InstancedMesh>(null);
  const leafGeometry = useMemo(foliageGeometry, []);
  useEffect(() => () => leafGeometry.dispose(), [leafGeometry]);
  const placement = useMemo(() => {
    const shrubs: { at: V; scale: V; color: string }[] = [],
      trees: { at: V; scale: V; color: string }[] = [];
    // Rounded small tree crowns break up the rock silhouette and form terraces
    // of greenery without hundreds of independent draw calls.
    for (const peak of peaks) {
      for (let i = 0; i < 230; i++) {
        const t = 0.08 + random(peak.seed * 600 + i) * 0.87,
          angle = random(peak.seed * 900 + i) * Math.PI * 2;
        const face = Math.sin(angle * 1.7 + peak.seed * 0.65) + Math.sin(t * 10 + angle * 4) * 0.22;
        if (t < 0.73 && face < 0.26) continue;
        const r = peakRadius(t, angle, peak.seed) * peak.radius;
        const at: V = [
          peak.at[0] + Math.cos(angle) * r + Math.sin(t * 2.4 + peak.seed) * t * 0.8,
          peak.at[1] + t * peak.height,
          peak.at[2] + Math.sin(angle) * r * (peak.stretch ?? 1) + Math.sin(t * 3 + peak.seed * 2) * t * 0.65,
        ];
        const s = 0.12 + random(i + peak.seed * 31) * 0.24;
        shrubs.push({ at, scale: [s * 1.45, s * 0.78, s * 1.3], color: i % 3 ? '#527341' : '#738a4f' });
      }
    }
    for (let i = 0; i < 180; i++) {
      const z = -18 + random(i + 331) * 34,
        side = i % 2 ? 1 : -1;
      const x = riverEdge(z, side) + side * (0.55 + random(i + 99) * 6.3);
      if (z > 8 && side > 0) continue;
      if (z > 8 && z < 15 && x > -4.4 && side < 0) continue;
      if (
        peaks.some(
          (p) => Math.hypot((x - p.at[0]) / p.radius, (z - p.at[2]) / (p.radius * (p.stretch ?? 1))) < 0.94,
        )
      )
        continue;
      const h = 0.65 + random(i + 919) * 1.45;
      trees.push({ at: [x, 0.76 + h * 0.46, z], scale: [0.055, h, 0.055], color: '#746b50' });
      for (let crown = 0; crown < 4; crown++) {
        const turn = crown * 2.4 + i;
        shrubs.push({
          at: [
            x + Math.cos(turn) * h * 0.23,
            0.8 + h * (0.82 + random(i + crown + 39) * 0.32),
            z + Math.sin(turn) * h * 0.24,
          ],
          scale: [h * 0.29, h * (0.25 + random(i + crown + 79) * 0.12), h * 0.31],
          color: (i + crown) % 3 ? '#5f7c46' : '#85985c',
        });
      }
    }
    for (let i = 0; i < 70; i++) {
      const z = -17 + random(i + 730) * 33,
        side = i % 2 ? 1 : -1,
        x = riverEdge(z, side) + side * (0.35 + random(i + 190) * 0.55);
      shrubs.push({
        at: [x, 0.82, z],
        scale: [0.13 + random(i + 56) * 0.25, 0.12 + random(i + 67) * 0.17, 0.17 + random(i + 98) * 0.28],
        color: i % 2 ? '#657b43' : '#7f8b52',
      });
    }
    return { shrubs, trees };
  }, []);
  useEffect(() => {
    const object = new T.Object3D(),
      color = new T.Color();
    for (const [ref, items] of [
      [leaves, placement.shrubs],
      [trunks, placement.trees],
    ] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      items.forEach((item, i) => {
        object.position.set(...item.at);
        object.scale.set(...item.scale);
        object.rotation.set((random(i + 52) - 0.5) * 0.5, random(i) * 6, (random(i + 98) - 0.5) * 0.4);
        object.updateMatrix();
        mesh.setMatrixAt(i, object.matrix);
        mesh.setColorAt(i, color.set(item.color));
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [placement]);
  return (
    <>
      <instancedMesh
        ref={leaves}
        args={[leafGeometry, undefined, placement.shrubs.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial vertexColors roughness={1} />
      </instancedMesh>
      <instancedMesh ref={trunks} args={[undefined, undefined, placement.trees.length]} castShadow>
        <cylinderGeometry args={[1, 1.15, 1, 6]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
    </>
  );
}

function Cormorant({ at, turn = 0 }: { at: V; turn?: number }) {
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.23, 0]} scale={[0.12, 0.23, 0.14]} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#252d2a" roughness={0.62} />
      </mesh>
      <Rod from={[0, 0.31, -0.025]} to={[0.025, 0.52, -0.09]} radius={0.044} color="#27332d" />
      <mesh position={[0.025, 0.54, -0.09]} scale={[0.07, 0.075, 0.09]}>
        <sphereGeometry args={[1, 10, 8]} />
        <meshStandardMaterial color="#242f2b" />
      </mesh>
      <mesh position={[0.025, 0.525, -0.205]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.024, 0.15, 8]} />
        <meshStandardMaterial color="#bba777" />
      </mesh>
      <mesh position={[0, 0.13, 0.16]} rotation={[0.65, 0, 0]} scale={[0.08, 0.04, 0.18]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshStandardMaterial color="#202823" />
      </mesh>
      <Rod from={[-0.045, 0.08, 0]} to={[-0.045, 0, -0.06]} radius={0.012} color="#393d2d" />
      <Rod from={[0.045, 0.08, 0]} to={[0.045, 0, -0.06]} radius={0.012} color="#393d2d" />
    </group>
  );
}

function BambooRaft() {
  const group = useRef<T.Group>(null);
  useFrame(({ clock }) => {
    if (group.current) {
      group.current.position.y = 0.87 + Math.sin(clock.elapsedTime * 0.7) * 0.035;
      group.current.rotation.z = Math.sin(clock.elapsedTime * 0.55) * 0.008;
    }
  });
  return (
    <group ref={group} position={[0.2, 0.87, 11.4]} rotation={[0, -0.2, 0]}>
      {Array.from({ length: 10 }, (_, i) => (
        <group key={i}>
          <mesh position={[(i - 4.5) * 0.14, 0, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <cylinderGeometry args={[0.073, 0.082, 3.7 + (i % 3) * 0.08, 10]} />
            <meshStandardMaterial color={i % 3 ? '#a4974c' : '#b6a85e'} roughness={0.84} />
          </mesh>
          {[-1.35, -0.55, 0.4, 1.25].map((z) => (
            <mesh key={z} position={[(i - 4.5) * 0.14, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.078, 0.008, 4, 10]} />
              <meshStandardMaterial color="#6f713e" />
            </mesh>
          ))}
        </group>
      ))}
      {[-1.3, 1.25].map((z) => (
        <Rod key={z} from={[-0.73, 0.09, z]} to={[0.73, 0.09, z]} radius={0.027} color="#514b32" />
      ))}
      <Box at={[0, 0.28, -0.22]} size={[0.7, 0.07, 0.65]} color="#8b714a" />
      <Box at={[0, 0.52, -0.5]} size={[0.7, 0.42, 0.055]} color="#85714a" />
      {[-0.28, 0.28].flatMap((x) =>
        [-0.45, 0.02].map((z) => (
          <Box key={`${x}/${z}`} at={[x, 0.16, z]} size={[0.045, 0.28, 0.045]} color="#6a5b3f" />
        )),
      )}
      <Rod from={[0.88, 0.12, -1.85]} to={[0.85, 0.14, 1.95]} radius={0.025} color="#b9a16a" />
      {[-0.5, 0, 0.5].map((x, i) => (
        <Cormorant key={x} at={[x, 0.09, 1.3 - i * 0.13]} turn={-0.35 + i * 0.5} />
      ))}
    </group>
  );
}

function RiversidePath() {
  const pavers = useRef<T.InstancedMesh>(null);
  useEffect(() => {
    if (!pavers.current) return;
    const object = new T.Object3D(),
      color = new T.Color();
    let index = 0;
    for (let row = 0; row < 32; row++) {
      const z = -3 + row * 0.64;
      const center = riverCenter(z) + riverHalfWidth(z) + 1.65;
      for (let col = 0; col < 3; col++) {
        object.position.set(center + (col - 1) * 0.53 + (row % 2) * 0.12, 0.84, z);
        object.rotation.set(0, Math.cos(z * 0.105) * 0.11, 0);
        object.scale.set(0.49, 0.1, 0.59);
        object.updateMatrix();
        pavers.current.setMatrixAt(index, object.matrix);
        pavers.current.setColorAt(index, color.set(row % 3 ? '#b9b5a0' : '#cac5ae'));
        index++;
      }
    }
    pavers.current.instanceMatrix.needsUpdate = true;
    if (pavers.current.instanceColor) pavers.current.instanceColor.needsUpdate = true;
    pavers.current.computeBoundingSphere();
  }, []);
  return (
    <>
      <instancedMesh ref={pavers} args={[undefined, undefined, 96]} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial roughness={0.96} />
      </instancedMesh>
      <Box at={[9, 0.79, 11]} size={[3.3, 0.14, 3.2]} color="#a4a68e" />
    </>
  );
}

function ClimbingCorner() {
  const rope = useMemo(
    () =>
      new T.CatmullRomCurve3([
        new T.Vector3(-10.5, 5.1, 0.4),
        new T.Vector3(-10.2, 3.5, 1.25),
        new T.Vector3(-10.1, 1.04, 2.1),
        new T.Vector3(-8.6, 0.85, 3.3),
      ]),
    [],
  );
  return (
    <>
      <mesh>
        <tubeGeometry args={[rope, 48, 0.018, 6, false]} />
        <meshStandardMaterial color="#d3a65c" roughness={0.86} />
      </mesh>
      <mesh position={[-10.5, 5.1, 0.4]} rotation={[0, 0.5, 0]}>
        <torusGeometry args={[0.085, 0.012, 6, 12]} />
        <meshStandardMaterial color="#a7b9b4" metalness={0.7} roughness={0.35} />
      </mesh>
      <group position={[-8.6, 0.86, 3.3]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, i * 0.3]} position={[0, i * 0.012, 0]}>
            <torusGeometry args={[0.3 + i * 0.035, 0.018, 6, 32]} />
            <meshStandardMaterial color="#cb9f5b" />
          </mesh>
        ))}
      </group>
      <mesh position={[-9.1, 1.09, 3.8]} scale={[0.22, 0.3, 0.15]} castShadow>
        <sphereGeometry args={[1, 12, 10]} />
        <meshStandardMaterial color="#af674d" roughness={0.9} />
      </mesh>
    </>
  );
}

export default function YangshuoScene({ onSelect, night }: Props) {
  return (
    <group position={ORIGIN}>
      <LandscapeBase />
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect('karst');
        }}
      >
        <LimestonePeaks />
      </group>
      <Greenery />
      <LiRiverBanks />
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect('river');
        }}
      >
        <LiRiverWater night={night} />
        <BambooRaft />
      </group>
      <RiversidePath />
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect('scooter');
        }}
      >
        <group position={[9, 0.86, 11]} rotation={[0, -0.7, 0]}>
          <ElectricScooter />
        </group>
      </group>
      <group
        onClick={(e) => {
          e.stopPropagation();
          onSelect('climb');
        }}
      >
        <ClimbingCorner />
      </group>
    </group>
  );
}
