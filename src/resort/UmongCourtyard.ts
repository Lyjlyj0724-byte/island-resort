import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type V3 = [number, number, number];
type Part = { position: V3; scale: V3; rotation?: V3; color?: THREE.Color };

// All surfaces are generated from fixed seeds, including the small texture maps.
// The group deliberately needs no renderer, browser, canvas, or React lifecycle.
const random = (n: number) => THREE.MathUtils.euclideanModulo(Math.sin(n * 91.713 + 37.19) * 43758.5453, 1);
const wave = (x: number, y: number, z: number) =>
  Math.sin(x * 7.1 + z * 4.3) * 0.45 +
  Math.sin(y * 16.2 - x * 13.7 + z * 6.8) * 0.3 +
  Math.sin(x * 31.7 + z * 23.1 + y * 19.4) * 0.25;

function grainTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const pores = random(x + y * size + 7200);
      const broad = Math.sin(x * 0.19 + Math.sin(y * 0.07) * 3) * Math.sin(y * 0.23);
      const value = Math.round(211 + pores * 30 + broad * 9 - (pores < 0.045 ? 45 : 0));
      pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = 'Umong mineral grain (procedural)';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function mossTexture() {
  const size = 64;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const u = (x / (size - 1)) * 2 - 1,
        v = (y / (size - 1)) * 2 - 1;
      const grit = random(x + y * size + 9900);
      const edge = 1 - Math.hypot(u, v) + Math.sin(u * 19 + v * 11) * 0.13 + Math.sin(u * 31 - v * 17) * 0.08;
      pixels[i] = 66 + grit * 30;
      pixels[i + 1] = 72 + grit * 32;
      pixels[i + 2] = 38 + grit * 19;
      pixels[i + 3] = Math.max(0, Math.min(190, edge * 510)) * (grit > 0.12 ? 1 : 0.1);
    }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.name = 'Umong sparse moss (procedural)';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function transform(
  geometry: THREE.BufferGeometry,
  position: V3,
  scale: V3 = [1, 1, 1],
  rotation: V3 = [0, 0, 0],
) {
  geometry.applyMatrix4(
    new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    ),
  );
  return geometry;
}

function paintStone(geometry: THREE.BufferGeometry, seed = 0, bark = false) {
  const positions = geometry.getAttribute('position');
  const colors: number[] = [];
  const base = new THREE.Color(bark ? '#77634c' : '#91826b');
  const dark = new THREE.Color(bark ? '#3e352b' : '#494737');
  const mineral = new THREE.Color(bark ? '#a18a69' : '#bbad91');
  const moss = new THREE.Color('#4c5838');
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const n = wave(x + seed, y, z);
    color.copy(base).lerp(n < -0.13 ? dark : mineral, Math.abs(n) * 0.59);
    const damp = wave(x * 0.57 + seed * 0.3, y * 0.72, z * 0.78);
    if (!bark && damp > 0.34) color.lerp(moss, Math.min(0.67, (damp - 0.34) * 1.7));
    color.multiplyScalar(0.94 + random(i + seed * 71) * 0.12);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function collect(
  target: THREE.BufferGeometry[],
  geometry: THREE.BufferGeometry,
  position: V3,
  scale: V3 = [1, 1, 1],
  rotation: V3 = [0, 0, 0],
) {
  transform(geometry, position, scale, rotation);
  target.push(geometry.index ? geometry.toNonIndexed() : geometry);
  if (geometry.index) geometry.dispose();
}

function meshBatch(
  group: THREE.Group,
  name: string,
  geometries: THREE.BufferGeometry[],
  material: THREE.Material,
  stoneSeed?: number,
) {
  if (!geometries.length) return;
  const geometry = mergeGeometries(geometries, false)!;
  geometries.forEach((g) => g.dispose());
  if (stoneSeed !== undefined) paintStone(geometry, stoneSeed, name.includes('root'));
  geometry.computeBoundingSphere();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.castShadow = mesh.receiveShadow = true;
  group.add(mesh);
}

function instanceBatch(
  group: THREE.Group,
  name: string,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parts: Part[],
  shadow = true,
) {
  const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
  const matrix = new THREE.Matrix4(),
    quaternion = new THREE.Quaternion();
  parts.forEach((part, i) => {
    quaternion.setFromEuler(new THREE.Euler(...(part.rotation ?? [0, 0, 0])));
    matrix.compose(new THREE.Vector3(...part.position), quaternion, new THREE.Vector3(...part.scale));
    mesh.setMatrixAt(i, matrix);
    if (part.color) mesh.setColorAt(i, part.color);
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.name = name;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  group.add(mesh);
}

function wornBrick(seed: number) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const positions = geometry.getAttribute('position');
  // Shared corner displacement keeps every face closed, unlike per-face jitter.
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const corner = (x > 0 ? 1 : 0) + (y > 0 ? 2 : 0) + (z > 0 ? 4 : 0);
    positions.setXYZ(
      i,
      x * (1 - random(seed + corner * 4) * 0.035),
      y * (1 - random(seed + corner * 4 + 1) * 0.13),
      z * (1 - random(seed + corner * 4 + 2) * 0.09),
    );
  }
  geometry.computeVertexNormals();
  return geometry;
}

function brickColor(x: number, y: number, seed: number) {
  const color = new THREE.Color().lerpColors(
    new THREE.Color('#896044'),
    new THREE.Color('#c08252'),
    random(seed),
  );
  const streak = Math.pow(Math.max(0, Math.sin(x * 5.3 + 0.6) * 0.65 + Math.sin(x * 12.2) * 0.35), 2);
  const washed = Math.max(0, wave(x * 0.69 + 8, y * 0.53, 0.6) - 0.1);
  color.lerp(new THREE.Color('#434735'), streak * (0.3 + y * 0.27));
  color.lerp(new THREE.Color('#c1aa80'), washed * 0.84);
  if (y < 0.43) color.lerp(new THREE.Color('#4c5038'), 0.39 + 0.26 * random(seed + 1));
  return color;
}

function addWallWeathering(group: THREE.Group) {
  const width = 512,
    height = 192,
    data = new Uint8Array(width * height * 4);
  const dark = new THREE.Color('#3e4130'),
    pale = new THREE.Color('#c2ad87');
  // A single transparent sheet supplies continuous mineral washes over the joints.
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const wx = (x / width) * 4.7 - 2.35,
        wy = (y / height) * 1.32;
      const veins = Math.max(
        0,
        Math.sin(wx * 6.2 + Math.sin(wy * 2.4) * 0.35) * 0.65 + Math.sin(wx * 19.7 + wy * 0.9) * 0.35,
      );
      const damp = Math.max(0, veins - 0.44) * (1.0 - wy * 0.35) + Math.max(0, 0.22 - wy) * 1.3;
      const lime = Math.max(0, wave(wx * 0.65 + 5, wy * 1.5, 0.3) - 0.32);
      const color = damp > lime ? dark : pale;
      const alpha = Math.min(0.62, Math.max(damp, lime * 0.62)) * (0.5 + random(x + y * width + 99) * 0.5);
      const i = (y * width + x) * 4;
      data[i] = color.r * 255;
      data[i + 1] = color.g * 255;
      data[i + 2] = color.b * 255;
      data[i + 3] = alpha * 255;
    }
  const texture = new THREE.DataTexture(data, width, height);
  texture.name = 'continuous old water and mineral stains';
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    roughness: 1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.7, 1.32), material);
  mesh.position.set(0, 0.83, -1.177);
  mesh.name = 'weather washes across the old brick face';
  mesh.receiveShadow = true;
  group.add(mesh);
}

function addWalls(
  group: THREE.Group,
  surface: THREE.MeshStandardMaterial,
  mortar: THREE.MeshStandardMaterial,
) {
  const cores: THREE.BufferGeometry[] = [];
  collect(cores, new THREE.BoxGeometry(4.69, 1.26, 0.2), [0, 0.79, -1.38]);
  collect(cores, new THREE.BoxGeometry(0.19, 0.43, 1.32), [-2.265, 0.355, -0.63]);
  meshBatch(group, 'old recessed lime and earth joints', cores, mortar);
  const rows: Part[][] = [[], [], []];
  for (let row = 0; row < 22; row++) {
    const y = 0.194 + row * 0.062;
    for (let column = -1; column < 18; column++) {
      const seed = 100 + row * 31 + column;
      const left = Math.max(-2.36, -2.36 + column * 0.276 + (row % 2) * 0.138);
      const right = Math.min(2.36, -2.36 + (column + 1) * 0.276 + (row % 2) * 0.138);
      if (right - left < 0.04 || (row === 21 && random(seed) < 0.34)) continue;
      const x = (left + right) * 0.5;
      const height = row === 21 ? 0.028 + random(seed + 6) * 0.028 : 0.058 + random(seed + 2) * 0.005;
      rows[Math.floor(random(seed + 4) * 3)].push({
        position: [
          x,
          y + (random(seed + 5) - 0.5) * (row === 21 ? 0.032 : 0.01),
          -1.34 + (random(seed + 3) - 0.5) * 0.016,
        ],
        scale: [right - left - 0.004, height, 0.282 + random(seed + 8) * 0.018],
        rotation: [0, 0, (random(seed + 7) - 0.5) * 0.018],
        color: brickColor(x, y, seed),
      });
    }
  }
  // The left return is broken and low; it never frames the front like a stage.
  for (let row = 0; row < 9; row++)
    for (let column = 0; column < 6; column++) {
      const z = -1.29 + column * 0.258 + (row % 2) * 0.1;
      if (z > 0.13 || (z > -0.25 && row > 4) || (z > -0.5 && row > 6)) continue;
      const seed = 1300 + row * 11 + column;
      rows[row % 3].push({
        position: [-2.26, 0.19 + row * 0.061, z],
        scale: [0.26, 0.052, 0.247],
        color: brickColor(z, row * 0.061, seed),
      });
    }
  rows.forEach((parts, i) =>
    instanceBatch(group, `thin irregular brick courses ${i + 1}`, wornBrick(i * 80 + 1), surface, parts),
  );
  addWallWeathering(group);
}

function erodedStone(seed: number, segments = 14, rings = 9) {
  const geometry = new THREE.SphereGeometry(1, segments, rings);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const radial = 1 + wave(x + seed, y * 1.3, z * 1.1) * 0.065;
    // A worn fracture plane, plus smooth edges, avoids a pile of regular cubes.
    positions.setXYZ(i, x * radial, Math.min(y * radial, 0.77 + Math.sin(x * 8 + seed) * 0.035), z * radial);
  }
  geometry.computeVertexNormals();
  return geometry;
}

function torsoGeometry(seed: number) {
  const profile = [
    [0.22, 0.22, 0.14],
    [0.31, 0.215, 0.15],
    [0.42, 0.19, 0.145],
    [0.55, 0.245, 0.165],
    [0.67, 0.305, 0.17],
    [0.755, 0.285, 0.145],
    [0.805, 0.2, 0.125],
    [0.83, 0.09, 0.085],
    [0.915, 0.095, 0.086],
  ];
  const curve = new THREE.CatmullRomCurve3(
    profile.map(([y, rx, rz]) => new THREE.Vector3(y, rx, rz)),
    false,
    'catmullrom',
    0.2,
  );
  const smoothProfile = curve.getPoints(22).map((p) => [p.x, p.y, p.z]);
  const segments = 28,
    vertices: number[] = [],
    uv: number[] = [],
    indices: number[] = [];
  smoothProfile.forEach(([y, rx, rz], ring) => {
    for (let j = 0; j <= segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const noise = wave(Math.cos(angle) + seed, y, Math.sin(angle)) * 0.014;
      const top =
        ring === smoothProfile.length - 1
          ? Math.sin(angle * 3 + seed) * 0.018 + Math.sin(angle * 7) * 0.012
          : 0;
      vertices.push(Math.cos(angle) * (rx + noise), y + top, Math.sin(angle) * (rz + noise));
      uv.push(j / segments, ring / (smoothProfile.length - 1));
      if (ring < smoothProfile.length - 1 && j < segments) {
        const a = ring * (segments + 1) + j,
          b = a + segments + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  });
  const topIndex = vertices.length / 3;
  vertices.push(0, 0.9, 0);
  uv.push(0.5, 0.5);
  for (let j = 0; j < segments; j++)
    indices.push(
      topIndex,
      (smoothProfile.length - 1) * (segments + 1) + j + 1,
      (smoothProfile.length - 1) * (segments + 1) + j,
    );
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function tube(points: V3[], radius: number, segments = 12, radialSegments = 7) {
  return new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
    segments,
    radius,
    radialSegments,
    false,
  );
}

function seatedTorso(
  target: THREE.BufferGeometry[],
  position: V3,
  scale: number,
  turn: number,
  seed: number,
  brokenArm: boolean,
) {
  const parts: THREE.BufferGeometry[] = [];
  collect(parts, erodedStone(seed), [0, 0.115, 0.025], [0.46, 0.14, 0.3]);
  collect(parts, torsoGeometry(seed), [0, 0, -0.025]);
  // Distinct overlapping knees and folded calves read as seated sculpture.
  collect(
    parts,
    tube(
      [
        [-0.29, 0.2, 0.12],
        [-0.34, 0.23, 0.25],
        [-0.12, 0.245, 0.28],
        [0.23, 0.23, 0.14],
      ],
      0.085,
    ),
    [0, 0, 0],
  );
  collect(
    parts,
    tube(
      [
        [0.29, 0.19, 0.1],
        [0.35, 0.2, 0.23],
        [0.13, 0.185, 0.32],
        [-0.18, 0.18, 0.26],
      ],
      0.077,
    ),
    [0, 0, 0],
  );
  collect(parts, erodedStone(seed + 2), [-0.28, 0.22, 0.2], [0.15, 0.1, 0.14]);
  collect(parts, erodedStone(seed + 3), [0.29, 0.2, 0.19], [0.15, 0.09, 0.14]);
  collect(
    parts,
    tube(
      brokenArm
        ? [
            [-0.255, 0.7, -0.015],
            [-0.31, 0.57, 0.01],
            [-0.29, 0.4, 0.13],
            [-0.1, 0.32, 0.23],
          ]
        : [
            [-0.255, 0.7, -0.015],
            [-0.335, 0.59, 0.01],
            [-0.34, 0.47, 0.06],
          ],
      0.078,
      12,
      10,
    ),
    [0, 0, 0],
  );
  if (brokenArm) {
    collect(
      parts,
      tube(
        [
          [0.265, 0.69, -0.01],
          [0.33, 0.57, 0.015],
          [0.335, 0.49, 0.04],
        ],
        0.075,
        7,
      ),
      [0, 0, 0],
    );
  } else {
    collect(
      parts,
      tube(
        [
          [0.26, 0.7, -0.01],
          [0.34, 0.56, 0.015],
          [0.33, 0.37, 0.13],
          [0.13, 0.31, 0.24],
        ],
        0.068,
      ),
      [0, 0, 0],
    );
    collect(parts, erodedStone(seed + 5), [0.09, 0.305, 0.25], [0.13, 0.041, 0.073], [0, -0.2, 0]);
  }
  collect(parts, erodedStone(seed + 4), [-0.2, 0.29, 0.25], [0.1, 0.038, 0.065], [0, -0.3, 0]);
  // Thin raised robe folds on the left flank and lap, rather than a featureless egg.
  collect(
    parts,
    tube(
      [
        [-0.17, 0.76, 0.09],
        [-0.22, 0.62, 0.13],
        [-0.17, 0.4, 0.14],
        [-0.1, 0.32, 0.17],
      ],
      0.014,
      10,
      5,
    ),
    [0, 0, 0],
  );
  const combined = mergeGeometries(parts, false)!;
  parts.forEach((g) => g.dispose());
  collect(target, combined, position, [scale, scale, scale], [0, turn, seed === 18 ? -0.095 : 0.035]);
}

function addRelics(group: THREE.Group, stoneMaterial: THREE.MeshStandardMaterial) {
  const stone: THREE.BufferGeometry[] = [];
  seatedTorso(stone, [-1.34, 0.16, -0.32], 1.05, 0.11, 12, false);
  seatedTorso(stone, [1.57, 0.16, -0.37], 0.88, -0.29, 18, true);
  // A little fragment with shoulders, severed neck and no head among the rubble.
  collect(stone, torsoGeometry(23), [-1.88, 0.11, 0.48], [0.46, 0.48, 0.5], [0.04, 0.24, -0.16]);
  collect(stone, erodedStone(24), [-1.88, 0.19, 0.54], [0.25, 0.08, 0.18]);
  const chunks: { p: V3; s: V3; r: V3 }[] = [
    { p: [-1.95, 0.23, -0.76], s: [0.18, 0.16, 0.15], r: [0.5, 0.3, 0.2] },
    { p: [-0.98, 0.23, 0.53], s: [0.19, 0.11, 0.14], r: [0.3, 0.7, 0.4] },
    { p: [-0.62, 0.2, 0.9], s: [0.14, 0.075, 0.12], r: [0.2, 0.2, -0.3] },
    { p: [1.1, 0.22, 0.62], s: [0.16, 0.1, 0.14], r: [0.4, -0.3, 0.2] },
    { p: [1.96, 0.25, 0.34], s: [0.19, 0.15, 0.22], r: [0.3, 1.2, 0.2] },
    { p: [1.85, 0.2, 0.92], s: [0.17, 0.08, 0.13], r: [0.1, 0.2, 0.3] },
    { p: [-1.55, 0.24, 1.08], s: [0.17, 0.13, 0.13], r: [0.4, 0.8, 0.2] },
    { p: [0.84, 0.2, -0.77], s: [0.13, 0.09, 0.17], r: [0.4, 0.3, -0.2] },
  ];
  chunks.forEach((part, i) => collect(stone, erodedStone(40 + i), part.p, part.s, part.r));
  // A fallen head lies on its side. Features are shallow and subordinate to the hero.
  const smallHead: THREE.BufferGeometry[] = [];
  collect(smallHead, erodedStone(51, 18, 12), [0, 0.1, 0], [0.13, 0.18, 0.12]);
  collect(smallHead, erodedStone(52, 12, 7), [0, 0.11, 0.112], [0.027, 0.05, 0.025]);
  collect(smallHead, erodedStone(53, 12, 7), [0, 0.265, -0.015], [0.1, 0.065, 0.095]);
  for (const s of [-1, 1])
    collect(smallHead, erodedStone(54 + s, 10, 7), [s * 0.128, 0.09, -0.01], [0.027, 0.067, 0.027]);
  const head = mergeGeometries(smallHead, false)!;
  smallHead.forEach((g) => g.dispose());
  collect(stone, head, [1.5, 0.23, 0.65], [1, 1, 1], [0.25, -0.5, -1.1]);
  // Palm and a few surviving fingers; intentionally asymmetrical broken artifacts.
  collect(stone, erodedStone(60), [-1.12, 0.2, 1.14], [0.1, 0.035, 0.12], [0.1, 0.4, 0]);
  for (let i = 0; i < 3; i++)
    collect(
      stone,
      tube(
        [
          [-1.18 + i * 0.045, 0.2, 1.18],
          [-1.16 + i * 0.043, 0.205, 1.29],
          [-1.15 + i * 0.041, 0.19, 1.33],
        ],
        0.018,
        5,
        5,
      ),
      [0, 0, 0],
    );
  collect(
    stone,
    tube(
      [
        [1.78, 0.2, 0.76],
        [1.65, 0.235, 0.83],
        [1.57, 0.21, 0.94],
      ],
      0.057,
      9,
      7,
    ),
    [0, 0, 0],
  );
  meshBatch(group, 'weathered seated torsos and sculptural fragments', stone, stoneMaterial, 8);
}

function leafGeometry() {
  const geometry = new THREE.BufferGeometry();
  // Folded, pointed outline with a raised central vein and curled tip.
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
        0, 0.025, -0.5, -0.3, 0, -0.18, 0, 0.045, -0.16, 0.29, 0.005, -0.18, -0.23, 0.025, 0.22, 0, 0.065,
        0.25, 0.25, 0.015, 0.22, 0, 0.11, 0.5,
      ],
      3,
    ),
  );
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      [0.5, 0, 0, 0.3, 0.5, 0.3, 1, 0.3, 0.1, 0.7, 0.5, 0.7, 0.9, 0.7, 0.5, 1],
      2,
    ),
  );
  geometry.setIndex([0, 2, 1, 0, 3, 2, 1, 2, 4, 2, 5, 4, 2, 3, 5, 3, 6, 5, 4, 5, 7, 5, 6, 7]);
  geometry.computeVertexNormals();
  return geometry;
}

function addFloor(
  group: THREE.Group,
  soil: THREE.MeshStandardMaterial,
  leaf: THREE.MeshStandardMaterial,
  grit: THREE.MeshStandardMaterial,
  moss: THREE.MeshStandardMaterial,
) {
  const ground = new THREE.PlaneGeometry(4.76, 3.24, 38, 26);
  ground.rotateX(-Math.PI / 2);
  const positions = ground.getAttribute('position'),
    colors: number[] = [];
  const earth = new THREE.Color('#82715b'),
    pale = new THREE.Color('#a48d6d'),
    dark = new THREE.Color('#5d5642');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i);
    positions.setY(i, 0.14 + wave(x, 0, z) * 0.013);
    const n = wave(x * 0.77, 0, z * 1.3);
    const color = earth.clone().lerp(n < 0 ? dark : pale, Math.abs(n) * 0.56);
    colors.push(color.r, color.g, color.b);
  }
  ground.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  ground.computeVertexNormals();
  const floor = new THREE.Mesh(ground, soil);
  floor.name = 'uneven earth beneath the fallen leaves';
  floor.receiveShadow = true;
  group.add(floor);
  const edge = new THREE.Mesh(
    new THREE.BoxGeometry(4.73, 0.1, 3.21),
    new THREE.MeshStandardMaterial({ color: '#675b47', roughness: 1 }),
  );
  edge.position.y = 0.071;
  edge.name = 'shallow earth edge';
  edge.receiveShadow = true;
  group.add(edge);
  const leaves: Part[] = [];
  const palette = ['#b89559', '#a67e42', '#c9ad73', '#876039', '#8d754e', '#b57943', '#786a40', '#d0ba84'];
  for (let i = 0; i < 760; i++) {
    const x = (random(i * 11 + 11) - 0.5) * 4.45,
      z = -1.03 + random(i * 11 + 12) * 2.53;
    // A few leaves under the head are fine; raised fragments never enter its footprint.
    if (Math.abs(x - 0.3) < 0.59 && Math.abs(z - 0.04) < 0.38 && random(i + 8800) < 0.8) continue;
    const length = 0.065 + random(i * 11 + 14) * 0.1;
    leaves.push({
      position: [x, 0.155 + wave(x, 0, z) * 0.013 + random(i * 11 + 13) * 0.013, z],
      scale: [length * (0.75 + random(i * 11 + 15) * 0.4), length, length],
      rotation: [
        (random(i + 21) - 0.5) * 0.18,
        random(i * 11 + 16) * Math.PI * 2,
        (random(i + 33) - 0.5) * 0.18,
      ],
      color: new THREE.Color(palette[Math.floor(random(i * 11 + 17) * palette.length)]),
    });
  }
  instanceBatch(group, 'curled ochre and brown leaf litter', leafGeometry(), leaf, leaves, false);
  const pebbles: Part[] = [];
  for (let i = 0; i < 125; i++) {
    const x = (random(i * 7 + 5000) - 0.5) * 4.45,
      z = -0.98 + random(i * 7 + 5001) * 2.44;
    const size = 0.012 + random(i * 7 + 5002) * 0.024;
    pebbles.push({
      position: [x, 0.155, z],
      scale: [size * 1.4, size * 0.7, size],
      rotation: [0, random(i + 5004) * 6, 0.2],
      color: new THREE.Color().lerpColors(
        new THREE.Color('#68604c'),
        new THREE.Color('#b7a484'),
        random(i + 5005),
      ),
    });
  }
  instanceBatch(group, 'small rounded grit', new THREE.IcosahedronGeometry(1, 0), grit, pebbles, false);
  const patches: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 22; i++) {
    const x = i < 13 ? -2.1 + i * 0.35 : (i % 2 ? -1.95 : 1.95) + (random(i) - 0.5) * 0.18;
    const z = i < 13 ? -0.99 + random(i + 70) * 0.21 : -0.8 + random(i + 90) * 1.85;
    collect(
      patches,
      new THREE.PlaneGeometry(1, 1),
      [x, 0.162, z],
      [0.2 + random(i + 50) * 0.43, 0.18 + random(i + 60) * 0.26, 1],
      [-Math.PI / 2, 0, random(i + 25) * 6],
    );
  }
  meshBatch(group, 'moss creeping along the damp wall foot', patches, moss);
}

function addRootsAndFerns(
  group: THREE.Group,
  rootMaterial: THREE.MeshStandardMaterial,
  greenMaterial: THREE.MeshStandardMaterial,
) {
  const roots: THREE.BufferGeometry[] = [];
  const paths: { p: V3[]; r: number }[] = [
    {
      p: [
        [-2.18, 0.19, 1.34],
        [-1.8, 0.2, 1.28],
        [-1.38, 0.22, 1.41],
        [-0.93, 0.18, 1.36],
        [-0.5, 0.17, 1.49],
      ],
      r: 0.053,
    },
    {
      p: [
        [-1.78, 0.19, 1.28],
        [-1.78, 0.205, 0.99],
        [-1.6, 0.18, 0.77],
        [-1.49, 0.16, 0.61],
      ],
      r: 0.031,
    },
    {
      p: [
        [-0.93, 0.18, 1.36],
        [-0.79, 0.19, 1.1],
        [-0.52, 0.18, 0.97],
        [-0.31, 0.16, 0.85],
      ],
      r: 0.023,
    },
    {
      p: [
        [2.22, 0.18, 1.26],
        [1.93, 0.2, 1.36],
        [1.6, 0.18, 1.32],
        [1.28, 0.17, 1.4],
        [1.01, 0.16, 1.48],
      ],
      r: 0.039,
    },
    {
      p: [
        [1.94, 0.2, 1.35],
        [2.07, 0.205, 1.02],
        [2.05, 0.17, 0.8],
      ],
      r: 0.029,
    },
    {
      p: [
        [-2.02, 0.17, 0.7],
        [-1.88, 0.19, 0.57],
        [-1.71, 0.18, 0.39],
      ],
      r: 0.022,
    },
  ];
  paths.forEach(({ p, r }, i) => {
    const geometry = tube(p, r, 16, 7);
    const positions = geometry.getAttribute('position');
    for (let v = 0; v < positions.count; v++) {
      const x = positions.getX(v),
        y = positions.getY(v),
        z = positions.getZ(v);
      positions.setY(v, y + Math.sin(x * 67 + z * 21 + i) * 0.003);
    }
    geometry.computeVertexNormals();
    collect(roots, geometry, [0, 0, 0]);
  });
  meshBatch(group, 'old exposed roots winding through the leaf litter', roots, rootMaterial, 23);
  const plants: THREE.BufferGeometry[] = [];
  const fernLocations: V3[] = [
    [-2.03, 0.16, -0.76],
    [1.95, 0.16, -0.79],
    [2.04, 0.16, 0.36],
    [-2.05, 0.16, 0.1],
  ];
  fernLocations.forEach((base, plant) => {
    for (let frond = 0; frond < 6; frond++) {
      const angle = (frond * Math.PI) / 3 + plant * 0.6;
      const length = 0.2 + random(plant * 30 + frond) * 0.16;
      const point = (t: number) =>
        new THREE.Vector3(
          base[0] + Math.cos(angle) * length * t,
          base[1] + Math.sin(t * 2.1) * length * 0.72,
          base[2] + Math.sin(angle) * length * t,
        );
      const stem = new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([point(0), point(0.33), point(0.67), point(1)]),
        8,
        0.004,
        4,
        false,
      );
      collect(plants, stem, [0, 0, 0]);
      for (let pair = 1; pair <= 7; pair++)
        for (const side of [-1, 1]) {
          const t = pair / 8,
            origin = point(t),
            width = 0.07 * Math.sin(t * Math.PI) * (length / 0.3);
          const perpendicular = new THREE.Vector3(-Math.sin(angle) * side, 0.2, Math.cos(angle) * side);
          const tip = origin
            .clone()
            .addScaledVector(perpendicular, width)
            .addScaledVector(new THREE.Vector3(Math.cos(angle), 0.2, Math.sin(angle)), 0.02);
          const mid = origin.clone().lerp(tip, 0.5);
          mid.y += 0.012;
          const cross = new THREE.Vector3(Math.cos(angle) * 0.014, 0, Math.sin(angle) * 0.014);
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(
              [
                ...origin.toArray(),
                ...mid.clone().add(cross).toArray(),
                ...tip.toArray(),
                ...mid.clone().sub(cross).toArray(),
              ],
              3,
            ),
          );
          geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0.5, 0, 0, 0.5, 0.5, 1, 1, 0.5], 2));
          geometry.setIndex([0, 1, 2, 0, 2, 3]);
          geometry.computeVertexNormals();
          collect(plants, geometry, [0, 0, 0]);
        }
    }
  });
  meshBatch(group, 'small fern fronds at the courtyard edges', plants, greenMaterial);
}

/** Local courtyard: x [-2.4, 2.4], z [-1.65, 1.65], earth surface near y .16. */
export function createUmongCourtyard(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Wat Umong old brick courtyard';
  const grain = grainTexture();
  const rough = (color: string, vertexColors = false) =>
    new THREE.MeshStandardMaterial({
      color,
      map: grain,
      bumpMap: grain,
      bumpScale: 0.009,
      roughness: 1,
      vertexColors,
    });
  const brick = rough('#ffffff');
  const mortar = rough('#685e48');
  const stone = rough('#ffffff', true);
  const soil = rough('#ffffff', true);
  soil.bumpScale = 0.018;
  const leaves = rough('#ffffff');
  leaves.side = THREE.DoubleSide;
  leaves.bumpScale = 0.003;
  const grit = rough('#ffffff');
  const roots = rough('#ffffff', true);
  roots.bumpScale = 0.018;
  const green = rough('#667148');
  green.side = THREE.DoubleSide;
  const moss = new THREE.MeshStandardMaterial({
    map: mossTexture(),
    transparent: true,
    depthWrite: false,
    alphaTest: 0.12,
    roughness: 1,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  addWalls(group, brick, mortar);
  addFloor(group, soil, leaves, grit, moss);
  addRelics(group, stone);
  addRootsAndFerns(group, roots, green);
  group.userData.heroHeadAnchor = [0.3, 0.16, 0.04];
  group.userData.description =
    'Thin weathered brick courses, earth and fallen leaves, exposed roots, and broken seated stone Buddhas.';
  return group;
}
