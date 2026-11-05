import { useEffect, useMemo } from 'react';
import * as T from 'three';

function Beam({
  from,
  to,
  width = 0.065,
  color = '#88715b',
}: {
  from: [number, number, number];
  to: [number, number, number];
  width?: number;
  color?: string;
}) {
  const { mid, q, length } = useMemo(() => {
    const a = new T.Vector3(...from),
      b = new T.Vector3(...to),
      d = b.clone().sub(a);
    return {
      mid: a.add(b).multiplyScalar(0.5),
      q: new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()),
      length: d.length(),
    };
  }, [from, to]);
  return (
    <mesh position={mid} quaternion={q} castShadow receiveShadow>
      <boxGeometry args={[width, length, width]} />
      <meshStandardMaterial color={color} roughness={0.8} />
    </mesh>
  );
}
export default function SunsetApproach() {
  const rock = useMemo(() => {
    const g = new T.IcosahedronGeometry(1, 2);
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i),
        n = 1 + Math.sin(x * 6 + y * 3) * Math.cos(z * 8) * 0.16;
      p.setXYZ(i, x * n, y * n, z * n);
    }
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => rock.dispose(), [rock]);
  return (
    <>
      <group position={[-14, 0.15, 12]}>
        {Array.from({ length: 31 }, (_, i) => {
          const a = (i / 31) * Math.PI * 2,
            r = 3.12 + Math.sin(i * 2.8) * 0.18;
          return (
            <mesh
              key={i}
              geometry={rock}
              position={[Math.cos(a) * r, 0.02 + Math.sin(i * 3) * 0.04, Math.sin(a) * r * 0.93]}
              rotation={[i * 0.1, i * 2.3, i * 0.07]}
              scale={[0.28 + (i % 3) * 0.09, 0.19 + (i % 4) * 0.055, 0.32 + (i % 2) * 0.12]}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial color={['#86867b', '#9c9b8b', '#737c72'][i % 3]} roughness={1} />
            </mesh>
          );
        })}
      </group>
      <group position={[-10.65, 1.03, 9.7]} rotation={[0, 0.6, 0]}>
        <mesh position={[0, -0.14, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.7, 0.2, 1.1]} />
          <meshStandardMaterial color="#6e5c49" roughness={0.9} />
        </mesh>
        {Array.from({ length: 23 }, (_, i) => (
          <mesh key={i} position={[-2.2 + i * 0.2, 0, 0]} receiveShadow castShadow>
            <boxGeometry args={[0.187, 0.07, 1.14]} />
            <meshStandardMaterial color={i % 3 === 0 ? '#b49c7c' : '#a68e70'} roughness={0.9} />
          </mesh>
        ))}
        {[-1, 1].map((side) => (
          <group key={side}>
            {[-1.8, -0.6, 0.6, 1.8].map((x) => (
              <Beam key={x} from={[x, -0.12, side * 0.54]} to={[x, 0.64, side * 0.54]} />
            ))}
            <Beam from={[-2.2, 0.62, side * 0.54]} to={[2.2, 0.62, side * 0.54]} width={0.075} />
            <Beam from={[-2.2, 0.3, side * 0.54]} to={[2.2, 0.3, side * 0.54]} width={0.035} />
          </group>
        ))}
      </group>
    </>
  );
}
