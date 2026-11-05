import * as THREE from 'three';

// A small, weathered stone portrait based on the owner's Wat Umong photograph.
// +Z is the face; the broken underside rests on y = 0. No DOM or image loaders.
const clamp = THREE.MathUtils.clamp;
const mix = THREE.MathUtils.lerp;
const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);
const bell = (x: number, width: number) => Math.exp(-(x * x) / (width * width));
const fract = (x: number) => x - Math.floor(x);
const hash = (x: number, y: number, z: number) =>
  fract(Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453);

function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = smooth(0, 1, x - ix),
    fy = smooth(0, 1, y - iy),
    fz = smooth(0, 1, z - iz);
  const a = mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx);
  const b = mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx);
  const c = mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx);
  const d = mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx);
  return mix(mix(a, b, fy), mix(c, d, fy), fz);
}

type Profile = readonly (readonly [number, number])[];
function profile(y: number, points: Profile): number {
  for (let i = 1; i < points.length; i++) {
    if (y <= points[i][0]) {
      const [ay, av] = points[i - 1],
        [by, bv] = points[i];
      return mix(av, bv, smooth(ay, by, y));
    }
  }
  return points[points.length - 1][1];
}

const headWidth: Profile = [
  [0, 0.255],
  [0.1, 0.305],
  [0.28, 0.369],
  [0.51, 0.421],
  [0.78, 0.457],
  [1.03, 0.474],
  [1.2, 0.488],
  [1.33, 0.478],
  [1.43, 0.408],
  [1.49, 0.265],
  [1.515, 0.06],
];
const headFront: Profile = [
  [0, 0.17],
  [0.16, 0.266],
  [0.4, 0.297],
  [0.7, 0.313],
  [0.98, 0.298],
  [1.18, 0.27],
  [1.34, 0.291],
  [1.45, 0.22],
  [1.515, 0.06],
];
const headBack: Profile = [
  [0, 0.18],
  [0.22, 0.28],
  [0.62, 0.355],
  [1.02, 0.361],
  [1.31, 0.317],
  [1.44, 0.221],
  [1.515, 0.06],
];

function hairline(x: number): number {
  return 1.145 + 0.033 * Math.cos(x * 7.5) + 0.018 * Math.sin(x * 16 + 0.8) + 0.007 * Math.sin(x * 35 + 1.2);
}

/** Relief is a single surface: brow, lids, nasal bridge, lips and chin are stone. */
function faceRelief(x: number, y: number): number {
  const ax = Math.abs(x);
  let z = 0.018 * bell(x, 0.35) * bell(y - 0.98, 0.33);
  z += 0.031 * bell(ax - 0.285, 0.14) * bell(y - 0.61, 0.18); // cheek planes
  z += 0.032 * bell(x, 0.205) * bell(y - 0.205, 0.105); // chin

  // Deep, gently asymmetric eye sockets, with a lowered upper lid inside them.
  const eyeX = 0.224 + (x < 0 ? -0.006 : 0.004);
  const ex = ax - eyeX;
  const u = ex / 0.13;
  const eyeY = 0.841 + (x < 0 ? 0.006 : -0.004);
  const lidLine = eyeY - 0.019 + 0.037 * u * u + 0.006 * u;
  const eyeWindow = bell(ex, 0.139);
  z -= 0.062 * eyeWindow * bell(y - (eyeY + 0.019), 0.091);
  z += 0.04 * bell(ex, 0.106) * bell(y - (eyeY + 0.028), 0.041);
  z -= 0.023 * bell(ex, 0.116) * bell(y - lidLine, 0.0085);
  z += 0.014 * bell(ex, 0.111) * bell(y - (lidLine - 0.021), 0.015);
  const browY = eyeY + 0.099 + 0.031 * (1 - u * u);
  z += 0.059 * bell(ex, 0.145) * bell(y - browY, 0.026);
  z -= 0.01 * eyeWindow * bell(y - browY - 0.03, 0.016);

  // A tapered, rather flat nasal ridge; the widening lower portion joins its alae.
  const bridge = smooth(0.551, 0.615, y) * (1 - smooth(0.91, 1.055, y));
  const noseWidth = mix(0.086, 0.043, smooth(0.59, 0.965, y));
  z += (0.119 + 0.025 * (1 - smooth(0.6, 0.88, y))) * bell(x, noseWidth) * bridge;
  z += 0.044 * bell(x, 0.075) * bell(y - 0.591, 0.037);
  z += 0.041 * bell(ax - 0.073, 0.03) * bell(y - 0.584, 0.032);
  z -= 0.023 * bell(ax - 0.062, 0.019) * bell(y - 0.558, 0.012);
  z -= 0.016 * bell(x, 0.105) * bell(y - 0.535, 0.014);
  z -= 0.011 * bell(x, 0.023) * bell(y - 0.478, 0.042); // philtrum
  z += 0.009 * bell(ax - 0.031, 0.015) * bell(y - 0.47, 0.045);

  // Full, relaxed lips with worn corners, not a separate smile-shaped tube.
  const mouthWindow = Math.exp(-Math.pow(x / 0.167, 4));
  const mouthLine = 0.363 + 0.015 * Math.pow(x / 0.17, 2) - 0.006 * bell(x, 0.033);
  const upper = 0.388 + 0.008 * bell(ax - 0.047, 0.03);
  z += 0.029 * mouthWindow * bell(y - upper, 0.023);
  z += 0.04 * bell(x, 0.141) * bell(y - 0.338, 0.024);
  z -= 0.024 * mouthWindow * bell(y - mouthLine, 0.0075);
  z -= 0.011 * bell(ax - 0.166, 0.025) * bell(y - 0.376, 0.019);
  z -= 0.014 * bell(x, 0.133) * bell(y - 0.297, 0.019);
  const foldX = 0.116 + (0.57 - y) * 0.25;
  z -= 0.008 * bell(ax - foldX, 0.016) * bell(y - 0.48, 0.1);

  // The front of the worn hair mass grows out of the same head. Its boundary is irregular.
  z += 0.018 * smooth(hairline(x) - 0.02, hairline(x) + 0.038, y);
  z -= 0.006 * bell(y - hairline(x), 0.013) * (1 - smooth(0.41, 0.49, ax));
  return z;
}

type XY = readonly [number, number];
const cracks: readonly (readonly XY[])[] = [
  [
    [-0.342, 1.42],
    [-0.326, 1.33],
    [-0.349, 1.25],
    [-0.322, 1.18],
  ],
  [
    [0.199, 1.5],
    [0.181, 1.39],
    [0.204, 1.31],
    [0.189, 1.25],
  ],
  [
    [0.339, 0.77],
    [0.365, 0.69],
    [0.346, 0.61],
    [0.366, 0.52],
    [0.348, 0.46],
  ],
  [
    [-0.281, 0.32],
    [-0.251, 0.24],
    [-0.265, 0.17],
    [-0.239, 0.07],
  ],
];

function crackMask(x: number, y: number): number {
  let result = 0;
  for (const path of cracks)
    for (let i = 1; i < path.length; i++) {
      const [ax, ay] = path[i - 1],
        [bx, by] = path[i];
      const dx = bx - ax,
        dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1);
      const distance = Math.hypot(x - ax - t * dx, y - ay - t * dy);
      result = Math.max(result, bell(distance, 0.0036));
    }
  return result;
}

const stoneDark = new THREE.Color('#35352e');
const stoneMid = new THREE.Color('#69665b');
const stoneWorn = new THREE.Color('#b1a796');
const mossDark = new THREE.Color('#444b32');
const mossLight = new THREE.Color('#79805a');
const goldWorn = new THREE.Color('#b5a16a');

function stoneColor(x: number, y: number, z: number, recess = 0): THREE.Color {
  const large = noise(x * 5.6 + 7, y * 5.6, z * 5.6);
  const grain = noise(x * 47 + 12, y * 47, z * 47);
  const medium = noise(x * 18, y * 18 + 5, z * 18 + 2);
  const c = stoneDark.clone().lerp(stoneMid, clamp(0.33 + large * 0.73 + (medium - 0.5) * 0.3, 0, 1));
  const wear = smooth(0.51, 0.8, noise(x * 10 + 28, y * 11, z * 12 + 4));
  c.lerp(stoneWorn, wear * 0.49);
  const damp = 0.1 * (1 - smooth(0.13, 0.34, y));
  const crown = 0.12 * smooth(1.13, 1.36, y);
  const patch = noise(x * 8.5 - 3, y * 8.5 + 13, z * 8.5);
  const moss = smooth(0.56, 0.77, patch + crown + damp + (medium - 0.5) * 0.16);
  c.lerp(mossDark.clone().lerp(mossLight, grain * 0.65), moss * 0.78);
  // Exposed nose/forehead retain specks of ochre leaf; no polished gold surface.
  if (z > 0.2 && y > 1.0 && y < 1.115 && Math.abs(x) < 0.11) {
    const leaf = smooth(0.72, 0.85, noise(x * 91 + 5, y * 91, z * 91));
    c.lerp(goldWorn, leaf * 0.63);
  }
  const fleck = noise(x * 129 + 31, y * 129, z * 129 + 4);
  c.multiplyScalar(0.9 + grain * 0.19 - smooth(0.78, 0.94, fleck) * 0.2);
  c.multiplyScalar(1 - clamp(recess, 0, 0.7));
  return c;
}

type Buffers = { positions: number[]; colors: number[]; uvs: number[]; indices: number[] };
const buffers = (): Buffers => ({ positions: [], colors: [], uvs: [], indices: [] });

function vertex(b: Buffers, x: number, y: number, z: number, u: number, v: number, shade = 0): number {
  const id = b.positions.length / 3;
  b.positions.push(x, y, z);
  const c = stoneColor(x, y, z, shade);
  b.colors.push(c.r, c.g, c.b);
  b.uvs.push(u, v);
  return id;
}

function geometry(b: Buffers): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(b.colors, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uvs, 2));
  g.setIndex(b.indices);
  g.computeVertexNormals();
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

function createHeadGeometry(): THREE.BufferGeometry {
  const b = buffers();
  const frontSegments = 100,
    backSegments = 44,
    ringSize = frontSegments + backSegments;
  const verticalSegments = 100;
  for (let row = 0; row <= verticalSegments; row++) {
    const baseY = (row / verticalSegments) * 1.515;
    const width = profile(baseY, headWidth);
    for (let j = 0; j < ringSize; j++) {
      const front = j <= frontSegments;
      const t = front ? -1 + (2 * j) / frontSegments : 1 - (2 * (j - frontSegments)) / backSegments;
      const x0 = t * width;
      const radial = Math.sqrt(Math.max(0, 1 - t * t));
      let z = front ? profile(baseY, headFront) * Math.pow(radial, 0.72) : -profile(baseY, headBack) * radial;
      const faceWeight = smooth(0, 0.18, radial);
      if (front) z += faceRelief(x0, baseY) * faceWeight;
      const rough =
        (noise(x0 * 46 + 2, baseY * 46, z * 46) - 0.5) * 0.0045 +
        (noise(x0 * 91, baseY * 91 + 5, z * 91) - 0.5) * 0.0018;
      const crown = smooth(1.12, 1.3, baseY);
      const uneven = (noise(x0 * 12, baseY * 12 + 6, z * 12) - 0.5) * (0.005 + crown * 0.014);
      const chip = smooth(0.77, 0.91, noise(x0 * 30 + 6, baseY * 30, z * 30)) * (0.004 + crown * 0.01);
      const crack = front ? crackMask(x0, baseY) * faceWeight : 0;
      z += (front ? 1 : -1) * (rough + uneven - chip);
      z -= crack * 0.008;
      const x = x0 + Math.sign(x0) * (rough + uneven * 0.5) * (1 - radial);
      // A small low fracture, with a truly flat support plane and no pedestal.
      const y =
        baseY +
        smooth(0, 0.07, baseY) * (1 - smooth(0.1, 0.23, baseY)) * (noise(x * 29, 4, z * 29) - 0.5) * 0.014;
      let shade = crack * 0.36;
      if (front) {
        const eyeX = 0.224 + (x < 0 ? -0.006 : 0.004),
          ex = Math.abs(x) - eyeX;
        const eyeY = 0.841 + (x < 0 ? 0.006 : -0.004);
        const lidLine = eyeY - 0.019 + 0.037 * Math.pow(ex / 0.13, 2) + 0.006 * (ex / 0.13);
        shade += 0.35 * bell(ex, 0.12) * bell(y - lidLine, 0.009);
        shade += 0.14 * bell(ex, 0.13) * bell(y - (eyeY + 0.085), 0.025);
        const mouthLine = 0.363 + 0.015 * Math.pow(x / 0.17, 2) - 0.006 * bell(x, 0.033);
        shade += 0.35 * Math.exp(-Math.pow(x / 0.167, 4)) * bell(y - mouthLine, 0.009);
        shade += 0.26 * bell(Math.abs(x) - 0.062, 0.022) * bell(y - 0.558, 0.014);
        shade += 0.085 * bell(y - hairline(x), 0.014);
      }
      vertex(b, x, y, z, j / ringSize, y / 1.515, shade);
    }
  }
  for (let row = 0; row < verticalSegments; row++)
    for (let j = 0; j < ringSize; j++) {
      const a = row * ringSize + j,
        d = row * ringSize + ((j + 1) % ringSize);
      const c = d + ringSize,
        e = a + ringSize;
      b.indices.push(a, d, c, a, c, e);
    }
  const bottom = vertex(b, 0, 0, 0, 0.5, 0, 0.3);
  const top = vertex(b, 0, 1.515, 0, 0.5, 1);
  for (let j = 0; j < ringSize; j++) {
    const next = (j + 1) % ringSize;
    b.indices.push(bottom, next, j);
    b.indices.push(top, verticalSegments * ringSize + j, verticalSegments * ringSize + next);
  }
  return geometry(b);
}

function createEarGeometry(side: -1 | 1): THREE.BufferGeometry {
  const b = buffers(),
    segments = 64,
    rings = 11;
  const centerX = side * 0.525,
    centerY = 0.652 + (side < 0 ? 0.018 : -0.01);
  // Front and back disks share their boundary, so the lobes have real thickness.
  const centerFront = vertex(b, centerX, centerY, 0.028, 0.5, 0.5, 0.18);
  for (let ring = 1; ring <= rings; ring++) {
    const r = ring / rings;
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2,
        ca = Math.cos(a),
        sa = Math.sin(a);
      const width = 0.123 + 0.029 * ca;
      const x = side * (0.525 + r * sa * width + 0.018 * r * ca);
      const y = centerY + r * 0.437 * ca;
      const edge = 0.02 + 0.015 * ca;
      const rim = 0.076 * bell(r - 0.8, 0.15);
      const bowl = -0.021 * bell(r - 0.39, 0.25);
      const antihelix = 0.024 * bell(r - 0.52, 0.13) * (0.5 + 0.5 * sa);
      const lobe = 0.03 * bell(ca + 0.8, 0.38) * bell(r - 0.63, 0.25);
      const grain = (noise(x * 38 + 3, y * 38, side * 5) - 0.5) * 0.006;
      const z = edge + rim + bowl + antihelix + lobe + grain * (1 - r * 0.5);
      vertex(b, x, y, z, (x * side - 0.36) * 3, y, 0.15 * bell(r - 0.42, 0.23));
    }
  }
  for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments;
    // Parametric order runs clockwise on the right ear, anticlockwise on the left.
    if (side > 0) b.indices.push(centerFront, 1 + next, 1 + j);
    else b.indices.push(centerFront, 1 + j, 1 + next);
  }
  for (let ring = 1; ring < rings; ring++)
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      const a = 1 + (ring - 1) * segments + j,
        c = 1 + ring * segments + next;
      const d = 1 + (ring - 1) * segments + next,
        e = 1 + ring * segments + j;
      if (side > 0) b.indices.push(a, d, c, a, c, e);
      else b.indices.push(a, c, d, a, e, c);
    }
  // A domed solid back, buried at the skull seam but fully closed for export.
  const backCenter = vertex(b, centerX, centerY, -0.075, 0.5, 0.5, 0.12);
  const backStart = b.positions.length / 3;
  for (let ring = 1; ring < rings; ring++) {
    const r = ring / rings;
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2,
        ca = Math.cos(a),
        sa = Math.sin(a);
      const x = side * (0.525 + r * sa * (0.123 + 0.029 * ca) + 0.018 * r * ca);
      const y = centerY + r * 0.437 * ca;
      const z = -0.075 * Math.sqrt(1 - r * r) + (0.02 + 0.015 * ca) * r * r;
      vertex(b, x, y, z, (x * side - 0.36) * 3, y);
    }
  }
  for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments;
    if (side > 0) b.indices.push(backCenter, backStart + j, backStart + next);
    else b.indices.push(backCenter, backStart + next, backStart + j);
  }
  for (let ring = 1; ring < rings; ring++)
    for (let j = 0; j < segments; j++) {
      const next = (j + 1) % segments;
      const a = backStart + (ring - 1) * segments + j;
      const d = backStart + (ring - 1) * segments + next;
      const e = ring === rings - 1 ? 1 + (rings - 1) * segments + j : a + segments;
      const c = ring === rings - 1 ? 1 + (rings - 1) * segments + next : d + segments;
      if (side > 0) b.indices.push(a, c, d, a, e, c);
      else b.indices.push(a, d, c, a, c, e);
    }
  return geometry(b);
}

function createTopknotGeometry(): THREE.BufferGeometry {
  const b = buffers(),
    segments = 64,
    rows = 22;
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const radius = profile(t, [
      [0, 0.223],
      [0.25, 0.217],
      [0.58, 0.176],
      [0.89, 0.142],
      [1, 0.119],
    ]);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const rough = (noise(ca * 4 + 4, t * 5, sa * 4) - 0.5) * 0.021;
      const r = radius + rough + 0.005 * Math.sin(a * 9 + t * 12);
      const x = ca * r - 0.035 * t;
      const z = sa * r * 0.82 - 0.035;
      const y = 1.373 + t * 0.374 + 0.013 * Math.sin(a * 3 + 0.4) * t + rough * 0.4;
      vertex(b, x, y, z, j / segments, t, 0.03);
    }
  }
  for (let row = 0; row < rows; row++)
    for (let j = 0; j < segments; j++) {
      const a = row * segments + j,
        d = row * segments + ((j + 1) % segments);
      b.indices.push(a, a + segments, d + segments, a, d + segments, d);
    }
  const bottom = vertex(b, 0, 1.373, -0.035, 0.5, 0);
  const top = vertex(b, -0.035, 1.748, -0.035, 0.5, 1);
  for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments;
    b.indices.push(bottom, j, next);
    b.indices.push(top, rows * segments + next, rows * segments + j);
  }
  return geometry(b);
}

function stoneBump(): THREE.DataTexture {
  const size = 128,
    pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const grain = hash(x, y, 19);
      const pit = grain < 0.06 ? -0.32 : 0;
      const value = Math.round(clamp(0.47 + (grain - 0.5) * 0.39 + pit, 0, 1) * 255);
      pixels[i] = pixels[i + 1] = pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  const map = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  map.name = 'umong-stone-micropores';
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.generateMipmaps = true;
  map.repeat.set(5, 6);
  map.needsUpdate = true;
  return map;
}

/** Pure construction: the caller owns all geometries, the shared material and bump texture. */
export function createUmongHead(): THREE.Group {
  const group = new THREE.Group();
  group.name = 'Wat Umong · weathered stone Buddha head';
  const stone = new THREE.MeshStandardMaterial({
    name: 'Umong mottled limestone',
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.98,
    metalness: 0,
    bumpMap: stoneBump(),
    bumpScale: 0.0045,
  });
  const parts: [string, THREE.BufferGeometry][] = [
    ['continuous carved face and closed skull', createHeadGeometry()],
    ['left carved ear and elongated lobe', createEarGeometry(-1)],
    ['right carved ear and elongated lobe', createEarGeometry(1)],
    ['broken weathered ushnisha', createTopknotGeometry()],
  ];
  for (const [name, g] of parts) {
    const mesh = new THREE.Mesh(g, stone);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.reference = 'owner photograph: Chiang Mai, Wat Umong';
  group.userData.orientation = 'face +Z; broken base y=0';
  return group;
}
