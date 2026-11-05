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
    parts.forEach((a, i) => {
      q.setFromEuler(new T.Euler(...(a.r ?? [0, 0, 0])));
      m.compose(new T.Vector3(...a.p), q, new T.Vector3(...a.s));
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
function texture(kind: 'shingle' | 'wood' | 'stone') {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  let seed = 173;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  g.fillStyle = kind === 'shingle' ? '#694335' : kind === 'wood' ? '#a17a51' : '#c9c1ad';
  g.fillRect(0, 0, 512, 512);
  if (kind === 'shingle') {
    for (let row = 0; row < 16; row++) {
      for (let col = -1; col < 16; col++) {
        const x = col * 34 + (row % 2) * 17,
          y = row * 32;
        const n = random() * 25;
        g.fillStyle = `rgb(${112 + n},${74 + n * 0.65},${55 + n * 0.45})`;
        g.fillRect(x + 1, y + 1, 32, 30);
        g.fillStyle = '#513b2b';
        g.fillRect(x, y + 29, 34, 3);
        g.fillStyle = '#bd936055';
        g.fillRect(x + 2, y + 2, 30, 1);
        for (let k = 0; k < 7; k++) {
          g.fillStyle = '#e8be7d14';
          g.fillRect(x + random() * 32, y + 3, 1, 25);
        }
      }
    }
  } else if (kind === 'wood') {
    for (let i = 0; i < 400; i++) {
      const x = random() * 512;
      g.strokeStyle = `rgba(54,29,13,${random() * 0.15})`;
      g.beginPath();
      g.moveTo(x, 0);
      g.bezierCurveTo(x + 10, 150, x - 8, 300, x + 4, 512);
      g.stroke();
    }
  } else {
    for (let i = 0; i < 15000; i++) {
      g.fillStyle = `rgba(${random() > 0.5 ? '255,248,220' : '63,63,51'},${random() * 0.12})`;
      g.fillRect(random() * 512, random() * 512, 1 + random() * 3, 1 + random() * 3);
    }
  }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  map.wrapS = map.wrapT = T.RepeatWrapping;
  map.anisotropy = 4;
  map.repeat.set(kind === 'shingle' ? 1.25 : 1, kind === 'shingle' ? 1.25 : 1);
  return map;
}

// One continuous, steep Bornean roof: low spreading eaves and a tapering crown.
function roofGeometry() {
  const rings = [
    { r: 2.38, y: 2.36 },
    { r: 1.29, y: 2.76 },
    { r: 1.04, y: 2.9 },
    { r: 0.61, y: 3.72 },
    { r: 0.34, y: 4.58 },
  ];
  const p: number[] = [],
    uv: number[] = [];
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  for (let k = 0; k < rings.length - 1; k++) {
    for (let f = 0; f < 4; f++) {
      const n = (f + 1) % 4,
        lo = rings[k],
        hi = rings[k + 1];
      const v = [
        [corners[f][0] * lo.r, lo.y, corners[f][1] * lo.r],
        [corners[f][0] * hi.r, hi.y, corners[f][1] * hi.r],
        [corners[n][0] * hi.r, hi.y, corners[n][1] * hi.r],
        [corners[n][0] * lo.r, lo.y, corners[n][1] * lo.r],
      ];
      for (const i of [0, 1, 2, 0, 2, 3]) {
        p.push(...v[i]);
        uv.push(f % 2 ? v[i][2] : v[i][0], v[i][1] * 1.5);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}
function beam(a: V, b: V, thickness = 0.07): Part {
  const start = new T.Vector3(...a),
    end = new T.Vector3(...b),
    d = end.clone().sub(start);
  const q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize());
  const e = new T.Euler().setFromQuaternion(q);
  return {
    p: start.add(end).multiplyScalar(0.5).toArray() as V,
    s: [thickness, d.length(), thickness],
    r: [e.x, e.y, e.z],
  };
}
function counterShape() {
  const s = new T.Shape();
  const start = 0.2,
    end = Math.PI * 2 - 0.55;
  const points = [];
  for (let i = 0; i <= 60; i++) {
    const t = start + ((end - start) * i) / 60;
    points.push([Math.cos(t) * 0.92, -Math.sin(t) * 0.92]);
  }
  for (let i = 60; i >= 0; i--) {
    const t = start + ((end - start) * i) / 60;
    points.push([Math.cos(t) * 0.55, -Math.sin(t) * 0.55]);
  }
  points.forEach((p, i) => (i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])));
  s.closePath();
  return s;
}

function Stool({ at, wood, metal }: { at: V; wood: T.Material; metal: T.Material }) {
  const legs = useMemo(() => {
    const a: Part[] = [];
    for (const x of [-0.115, 0.115])
      for (const z of [-0.115, 0.115]) a.push({ p: [x, 0.3175, z], s: [0.035, 0.635, 0.035] });
    return a;
  }, []);
  return (
    <group position={at}>
      <Batch parts={legs} material={metal} />
      <mesh position={[0, 0.67, 0]} material={wood} castShadow>
        <cylinderGeometry args={[0.2, 0.18, 0.065, 24]} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]} material={metal}>
        <torusGeometry args={[0.16, 0.014, 6, 24]} />
      </mesh>
    </group>
  );
}
function Lounge({ at, turn, wood, cushion }: { at: V; turn: number; wood: T.Material; cushion: T.Material }) {
  const frame = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (const x of [-0.21, 0.21])
      for (const z of [-0.21, 0.21]) p.push({ p: [x, 0.2, z], s: [0.045, 0.4, 0.045] });
    p.push(
      { p: [0, 0.42, 0], s: [0.5, 0.06, 0.51] },
      { p: [0, 0.65, -0.23], s: [0.5, 0.42, 0.055], r: [-0.12, 0, 0] },
    );
    for (const x of [-0.25, 0.25]) p.push({ p: [x, 0.58, 0], s: [0.055, 0.06, 0.55] });
    return p;
  }, []);
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <Batch parts={frame} material={wood} />
      <mesh position={[0, 0.48, 0]} material={cushion} castShadow>
        <boxGeometry args={[0.43, 0.08, 0.44]} />
      </mesh>
      <mesh position={[0, 0.66, -0.175]} rotation={[-0.12, 0, 0]} material={cushion}>
        <boxGeometry args={[0.43, 0.3, 0.06]} />
      </mesh>
    </group>
  );
}

export default function SunsetBar(_props: { night: boolean }) {
  const resources = useMemo(() => {
    const shingle = texture('shingle'),
      grain = texture('wood'),
      stoneMap = texture('stone');
    const bump = shingle.clone();
    bump.colorSpace = T.NoColorSpace;
    const woodBump = grain.clone();
    woodBump.colorSpace = T.NoColorSpace;
    const roof = new T.MeshStandardMaterial({
      map: shingle,
      bumpMap: bump,
      bumpScale: 0.035,
      color: '#dcc2a1',
      roughness: 0.84,
    });
    const wood = new T.MeshStandardMaterial({
      map: grain,
      bumpMap: woodBump,
      bumpScale: 0.014,
      color: '#b18d67',
      roughness: 0.69,
    });
    const darkWood = new T.MeshStandardMaterial({ map: grain, color: '#5a3d28', roughness: 0.78 });
    const soffit = new T.MeshStandardMaterial({
      map: grain,
      color: '#6f4f31',
      roughness: 0.82,
      side: T.BackSide,
    });
    const stone = new T.MeshStandardMaterial({ map: stoneMap, color: '#dfdccb', roughness: 0.43 });
    const metal = new T.MeshStandardMaterial({ color: '#393e36', metalness: 0.65, roughness: 0.35 });
    const cushion = new T.MeshStandardMaterial({ color: '#e0d8bf', roughness: 0.95 });
    const geometry = roofGeometry();
    return {
      roof,
      wood,
      darkWood,
      soffit,
      stone,
      metal,
      cushion,
      geometry,
      maps: [shingle, grain, stoneMap, bump, woodBump],
    };
  }, []);
  useEffect(
    () => () => {
      resources.maps.forEach((t) => t.dispose());
      for (const key of ['roof', 'wood', 'darkWood', 'soffit', 'stone', 'metal', 'cushion'] as const)
        resources[key].dispose();
      resources.geometry.dispose();
    },
    [resources],
  );
  const frame = useMemo(() => {
    const p: Part[] = [];
    for (const x of [-1.65, 1.65])
      for (const z of [-1.65, 1.65]) {
        p.push({ p: [x, 1.34, z], s: [0.115, 2.48, 0.115] });
        p.push(
          beam([x, 2.02, z], [x - Math.sign(x) * 0.4, 2.54, z], 0.075),
          beam([x, 2.02, z], [x, 2.54, z - Math.sign(z) * 0.4], 0.075),
        );
      }
    for (const z of [-1.65, 1.65]) p.push({ p: [0, 1.34, z], s: [0.095, 2.48, 0.095] });
    for (const side of [-1, 1]) {
      p.push(
        { p: [0, 2.54, side * 1.65], s: [3.42, 0.14, 0.12] },
        { p: [side * 1.65, 2.54, 0], s: [0.12, 0.14, 3.42] },
        { p: [0, 2.35, side * 2.38], s: [4.8, 0.12, 0.07] },
        { p: [side * 2.38, 2.35, 0], s: [0.07, 0.12, 4.8] },
      );
    }
    for (let i = -3; i <= 3; i++) {
      const t = i * 0.46;
      p.push(
        beam([t, 2.33, -2.3], [t * 0.45, 2.78, -1.05], 0.045),
        beam([t, 2.33, 2.3], [t * 0.45, 2.78, 1.05], 0.045),
        beam([-2.3, 2.33, t], [-1.05, 2.78, t * 0.45], 0.045),
        beam([2.3, 2.33, t], [1.05, 2.78, t * 0.45], 0.045),
      );
    }
    return p;
  }, []);
  const deck = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (let z = -2.38; z <= 2.38; z += 0.15) {
      const half = Math.sqrt(2.5 ** 2 - z * z);
      p.push({ p: [0, 0.09, z], s: [half * 2, 0.02, 0.138] });
    }
    return p;
  }, []);
  const slats = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (let i = 0; i < 52; i++) {
      const a = 0.2 + ((Math.PI * 2 - 0.75) * i) / 51;
      p.push({
        p: [Math.cos(a) * 0.765, 0.56, Math.sin(a) * 0.765],
        s: [0.067, 0.92, 0.045],
        r: [0, Math.PI / 2 - a, 0],
      });
    }
    return p;
  }, []);
  const top = useMemo(counterShape, []);
  const uplightTarget = useMemo(() => {
    const o = new T.Object3D();
    o.position.set(0, 3.7, 0.55);
    return o;
  }, []);
  const cable = useMemo(
    () =>
      new T.CatmullRomCurve3(
        Array.from(
          { length: 10 },
          (_, i) => new T.Vector3(-2.05 + i * 0.455, 2.32 - Math.sin((i / 9) * Math.PI) * 0.09, 0),
        ),
      ),
    [],
  );
  const roofLight = useRef<T.SpotLight>(null),
    barLight = useRef<T.PointLight>(null);
  const lighting = useMemo(() => {
    const data = new Uint8Array(64 * 64 * 4);
    for (let y = 0; y < 64; y++)
      for (let x = 0; x < 64; x++) {
        const r = Math.hypot((x - 31.5) / 31.5, (y - 31.5) / 31.5),
          i = (y * 64 + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 255;
        data[i + 3] = Math.round(255 * Math.pow(Math.max(0, 1 - r * r), 2.5));
      }
    const glow = new T.DataTexture(data, 64, 64);
    glow.needsUpdate = true;
    glow.magFilter = glow.minFilter = T.LinearFilter;
    const bulb = new T.MeshStandardMaterial({
      color: '#efd8ad',
      emissive: '#ffbf74',
      emissiveIntensity: 0,
      roughness: 0.35,
    });
    const strip = new T.MeshStandardMaterial({
      color: '#c8b89a',
      emissive: '#ffc582',
      emissiveIntensity: 0,
      roughness: 0.58,
    });
    const accent = new T.MeshStandardMaterial({
      name: 'sunset-bar-accent-strip',
      color: '#c7b797',
      emissive: '#ffd29a',
      emissiveIntensity: 0,
      roughness: 0.55,
    });
    const floor = new T.MeshBasicMaterial({
      map: glow,
      color: '#ffc37d',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
    });
    const halo = new T.SpriteMaterial({
      map: glow,
      color: '#ffd194',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
    });
    // Keep the diffuser just outside the stone overhang so the high camera can see its thin lower lip.
    const rim = new T.CatmullRomCurve3(
      Array.from({ length: 81 }, (_, i) => {
        const a = 0.2 + ((Math.PI * 2 - 0.75) * i) / 80;
        return new T.Vector3(Math.cos(a) * 0.94, 1.006, Math.sin(a) * 0.94);
      }),
    );
    const eaves: Part[] = [];
    // Fascia outer face is 2.415: mount on its lower outside edge, not behind the beam.
    for (const side of [-1, 1])
      eaves.push(
        { p: [0, 2.3, side * 2.42], s: [4.82, 0.024, 0.036] },
        { p: [side * 2.42, 2.3, 0], s: [0.036, 0.024, 4.82] },
      );
    // A finer band follows the roof shoulder above the broad eaves. The diffuser
    // sits outside the sloping shingles, so it stays visible from the island view.
    const crown: Part[] = [];
    for (const side of [-1, 1])
      crown.push(
        { p: [0, 2.922, side * 1.057], s: [2.132, 0.018, 0.022] },
        { p: [side * 1.057, 2.922, 0], s: [0.022, 0.018, 2.132] },
      );
    return { bulb, strip, accent, floor, halo, glow, rim, eaves, crown };
  }, []);
  useEffect(
    () => () => {
      lighting.bulb.dispose();
      lighting.strip.dispose();
      lighting.accent.dispose();
      lighting.floor.dispose();
      lighting.halo.dispose();
      lighting.glow.dispose();
    },
    [lighting],
  );
  useFrame(() => {
    const light = resortAtmosphere.lamps;
    lighting.bulb.emissiveIntensity = light * 3.8;
    lighting.strip.emissiveIntensity = light * 2.3;
    lighting.accent.emissiveIntensity = light * 1.65;
    lighting.floor.opacity = light * 0.16;
    lighting.halo.opacity = light * 0.32;
    if (roofLight.current) roofLight.current.intensity = light * 11;
    if (barLight.current) barLight.current.intensity = light * 4.8;
  });
  return (
    <group position={[-14, 0.95, 12]}>
      <mesh position={[0, -0.01, 0]} material={resources.darkWood} receiveShadow>
        <cylinderGeometry args={[2.52, 2.56, 0.18, 64]} />
      </mesh>
      <Batch parts={deck} material={resources.wood} />
      <mesh position={[0, 0.075, 0]} rotation={[Math.PI / 2, 0, 0]} material={resources.darkWood}>
        <torusGeometry args={[2.51, 0.025, 6, 64]} />
      </mesh>
      <Batch parts={frame} material={resources.darkWood} />
      <mesh geometry={resources.geometry} material={resources.roof} castShadow receiveShadow />
      <mesh
        geometry={resources.geometry}
        material={resources.soffit}
        position={[0, -0.035, 0]}
        receiveShadow
      />
      <mesh position={[0, 4.585, 0]} material={resources.darkWood} castShadow>
        <boxGeometry args={[0.7, 0.09, 0.7]} />
      </mesh>
      <mesh position={[0, 4.665, 0]} material={resources.roof}>
        <boxGeometry args={[0.15, 0.08, 0.67]} />
      </mesh>
      <Batch parts={slats} material={resources.wood} />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 1.02, 0]}
        material={resources.stone}
        castShadow
        receiveShadow
      >
        <extrudeGeometry
          args={[
            top,
            {
              depth: 0.085,
              bevelEnabled: true,
              bevelSize: 0.015,
              bevelThickness: 0.015,
              bevelSegments: 2,
              curveSegments: 48,
            },
          ]}
        />
      </mesh>
      <mesh position={[0, 0.34, 0]} material={resources.darkWood}>
        <cylinderGeometry args={[0.52, 0.52, 0.12, 40]} />
      </mesh>
      {[0.45, 1.35, 2.25, 3.15].map((a) => (
        <Stool
          key={a}
          at={[Math.cos(a) * 1.25, 0.1, Math.sin(a) * 1.25]}
          wood={resources.wood}
          metal={resources.metal}
        />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const a = 3.8 + i * 0.22;
        return (
          <group key={i} position={[Math.cos(a) * 0.75, 1.13, Math.sin(a) * 0.75]}>
            <mesh position={[0, 0.075, 0]}>
              <cylinderGeometry args={[0.026, 0.032, 0.15, 10]} />
              <meshPhysicalMaterial color={i % 2 ? '#5b763a' : '#9a6b32'} roughness={0.16} clearcoat={1} />
            </mesh>
            <mesh position={[0, 0.175, 0]}>
              <cylinderGeometry args={[0.012, 0.015, 0.06, 8]} />
              <meshStandardMaterial color="#394b2b" roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.075, 0.03]}>
              <planeGeometry args={[0.039, 0.05]} />
              <meshStandardMaterial color="#ddd0ad" />
            </mesh>
          </group>
        );
      })}
      {[0.6, 1.6, 2.6].map((a) => (
        <group key={a} position={[Math.cos(a) * 0.8, 1.14, Math.sin(a) * 0.8]}>
          <mesh position={[0, 0.045, 0]}>
            <cylinderGeometry args={[0.035, 0.025, 0.085, 12, 1, true]} />
            <meshPhysicalMaterial
              color="#dfefe5"
              transparent
              opacity={0.65}
              roughness={0.08}
              metalness={0.1}
              side={T.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0.027, 0]}>
            <cylinderGeometry args={[0.028, 0.023, 0.04, 12]} />
            <meshStandardMaterial color="#e2a847" roughness={0.23} />
          </mesh>
        </group>
      ))}
      <Lounge at={[-1.98, 0.1, -0.55]} turn={Math.PI / 2} wood={resources.wood} cushion={resources.cushion} />
      <Lounge at={[-1.98, 0.1, 0.38]} turn={Math.PI / 2} wood={resources.wood} cushion={resources.cushion} />
      <Lounge at={[1.8, 0.1, 1.25]} turn={-Math.PI * 0.7} wood={resources.wood} cushion={resources.cushion} />
      {[
        [-1.8, 0],
        [1.95, 0.55],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 0.1, z]}>
          <mesh position={[0, 0.39, 0]} material={resources.stone} castShadow>
            <cylinderGeometry args={[0.23, 0.23, 0.045, 24]} />
          </mesh>
          <mesh position={[0, 0.2, 0]} material={resources.metal}>
            <cylinderGeometry args={[0.025, 0.04, 0.38, 10]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={resources.metal}>
            <cylinderGeometry args={[0.13, 0.15, 0.035, 20]} />
          </mesh>
        </group>
      ))}
      {[-0.94, 0.94].map((x) => (
        <group key={x} position={[x, 2.24, 0.48]}>
          <mesh position={[0, 0.15, 0]} material={resources.metal}>
            <cylinderGeometry args={[0.008, 0.008, 0.3, 6]} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.085, 0.13, 0.15, 12, 1, true]} />
            <meshStandardMaterial color="#59452b" side={T.DoubleSide} />
          </mesh>
          <mesh position={[0, -0.05, 0]} material={lighting.bulb}>
            <sphereGeometry args={[0.055, 12, 8]} />
          </mesh>
          <sprite position={[0, -0.055, 0]} scale={[0.35, 0.35, 1]} material={lighting.halo} />
        </group>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 0, side * 2.1]} material={resources.metal}>
          <tubeGeometry args={[cable, 24, 0.006, 4, false]} />
        </mesh>
      ))}
      {[-1, 1].flatMap((side) =>
        Array.from({ length: 10 }, (_, i) => {
          const x = -2.05 + i * 0.455,
            y = 2.29 - Math.sin((i / 9) * Math.PI) * 0.09;
          return (
            <mesh key={`${side}-${i}`} position={[x, y, side * 2.1]} material={lighting.bulb}>
              <sphereGeometry args={[0.027, 8, 6]} />
            </mesh>
          );
        }),
      )}
      <Batch parts={lighting.eaves} material={lighting.strip} />
      <Batch parts={lighting.crown} material={lighting.accent} />
      <mesh
        name="sunset-bar-deck-light-strip"
        position={[0, 0.116, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={lighting.accent}
      >
        <torusGeometry args={[2.477, 0.012, 6, 96]} />
      </mesh>
      <mesh material={lighting.strip}>
        <tubeGeometry args={[lighting.rim, 80, 0.012, 6, false]} />
      </mesh>
      <mesh
        position={[0, 0.112, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        material={lighting.floor}
        renderOrder={1}
      >
        <planeGeometry args={[4.75, 4.75]} />
      </mesh>
      <primitive object={uplightTarget} />
      <spotLight
        ref={roofLight}
        position={[0, 2.68, 2.05]}
        target={uplightTarget}
        color="#ffc787"
        intensity={0}
        distance={6}
        angle={0.82}
        penumbra={0.85}
        decay={2}
      />
      <pointLight
        ref={barLight}
        position={[0, 1.95, 0]}
        color="#ffd4a0"
        intensity={0}
        distance={6.2}
        decay={2}
      />
    </group>
  );
}
