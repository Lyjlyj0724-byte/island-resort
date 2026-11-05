import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { regionOrigins } from './regionLayout';
import { sampleSurfMotion } from './seaMotion';

const LOCATION = [17, 12] as const;
function outline() {
  const s = new T.Shape();
  s.moveTo(-0.19, -1.43);
  s.bezierCurveTo(-0.33, -1.38, -0.43, -0.75, -0.435, -0.1);
  s.bezierCurveTo(-0.45, 0.65, -0.34, 1.28, -0.16, 1.52);
  s.quadraticCurveTo(0, 1.74, 0.16, 1.52);
  s.bezierCurveTo(0.34, 1.28, 0.45, 0.65, 0.435, -0.1);
  s.bezierCurveTo(0.43, -0.75, 0.33, -1.38, 0.19, -1.43);
  s.quadraticCurveTo(0, -1.49, -0.19, -1.43);
  s.closePath();
  return s;
}
const rocker = (z: number) =>
  Math.pow(Math.max(0, (z - 0.55) / 1.08), 2) * 0.095 + Math.pow(Math.max(0, (-z - 1) / 0.46), 2) * 0.023;

/** A thin, bevelled rail and gently lifted nose, rather than a scaled sphere. */
export function buildSurfboardGeometry() {
  const shape = outline();
  const hullBase = new T.ExtrudeGeometry(shape, {
    depth: 0.074,
    steps: 1,
    bevelEnabled: true,
    bevelSize: 0.025,
    bevelThickness: 0.025,
    bevelSegments: 4,
    curveSegments: 32,
  });
  // Subdivide the caps before adding rocker. Bending only their perimeter
  // would leave long triangles spanning the lifted tips and a floating belly.
  const tessellate = new TessellateModifier(0.2, 7);
  const hull = tessellate.modify(hullBase);
  hullBase.dispose();
  hull.rotateX(Math.PI / 2);
  hull.translate(0, 0.037, 0);
  const hp = hull.getAttribute('position');
  for (let i = 0; i < hp.count; i++) hp.setY(i, hp.getY(i) + rocker(hp.getZ(i)));
  hull.computeVertexNormals();
  const deckBase = new T.ShapeGeometry(shape, 32);
  deckBase.rotateX(Math.PI / 2);
  const idx = deckBase.getIndex()!;
  // ShapeGeometry's face points down after this rotation; reverse the winding.
  for (let i = 0; i < idx.count; i += 3) {
    const b = idx.getX(i + 1);
    idx.setX(i + 1, idx.getX(i + 2));
    idx.setX(i + 2, b);
  }
  const flatDeck = deckBase.toNonIndexed();
  const deck = tessellate.modify(flatDeck);
  deckBase.dispose();
  flatDeck.dispose();
  const dp = deck.getAttribute('position'),
    uv = deck.getAttribute('uv');
  for (let i = 0; i < dp.count; i++) {
    const x = dp.getX(i),
      z = dp.getZ(i);
    dp.setY(i, 0.0635 + rocker(z));
    uv.setXY(i, x / 0.94 + 0.5, (z + 1.5) / 3.2);
  }
  deck.computeVertexNormals();
  const railPoints = shape.getPoints(100).map((p) => new T.Vector3(p.x, 0.042 + rocker(p.y), p.y));
  const rail = new T.TubeGeometry(
    new T.CatmullRomCurve3(railPoints, true, 'centripetal'),
    180,
    0.009,
    6,
    true,
  );
  const cordPoints = [
    new T.Vector3(0, 0.084, -1.17),
    new T.Vector3(0.08, 0.073, -1.38),
    new T.Vector3(0.18, -0.01, -1.59),
  ];
  for (let i = 0; i <= 84; i++) {
    const t = i / 84,
      a = t * Math.PI * 12;
    cordPoints.push(
      new T.Vector3(0.2 + t * 0.2 + Math.sin(a) * 0.055, -0.016 + Math.cos(a) * 0.009, -1.6 - t * 0.39),
    );
  }
  const cord = new T.TubeGeometry(new T.CatmullRomCurve3(cordPoints), 144, 0.007, 6, false);
  const finShape = new T.Shape();
  finShape.moveTo(-0.18, 0);
  finShape.lineTo(0.18, 0);
  finShape.quadraticCurveTo(0.13, -0.15, -0.17, -0.26);
  finShape.quadraticCurveTo(-0.27, -0.14, -0.18, 0);
  const fin = new T.ExtrudeGeometry(finShape, {
    depth: 0.018,
    bevelEnabled: true,
    bevelSize: 0.004,
    bevelThickness: 0.004,
    bevelSegments: 2,
    curveSegments: 16,
  });
  fin.rotateY(Math.PI / 2);
  fin.translate(-0.009, -0.055, -0.99);
  return { hull, deck, rail, cord, fin };
}
function deckTexture() {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 1024;
  const ctx = c.getContext('2d')!;
  const blue = ctx.createLinearGradient(0, 0, c.width, 0);
  blue.addColorStop(0, '#267d98');
  blue.addColorStop(0.3, '#359fbc');
  blue.addColorStop(0.72, '#3daac2');
  blue.addColorStop(1, '#287f9b');
  ctx.fillStyle = blue;
  ctx.fillRect(0, 0, 384, 1024);
  // A yellow diagonal nose band and warm pinstripes recall the blue boards in
  // their surfing photograph, without adding made-up branding.
  ctx.fillStyle = '#efc957';
  ctx.beginPath();
  ctx.moveTo(0, 162);
  ctx.lineTo(384, 84);
  ctx.lineTo(384, 192);
  ctx.lineTo(0, 270);
  ctx.closePath();
  ctx.fill();
  for (const [y, color, width] of [
    [155, '#eff0d9', 7],
    [275, '#c67a64', 5],
    [787, '#eac561', 7],
    [833, '#c47b68', 5],
    [906, '#ecebd8', 6],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(384, y - 78);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e9f3dd';
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(192, 300);
  ctx.lineTo(192, 734);
  ctx.stroke();
  ctx.globalAlpha = 1;
  // Fine deterministic foam texture is intentionally subtle at close range.
  for (let i = 0; i < 5200; i++) {
    const x = (i * 71.37) % 384,
      y = (i * 137.29) % 1024;
    ctx.fillStyle = i % 2 ? 'rgba(255,255,245,.04)' : 'rgba(0,55,75,.04)';
    ctx.fillRect(x, y, 0.8, 0.8);
  }
  const texture = new T.CanvasTexture(c);
  texture.colorSpace = T.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export default function Surfboard() {
  const board = useRef<T.Group>(null);
  const geometries = useMemo(buildSurfboardGeometry, []);
  const map = useMemo(deckTexture, []);
  const initial = useMemo(() => sampleSurfMotion(0, regionOrigins.sabah[0] + LOCATION[0], LOCATION[1]), []);
  useEffect(
    () => () => {
      Object.values(geometries).forEach((g) => g.dispose());
      map.dispose();
    },
    [geometries, map],
  );
  useFrame(({ clock }) => {
    if (!board.current) return;
    const motion = sampleSurfMotion(clock.elapsedTime, regionOrigins.sabah[0] + LOCATION[0], LOCATION[1]);
    board.current.position.set(LOCATION[0] + motion.x, motion.y, LOCATION[1] + motion.z);
    board.current.rotation.set(motion.pitch, motion.yaw, motion.roll, 'YXZ');
  });
  return (
    <group
      ref={board}
      position={[LOCATION[0] + initial.x, initial.y, LOCATION[1] + initial.z]}
      rotation={[initial.pitch, initial.yaw, initial.roll, 'YXZ']}
    >
      <mesh geometry={geometries.hull} castShadow receiveShadow>
        <meshPhysicalMaterial color="#287c92" roughness={0.38} clearcoat={0.28} clearcoatRoughness={0.42} />
      </mesh>
      <mesh geometry={geometries.deck} castShadow receiveShadow>
        <meshStandardMaterial map={map} roughness={0.56} />
      </mesh>
      <mesh geometry={geometries.rail} castShadow>
        <meshStandardMaterial color="#b9d7d3" roughness={0.42} />
      </mesh>
      <mesh geometry={geometries.fin} castShadow>
        <meshStandardMaterial color="#254c58" roughness={0.4} />
      </mesh>
      <mesh geometry={geometries.cord} castShadow>
        <meshStandardMaterial color="#394849" roughness={0.82} />
      </mesh>
      <mesh position={[0, 0.086, -1.17]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.027, 0.005, 6, 20]} />
        <meshStandardMaterial color="#cbd3ce" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.078, -1.17]}>
        <cylinderGeometry args={[0.026, 0.026, 0.013, 18]} />
        <meshStandardMaterial color="#3d5961" roughness={0.8} />
      </mesh>
      <mesh position={[0.43, -0.018, -2.02]} rotation={[-Math.PI / 2, 0.12, 0]}>
        <torusGeometry args={[0.055, 0.017, 7, 24]} />
        <meshStandardMaterial color="#3d5050" roughness={0.9} />
      </mesh>
    </group>
  );
}
