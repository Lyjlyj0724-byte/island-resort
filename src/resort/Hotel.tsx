import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as T from 'three';
import { resortAtmosphere } from './dayCycle';

type Vec3 = [number, number, number];
type Part = { p: Vec3; s: Vec3 };

/** Local, deterministic surface maps: no photographs or remote assets. */
function makeSurface(kind: 'plaster' | 'tiles' | 'curtain') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  let seed = 317;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  if (kind === 'tiles') {
    c.fillStyle = '#874c42';
    c.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++)
      for (let col = -1; col < 16; col++) {
        const x = col * 18 + (row % 2 ? 9 : 0),
          y = row * 32;
        const tone = Math.floor(rnd() * 15);
        const grad = c.createLinearGradient(x, y, x + 18, y);
        grad.addColorStop(0, `rgb(${100 + tone},${55 + tone / 2},${46 + tone / 2})`);
        grad.addColorStop(0.35, `rgb(${169 + tone},${105 + tone / 2},${87 + tone / 2})`);
        grad.addColorStop(1, `rgb(${132 + tone},${74 + tone / 2},${63 + tone / 2})`);
        c.fillStyle = grad;
        c.fillRect(x, y, 17, 31);
        c.fillStyle = 'rgba(45,25,20,.3)';
        c.fillRect(x, y + 29, 18, 2);
        c.fillStyle = 'rgba(235,192,150,.18)';
        c.fillRect(x, y + 2, 17, 1);
      }
  } else if (kind === 'curtain') {
    c.fillStyle = '#c4c0a7';
    c.fillRect(0, 0, 256, 256);
    for (let x = 0; x < 256; x++) {
      const l = 150 + Math.sin(x * 0.22) * 35;
      c.fillStyle = `rgb(${l + 22},${l + 18},${l})`;
      c.fillRect(x, 0, 1, 256);
    }
  } else {
    c.fillStyle = '#eee5d2';
    c.fillRect(0, 0, 256, 256);
  }
  for (let i = 0; i < 9500; i++) {
    const a = rnd() * 0.05;
    c.fillStyle = `rgba(${rnd() > 0.5 ? '255,250,230' : '80,60,35'},${a})`;
    c.fillRect(rnd() * 256, rnd() * 256, rnd() * 2 + 1, 1);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.anisotropy = 4;
  texture.repeat.set(kind === 'tiles' ? 0.72 : 1, kind === 'tiles' ? 0.82 : 1);
  return texture;
}

function makeRoomGlow(spill = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const c = canvas.getContext('2d')!;
  if (spill) {
    const glow = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    glow.addColorStop(0, 'rgba(255,218,158,.85)');
    glow.addColorStop(0.5, 'rgba(255,205,137,.38)');
    glow.addColorStop(1, 'rgba(255,193,113,0)');
    c.fillStyle = glow;
    c.fillRect(0, 0, 128, 128);
  } else {
    // Interior light falls off toward the sill; fine vertical folds retain the room's depth.
    const glow = c.createLinearGradient(0, 0, 0, 128);
    glow.addColorStop(0, '#a7a7a7');
    glow.addColorStop(0.38, '#eeeeee');
    glow.addColorStop(1, '#797979');
    c.fillStyle = glow;
    c.fillRect(0, 0, 128, 128);
    for (let x = 0; x < 128; x++) {
      c.fillStyle = `rgba(15,12,8,${0.025 + 0.025 * (1 + Math.sin(x * 0.28))})`;
      c.fillRect(x, 0, 1, 128);
    }
    c.fillStyle = 'rgba(25,20,14,.12)';
    c.fillRect(0, 98, 128, 3);
  }
  const texture = new T.CanvasTexture(canvas);
  texture.colorSpace = T.SRGBColorSpace;
  return texture;
}

function Batch({
  parts,
  material,
  shadow = true,
}: {
  parts: Part[];
  material: T.Material;
  shadow?: boolean;
}) {
  const ref = useRef<T.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const matrix = new T.Matrix4();
    const q = new T.Quaternion();
    parts.forEach((p, i) => {
      matrix.compose(new T.Vector3(...p.p), q, new T.Vector3(...p.s));
      ref.current!.setMatrixAt(i, matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    ref.current.computeBoundingSphere();
  }, [parts]);
  return (
    <instancedMesh ref={ref} args={[undefined, material, parts.length]} castShadow={shadow} receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
    </instancedMesh>
  );
}

function Roof({ length, material, trim }: { length: number; material: T.Material; trim: T.Material }) {
  const geometry = useMemo(() => {
    const l = length / 2 + 0.32,
      w = 2.28,
      h = 0.95,
      r = Math.max(0.1, l - w * 0.78);
    const v = [
      [-l, 0, -w],
      [l, 0, -w],
      [l, 0, w],
      [-l, 0, w],
      [-r, h, 0],
      [r, h, 0],
    ];
    const idx = [0, 4, 5, 0, 5, 1, 1, 5, 2, 2, 5, 4, 2, 4, 3, 3, 4, 0];
    const g = new T.BufferGeometry();
    g.setAttribute(
      'position',
      new T.Float32BufferAttribute(
        idx.flatMap((i) => v[i]),
        3,
      ),
    );
    g.setAttribute(
      'uv',
      new T.Float32BufferAttribute(
        idx.flatMap((i) => [v[i][0], v[i][2] + v[i][1] * 0.4]),
        2,
      ),
    );
    g.computeVertexNormals();
    return g;
  }, [length]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const trimParts = useMemo<Part[]>(
    () => [
      { p: [0, -0.05, 2.27], s: [length + 0.7, 0.14, 0.12] },
      { p: [0, -0.05, -2.27], s: [length + 0.7, 0.14, 0.12] },
      { p: [0, 0.96, 0], s: [Math.max(0.4, length - 2.9), 0.1, 0.14] },
    ],
    [length],
  );
  return (
    <group position={[0, 4.15, 0]}>
      <mesh geometry={geometry} material={material} castShadow receiveShadow />
      <Batch parts={trimParts} material={trim} />
    </group>
  );
}

function HotelWing({ length, seed }: { length: number; seed: number }) {
  const resources = useMemo(() => {
    const plaster = makeSurface('plaster'),
      tiles = makeSurface('tiles'),
      curtain = makeSurface('curtain');
    const roomGlow = makeRoomGlow(),
      spillGlow = makeRoomGlow(true);
    const tileBump = tiles.clone();
    tileBump.colorSpace = T.NoColorSpace;
    const plasterBump = plaster.clone();
    plasterBump.colorSpace = T.NoColorSpace;
    const wall = new T.MeshStandardMaterial({
      color: '#e1d8c5',
      map: plaster,
      bumpMap: plasterBump,
      bumpScale: 0.018,
      roughness: 0.86,
    });
    const stone = new T.MeshStandardMaterial({ color: '#c3baa5', roughness: 0.92 });
    const recess = new T.MeshStandardMaterial({ color: '#4a4c42', roughness: 0.9 });
    const glass = new T.MeshPhysicalMaterial({
      color: '#4c6663',
      metalness: 0.2,
      roughness: 0.15,
      envMapIntensity: 0.75,
      clearcoat: 0.75,
      clearcoatRoughness: 0.13,
    });
    const amberGlass = glass.clone();
    amberGlass.name = 'hotel-window-amber';
    amberGlass.emissive.set('#ffb961');
    amberGlass.emissiveMap = roomGlow;
    amberGlass.emissiveIntensity = 0;
    const creamGlass = glass.clone();
    creamGlass.name = 'hotel-window-cream';
    creamGlass.emissive.set('#ffdf9d');
    creamGlass.emissiveMap = roomGlow;
    creamGlass.emissiveIntensity = 0;
    const curtains = new T.MeshStandardMaterial({ color: '#d3cbb7', map: curtain, roughness: 1 });
    const litCurtains = curtains.clone();
    litCurtains.name = 'hotel-window-curtains';
    litCurtains.emissive.set('#fbc781');
    litCurtains.emissiveMap = curtain;
    litCurtains.emissiveIntensity = 0;
    const spill = new T.MeshBasicMaterial({
      name: 'hotel-balcony-warm-spill',
      color: '#ffd395',
      map: spillGlow,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: T.AdditiveBlending,
      toneMapped: false,
    });
    const rail = new T.MeshStandardMaterial({ color: '#696b60', metalness: 0.5, roughness: 0.43 });
    const roof = new T.MeshStandardMaterial({
      color: '#ddc4b5',
      map: tiles,
      bumpMap: tileBump,
      bumpScale: 0.055,
      roughness: 0.85,
    });
    const trim = new T.MeshStandardMaterial({ color: '#916052', roughness: 0.8 });
    return {
      wall,
      stone,
      recess,
      glass,
      amberGlass,
      creamGlass,
      curtains,
      litCurtains,
      spill,
      rail,
      roof,
      trim,
      textures: [plaster, tiles, curtain, tileBump, plasterBump, roomGlow, spillGlow],
    };
  }, []);
  useFrame(() => {
    const lamps = resortAtmosphere.lamps;
    resources.amberGlass.emissiveIntensity = lamps * 1.65;
    resources.creamGlass.emissiveIntensity = lamps * 1.25;
    resources.litCurtains.emissiveIntensity = lamps * 0.53;
    resources.spill.opacity = lamps * 0.19;
  });
  useEffect(
    () => () => {
      for (const m of [
        resources.wall,
        resources.stone,
        resources.recess,
        resources.glass,
        resources.amberGlass,
        resources.creamGlass,
        resources.curtains,
        resources.litCurtains,
        resources.spill,
        resources.rail,
        resources.roof,
        resources.trim,
      ])
        m.dispose();
      resources.textures.forEach((t) => t.dispose());
    },
    [resources],
  );
  const detail = useMemo(() => {
    const wall: Part[] = [],
      stone: Part[] = [],
      recess: Part[] = [],
      glass: Part[] = [],
      amberGlass: Part[] = [],
      creamGlass: Part[] = [],
      curtains: Part[] = [],
      litCurtains: Part[] = [],
      spill: Part[] = [],
      rail: Part[] = [];
    const add = (list: Part[], p: Vec3, s: Vec3) => list.push({ p, s });
    add(wall, [0, 2.03, 0], [length, 4.06, 2.86]);
    add(stone, [0, 0.02, 0], [length + 0.5, 0.22, 4.65]);
    const cols = Math.max(1, Math.floor(length / 1.25));
    const pitch = length / cols;
    for (const side of [-1, 1]) {
      for (let floor = 0; floor < 4; floor++) {
        const y = 0.64 + floor * 1.08;
        add(stone, [0, y - 0.5, side * 1.82], [length + 0.12, 0.13, 0.83]);
        // Deep openings and overhanging slabs provide physical facade shadows.
        for (let i = 0; i < cols; i++) {
          const x = -length / 2 + pitch * (i + 0.5);
          const room = floor * cols + i + (side === 1 ? cols * 4 : 0);
          const lightPattern = T.MathUtils.euclideanModulo(room * 7 + seed, 10);
          const lit = lightPattern < 7;
          add(recess, [x, y, side * 1.435], [pitch - 0.13, 0.91, 0.025]);
          add(
            lit ? (lightPattern < 4 ? amberGlass : creamGlass) : glass,
            [x, y, side * 1.461],
            [pitch - 0.27, 0.77, 0.018],
          );
          const curtainSide = (i + floor) % 2 === 0 ? -1 : 1;
          add(
            lit ? litCurtains : curtains,
            [x + curtainSide * (pitch * 0.29), y, side * 1.476],
            [pitch * 0.16, 0.74, 0.014],
          );
          if (lit) add(spill, [x, y - 0.423, side * 1.83], [pitch - 0.16, 0.002, 0.66]);
          add(rail, [x, y, side * 1.485], [0.022, 0.8, 0.025]);
          add(rail, [x, y + 0.4, side * 1.485], [pitch - 0.23, 0.022, 0.025]);
          add(rail, [x, y - 0.4, side * 1.485], [pitch - 0.23, 0.022, 0.025]);
          // Balcony partitions extend out from recessed glass.
          add(wall, [x + pitch / 2 - 0.04, y, side * 1.84], [0.08, 0.99, 0.78]);
          add(rail, [x, y - 0.1, side * 2.2], [pitch - 0.08, 0.04, 0.045]);
          add(rail, [x, y - 0.43, side * 2.2], [pitch - 0.08, 0.025, 0.035]);
          for (let j = 0; j < 5; j++)
            add(rail, [x + ((j - 2) * (pitch - 0.16)) / 5, y - 0.265, side * 2.2], [0.022, 0.34, 0.025]);
        }
      }
      add(wall, [-length / 2 + 0.04, 2.03, side * 1.85], [0.08, 4.06, 0.82]);
    }
    return { wall, stone, recess, glass, amberGlass, creamGlass, curtains, litCurtains, spill, rail };
  }, [length, seed]);
  return (
    <>
      <Batch parts={detail.wall} material={resources.wall} />
      <Batch parts={detail.stone} material={resources.stone} />
      <Batch parts={detail.recess} material={resources.recess} />
      <Batch parts={detail.glass} material={resources.glass} shadow={false} />
      <Batch parts={detail.amberGlass} material={resources.amberGlass} shadow={false} />
      <Batch parts={detail.creamGlass} material={resources.creamGlass} shadow={false} />
      <Batch parts={detail.curtains} material={resources.curtains} shadow={false} />
      <Batch parts={detail.litCurtains} material={resources.litCurtains} shadow={false} />
      <Batch parts={detail.spill} material={resources.spill} shadow={false} />
      <Batch parts={detail.rail} material={resources.rail} />
      <Roof length={length} material={resources.roof} trim={resources.trim} />
    </>
  );
}

export function WingLink({ from, to }: { from: [number, number]; to: [number, number] }) {
  const dx = to[0] - from[0],
    dz = to[1] - from[1];
  const seed = Math.round(from[0] * 17 + from[1] * 31 + to[0] * 13 + to[1] * 7);
  return (
    <group
      position={[(from[0] + to[0]) / 2, 0.93, (from[1] + to[1]) / 2]}
      rotation={[0, -Math.atan2(dz, dx), 0]}
    >
      <HotelWing length={Math.hypot(dx, dz)} seed={seed} />
    </group>
  );
}
