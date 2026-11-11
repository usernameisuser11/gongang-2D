/* Painted conifer needle volumes, layered over the editable OBJ branches.
 * One atlas, two crossed planes per pine; uses GPU instancing for mobile.
 * Purely authored graphics; no remote textures or runtime image services.
 */
function rng(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function paintNeedles(THREE) {
  const w=288,h=576;
  const c=document.createElement('canvas');
  c.width=w;c.height=h;
  const p=c.getContext('2d');
  const random=rng(938211);
  p.lineCap='round';
  for(let tier=0;tier<15;tier++){
    const t=tier/15;
    const y=h*(.92-t*.79);
    const spread=w*(.40*(1-t)*(.91+random()*.18));
    if(spread<3)continue;
    const curve=(random()-.5)*.09*w;
    const x0=w*.5+curve;
    for(const dir of [-1,1]){
      const ex=x0+dir*spread*(.76+random()*.26);
      const ey=y+6+random()*20;
      p.beginPath();p.moveTo(x0,y+3);p.quadraticCurveTo((x0+ex)*.50,y+11,ex,ey);
      p.strokeStyle='rgba(19,47,52,.60)';
      p.lineWidth=2.8-t*1.3;p.stroke();
      const n=82+Math.round((1-t)*72);
      for(let k=0;k<n;k++){
        const f=random(),x=x0+(ex-x0)*f;
        const yy=y+(ey-y)*f+(random()-.5)*24*(1-t*.5);
        const reach=(2.8+random()*8.8)*(1-t*.47);
        const tint=random();
        const alpha=.20+random()*.39;
        p.strokeStyle=tint<.18
          ? 'rgba(132,169,146,'+(alpha*.56).toFixed(3)+')'
          : tint<.50
          ? 'rgba(62,109,100,'+(alpha*.73).toFixed(3)+')'
          : 'rgba(20,63,70,'+alpha.toFixed(3)+')';
        p.lineWidth=.5+random()*1.2;
        p.beginPath();p.moveTo(x,yy);
        p.quadraticCurveTo(x+dir*reach*.5,yy-reach*.5,
          x+dir*reach,yy-reach*(.75+random()*.3));
        p.stroke();
      }
    }
  }

  // Thin, subtly lighter needle tips catch the moon, mostly on one side.
  for(let i=0;i<420;i++){
    const t=.11+random()*.76,y=h*(.92-t*.79);
    const spread=w*.40*(1-t),x=w*.5+(random()*2-1)*spread;
    const len=1+random()*5;
    p.strokeStyle='rgba(169,205,178,'+(.045+random()*.20).toFixed(3)+')';
    p.lineWidth=.3+random()*.9;
    p.beginPath();p.moveTo(x,y);p.lineTo(x+len*.76,y-len);p.stroke();
  }
  const texture=new THREE.CanvasTexture(c);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.generateMipmaps=true;
  return texture;
}

/** Decorate the underlying mesh with translucent, non-rectangular needles. */
export function addPainterlyPineCrowns(THREE,root,trees){
  const texture=paintNeedles(THREE);
  const geo=new THREE.PlaneGeometry(3.5,5.65);
  geo.translate(0,2.82,0);
  const mat=new THREE.MeshBasicMaterial({
    map:texture,transparent:true,alphaTest:.075,depthWrite:false,
    side:THREE.DoubleSide, fog:true, color:'#9bc4bb',opacity:.88
  });
  const obj=new THREE.Object3D();
  for(let card=0;card<2;card++){
    const mesh=new THREE.InstancedMesh(geo,mat,trees.length);
    mesh.name='Painted conifer needle volume '+(card+1);
    mesh.frustumCulled=false;
    for(let i=0;i<trees.length;i++){
      const tree=trees[i];
      obj.position.fromArray(tree.position);
      obj.rotation.set(0,tree.rotationY+card*Math.PI/2,0);
      obj.scale.setScalar(tree.scale);
      obj.updateMatrix();
      mesh.setMatrixAt(i,obj.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;
    root.add(mesh);
  }
  root.userData.foliageTexture=texture;
  return root;
}
