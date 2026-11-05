import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { resortAtmosphere } from './dayCycle';

type V = [number, number, number];
type Part = { p: V; s: V; r?: V };
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
function texture(kind: 'wood' | 'stone' | 'pineapple') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d')!;
  let seed = 19;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  x.fillStyle = kind === 'wood' ? '#b09168' : kind === 'stone' ? '#d9d1b9' : '#ad8138';
  x.fillRect(0, 0, 256, 256);
  if (kind === 'wood') {
    for (let i = 0; i < 250; i++) {
      const n = random() * 256;
      x.strokeStyle = `rgba(65,38,18,${0.03 + random() * 0.12})`;
      x.beginPath();
      x.moveTo(n, 0);
      x.bezierCurveTo(n + 5, 90, n - 4, 150, n + 2, 256);
      x.stroke();
    }
  } else if (kind === 'pineapple') {
    for (let row = -1; row < 12; row++)
      for (let col = -1; col < 12; col++) {
        const cx = col * 26 + (row % 2) * 13,
          cy = row * 24;
        x.beginPath();
        x.moveTo(cx, cy - 12);
        x.lineTo(cx + 13, cy);
        x.lineTo(cx, cy + 12);
        x.lineTo(cx - 13, cy);
        x.closePath();
        x.fillStyle = `rgb(${120 + random() * 45},${91 + random() * 25},${36 + random() * 20})`;
        x.fill();
        x.lineWidth = 2;
        x.strokeStyle = '#68562b';
        x.stroke();
        x.fillStyle = '#ddbc6e';
        x.fillRect(cx - 2, cy - 3, 4, 4);
      }
  } else {
    for (let i = 0; i < 5000; i++) {
      x.fillStyle = `rgba(${random() > 0.5 ? '255,250,232' : '110,100,74'},${random() * 0.1})`;
      x.fillRect(random() * 256, random() * 256, 1, 1);
    }
  }
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}
function Chair({ at, turn, wood, cushion }: { at: V; turn: number; wood: T.Material; cushion: T.Material }) {
  const frame = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (const x of [-0.19, 0.19])
      for (const z of [-0.2, 0.2]) p.push({ p: [x, 0.205, z], s: [0.045, 0.41, 0.045] });
    p.push({ p: [0, 0.42, 0], s: [0.46, 0.05, 0.46] });
    for (const x of [-0.2, 0.2]) p.push({ p: [x, 0.65, -0.21], s: [0.045, 0.49, 0.045] });
    for (const y of [0.56, 0.67, 0.78, 0.87]) p.push({ p: [0, y, -0.21], s: [0.43, 0.055, 0.035] });
    return p;
  }, []);
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <Batch parts={frame} material={wood} />
      <mesh position={[0, 0.465, 0]} material={cushion} castShadow>
        <boxGeometry args={[0.41, 0.05, 0.4]} />
      </mesh>
    </group>
  );
}
function Stool({ at, wood, metal }: { at: V; wood: T.Material; metal: T.Material }) {
  const legs = useMemo(
    () =>
      [-1, 1].flatMap((x) =>
        [-1, 1].map((z) => ({ p: [x * 0.12, 0.31, z * 0.12] as V, s: [0.035, 0.62, 0.035] as V })),
      ),
    [],
  );
  return (
    <group position={at}>
      <Batch parts={legs} material={metal} />
      <mesh position={[0, 0.65, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.2, 0.19, 0.06, 24]} />
      </mesh>
      <mesh position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal}>
        <torusGeometry args={[0.16, 0.012, 6, 24]} />
      </mesh>
    </group>
  );
}
function Dessert({
  skin,
  cream,
  wood,
  ceramic,
}: {
  skin: T.Material;
  cream: T.Material;
  wood: T.Material;
  ceramic: T.Material;
}) {
  const umbrella = useMemo(() => {
    const g = new T.ConeGeometry(0.15, 0.07, 8, 1, true),
      count = g.getAttribute('position').count,
      colors = [];
    const p = g.getAttribute('position');
    for (let i = 0; i < count; i++) {
      const stripe = Math.floor(((Math.atan2(p.getZ(i), p.getX(i)) + Math.PI) * 4) / Math.PI) % 2;
      const c = new T.Color(stripe ? '#db9272' : '#edd5a5');
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    return g;
  }, []);
  useEffect(() => () => umbrella.dispose(), [umbrella]);
  return (
    <group>
      <mesh position={[0, 0.018, 0]} material={ceramic}>
        <cylinderGeometry args={[0.24, 0.2, 0.025, 40]} />
      </mesh>
      <mesh position={[0, 0.14, 0]} material={skin} castShadow>
        <cylinderGeometry args={[0.19, 0.16, 0.23, 32]} />
      </mesh>
      <mesh position={[0, 0.258, 0]}>
        <cylinderGeometry args={[0.176, 0.176, 0.015, 32]} />
        <meshStandardMaterial color="#f3d078" roughness={0.78} />
      </mesh>
      {[
        [0, 0.29, 0.04],
        [-0.085, 0.32, -0.04],
        [0.075, 0.33, -0.055],
      ].map((p, i) => (
        <mesh key={i} position={p as V} scale={[1, 0.9, 1]} material={cream} castShadow>
          <sphereGeometry args={[0.095, 16, 10]} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} position={[Math.sin(i * 2) * 0.1, 0.38, Math.cos(i * 2) * 0.07]} rotation={[0, i, 0.2]}>
          <boxGeometry args={[0.045, 0.038, 0.04]} />
          <meshStandardMaterial color="#edc164" roughness={0.72} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.05, 0.24, -0.08]} rotation={[0.12, 0, -side * 0.18]}>
          <mesh position={[0, 0.18, 0]} material={wood}>
            <boxGeometry args={[0.013, 0.36, 0.006]} />
          </mesh>
          <mesh position={[0, 0.375, 0]} scale={[0.024, 0.043, 0.008]} material={wood}>
            <sphereGeometry args={[1, 12, 8]} />
          </mesh>
        </group>
      ))}
      <group position={[0.12, 0.25, 0.08]} rotation={[0.08, 0, -0.3]}>
        <mesh position={[0, 0.13, 0]} material={wood}>
          <cylinderGeometry args={[0.004, 0.004, 0.28, 6]} />
        </mesh>
        <mesh position={[0, 0.29, 0]} geometry={umbrella}>
          <meshStandardMaterial vertexColors side={T.DoubleSide} roughness={1} />
        </mesh>
      </group>
    </group>
  );
}
function DiningTable({
  at,
  dessert,
  wood,
  stone,
  ceramic,
  glass,
  cream,
  skin,
}: {
  at: V;
  dessert?: boolean;
  wood: T.Material;
  stone: T.Material;
  ceramic: T.Material;
  glass: T.Material;
  cream: T.Material;
  skin: T.Material;
}) {
  return (
    <group position={at}>
      <mesh position={[0, 0.75, 0]} material={stone} castShadow receiveShadow>
        <cylinderGeometry args={[0.56, 0.55, 0.055, 40]} />
      </mesh>
      <mesh position={[0, 0.36, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.045, 0.07, 0.72, 12]} />
      </mesh>
      <mesh position={[0, 0.04, 0]} material={wood}>
        <cylinderGeometry args={[0.26, 0.3, 0.08, 24]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 0.32, 0.79, 0]}>
          <mesh material={ceramic}>
            <cylinderGeometry args={[0.135, 0.12, 0.018, 24]} />
          </mesh>
          <mesh position={[0, 0.014, 0]} rotation={[Math.PI / 2, 0, 0]} material={ceramic}>
            <torusGeometry args={[0.12, 0.009, 6, 24]} />
          </mesh>
          <mesh position={[side * 0.17, 0.007, 0]}>
            <boxGeometry args={[0.009, 0.012, 0.19]} />
            <meshStandardMaterial color="#babfb5" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.06, -0.23]} material={glass}>
            <cylinderGeometry args={[0.04, 0.034, 0.12, 16, 1, true]} />
          </mesh>
        </group>
      ))}
      {dessert ? (
        <group position={[0, 0.79, 0.05]}>
          <Dessert skin={skin} cream={cream} wood={wood} ceramic={ceramic} />
        </group>
      ) : (
        <group position={[0, 0.79, 0]}>
          <mesh position={[0, 0.06, 0]} material={ceramic}>
            <cylinderGeometry args={[0.055, 0.04, 0.12, 16]} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.055, 12, 8]} />
            <meshStandardMaterial color="#e7b786" />
          </mesh>
        </group>
      )}
    </group>
  );
}
export default function SeasideDining(_props: { night: boolean }) {
  const materials = useMemo(() => {
    const grain = texture('wood'),
      stoneMap = texture('stone'),
      pine = texture('pineapple');
    const bump = grain.clone();
    bump.colorSpace = T.NoColorSpace;
    const fruitBump = pine.clone();
    fruitBump.colorSpace = T.NoColorSpace;
    return {
      wood: new T.MeshStandardMaterial({
        color: '#bda27a',
        map: grain,
        bumpMap: bump,
        bumpScale: 0.014,
        roughness: 0.76,
      }),
      dark: new T.MeshStandardMaterial({ color: '#554837', map: grain, roughness: 0.8 }),
      stone: new T.MeshStandardMaterial({ color: '#eee9dd', map: stoneMap, roughness: 0.46 }),
      metal: new T.MeshStandardMaterial({ color: '#454b46', metalness: 0.45, roughness: 0.4 }),
      ceramic: new T.MeshStandardMaterial({ color: '#f2ecdc', roughness: 0.28 }),
      glass: new T.MeshPhysicalMaterial({
        color: '#d4e6dd',
        transparent: true,
        opacity: 0.43,
        roughness: 0.09,
        metalness: 0.12,
        side: T.DoubleSide,
      }),
      cushion: new T.MeshStandardMaterial({ color: '#e3decd', roughness: 0.95 }),
      cream: new T.MeshStandardMaterial({ color: '#f7e9c8', roughness: 0.93 }),
      skin: new T.MeshStandardMaterial({
        map: pine,
        bumpMap: fruitBump,
        bumpScale: 0.025,
        color: '#ddca8f',
        roughness: 0.95,
      }),
      maps: [grain, stoneMap, pine, bump, fruitBump],
    };
  }, []);
  useEffect(
    () => () => {
      materials.maps.forEach((t) => t.dispose());
      for (const k of [
        'wood',
        'dark',
        'stone',
        'metal',
        'ceramic',
        'glass',
        'cushion',
        'cream',
        'skin',
      ] as const)
        materials[k].dispose();
    },
    [materials],
  );
  const frame = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (const x of [-2.8, 2.8])
      for (const z of [0.12, 2.18]) p.push({ p: [x, 1.29, z], s: [0.11, 2.4, 0.11] });
    for (const z of [0.12, 2.18]) p.push({ p: [0, 2.44, z], s: [5.8, 0.14, 0.1] });
    for (const x of [-2.8, 2.8]) p.push({ p: [x, 2.44, 1.15], s: [0.1, 0.14, 2.23] });
    return p;
  }, []);
  const soffit = useMemo<Part[]>(
    () =>
      Array.from({ length: 40 }, (_, i) => ({ p: [-2.97 + i * 0.152, 2.5, 1.14], s: [0.11, 0.04, 2.54] })),
    [],
  );
  const deck = useMemo<Part[]>(
    () => Array.from({ length: 16 }, (_, i) => ({ p: [0, 0.08, 0.075 + i * 0.15], s: [6.12, 0.035, 0.138] })),
    [],
  );
  const counter = useMemo<Part[]>(() => {
    const p: Part[] = [{ p: [0, 0.5, 0.38], s: [4.95, 0.84, 0.54] }];
    for (let i = 0; i < 58; i++) p.push({ p: [-2.43 + i * 0.085, 0.54, 0.67], s: [0.055, 0.84, 0.035] });
    return p;
  }, []);
  const seams = useMemo<Part[]>(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        p: [-2.99 + i * 0.398, 2.628, 1.14],
        s: [0.016, 0.025, 2.64],
      })),
    [],
  );
  const warmLight = useRef<T.PointLight>(null);
  const lighting = useMemo(() => {
    const bulb = new T.MeshStandardMaterial({
      color: '#ead3a7',
      emissive: '#ffc080',
      emissiveIntensity: 0,
      roughness: 0.4,
    });
    const strip = new T.MeshStandardMaterial({
      color: '#cbbda1',
      emissive: '#ffd397',
      emissiveIntensity: 0,
      roughness: 0.57,
    });
    const strips: Part[] = [
      { p: [0, 2.362, 2.15], s: [5.5, 0.016, 0.028] },
      { p: [0, 0.955, 0.788], s: [4.94, 0.018, 0.022] },
    ];
    return { bulb, strip, strips };
  }, []);
  useEffect(
    () => () => {
      lighting.bulb.dispose();
      lighting.strip.dispose();
    },
    [lighting],
  );
  useFrame(() => {
    const light = resortAtmosphere.lamps;
    lighting.bulb.emissiveIntensity = light * 3.3;
    lighting.strip.emissiveIntensity = light * 1.8;
    if (warmLight.current) warmLight.current.intensity = light * 3.8;
  });
  return (
    <group position={[-7, 0.95, 3]}>
      <mesh position={[0, 0.01, 1.2]} material={materials.dark} receiveShadow>
        <boxGeometry args={[6.2, 0.12, 2.5]} />
      </mesh>
      <Batch parts={deck} material={materials.wood} />
      <Batch parts={frame} material={materials.dark} />
      <Batch parts={soffit} material={materials.wood} />
      <mesh position={[0, 2.57, 1.14]} material={materials.metal} castShadow receiveShadow>
        <boxGeometry args={[6.4, 0.1, 2.66]} />
      </mesh>
      <Batch parts={seams} material={materials.metal} />
      <Batch parts={counter} material={materials.dark} />
      <mesh position={[0, 1.01, 0.4]} material={materials.stone} castShadow receiveShadow>
        <boxGeometry args={[5.13, 0.095, 0.77]} />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <Stool key={x} at={[x, 0.1, 1.06]} wood={materials.wood} metal={materials.metal} />
      ))}
      {[-1.7, 1.7].map((x, i) => (
        <group key={x}>
          <DiningTable at={[x, 0.1, 1.65]} dessert={i === 0} {...materials} />
          <Chair
            at={[x - 0.69, 0.1, 1.65]}
            turn={Math.PI / 2}
            wood={materials.wood}
            cushion={materials.cushion}
          />
          <Chair
            at={[x + 0.69, 0.1, 1.65]}
            turn={-Math.PI / 2}
            wood={materials.wood}
            cushion={materials.cushion}
          />
        </group>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <group key={i} position={[1.55 + i * 0.16, 1.06, 0.37]}>
          <mesh position={[0, 0.095, 0]}>
            <cylinderGeometry args={[0.035, 0.04, 0.19, 12]} />
            <meshPhysicalMaterial color={i % 2 ? '#78864a' : '#b79155'} roughness={0.18} clearcoat={1} />
          </mesh>
          <mesh position={[0, 0.218, 0]} material={materials.metal}>
            <cylinderGeometry args={[0.017, 0.017, 0.057, 8]} />
          </mesh>
          <mesh position={[0, 0.09, 0.039]} material={materials.ceramic}>
            <planeGeometry args={[0.047, 0.075]} />
          </mesh>
        </group>
      ))}
      <group position={[-1.98, 1.06, 0.36]}>
        <mesh position={[0, 0.19, 0]} material={materials.metal} castShadow>
          <boxGeometry args={[0.42, 0.38, 0.31]} />
        </mesh>
        <mesh position={[0, 0.15, 0.17]}>
          <boxGeometry args={[0.31, 0.2, 0.025]} />
          <meshStandardMaterial color="#a8aca0" metalness={0.72} roughness={0.23} />
        </mesh>
        <mesh position={[0, 0.04, 0.24]} material={materials.ceramic}>
          <cylinderGeometry args={[0.038, 0.03, 0.07, 12]} />
        </mesh>
      </group>
      {[-1.7, 1.7].map((x) => (
        <group key={x} position={[x, 2.07, 1.2]}>
          <mesh position={[0, 0.21, 0]} material={materials.metal}>
            <cylinderGeometry args={[0.007, 0.007, 0.42, 6]} />
          </mesh>
          <mesh>
            <coneGeometry args={[0.16, 0.12, 16, 1, true]} />
            <meshStandardMaterial color="#b28b52" side={T.DoubleSide} roughness={0.7} />
          </mesh>
          <mesh position={[0, -0.045, 0]} material={lighting.bulb}>
            <sphereGeometry args={[0.045, 12, 8]} />
          </mesh>
        </group>
      ))}
      <Batch parts={lighting.strips} material={lighting.strip} />
      <pointLight
        ref={warmLight}
        position={[0, 2, 1.15]}
        color="#ffdaa5"
        intensity={0}
        distance={6.2}
        decay={2}
      />
    </group>
  );
}
