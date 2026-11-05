import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { regionOrigins } from './regionLayout';
import { riverEdge } from './riverLayout';
import { renderedGroundAt } from './ChiangMaiScene';
import { resortAtmosphere } from './dayCycle';

const random = (n: number) => T.MathUtils.euclideanModulo(Math.sin(n * 12.9898 + 78.233) * 43758.5453, 1);
export function fireflyGeometry() {
  const positions: number[] = [],
    seeds: number[] = [],
    sizes: number[] = [];
  const trail = [
    [-10, 8.5],
    [-13.6, 4.5],
    [-13.1, 1.2],
    [-10.1, 0.8],
    [-12, -2.4],
    [-13.2, -5.2],
    [-11.9, -4.2],
  ];
  for (let i = 0; i < 138; i++) {
    const anchor = trail[i % trail.length],
      x = anchor[0] + (random(i + 3) - 0.5) * 1.9,
      z = anchor[1] + (random(i + 73) - 0.5) * 1.7;
    // A small flight envelope rests above the actual sloping mountain mesh.
    const ground = Math.max(
      ...[-0.28, 0, 0.28].flatMap((dx) => [-0.28, 0, 0.28].map((dz) => renderedGroundAt(x + dx, z + dz))),
    );
    positions.push(regionOrigins.chiangmai[0] + x, ground + 0.48 + random(i + 140) * 1.05, z);
    seeds.push(random(i + 250));
    sizes.push(6 + random(i + 400) * 4);
  }
  for (let i = 0; i < 120; i++) {
    const z = 2.5 + random(i + 900) * 15,
      side = i % 2 ? 1 : -1,
      x = riverEdge(z, side) + side * (0.45 + random(i + 700) * 1.4);
    positions.push(regionOrigins.yangshuo[0] + x, 1.18 + random(i + 1000) * 1.25, z);
    seeds.push(random(i + 1200));
    sizes.push(6 + random(i + 1400) * 4);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new T.Float32BufferAttribute(seeds, 1));
  geometry.setAttribute('aSize', new T.Float32BufferAttribute(sizes, 1));
  geometry.computeBoundingSphere();
  return geometry;
}
const vertex = /* glsl */ `
 uniform float time;uniform float pixelRatio;
 attribute float aSeed;attribute float aSize;
 varying float pulse;varying float tint;
 void main(){
  float phase=aSeed*62.8319;
  vec3 p=position;
  p.x+=sin(time*.43+phase)*.19+cos(time*.27+phase*1.3)*.06;
  p.z+=cos(time*.36+phase)*.21;
  p.y+=sin(time*.63+phase)*.17;
  vec4 view=modelViewMatrix*vec4(p,1.);
  gl_Position=projectionMatrix*view;
  gl_PointSize=clamp(aSize*pixelRatio*27./max(-view.z,3.),1.5*pixelRatio,17.*pixelRatio);
  pulse=.10+.90*pow(.5+.5*sin(time*(.7+aSeed*.45)+phase),3.);
  tint=aSeed;
 }
`;
const fragment = /* glsl */ `
 uniform float visibility;varying float pulse;varying float tint;
 void main(){
  float d=length(gl_PointCoord-.5)*2.;
  if(d>1.)discard;
  float halo=exp(-d*d*5.)*.30;
  float core=exp(-d*d*65.);
  vec3 gold=mix(vec3(1.4,1.8,.30),vec3(1.9,1.5,.38),tint);
  float alpha=(halo+core*.7)*pulse*visibility*(1.-smoothstep(.7,1.,d));
  gl_FragColor=vec4(gold,alpha);
  #include <colorspace_fragment>
 }
`;

export default function Fireflies() {
  const { gl } = useThree(),
    points = useRef<T.Points>(null),
    reduced = useRef(false);
  const geometry = useMemo(fireflyGeometry, []);
  const material = useMemo(
    () =>
      new T.ShaderMaterial({
        uniforms: { time: { value: 0 }, visibility: { value: 0 }, pixelRatio: { value: 1 } },
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)'),
      sync = () => {
        reduced.current = query.matches;
      };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  useFrame((_, dt) => {
    const u = material.uniforms;
    if (!document.hidden && !reduced.current) u.time.value += Math.min(dt, 0.06);
    u.visibility.value = T.MathUtils.smoothstep(resortAtmosphere.night, 0.08, 0.72);
    u.pixelRatio.value = gl.getPixelRatio();
    if (points.current) points.current.visible = u.visibility.value > 0.002;
  });
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );
  return (
    <points
      name="night-fireflies"
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={() => {}}
      renderOrder={3}
    />
  );
}
