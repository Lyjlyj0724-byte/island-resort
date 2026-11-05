import { useEffect, useMemo } from 'react';
import * as T from 'three';
import { createUmongHead } from './UmongHead';
import { createUmongCourtyard } from './UmongCourtyard';

/** Photo-led sculpture garden; coordinates fit the existing mountainside ledge. */
export function createUmongMemorial() {
  const scene = new T.Group();
  scene.name = 'Wat Umong stone garden';
  scene.add(createUmongCourtyard());
  const head = createUmongHead();
  head.position.set(0.3, 0.16, 0.04);
  head.rotation.y = 0.1;
  scene.add(head);
  return scene;
}

export default function UmongScene({
  position,
  onSelect,
}: {
  position: [number, number, number];
  onSelect: () => void;
}) {
  const scene = useMemo(createUmongMemorial, []);
  useEffect(
    () => () => {
      const geometry = new Set<T.BufferGeometry>();
      const materials = new Set<T.Material>();
      const textures = new Set<T.Texture>();
      scene.traverse((object) => {
        if (!(object instanceof T.Mesh)) return;
        geometry.add(object.geometry);
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value instanceof T.Texture) textures.add(value);
        }
      });
      geometry.forEach((resource) => resource.dispose());
      textures.forEach((resource) => resource.dispose());
      materials.forEach((resource) => resource.dispose());
    },
    [scene],
  );
  return (
    <group
      position={position}
      scale={0.8}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      <primitive object={scene} dispose={null} />
    </group>
  );
}
