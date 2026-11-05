import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as T from 'three';
import type { Region } from './regionLayout';
import { regionOrigins } from './regionLayout';
import { resortAtmosphere, stepResortAtmosphere } from './dayCycle';
import type { TimeMode } from './dayCycle';

const skyVertex = /* glsl */ `
varying vec3 skyDirection;
void main(){skyDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const skyFragment = /* glsl */ `
uniform vec3 zenith,horizon,haze,sunColor,solarDirection;
uniform float sunDisc,moonDisc;
varying vec3 skyDirection;
void main(){
 vec3 d=normalize(skyDirection);
 float elevation=max(d.y,0.);
 vec3 color=mix(horizon,zenith,pow(smoothstep(-.02,.94,elevation),.62));
 color=mix(haze,color,smoothstep(-.16,.02,d.y));
 float sunDistance=1.-dot(d,normalize(solarDirection));
 float disc=1.-smoothstep(.000055,.00011,sunDistance);
 float glow=exp(-sunDistance*125.)*.22+exp(-sunDistance*16.)*.055;
 color+=sunColor*(disc*2.2+glow)*sunDisc;
 vec3 moonDirection=normalize(vec3(.35,.62,-.7));
 float moonDistance=1.-dot(d,moonDirection);
 float moon=1.-smoothstep(.000065,.000095,moonDistance);
 color+=vec3(.58,.68,.88)*(moon*1.5+exp(-moonDistance*180.)*.09)*moonDisc;
 gl_FragColor=vec4(color,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const starsVertex = /* glsl */ `
attribute float aSize;
uniform float pixelRatio;
void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aSize*pixelRatio;}`;
const starsFragment = /* glsl */ `
uniform float opacity;
void main(){float r=length(gl_PointCoord-.5)*2.;float a=(1.-smoothstep(.15,1.,r))*opacity;if(a<.002)discard;gl_FragColor=vec4(.78,.85,1.,a);}`;

function makeStars() {
  const p: number[] = [],
    size: number[] = [];
  let seed = 73;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 430; i++) {
    const y = 0.12 + random() * 0.87,
      phi = random() * Math.PI * 2,
      r = Math.sqrt(1 - y * y);
    p.push(Math.cos(phi) * r * 940, y * 940, Math.sin(phi) * r * 940);
    size.push(0.8 + Math.pow(random(), 3) * 1.9);
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  geo.setAttribute('aSize', new T.Float32BufferAttribute(size, 1));
  return geo;
}

function paintEnvironment(context: CanvasRenderingContext2D) {
  const a = resortAtmosphere,
    g = context.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, a.zenith.getStyle());
  g.addColorStop(0.46, a.horizon.getStyle());
  g.addColorStop(0.53, a.haze.getStyle());
  g.addColorStop(1, a.hemiGround.getStyle());
  context.fillStyle = g;
  context.fillRect(0, 0, 256, 128);
}

type Props = { mode: TimeMode; running: boolean; region: Region; overview: boolean };
export default function ResortLighting({ mode, running, region, overview }: Props) {
  const { scene, gl, size } = useThree();
  const samples = Math.min(gl.capabilities.maxSamples, size.width < 760 ? 2 : 4);
  const sun = useRef<T.DirectionalLight>(null),
    hemi = useRef<T.HemisphereLight>(null),
    sky = useRef<T.Group>(null);
  const skyMaterial = useRef<T.ShaderMaterial>(null),
    starMaterial = useRef<T.ShaderMaterial>(null);
  const reduced = useRef(false),
    shadowFrame = useRef(0),
    lastEnv = useRef(-Infinity),
    lastInk = useRef(-1);
  const rootElement = useRef<HTMLElement | null>(null);
  const target = useMemo(() => new T.Object3D(), []);
  const starGeometry = useMemo(makeStars, []);
  const skyUniforms = useMemo(
    () => ({
      zenith: { value: resortAtmosphere.zenith },
      horizon: { value: resortAtmosphere.horizon },
      haze: { value: resortAtmosphere.haze },
      sunColor: { value: resortAtmosphere.sunColor },
      solarDirection: { value: resortAtmosphere.solarDirection },
      sunDisc: { value: 1 },
      moonDisc: { value: 0 },
    }),
    [],
  );
  const starUniforms = useMemo(() => ({ opacity: { value: 0 }, pixelRatio: { value: 1 } }), []);
  const environment = useRef<{
    canvas: HTMLCanvasElement;
    context: CanvasRenderingContext2D;
    map: T.CanvasTexture;
    generator: T.PMREMGenerator;
    target: T.WebGLRenderTarget;
    prior: T.Texture | null;
    priorIntensity: number;
    lastColor: T.Color;
  } | null>(null);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)'),
      sync = () => {
        reduced.current = media.matches;
      };
    sync();
    media.addEventListener('change', sync);
    rootElement.current = gl.domElement.closest<HTMLElement>('.resort-app');
    const previousShadow = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext('2d')!;
    paintEnvironment(context);
    const map = new T.CanvasTexture(canvas);
    map.colorSpace = T.SRGBColorSpace;
    map.mapping = T.EquirectangularReflectionMapping;
    const generator = new T.PMREMGenerator(gl),
      renderTarget = generator.fromEquirectangular(map);
    environment.current = {
      canvas,
      context,
      map,
      generator,
      target: renderTarget,
      prior: scene.environment,
      priorIntensity: scene.environmentIntensity,
      lastColor: resortAtmosphere.horizon.clone(),
    };
    scene.environment = renderTarget.texture;
    return () => {
      media.removeEventListener('change', sync);
      gl.shadowMap.autoUpdate = previousShadow;
      const e = environment.current;
      if (e) {
        scene.environment = e.prior;
        scene.environmentIntensity = e.priorIntensity;
        e.target.dispose();
        e.map.dispose();
        e.generator.dispose();
        environment.current = null;
      }
      rootElement.current?.style.removeProperty('--day-vignette');
      rootElement.current?.style.removeProperty('--scene-ink');
    };
  }, [gl, scene]);
  useEffect(() => () => starGeometry.dispose(), [starGeometry]);
  useEffect(() => {
    sun.current?.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.needsUpdate = true;
  }, [region, overview, size.width, gl]);
  useFrame(({ camera, clock }, delta) => {
    const visible = !document.hidden;
    const a = stepResortAtmosphere(mode, visible ? delta : 0, running && visible, reduced.current);
    const centerX = overview ? 0 : regionOrigins[region][0],
      centerY = overview ? 7 : region === 'chiangmai' ? 8 : 3;
    target.position.set(centerX, centerY, 0);
    target.updateMatrixWorld();
    if (sun.current) {
      sun.current.position
        .copy(a.sunDirection)
        .multiplyScalar(overview ? 180 : 100)
        .add(target.position);
      sun.current.color.copy(a.sunColor);
      sun.current.intensity = a.sunIntensity;
    }
    if (hemi.current) {
      hemi.current.color.copy(a.hemiSky);
      hemi.current.groundColor.copy(a.hemiGround);
      hemi.current.intensity = a.hemiIntensity;
    }
    if (scene.background instanceof T.Color) scene.background.copy(a.haze);
    if (scene.fog instanceof T.Fog) scene.fog.color.copy(a.haze);
    scene.environmentIntensity = a.environmentIntensity;
    gl.toneMappingExposure = a.exposure;
    if (sky.current) sky.current.position.copy(camera.position);
    // R3F owns copied uniform containers. Mutate the actual shader material, not its JSX prop object.
    if (skyMaterial.current) {
      skyMaterial.current.uniforms.sunDisc.value = a.sunDisc;
      skyMaterial.current.uniforms.moonDisc.value = a.moonDisc;
    }
    if (starMaterial.current) {
      starMaterial.current.uniforms.opacity.value = a.stars * 0.75;
      starMaterial.current.uniforms.pixelRatio.value = Math.min(gl.getPixelRatio(), 1.75);
    }
    // Fixed light count, with one throttled shadow pass even during the moving sun.
    shadowFrame.current++;
    if (shadowFrame.current % (size.width < 760 ? 6 : 3) === 0) gl.shadowMap.needsUpdate = true;
    const e = environment.current;
    if (
      visible &&
      e &&
      clock.elapsedTime - lastEnv.current > 1 &&
      Math.abs(e.lastColor.r - a.horizon.r) +
        Math.abs(e.lastColor.g - a.horizon.g) +
        Math.abs(e.lastColor.b - a.horizon.b) >
        0.018
    ) {
      paintEnvironment(e.context);
      e.map.needsUpdate = true;
      e.generator.fromEquirectangular(e.map, e.target);
      e.lastColor.copy(a.horizon);
      lastEnv.current = clock.elapsedTime;
    }
    const inkStep = Math.round(a.night * 40) / 40;
    if (lastInk.current !== inkStep) {
      const root = rootElement.current;
      if (root) {
        root.style.setProperty('--day-vignette', String(1 - inkStep * 0.94));
        root.style.setProperty('--scene-ink', inkStep > 0.45 ? '#e4e7dc' : '#344e49');
      }
      lastInk.current = inkStep;
    }
  }, -100);
  return (
    <>
      <color attach="background" args={['#9fc4cc']} />
      <fog attach="fog" args={['#9fc4cc', 190, 580]} />
      <primitive object={target} />
      <hemisphereLight ref={hemi} args={['#e2eeff', '#77836b', 0.85]} />
      <directionalLight
        ref={sun}
        target={target}
        position={[-50, 76, 40]}
        intensity={2.65}
        color="#fff0db"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={0.04}
        shadow-radius={3}
        shadow-camera-left={overview ? -125 : -43}
        shadow-camera-right={overview ? 125 : 43}
        shadow-camera-top={overview ? 105 : 48}
        shadow-camera-bottom={overview ? -105 : -48}
        shadow-camera-near={1}
        shadow-camera-far={overview ? 390 : 230}
      />
      <group ref={sky}>
        <mesh renderOrder={-1000} frustumCulled={false}>
          <sphereGeometry args={[1100, 32, 20]} />
          <shaderMaterial
            ref={skyMaterial}
            uniforms={skyUniforms}
            vertexShader={skyVertex}
            fragmentShader={skyFragment}
            side={T.BackSide}
            depthWrite={false}
          />
        </mesh>
        <points geometry={starGeometry} renderOrder={-990} frustumCulled={false}>
          <shaderMaterial
            ref={starMaterial}
            uniforms={starUniforms}
            vertexShader={starsVertex}
            fragmentShader={starsFragment}
            transparent
            depthWrite={false}
            blending={T.AdditiveBlending}
          />
        </points>
      </group>
      <EffectComposer multisampling={samples}>
        <Bloom mipmapBlur radius={0.45} intensity={0.19} luminanceThreshold={1.25} luminanceSmoothing={0.3} />
        <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      </EffectComposer>
    </>
  );
}
