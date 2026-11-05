import { regionOrigins } from './regionLayout';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { waterAtmosphereUniforms, syncWaterAtmosphere } from './dayCycle';

type WaterProps = { night: boolean };
type V = [number, number, number];

// Analytic wave slopes keep the reflection smooth even when viewed close up.
// No remote textures or reflection render targets are required.
const waterVertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec2 vLocal;
  void main() {
    vLocal = position.xy;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;
const seaFragment = /* glsl */ `
  uniform float time;
  uniform float evening;
  uniform float night,sunPower;
  uniform vec3 sunDirection,sunColor,skyColor,waterDeep,waterMid,waterShallow;
  uniform vec2 shoreCenter;
  varying vec3 vWorld;
  varying vec2 vLocal;
  vec3 seaNormal(vec2 p) {
    // Slow phase variation loosens the long, perfectly parallel wave rows.
    float a = dot(p, vec2(.74,.28)) - time*.72 + sin(dot(p,vec2(.09,.17)))*.38;
    float b = dot(p, vec2(-.35,1.31)) + time*.51 + sin(dot(p,vec2(.13,-.08)))*.28;
    float c = dot(p, vec2(2.16,.94)) - time*1.02 + sin(b)*.35;
    float d = dot(p, vec2(-3.85,2.37)) + time*.89;
    // Phase footprint grows toward the horizon. Fade fine slopes before their
    // crests become subpixel, while leaving the nearby moving ripples intact.
    float coarseA = 1.-smoothstep(.8,3.,fwidth(a));
    float coarseB = 1.-smoothstep(.8,3.,fwidth(b));
    float fineC = 1.-smoothstep(.35,1.8,fwidth(c));
    float fineD = 1.-smoothstep(.35,1.8,fwidth(d));
    vec2 slope = vec2(.74,.28)*cos(a)*.064*coarseA
               + vec2(-.35,1.31)*cos(b)*.029*coarseB
               + vec2(2.16,.94)*cos(c)*.014*fineC
               + vec2(-3.85,2.37)*cos(d)*.004*fineD;
    return normalize(vec3(-slope.x, 1., -slope.y));
  }
  void main() {
    vec2 p = vWorld.xz;
    vec3 normal = seaNormal(p);
    vec3 eye = normalize(cameraPosition-vWorld);
    vec3 light = normalize(sunDirection);
    vec3 halfVector = normalize(eye+light);
    float facing = max(0.,dot(normal,eye));
    float fresnel = .025 + .975*pow(1.-facing,5.);
    // Broad, non-repeating blue-green bands suggest deeper water offshore.
    float distanceToLand = length((p-shoreCenter)/vec2(1.,1.17));
    float depth = smoothstep(15.,48.,distanceToLand);
    float swell = sin(p.x*.11+p.y*.075+sin(p.y*.13))*.5+.5;
    vec3 turquoise = waterMid;
    vec3 deep = waterDeep;
    vec3 body = mix(turquoise,deep,depth);
    body *= .94 + swell*.10;
    vec3 sky = skyColor;
    vec3 color = mix(body,sky,clamp(fresnel*.7,.025,.7));
    float specular = pow(max(0.,dot(normal,halfVector)),mix(105.,220.,night));
    float broad = pow(max(0.,dot(normal,halfVector)),18.);
    color += sunColor*(specular*.66+broad*.035)*sunPower*mix(1.,.12,night);
    gl_FragColor = vec4(color,1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function Sea(_props: WaterProps) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      ...waterAtmosphereUniforms(),
      shoreCenter: { value: new THREE.Vector2(regionOrigins.sabah[0] + 3, -3) },
    }),
    [],
  );
  useFrame(({ clock }) => {
    if (!material.current) return;
    // R3F merges uniform containers; scalar updates must target the live material.
    material.current.uniforms.time.value = clock.elapsedTime;
    syncWaterAtmosphere(material.current.uniforms);
  });
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.2, 0]}>
      <planeGeometry args={[2400, 2400, 1, 1]} />
      <shaderMaterial
        ref={material}
        uniforms={uniforms}
        vertexShader={waterVertex}
        fragmentShader={seaFragment}
      />
    </mesh>
  );
}

function poolOutline() {
  const shape = new THREE.Shape();
  shape.moveTo(-1.8, -3.8);
  shape.bezierCurveTo(-4, -2, -2.6, 0, -3.3, 2);
  shape.bezierCurveTo(-3.8, 4, 0, 4.8, 1.5, 3);
  shape.bezierCurveTo(3, 2, 1.4, 1, 2.6, -0.5);
  shape.bezierCurveTo(4, -3, 0, -5, -1.8, -3.8);
  return shape;
}

function poolRim(shape: THREE.Shape) {
  const boundary = shape.getPoints(48);
  const rim = new THREE.Shape(boundary.map((p) => new THREE.Vector2(p.x * 1.1, p.y * 1.075)));
  rim.holes.push(new THREE.Path(boundary.slice().reverse()));
  return rim;
}

function mosaicTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#b8d4cb';
  ctx.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      const tone = Math.sin(row * 37 + col * 17) * 0.5 + 0.5;
      ctx.fillStyle = `rgb(${Math.round(47 + tone * 28)},${Math.round(137 + tone * 30)},${Math.round(151 + tone * 32)})`;
      ctx.fillRect(col * 16 + 1, row * 16 + 1, 14, 14);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fillRect(col * 16 + 1, row * 16 + 1, 14, 1);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(0.65, 0.65);
  texture.anisotropy = 4;
  return texture;
}

const poolFragment = /* glsl */ `
  uniform float time;
  uniform float evening;
  uniform float night,sunPower;
  uniform vec3 sunDirection,sunColor,skyColor,waterDeep,waterMid,waterShallow;
  varying vec3 vWorld;
  varying vec2 vLocal;
  void main(){
    vec2 p=vLocal;
    float a=dot(p,vec2(2.8,1.3))+time*.55;
    float b=dot(p,vec2(-1.7,3.5))-time*.67;
    vec3 normal=normalize(vec3(cos(a)*.033+cos(b)*.018,1.,sin(b)*.035));
    vec3 eye=normalize(cameraPosition-vWorld);
    float fresnel=.03+pow(1.-max(0.,dot(normal,eye)),4.)*.5;
    vec3 sun=normalize(sunDirection);
    float shine=pow(max(0.,dot(normal,normalize(eye+sun))),130.);
    // Crossing caustic ribbons are deliberately low contrast, so the tile floor remains visible.
    vec2 q=p*3.7+vec2(sin(p.y*1.4+time*.4),cos(p.x*1.7-time*.37))*.19;
    float lines=abs(sin(q.x+sin(q.y*.8+time*.3))*.6+cos(q.y-time*.25)*.4);
    float caustic=pow(1.-smoothstep(0.,.19,lines),2.);
    float shallow=smoothstep(1.7,3.8,p.y);
    vec3 body=mix(vec3(.025,.32,.39),vec3(.16,.51,.50),shallow);
    body=mix(body,vec3(.014,.067,.095),night*.86);
    vec3 water=mix(body,skyColor,fresnel);
    water+=vec3(.27,.48,.39)*caustic*.32*mix(1.,.18,night);
    water+=sunColor*shine*.65*sunPower*mix(1.,.25,night);
    water*=mix(1.,.9,evening);
    gl_FragColor=vec4(water,.28+fresnel*.55+shine*.22);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function fabricTexture(wood = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  g.fillStyle = wood ? '#b08d64' : '#eee8dc';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i++) {
    g.strokeStyle = wood ? `rgba(67,43,22,${0.04 + (Math.sin(i * 17) + 1) * 0.04})` : 'rgba(110,103,84,.07)';
    g.beginPath();
    g.moveTo(i, 0);
    wood ? g.bezierCurveTo(i + Math.sin(i) * 5, 70, i - 3, 180, i + 2, 256) : g.lineTo(i, 256);
    g.stroke();
    if (!wood && i % 2 === 0) {
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(256, i);
      g.stroke();
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  return map;
}
function TileWall({ shape, material }: { shape: THREE.Shape; material: THREE.Material }) {
  const geometry = useMemo(() => {
    const pts = shape.getPoints(96),
      pos: number[] = [],
      uv: number[] = [];
    let u = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i],
        b = pts[i + 1],
        next = u + a.distanceTo(b) * 0.4;
      const v = [
        [a.x, 0.036, -a.y],
        [b.x, 0.036, -b.y],
        [b.x, 0.235, -b.y],
        [a.x, 0.235, -a.y],
      ];
      const tex = [
        [u, 0],
        [next, 0],
        [next, 0.65],
        [u, 0.65],
      ];
      for (const j of [0, 1, 2, 0, 2, 3]) {
        pos.push(...v[j]);
        uv.push(...tex[j]);
      }
      u = next;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    return g;
  }, [shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} receiveShadow />;
}
function Part({
  at,
  size,
  material,
  angle = 0,
}: {
  at: V;
  size: V;
  material: THREE.Material;
  angle?: number;
}) {
  return (
    <mesh position={at} rotation={[angle, 0, 0]} material={material} castShadow receiveShadow>
      <boxGeometry args={size} />
    </mesh>
  );
}
function Tube({
  points,
  radius = 0.023,
  material,
}: {
  points: V[];
  radius?: number;
  material: THREE.Material;
}) {
  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    [points],
  );
  return (
    <mesh material={material} castShadow>
      <tubeGeometry args={[curve, 28, radius, 8, false]} />
    </mesh>
  );
}
type FurnitureMaterials = {
  wood: THREE.Material;
  fabric: THREE.Material;
  metal: THREE.Material;
  stone: THREE.Material;
  towel: THREE.Material;
};
function Lounger({ at, turn, materials }: { at: V; turn: number; materials: FurnitureMaterials }) {
  return (
    <group position={at} rotation={[0, turn, 0]}>
      {[-0.25, 0.25].flatMap((x) =>
        [-0.62, 0.62].map((z) => (
          <Part key={`${x},${z}`} at={[x, 0.115, z]} size={[0.055, 0.23, 0.055]} material={materials.wood} />
        )),
      )}
      {[-0.28, 0.28].map((x) => (
        <Part key={x} at={[x, 0.235, 0.12]} size={[0.055, 0.07, 1.57]} material={materials.wood} />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Part key={i} at={[0, 0.25, -0.37 + i * 0.13]} size={[0.62, 0.045, 0.1]} material={materials.wood} />
      ))}
      <Part at={[0, 0.325, 0.22]} size={[0.55, 0.12, 1.05]} material={materials.fabric} />
      <group position={[0, 0.49, -0.59]} rotation={[0.6, 0, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <Part key={i} at={[0, 0, -0.32 + i * 0.13]} size={[0.62, 0.045, 0.09]} material={materials.wood} />
        ))}
        <Part at={[0, 0.062, 0]} size={[0.55, 0.1, 0.76]} material={materials.fabric} />
        <Part at={[0, 0.14, -0.25]} size={[0.45, 0.105, 0.17]} material={materials.fabric} />
      </group>
      <Part at={[0, 0.405, 0.55]} size={[0.48, 0.035, 0.32]} material={materials.towel} />
      <Part at={[0, 0.43, 0.55]} size={[0.46, 0.018, 0.29]} material={materials.towel} />
      {[-0.13, 0.13].map((z) => (
        <Part key={z} at={[0, 0.443, 0.55 + z]} size={[0.46, 0.005, 0.016]} material={materials.fabric} />
      ))}
    </group>
  );
}
function SideTable({ at, materials }: { at: V; materials: FurnitureMaterials }) {
  return (
    <group position={at}>
      <mesh position={[0, 0.028, 0]} material={materials.metal}>
        <cylinderGeometry args={[0.16, 0.18, 0.055, 24]} />
      </mesh>
      <mesh position={[0, 0.17, 0]} material={materials.metal}>
        <cylinderGeometry args={[0.025, 0.04, 0.28, 12]} />
      </mesh>
      <mesh position={[0, 0.325, 0]} material={materials.stone} castShadow>
        <cylinderGeometry args={[0.26, 0.26, 0.045, 32]} />
      </mesh>
      <mesh position={[0.055, 0.423, 0]}>
        <cylinderGeometry args={[0.043, 0.033, 0.15, 16, 1, true]} />
        <meshPhysicalMaterial
          color="#e9f6ef"
          transparent
          opacity={0.55}
          roughness={0.06}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0.055, 0.405, 0]}>
        <cylinderGeometry args={[0.035, 0.03, 0.1, 16]} />
        <meshStandardMaterial color="#e8b05b" roughness={0.3} />
      </mesh>
      <mesh position={[0.07, 0.51, 0.012]} rotation={[0, 0, -0.18]}>
        <cylinderGeometry args={[0.004, 0.004, 0.16, 6]} />
        <meshStandardMaterial color="#e2d8be" />
      </mesh>
    </group>
  );
}
function Parasol({ at, materials }: { at: V; materials: FurnitureMaterials }) {
  const canopy = useMemo(() => {
    const positions: number[] = [],
      uv: number[] = [],
      colors: number[] = [];
    for (let panel = 0; panel < 8; panel++)
      for (let step = 0; step < 6; step++) {
        const t = step / 6,
          u = (step + 1) / 6,
          a = (panel * Math.PI) / 4,
          b = ((panel + 1) * Math.PI) / 4;
        const point = (r: number, theta: number) => [
          Math.cos(theta) * r,
          2.25 - r * 0.34 + Math.sin(r * Math.PI) * 0.035,
          Math.sin(theta) * r,
        ];
        const v = [point(t, a), point(u, a), point(u, b), point(t, b)];
        for (const i of [0, 1, 2, 0, 2, 3]) {
          positions.push(...v[i]);
          uv.push(v[i][0] * 2, v[i][2] * 2);
          const shade = panel % 2 ? 0.94 : 1;
          colors.push(shade, shade, shade);
        }
      }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    return g;
  }, []);
  useEffect(() => () => canopy.dispose(), [canopy]);
  return (
    <group position={at}>
      <mesh position={[0, 0.07, 0]} material={materials.stone} castShadow>
        <cylinderGeometry args={[0.27, 0.31, 0.14, 32]} />
      </mesh>
      <mesh position={[0, 1.14, 0]} material={materials.wood} castShadow>
        <cylinderGeometry args={[0.023, 0.03, 2.2, 12]} />
      </mesh>
      <mesh geometry={canopy} castShadow>
        <meshStandardMaterial color="#eee6d3" roughness={0.96} side={THREE.DoubleSide} vertexColors />
      </mesh>
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4,
          c = Math.cos(a),
          s = Math.sin(a);
        return (
          <group key={i}>
            <Tube
              points={[
                [0, 2.245, 0],
                [c * 0.5, 2.075, s * 0.5],
                [c, 1.905, s],
              ]}
              radius={0.008}
              material={materials.fabric}
            />
            <Tube
              points={[
                [0, 1.72, 0],
                [c * 0.25, 1.85, s * 0.25],
                [c * 0.72, 1.99, s * 0.72],
              ]}
              radius={0.011}
              material={materials.wood}
            />
          </group>
        );
      })}
      <mesh position={[0, 2.28, 0]} material={materials.wood}>
        <sphereGeometry args={[0.04, 12, 8]} />
      </mesh>
    </group>
  );
}

export function Pool(_props: WaterProps) {
  const shape = useMemo(poolOutline, []);
  const rim = useMemo(() => poolRim(shape), [shape]);
  const resources = useMemo(() => {
    const texture = mosaicTexture(),
      fabric = fabricTexture(),
      wood = fabricTexture(true);
    return {
      maps: [texture, fabric, wood],
      tile: new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.4,
        color: '#b6dfdb',
        side: THREE.DoubleSide,
      }),
      wood: new THREE.MeshStandardMaterial({ map: wood, color: '#c5ad86', roughness: 0.8 }),
      fabric: new THREE.MeshStandardMaterial({ map: fabric, color: '#f7f2e6', roughness: 0.96 }),
      metal: new THREE.MeshStandardMaterial({ color: '#b7c5c5', metalness: 0.86, roughness: 0.23 }),
      stone: new THREE.MeshStandardMaterial({ color: '#ddd3bd', roughness: 0.8 }),
      towel: new THREE.MeshStandardMaterial({ map: fabric, color: '#7caaa6', roughness: 1 }),
    };
  }, []);
  useEffect(
    () => () => {
      resources.maps.forEach((t) => t.dispose());
      for (const k of ['tile', 'wood', 'fabric', 'metal', 'stone', 'towel'] as const) resources[k].dispose();
    },
    [resources],
  );
  const water = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ time: { value: 0 }, ...waterAtmosphereUniforms() }), []);
  useFrame(({ clock }) => {
    if (!water.current) return;
    water.current.uniforms.time.value = clock.elapsedTime;
    syncWaterAtmosphere(water.current.uniforms);
  });
  // Pool floor, treads and terrace all clear the grass cap at world y=.95.
  return (
    <group position={[-7.8, 0.94, -1.6]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} scale={[1.16, 1.13, 1]} receiveShadow>
        <shapeGeometry args={[shape, 48]} />
        <meshStandardMaterial color="#d7ccb8" roughness={0.91} />
      </mesh>
      {/* A dedicated rear sun terrace keeps every chair away from the water and restaurant. */}
      <Part at={[-0.9, -0.12, -6.6]} size={[4.3, 0.3, 4.4]} material={resources.stone} />
      {Array.from({ length: 12 }, (_, i) => (
        <Part
          key={i}
          at={[-0.975, 0.031, -8.6 + i * 0.36]}
          size={[3.95, 0.003, 0.008]}
          material={resources.fabric}
        />
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} receiveShadow>
        <shapeGeometry args={[shape, 48]} />
        <primitive attach="material" object={resources.tile} />
      </mesh>
      <TileWall shape={shape} material={resources.tile} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.035, 0]} castShadow receiveShadow>
        <extrudeGeometry
          args={[
            rim,
            {
              depth: 0.24,
              bevelEnabled: true,
              bevelThickness: 0.025,
              bevelSize: 0.025,
              bevelSegments: 2,
              steps: 1,
              curveSegments: 48,
            },
          ]}
        />
        <meshStandardMaterial color="#ebe2cd" roughness={0.8} />
      </mesh>
      {/* Wide graduated submerged steps read as a light shallow shelf through the water. */}
      {[0, 1, 2, 3].map((i) => {
        const top = 0.19 - i * 0.038,
          depth = top - 0.035;
        return (
          <Part
            key={i}
            at={[-0.8, 0.035 + depth / 2, -3.55 + i * 0.29]}
            size={[1.42 + i * 0.18, depth, 0.31]}
            material={resources.tile}
          />
        );
      })}
      {[-1.5, -0.1].map((x) => (
        <group key={x}>
          <Tube
            points={[
              [x, 0.03, -4.35],
              [x, 0.65, -4.35],
              [x, 0.79, -4.08],
              [x, 0.74, -3.65],
              [x, 0.36, -3.23],
              [x, 0.07, -2.88],
            ]}
            material={resources.metal}
          />
          <mesh position={[x, 0.04, -4.35]} material={resources.metal}>
            <cylinderGeometry args={[0.065, 0.065, 0.022, 20]} />
          </mesh>
        </group>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.205, 0]} renderOrder={2}>
        <shapeGeometry args={[shape, 48]} />
        <shaderMaterial
          ref={water}
          uniforms={uniforms}
          vertexShader={waterVertex}
          fragmentShader={poolFragment}
          transparent
          depthWrite={false}
        />
      </mesh>
      {[-5.35, -7.5].flatMap((z, row) =>
        [-2.3, -1, 0.3].map((x, col) => (
          <Lounger key={`${row},${col}`} at={[x, 0.03, z]} turn={0} materials={resources} />
        )),
      )}
      <Parasol at={[-1.65, 0.03, -6.45]} materials={resources} />
      <Parasol at={[0.95, 0.03, -6.55]} materials={resources} />
      <SideTable at={[-1.65, 0.03, -4.78]} materials={resources} />
      <SideTable at={[-0.35, 0.03, -7.05]} materials={resources} />
    </group>
  );
}
