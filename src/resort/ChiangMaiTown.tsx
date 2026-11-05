import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as T from 'three';
import { useFrame } from '@react-three/fiber';
import { resortAtmosphere } from './dayCycle';
import UmongScene from './UmongScene';

type V = [number, number, number];
type ChiangMaiSpot = 'suthep' | 'trail' | 'temple' | 'san' | 'taste' | 'foresttemple';
type Props = { night: boolean; onSelect: (id: ChiangMaiSpot) => void; forestTemplePosition: V };
type Part = { p: V; s: V; r?: V };
const rand = (n: number) => {
  const v = Math.sin(n * 127.1 + 76.2) * 43758.5453;
  return v - Math.floor(v);
};

function texture(kind: 'brick' | 'wood' | 'plaster' | 'cloth' | 'sign') {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = kind === 'sign' ? 128 : 512;
  const x = c.getContext('2d')!;
  if (kind === 'sign') {
    x.fillStyle = '#242f2c';
    x.fillRect(0, 0, 512, 128);
    x.strokeStyle = '#a98b58';
    x.lineWidth = 2;
    x.strokeRect(9, 9, 494, 110);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.font = '500 54px Georgia,serif';
    x.fillStyle = '#f9dfae';
    x.fillText('BAR SAN', 256, 56);
    x.font = '15px sans-serif';
    x.fillStyle = '#bfa47a';
    x.fillText('CHIANG MAI', 256, 98);
  } else if (kind === 'brick') {
    x.fillStyle = '#695f48';
    x.fillRect(0, 0, 512, 512);
    for (let row = -1; row < 17; row++)
      for (let col = -1; col < 9; col++) {
        const k = row * 19 + col + 99,
          b = rand(k),
          px = col * 64 + (row % 2) * 32,
          py = row * 32;
        x.fillStyle = `rgb(${104 + b * 53},${65 + b * 36},${42 + b * 27})`;
        x.fillRect(px + 1, py + 1, 61, 29);
        x.fillStyle = 'rgba(235,193,139,.15)';
        x.fillRect(px + 2, py + 2, 59, 2);
        if (b > 0.67) {
          x.fillStyle = 'rgba(41,57,35,.32)';
          x.fillRect(px + 3, py + 21, 58, 7);
        }
      }
    for (let i = 0; i < 16000; i++) {
      x.fillStyle = i % 2 ? 'rgba(28,27,19,.14)' : 'rgba(236,216,169,.15)';
      x.fillRect(rand(i + 5) * 512, rand(i + 16010) * 512, 1 + rand(i + 50) * 2, 1);
    }
  } else if (kind === 'cloth') {
    x.fillStyle = '#a94335';
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i <= 512; i += 64) {
      x.fillStyle = '#394955';
      x.fillRect(i, 0, 4, 512);
      x.fillRect(0, i, 512, 4);
      x.fillStyle = '#e59b6c';
      x.fillRect(i + 7, 0, 1, 512);
      x.fillRect(0, i + 7, 512, 1);
    }
    for (let i = 0; i < 512; i += 3) {
      x.fillStyle = 'rgba(255,233,193,.045)';
      x.fillRect(i, 0, 1, 512);
    }
  } else {
    x.fillStyle = kind === 'wood' ? '#9a7653' : '#d4c7a3';
    x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 12000; i++) {
      x.fillStyle = i % 2 ? 'rgba(255,245,219,.09)' : 'rgba(51,42,26,.10)';
      x.fillRect(
        rand(i + 30) * 512,
        rand(i + 27000) * 512,
        kind === 'wood' ? 1 : 2,
        kind === 'wood' ? 12 + rand(i + 55000) * 60 : 2,
      );
    }
    if (kind === 'wood')
      for (let i = 0; i < 125; i++) {
        const px = rand(i + 900) * 512;
        x.strokeStyle = 'rgba(49,28,16,.14)';
        x.beginPath();
        x.moveTo(px, 0);
        x.bezierCurveTo(px + 8, 190, px - 9, 340, px + 3, 512);
        x.stroke();
      }
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

function Batch({ parts, material }: { parts: Part[]; material: T.Material }) {
  const ref = useRef<T.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new T.Matrix4(),
      q = new T.Quaternion();
    parts.forEach((p, i) => {
      q.setFromEuler(new T.Euler(...(p.r ?? [0, 0, 0])));
      m.compose(new T.Vector3(...p.p), q, new T.Vector3(...p.s));
      ref.current!.setMatrixAt(i, m);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, parts.length]} castShadow receiveShadow>
      <boxGeometry />
    </instancedMesh>
  );
}
function Box({ at, size, mat, rot = [0, 0, 0] }: { at: V; size: V; mat: T.Material; rot?: V }) {
  return (
    <mesh position={at} rotation={rot} material={mat} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}
function Brick({ at, size, mat }: { at: V; size: V; mat: T.Material }) {
  const geo = useMemo(() => {
    const g = new T.BoxGeometry(...size),
      p = g.getAttribute('position'),
      n = g.getAttribute('normal'),
      uv = g.getAttribute('uv');
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)),
        ny = Math.abs(n.getY(i));
      uv.setXY(i, (nx > 0.5 ? p.getZ(i) : p.getX(i)) / 3.2, (ny > 0.5 ? p.getZ(i) : p.getY(i)) / 1.6);
    }
    return g;
  }, [...size]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh position={at} geometry={geo} material={mat} castShadow receiveShadow />;
}
function Tube({ points, radius, mat }: { points: V[]; radius: number; mat: T.Material }) {
  const geo = useMemo(
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        32,
        radius,
        8,
        false,
      ),
    [points, radius],
  );
  useEffect(() => () => geo.dispose(), [geo]);
  return <mesh geometry={geo} material={mat} castShadow />;
}
function useMaterials() {
  const m = useMemo(() => {
    const brick = texture('brick'),
      wood = texture('wood'),
      plaster = texture('plaster'),
      cloth = texture('cloth'),
      sign = texture('sign');
    return {
      brick: new T.MeshStandardMaterial({
        map: brick,
        bumpMap: brick,
        bumpScale: 0.032,
        color: '#c7ac91',
        roughness: 1,
      }),
      stone: new T.MeshStandardMaterial({
        map: plaster,
        bumpMap: plaster,
        bumpScale: 0.022,
        color: '#8c8c75',
        roughness: 1,
      }),
      moss: new T.MeshStandardMaterial({ color: '#526044', roughness: 1 }),
      plaster: new T.MeshStandardMaterial({
        map: plaster,
        bumpMap: plaster,
        bumpScale: 0.012,
        color: '#f0e6d4',
        roughness: 0.92,
      }),
      wood: new T.MeshStandardMaterial({
        map: wood,
        bumpMap: wood,
        bumpScale: 0.012,
        color: '#b09771',
        roughness: 0.7,
      }),
      walnut: new T.MeshStandardMaterial({
        map: wood,
        bumpMap: wood,
        bumpScale: 0.015,
        color: '#72513c',
        roughness: 0.72,
      }),
      dark: new T.MeshStandardMaterial({ color: '#283631', roughness: 0.72 }),
      metal: new T.MeshStandardMaterial({ color: '#4b504a', metalness: 0.58, roughness: 0.43 }),
      brass: new T.MeshStandardMaterial({ color: '#bd9b57', metalness: 0.6, roughness: 0.4 }),
      roof: new T.MeshStandardMaterial({ color: '#805848', roughness: 0.88 }),
      cream: new T.MeshStandardMaterial({ color: '#eee5d4', roughness: 0.82 }),
      ceramic: new T.MeshStandardMaterial({ color: '#f7eedb', roughness: 0.23 }),
      terracotta: new T.MeshStandardMaterial({ color: '#aa7054', roughness: 0.96 }),
      green: new T.MeshStandardMaterial({ color: '#476b3f', roughness: 0.9 }),
      glass: new T.MeshPhysicalMaterial({
        color: '#cce6d3',
        transparent: true,
        opacity: 0.29,
        roughness: 0.06,
        metalness: 0.13,
        side: T.DoubleSide,
      }),
      ice: new T.MeshPhysicalMaterial({
        color: '#e7f4e6',
        transparent: true,
        opacity: 0.55,
        roughness: 0.12,
      }),
      drink: new T.MeshPhysicalMaterial({
        color: '#d8ca7c',
        transparent: true,
        opacity: 0.78,
        roughness: 0.18,
      }),
      mango: new T.MeshStandardMaterial({ color: '#f7bb22', roughness: 0.48 }),
      cloth: new T.MeshStandardMaterial({ map: cloth, roughness: 1 }),
      sign: new T.MeshStandardMaterial({
        map: sign,
        emissiveMap: sign,
        emissive: '#e0c29a',
        emissiveIntensity: 0.2,
        roughness: 0.7,
      }),
      bulb: new T.MeshStandardMaterial({ color: '#ffe5b6', emissive: '#ffba70', emissiveIntensity: 0.4 }),
      maps: [brick, wood, plaster, cloth, sign],
    };
  }, []);
  useEffect(
    () => () => {
      for (const [key, value] of Object.entries(m)) {
        if (key === 'maps') m.maps.forEach((t) => t.dispose());
        else (value as T.Material).dispose();
      }
    },
    [m],
  );
  return m;
}
type Mats = ReturnType<typeof useMaterials>;

function Naga({ side, m }: { side: number; m: Mats }) {
  const x = side * 1.47;
  return (
    <group>
      <Tube
        points={[
          [x, 0.35, 5.6],
          [x, 0.52, 4.9],
          [x, 1.2, 3.9],
          [x, 2, 2.8],
          [x, 2.78, 1.85],
        ]}
        radius={0.12}
        mat={m.stone}
      />
      <Tube
        points={[
          [x, 0.45, 5.6],
          [x, 0.95, 5.65],
          [x, 1.18, 5.48],
          [x, 1.29, 5.22],
        ]}
        radius={0.14}
        mat={m.stone}
      />
      {[-1, 0, 1].map((n) => (
        <group
          key={n}
          position={[x + n * 0.15, 1.25 + (0.12 - Math.abs(n) * 0.07), 5.39]}
          rotation={[0.25, n * 0.15, 0]}
        >
          <mesh scale={[0.11, 0.26, 0.11]} material={m.stone} castShadow>
            <sphereGeometry args={[1, 12, 10]} />
          </mesh>
          <mesh position={[0, 0.21, -0.025]} rotation={[-0.2, 0, 0]} material={m.brass}>
            <coneGeometry args={[0.06, 0.2, 8]} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
function AncientChedi({ m, onSelect }: { m: Mats; onSelect: () => void }) {
  const trim = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (const [y, w, d] of [
      [0.26, 7.6, 6.9],
      [0.66, 7.25, 6.5],
      [1.2, 6.8, 6.1],
      [1.45, 6.4, 5.7],
      [2.13, 5.9, 5.3],
      [2.43, 5.7, 5.1],
    ] as number[][]) {
      p.push({ p: [0, y, 0], s: [w, 0.1, d] });
    }
    for (let i = 0; i < 16; i++) p.push({ p: [0, 0.1 + i * 0.17, 5.22 - i * 0.23], s: [2.65, 0.2, 0.3] });
    return p;
  }, []);
  const damage = useMemo<Part[]>(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        p: [
          ((i % 6) - 2.5) * 0.42,
          5.42 + Math.floor(i / 6) * 0.22 + rand(i) * 0.14,
          -0.4 + (Math.floor(i / 6) % 2) * 0.25,
        ],
        s: [0.37, 0.24, 0.5],
        r: [0, (rand(i + 34) - 0.5) * 0.12, 0],
      })),
    [],
  );
  return (
    <group
      position={[-2, 0.8, 7]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Brick at={[0, 0.14, 0]} size={[7.7, 0.28, 7.0]} mat={m.brick} />
      <Brick at={[0, 0.49, 0]} size={[7.2, 0.5, 6.5]} mat={m.brick} />
      <Brick at={[0, 0.95, 0]} size={[6.7, 0.5, 6.0]} mat={m.brick} />
      <Brick at={[0, 1.68, 0]} size={[5.95, 1.28, 5.35]} mat={m.brick} />
      <Brick at={[0, 2.46, 0]} size={[5.38, 0.4, 4.85]} mat={m.brick} />
      <Brick at={[0, 3.23, -0.15]} size={[3.95, 1.43, 3.9]} mat={m.brick} />
      <Brick at={[0, 4.17, -0.3]} size={[3.28, 0.48, 3.2]} mat={m.brick} />
      <Brick at={[0, 4.65, -0.37]} size={[2.65, 0.5, 2.6]} mat={m.brick} />
      <Brick at={[0, 5.08, -0.42]} size={[2.05, 0.42, 2.03]} mat={m.brick} />
      <Batch parts={trim} material={m.brick} />
      <Batch parts={damage} material={m.brick} />
      <Box at={[0, 3.34, 1.814]} size={[1.09, 1.28, 0.07]} mat={m.dark} />
      <Box at={[0, 3.33, 1.87]} size={[0.62, 1.13, 0.045]} mat={m.walnut} />
      <mesh position={[-0.36, 4.01, 1.84]} rotation={[0, 0, Math.PI / 4]} material={m.stone}>
        <boxGeometry args={[1.05, 0.14, 0.19]} />
      </mesh>
      <mesh position={[0.36, 4.01, 1.84]} rotation={[0, 0, -Math.PI / 4]} material={m.stone}>
        <boxGeometry args={[1.05, 0.14, 0.19]} />
      </mesh>
      {[-0.69, 0.69].map((x) => (
        <Box key={x} at={[x, 3.3, 1.87]} size={[0.16, 1.62, 0.18]} mat={m.stone} />
      ))}
      <Naga side={-1} m={m} />
      <Naga side={1} m={m} />
      {[-2.25, -1.5, 1.5, 2.25].map((x) => (
        <Box key={x} at={[x, 2.03, 2.696]} size={[0.3, 0.21, 0.018]} mat={m.dark} />
      ))}
      {[-2.75, 2.75].map((x) => (
        <group key={x} position={[x, 1.07, 2.77]}>
          <mesh material={m.stone} scale={[0.29, 0.32, 0.48]} castShadow>
            <sphereGeometry args={[1, 16, 12]} />
          </mesh>
          <mesh position={[0, 0.26, 0.23]} material={m.stone} scale={[0.17, 0.23, 0.19]} castShadow>
            <sphereGeometry args={[1, 14, 10]} />
          </mesh>
          <Tube
            points={[
              [0, 0.24, 0.37],
              [0, 0.06, 0.55],
              [0, -0.14, 0.52],
            ]}
            radius={0.065}
            mat={m.stone}
          />
        </group>
      ))}
    </group>
  );
}

function Plant({ at, m, scale = 1 }: { at: V; m: Mats; scale?: number }) {
  return (
    <group position={at} scale={scale}>
      <mesh position={[0, 0.23, 0]} material={m.terracotta} castShadow>
        <cylinderGeometry args={[0.25, 0.18, 0.46, 20]} />
      </mesh>
      <mesh position={[0, 0.46, 0]} material={m.walnut}>
        <cylinderGeometry args={[0.22, 0.22, 0.015, 20]} />
      </mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <mesh
          key={i}
          position={[Math.sin(i * 2.4) * 0.15, 0.66 + rand(i) * 0.22, Math.cos(i * 2.4) * 0.15]}
          rotation={[Math.sin(i) * 0.6, i * 1.5, Math.cos(i) * 0.5]}
          scale={[0.11, 0.38, 0.025]}
          material={m.green}
          castShadow
        >
          <sphereGeometry args={[1, 9, 7]} />
        </mesh>
      ))}
    </group>
  );
}
function Stool({ at, m }: { at: V; m: Mats }) {
  const legs: Part[] = [-1, 1].flatMap((x) =>
    [-1, 1].map((z) => ({ p: [x * 0.17, 0.4, z * 0.17], s: [0.045, 0.8, 0.045] })),
  );
  return (
    <group position={at}>
      <Batch parts={legs} material={m.metal} />
      <mesh position={[0, 0.83, 0]} material={m.walnut} castShadow>
        <cylinderGeometry args={[0.29, 0.28, 0.08, 24]} />
      </mesh>
      <mesh position={[0, 0.29, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal}>
        <torusGeometry args={[0.21, 0.018, 8, 20]} />
      </mesh>
    </group>
  );
}
function Drink({ at, m, turn = 0 }: { at: V; m: Mats; turn?: number }) {
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh position={[0, 0.014, 0]} material={m.cream}>
        <cylinderGeometry args={[0.14, 0.14, 0.026, 28]} />
      </mesh>
      <mesh position={[0, 0.205, 0]} material={m.glass}>
        <cylinderGeometry args={[0.1, 0.087, 0.39, 24, 1, true]} />
      </mesh>
      <mesh position={[0, 0.16, 0]} material={m.drink}>
        <cylinderGeometry args={[0.09, 0.079, 0.29, 24]} />
      </mesh>
      <mesh position={[0, 0.402, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.glass}>
        <torusGeometry args={[0.098, 0.006, 6, 24]} />
      </mesh>
      {[-1, 1].map((n) => (
        <mesh
          key={n}
          position={[n * 0.026, 0.29 + n * 0.03, n * 0.025]}
          rotation={[0.1, n * 0.4, 0.2]}
          material={m.ice}
        >
          <boxGeometry args={[0.09, 0.09, 0.095]} />
        </mesh>
      ))}
      <mesh position={[0.062, 0.4, 0]} rotation={[Math.PI * 0.6, 0, 0.25]} material={m.green}>
        <cylinderGeometry args={[0.073, 0.073, 0.015, 20]} />
      </mesh>
      <mesh position={[0.065, 0.403, 0.008]} rotation={[Math.PI * 0.6, 0, 0.25]}>
        <cylinderGeometry args={[0.059, 0.059, 0.017, 20]} />
        <meshStandardMaterial color="#c8d870" roughness={0.45} />
      </mesh>
    </group>
  );
}
function BarSan({ m, onSelect }: { m: Mats; onSelect: () => void }) {
  const warmLights = useRef<(T.PointLight | null)[]>([]);
  const shelfGlow = useMemo(
    () =>
      new T.MeshStandardMaterial({
        color: '#f2cf98',
        emissive: '#ffc680',
        emissiveIntensity: 0,
        roughness: 0.5,
      }),
    [],
  );
  useEffect(() => () => shelfGlow.dispose(), [shelfGlow]);
  useFrame(() => {
    const level = resortAtmosphere.lamps;
    shelfGlow.emissiveIntensity = level * 1.9;
    warmLights.current.forEach((light) => {
      if (light) light.intensity = level * 6.5;
    });
  });
  const slats = useMemo<Part[]>(
    () =>
      Array.from({ length: 40 }, (_, i) => ({ p: [-2.68 + i * 0.138, 0.65, 0.42], s: [0.085, 0.96, 0.045] })),
    [],
  );
  const frame = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (const x of [-2.88, 2.88])
      for (const z of [-1.8, 1.55]) p.push({ p: [x, 1.72, z], s: [0.15, 3.44, 0.15] });
    for (const y of [0.28, 1.15, 1.95, 2.8]) p.push({ p: [0, y, -1.72], s: [5.55, 0.085, 0.4] });
    for (let i = 0; i < 20; i++) p.push({ p: [-2.9 + i * 0.305, 3.36, -0.4], s: [0.08, 0.13, 3.9] });
    return p;
  }, []);
  const lamps = [-1.8, 0, 1.8];
  return (
    <group
      position={[9, 0.8, 10]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Box at={[0, 0.09, 0]} size={[6.2, 0.18, 4.3]} mat={m.stone} />
      <Box at={[0, 0.22, 0]} size={[5.95, 0.08, 4.08]} mat={m.walnut} />
      <Box at={[0, 1.81, -1.9]} size={[5.9, 3.15, 0.15]} mat={m.dark} />
      <Box at={[-2.9, 1.0, -0.4]} size={[0.14, 1.6, 3.2]} mat={m.plaster} />
      <Box at={[2.9, 1.0, -0.4]} size={[0.14, 1.6, 3.2]} mat={m.plaster} />
      <Batch parts={frame} material={m.walnut} />
      <Box at={[0, 3.5, -0.4]} size={[6.35, 0.12, 4.1]} mat={m.dark} />
      <Box at={[0, 3.32, 1.66]} size={[6.05, 0.34, 0.12]} mat={m.walnut} />
      <Box at={[0, 0.66, 0.1]} size={[5.55, 0.91, 0.67]} mat={m.dark} />
      <Batch parts={slats} material={m.walnut} />
      <Box at={[0, 1.17, 0.09]} size={[5.78, 0.13, 0.92]} mat={m.wood} />
      <Box at={[0, 1.242, 0.09]} size={[5.62, 0.015, 0.82]} mat={m.walnut} />
      <mesh position={[0, 3.31, 1.736]} material={m.sign}>
        <planeGeometry args={[2.38, 0.595]} />
      </mesh>
      {[-0.75, 0.75].map((x) => (
        <Stool key={x} at={[x, 0.26, 1.25]} m={m} />
      ))}
      <Drink at={[-0.48, 1.25, 0.22]} m={m} turn={0.4} />
      <Drink at={[0.38, 1.25, 0.2]} m={m} turn={-0.7} />
      <Box at={[1.48, 1.27, 0.12]} size={[0.6, 0.035, 0.38]} mat={m.stone} />
      {Array.from({ length: 18 }, (_, i) => (
        <group key={i} position={[-2.4 + (i % 9) * 0.55, 1.195 + Math.floor(i / 9) * 0.8, -1.64]}>
          <mesh position={[0, 0.16, 0]} material={i % 3 === 0 ? m.brass : i % 3 === 1 ? m.green : m.glass}>
            <cylinderGeometry args={[0.068, 0.078, 0.32, 12]} />
          </mesh>
          <mesh position={[0, 0.37, 0]} material={i % 3 === 1 ? m.green : m.brass}>
            <cylinderGeometry args={[0.028, 0.034, 0.12, 10]} />
          </mesh>
          <Box at={[0, 0.17, 0.078]} size={[0.1, 0.13, 0.01]} mat={m.cream} />
        </group>
      ))}
      {lamps.map((x) => (
        <group key={x} position={[x, 2.62, 0.3]}>
          <mesh position={[0, 0.3, 0]} material={m.metal}>
            <cylinderGeometry args={[0.008, 0.008, 0.6, 6]} />
          </mesh>
          <mesh position={[0, -0.02, 0]} material={m.brass}>
            <coneGeometry args={[0.22, 0.18, 20, 1, true]} />
          </mesh>
          <mesh position={[0, -0.09, 0]} material={m.bulb}>
            <sphereGeometry args={[0.066, 12, 8]} />
          </mesh>
        </group>
      ))}
      {/* Fixed light count: warm shelf pools fade in with dusk without shader recompilation. */}
      {[1.9, 2.75].map((y) => (
        <Box key={y} at={[0, y, -1.49]} size={[5.3, 0.018, 0.035]} mat={shelfGlow} />
      ))}
      <Box at={[0, 1.137, 0.526]} size={[5.4, 0.025, 0.018]} mat={shelfGlow} />
      {[-1.45, 1.45].map((x, i) => (
        <pointLight
          key={x}
          ref={(light) => {
            warmLights.current[i] = light;
          }}
          position={[x, 2.35, -0.58]}
          color="#ffd2a0"
          intensity={0}
          distance={4.6}
          decay={2}
        />
      ))}
      <Plant at={[-3.3, 0, 1.65]} m={m} scale={1.1} />
      <Plant at={[3.3, 0, 1.65]} m={m} scale={1.15} />
    </group>
  );
}

function GardenPaths({ m }: { m: Mats }) {
  const paving = useMemo<Part[]>(() => {
    const main = new T.CatmullRomCurve3(
      [
        [-10, 9.1],
        [-8.5, 10.2],
        [-6.5, 13.5],
        [-2, 13.6],
        [3.6, 13.9],
        [7, 13.5],
        [9, 12.35],
      ].map(([x, z]) => new T.Vector3(x, 0.825, z)),
    );
    const branches = [
      main,
      new T.CatmullRomCurve3([
        new T.Vector3(5, 0.825, 13.75),
        new T.Vector3(4.8, 0.825, 14.1),
        new T.Vector3(5, 0.825, 14.45),
      ]),
    ];
    return branches.flatMap((curve, index) => {
      const count = Math.max(3, Math.ceil(curve.getLength() / 0.47));
      return Array.from({ length: count }, (_, i) => {
        const t = i / (count - 1),
          p = curve.getPointAt(t),
          d = curve.getTangentAt(t);
        return {
          p: [p.x, p.y, p.z] as V,
          s: [0.82 + rand(i + index * 100) * 0.06, 0.05, 0.43] as V,
          r: [0, Math.atan2(d.x, d.z), 0] as V,
        };
      });
    });
  }, []);
  return <Batch parts={paving} material={m.stone} />;
}
function Cafe({ m, onSelect }: { m: Mats; onSelect: () => void }) {
  const chairParts = useMemo<Part[]>(
    () =>
      [-1, 1].flatMap((side) => {
        const p: Part[] = [];
        for (const x of [-0.2, 0.2])
          for (const z of [-0.21, 0.21]) p.push({ p: [side * 1.25 + x, 0.38, z], s: [0.04, 0.52, 0.04] });
        p.push({ p: [side * 1.25, 0.65, 0], s: [0.5, 0.06, 0.5] });
        for (const x of [-0.22, 0.22]) p.push({ p: [side * 1.25 + x, 0.91, -0.22], s: [0.04, 0.52, 0.04] });
        p.push({ p: [side * 1.25, 1.1, -0.22], s: [0.46, 0.12, 0.04] });
        return p;
      }),
    [],
  );
  return (
    <group
      position={[5, 0.8, 16]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Box at={[0, 0.06, 0]} size={[4.5, 0.12, 3.35]} mat={m.stone} />
      <Box at={[0, 0.87, 0]} size={[1.7, 0.08, 1.1]} mat={m.wood} />
      <Box at={[0, 0.921, 0]} size={[1.78, 0.022, 1.18]} mat={m.cloth} />
      {[-0.7, 0.7].flatMap((x) =>
        [-0.43, 0.43].map((z) => (
          <Box key={`${x}-${z}`} at={[x, 0.47, z]} size={[0.06, 0.7, 0.06]} mat={m.metal} />
        )),
      )}
      <Batch parts={chairParts} material={m.wood} />
      {[-0.43, 0.43].map((x, i) => (
        <group key={x} position={[x, 0.954, i === 0 ? 0.05 : -0.05]}>
          <mesh material={m.ceramic}>
            <cylinderGeometry args={[0.26, 0.22, 0.04, 28]} />
          </mesh>
          <mesh position={[0, 0.038, 0.0]} scale={[0.14, 0.055, 0.12]} material={m.cream}>
            <sphereGeometry args={[1, 14, 8]} />
          </mesh>
          {Array.from({ length: 6 }, (_, n) => (
            <mesh
              key={n}
              position={[-0.125 + (n % 3) * 0.064, 0.063, 0.12 + Math.floor(n / 3) * 0.06]}
              rotation={[0.03, n * 0.1, 0]}
              material={m.mango}
            >
              <boxGeometry args={[0.058, 0.065, 0.055]} />
            </mesh>
          ))}
        </group>
      ))}
      <Drink at={[-0.5, 0.95, -0.32]} m={m} />
      <Drink at={[0.53, 0.95, 0.32]} m={m} />
      <Plant at={[-1.95, 0.12, 0.95]} m={m} scale={0.7} />
      <Plant at={[1.95, 0.12, -0.9]} m={m} />
      <mesh position={[0, 1.92, -1.05]} material={m.walnut}>
        <cylinderGeometry args={[0.035, 0.05, 3.6, 12]} />
      </mesh>
      <mesh position={[0, 3.52, -1.05]} material={m.cream} castShadow>
        <coneGeometry args={[2.2, 0.58, 12, 1, true]} />
      </mesh>
      <mesh position={[0, 3.83, -1.05]} material={m.brass}>
        <sphereGeometry args={[0.06, 10, 8]} />
      </mesh>
    </group>
  );
}

/** A small memory of Chiang Mai, rather than a surveyed reconstruction. */
export default function ChiangMaiTown({ onSelect, forestTemplePosition }: Props) {
  const m = useMaterials();
  useFrame(() => {
    m.bulb.emissiveIntensity = resortAtmosphere.lamps * 2.6;
    m.sign.emissiveIntensity = 0.06 + resortAtmosphere.lamps * 0.65;
  });
  return (
    <>
      <AncientChedi m={m} onSelect={() => onSelect('temple')} />
      <UmongScene position={forestTemplePosition} onSelect={() => onSelect('foresttemple')} />
      <BarSan m={m} onSelect={() => onSelect('san')} />
      <GardenPaths m={m} />
      <Cafe m={m} onSelect={() => onSelect('taste')} />
    </>
  );
}
