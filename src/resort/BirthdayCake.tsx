import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type V = [number, number, number];
type MaterialName =
  'cream' | 'icing' | 'berry' | 'blueberry' | 'leaf' | 'gold' | 'plate' | 'wax' | 'waxFace' | 'wick';
type Pieces = Record<MaterialName, T.BufferGeometry[]>;
const keys: MaterialName[] = [
  'cream',
  'icing',
  'berry',
  'blueberry',
  'leaf',
  'gold',
  'plate',
  'wax',
  'waxFace',
  'wick',
];

function place(
  parts: Pieces,
  key: MaterialName,
  geo: T.BufferGeometry,
  at: V = [0, 0, 0],
  scale: V = [1, 1, 1],
  turn: V = [0, 0, 0],
) {
  geo.applyMatrix4(
    new T.Matrix4().compose(
      new T.Vector3(...at),
      new T.Quaternion().setFromEuler(new T.Euler(...turn)),
      new T.Vector3(...scale),
    ),
  );
  if (geo.index) {
    const flat = geo.toNonIndexed();
    geo.dispose();
    geo = flat;
  }
  parts[key].push(geo);
}
function rosette() {
  const p: T.Vector3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48,
      r = 0.038 * (1 - t) + 0.005,
      a = t * Math.PI * 4.8;
    p.push(new T.Vector3(Math.cos(a) * r, 0.006 + t * 0.052, Math.sin(a) * r));
  }
  return new T.TubeGeometry(new T.CatmullRomCurve3(p), 48, 0.012, 7, false);
}
function buildCake() {
  const parts: Pieces = {
    cream: [],
    icing: [],
    berry: [],
    blueberry: [],
    leaf: [],
    gold: [],
    plate: [],
    wax: [],
    waxFace: [],
    wick: [],
  };
  // The entire model starts at the existing tabletop, including its thin plate.
  const plateProfile = [
    new T.Vector2(0, 0),
    new T.Vector2(0.34, 0),
    new T.Vector2(0.415, 0.012),
    new T.Vector2(0.435, 0.029),
    new T.Vector2(0.43, 0.039),
    new T.Vector2(0.39, 0.023),
    new T.Vector2(0, 0.023),
  ];
  place(parts, 'plate', new T.LatheGeometry(plateProfile, 72));
  place(
    parts,
    'gold',
    new T.TorusGeometry(0.429, 0.0045, 8, 72),
    [0, 0.036, 0],
    [1, 1, 1],
    [Math.PI / 2, 0, 0],
  );
  const cakeProfile = [
    new T.Vector2(0, 0.027),
    new T.Vector2(0.302, 0.027),
    new T.Vector2(0.331, 0.041),
    new T.Vector2(0.338, 0.07),
    new T.Vector2(0.338, 0.303),
    new T.Vector2(0.332, 0.33),
    new T.Vector2(0.306, 0.346),
    new T.Vector2(0, 0.346),
  ];
  place(parts, 'cream', new T.LatheGeometry(cakeProfile, 72));
  place(parts, 'icing', new T.CylinderGeometry(0.329, 0.329, 0.018, 72), [0, 0.345, 0]);
  // A very fine combed buttercream finish, with a soft piping border at the base.
  for (let i = 0; i < 9; i++)
    place(
      parts,
      'icing',
      new T.TorusGeometry(0.338, 0.002, 4, 72),
      [0, 0.074 + i * 0.025, 0],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    place(
      parts,
      'icing',
      new T.SphereGeometry(1, 10, 7),
      [Math.sin(a) * 0.326, 0.049, Math.cos(a) * 0.326],
      [0.019, 0.015, 0.019],
    );
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    place(parts, 'icing', rosette(), [Math.sin(a) * 0.278, 0.352, Math.cos(a) * 0.278], [1, 1, 1], [0, a, 0]);
  }
  // Strawberries with tiny inset-looking seeds and a five-leaf calyx.
  for (let i = 0; i < 4; i++) {
    const a = 0.55 + (i * Math.PI) / 2,
      x = Math.sin(a) * 0.215,
      z = Math.cos(a) * 0.215;
    const berry = new T.SphereGeometry(1, 16, 12),
      p = berry.getAttribute('position');
    for (let j = 0; j < p.count; j++) {
      const y = p.getY(j),
        t = (y + 1) / 2;
      p.setXYZ(j, p.getX(j) * (0.72 + 0.28 * (1 - t)), y, p.getZ(j) * (0.72 + 0.28 * (1 - t)));
    }
    berry.computeVertexNormals();
    place(parts, 'berry', berry, [x, 0.398, z], [0.048, 0.061, 0.048], [0, a, 0.16]);
    for (let j = 0; j < 13; j++) {
      const b = j * 2.4,
        y = -0.7 + (j % 5) * 0.29,
        r = Math.sqrt(1 - y * y) * 0.038;
      place(
        parts,
        'gold',
        new T.SphereGeometry(1, 5, 4),
        [x + Math.sin(b) * r, 0.398 + y * 0.054, z + Math.cos(b) * r],
        [0.0018, 0.0032, 0.0015],
      );
    }
    for (let j = 0; j < 5; j++) {
      const b = j * Math.PI * 0.4;
      place(
        parts,
        'leaf',
        new T.SphereGeometry(1, 8, 5),
        [x + Math.sin(b) * 0.014, 0.452, z + Math.cos(b) * 0.014],
        [0.007, 0.0025, 0.022],
        [0, b, -0.22],
      );
    }
  }
  for (let i = 0; i < 7; i++) {
    const a = 0.95 + i * 0.83,
      x = Math.sin(a) * (0.16 + (i % 2) * 0.075),
      z = Math.cos(a) * (0.16 + (i % 2) * 0.075);
    place(parts, 'blueberry', new T.SphereGeometry(0.024, 14, 10), [x, 0.378, z]);
    place(
      parts,
      'waxFace',
      new T.TorusGeometry(0.008, 0.002, 4, 10),
      [x, 0.4, z],
      [1, 1, 1],
      [Math.PI / 2, 0, 0],
    );
  }
  // Two plain candles: the open-source demo does not assume a specific age.
  for (const x of [-0.09, 0.09]) {
    place(parts, 'wax', new T.CylinderGeometry(0.011, 0.013, 0.096, 14), [x, 0.425, 0]);
    place(parts, 'waxFace', new T.CylinderGeometry(0.011, 0.011, 0.002, 14), [x, 0.473, 0]);
    place(parts, 'wick', new T.CylinderGeometry(0.003, 0.003, 0.026, 7), [x, 0.487, 0]);
  }
  return keys.flatMap((key) => {
    if (!parts[key].length) return [];
    const geometry = mergeGeometries(parts[key], false)!;
    parts[key].forEach((g) => g.dispose());
    geometry.computeBoundingSphere();
    return [{ key, geometry }];
  });
}

function CandleFlames({ lit }: { lit: boolean }) {
  const group = useRef<T.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current || !lit) return;
    const t = clock.elapsedTime;
    for (let i = 0; i < group.current.children.length; i++) {
      const flame = group.current.children[i];
      flame.scale.y = 1 + Math.sin(t * 5.1 + i * 1.7) * 0.055;
      flame.rotation.z = Math.sin(t * 4.2 + i) * 0.055;
    }
  });
  return (
    <group ref={group} visible={lit}>
      {[-0.09, 0.09].map((x, i) => (
        <group key={x} position={[x, 0.5, 0]}>
          <mesh position={[0, 0.022, 0]} scale={[0.013, 0.038, 0.013]}>
            <sphereGeometry args={[1, 12, 12]} />
            <meshBasicMaterial color="#ffbd59" toneMapped={false} />
          </mesh>
          <mesh position={[0.002, 0.015, 0.005]} scale={[0.007, 0.024, 0.007]}>
            <sphereGeometry args={[1, 10, 10]} />
            <meshBasicMaterial color={i ? '#fff4c3' : '#fff7db'} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

/** Origin is the tabletop surface; this component deliberately owns no table. */
export default function BirthdayCake({ lit = true }: { lit?: boolean }) {
  const geometry = useMemo(buildCake, []);
  const materials = useMemo<Record<MaterialName, T.MeshStandardMaterial>>(
    () => ({
      cream: new T.MeshStandardMaterial({ color: '#f5e8d5', roughness: 0.72 }),
      icing: new T.MeshStandardMaterial({ color: '#fff5e5', roughness: 0.61 }),
      berry: new T.MeshStandardMaterial({ color: '#bd3542', roughness: 0.37 }),
      blueberry: new T.MeshStandardMaterial({ color: '#414d70', roughness: 0.48 }),
      leaf: new T.MeshStandardMaterial({ color: '#4c794b', roughness: 0.68 }),
      gold: new T.MeshStandardMaterial({ color: '#d7ad66', metalness: 0.65, roughness: 0.3 }),
      plate: new T.MeshStandardMaterial({ color: '#f5eeea', roughness: 0.22, metalness: 0.1 }),
      wax: new T.MeshStandardMaterial({ color: '#c78385', roughness: 0.42 }),
      waxFace: new T.MeshStandardMaterial({ color: '#fff1d8', roughness: 0.52 }),
      wick: new T.MeshStandardMaterial({ color: '#41372d', roughness: 1 }),
    }),
    [],
  );
  useEffect(
    () => () => {
      geometry.forEach((p) => p.geometry.dispose());
      Object.values(materials).forEach((m) => m.dispose());
    },
    [geometry, materials],
  );
  return (
    <group>
      {geometry.map((p) => (
        <mesh key={p.key} geometry={p.geometry} material={materials[p.key]} castShadow receiveShadow />
      ))}
      <CandleFlames lit={lit} />
    </group>
  );
}
