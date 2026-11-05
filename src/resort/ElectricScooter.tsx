import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as T from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

type V = [number, number, number];
const WHEEL_Z = [-0.66, 0.66] as const;
const WHEEL_Y = 0.294;

function makeMaterials() {
  return {
    paint: new T.MeshStandardMaterial({ color: '#b6c6af', roughness: 0.35, metalness: 0.12 }),
    cream: new T.MeshStandardMaterial({ color: '#e2e1cf', roughness: 0.43, metalness: 0.06 }),
    inset: new T.MeshStandardMaterial({ color: '#8ea38b', roughness: 0.5, metalness: 0.08 }),
    rubber: new T.MeshStandardMaterial({ color: '#262d29', roughness: 0.91 }),
    tread: new T.MeshStandardMaterial({ color: '#161d19', roughness: 1 }),
    saddle: new T.MeshStandardMaterial({ color: '#3c463e', roughness: 0.86 }),
    stitch: new T.MeshStandardMaterial({ color: '#748073', roughness: 1 }),
    black: new T.MeshStandardMaterial({ color: '#39423c', roughness: 0.63, metalness: 0.22 }),
    metal: new T.MeshStandardMaterial({ color: '#bac6c2', roughness: 0.27, metalness: 0.82 }),
    rim: new T.MeshStandardMaterial({ color: '#86968f', roughness: 0.4, metalness: 0.72 }),
    lens: new T.MeshStandardMaterial({ color: '#ecf1df', roughness: 0.18, metalness: 0.24 }),
    mirror: new T.MeshStandardMaterial({ color: '#bdd7d8', roughness: 0.12, metalness: 0.93 }),
    amber: new T.MeshStandardMaterial({ color: '#e4a349', roughness: 0.25, metalness: 0.12 }),
    red: new T.MeshStandardMaterial({ color: '#b94534', roughness: 0.24, metalness: 0.12 }),
    display: new T.MeshStandardMaterial({ color: '#354e49', roughness: 0.2, metalness: 0.23 }),
  };
}
type Materials = ReturnType<typeof makeMaterials>;

function Rod({ from, to, radius, material }: { from: V; to: V; radius: number; material: T.Material }) {
  const a = new T.Vector3(...from),
    b = new T.Vector3(...to),
    delta = b.clone().sub(a);
  const quaternion = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.clone().normalize());
  return (
    <mesh
      position={a.add(b).multiplyScalar(0.5)}
      quaternion={quaternion}
      material={material}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, delta.length(), 12]} />
    </mesh>
  );
}

function Rounded({
  at,
  size,
  radius = 0.025,
  material,
  rotation = [0, 0, 0],
}: {
  at: V;
  size: V;
  radius?: number;
  material: T.Material;
  rotation?: V;
}) {
  const geometry = useMemo(
    () => new RoundedBoxGeometry(...size, 3, radius),
    [size[0], size[1], size[2], radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh
      geometry={geometry}
      position={at}
      rotation={rotation}
      material={material}
      castShadow
      receiveShadow
    />
  );
}

function Tube({ points, radius, material }: { points: V[]; radius: number; material: T.Material }) {
  const geometry = useMemo(
    () =>
      new T.TubeGeometry(
        new T.CatmullRomCurve3(points.map((p) => new T.Vector3(...p))),
        40,
        radius,
        8,
        false,
      ),
    [points, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />;
}

function profileGeometry(shape: T.Shape, width: number, bevel: number, legShield = false) {
  // A side profile is drawn with horizontal coordinate -Z, then rotated so
  // its extrusion lies along X. Both wheels and the fairings share that axis.
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: width,
    steps: 1,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 5,
    curveSegments: 24,
  });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, 0);
  if (legShield) {
    const p = geometry.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i),
        flare = 0.86 + 0.28 * Math.sin(T.MathUtils.clamp((y - 0.27) / 0.78, 0, 1) * Math.PI);
      p.setX(i, p.getX(i) * flare);
      // Leave the front wheel and fender free to turn. The lower apron curves
      // back into the footboard, instead of occupying the wheel's upper half.
      p.setZ(i, p.getZ(i) + 0.3 * (1 - T.MathUtils.smoothstep(y, 0.59, 0.86)));
    }
    geometry.computeVertexNormals();
  }
  return geometry;
}

function bodyGeometries() {
  const shield = new T.Shape();
  shield.moveTo(0.12, 0.29);
  shield.bezierCurveTo(0.35, 0.31, 0.59, 0.3, 0.63, 0.42);
  shield.bezierCurveTo(0.69, 0.57, 0.64, 0.78, 0.57, 1.06);
  shield.lineTo(0.43, 1.06);
  shield.bezierCurveTo(0.47, 0.83, 0.48, 0.62, 0.32, 0.48);
  shield.bezierCurveTo(0.25, 0.41, 0.14, 0.4, 0.08, 0.37);
  shield.closePath();
  const rear = new T.Shape();
  rear.moveTo(-0.12, 0.42);
  rear.bezierCurveTo(-0.15, 0.6, -0.13, 0.77, -0.25, 0.79);
  rear.bezierCurveTo(-0.46, 0.83, -0.75, 0.8, -0.83, 0.7);
  rear.bezierCurveTo(-0.92, 0.61, -0.9, 0.47, -0.78, 0.43);
  rear.bezierCurveTo(-0.58, 0.39, -0.35, 0.37, -0.12, 0.42);
  rear.closePath();
  return { shield: profileGeometry(shield, 0.26, 0.045, true), rear: profileGeometry(rear, 0.34, 0.055) };
}

function Fender({ z, rear = false, material }: { z: number; rear?: boolean; material: T.Material }) {
  const geometry = useMemo(() => {
    const shape = new T.Shape();
    const outer = rear ? 0.345 : 0.333,
      inner = outer - 0.023,
      start = 0.08 * Math.PI,
      end = 0.93 * Math.PI;
    // The side profile is an annular arch; no torus axis guessing is needed.
    shape.absarc(0, 0, outer, start, end, false);
    shape.absarc(0, 0, inner, end, start, true);
    shape.closePath();
    const g = new T.ExtrudeGeometry(shape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.006,
      bevelSegments: 2,
      curveSegments: 32,
    });
    g.rotateY(Math.PI / 2);
    g.translate(-0.09, 0, 0);
    return g;
  }, [rear]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={[0, WHEEL_Y, z]} material={material} castShadow receiveShadow />;
}

function TireTread({ material }: { material: T.Material }) {
  const mesh = useRef<T.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new T.Object3D();
    let index = 0;
    for (const z of WHEEL_Z)
      for (let i = 0; i < 32; i++)
        for (const side of [-1, 1]) {
          const theta = (i * Math.PI) / 16 + side * 0.035;
          dummy.position.set(side * 0.014, WHEEL_Y + Math.cos(theta) * 0.289, z + Math.sin(theta) * 0.289);
          dummy.rotation.set(theta, side * 0.05, 0);
          dummy.scale.set(0.017, 0.0015, 0.022);
          dummy.updateMatrix();
          mesh.current.setMatrixAt(index++, dummy.matrix);
        }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, []);
  return (
    <instancedMesh ref={mesh} args={[undefined, material, 128]} castShadow receiveShadow>
      <boxGeometry />
    </instancedMesh>
  );
}

function Wheel({ z, front, materials: m }: { z: number; front: boolean; materials: Materials }) {
  return (
    <group position={[0, WHEEL_Y, z]}>
      {/* Torus normal is +Z by default. Y rotation puts its axle along X. */}
      <mesh rotation={[0, Math.PI / 2, 0]} material={m.rubber} castShadow receiveShadow>
        <torusGeometry args={[0.225, 0.066, 16, 56]} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} material={m.black} castShadow receiveShadow>
        <cylinderGeometry args={[0.159, 0.159, 0.105, 40]} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.058, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={m.rim} castShadow>
            <torusGeometry args={[0.154, 0.013, 8, 40]} />
          </mesh>
          <mesh position={[side * 0.065, 0, 0]} rotation={[0, Math.PI / 2, 0]} material={m.tread}>
            <torusGeometry args={[0.209, 0.005, 6, 48]} />
          </mesh>
          <mesh position={[side * 0.062, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.rim} castShadow>
            <cylinderGeometry args={[front ? 0.05 : 0.095, front ? 0.05 : 0.095, 0.025, 28]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => {
            const a = (i * Math.PI) / 3;
            return (
              <Rod
                key={i}
                from={[side * 0.063, Math.cos(a) * 0.04, Math.sin(a) * 0.04]}
                to={[side * 0.06, Math.cos(a + 0.13) * 0.142, Math.sin(a + 0.13) * 0.142]}
                radius={0.012}
                material={m.rim}
              />
            );
          })}
          <mesh position={[side * 0.082, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={m.metal}>
            <cylinderGeometry args={[0.023, 0.023, 0.028, 6]} />
          </mesh>
        </group>
      ))}
      {front && (
        <group position={[-0.083, 0, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]} material={m.metal}>
            <cylinderGeometry args={[0.112, 0.112, 0.008, 40]} />
          </mesh>
          {Array.from({ length: 8 }, (_, i) => (
            <mesh
              key={i}
              position={[-0.005, Math.cos((i * Math.PI) / 4) * 0.083, Math.sin((i * Math.PI) / 4) * 0.083]}
              rotation={[0, 0, Math.PI / 2]}
              material={m.black}
            >
              <cylinderGeometry args={[0.009, 0.009, 0.002, 8]} />
            </mesh>
          ))}
          <Rounded
            at={[-0.016, 0.068, 0.067]}
            size={[0.035, 0.09, 0.042]}
            radius={0.009}
            material={m.black}
          />
        </group>
      )}
    </group>
  );
}

function Handlebar({ materials: m }: { materials: Materials }) {
  return (
    <>
      <Rod from={[0, 0.77, -0.56]} to={[0, 1.16, -0.49]} radius={0.033} material={m.black} />
      <Rod from={[-0.35, 1.15, -0.49]} to={[0.35, 1.15, -0.49]} radius={0.025} material={m.metal} />
      <Rounded at={[0, 1.16, -0.505]} size={[0.33, 0.155, 0.2]} radius={0.055} material={m.paint} />
      <Rounded at={[0, 1.155, -0.612]} size={[0.225, 0.093, 0.022]} radius={0.024} material={m.cream} />
      <Rounded at={[0, 1.155, -0.627]} size={[0.187, 0.065, 0.012]} radius={0.019} material={m.lens} />
      <Rounded
        at={[0, 1.24, -0.475]}
        size={[0.13, 0.013, 0.076]}
        radius={0.012}
        material={m.black}
        rotation={[-0.18, 0, 0]}
      />
      <Rounded
        at={[0, 1.249, -0.475]}
        size={[0.103, 0.004, 0.055]}
        radius={0.007}
        material={m.display}
        rotation={[-0.18, 0, 0]}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Rod
            from={[side * 0.24, 1.15, -0.49]}
            to={[side * 0.38, 1.15, -0.49]}
            radius={0.032}
            material={m.rubber}
          />
          <mesh position={[side * 0.385, 1.15, -0.49]} rotation={[0, 0, Math.PI / 2]} material={m.black}>
            <cylinderGeometry args={[0.031, 0.031, 0.018, 16]} />
          </mesh>
          <Rounded
            at={[side * 0.218, 1.15, -0.49]}
            size={[0.052, 0.074, 0.074]}
            radius={0.014}
            material={m.black}
          />
          <Tube
            points={[
              [side * 0.2, 1.16, -0.515],
              [side * 0.26, 1.155, -0.555],
              [side * 0.36, 1.15, -0.558],
            ]}
            radius={0.01}
            material={m.metal}
          />
          <Tube
            points={[
              [side * 0.21, 1.19, -0.48],
              [side * 0.27, 1.33, -0.46],
              [side * 0.34, 1.43, -0.445],
            ]}
            radius={0.011}
            material={m.black}
          />
          <Rounded
            at={[side * 0.36, 1.465, -0.447]}
            size={[0.15, 0.105, 0.031]}
            radius={0.04}
            material={m.black}
            rotation={[0.08, side * 0.28, side * -0.1]}
          />
          <Rounded
            at={[side * 0.36, 1.465, -0.426]}
            size={[0.128, 0.085, 0.009]}
            radius={0.032}
            material={m.mirror}
            rotation={[0.08, side * 0.28, side * -0.1]}
          />
          <Rounded
            at={[side * 0.188, 0.85, -0.65]}
            size={[0.041, 0.075, 0.021]}
            radius={0.017}
            material={m.amber}
          />
        </group>
      ))}
      <Tube
        points={[
          [-0.2, 1.13, -0.51],
          [-0.19, 0.94, -0.52],
          [-0.13, 0.73, -0.58],
          [-0.115, 0.39, -0.64],
        ]}
        radius={0.006}
        material={m.rubber}
      />
    </>
  );
}

export default function ElectricScooter() {
  const m = useMemo(makeMaterials, []),
    body = useMemo(bodyGeometries, []);
  useEffect(
    () => () => {
      Object.values(m).forEach((material) => material.dispose());
      Object.values(body).forEach((geometry) => geometry.dispose());
    },
    [m, body],
  );
  return (
    <group>
      <Wheel z={-0.66} front materials={m} />
      <Wheel z={0.66} front={false} materials={m} />
      <TireTread material={m.tread} />
      <Fender z={-0.66} material={m.paint} />
      <Fender z={0.66} rear material={m.black} />
      {/* Twin fork legs meet the axle, then lean back to the steering head. */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <Rod
            from={[side * 0.105, WHEEL_Y, -0.66]}
            to={[side * 0.105, 0.61, -0.6]}
            radius={0.026}
            material={m.rim}
          />
          <Rod
            from={[side * 0.105, 0.53, -0.615]}
            to={[side * 0.105, 0.78, -0.56]}
            radius={0.018}
            material={m.metal}
          />
          <Rod
            from={[side * 0.11, 0.32, 0.66]}
            to={[side * 0.14, 0.54, 0.3]}
            radius={0.033}
            material={m.black}
          />
          <Rod
            from={[side * 0.16, 0.37, 0.68]}
            to={[side * 0.16, 0.66, 0.5]}
            radius={0.024}
            material={m.rim}
          />
        </group>
      ))}
      <Rod from={[-0.11, 0.77, -0.56]} to={[0.11, 0.77, -0.56]} radius={0.03} material={m.black} />
      <mesh geometry={body.shield} material={m.cream} castShadow receiveShadow />
      <mesh geometry={body.rear} material={m.paint} castShadow receiveShadow />
      <Rounded at={[0, 0.325, 0.005]} size={[0.405, 0.075, 0.61]} radius={0.026} material={m.paint} />
      <Rounded at={[0, 0.372, 0]} size={[0.345, 0.025, 0.48]} radius={0.035} material={m.rubber} />
      {[-0.12, -0.06, 0, 0.06, 0.12].map((x) => (
        <Rounded key={x} at={[x, 0.387, 0]} size={[0.009, 0.006, 0.38]} radius={0.002} material={m.black} />
      ))}
      <Rounded at={[0, 0.78, 0.43]} size={[0.43, 0.095, 0.77]} radius={0.042} material={m.black} />
      <Rounded at={[0, 0.85, 0.415]} size={[0.444, 0.1, 0.8]} radius={0.047} material={m.saddle} />
      <Tube
        points={[
          [-0.19, 0.878, 0.72],
          [-0.2, 0.881, 0.37],
          [-0.18, 0.878, 0.06],
          [0, 0.882, 0.035],
          [0.18, 0.878, 0.06],
          [0.2, 0.881, 0.37],
          [0.19, 0.878, 0.72],
        ]}
        radius={0.0035}
        material={m.stitch}
      />
      <Tube
        points={[
          [-0.235, 0.74, 0.63],
          [-0.25, 0.86, 0.77],
          [-0.2, 0.905, 0.86],
          [0, 0.915, 0.89],
          [0.2, 0.905, 0.86],
          [0.25, 0.86, 0.77],
          [0.235, 0.74, 0.63],
        ]}
        radius={0.019}
        material={m.metal}
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <Tube
            points={[
              [side * 0.215, 0.54, 0.2],
              [side * 0.225, 0.59, 0.43],
              [side * 0.215, 0.57, 0.74],
            ]}
            radius={0.007}
            material={m.inset}
          />
          <Rounded
            at={[side * 0.231, 0.65, 0.49]}
            size={[0.009, 0.025, 0.13]}
            radius={0.006}
            material={m.metal}
          />
          <Rod
            from={[side * 0.18, 0.41, 0.22]}
            to={[side * 0.265, 0.41, 0.22]}
            radius={0.022}
            material={m.black}
          />
          <Rounded
            at={[side * 0.2, 0.65, 0.825]}
            size={[0.056, 0.049, 0.037]}
            radius={0.015}
            material={m.amber}
          />
        </group>
      ))}
      <Rounded at={[0, 0.68, 0.867]} size={[0.23, 0.075, 0.028]} radius={0.022} material={m.red} />
      <Rounded
        at={[0, 0.46, 0.88]}
        size={[0.17, 0.1, 0.017]}
        radius={0.008}
        material={m.black}
        rotation={[0.17, 0, 0]}
      />
      <Rounded
        at={[0, 0.46, 0.893]}
        size={[0.13, 0.065, 0.008]}
        radius={0.004}
        material={m.cream}
        rotation={[0.17, 0, 0]}
      />
      <Handlebar materials={m} />
      {/* A deployed centre stand touches the same local y=0 ground as the tires. */}
      <Rod from={[-0.14, 0.32, 0.16]} to={[-0.18, 0.025, 0.3]} radius={0.018} material={m.black} />
      <Rod from={[0.14, 0.32, 0.16]} to={[0.18, 0.025, 0.3]} radius={0.018} material={m.black} />
      <Rod from={[-0.18, 0.08, 0.27]} to={[0.18, 0.08, 0.27]} radius={0.018} material={m.black} />
      {[-1, 1].map((side) => (
        <Rounded
          key={side}
          at={[side * 0.18, 0.012, 0.3]}
          size={[0.065, 0.024, 0.09]}
          radius={0.008}
          material={m.black}
        />
      ))}
      <Rod from={[-0.18, 0.09, 0.26]} to={[-0.28, 0.065, 0.3]} radius={0.016} material={m.black} />
    </group>
  );
}
