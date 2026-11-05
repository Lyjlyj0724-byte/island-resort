import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as T from 'three';
import { riverEdge } from './riverLayout';

const random = (n: number) => T.MathUtils.euclideanModulo(Math.sin(n * 127.1 + 311.7) * 43758.5453, 1);
type Item = {
  position: [number, number, number];
  scale: [number, number, number];
  turn: number;
  color: string;
};

function bankGeometry() {
  const positions: number[] = [],
    colors: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  const offsets = [-0.055, 0.13, 0.43, 0.82, 1.4];
  const levels = [0.738, 0.779, 0.834, 0.79, 0.704];
  const shades = ['#555d40', '#73724e', '#8c8b64', '#7e8659', '#899469'];
  for (const side of [-1, 1]) {
    const start = positions.length / 3;
    for (let row = 0; row <= 172; row++) {
      const z = -22 + row * 0.25,
        edge = riverEdge(z, side);
      for (let col = 0; col < offsets.length; col++) {
        const u = col / (offsets.length - 1),
          variation = 1 + Math.sin(z * 0.68 + side) * 0.11;
        const x = edge + side * offsets[col] * variation,
          y = levels[col] + Math.sin(z * 3.7 + side) * 0.009 * Math.sin(u * Math.PI);
        positions.push(x, y, z);
        uv.push(x * 0.9, z * 0.9);
        const color = new T.Color(shades[col]).multiplyScalar(
          0.93 + random(row * 11 + col * 31 + side) * 0.13,
        );
        colors.push(color.r, color.g, color.b);
        if (row < 172 && col < 4) {
          const a = start + row * 5 + col;
          const tris =
            side > 0 ? [a, a + 5, a + 1, a + 1, a + 5, a + 6] : [a, a + 1, a + 5, a + 1, a + 6, a + 5];
          indices.push(...tris);
        }
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function gritTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#a7a99b';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8500; i++) {
    const v = random(i + 8);
    ctx.fillStyle = v > 0.5 ? 'rgba(235,229,190,.25)' : 'rgba(35,43,25,.22)';
    ctx.beginPath();
    ctx.ellipse(
      random(i + 91) * 256,
      random(i + 341) * 256,
      0.5 + v * 1.2,
      0.45 + v * 0.7,
      v * 6,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
function rockGeometry() {
  const g = new T.IcosahedronGeometry(1, 2),
    p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      scale = 1 + Math.sin(x * 7.3 + z * 3.1) * Math.sin(y * 6.4 - z * 2.8) * 0.13;
    p.setXYZ(i, x * scale, y * scale, z * scale);
  }
  g.computeVertexNormals();
  return g;
}
function grassGeometry() {
  const p: number[] = [],
    colors: number[] = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = blade * 2.4,
      width = 0.012 + random(blade + 17) * 0.012,
      h = 0.22 + random(blade + 13) * 0.3;
    const dir = new T.Vector3(Math.cos(angle), 0, Math.sin(angle)),
      across = new T.Vector3(-dir.z, 0, dir.x);
    const rows: T.Vector3[][] = [];
    for (let row = 0; row < 5; row++) {
      const t = row / 4,
        center = dir.clone().multiplyScalar(t * t * h * 0.4);
      center.y = h * t;
      rows.push([
        center.clone().addScaledVector(across, width * (1 - t)),
        center.clone().addScaledVector(across, -width * (1 - t)),
      ]);
    }
    for (let row = 0; row < 4; row++) {
      const corners = [
        rows[row][0],
        rows[row + 1][0],
        rows[row][1],
        rows[row][1],
        rows[row + 1][0],
        rows[row + 1][1],
      ];
      corners.forEach((v) => {
        p.push(v.x, v.y, v.z);
        const shade = 0.62 + (v.y / h) * 0.38;
        colors.push(shade, shade, shade * 0.82);
      });
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}
function place(mesh: T.InstancedMesh | null, items: Item[]) {
  if (!mesh) return;
  const object = new T.Object3D(),
    color = new T.Color();
  items.forEach((item, i) => {
    object.position.set(...item.position);
    object.scale.set(...item.scale);
    object.rotation.set(0, item.turn, 0);
    object.updateMatrix();
    mesh.setMatrixAt(i, object.matrix);
    mesh.setColorAt(i, color.set(item.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

export default function LiRiverBanks() {
  const rocks = useRef<T.InstancedMesh>(null),
    grasses = useRef<T.InstancedMesh>(null);
  const resources = useMemo(
    () => ({ bank: bankGeometry(), rock: rockGeometry(), grass: grassGeometry(), grit: gritTexture() }),
    [],
  );
  const placement = useMemo(() => {
    const stones: Item[] = [],
      grass: Item[] = [];
    for (let i = 0; i < 470; i++) {
      const side = i % 2 ? 1 : -1,
        z = -20.5 + random(i + 8) * 40;
      // Gravel collects in patches, leaving irregular stretches of wet silt visible.
      if (Math.sin(z * 0.67 + side * 3) + random(i + 18) < 0.23) continue;
      const distance = -0.1 + random(i + 71) * 0.88,
        x = riverEdge(z, side) + side * distance;
      const size = 0.045 + Math.pow(random(i + 318), 3) * 0.24;
      const y = distance < 0.12 ? 0.764 : distance < 0.55 ? 0.82 : 0.79;
      stones.push({
        position: [x, y + size * 0.19, z],
        scale: [size * (0.8 + random(i + 97) * 0.8), size * 0.48, size * (0.75 + random(i + 64) * 0.8)],
        turn: random(i + 28) * 6.28,
        color: ['#757760', '#8f8d73', '#565f4b', '#a4a083'][i % 4],
      });
    }
    for (let i = 0; i < 140; i++) {
      const side = i % 2 ? 1 : -1,
        z = -18 + random(i + 411) * 36;
      if ((side > 0 && z > -3) || (side < 0 && z > 8 && z < 15)) continue;
      if (Math.sin(z * 0.8 + side) < -0.15) continue;
      const s = 0.65 + random(i + 547) * 0.7;
      grass.push({
        position: [riverEdge(z, side) + side * (0.45 + random(i + 94) * 0.55), 0.79, z],
        scale: [s, s, s],
        turn: random(i + 25) * 6.28,
        color: i % 3 ? '#667847' : '#8b8c51',
      });
    }
    return { stones, grass };
  }, []);
  useLayoutEffect(() => {
    place(rocks.current, placement.stones);
    place(grasses.current, placement.grass);
  }, [placement]);
  useEffect(
    () => () => {
      Object.values(resources).forEach((x) => x.dispose());
    },
    [resources],
  );
  return (
    <group>
      <mesh geometry={resources.bank} receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={resources.grit}
          bumpMap={resources.grit}
          bumpScale={0.018}
          roughness={0.88}
          side={T.DoubleSide}
        />
      </mesh>
      <instancedMesh
        ref={rocks}
        args={[resources.rock, undefined, placement.stones.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial roughness={0.83} />
      </instancedMesh>
      <instancedMesh
        ref={grasses}
        args={[resources.grass, undefined, placement.grass.length]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial vertexColors side={T.DoubleSide} roughness={0.95} />
      </instancedMesh>
    </group>
  );
}
