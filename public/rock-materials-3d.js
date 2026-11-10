/**
 * Gongang / softly weathered rock pigment.
 *
 * A single reusable, seamless mineral map. No painted squiggle lines:
 * low-frequency color variation, subtle strata and fine stone grain are all
 * derived from continuous 2D noise. Canvas work is done only once.
 */
function hash2(x, y, seed=0) {
  let z = Math.imul(x ^ 374761393, 668265263);
  z ^= Math.imul(y ^ seed, 2246822519);
  z ^= z >>> 13;
  z = Math.imul(z, 1274126177);
  return ((z ^ (z >>> 16)) >>> 0) / 4294967295;
}
function noise2(x, y, seed=0) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x-ix, fy=y-iy;
  fx = fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy);
  const v0=hash2(ix,iy,seed)*(1-fx)+hash2(ix+1,iy,seed)*fx;
  const v1=hash2(ix,iy+1,seed)*(1-fx)+hash2(ix+1,iy+1,seed)*fx;
  return v0*(1-fy)+v1*fy;
}
function fbm(x,y,seed=0) {
  return .53*noise2(x,y,seed)
    + .28*noise2(x*2.17+1.6,y*2.11+.7,seed+101)
    + .13*noise2(x*4.63+3.1,y*4.41+2.4,seed+209)
    + .06*noise2(x*9.21+6.3,y*9.43+5.1,seed+311);
}
const clamp=(x,min,max)=>Math.max(min,Math.min(max,x));

export function createStrataTexture(THREE) {
  const w=512, h=384;
  const canvas=document.createElement('canvas');
  canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d', { willReadFrequently:true });
  const img=ctx.createImageData(w,h);
  const d=img.data;
  for(let y=0;y<h;y++) {
    for(let x=0;x<w;x++) {
      const u=x/w,v=y/h;
      const broad=fbm(u*5.5,v*6.3,427);
      const micro=fbm(u*27.2,v*24.6,839);
      const flow=fbm(u*2.2,v*2.7,91);
      const bedding=Math.sin(v*57+flow*17+u*4.1);
      const strata=(1-Math.abs(bedding))*.035;
      const mineral=clamp(214+(broad-.5)*49+(micro-.5)*31-strata*80,177,242);
      const i=(y*w+x)*4;
      // Gentle cool stone tint, avoids chalk-white wash on mountain color.
      d[i]=mineral;
      d[i+1]=clamp(mineral+5,0,255);
      d[i+2]=clamp(mineral+7,0,255);
      d[i+3]=255;
    }
  }
  ctx.putImageData(img,0,0);
  const t=new THREE.CanvasTexture(canvas);
  t.colorSpace=THREE.SRGBColorSpace;
  t.wrapS=THREE.RepeatWrapping;
  t.wrapT=THREE.RepeatWrapping;
  t.minFilter=THREE.LinearMipmapLinearFilter;
  t.magFilter=THREE.LinearFilter;
  t.anisotropy=2;
  t.needsUpdate=true;
  return t;
}

/** Shared projected UVs prevent discontinuities between mountain strata. */
export function applyRockStrata(THREE, mountainGroup) {
  const texture=createStrataTexture(THREE);
  const materials=[];
  for(const part of mountainGroup.children){
    if(!part.isMesh)continue;
    const geometry=part.geometry;
    const pos=geometry.getAttribute('position');
    const uv=new Float32Array(pos.count*2);
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      uv[i*2]=x*.024+z*.006;
      uv[i*2+1]=y*.075+x*.003;
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    part.material.map=texture;
    part.material.needsUpdate=true;
    materials.push(part.material);
  }
  mountainGroup.userData.disposeTexture=()=>{
    texture.dispose();
    for(const material of materials)material.map=null;
  };
  return mountainGroup;
}
