/**
 * Gongang: hand-directed rock-strata and erosion treatment.
 * One soft painted texture is reused across all mountain material groups.
 * World-space UV mapping prevents visible repeating squares per polygon.
 */
function seeded(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function createStrataTexture(THREE) {
  const w = 768, h = 512;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const random = seeded(734215);
  ctx.fillStyle = '#eef0e9';
  ctx.fillRect(0, 0, w, h);

  // broad rock bedding, semi-transparent and irregular (not graphic stripes)
  for (let i = 0; i < 210; i++) {
    const y = random() * h, x = -100 + random() * w;
    const length = 48 + random() * 380;
    const amplitude = 2 + random() * 16;
    ctx.lineWidth = .5 + Math.pow(random(), 2) * 4.2;
    const shade = i % 7 === 0 ? 'rgba(255,250,241,' :
      i % 4 === 0 ? 'rgba(124,148,155,' : 'rgba(71,94,106,';
    ctx.strokeStyle = shade + (.022 + random() * .078).toFixed(4) + ')';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + length * .27, y - amplitude,
      x + length * .72, y + amplitude*.6,
      x + length, y + (random()-.5)*amplitude);
    ctx.stroke();
  }

  // Long erosion fractures interrupt horizontal shelves and add scale.
  for (let i = 0; i < 49; i++) {
    const x = random() * w, y = random() * h;
    const hgt = 25 + random() * 135;
    ctx.strokeStyle = 'rgba(47,65,79,' + (.025 + random() * .075).toFixed(4) + ')';
    ctx.lineWidth = .7 + random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x,y);
    ctx.bezierCurveTo(x+10+(random()-.5)*30,y+hgt*.28,
      x-16+(random()-.5)*28,y+hgt*.75,
      x+(random()-.5)*34,y+hgt);
    ctx.stroke();
  }

  // Fine mineral spots have small value difference, not confetti-sized rocks.
  for(let i=0;i<3600;i++){
    const x=random()*w,y=random()*h,r=.28+random()*1.35;
    ctx.fillStyle=i%3===0
      ? 'rgba(255,253,241,'+(.025+random()*.095).toFixed(4)+')'
      : 'rgba(62,77,93,'+(.012+random()*.067).toFixed(4)+')';
    ctx.fillRect(x,y,r,r*.48);
  }

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 2;
  t.needsUpdate = true;
  return t;
}

/**
 * Tie all OBJ mountain layers to a shared projected texture. UV is based on
 * model positions rather than per-part UVs, so adjoining material groups agree.
 */
export function applyRockStrata(THREE, mountainGroup) {
  const texture = createStrataTexture(THREE);
  const mountainMaterials = [];
  for (const part of mountainGroup.children) {
    if (!part.isMesh) continue;
    const geom = part.geometry;
    const pos = geom.getAttribute('position');
    const uv = new Float32Array(pos.count * 2);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      uv[2*i] = x * .033 + z * .007;
      uv[2*i+1] = y * .057 + x * .004;
    }
    geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    part.material.map = texture;
    part.material.roughness = .98;
    part.material.metalness = 0;
    part.material.flatShading = false;
    part.material.needsUpdate = true;
    mountainMaterials.push(part.material);
  }
  mountainGroup.userData.disposeTexture = () => {
    texture.dispose();
    for (const material of mountainMaterials) material.map = null;
  };
  return mountainGroup;
}
