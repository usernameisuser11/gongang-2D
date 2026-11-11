/**
 * GONGANG / living 2.5D lookout
 * Game-rendered scenic depth planes, not a fixed panorama or Canvas2D artwork.
 * Animated 3D trees and real-time Seoul sky/weather share one WebGL renderer.
 * Existing WebSocket visitors/poses/photos remain a separate 2D overlay layer.
 */
import * as THREE from '/vendor/three.module.js';
import { createLivingEnvironment } from '/living-environment-3d.js';
import { createAtmosphericDepth25D } from '/atmospheric-depth-25d.js';
import { parallaxInput, parallaxShift } from '/parallax-25d.js';

const HALF_HEIGHT=14.5;
const state={
  ready:false,failed:false,error:null,mode:'living-2.5d',
  frameCount:0, ridgeCount:0, treeCount:0, weather:null,
  retainsVisitors:true,screen:{width:0,height:0},
  timeMode:'Asia/Seoul',movingNature:true,
  sceneType:'layered-3d-geometry-no-background-photo',
  parallax:{x:0,y:0},nearShift:0,farShift:0,
  lighting:{daylight:0,shadowStrength:0,azimuth:0},shadowCasters:0
};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{let t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
const hash=(x,n)=>fract(Math.sin(x*127.1+n*311.7)*43758.5453123);
const noise=(x,n)=>{let i=Math.floor(x),f=fract(x);f=f*f*(3-2*f);return (hash(i,n)*(1-f)+hash(i+1,n)*f)*2-1;};
function crest(x,l){
 const axis=x-l.turn;
 const shoulder=l.rise*Math.pow(Math.abs(axis)/25,1.42);
 const hill=(cx,w,h)=>h*Math.exp(-Math.pow((x-cx)/w,2)*1.7);
 const rock=noise(x*.19,l.seed)*1.05+noise(x*.49,l.seed+11)*.41+
   noise(x*1.15,l.seed+29)*.18;
 return l.center+shoulder+rock+hill(-23-l.turn,12,2.8)+
    hill(18+l.turn,12,3.1)+hill(6+l.turn,6,l.peak);
}
const LAYERS=[
 {name:'horizon',z:-143,center:-12.0,rise:4.6,turn:0,peak:3.0,seed:19,base:'#6274a5',day:'#799c9b'},
 {name:'lavender peaks',z:-126,center:-14.2,rise:6.2,turn:-4,peak:3.3,seed:27,base:'#677da8',day:'#647f94'},
 {name:'distant cobalt',z:-110,center:-12.5,rise:7.9,turn:3,peak:2.6,seed:33,base:'#3a6992',day:'#467c81'},
 {name:'teal valleys',z:-94,center:-12.6,rise:9.7,turn:-2,peak:2.4,seed:41,base:'#21567b',day:'#427d78'},
 {name:'deep fir hills',z:-78,center:-11.5,rise:11.8,turn:2,peak:2.0,seed:55,base:'#143d63',day:'#395d5a'},
 {name:'near forest slopes',z:-62,center:-11.0,rise:13.7,turn:-1,peak:1.8,seed:67,base:'#0b294b',day:'#2a4e47'}
];
const MOUNTAIN_VS=`
varying vec3 vPigment,vFaceNormal;
varying float vDepth;varying vec2 vUV;
void main(){
 vPigment=color;vDepth=position.y;vUV=uv;
 vFaceNormal=normalize(normalMatrix*normal);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const MOUNTAIN_FS=`
precision highp float;
varying vec3 vPigment,vFaceNormal;
varying float vDepth;varying vec2 vUV;
uniform float uDay,uTwilight,uStorm,uWind,uTime,uShadow,uSunAzimuth,uSunElevation;
uniform vec3 uLightDir;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  float folded=sin(vUV.x*24.7+sin(vUV.y*6.9)*3.8);
  float strata=sin(vUV.x*36.0+vUV.y*9.0+sin(vUV.x*13.)*1.9);
  float mineral=hash(floor(vUV*vec2(244.,37.)));
  float texture=.87+.051*folded+.042*(mineral-.5)+.029*strata;
  // Ridgeline facets and fine gullies act like sculpted normal-map detail.
  // They catch the sunrise/sunset direction differently at each hour.
  vec3 relief=normalize(vFaceNormal+vec3(
    .23*folded+.14*strata,
    .07*folded,
    .15*strata));
  vec3 lightVector=normalize(uLightDir);
  float incidence=max(0.,dot(relief,lightVector));
  float diffuse=.58+.42*incidence;
  float selfOcclusion=smoothstep(-.20,.54,
    sin(vUV.x*19.4+strata*1.6+uSunAzimuth*1.8));
  float ridgeShade=1.-uShadow*(1.-incidence)*(.20+.30*selfOcclusion);
  float terrainShadow=1.-uShadow*(1.-selfOcclusion)*.14;
  vec3 night=vPigment*vec3(.84,.91,1.15);
  vec3 day=vPigment*vec3(1.12,1.25,1.00);
  vec3 col=mix(night,day,clamp(uDay,0.,1.));
  col*=mix(.72,1.,uDay*.78)*diffuse*ridgeShade*terrainShadow;
  // Warm sun rim only when light comes from a low angle; night remains blue.
  float horizon=clamp((vUV.y-.30)*1.45,0.,1.);
  col+=vec3(.19,.069,.075)*uTwilight*horizon*(.4+.6*incidence);
  col*=texture*(1.-uStorm*.13);
  gl_FragColor=vec4(max(col,0.),1.);
}`;
const FIR_VS=`
varying vec3 vTreeColor;
varying float vTreeLight;
uniform float uTime,uWind;
uniform vec2 uParallax;
uniform vec3 uLightDir;
void main(){
  vec3 p=position;
  float phase=instanceMatrix[3].x*.43+instanceMatrix[3].z*.25;
  p.x+=pow(max(p.y,0.),1.7)*.018*uWind*sin(uTime*.45+phase+p.y*.38);
  p.z+=pow(max(p.y,0.),1.6)*.009*uWind*cos(uTime*.31+phase);
  vec4 world=instanceMatrix*vec4(p,1.0);
  float nearFactor=clamp((world.z+150.)/185.,0.,1.);
  nearFactor=.026+.96*nearFactor*nearFactor;
  world.x-=uParallax.x*5.6*nearFactor;
  world.y-=uParallax.y*1.75*nearFactor;
  vTreeColor=instanceColor;
  vTreeLight=clamp(.48+.30*uLightDir.x*(.5+.5*normal.x)+
    .24*max(0.,dot(normalize(normal),uLightDir)),.23,1.);
  gl_Position=projectionMatrix*modelViewMatrix*world;
}`;
const FIR_FS=`
precision mediump float;
varying vec3 vTreeColor;
varying float vTreeLight;
uniform float uDay,uTwilight,uStorm,uShadow;
void main(){
 vec3 day=vTreeColor*vec3(1.25,1.39,1.14);
 vec3 col=mix(vTreeColor*.81,day,uDay);
 col*=mix(1.,vTreeLight,.64*uShadow);
 col+=vec3(.11,.042,.052)*uTwilight*.24;
 gl_FragColor=vec4(col*(1.-uStorm*.10),1.);
}`;
function makeMountain(THREE,scene,layer,mobile){
 const across=mobile?140:270,rows=14;
 const pos=new Float32Array((across+1)*(rows+1)*3);
 const rgb=new Float32Array(pos.length),uv=new Float32Array((across+1)*(rows+1)*2);
 const index=new Uint32Array(across*rows*6);
 const near=new THREE.Color(layer.base),low=near.clone().multiplyScalar(.47);
 for(let j=0;j<=rows;j++){
  const t=j/rows;
  for(let i=0;i<=across;i++){
   const x=-80+i/across*160;
   const ridgeline=crest(x,layer);
   const k=(j*(across+1)+i)*3,q=(j*(across+1)+i)*2;
   pos[k]=x;
   pos[k+1]=ridgeline-t*47+noise(x*.36+t*7.1,layer.seed+19)*Math.sin(Math.PI*t)*.38;
   pos[k+2]=layer.z+noise(x*.13+t*8.5,layer.seed+33)*1.05;
   const shade=.81+.14*noise(x*.20+t*5,layer.seed+2);
   const c=near.clone().lerp(low,t*.85).multiplyScalar(shade);
   rgb[k]=c.r;rgb[k+1]=c.g;rgb[k+2]=c.b;
   uv[q]=i/across;uv[q+1]=1-t;
  }
 }
 let p=0;
 for(let j=0;j<rows;j++)for(let i=0;i<across;i++){
   const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;
   index[p++]=a;index[p++]=c;index[p++]=d;
   index[p++]=a;index[p++]=d;index[p++]=b;
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.BufferAttribute(pos,3));
 g.setAttribute('color',new THREE.BufferAttribute(rgb,3));
 g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
 g.setIndex(new THREE.BufferAttribute(index,1));
 g.computeVertexNormals();
 const u={
   uDay:{value:0},uTwilight:{value:0},uStorm:{value:0},
   uWind:{value:0},uTime:{value:0},uLightDir:{value:new THREE.Vector3(.1,.7,1).normalize()},
   uSunAzimuth:{value:0},uSunElevation:{value:.5},uShadow:{value:0}
 };
 const mat=new THREE.ShaderMaterial({
   uniforms:u,vertexShader:MOUNTAIN_VS,fragmentShader:MOUNTAIN_FS,
   vertexColors:true,side:THREE.DoubleSide,depthWrite:true,fog:false
 });
 const mesh=new THREE.Mesh(g,mat);
 mesh.name='Real parallax mountain / '+layer.name;
 mesh.frustumCulled=false;
 scene.add(mesh);
 return {mesh,u,layer,basePosition:mesh.position.clone()};
}
// Original triangulated organic branch silhouette (geometry, not billboard photo).
function firGeometry(THREE){
 const vert=[],idx=[];let k=0;
 const triangle=(a,b,c)=>{vert.push(...a,...b,...c);idx.push(k,k+1,k+2);k+=3;};
 triangle([-.035,0,0],[.035,0,0],[.017,1.06,0]);
 for(let j=0;j<23;j++){
  const t=j/23,y=.07+t*.88,spread=Math.pow(1-t,.78)*.36;
  for(const side of [-1,1]){
    const offset=(.83+.16*Math.sin(j*2.45+side*.71));
    const x=side*spread*offset;
    triangle([0,y+.08,0],[x*.91,y+.012,.012],[x,y-.026,.001]);
    triangle([0,y-.035,0],[x,y-.026,-.01],[side*spread*.53,y+.045,.015]);
    // Short needle sprays soften straight triangular branches.
    for(let l=0;l<2;l++){
     const b=.42+l*.24;
     triangle([x*b,y,.01],[x*b+side*.038*(1-t),y+.05*(1-t),.014],
       [x*b+side*.025*(1-t),y-.025*(1-t),-.012]);
    }
  }
 }
 const g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(vert,3));
 g.setIndex(idx);g.computeVertexNormals();
 return g;
}
function makeForest(THREE,scene,mobile){
 const random=(()=>{
   let s=202611111;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);
 })();
 const trees=[],colors=[];
 const push=(x,y,z,size,c)=>{
   trees.push([x,y,z,size,.78+random()*.51,.70+random()*.43,random()*6.283]);
   colors.push(c);
 };
 const pal=['#3c5e78','#294d69','#1e3b5c','#142f50','#0b223f','#081a36'];
 for(let i=0;i<LAYERS.length;i++){
  const l=LAYERS[i];
  const count=mobile?45+i*4:95+i*19;
  for(let k=0;k<count;k++){
    const side=k%2===0?-1:1;
    const gap=i<2?8: i<4?11:15;
    const x=side*(gap+Math.pow(random(),.83)*35);
    const height=crest(x,l);
    push(x,height-.2,l.z+1.45,1.4+i*.48+random()*(.9+i*.37),pal[i]);
  }
 }
 // Foreground trees frame the valley, leaving the middle clear for visitors.
 const front=mobile?
  [[-9.0,15,8.7],[-7.4,27,6.2],[9,16,8.3],[7.2,28,6.1]]:
  [[-24,14,12.4],[-21,23,9.1],[-17.5,36,6.7],
   [24,15,12.8],[21,24,9.2],[17.7,37,6.6]];
 for(const [x,z,scale] of front)push(x,-6.6,z,scale,'#071327');
 const geo=firGeometry(THREE);
 const u={uTime:{value:0},uWind:{value:0},uDay:{value:0},
    uTwilight:{value:0},uStorm:{value:0},uShadow:{value:0},
    uLightDir:{value:new THREE.Vector3(.1,.7,1).normalize()},
    uParallax:{value:new THREE.Vector2()}};
 const mat=new THREE.ShaderMaterial({
  uniforms:u,vertexShader:FIR_VS,fragmentShader:FIR_FS,
  side:THREE.DoubleSide,depthWrite:true
 });
 const mesh=new THREE.InstancedMesh(geo,mat,trees.length);
 const t=new THREE.Object3D(),clr=new THREE.Color();
 trees.forEach((item,i)=>{
  const [x,y,z,h,w,d,angle]=item;
  t.position.set(x,y,z);t.scale.set(h*w,h,h*d);
  t.rotation.set(0,angle,0);t.updateMatrix();mesh.setMatrixAt(i,t.matrix);
  clr.set(colors[i]).multiplyScalar(.75+random()*.32);
  mesh.setColorAt(i,clr);
 });
 mesh.name='Wind-animated forest, depth-instanced 2.5D';
 mesh.frustumCulled=false;mesh.instanceMatrix.needsUpdate=true;
 if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
 scene.add(mesh);
 return {mesh,u,count:trees.length};
}
function addOverlook(THREE,scene){
 // Layered foreground in actual 3D, no fixed base image. Keep the center
 // low so friends can occupy the sitting/photo area.
 const layers=[];
 for(const [z,y,depth,tint] of [
  [12,-7.2,10,'#0c1e39'],[23,-8.0,12,'#081831'],[33,-10.8,17,'#071126']
 ]){
  const l={z,center:y,rise:depth,turn:0,peak:0,seed:33,base:tint};
  const item=makeMountain(THREE,scene,l,innerWidth<700);
  item.mesh.name='Overlook lower bank';
  layers.push(item);
 }
 return layers;
}
let scene,camera,renderer,environment,ridges=[],forest,atmosphere;
const requestedRenderer=new URLSearchParams(location.search).get('renderer');
const enabled=!['2d','painterly','3d','live3d'].includes(requestedRenderer);
const portrait=innerWidth<700&&innerHeight>innerWidth*1.2;
if(enabled)try{
 const canvas=document.createElement('canvas');
 const gl=canvas.getContext('webgl2',{alpha:false});
 if(!gl)throw Error('WebGL2 unavailable');
 gl.getExtension('WEBGL_lose_context')?.loseContext();
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power',
   preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
 scene=new THREE.Scene();
 scene.background=new THREE.Color('#020712');
 camera=new THREE.OrthographicCamera(-21,21,HALF_HEIGHT,-HALF_HEIGHT,.1,390);
 camera.position.set(0,7,39);camera.lookAt(0,1,-23);
 environment=createLivingEnvironment(THREE,scene,{camera,
   reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
 ridges=LAYERS.map(l=>makeMountain(THREE,scene,l,portrait));
 ridges.push(...addOverlook(THREE,scene));
 atmosphere=createAtmosphericDepth25D(THREE,scene);
 forest=makeForest(THREE,scene,portrait);
 state.ridgeCount=ridges.length;state.treeCount=forest.count;
 state.atmosphereLayers=atmosphere.count;
 state.weather=environment.state;
 state.ready=true;
}catch(error){
 state.failed=true;state.error=String(error?.stack||error);
 console.error('Living overlook initialization failed; retaining legacy view',error);
}
function draw(ctx,t,now,{personal=false}={}){
 if(!state.ready)return false;
 try{
  const w=Math.max(280,Math.min(1280,Math.round(t.width*.88))),
    h=Math.max(260,Math.min(900,Math.round(t.height*.88)));
  if(state.screen.width!==w||state.screen.height!==h){
    renderer.setSize(w,h,false);state.screen={width:w,height:h};
  }
  const aspect=w/h;
  camera.left=-HALF_HEIGHT*aspect;camera.right=HALF_HEIGHT*aspect;
  camera.top=HALF_HEIGHT;camera.bottom=-HALF_HEIGHT;
  camera.position.set(0,personal?9:7,39);
  camera.lookAt(0,personal?5:1,-23);
  camera.updateProjectionMatrix();
  // Wall-clock motion: visitors who arrive later observe the same sky/wind.
  const seconds=(Date.now()/1000)%86400;
  const env=environment.update(seconds);
  for(const ridge of ridges){
    ridge.u.uDay.value=env.daylight;
    ridge.u.uTwilight.value=env.twilight;
    ridge.u.uStorm.value=Math.max(env.rain,env.snow);
    ridge.u.uTime.value=seconds;
    ridge.u.uWind.value=env.wind;
  }
  atmosphere.update(seconds,env);
  forest.u.uTime.value=seconds;
  forest.u.uWind.value=env.wind;
  forest.u.uDay.value=env.daylight;
  forest.u.uTwilight.value=env.twilight;
  forest.u.uStorm.value=Math.max(env.rain,env.snow);
  renderer.render(scene,camera);
  ctx.drawImage(renderer.domElement,t.x,t.y,t.width,t.height);
  state.frameCount++;state.hour=environment.state.hour;
  return true;
 }catch(error){
  state.failed=true;state.ready=false;state.error=String(error?.stack||error);
  console.warn('2.5D WebGL failed; switching to painterly fallback',error);
  return false;
 }
}
window.GongangOverlook25D={draw,state,get ready(){return state.ready;}};
export {draw,state};
