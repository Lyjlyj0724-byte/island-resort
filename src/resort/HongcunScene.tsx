import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as T from 'three';
import HongcunArchitecture, { useHongcunMaterials } from './HongcunArchitecture';
import type { HongcunMaterials } from './HongcunArchitecture';
import HongcunPond from './HongcunPond';

type V = [number, number, number];
type Part = { p: V; s: V; r?: V; color?: string };
export type HongcunSpot = 'moonpond' | 'huizhou' | 'lakeside' | 'courtyard';
type Props = { night: boolean; onSelect: (id: HongcunSpot) => void };
const random = (n: number) => T.MathUtils.euclideanModulo(Math.sin(n * 91.71 + 73.13) * 21783.31, 1);

// Coordinates are a memory-inspired miniature, with a real open basin at its centre.
// The water's straight rear edge and curved front bank form the distinctive Moon Pond.
function pondPath(expansion = 0) {
  const path = new T.Path();
  path.moveTo(-10 - expansion, 2 + expansion);
  path.lineTo(10 + expansion, 2 + expansion);
  path.lineTo(10 + expansion, 2);
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI;
    path.lineTo((10 + expansion) * Math.cos(t), 2 - (13 + expansion) * Math.sin(t));
  }
  path.lineTo(-10 - expansion, 2 + expansion);
  path.closePath();
  return path;
}
function groundGeometry() {
  const shape = new T.Shape();
  const points = [
    [-13, -20],
    [-3, -22],
    [9, -21],
    [15, -16],
    [17, -7],
    [17, 7],
    [16.5, 15.5],
    [10, 19],
    [-1, 20],
    [-11.5, 18],
    [-16.7, 12],
    [-18, 2],
    [-17, -10],
  ];
  const curve = new T.CatmullRomCurve3(
    points.map(([x, z]) => new T.Vector3(x, -z, 0)),
    true,
    'centripetal',
  );
  curve.getPoints(128).forEach((p, i) => (i ? shape.lineTo(p.x, p.y) : shape.moveTo(p.x, p.y)));
  shape.closePath();
  shape.holes.push(pondPath(0.02));
  const geometry = new T.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: false, curveSegments: 64 });
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 5.3, uv.getY(i) / 5.3);
  return geometry;
}
function pavingGeometry() {
  const ring = new T.Shape();
  ring.moveTo(-11.25, 3.15);
  ring.lineTo(11.25, 3.15);
  ring.lineTo(11.25, 2);
  for (let i = 0; i <= 96; i++) {
    const t = (i / 96) * Math.PI;
    ring.lineTo(11.25 * Math.cos(t), 2 - 14.25 * Math.sin(t));
  }
  ring.closePath();
  ring.holes.push(pondPath(0.03));
  return new T.ShapeGeometry(ring, 64);
}
function Batch({
  parts,
  material,
  kind = 'box',
}: {
  parts: Part[];
  material: T.Material;
  kind?: 'box' | 'leaf' | 'petal' | 'branch';
}) {
  const ref = useRef<T.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const m = new T.Matrix4(),
      q = new T.Quaternion(),
      c = new T.Color();
    parts.forEach((p, i) => {
      q.setFromEuler(new T.Euler(...(p.r ?? [0, 0, 0])));
      m.compose(new T.Vector3(...p.p), q, new T.Vector3(...p.s));
      ref.current!.setMatrixAt(i, m);
      if (p.color) ref.current!.setColorAt(i, c.set(p.color));
    });
    ref.current.instanceMatrix.needsUpdate = true;
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, parts.length]} castShadow receiveShadow>
      {kind === 'box' ? (
        <boxGeometry />
      ) : kind === 'branch' ? (
        <cylinderGeometry args={[0.66, 1, 1, 8]} />
      ) : kind === 'petal' ? (
        <sphereGeometry args={[1, 8, 6]} />
      ) : (
        <icosahedronGeometry args={[1, 2]} />
      )}
    </instancedMesh>
  );
}
function branch(from: V, to: V, width: number): Part {
  const a = new T.Vector3(...from),
    b = new T.Vector3(...to),
    d = b.clone().sub(a),
    q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.clone().normalize()),
    r = new T.Euler().setFromQuaternion(q);
  return {
    p: a.add(b).multiplyScalar(0.5).toArray() as V,
    s: [width, d.length(), width],
    r: [r.x, r.y, r.z],
  };
}
// Cutout twigs give the canopy air and a leaf-sized silhouette, with no sorted
// transparency and only one instanced draw per tree group.
function makeLeafTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.strokeStyle = '#59604b';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(117, 242);
  ctx.bezierCurveTo(139, 172, 107, 99, 132, 15);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? -1 : 1,
      py = 32 + i * 16,
      px = 126 + Math.sin(i * 0.8) * 7,
      tipX = px + side * (35 + random(i + 930) * 29),
      tipY = py - 20 - random(i + 950) * 20;
    ctx.strokeStyle = '#60704b';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(px, py + 7);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    const cx = (px + tipX) / 2,
      cy = (py + tipY) / 2,
      g = ctx.createLinearGradient(px, py, tipX, tipY);
    g.addColorStop(0, '#60744c');
    g.addColorStop(0.55, ['#9aa57a', '#87986c', '#a6af83'][i % 3]);
    g.addColorStop(1, '#6d8254');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.quadraticCurveTo(cx + side * 18, cy + 7, tipX, tipY);
    ctx.quadraticCurveTo(cx - side * 7, cy - 18, px, py);
    ctx.fill();
    ctx.strokeStyle = 'rgba(206,216,156,.5)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }
  const map = new T.CanvasTexture(c);
  map.colorSpace = T.SRGBColorSpace;
  map.anisotropy = 4;
  return map;
}
function LeafCards({ parts }: { parts: Part[] }) {
  const ref = useRef<T.InstancedMesh>(null);
  const assets = useMemo(() => {
    const map = makeLeafTexture();
    return {
      map,
      mat: new T.MeshStandardMaterial({
        map,
        alphaTest: 0.42,
        side: T.DoubleSide,
        roughness: 0.95,
        color: '#dce1c7',
      }),
      depth: new T.MeshDepthMaterial({
        map,
        alphaTest: 0.42,
        depthPacking: T.RGBADepthPacking,
        side: T.DoubleSide,
      }),
    };
  }, []);
  useLayoutEffect(() => {
    const obj = new T.Object3D(),
      color = new T.Color();
    parts.forEach((p, i) => {
      obj.position.set(...p.p);
      obj.rotation.set(...(p.r ?? [0, 0, 0]));
      obj.scale.set(...p.s);
      obj.updateMatrix();
      ref.current!.setMatrixAt(i, obj.matrix);
      ref.current!.setColorAt(i, color.set(p.color ?? '#ffffff'));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.instanceColor!.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [parts]);
  useEffect(
    () => () => {
      assets.map.dispose();
      assets.mat.dispose();
      assets.depth.dispose();
    },
    [assets],
  );
  return (
    <instancedMesh
      ref={ref}
      args={[undefined, assets.mat, parts.length]}
      customDepthMaterial={assets.depth}
      castShadow
      receiveShadow
    >
      <planeGeometry />
    </instancedMesh>
  );
}
function petalGeometry() {
  const vertices: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  // Thin pointed, cupped magnolia petals rather than capsule-shaped solids.
  for (let row = 0; row <= 8; row++) {
    const t = row / 8,
      w = Math.pow(Math.sin(Math.PI * t), 0.7) * 0.52;
    for (let side = 0; side <= 4; side++) {
      const u = (side / 4) * 2 - 1;
      vertices.push(u * w, t, Math.sin(t * Math.PI) * 0.18 + u * u * 0.13);
      uv.push(side / 4, t);
    }
  }
  for (let row = 0; row < 8; row++)
    for (let side = 0; side < 4; side++) {
      const a = row * 5 + side;
      indices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function Petals({ parts, m }: { parts: Part[]; m: T.Material }) {
  const ref = useRef<T.InstancedMesh>(null),
    geo = useMemo(petalGeometry, []);
  useLayoutEffect(() => {
    const o = new T.Object3D(),
      c = new T.Color();
    parts.forEach((p, i) => {
      o.position.set(...p.p);
      o.rotation.set(...(p.r ?? [0, 0, 0]));
      o.scale.set(...p.s);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
      ref.current!.setColorAt(i, c.set(p.color ?? '#fff8ed'));
    });
    ref.current!.instanceMatrix.needsUpdate = true;
    ref.current!.instanceColor!.needsUpdate = true;
    ref.current!.computeBoundingSphere();
  }, [parts]);
  useEffect(() => () => geo.dispose(), [geo]);
  return <instancedMesh ref={ref} args={[geo, m, parts.length]} castShadow receiveShadow />;
}
function Landscape({ m }: { m: HongcunMaterials }) {
  const geometries = useMemo(() => ({ ground: groundGeometry(), paving: pavingGeometry() }), []);
  useEffect(
    () => () => {
      geometries.ground.dispose();
      geometries.paving.dispose();
    },
    [geometries],
  );
  const stones = useMemo<Part[]>(() => {
    const p: Part[] = [];
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 72; i++) {
        const t = ((i + 0.5) / 72) * Math.PI,
          rx = 10.3 + row * 0.52,
          rz = 13.3 + row * 0.52;
        p.push({
          p: [rx * Math.cos(t), 1.085 + random(i + row * 90) * 0.013, -2 + rz * Math.sin(t)],
          s: [0.6 + random(i + 20) * 0.02, 0.11, 0.46 + random(i) * 0.02],
          r: [0, Math.atan2(-rz * Math.cos(t), -rx * Math.sin(t)), 0],
          color: ['#c5c8ba', '#afb5aa', '#d0d0bd', '#b8beb1'][i % 4],
        });
      }
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 32; i++)
        p.push({
          p: [-10.25 + i * 0.66, 1.09, -2.28 - row * 0.49],
          s: [0.63, 0.12, 0.45],
          color: i % 3 ? '#c0c5b5' : '#d2d2c2',
        });
    // Thin curb edge and the dark, damp stone courses descending into the water.
    for (let i = 0; i < 84; i++) {
      const t = ((i + 0.5) / 84) * Math.PI;
      p.push({
        p: [10.055 * Math.cos(t), 0.84, -2 + 13.055 * Math.sin(t)],
        s: [0.54, 0.43, 0.16],
        r: [0, Math.atan2(-13.055 * Math.cos(t), -10.055 * Math.sin(t)), 0],
        color: '#818e7d',
      });
    }
    for (let i = 0; i < 38; i++)
      p.push({ p: [-9.75 + i * 0.527, 0.84, -2.02], s: [0.51, 0.43, 0.16], color: '#88917e' });
    // Joined alleys turn through the actual gaps beside the houses. The waterside
    // promenade forks into the outer lanes, which also meet the quieter rear lane.
    const lanes: { points: [number, number][]; width: number; seed: number }[] = [
      {
        points: [
          [-13.8, -8.15],
          [-11.4, -8.02],
          [-8.2, -8.18],
          [-3.5, -8.48],
          [2.7, -8.48],
          [5, -8.37],
          [8.5, -8.24],
          [14.65, -8.03],
        ],
        width: 0.62,
        seed: 101,
      },
      {
        points: [
          [-15.72, 10.3],
          [-15.9, 5.7],
          [-15.86, -0.1],
          [-15.7, -5.8],
          [-15.45, -7.4],
          [-14.65, -8.05],
          [-13.8, -8.15],
        ],
        width: 0.86,
        seed: 201,
      },
      {
        points: [
          [15.88, 7.1],
          [16.02, 3.6],
          [15.91, -0.4],
          [15.82, -5.6],
          [15.6, -7.4],
          [14.65, -8.03],
        ],
        width: 0.84,
        seed: 301,
      },
      {
        points: [
          [-11.1, -2.18],
          [-12.25, -2.05],
          [-13.6, -2.26],
          [-14.6, -2.5],
          [-15.78, -2.55],
        ],
        width: 0.66,
        seed: 401,
      },
      {
        points: [
          [11.12, -2.17],
          [12.3, -2.08],
          [13.7, -2.3],
          [14.7, -2.64],
          [15.86, -2.7],
        ],
        width: 0.64,
        seed: 501,
      },
      // A slim dogleg between the rear compounds reaches a tree-shaded walking loop.
      {
        points: [
          [-6.68, -8.24],
          [-6.68, -10.4],
          [-6.62, -13.2],
          [-6.7, -14.5],
          [-8.2, -14.55],
          [-11.7, -14.35],
          [-14.6, -14.1],
          [-15.2, -12.6],
          [-15.25, -9.6],
          [-14.65, -8.05],
        ],
        width: 0.5,
        seed: 601,
      },
    ];
    const placed: { x: number; z: number }[] = [];
    for (const lane of lanes) {
      const curve = new T.CatmullRomCurve3(
        lane.points.map(([x, z]) => new T.Vector3(x, 0, z)),
        false,
        'centripetal',
      );
      const count = Math.ceil(curve.getLength() / 0.47);
      for (let row = 0; row < count; row++)
        for (let col = 0; col < 2; col++) {
          const t = Math.min(1, (row + 0.5 + (col ? 0.16 : 0)) / count),
            v = curve.getPointAt(t),
            dir = curve.getTangentAt(t),
            side = (col - 0.5) * lane.width * 0.5;
          const x = v.x + dir.z * side,
            z = v.z - dir.x * side,
            n = lane.seed + row * 13 + col * 7;
          // Junctions share paving instead of piling one full strip over another.
          if (placed.some((q) => Math.hypot(q.x - x, q.z - z) < lane.width * 0.22)) continue;
          placed.push({ x, z });
          p.push({
            p: [x, 1.105 + random(n) * 0.008, z],
            s: [lane.width * 0.5 - 0.023, 0.075, 0.425 + random(n + 9) * 0.025],
            r: [0, Math.atan2(dir.x, dir.z) + (random(n + 4) - 0.5) * 0.025, 0],
            color: ['#c5c9bc', '#b6bdb0', '#d0d0c0', '#bfc4b6'][n % 4],
          });
        }
    }
    // Small water-access landings are inset against the bank; the lowest tread
    // disappears under the pond, while the lane above stays continuous.
    for (const x of [-5.1, 6.6])
      for (let i = 0; i < 3; i++)
        p.push({
          p: [x, 1.01 - i * 0.13, -1.9 + i * 0.27],
          s: [1.05 - i * 0.05, 0.13, 0.33],
          color: ['#aab2a5', '#899b88', '#6f8375'][i],
        });
    return p;
  }, []);
  const patina = useMemo(() => {
    const moss: Part[] = [],
      fallen: Part[] = [],
      grates: Part[] = [];
    for (let i = 0; i < 75; i++) {
      const t = random(i + 800) * Math.PI,
        x = 10.065 * Math.cos(t),
        z = -2 + 13.065 * Math.sin(t),
        a = Math.atan2(-13.065 * Math.cos(t), -10.065 * Math.sin(t));
      moss.push({
        p: [x, 0.94 + random(i + 44) * 0.08, z],
        s: [0.09 + random(i) * 0.2, 0.015 + random(i + 1) * 0.025, 0.04],
        r: [0, a, 0],
        color: ['#5c745a', '#788565', '#87916e'][i % 3],
      });
    }
    for (let i = 0; i < 32; i++) {
      const a = random(i + 900) * 6.3,
        r = 0.4 + random(i + 630) * 2;
      fallen.push({
        p: [-15.8 + Math.cos(a) * r, 1.15, 9.5 + Math.sin(a) * r],
        s: [0.035, 0.006, 0.085],
        r: [0, a, 0.1],
        color: ['#8a8060', '#a89a72', '#727d53'][i % 3],
      });
    }
    // A pair of tiny stone drains at the side alley mouths.
    for (const x of [-10.7, 10.7])
      for (let i = 0; i < 5; i++)
        grates.push({ p: [x + (i - 2) * 0.09, 1.155, -1.7], s: [0.035, 0.018, 0.34], color: '#56665c' });
    return { moss, fallen, grates };
  }, []);
  return (
    <>
      <mesh
        geometry={geometries.ground}
        material={m.paving}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.25, 0]}
        receiveShadow
        castShadow
      />
      <mesh
        geometry={geometries.paving}
        material={m.stone}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 1.06, 0]}
        receiveShadow
      />
      <Batch parts={stones} material={m.stone} />
      <Batch parts={patina.moss} kind="leaf" material={m.leaf} />
      <Batch parts={patina.fallen} kind="petal" material={m.leaf} />
      <Batch parts={patina.grates} material={m.dark} />
    </>
  );
}
function VillageGreenery({ m }: { m: HongcunMaterials }) {
  const plan = useMemo(() => {
    const leaves: Part[] = [],
      trunks: Part[] = [];
    // Loose groves leave pockets of sky above the horse-head walls. Every trunk
    // stands on the rear bank, behind the last courtyard rather than in a roof.
    const trees: [number, number, number, number][] = [
      [-13.2, -15.5, 4.5, 1.45],
      [-11.9, -18.0, 5.7, 1.7],
      [-9.3, -17.1, 4.8, 1.55],
      [-8.0, -19.7, 6.2, 1.8],
      [-5.3, -18.1, 5.1, 1.6],
      [-1.8, -19.8, 5.4, 1.55],
      [0.1, -17.3, 4.65, 1.45],
      [1.8, -20.0, 6.35, 1.8],
      [4.3, -18.3, 5.45, 1.65],
      [6.7, -19.0, 4.75, 1.45],
      [9.0, -17.0, 5.8, 1.7],
      [11.8, -16.1, 5.05, 1.5],
      [13.7, -14.5, 4.2, 1.35],
      [-12.9, -17.4, 3.15, 0.95],
      [-3.8, -20.3, 3.6, 1.1],
      [7.7, -16.4, 3.25, 1.0],
    ];
    trees.forEach(([x, z, h, spread], i) => {
      const n = i * 271 + 5100,
        leanX = (random(n) - 0.5) * 0.46,
        leanZ = (random(n + 1) - 0.5) * 0.4;
      const spine: V[] = [
        [x, 1.05, z],
        [x + leanX * 0.25, 1.05 + h * 0.32, z + leanZ * 0.4],
        [x + leanX, 1.05 + h * 0.65, z + leanZ],
        [x + leanX * 0.7, 1.05 + h, z + leanZ * 0.8],
      ];
      const width = 0.075 + h * 0.018;
      for (let j = 0; j < 3; j++) trunks.push(branch(spine[j], spine[j + 1], width * (1 - j * 0.26)));
      // Root flares and two-stage branches keep the trees readable from the back.
      for (let j = 0; j < 3; j++) {
        const a = j * 2.1 + i;
        trunks.push(
          branch(
            [x, 1.4, z],
            [x + Math.cos(a) * width * 2.2, 1.065, z + Math.sin(a) * width * 2.2],
            width * 0.48,
          ),
        );
      }
      for (let j = 0; j < 6; j++) {
        const a = j * 2.399 + i * 1.17,
          radius = spread * (0.7 + random(n + j + 20) * 0.3),
          start = spine[1 + (j % 2)];
        const mid: V = [
          x + leanX + Math.cos(a) * radius * 0.55,
          1.05 + h * (0.7 + random(n + j + 40) * 0.16),
          z + leanZ + Math.sin(a) * radius * 0.55,
        ];
        const tip: V = [
          x + leanX + Math.cos(a) * radius,
          1.05 + h * (0.82 + random(n + j + 60) * 0.18),
          z + leanZ + Math.sin(a) * radius,
        ];
        trunks.push(branch(start, mid, width * 0.43), branch(mid, tip, width * 0.24));
        for (let fork = 0; fork < 2; fork++) {
          const b = a + (fork ? 1 : -1) * 0.63,
            twig: V = [
              tip[0] + Math.cos(b) * spread * 0.3,
              tip[1] + 0.2 + random(n + j + fork + 80) * 0.35,
              tip[2] + Math.sin(b) * spread * 0.3,
            ];
          trunks.push(branch(mid, twig, width * 0.13));
          for (let k = 0; k < 7; k++) {
            const seed = n + j * 31 + fork * 13 + k,
              size = 0.8 + random(seed + 90) * 0.4,
              angle = k * 2.399 + random(seed) * 0.45,
              reach = Math.sqrt((k + 0.5) / 7) * spread * 0.57;
            leaves.push({
              p: [
                twig[0] + Math.cos(angle) * reach,
                twig[1] + (random(seed + 1) - 0.5) * 0.72,
                twig[2] + Math.sin(angle) * reach,
              ],
              s: [size, size * (0.85 + random(seed + 2) * 0.2), 1],
              r: [
                (random(seed + 3) - 0.5) * 2.8,
                random(seed + 4) * Math.PI * 2,
                (random(seed + 5) - 0.5) * 2.8,
              ],
              color: ['#97aa83', '#bac6a1', '#a9bb91', '#c5ceac'][(i + j + fork) % 4],
            });
          }
        }
      }
    });
    // Low, broken undergrowth grounds the grove without a solid green backdrop.
    for (let i = 0; i < 14; i++) {
      const [x, z] = trees[i];
      for (let j = 0; j < 8; j++) {
        const n = i * 41 + j + 7300,
          a = j * 2.4;
        leaves.push({
          p: [
            x + Math.cos(a) * (0.35 + random(n) * 0.6),
            1.3 + random(n + 1) * 0.52,
            z + Math.sin(a) * (0.3 + random(n + 2) * 0.5),
          ],
          s: [0.65, 0.7, 1],
          r: [random(n + 3) * 2.3, random(n + 4) * 6.3, random(n + 5) * 2],
          color: i % 2 ? '#9cab89' : '#8fa17b',
        });
      }
    }
    for (let i = 0; i < 14; i++) {
      const x = (i % 2 ? -1 : 1) * (16.5 + random(i + 20) * 0.25),
        z = -12 + Math.floor(i / 2) * 2.3;
      for (let j = 0; j < 10; j++)
        leaves.push({
          p: [
            x + (random(i * 23 + j) - 0.5) * 0.9,
            1.32 + random(i + j) * 0.7,
            z + (random(i * 27 + j) - 0.5) * 0.9,
          ],
          s: [0.72, 0.75, 1],
          r: [random(i + j) * 2, random(i * 12 + j) * 6, random(i * 2 + j) * 2],
          color: '#a4b08e',
        });
    }
    return { leaves, trunks };
  }, []);
  return (
    <>
      <Batch parts={plan.trunks} kind="branch" material={m.bark} />
      <LeafCards parts={plan.leaves} />
    </>
  );
}
function WatersideTree({ m, onSelect }: { m: HongcunMaterials; onSelect: () => void }) {
  const plan = useMemo(() => {
    const wood: Part[] = [],
      leaves: Part[] = [];
    const spine: V[] = [
      [-13.4, 1.05, 8.4],
      [-13.32, 2.1, 8.26],
      [-13.07, 3.25, 8.05],
      [-13.2, 4.25, 7.86],
      [-12.92, 5.35, 7.93],
    ];
    for (let i = 0; i < spine.length - 1; i++) wood.push(branch(spine[i], spine[i + 1], 0.3 - i * 0.045));
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39,
        r = 1.7 + random(i + 50) * 0.75,
        start = spine[1 + (i % 3)],
        mid: V = [-13 + Math.cos(a) * r * 0.6, 4.25 + random(i + 30) * 1.1, 8 + Math.sin(a) * r * 0.65],
        end: V = [-13 + Math.cos(a) * r, 5.2 + random(i + 60) * 0.9, 8 + Math.sin(a) * r];
      wood.push(branch(start, mid, 0.12 - i * 0.006), branch(mid, end, 0.065));
      for (let j = 0; j < 3; j++) {
        const tip: V = [
          end[0] + Math.cos(a + j * 1.6) * 0.7,
          end[1] + 0.1 + random(i + j) * 0.5,
          end[2] + Math.sin(a + j * 1.6) * 0.65,
        ];
        wood.push(branch(mid, tip, 0.028));
        for (let k = 0; k < 9; k++) {
          const n = i * 100 + j * 13 + k,
            size = 0.9 + random(n + 300) * 0.35;
          leaves.push({
            p: [
              tip[0] + (random(n) - 0.5) * 1.5,
              tip[1] + (random(n + 1) - 0.5) * 1.25,
              tip[2] + (random(n + 2) - 0.5) * 1.4,
            ],
            s: [size, size, 1],
            r: [(random(n + 3) - 0.5) * 2.8, random(n + 4) * 6.3, (random(n + 5) - 0.5) * 3],
            color: ['#a7b38b', '#c4cba7', '#e0dfbc'][n % 3],
          });
        }
      }
    }
    for (const side of [-1, 1]) wood.push(branch([-13.3, 1.4, 8.4], [-13.3 + side * 0.95, 1.08, 8.9], 0.17));
    return { wood, leaves };
  }, []);
  return (
    <group
      position={[-3, 0, 1.5]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Batch parts={plan.wood} kind="branch" material={m.bark} />
      <LeafCards parts={plan.leaves} />
      <mesh position={[-13, 1.58, 10.1]} material={m.stone} castShadow>
        <boxGeometry args={[2.15, 0.18, 0.5]} />
      </mesh>
      {[-13.8, -12.2].map((x) => (
        <mesh key={x} position={[x, 1.3, 10.1]} material={m.stone}>
          <boxGeometry args={[0.28, 0.46, 0.43]} />
        </mesh>
      ))}
    </group>
  );
}
function Magnolia({ m, onSelect }: { m: HongcunMaterials; onSelect: () => void }) {
  const plan = useMemo(() => {
    const wood: Part[] = [],
      petals: Part[] = [],
      buds: Part[] = [];
    const spine: V[] = [
      [13.7, 1.12, 14.1],
      [13.58, 2.3, 14.12],
      [13.76, 3.45, 14.04],
      [13.62, 4.65, 14.16],
    ];
    for (let i = 0; i < 3; i++) wood.push(branch(spine[i], spine[i + 1], 0.16 - i * 0.036));
    for (let i = 0; i < 9; i++) {
      const a = i * 2.39,
        r = 1.2 + random(i) * 0.7,
        start = spine[1 + (i % 2)],
        mid: V = [13.7 + Math.cos(a) * r * 0.6, 3.8 + random(i + 3) * 0.6, 14.1 + Math.sin(a) * r * 0.55],
        end: V = [13.7 + Math.cos(a) * r, 4.7 + random(i + 3) * 0.85, 14.1 + Math.sin(a) * r];
      wood.push(branch(start, mid, 0.065), branch(mid, end, 0.032));
      for (let j = 0; j < 3; j++) {
        const n = i * 13 + j,
          p: V = [end[0] + Math.sin(n) * 0.38, end[1] + (random(n) - 0.5) * 0.5, end[2] + Math.cos(n) * 0.4];
        wood.push(branch(mid, p, 0.017));
        const size = 0.17 + random(n + 20) * 0.1;
        for (let k = 0; k < 7; k++) {
          const angle = (k / 7) * Math.PI * 2 + n * 0.8;
          petals.push({
            p,
            s: [size * 0.8, size, size * 0.8],
            r: [Math.cos(angle) * 0.7, angle, Math.sin(angle) * 0.7],
            color: k % 3 ? '#fff3eb' : '#eabccf',
          });
        }
        buds.push({ p: [p[0], p[1] + 0.045, p[2]], s: [0.025, 0.055, 0.025], color: '#d0b270' });
      }
    }
    return { wood, petals, buds };
  }, []);
  return (
    <group
      position={[0.8, 0, 0.4]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <Batch parts={plan.wood} kind="branch" material={m.bark} />
      <Petals parts={plan.petals} m={m.flower} />
      <Batch parts={plan.buds} kind="petal" material={m.warm} />
    </group>
  );
}

export default function HongcunScene({ night, onSelect }: Props) {
  const m = useHongcunMaterials(night);
  return (
    <group>
      <Landscape m={m} />
      <VillageGreenery m={m} />
      <HongcunArchitecture
        m={m}
        onHouse={() => onSelect('huizhou')}
        onCourtyard={() => onSelect('courtyard')}
      />
      <HongcunPond night={night} onSelect={() => onSelect('moonpond')} />
      <WatersideTree m={m} onSelect={() => onSelect('lakeside')} />
      <Magnolia m={m} onSelect={() => onSelect('courtyard')} />
    </group>
  );
}
