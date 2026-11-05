import HongcunScene from './HongcunScene';
import { regionOrigins, regionPoint } from './regionLayout';
import { useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import type { RefObject } from 'react';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Line } from '@react-three/drei';
import * as T from 'three';
import { Camera, Heart } from 'lucide-react';
import { Sea, Pool } from './Water';
import { WingLink } from './Hotel';
import SunsetApproach from './SunsetApproach';
import SunsetBar from './SunsetBar';
import PingPongCorner from './PingPongCorner';
import SeasideDining from './SeasideDining';
import BirthdayCake from './BirthdayCake';
import Surfboard from './Surfboard';
import YangshuoScene from './YangshuoScene';
import ChiangMaiScene, { renderedGroundAt } from './ChiangMaiScene';
import { spots, spotOrder } from './data';
import type { Spot, Region } from './data';
import { closeupViews } from './views';
import type { ResortView } from './views';
import ResortLighting from './ResortLighting';
import type { TimeMode } from './dayCycle';
import Fireflies from './Fireflies';

type V = [number, number, number];
function Box({ at, size, color, rotation = 0 }: { at: V; size: V; color: string; rotation?: number }) {
  return (
    <mesh position={at} rotation={[0, rotation, 0]} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.85} />
    </mesh>
  );
}
// Coastline follows the supplied aerial reference; coordinates are artistic, not surveyed.
function landShape(points: [number, number][]) {
  const s = new T.Shape();
  const curve = new T.CatmullRomCurve3(
    points.map(([x, z]) => new T.Vector3(x, -z, 0)),
    true,
    'centripetal',
  );
  curve.getPoints(120).forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  s.closePath();
  return s;
}
function surfaceTexture(kind: 'grass' | 'roof' | 'sand') {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = kind === 'roof' ? '#aa7770' : kind === 'sand' ? '#d9cbb0' : '#9da985';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 7;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 7000; i++) {
    const v = rand();
    ctx.fillStyle = `rgba(${v > 0.5 ? '255,245,205' : '30,50,20'},${kind === 'roof' ? 0.04 : 0.1})`;
    ctx.fillRect(rand() * 256, rand() * 256, rand() * 2 + 1, rand() * 3 + 1);
  }
  if (kind === 'roof') {
    for (let y = 0; y < 256; y += 16) {
      ctx.fillStyle = '#624443';
      ctx.fillRect(0, y, 256, 1);
      for (let x = 0; x < 256; x += 12) {
        ctx.fillStyle = '#bd8b80';
        ctx.fillRect(x + (y % 32 ? 6 : 0), y, 1, 15);
      }
    }
  }
  const t = new T.CanvasTexture(c);
  t.wrapS = t.wrapT = T.RepeatWrapping;
  t.repeat.set(kind === 'roof' ? 0.7 : 0.2, kind === 'roof' ? 0.7 : 0.2);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const coast: [number, number][] = [
  [-12, -23],
  [18, -23],
  [20, -12],
  [19, -3],
  [17, 5],
  [13, 12],
  [7, 16],
  [-1, 17],
  [-7, 14],
  [-10, 8],
  [-12, 0],
];
function Ground() {
  const texture = useMemo(() => surfaceTexture('grass'), []);
  const sand = useMemo(() => surfaceTexture('sand'), []);
  useEffect(
    () => () => {
      texture.dispose();
      sand.dispose();
    },
    [texture, sand],
  );
  const shapes = useMemo(
    () => ({
      sand: landShape(coast),
      grass: landShape([
        [-11, -23],
        [16, -23],
        [16, -12],
        [14, -3],
        [12, 5],
        [9, 10],
        [4, 13],
        [-2, 13],
        [-7, 10],
        [-9, 4],
        [-10, -5],
      ]),
    }),
    [],
  );
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.36, 0]} receiveShadow>
        <extrudeGeometry
          args={[
            shapes.sand,
            {
              depth: 0.8,
              bevelEnabled: true,
              bevelSize: 1,
              bevelThickness: 0.25,
              bevelSegments: 4,
              curveSegments: 30,
            },
          ]}
        />
        <meshStandardMaterial color="#f7f1e6" map={sand} bumpMap={sand} bumpScale={0.035} roughness={0.97} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.55, 0]} receiveShadow>
        <extrudeGeometry
          args={[
            shapes.grass,
            { depth: 0.28, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.12, bevelSegments: 3 },
          ]}
        />
        <meshStandardMaterial color="#9bb07a" map={texture} roughness={1} />
      </mesh>
      <mesh position={[-14, 0.25, 12]} scale={[3.5, 0.65, 3.2]} receiveShadow castShadow>
        <sphereGeometry args={[1, 40, 20]} />
        <meshStandardMaterial color="#6e7e53" roughness={1} />
      </mesh>
      <SunsetApproach />
      <Path
        points={[
          [-11, 0.45, -19],
          [-11.5, 0.45, -9],
          [-10, 0.45, 2],
          [-8, 0.45, 8],
        ]}
        width={0.18}
      />
      <Path
        points={[
          [-6, 0.75, 12],
          [0, 0.75, 14],
          [6, 0.75, 13],
          [11, 0.75, 9],
          [14, 0.75, 3],
        ]}
        width={0.22}
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <Line
          key={i}
          points={[
            [17 + i * 0.28, 0.48, -8],
            [16 + i * 0.4, 0.48, 0],
            [13 + i * 0.5, 0.48, 8],
            [8 + i * 0.55, 0.48, 14],
            [2 + i * 0.4, 0.48, 17],
          ]}
          color={i % 2 ? '#e6d4b0' : '#cdb896'}
          lineWidth={1}
        />
      ))}
    </>
  );
}

function Palm({ at, height = 4, turn = 0 }: { at: V; height?: number; turn?: number }) {
  const leaf = useMemo(() => {
    const g = new T.BufferGeometry(),
      p: number[] = [];
    const c = (v: number) => [v * 2.6, Math.sin(v * Math.PI) * 0.72 - v * 0.8, 0] as V;
    for (let i = 1; i < 21; i++) {
      const t = i / 22,
        u = (i + 0.7) / 22;
      const a = c(t),
        b = c(u);
      const width = 0.47 * Math.sin(t * Math.PI);
      for (const side of [-1, 1]) {
        p.push(a[0], a[1], 0, b[0] + 0.18, b[1] - 0.13, width * side, b[0], b[1], 0);
      }
    }
    g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => leaf.dispose(), [leaf]);
  return (
    <group position={at} rotation={[0, turn, 0.06]}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.18, height, 12, 12]} />
        <meshStandardMaterial color="#887d69" roughness={0.95} />
      </mesh>
      <group position={[0, height, 0]}>
        {Array.from({ length: 10 }, (_, i) => (
          <mesh key={i} geometry={leaf} rotation={[0, (i * Math.PI) / 5, (i % 3) * 0.12]} castShadow>
            <meshStandardMaterial
              color={i % 2 ? '#395a34' : '#537345'}
              side={T.DoubleSide}
              roughness={0.85}
            />
          </mesh>
        ))}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[Math.sin(i * 2) * 0.16, -0.08, Math.cos(i * 2) * 0.16]}>
            <sphereGeometry args={[0.14, 8, 6]} />
            <meshStandardMaterial color="#706944" />
          </mesh>
        ))}
      </group>
    </group>
  );
}
function Path({ points, width = 0.3 }: { points: V[]; width?: number }) {
  const curve = useMemo(() => new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))), [points]);
  return (
    <mesh>
      <tubeGeometry args={[curve, 40, width, 6, false]} />
      <meshStandardMaterial color="#dcc6a0" roughness={1} />
    </mesh>
  );
}
function Table({ at, umbrella = false }: { at: V; umbrella?: boolean }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.52, 0.52, 0.065, 32]} />
        <meshStandardMaterial color="#dbd2bb" roughness={0.65} />
      </mesh>
      <Box at={[0, 0.32, 0]} size={[0.06, 0.64, 0.06]} color="#4d5a53" />
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.21, 0.23, 0.04, 20]} />
        <meshStandardMaterial color="#5b655a" />
      </mesh>
      {[-1, 1].map((x) => (
        <group key={x} position={[x * 0.86, 0, 0]} rotation={[0, x > 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          {[-0.19, 0.19].flatMap((lx) =>
            [-0.19, 0.19].map((z) => (
              <Box key={`${lx},${z}`} at={[lx, 0.17, z]} size={[0.035, 0.34, 0.035]} color="#7d684e" />
            )),
          )}
          <Box at={[0, 0.35, 0]} size={[0.45, 0.045, 0.45]} color="#8f785a" />
          <Box at={[0, 0.39, 0]} size={[0.4, 0.04, 0.4]} color="#e8dfc9" />
          {[-0.2, 0.2].map((lx) => (
            <Box key={lx} at={[lx, 0.58, -0.2]} size={[0.035, 0.46, 0.035]} color="#7d684e" />
          ))}
          {[0.52, 0.62, 0.72].map((y) => (
            <Box key={y} at={[0, y, -0.2]} size={[0.4, 0.06, 0.025]} color="#8f785a" />
          ))}
        </group>
      ))}
      {umbrella && (
        <>
          <Box at={[0, 1.6, 0]} size={[0.05, 2.8, 0.05]} color="#a39171" />
          <mesh position={[0, 2.75, 0]}>
            <coneGeometry args={[1.25, 0.45, 16]} />
            <meshStandardMaterial color="#eee6d4" side={T.DoubleSide} />
          </mesh>
        </>
      )}
    </group>
  );
}

function Tree({ at, seed = 0 }: { at: V; seed?: number }) {
  const crown = useMemo(() => {
    const g = new T.IcosahedronGeometry(1, 3),
      p = g.getAttribute('position'),
      colors = [];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        y = p.getY(i),
        z = p.getZ(i);
      const noise =
        Math.sin(x * 16 + seed) * Math.sin(y * 13 + z * 9) * 0.11 + Math.sin(z * 23 + x * 12) * 0.055;
      p.setXYZ(i, x * (1 + noise), y * (1 + noise), z * (1 + noise));
      const shade = 0.73 + (0.5 + 0.5 * Math.sin(x * 12 + z * 15 + y * 9 + seed)) * 0.27;
      colors.push(shade, shade, shade * 0.91);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, [seed]);
  useEffect(() => () => crown.dispose(), [crown]);
  return (
    <group position={at}>
      <Box at={[0, 0.7, 0]} size={[0.16, 1.4, 0.16]} color="#796957" />
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          geometry={crown}
          position={[Math.sin(seed + i * 2) * 0.55, 1.6 + i * 0.3, Math.cos(seed + i * 2) * 0.55]}
          scale={[0.8 + (seed % 4) * 0.16, 0.8 + i * 0.23, 0.9 + (seed % 3) * 0.13]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial vertexColors color={['#466345', '#53724a', '#68804f'][i]} roughness={0.95} />
        </mesh>
      ))}
    </group>
  );
}
function Scenery({
  onSelect,
  timeMode,
  running,
  interactive,
  closeup,
  region,
  markersRoot,
}: {
  onSelect: (id: Spot) => void;
  timeMode: TimeMode;
  running: boolean;
  interactive: boolean;
  closeup: ResortView;
  region: Region;
  markersRoot: RefObject<HTMLDivElement | null>;
}) {
  const night = timeMode === 'night' || timeMode === 'sunset';

  // Keep the full, leaning crowns clear of the hotel roofs and balconies.
  // Beach roots sit on the sand cap (-.36 + .8 + .25 bevel); lawn roots stay at .95.
  const palms: V[] = [
    [-7.5, 0.69, 12.7],
    [-5.8, 0.69, 14],
    [-3.7, 0.69, 15],
    [-1.5, 0.69, 15.6],
    [0.3, 0.69, 15],
    [3, 0.69, 14.9],
    [7, 0.69, 15.4],
    [12.1, 0.69, 9.7],
    [13.7, 0.69, 7],
    [11.7, 0.69, 12],
    [14.1, 0.69, 9.1],
    [13.3, 0.95, -3],
    [-10.7, 0.95, -22.1],
    [16.8, 0.69, -8.5],
    [10.3, 0.69, 13.5],
    [17, 0.69, -13.7],
    [17.8, 0.69, -18.4],
  ];
  const links: [number, number][][] = [
    [
      [-9, -16],
      [-3, -15],
    ],
    [
      [-3, -15],
      [-4, -9],
    ],
    [
      [-4, -9],
      [-1, -4],
    ],
    [
      [-1, -4],
      [3, 1],
    ],
    [
      [3, 1],
      [2, 6],
    ],
    [
      [2, 6],
      [-2, 9],
    ],
    [
      [2, 6],
      [7, 10],
    ],
    [
      [3, 1],
      [9, -1],
    ],
  ];
  return (
    <>
      <ResortLighting mode={timeMode} running={running} region={region} overview={closeup === 'islands'} />
      <Fireflies />
      <Sea night={night} />
      <YangshuoScene night={night} onSelect={onSelect} />
      <ChiangMaiScene night={night} onSelect={onSelect} />
      <group position={regionOrigins.hongcun}>
        <HongcunScene night={night} onSelect={onSelect} />
      </group>
      <group position={regionOrigins.sabah}>
        <Ground />
        {links.map((l, i) => (
          <WingLink key={i} from={l[0] as [number, number]} to={l[1] as [number, number]} />
        ))}
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect('sunset');
          }}
        >
          <SunsetBar night={night} />
        </group>
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect('dining');
          }}
        >
          <SeasideDining night={night} />
        </group>
        <Pool night={night} />
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect('pingpong');
          }}
        >
          <PingPongCorner />
        </group>
        <group
          position={[1, 1.634, 10.6]}
          onClick={(e) => {
            e.stopPropagation();
            onSelect('birthday');
          }}
        >
          <BirthdayCake />
        </group>
        <group
          onClick={(e) => {
            e.stopPropagation();
            onSelect('surf');
          }}
        >
          <Surfboard />
        </group>
        {palms.map((p, i) => (
          <group
            key={i}
            onClick={
              i >= 7 && i <= 10
                ? (e) => {
                    e.stopPropagation();
                    onSelect('garden');
                  }
                : undefined
            }
          >
            <Palm at={p} height={3.6 + (i % 4) * 0.38} turn={i * 2.3} />
          </group>
        ))}
        {/* The rear grove stays north/east of the wings and clear of the garden path. */}
        {Array.from({ length: 48 }, (_, i) => (
          <Tree
            key={i}
            at={[
              2.4 + (i % 8) * 1.8 + Math.sin(i * 7.3) * 0.18,
              0.9,
              -22 + Math.floor(i / 8) * 1.85 + Math.cos(i * 3.7) * 0.18,
            ]}
            seed={i}
          />
        ))}
        <Path
          points={[
            [9, 0.95, -10],
            [10, 0.95, -5],
            [9, 0.95, 0],
            [10, 0.95, 6],
            [5, 0.95, 12],
            [0, 0.95, 12],
            [-6, 0.95, 9],
          ]}
          width={0.32}
        />
        {[-5, -2, 1].map((x, i) => (
          <Table key={x} at={[x, 0.95, 10 + i * 0.3]} umbrella={false} />
        ))}
        <group position={[-11, 0.2, -15]}>
          <Box at={[-2, 0, 0]} size={[5, 0.15, 0.8]} color="#b4a183" />
          {[-4, -2, 0].map((x) => (
            <Box key={x} at={[x, 0.25, 0.4]} size={[0.08, 0.6, 0.08]} color="#d9d3bd" />
          ))}
        </group>
      </group>
      {spotOrder.map((id) => (
        <group key={id} position={spots[id].point}>
          {
            <Html
              portal={markersRoot as RefObject<HTMLElement>}
              center
              zIndexRange={[10, 1]}
              style={{
                display:
                  interactive && (closeup === 'islands' || spots[id].region === region) ? 'block' : 'none',
              }}
            >
              <button
                className={'memory-marker marker-' + id}
                aria-label={spots[id].title}
                onClick={() => onSelect(id)}
              >
                <span className="marker-icon">
                  {id === 'birthday' ? <Heart size={13} /> : <Camera size={13} />}
                </span>
                <span className="marker-tooltip" aria-hidden="true">
                  {spots[id].title}
                </span>
              </button>
            </Html>
          }
        </group>
      ))}
    </>
  );
}
function defaultTarget(region: Region): V {
  return regionPoint(region, [0, region === 'chiangmai' ? 8 : region === 'yangshuo' ? 4 : 1, -2]);
}
type CameraFlight = {
  from: T.Vector3;
  to: T.Vector3;
  fromTarget: T.Vector3;
  toTarget: T.Vector3;
  fromFov: number;
  toFov: number;
  elapsed: number;
  duration: number;
  lift: number;
  kind: 'route' | 'zoom';
};
function CameraView({
  reset,
  zoom,
  closeup,
  region,
  orbit,
}: {
  reset: number;
  zoom: number;
  closeup: ResortView;
  region: Region;
  orbit: RefObject<OrbitControlsImpl | null>;
}) {
  const { camera, size, gl } = useThree(),
    flight = useRef<CameraFlight | null>(null),
    reduced = useRef(false);
  const previous = useRef<{
    reset: number;
    zoom: number;
    closeup: ResortView;
    region: Region;
    width: number;
    height: number;
  } | null>(null);
  const apply = (position: T.Vector3, target: T.Vector3, fov: number) => {
    camera.position.copy(position);
    orbit.current?.target.copy(target);
    camera.lookAt(target);
    if (camera instanceof T.PerspectiveCamera && Math.abs(camera.fov - fov) > 0.00001) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  };
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      reduced.current = query.matches;
      if (query.matches && flight.current) {
        const f = flight.current;
        apply(f.to, f.toTarget, f.toFov);
        flight.current = null;
      }
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, [camera, orbit]);
  useEffect(() => {
    // OrbitControls listens on the same element. Cancel before it handles the
    // gesture, so a drag, pinch or wheel never fights the automatic camera.
    const cancel = () => {
        flight.current = null;
      },
      canvas = gl.domElement;
    canvas.addEventListener('pointerdown', cancel, { capture: true, passive: true });
    canvas.addEventListener('wheel', cancel, { capture: true, passive: true });
    return () => {
      canvas.removeEventListener('pointerdown', cancel, true);
      canvas.removeEventListener('wheel', cancel, true);
    };
  }, [gl]);
  useEffect(() => {
    const before = previous.current,
      aspect = size.width / size.height,
      toFov = aspect < 0.8 ? 57 : 43;
    const resized = !!before && (before.width !== size.width || before.height !== size.height);
    const routeChanged =
      !before || resized || before.reset !== reset || before.region !== region || before.closeup !== closeup;
    previous.current = { reset, zoom, closeup, region, width: size.width, height: size.height };
    const currentTarget = orbit.current?.target.clone() ?? new T.Vector3(...defaultTarget(region)),
      pending = flight.current;
    const toTarget = routeChanged
      ? new T.Vector3(...(closeup ? closeupViews[closeup].target : defaultTarget(region)))
      : (pending?.toTarget.clone() ?? currentTarget.clone());
    let to: T.Vector3;
    if (routeChanged) {
      const scale = Math.max(
        1,
        (closeup === 'foresttemple' ? 0.9 : closeup === 'islands' ? 0.85 : 0.65) / aspect,
      );
      const offset = closeup
        ? closeupViews[closeup].offset
        : region === 'chiangmai'
          ? [10, 42, 61]
          : [8, 39, 56];
      to = new T.Vector3(...offset).multiplyScalar(scale).add(toTarget);
    } else {
      const delta = zoom - before!.zoom;
      if (!delta) return;
      // Zoom changes the intended destination, including an unfinished trip;
      // it must not strand the camera at an intermediate orbit target.
      const base = pending?.to ?? camera.position;
      const offset = base.clone().sub(toTarget).multiplyScalar(Math.pow(0.8, delta));
      offset.clampLength(closeup && closeup !== 'islands' ? 3 : 12, closeup === 'islands' ? 560 : 240);
      to = offset.add(toTarget);
    }
    // Clear the previous drag's residual damping while preserving the visible pose.
    const controls = orbit.current;
    if (controls) {
      const position = camera.position.clone(),
        target = controls.target.clone(),
        damping = controls.enableDamping;
      controls.enableDamping = false;
      controls.update();
      controls.enableDamping = damping;
      camera.position.copy(position);
      controls.target.copy(target);
      camera.lookAt(target);
    }
    if (!before || resized || reduced.current) {
      flight.current = null;
      apply(to, toTarget, toFov);
      return;
    }
    const distance = camera.position.distanceTo(to);
    let duration = 0.25,
      lift = 0,
      kind: CameraFlight['kind'] = 'zoom';
    if (routeChanged) {
      duration = 0.78;
      kind = 'route';
      lift = Math.min(18, Math.max(0, distance - 15) * 0.2);
    } else if (pending?.kind === 'route') {
      kind = 'route';
      duration = Math.max(0.25, pending.duration - pending.elapsed);
      const p = Math.min(1, pending.elapsed / pending.duration),
        e = p * p * (3 - 2 * p);
      // Continue the untravelled portion of the raised arc, without stacking
      // another full lift on every rapid +/- press.
      lift = pending.lift * Math.max(0, Math.sin((Math.PI * (e + 1)) / 2) - 0.5 * Math.sin(Math.PI * e));
    }
    flight.current = {
      from: camera.position.clone(),
      to,
      fromTarget: currentTarget,
      toTarget,
      fromFov: camera instanceof T.PerspectiveCamera ? camera.fov : toFov,
      toFov,
      elapsed: 0,
      duration,
      kind,
      lift,
    };
  }, [camera, reset, zoom, closeup, region, size.width, size.height, orbit]);
  useFrame((_, dt) => {
    const f = flight.current;
    if (!f) return;
    f.elapsed += Math.min(dt, 0.1);
    const progress = Math.min(1, f.elapsed / f.duration),
      ease = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(f.from, f.to, ease);
    camera.position.y += Math.sin(Math.PI * ease) * f.lift;
    // Keep travel over the steep hillside instead of passing through the terrain.
    const localX = camera.position.x - regionOrigins.chiangmai[0],
      z = camera.position.z;
    if (progress < 1 && Math.abs(localX) < 20 && z > -25 && z < 23)
      camera.position.y = Math.max(camera.position.y, renderedGroundAt(localX, z) + 1.2);
    const target = orbit.current?.target;
    if (target) {
      target.lerpVectors(f.fromTarget, f.toTarget, ease);
      camera.lookAt(target);
    }
    if (camera instanceof T.PerspectiveCamera && f.fromFov !== f.toFov) {
      camera.fov = T.MathUtils.lerp(f.fromFov, f.toFov, ease);
      camera.updateProjectionMatrix();
    }
    if (progress === 1) {
      apply(f.to, f.toTarget, f.toFov);
      flight.current = null;
    }
  });
  return null;
}
// Object picking is independent from OrbitControls' native drag/pinch listeners.
function SceneInteractionGate({ enabled }: { enabled: boolean }) {
  const setEvents = useThree((state) => state.setEvents);
  useLayoutEffect(() => {
    setEvents({ enabled });
  }, [enabled, setEvents]);
  return null;
}
export default function ResortWorld({
  onSelect,
  timeMode,
  running,
  interactive,
  reset,
  zoom,
  closeup,
  region,
  markersRoot,
}: {
  onSelect: (id: Spot) => void;
  timeMode: TimeMode;
  running: boolean;
  interactive: boolean;
  reset: number;
  zoom: number;
  closeup: ResortView;
  region: Region;
  markersRoot: RefObject<HTMLDivElement | null>;
}) {
  const orbit = useRef<OrbitControlsImpl>(null);
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [8, 40, 54], fov: 43, near: 0.1, far: 1800 }}
      gl={{
        antialias: true,
        powerPreference: 'high-performance',
        toneMapping: T.ACESFilmicToneMapping,
        toneMappingExposure: 1,
      }}
    >
      <SceneInteractionGate enabled={interactive} />
      <CameraView reset={reset} zoom={zoom} closeup={closeup} region={region} orbit={orbit} />
      <Scenery
        onSelect={onSelect}
        timeMode={timeMode}
        running={running}
        interactive={interactive}
        closeup={closeup}
        region={region}
        markersRoot={markersRoot}
      />
      <OrbitControls
        ref={orbit}
        minDistance={closeup && closeup !== 'islands' ? 3 : 12}
        maxDistance={closeup === 'islands' ? 560 : 240}
        maxPolarAngle={Math.PI * 0.46}
        minPolarAngle={0.18}
        enablePan={false}
        enableDamping
        dampingFactor={0.07}
      />
    </Canvas>
  );
}
