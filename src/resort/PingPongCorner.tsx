import { useEffect, useMemo } from 'react';
import * as T from 'three';
type V = [number, number, number];
function Bar({ at, size, color, rotation = [0, 0, 0] }: { at: V; size: V; color: string; rotation?: V }) {
  return (
    <mesh position={at} rotation={rotation} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.65} />
    </mesh>
  );
}
function Paddle({ at, turn = 0 }: { at: V; turn?: number }) {
  return (
    <group position={at} rotation={[0, turn, 0]}>
      <mesh scale={[0.095, 0.009, 0.12]} castShadow>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color="#c67524" roughness={0.73} />
      </mesh>
      <mesh position={[0, -0.008, 0]} scale={[0.096, 0.009, 0.121]}>
        <sphereGeometry args={[1, 24, 12]} />
        <meshStandardMaterial color="#c8a471" roughness={0.8} />
      </mesh>
      <Bar at={[0, -0.003, 0.17]} size={[0.04, 0.021, 0.12]} color="#b78d59" />
    </group>
  );
}
export default function PingPongCorner() {
  const net = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, 256, 64);
    g.strokeStyle = '#aab8b1';
    g.lineWidth = 1.3;
    for (let x = 0; x < 256; x += 6) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, 64);
      g.stroke();
    }
    for (let y = 0; y < 64; y += 6) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(256, y);
      g.stroke();
    }
    const t = new T.CanvasTexture(c);
    t.colorSpace = T.SRGBColorSpace;
    return t;
  }, []);
  useEffect(() => () => net.dispose(), [net]);
  return (
    <group position={[-6.4, 0.98, 7.5]}>
      <Bar at={[0, -0.02, 0]} size={[2.35, 0.04, 3.65]} color="#c7b593" />
      {[-1, 1].map((end) => (
        <group key={end}>
          <Bar at={[0, 0.73, end * 0.6875]} size={[1.525, 0.045, 1.372]} color="#176a9b" />
          <Bar at={[0, 0.695, end * 0.6875]} size={[1.54, 0.025, 1.38]} color="#d3dce0" />
          {[-0.6, 0.6].map((x) => (
            <group key={x}>
              <Bar at={[x, 0.4, end * 0.92]} size={[0.045, 0.61, 0.045]} color="#3d4949" />
              <Bar
                at={[x, 0.37, end * 0.63]}
                size={[0.027, 0.6, 0.027]}
                color="#667474"
                rotation={[end * 0.62, 0, 0]}
              />
              {[-0.03, 0.03].map((dx) => (
                <mesh
                  key={dx}
                  position={[x + dx, 0.05, end * 0.92]}
                  rotation={[0, 0, Math.PI / 2]}
                  castShadow
                >
                  <cylinderGeometry args={[0.045, 0.045, 0.02, 12]} />
                  <meshStandardMaterial color="#2c3437" roughness={0.8} />
                </mesh>
              ))}
            </group>
          ))}
          <Bar at={[0, 0.2, end * 0.92]} size={[1.23, 0.035, 0.035]} color="#485757" />
          <Bar at={[0, 0.66, end * 0.6875]} size={[1.3, 0.045, 0.04]} color="#3e5156" />
        </group>
      ))}
      {[-0.75, 0.75].map((x) => (
        <Bar key={x} at={[x, 0.756, 0]} size={[0.018, 0.004, 2.73]} color="#f0f4eb" />
      ))}
      {[-1.36, 1.36].map((z) => (
        <Bar key={z} at={[0, 0.756, z]} size={[1.52, 0.004, 0.018]} color="#f0f4eb" />
      ))}
      <Bar at={[0, 0.756, 0]} size={[0.008, 0.004, 2.73]} color="#f0f4eb" />
      <mesh position={[0, 0.84, 0]}>
        <planeGeometry args={[1.68, 0.153]} />
        <meshStandardMaterial map={net} transparent alphaTest={0.3} side={T.DoubleSide} roughness={1} />
      </mesh>
      <Bar at={[0, 0.919, 0]} size={[1.7, 0.018, 0.025]} color="#eff1e4" />
      {[-0.84, 0.84].map((x) => (
        <group key={x}>
          <Bar at={[x, 0.825, 0]} size={[0.025, 0.22, 0.025]} color="#687b7a" />
          <Bar at={[x, 0.738, 0]} size={[0.12, 0.025, 0.1]} color="#495e62" />
        </group>
      ))}
      <Paddle at={[-0.35, 0.774, 0.85]} turn={-0.35} />
      <Paddle at={[0.35, 0.774, -0.91]} turn={2.8} />
      <mesh position={[0.15, 0.78, 0.72]} castShadow>
        <sphereGeometry args={[0.025, 16, 12]} />
        <meshStandardMaterial color="#fff8e7" roughness={0.65} />
      </mesh>
    </group>
  );
}
