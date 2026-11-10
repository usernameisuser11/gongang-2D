/**
 * Gongang: cloud silhouettes painted one time into six unique 2D textures.
 * These are transparent cards in the Three.js sky, not duplicated gray ovals.
 * Different seeds, shapes, layered wisps, and slow uncorrelated movement give
 * the sky natural variation. No shader noise per pixel every animation frame.
 */
const TAU = Math.PI * 2;
function seeded(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function paintCloudTexture(THREE, seed, mobile) {
  const w = mobile ? 384 : 640, h = mobile ? 160 : 224;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: true });
  const random = seeded(seed);
  const axis = .47 + (random() - .5) * .08;
  const masses = mobile ? 43 : 71;

  // Distinct cloud islands with layered detail — avoid stamped identical sprites.
  for (let i = 0; i < masses; i++) {
    const x = w * (.035 + random() * .93);
    const large = Math.sin((x / w) * 3.8 + seed * .31);
    const y = h * (axis + large * .09 + (random() - .5) * .22);
    const rx = w * (.035 + random() * .12), ry = h * (.035 + random() * .17);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((random() - .5) * .19);
    ctx.scale(rx, ry);
    const fill = ctx.createRadialGradient(0, -0.19, .025, 0, 0, 1.0);
    const strength = .18 + random() * .20;
    const cool = 168 + Math.round(random() * 44);
    fill.addColorStop(0, 'rgba(' + (cool + 10) + ',' + (cool + 21) + ',230,' + strength.toFixed(3) + ')');
    fill.addColorStop(.36, 'rgba(' + cool + ',' + (cool + 14) + ',221,' + (strength * .56).toFixed(3) + ')');
    fill.addColorStop(.75, 'rgba(100,138,187,' + (strength * .16).toFixed(3) + ')');
    fill.addColorStop(1, 'rgba(80,111,170,0)');
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // Separate, fibrous silver edges and dissolving horizontal veils.
  ctx.lineCap = 'round';
  const wisps = mobile ? 180 : 300;
  for (let k = 0; k < wisps; k++) {
    const x = random() * w;
    const y = h * (axis + Math.sin(x / w * 3.8 + seed * .31) * .08)
      + (random() - .5) * h * .30;
    const len = 4 + random() * w * .075;
    ctx.strokeStyle = k % 3 === 0
      ? 'rgba(226,233,239,' + (.015 + random() * .057).toFixed(3) + ')'
      : 'rgba(133,171,205,' + (.017 + random() * .065).toFixed(3) + ')';
    ctx.lineWidth = .4 + random() * 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + len * .33, y - random() * 5,
      x + len * .72, y + (random() - .5) * 5,
      x + len, y + (random() - .5) * 4);
    ctx.stroke();
  }

  // Invisible hard boundaries ensure no rectangular cloud artifacts.
  ctx.globalCompositeOperation = 'destination-in';
  const fade = ctx.createLinearGradient(0, 0, w, 0);
  fade.addColorStop(0, 'rgba(255,255,255,0)');
  fade.addColorStop(.08, 'rgba(255,255,255,1)');
  fade.addColorStop(.91, 'rgba(255,255,255,1)');
  fade.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, w, h);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

export function createPainterlyClouds(THREE, scene, options = {}) {
  const mobile = options.mobile === true;
  if (options.enabled === false) return { count: 0, update() {}, dispose() {} };
  const count = mobile ? 4 : 6;
  const group = [];
  const random = seeded(2026111103);

  for (let i = 0; i < count; i++) {
    const tex = paintCloudTexture(THREE, 617 + 113 * i, mobile);
    const geometry = new THREE.PlaneGeometry(27 + random() * 19,
      6.5 + random() * 6.8);
    const material = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: .81 - i * .035,
      fog: false,
      depthWrite: false,
      side: THREE.FrontSide
    });
    const cloud = new THREE.Mesh(geometry, material);
    const spread = (i + .5) / count;
    cloud.position.set(-32 + spread * 66 + (random() - .5) * 13,
      -2.8 + random() * 5.4,
      -121 - random() * 14);
    cloud.rotation.z = (random() - .5) * .11;
    cloud.name = 'Painted cloud bank / ' + (i + 1);
    cloud.userData = {
      baseX: cloud.position.x,
      speed: .10 + random() * .19,
      phase: random() * TAU,
      amp: 1.5 + random() * 3
    };
    scene.add(cloud);
    group.push({ cloud, material, texture: tex, geometry });
  }

  return {
    count,
    update(time) {
      const t = Number.isFinite(time) ? time : 0;
      for (const { cloud } of group) {
        const { baseX, speed, phase, amp } = cloud.userData;
        cloud.position.x = baseX + Math.sin(t * speed * .10 + phase) * amp
          + t * speed * .012;
      }
    },
    dispose() {
      for (const { cloud, material, texture, geometry } of group) {
        scene.remove(cloud);
        geometry.dispose();
        material.dispose();
        texture.dispose();
      }
    }
  };
}
