/**
 * Scenic understory — leaf blades and wild grasses built from curved strips.
 * GPU-instanced 3D vegetation, not a flat grass bitmap or repeated cone.
 * Kept away from shared visitor seating and photography center.
 */
import { overlookGroundHeight } from '/overlook-ground-25d.js';

const VS=`
precision highp float;
varying vec3 vFoliageColor;
varying float vBladeHeight;
uniform float uTime,uWind;
uniform vec2 uParallax;
void main(){
 vec3 p=position;
 float phase=instanceMatrix[3].x*.61+instanceMatrix[3].z*.34;
 float sway=sin(uTime*.56+phase+p.y*2.6)*uWind*.043;
 p.x+=p.y*p.y*sway;
 p.z+=p.y*p.y*cos(uTime*.43+phase)*uWind*.012;
 vec4 world=instanceMatrix*vec4(p,1.);
 float u=clamp((world.z+150.)/185.,0.,1.);
 float factor=.026+.96*u*u;
 world.x-=uParallax.x*5.6*factor;
 world.y-=uParallax.y*1.75*factor;
 vFoliageColor=instanceColor;
 vBladeHeight=position.y;
 gl_Position=projectionMatrix*modelViewMatrix*world;
}`;
const FS=`
precision mediump float;
varying vec3 vFoliageColor;
varying float vBladeHeight;
uniform float uDay,uTwilight,uShadow;
void main(){
 vec3 night=vFoliageColor*vec3(.44,.64,.92);
 vec3 daylight=vFoliageColor*vec3(1.0,1.18,.91);
 vec3 color=mix(night,daylight,uDay);
 color+=vec3(.14,.04,.10)*uTwilight*.55;
 color*=.76+.26*clamp(vBladeHeight,0.,1.);
 color*=1.-uShadow*.12;
 gl_FragColor=vec4(color,1.);
}`;
function grassTuftGeometry(THREE){
 const coords=[],indices=[];let n=0;
 const blades=9,segments=5;
 for(let b=0;b<blades;b++){
   const angle=b*(Math.PI*2/blades)+Math.sin(b*5.19)*.29;
   const tilt=(b%3===0?.29:.14)+.06*Math.sin(b*7.3);
   const height=.65+.32*Math.sin(b*1.83+2.0);
   const wide=.032+.014*(1+Math.sin(b*3.1))*.5;
   for(let j=0;j<=segments;j++){
     const t=j/segments;
     const f=.25+.75*Math.sin(Math.PI*(t*.87+.06));
     const w=wide*(1-t)*f;
     const drift=tilt*t*t;
     const baseX=Math.cos(angle)*(b%2?.06:.13)+Math.cos(angle)*drift;
     const baseZ=Math.sin(angle)*(b%2?.06:.13)+Math.sin(angle)*drift;
     const y=t*height;
     coords.push(baseX-Math.sin(angle)*w,y,baseZ+Math.cos(angle)*w);
     coords.push(baseX+Math.sin(angle)*w,y,baseZ-Math.cos(angle)*w);
     if(j<segments){
       const i=n+j*2;
       indices.push(i,i+1,i+2,i+1,i+3,i+2);
     }
   }
   n+=(segments+1)*2;
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}
export function createMeadowEdge25D(THREE,scene,{mobile=false}={}){
 let seed=20261113;
 const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 const count=mobile?110:250;
 const geo=grassTuftGeometry(THREE);
 const uniforms={uTime:{value:0},uWind:{value:0},uDay:{value:0},
   uTwilight:{value:0},uShadow:{value:0},uParallax:{value:new THREE.Vector2()}};
 const material=new THREE.ShaderMaterial({
   uniforms,vertexShader:VS,fragmentShader:FS,side:THREE.DoubleSide,
   depthWrite:true,transparent:false
 });
 const mesh=new THREE.InstancedMesh(geo,material,count);
 mesh.name='Organic wind-driven undergrowth along seated overlook edges';
 mesh.frustumCulled=false;
 const actor=new THREE.Object3D(),color=new THREE.Color();
 const palette=['#435b58','#5f7772','#40536e','#65705a','#6d5b73'];
 for(let i=0;i<count;i++){
   const side=i%2===0?-1:1;
   const x=side*(9.4+Math.pow(random(),.79)*20.2);
   const z=-8+random()*63;
   const localZ=z-77;
   const y=overlookGroundHeight(x,localZ)+.035;
   actor.position.set(x,y,z);
   const scale=.42+Math.pow(random(),.72)*1.25;
   actor.scale.set(scale*(.8+.4*random()),scale,scale*(.8+.4*random()));
   actor.rotation.set(0,random()*6.283,0);
   actor.updateMatrix();
   mesh.setMatrixAt(i,actor.matrix);
   color.set(palette[Math.floor(random()*palette.length)])
     .multiplyScalar(.7+.33*random());
   mesh.setColorAt(i,color);
 }
 mesh.instanceMatrix.needsUpdate=true;
 if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 scene.add(mesh);
 return{
   count,mesh,
   update(seconds,env,view,light){
     uniforms.uTime.value=seconds;
     uniforms.uWind.value=env.wind;
     uniforms.uDay.value=env.daylight;
     uniforms.uTwilight.value=env.twilight;
     uniforms.uShadow.value=light.shadowStrength;
     uniforms.uParallax.value.set(view.x,view.y);
   },
   dispose(){scene.remove(mesh);mesh.dispose();geo.dispose();material.dispose();}
 };
}
