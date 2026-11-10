/* Gongang — small, dependency-free Wavefront OBJ adapter for locally modeled assets.
 * The asset stays editable in Blender; Three.js handles the GPU rendering.
 * Uses the project's existing /vendor/three.module.js instance; no CDN.
 */
const ASSET = '/assets/models/moonlit-lookout.obj';
const MATERIALS = '/assets/models/moonlit-lookout.mtl';

function parseMaterials(text) {
  const specs = new Map();
  let current = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    if (parts[0] === 'newmtl') {
      current = parts.slice(1).join(' ');
      specs.set(current, { rgb: [0.3, 0.3, 0.3] });
    } else if (parts[0] === 'Kd' && current && parts.length >= 4) {
      specs.get(current).rgb = parts.slice(1, 4).map(Number);
    }
  }
  return specs;
}

function parseObj(text, THREE, materials) {
  const points = [[0, 0, 0]];
  const groups = new Map();
  let materialName = 'StoneSlate';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('v ')) {
      const p = line.split(/\s+/);
      points.push([Number(p[1]), Number(p[2]), Number(p[3])]);
    } else if (line.startsWith('usemtl ')) {
      materialName = line.slice(7).trim();
    } else if (line.startsWith('f ')) {
      // Our exported original asset consists of triangles. Fan-triangulate
      // additional polygons for Blender edited roundtrips.
      const indices = line.slice(2).split(/\s+/).map(token => {
        const n = Number(token.split('/')[0]);
        return n < 0 ? points.length + n : n;
      });
      if (!groups.has(materialName)) groups.set(materialName, []);
      const target = groups.get(materialName);
      for (let i = 1; i < indices.length - 1; i++) {
        const a = indices[0], b = indices[i], c = indices[i + 1];
        if (!points[a] || !points[b] || !points[c]) continue;
        target.push(a, b, c);
      }
    }
  }

  const root = new THREE.Group();
  root.name = 'Blender-ready / Moonlit Lookout';
  for (const [name, indices] of groups) {
    if (!indices.length) continue;
    const used = new Map(), out = [], faceIds = [];
    for (const globalIndex of indices) {
      let idx = used.get(globalIndex);
      if (idx === undefined) {
        idx = out.length / 3;
        out.push(...points[globalIndex]);
        used.set(globalIndex, idx);
      }
      faceIds.push(idx);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    geo.setIndex(faceIds);
    geo.computeVertexNormals();

    const rgb = materials.get(name)?.rgb || [0.3, 0.3, 0.3];
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setRGB(...rgb, THREE.LinearSRGBColorSpace),
      roughness: name.startsWith('Iron') || name === 'LanternMetal' ? 0.52 : 0.88,
      metalness: name.startsWith('Iron') || name === 'LanternMetal' ? 0.38 : 0,
      flatShading: name.startsWith('Stone'),
      side: THREE.DoubleSide
    });

    if (name === 'LanternGlass') {
      mat.color.set('#f8d8a5');
      mat.transparent = true;
      mat.opacity = 0.42;
      mat.depthWrite = false;
      mat.emissive = new THREE.Color('#a86b30');
      mat.emissiveIntensity = 0.45;
    }
    if (name === 'LanternGlow') {
      mat.color.set('#ffe2a9');
      mat.emissive = new THREE.Color('#ffad57');
      mat.emissiveIntensity = 2.0;
      mat.toneMapped = false;
    }
    if (name.startsWith('Flower')) mat.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = name;
    mesh.castShadow = false; // No expensive shadow maps on mobile.
    mesh.receiveShadow = false;
    root.add(mesh);
  }
  return root;
}

/**
 * The original landscape and existing players remain untouched.
 * A missing OBJ or unsupported WebGL will never prevent the Canvas fallback.
 * @returns {Promise<THREE.Group>}
 */
export async function loadLookoutModel(THREE, scene) {
  const [objResponse, matResponse] = await Promise.all([
    fetch(ASSET, { cache: 'force-cache' }),
    fetch(MATERIALS, { cache: 'force-cache' })
  ]);
  if (!objResponse.ok || !matResponse.ok) throw new Error(
    'Local scenic OBJ assets unavailable: ' + objResponse.status + '/' + matResponse.status
  );
  const [objText, matText] = await Promise.all([objResponse.text(), matResponse.text()]);
  const model = parseObj(objText, THREE, parseMaterials(matText));
  model.position.set(7, -3.16, 18);
  model.rotation.y = -0.14;
  model.scale.setScalar(0.82);
  scene.add(model);

  const lantern = new THREE.PointLight('#ffbd70', 1.7, 10, 2);
  lantern.position.set(3.24, 2.15, -0.04);
  model.add(lantern);
  model.userData.lantern = lantern;
  model.userData.geometryCount = model.children.filter(item => item.isMesh).length;
  return model;
}


/**
 * Shared Wavefront reader. OBJ is a real model that can be opened in
 * Blender and exported again. No Blender runtime or third-party CDN required.
 */
async function readLocalMesh(THREE, baseName) {
  if (!/^[a-z0-9-]+$/i.test(baseName)) throw new Error('Invalid model name');
  const base = '/assets/models/' + baseName;
  const [objectResponse, materialResponse] = await Promise.all([
    fetch(base + '.obj'), fetch(base + '.mtl')
  ]);
  if (!objectResponse.ok || !materialResponse.ok) {
    throw new Error(baseName + ' mesh HTTP ' + objectResponse.status + '/' + materialResponse.status);
  }
  const [objectText, materialText] = await Promise.all([
    objectResponse.text(), materialResponse.text()
  ]);
  const group = parseObj(objectText, THREE, parseMaterials(materialText));
  if (!group.children.length) throw new Error(baseName + ': empty mesh');
  group.name = 'Gongang / ' + baseName;
  return group;
}

/**
 * Mount an original 3D sculpted alpine valley. Keep the old backdrop visible
 * until this promise resolves; if loading fails the scene stays unchanged.
 * The four sculpted mountain ranges already carry their world coordinates.
 */
export async function loadValleyTerrain(THREE, scene) {
  const mountainGroup = await readLocalMesh(THREE, 'alpine-valley');
  for (const part of mountainGroup.children) {
    part.material.roughness = 1;
    part.material.metalness = 0;
    part.material.flatShading = false;
    part.material.needsUpdate = true;
  }
  scene.add(mountainGroup);
  return mountainGroup;
}

/**
 * Reuse one authored 3D pine with GPU instancing (5 draw calls instead of
 * one draw call per tree). Places correspond to the authored mountain shape;
 * skip bad entries rather than allowing corrupt JSON to stop the whole scene.
 */
export async function loadAlpineGrove(THREE, scene) {
  const [model, layoutResponse] = await Promise.all([
    readLocalMesh(THREE, 'alpine-pine'),
    fetch('/assets/models/alpine-grove.json')
  ]);
  if (!layoutResponse.ok) throw new Error('Alpine placement HTTP ' + layoutResponse.status);
  const layout = await layoutResponse.json();
  const trees = Array.isArray(layout.trees) ? layout.trees.filter(tree =>
    Array.isArray(tree.position) && tree.position.length === 3 &&
    tree.position.every(Number.isFinite) &&
    Number.isFinite(tree.scale) && tree.scale > 0 && tree.scale < 3 &&
    Number.isFinite(tree.rotationY)
  ) : [];
  if (!trees.length || trees.length > 120) throw new Error('Invalid alpine grove layout');

  const root = new THREE.Group();
  root.name = 'Blender Pine Grove';
  const transform = new THREE.Object3D();
  const pos = new THREE.Vector3();
  const groupTint = new THREE.Color();
  for (const mesh of model.children) {
    const draw = new THREE.InstancedMesh(mesh.geometry, mesh.material, trees.length);
    draw.name = 'Instanced ' + mesh.name;
    draw.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    draw.frustumCulled = false;
    for (let i = 0; i < trees.length; i++) {
      const tree = trees[i];
      pos.fromArray(tree.position);
      transform.position.copy(pos);
      transform.rotation.set(0, tree.rotationY, 0);
      transform.scale.setScalar(tree.scale);
      transform.updateMatrix();
      draw.setMatrixAt(i, transform.matrix);
      const lift = 0.84 + ((i * 31) % 11) / 70;
      groupTint.setRGB(lift, lift, lift, THREE.LinearSRGBColorSpace);
      draw.setColorAt(i, groupTint);
    }
    draw.instanceMatrix.needsUpdate = true;
    if (draw.instanceColor) draw.instanceColor.needsUpdate = true;
    root.add(draw);
  }
  root.userData.count = trees.length;
  root.userData.parts = root.children.length;
  scene.add(root);
  return root;
}
