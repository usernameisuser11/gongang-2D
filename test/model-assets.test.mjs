import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../public/assets/models/', import.meta.url);
const readAsset = name => readFile(new URL(name, root), 'utf8');

function inspectOBJ(text) {
  const points = [[0, 0, 0]];
  const faces = [];
  const groups = new Set();
  let current = '';
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('v ')) {
      const values = line.slice(2).trim().split(/\s+/).map(Number);
      assert.equal(values.length, 3);
      assert.ok(values.every(Number.isFinite), 'vertex coordinates must be finite');
      points.push(values);
    } else if (line.startsWith('usemtl ')) {
      current = line.slice(7).trim();
      groups.add(current);
    } else if (line.startsWith('f ')) {
      const indices = line.slice(2).split(/\s+/).map(Number);
      assert.equal(indices.length, 3, 'only triangulated faces are expected');
      assert.ok(indices.every(n => Number.isInteger(n) && n > 0));
      faces.push(indices);
    }
  }
  assert.ok(points.length > 100, 'a real editable mesh must be present');
  assert.ok(faces.length > 100, 'mesh must contain triangles');
  assert.ok(faces.every(face => face.every(n => n < points.length)),
    'OBJ must not refer to missing vertices');
  assert.ok(groups.size > 1, 'mesh should have multiple meaningful materials');
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const p of points.slice(1)) for (let i = 0; i < 3; i++) {
    min[i] = Math.min(min[i], p[i]);
    max[i] = Math.max(max[i], p[i]);
  }
  return { points, faces, groups, span: max.map((x, i) => x - min[i]) };
}

for (const name of ['moonlit-lookout', 'alpine-valley', 'alpine-pine']) {
  test('Gongang 3D source mesh ' + name + ' is complete', async () => {
    const [obj, mtl] = await Promise.all([
      readAsset(name + '.obj'), readAsset(name + '.mtl')
    ]);
    const inspected = inspectOBJ(obj);
    const declared = new Set([...mtl.matchAll(/^newmtl\s+(.+)$/gm)]
      .map(match => match[1].trim()));
    for (const used of inspected.groups) {
      assert.ok(declared.has(used), 'undefined material: ' + used);
    }
    assert.ok(inspected.span[0] > 0.5);
    assert.ok(inspected.span[1] > 0.5);
    assert.ok(inspected.span[2] > 0.5, 'model must have actual 3D depth');
    assert.ok(inspected.faces.length < 30000, 'keep models reasonably light');
  });
}

test('Alpine pine grove positions have safe numeric ranges', async () => {
  const data = JSON.parse(await readAsset('alpine-grove.json'));
  assert.ok(data.trees.length >= 40 && data.trees.length <= 120);
  for (const tree of data.trees) {
    assert.equal(tree.position.length, 3);
    assert.ok(tree.position.every(n => Number.isFinite(n) && Math.abs(n) < 300));
    assert.ok(Number.isFinite(tree.scale) && tree.scale > 0 && tree.scale < 3);
    assert.ok(Number.isFinite(tree.rotationY));
  }
});
