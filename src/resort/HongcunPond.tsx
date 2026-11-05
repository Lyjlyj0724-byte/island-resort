import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as T from 'three';
import { waterAtmosphereUniforms, syncWaterAtmosphere } from './dayCycle';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

type Props = { night: boolean; onSelect: () => void };

const vertexShader = /* glsl */ `
uniform mat4 textureMatrix;
varying vec4 reflectedPosition;
varying vec3 waterWorld;
varying vec2 pondLocal;
void main(){
  pondLocal=vec2(position.x,-position.y);
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
uniform vec2 reflectionTexel;
varying vec4 reflectedPosition;
varying vec3 waterWorld;
varying vec2 pondLocal;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
  vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
}
float heightAt(vec2 p,vec2 warp,float detail){
  // Rotated, drifting noise avoids long parallel crests in this sheltered pond.
  vec2 flow=p+vec2(time*.026,-time*.018);
  vec2 crossFlow=mat2(.8,.6,-.6,.8)*p+vec2(-time*.017,time*.023);
  vec2 fineFlow=mat2(.36,-.93,.93,.36)*p+vec2(time*.012,time*.019);
  return (noise(flow*1.35+warp)-.5)*.010
    +(noise(crossFlow*3.8+warp*.67)-.5)*.0023
    +(noise(fineFlow*10.4+warp*.4)-.5)*.0005*detail;
}
void main(){
  vec2 p=pondLocal;
  float detail=1.-smoothstep(.055,.24,length(fwidth(p)));
  vec2 warp=vec2(noise(p*.27+vec2(time*.009,3.1)),noise(p*.31+vec2(8.7,-time*.007)))-.5;
  float h=heightAt(p,warp,detail);
  float dx=(heightAt(p+vec2(.035,0),warp,detail)-h)/.035;
  float dz=(heightAt(p+vec2(0,.035),warp,detail)-h)/.035;
  vec3 normal=normalize(vec3(-dx,1.,-dz));
  vec3 eye=normalize(cameraPosition-waterWorld);
  float fresnel=.028+.972*pow(1.-max(dot(normal,eye),0.),5.);
  vec2 ruv=reflectedPosition.xy/reflectedPosition.w;
  ruv=clamp(ruv+vec2(dx,-dz)*.075,vec2(.002),vec2(.998));
  // Keep the stepped walls recognisable; only soften the fine roof tiles.
  vec3 reflection=texture2D(tDiffuse,ruv).rgb*.6;
  reflection+=texture2D(tDiffuse,ruv+vec2(reflectionTexel.x,0.)).rgb*.1;
  reflection+=texture2D(tDiffuse,ruv-vec2(reflectionTexel.x,0.)).rgb*.1;
  reflection+=texture2D(tDiffuse,ruv+vec2(0.,reflectionTexel.y)).rgb*.1;
  reflection+=texture2D(tDiffuse,ruv-vec2(0.,reflectionTexel.y)).rgb*.1;
  // Suppress pale blue sky glare without flattening the white-wall silhouettes.
  float coolSky=smoothstep(.018,.13,reflection.b-reflection.r)
    *smoothstep(.006,.055,reflection.b-reflection.g)
    *smoothstep(.11,.32,dot(reflection,vec3(.2126,.7152,.0722)));
  reflection*=mix(vec3(.94,.98,.91),vec3(.64,.79,.58),coolSky*(1.-night));
  vec2 ellipse=vec2(p.x/10.,(p.y+2.)/13.);
  float radius=length(ellipse);
  float edgeSlope=length(ellipse/vec2(10.,13.))/max(radius,.001);
  float bankDistance=max(0.,min((1.-radius)/max(edgeSlope,.001),p.y+2.));
  float bank=1.-smoothstep(.04,1.3,bankDistance);
  float silt=noise(p*.24+vec2(2.3,7.1))*.68
    +noise(mat2(.8,.6,-.6,.8)*p*.62+vec2(5.7,1.3))*.32;
  float depth=smoothstep(.3,4.8,bankDistance);
  vec3 deep=mix(vec3(.027,.059,.044),vec3(.063,.091,.070),smoothstep(.15,.85,silt));
  deep*=mix(1.06,.84,depth);
  vec3 body=mix(deep,vec3(.084,.104,.078),bank*.42);
  body*=mix(1.,.84,evening)*mix(1.,.25,night);
  float reflectionAmount=clamp(.44+fresnel*.44-coolSky*.07*(1.-fresnel),.37,.88);
  vec3 color=mix(body,reflection,reflectionAmount);
  vec3 light=normalize(sunDirection);
  float glint=pow(max(dot(normal,normalize(eye+light)),0.),155.);
  color+=sunColor*sunPower*glint*.16*mix(1.,.3,night);
  // A narrow, uneven dark seam meets the damp stone, without a foam outline.
  float contact=1.-smoothstep(.018,.16,bankDistance+(noise(p*6.8)-.5)*.035);
  color+=vec3(.055,.067,.054)*(dx+dz)*detail*mix(1.,.25,night);
  color*=1.-bank*.035-contact*.19;
  gl_FragColor=vec4(color,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

function pondGeometry() {
  const shape = new T.Shape();
  shape.moveTo(-10, 2);
  shape.lineTo(10, 2);
  for (let i = 1; i <= 96; i++) {
    const a = (i / 96) * Math.PI;
    shape.lineTo(10 * Math.cos(a), 2 - 13 * Math.sin(a));
  }
  shape.closePath();
  return new T.ShapeGeometry(shape);
}

export default function HongcunPond({ onSelect }: Props) {
  const { size } = useThree();
  const reflector = useMemo(() => {
    const r = new Reflector(pondGeometry(), {
      textureWidth: 768,
      textureHeight: 768,
      multisample: 0,
      clipBias: 0.003,
      shader: {
        name: 'HongcunMoonPond',
        vertexShader,
        fragmentShader,
        uniforms: {
          tDiffuse: { value: null },
          color: { value: new T.Color() },
          textureMatrix: { value: new T.Matrix4() },
          time: { value: 0 },
          ...waterAtmosphereUniforms(),
          reflectionTexel: { value: new T.Vector2(1 / 768, 1 / 768) },
        },
      },
    });
    r.name = 'Hongcun moon pond';
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.86;
    const original = r.onBeforeRender;
    const previousCamera = new T.Matrix4(),
      previousProjection = new T.Matrix4();
    const viewport = new T.Vector4();
    let lastTime = -Infinity,
      inReflection = false;
    r.onBeforeRender = function (renderer, scene, camera, geometry, material, group) {
      if (inReflection || camera === r.camera) return;
      const otherMirrors: Reflector[] = [];
      let reflectedCamera = false;
      scene.traverse((object) => {
        if (object !== r && object instanceof Reflector) {
          if (object.camera === camera) reflectedCamera = true;
          if (object.visible) otherMirrors.push(object);
        }
      });
      // The Li River mirror may see this pond in the four-island overview.
      // Its virtual camera uses our existing texture, without another capture.
      if (reflectedCamera) return;
      const now = performance.now();
      const moved =
        !previousCamera.equals(camera.matrixWorld) || !previousProjection.equals(camera.projectionMatrix);
      if (!r.forceUpdate && !moved && now - lastTime < (r.userData.reflectionInterval ?? 70)) return;
      previousCamera.copy(camera.matrixWorld);
      previousProjection.copy(camera.projectionMatrix);
      lastTime = now;
      const target = renderer.getRenderTarget(),
        xr = renderer.xr.enabled,
        shadow = renderer.shadowMap.autoUpdate,
        visible = r.visible;
      renderer.getViewport(viewport);
      inReflection = true;
      otherMirrors.forEach((mirror) => {
        mirror.visible = false;
      });
      try {
        original.call(r, renderer, scene, camera, geometry, material, group);
      } finally {
        otherMirrors.forEach((mirror) => {
          mirror.visible = true;
        });
        renderer.setRenderTarget(target);
        renderer.setViewport(viewport);
        renderer.xr.enabled = xr;
        renderer.shadowMap.autoUpdate = shadow;
        r.visible = visible;
        inReflection = false;
      }
    };
    return r;
  }, []);
  useEffect(() => {
    const small = size.width < 700,
      side = small ? 512 : 768;
    reflector.getRenderTarget().setSize(side, side);
    (reflector.material as T.ShaderMaterial).uniforms.reflectionTexel.value.set(1 / side, 1 / side);
    reflector.userData.reflectionInterval = small ? 100 : 70;
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
  return (
    <primitive
      object={reflector}
      onClick={(event: { stopPropagation: () => void }) => {
        event.stopPropagation();
        onSelect();
      }}
    />
  );
}
