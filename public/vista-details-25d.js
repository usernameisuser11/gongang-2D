/**
 * Natural overlook details in actual GPU geometry: rocky shoulders,
 * wildflowers, and a narrow glimmering river far down the valley.
 * All scene elements retain live day-night lighting and parallax.
 */
import {overlookGroundHeight} from '/overlook-ground-25d.js';
import {parallaxShift} from '/parallax-25d.js';
function makeRockField(THREE,scene,mobile){
  let seed=4112;
  const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const geo=new THREE.IcosahedronGeometry(1,2),p=geo.getAttribute('position');
  const colors=[];
  const rockTint=new THREE.Color('#697b96');
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    const scale=.88+.083*Math.sin(x*8.7+z*6.3)+.067*Math.sin(y*11.4+x*7.1);
    p.setXYZ(i,x*scale,y*scale,z*scale);
    const c=rockTint.clone().multiplyScalar(.74+y*.11+x*.14);
    colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({
    vertexColors:true,roughness:.98,metalness:0,color:'#99a8bd',
    emissive:'#15223c',emissiveIntensity:.26
  });
  const count=mobile?24:62,mesh=new THREE.InstancedMesh(geo,mat,count);
  mesh.frustumCulled=false;mesh.name='Weather-lit sculpted overlook boulders';
  const positions=[];
  for(let i=0;i<count;i++){
    const x=(i%2?-1:1)*(10.8+Math.pow(rnd(),.8)*19.6);
    const z=16+rnd()*55;
    const size=(.26+rnd()*.68)*(i%9===0?2.0:1);
    positions.push({x,z,size,y:overlookGroundHeight(x,z-77)+size*.21,rot:rnd()*6.28});
  }
  const obj=new THREE.Object3D();
  scene.add(mesh);
  return {
    count,update(env,view){
      for(let i=0;i<count;i++){
        const a=positions[i],p=parallaxShift(view,a.z);
        obj.position.set(a.x+p.x,a.y+p.y,a.z);
        obj.scale.set(a.size*1.7,a.size*.62,a.size*1.2);
        obj.rotation.set(.12,a.rot,.06);
        obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
      mat.emissiveIntensity=.27+env.daylight*.25+env.twilight*.15;
    },
    dispose(){scene.remove(mesh);geo.dispose();mat.dispose();}
  };
}
const FLOWER_VS=`
precision highp float;
attribute vec3 color;
varying vec3 vColor;
uniform float uTime,uWind;
uniform vec2 uParallax;
void main(){
  vec3 p=position;
  float phase=instanceMatrix[3].x*.39+instanceMatrix[3].z*.29;
  p.x+=p.y*p.y*.15*uWind*sin(uTime*.46+phase);
  vec4 w=instanceMatrix*vec4(p,1.);
  float t=clamp((w.z+150.)/185.,0.,1.);
  float f=.026+.96*t*t;
  w.x-=uParallax.x*5.6*f;
  w.y-=uParallax.y*1.75*f;
  vColor=color*instanceColor;
  gl_Position=projectionMatrix*modelViewMatrix*w;
}`;
const FLOWER_FS=`
precision mediump float;
varying vec3 vColor;
uniform float uDay,uTwilight;
void main(){
  vec3 col=mix(vColor*vec3(.43,.49,.78),vColor*vec3(1.11,1.13,1.07),uDay);
  col+=vec3(.14,.03,.11)*uTwilight;
  gl_FragColor=vec4(col,1.);
}`;
function makeFlowers(THREE,scene,mobile){
  const positions=[],cols=[],indices=[];let n=0;
  function tri(a,b,c,color){
    for(const p of [a,b,c]){positions.push(...p);cols.push(...color);}
    indices.push(n,n+1,n+2);n+=3;
  }
  tri([-.012,0,0],[.015,0,0],[0,.77,0],[.22,.42,.40]);
  for(let k=0;k<5;k++){
    const a=k*6.283/5,dx=Math.cos(a),dy=Math.sin(a),y=.78;
    tri([0,y,0],[dx*.16-dy*.07,y+dy*.16+dx*.07,0],
      [dx*.23,y+dy*.23,.02],[.90,.55,.78]);
    tri([0,y,0],[dx*.23,y+dy*.23,.02],
      [dx*.16+dy*.07,y+dy*.16-dx*.07,0],[.73,.40,.75]);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
  geo.setIndex(indices);geo.computeVertexNormals();
  const uniforms={
    uTime:{value:0},uWind:{value:0},uDay:{value:0},
    uTwilight:{value:0},uParallax:{value:new THREE.Vector2()}
  };
  const mat=new THREE.ShaderMaterial({
    uniforms,vertexShader:FLOWER_VS,fragmentShader:FLOWER_FS,
    side:THREE.DoubleSide
  });
  let seed=12961;
  const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const count=mobile?100:235,mesh=new THREE.InstancedMesh(geo,mat,count);
  const obj=new THREE.Object3D(),color=new THREE.Color();
  const shades=['#b86fbb','#d58bc4','#a682ce','#e4a1ca','#8f7abd'];
  for(let i=0;i<count;i++){
    const x=(i%2?-1:1)*(11.5+Math.pow(rnd(),.67)*14.5);
    const z=19+rnd()*50;
    obj.position.set(x,overlookGroundHeight(x,z-77)+.04,z);
    const size=.22+rnd()*.58;
    obj.scale.set(size,size*(.90+rnd()*.22),size);
    obj.rotation.set(0,rnd()*6.283,0);obj.updateMatrix();
    mesh.setMatrixAt(i,obj.matrix);
    color.set(shades[Math.floor(rnd()*shades.length)]);
    mesh.setColorAt(i,color);
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.frustumCulled=false;
  mesh.name='Swaying wildflowers along both overlooking cliffs';
  scene.add(mesh);
  return{
    count,update(seconds,env,view){
      uniforms.uTime.value=seconds;uniforms.uWind.value=env.wind;
      uniforms.uDay.value=env.daylight;uniforms.uTwilight.value=env.twilight;
      uniforms.uParallax.value.set(view.x,view.y);
    },
    dispose(){scene.remove(mesh);geo.dispose();mat.dispose();}
  };
}
const WATER_VS=`
varying vec2 vUv;
uniform float uTime,uWind;
void main(){
  vUv=uv;vec3 p=position;
  p.y+=.02*uWind*sin(p.z*.46+uTime*.6);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const WATER_FS=`
precision mediump float;
varying vec2 vUv;
uniform float uTime,uDay,uTwilight;
void main(){
  float wave=sin(vUv.y*94.-uTime*.30+vUv.x*5.);
  float glint=pow(max(0.,wave),11.)*.34;
  vec3 night=vec3(.05,.14,.26),day=vec3(.26,.49,.53),dusk=vec3(.94,.35,.39);
  vec3 col=mix(night,day,uDay);
  col=mix(col,dusk,uTwilight*.65);
  col+=glint*(.1+uTwilight*.15);
  float edge=1.-smoothstep(.38,.5,abs(vUv.x-.5));
  gl_FragColor=vec4(col,edge*(.14+glint*.6+uTwilight*.12));
}`;
function makeStream(THREE,scene){
 const coord=[],uv=[],index=[],steps=100,across=4;
 for(let j=0;j<=steps;j++){
   const t=j/steps,z=-137+76*t;
   const mid=1.4*Math.sin(z*.105)+1.3*Math.sin(z*.052+1.1);
   const w=.15+t*t*.95;
   const y=-15.6+t*2.5+Math.sin(z*.046)*.17;
   for(let i=0;i<=across;i++){
     const u=i/across;
     coord.push(mid+(u*2-1)*w,y,z);
     uv.push(u,t);
     if(j<steps&&i<across){
       const a=j*(across+1)+i;
       index.push(a,a+1,a+across+1,
         a+1,a+across+2,a+across+1);
     }
   }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(coord,3));
 geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geo.setIndex(index);
 const u={uTime:{value:0},uWind:{value:0},uDay:{value:0},uTwilight:{value:0}};
 const mat=new THREE.ShaderMaterial({
   uniforms:u,vertexShader:WATER_VS,fragmentShader:WATER_FS,
   transparent:true,side:THREE.DoubleSide,depthWrite:false
 });
 const mesh=new THREE.Mesh(geo,mat);
 mesh.name='Narrow winding animated river inside 2.5D valley';
 mesh.frustumCulled=false;
 scene.add(mesh);
 return {
   update(seconds,env){
     u.uTime.value=seconds;u.uWind.value=env.wind;
     u.uDay.value=env.daylight;u.uTwilight.value=env.twilight;
   },
   dispose(){scene.remove(mesh);geo.dispose();mat.dispose();}
 };
}
export function createVistaDetails25D(THREE,scene,{mobile=false}={}){
 const rocks=makeRockField(THREE,scene,mobile);
 const flowers=makeFlowers(THREE,scene,mobile);
 const water=makeStream(THREE,scene);
 return {
   rockCount:rocks.count,flowerCount:flowers.count,
   update(seconds,env,view){
     rocks.update(env,view);flowers.update(seconds,env,view);water.update(seconds,env);
   },
   dispose(){rocks.dispose();flowers.dispose();water.dispose();}
 };
}
