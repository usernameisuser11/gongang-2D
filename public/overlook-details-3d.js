/**
 * Original 3D micro-geology for the resting meadow.
 * The seatable center is free of clutter; rock groups follow the two
 * outer banks, with varied silhouettes, subtle moss tint and real lighting.
 * Geometry and per-instance transforms are generated once on startup.
 */
export function buildOverlookDetails(THREE,scene,{mobile=false}={}){
  let seed=202611111;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const source=new THREE.IcosahedronGeometry(1,2);
  const pos=source.getAttribute('position');
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
    const rough=Math.sin(x*17.3+z*4.2)*Math.cos(y*13.1-x*6.9)
      +Math.sin(z*29.2-y*8.4)*.41;
    const scale=1+rough*.087;
    pos.setXYZ(i,x*scale,y*scale,z*scale);
  }
  pos.needsUpdate=true;
  source.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({
    color:'#a1aabb',roughness:.98,metalness:0,
    flatShading:false
  });
  const count=mobile?36:75;
  const mesh=new THREE.InstancedMesh(source,mat,count);
  mesh.name='Living geology / mossy riverbank stones';
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  mesh.frustumCulled=false;
  const obj=new THREE.Object3D(),color=new THREE.Color();
  for(let i=0;i<count;i++){
    const side=i%2?1:-1;
    const z=10+random()*66;
    const edge=11.4+2.8*Math.sin(z*.16);
    const x=side*(edge+random()*12);
    const size=.11+Math.pow(random(),2)*.51;
    // Freshly exposed stone slabs on the grassy overlooking slopes.
    obj.position.set(x,-3.21+size*.31,z);
    obj.rotation.set(random()*.23,random()*6.28318,(random()-.5)*.20);
    obj.scale.set(size*(1.35+random()*.7),size*(.37+random()*.23),
      size*(.85+random()*.75));
    obj.updateMatrix();
    mesh.setMatrixAt(i,obj.matrix);
    color.set(i%6===0?'#536f69':i%5===0?'#7b8296':'#627b84');
    color.multiplyScalar(.76+random()*.27);
    mesh.setColorAt(i,color);
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  scene.add(mesh);

  // Sparse natural stones only — no stick-like or rounded filler objects.
  return {count,
    dispose(){
      scene.remove(mesh);
      mesh.dispose();
      source.dispose();mat.dispose();
    }
  };
}
