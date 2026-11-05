import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { waterAtmosphereUniforms, syncWaterAtmosphere } from './dayCycle';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { riverEdge, RIVER_WATER_Y } from './riverLayout';

const vertexShader = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 reflectedPosition;
varying vec3 waterWorld;
varying vec2 channelUV;
void main(){
 channelUV=uv;
 waterWorld=(modelMatrix*vec4(position,1.)).xyz;
 reflectedPosition=textureMatrix*vec4(position,1.);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
}`;
const fragmentShader = /* glsl */ `
uniform sampler2D tDiffuse;
uniform float time;
uniform float evening;
uniform float night,sunPower;
uniform vec3 sunDirection,sunColor,skyColor,waterDeep,waterMid,waterShallow;
varying vec4 reflectedPosition;
varying vec3 waterWorld;
varying vec2 channelUV;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float heightAt(vec2 p){
 vec2 flow=p+vec2(time*.022,-time*.13);
 return sin(dot(flow,vec2(2.7,1.3))+noise(flow*.25)*2.3)*.010
  +sin(dot(flow,vec2(-5.1,7.2))-time*.27)*.0038
  +sin(dot(flow,vec2(13.6,4.9))+noise(flow*.8)*2.)*.0018
  +(noise(flow*4.7)-.5)*.0027;
}
void main(){
 vec2 p=waterWorld.xz;
 float h=heightAt(p),dx=(heightAt(p+vec2(.035,0))-h)/.035,dz=(heightAt(p+vec2(0,.035))-h)/.035;
 vec3 normal=normalize(vec3(-dx,1.,-dz));
 vec3 eye=normalize(cameraPosition-waterWorld);
 float fresnel=.025+.975*pow(1.-max(dot(normal,eye),0.),5.);
 vec2 ruv=reflectedPosition.xy/reflectedPosition.w;
 ruv+=vec2(dx,-dz)*.13;
 ruv=clamp(ruv,vec2(.002),vec2(.998));
 float blur=.0012;
 vec3 reflection=texture2D(tDiffuse,ruv).rgb*.4;
 reflection+=texture2D(tDiffuse,ruv+vec2(blur,0.)).rgb*.15;
 reflection+=texture2D(tDiffuse,ruv-vec2(blur,0.)).rgb*.15;
 reflection+=texture2D(tDiffuse,ruv+vec2(0.,blur)).rgb*.15;
 reflection+=texture2D(tDiffuse,ruv-vec2(0.,blur)).rgb*.15;
 float edge=pow(abs(channelUV.x-.5)*2.,5.);
 float sediment=noise(p*.43+vec2(0,-time*.035));
 vec3 deep=mix(vec3(.055,.108,.052),vec3(.091,.146,.069),sediment);
 vec3 shallow=vec3(.16,.165,.084);
 vec3 body=mix(deep,shallow,edge*.75);
 body*=mix(1.,.84,evening)*mix(1.,.24,night);
 vec3 result=mix(body,reflection,clamp(.18+fresnel*.51,0.,.69));
 vec3 light=normalize(sunDirection);
 vec3 halfDirection=normalize(eye+light);
 float spec=pow(max(dot(normal,halfDirection),0.),125.);
 float sparkle=pow(noise(p*54.+vec2(time*.15,-time*.22)),4.);
 result+=sunColor*sunPower*spec*(.3+sparkle*1.9)*mix(1.,.2,night);
 float crests=sin(dot(p,vec2(17.8,9.3))-time*1.3+noise(p*1.8)*4.)*.5+.5;
 crests=pow(crests,8.)*noise(p*7.5+vec2(0.,-time*.1));
 result+=mix(vec3(.030,.032,.024),vec3(.028,.018,.009),evening)*crests*mix(1.,.25,night);
 result+=(noise(p*2.8+vec2(time*.04,-time*.1))-.5)*.009*mix(1.,.25,night);
 gl_FragColor=vec4(result,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;

function riverGeometry() {
  const p: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  for (let row = 0; row <= 172; row++) {
    const z = -22 + row * 0.25;
    for (let col = 0; col <= 8; col++) {
      const u = col / 8;
      p.push(T.MathUtils.lerp(riverEdge(z, -1), riverEdge(z, 1), u), -z, 0);
      uv.push(u, row / 172);
      if (row < 172 && col < 8) {
        const a = row * 9 + col;
        indices.push(a, a + 9, a + 1, a + 1, a + 9, a + 10);
      }
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

export default function LiRiverWater(_props: { night: boolean }) {
  const { size } = useThree();
  const reflector = useMemo(() => {
    const r = new Reflector(riverGeometry(), {
      textureWidth: 768,
      textureHeight: 768,
      multisample: 0,
      clipBias: 0.003,
      shader: {
        name: 'LiRiver',
        uniforms: {
          tDiffuse: { value: null },
          color: { value: new T.Color() },
          textureMatrix: { value: new T.Matrix4() },
          time: { value: 0 },
          ...waterAtmosphereUniforms(),
        },
        vertexShader,
        fragmentShader,
      },
    });
    r.rotation.x = -Math.PI / 2;
    r.position.y = RIVER_WATER_Y;
    const original = r.onBeforeRender;
    let lastTime = -Infinity,
      inReflection = false;
    const previousCamera = new T.Matrix4(),
      previousProjection = new T.Matrix4();
    // Capture real mountains and riverbank scenery; ripples animate every frame.
    // Moving cameras always refresh. Static views refresh at most 20 times/sec.
    r.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
      const now = performance.now();
      if (inReflection) return;
      const moved =
        !previousCamera.equals(camera.matrixWorld) || !previousProjection.equals(camera.projectionMatrix);
      if (!r.forceUpdate && !moved && now - lastTime < (r.userData.reflectionInterval ?? 50)) return;
      previousCamera.copy(camera.matrixWorld);
      previousProjection.copy(camera.projectionMatrix);
      lastTime = now;
      const target = renderer.getRenderTarget(),
        xr = renderer.xr.enabled,
        shadow = renderer.shadowMap.autoUpdate,
        visible = r.visible;
      const viewport = renderer.getViewport(new T.Vector4());
      // Each water surface reflects the scene once, never another reflector pass.
      const otherWater: T.Object3D[] = [];
      scene.traverse((object) => {
        if (
          object !== r &&
          object.visible &&
          (object as T.Object3D & { isReflector?: boolean }).isReflector
        ) {
          otherWater.push(object);
          object.visible = false;
        }
      });
      inReflection = true;
      try {
        original.call(r, renderer, scene, camera, geometry, material, group);
      } finally {
        renderer.setRenderTarget(target);
        renderer.setViewport(viewport);
        renderer.xr.enabled = xr;
        renderer.shadowMap.autoUpdate = shadow;
        r.visible = visible;
        for (const water of otherWater) water.visible = true;
        inReflection = false;
      }
    };
    return r;
  }, []);
  useEffect(() => {
    const small = size.width < 700,
      side = small ? 512 : 768;
    reflector.getRenderTarget().setSize(side, side);
    reflector.userData.reflectionInterval = small ? 80 : 50;
    reflector.forceUpdate = true;
  }, [reflector, size.width]);
  useFrame(({ clock }) => {
    const material = reflector.material as T.ShaderMaterial;
    material.uniforms.time.value = clock.elapsedTime;
    syncWaterAtmosphere(material.uniforms);
  });
  useEffect(
    () => () => {
      reflector.geometry.dispose();
      reflector.dispose();
    },
    [reflector],
  );
  return <primitive object={reflector} />;
}
