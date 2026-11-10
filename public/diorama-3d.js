/* Gongang: fixed-camera living 3D diorama. Fallback: existing painterly Canvas2D. */
import * as THREE from '/vendor/three.module.js';
const TAU=Math.PI*2,worldH=24;
const state={ready:false,failed:false,error:null,mode:'fixed-camera-3d',renderCount:0,plants:0,clouds:0,width:0,height:0,personal:false};
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,waterClock,windClock,stars,clouds=[],debugTimeMs=null;
const rng=(()=>{let s=20261110;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)})();
const lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
const hash=n=>{n=Math.imul(n^(n>>>15),2246822519);n=Math.imul(n^(n>>>13),3266489917);return ((n^(n>>>16))>>>0)/4294967295};
const noise=(x,seed=0)=>{const i=Math.floor(x),t=smooth(x-i);return lerp(hash(i+seed*997),hash(i+seed*997+1),t)*2-1};
const ridge=(x,s)=>noise(x*.06,s)*3+noise(x*.17,s+9)*1.1+noise(x*.48,s+21)*.35+Math.exp(-Math.pow((x-(s%2?8:-12))/13,2))*3.2;
function texture(draw,w=512,h=256){
 const cvs=document.createElement('canvas');cvs.width=w;cvs.height=h;
 draw(cvs.getContext('2d'),w,h);
 const t=new THREE.CanvasTexture(cvs);t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;return t;
}
function sky(){
 const t=texture((c,w,h)=>{
   const g=c.createLinearGradient(0,0,0,h);
   [[0,'#030a1b'],[.22,'#08172f'],[.46,'#132749'],
     [.68,'#3c4168'],[.85,'#775875'],[1,'#9e6f79']].forEach(([p,v])=>g.addColorStop(p,v));
   c.fillStyle=g;c.fillRect(0,0,w,h);
   // One-time painted stardust and diffuse galactic clouds: the sky is not a flat color.
   const rand=(()=>{let seed=92483;return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)})();
   c.save();c.globalCompositeOperation='screen';
   for(let i=0;i<115;i++){
     const y=rand()*h*.87,bandX=w*(.61-.40*y/h)+Math.sin(y*.016)*29;
     const x=bandX+(rand()+rand()+rand()-1.5)*w*.15;
     const r=15+rand()*92;
     const nebula=c.createRadialGradient(x,y,0,x,y,r);
     const tint=i%3===0?'187,152,218':i%3===1?'87,156,226':'185,135,193';
     nebula.addColorStop(0,'rgba('+tint+',.038)');
     nebula.addColorStop(1,'rgba('+tint+',0)');
     c.fillStyle=nebula;c.fillRect(x-r,y-r,r*2,r*2);
   }
   for(let i=0;i<12000;i++){
     const y=rand()*h,mid=w*(.61-.40*y/h)+Math.sin(y*.016)*29;
     const x=mid+(rand()+rand()+rand()-1.5)*w*.27;
     if(x<0||x>=w)continue;
     const strength=.08+.53*Math.pow(rand(),2.6),size=.25+rand()**3*1.3;
     c.fillStyle=i%7===0?'rgba(255,220,211,'+strength+')':
       'rgba(206,229,255,'+strength+')';
     c.fillRect(x,y,size,size);
   }
   c.restore();
   // A soft veil near the distant ridges leaves the center of the sky dark.
   const horizon=c.createLinearGradient(0,h*.60,0,h);
   horizon.addColorStop(0,'rgba(167,125,174,0)');
   horizon.addColorStop(1,'rgba(190,142,158,.18)');
   c.fillStyle=horizon;c.fillRect(0,h*.6,w,h*.4);
 },1024,512);
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(116,64),
   new THREE.MeshBasicMaterial({map:t,fog:false,depthWrite:false,depthTest:false}));
 plane.position.set(0,-12,-165);plane.renderOrder=-8;scene.add(plane);
 const halo=texture((c,w,h)=>{
  const g=c.createRadialGradient(w/2,h/2,2,w/2,h/2,w/2);
  g.addColorStop(0,'rgba(255,246,220,.74)');
  g.addColorStop(.06,'rgba(255,236,209,.52)');
  g.addColorStop(.22,'rgba(234,193,211,.17)');
  g.addColorStop(1,'rgba(213,180,255,0)');
  c.fillStyle=g;c.fillRect(0,0,w,h);
 },256,256);
 const moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({
   map:halo,transparent:true,depthWrite:false,depthTest:false,
   blending:THREE.AdditiveBlending,fog:false}));
 moonGlow.position.set(9,-1,-150);moonGlow.scale.set(12,12,1);
 moonGlow.renderOrder=1;scene.add(moonGlow);
 const disc=texture((c,w,h)=>{
   const g=c.createRadialGradient(w*.41,h*.36,0,w/2,h/2,w*.44);
   g.addColorStop(0,'rgba(255,252,231,1)');
   g.addColorStop(.55,'rgba(249,237,215,1)');
   g.addColorStop(.90,'rgba(232,219,217,.96)');
   g.addColorStop(1,'rgba(232,219,217,0)');
   c.fillStyle=g;c.beginPath();c.arc(w/2,h/2,w*.44,0,TAU);c.fill();
   const random=(()=>{let seed=821;return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)})();
   for(let i=0;i<21;i++){
     const x=w*(.24+random()*.52),y=h*(.24+random()*.52),radius=2+random()*6;
     c.fillStyle='rgba(139,154,166,.055)';
     c.beginPath();c.arc(x,y,radius,0,TAU);c.fill();
   }
 },128,128);
 const moon=new THREE.Sprite(new THREE.SpriteMaterial({
   map:disc,transparent:true,depthWrite:false,depthTest:false,fog:false}));
 moon.position.set(9,-1,-149);moon.scale.set(1.36,1.36,1);
 moon.renderOrder=2;scene.add(moon);
 const xyz=[],phase=[];
 for(let i=0;i<2400;i++){
   xyz.push((rng()-.5)*112,-16+rng()*33,-139-rng()*3);
   phase.push(rng()*TAU);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(xyz,3));
 geo.setAttribute('aPhase',new THREE.Float32BufferAttribute(phase,1));
 stars=new THREE.Points(geo,new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  uniforms:{uTime:{value:0},uDensity:{value:1}},
  vertexShader:`attribute float aPhase;varying float vPhase;uniform float uDensity;
    void main(){vPhase=aPhase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=2.8*uDensity;}`,
  fragmentShader:`precision mediump float;uniform float uTime;varying float vPhase;
    void main(){float r=length(gl_PointCoord-.5);
      gl_FragColor=vec4(.85,.93,1.,pow(max(0.,1.-r*2.),2.4)*(.60+.40*sin(uTime*.9+vPhase)));}`
 }));
 scene.add(stars);
}
let rockPattern;
function mountainTexture(){
 return texture((c,w,h)=>{
  const img=c.createImageData(w,h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const broad=noise(x*.018+y*.022,71)*.53;
   const strata=noise(x*.082-y*.047,16)*.27;
   const grain=noise(x*.38+y*.24,32)*.14;
   const seam=Math.sin(y*.11+x*.055+broad*3)*.035;
   const value=Math.max(.58,Math.min(1,.83+(broad+strata+grain)*.26+seam));
   const n=(y*w+x)*4,v=Math.round(value*255);
   img.data[n]=v;img.data[n+1]=v;img.data[n+2]=v;img.data[n+3]=255;
  }
  c.putImageData(img,0,0);
  const r=(()=>{let a=4617;return()=>((a=(Math.imul(a,1664525)+1013904223)>>>0)/4294967296)})();
  for(let i=0;i<1100;i++){
   const x=r()*w,y=r()*h,len=6+r()*35;
   c.strokeStyle=i%4===0?'rgba(247,247,255,.13)':'rgba(23,42,60,.075)';
   c.lineWidth=.35+r()*1.6;c.beginPath();
   c.moveTo(x,y);c.quadraticCurveTo(x-len*.25,y+len*.3,x-len*.39,y+len);
   c.stroke();
  }
 },768,384);
}
function mountain(z,base,seed,top,bottom){
 const steps=240,rows=8,pos=[],col=[],uvs=[],indices=[],ct=new THREE.Color(top),cb=new THREE.Color(bottom);
 for(let j=0;j<=rows;j++){
  const v=j/rows;
  for(let i=0;i<=steps;i++){
   const x=-110+i/steps*220;
   const y=lerp(base+ridge(x,seed)*(z<-90?.72:1.15),-25,v);
   pos.push(x,y,z+v*1.5);uvs.push(i/steps,1-v);
   const tone=.83+noise(x*.30+v*7,seed+3)*.12;
   const cc=ct.clone().lerp(cb,v*.9).multiplyScalar(tone);
   col.push(cc.r,cc.g,cc.b);
   if(j<rows&&i<steps){const a=j*(steps+1)+i,b=a+steps+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
 if(!rockPattern)rockPattern=mountainTexture();
 scene.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:rockPattern,vertexColors:true,side:THREE.DoubleSide,fog:false})));
}
function water(){
 waterClock={value:0};
 const g=new THREE.PlaneGeometry(190,110,65,48);
 const mat=new THREE.ShaderMaterial({
  uniforms:{uTime:waterClock},side:THREE.DoubleSide,
  vertexShader:`uniform float uTime;varying vec2 vPos;varying float vRipple;
   void main(){vec3 p=position;
    float a=sin(p.x*.6+p.y*.18+uTime*.6);float b=sin(p.y*.74-p.x*.2-uTime*.41);
    p.z+=a*.055+b*.035;vPos=p.xy;vRipple=.6*a+.4*b;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`precision highp float;uniform float uTime;varying vec2 vPos;varying float vRipple;
    void main(){
      float depth=smoothstep(-45.,20.,vPos.y);
      vec3 c=mix(vec3(.036,.103,.19),vec3(.045,.26,.30),depth*.82);
      float broad=sin(vPos.x*.72+vPos.y*.34-uTime*.80);
      float rip=sin(vPos.y*2.65-vPos.x*.73+uTime*1.30);
      float fine=sin(vPos.x*1.71+vPos.y*5.6-uTime*.86);
      c+=vec3(.07,.15,.17)*max(0.,broad*.27+rip*.2+fine*.08);
      float reflection=exp(-abs(vPos.x*.17+sin(vPos.y*.075+uTime*.12)*.4+vRipple*.16)*1.7);
      float sparkle=pow(max(0.,sin(vPos.y*.36+uTime*.55)),6.);
      c+=vec3(.52,.37,.34)*reflection*(.025+.22*sparkle)*(.4+depth*.6);
      gl_FragColor=vec4(c,1.);
    }`
 });
 const mesh=new THREE.Mesh(g,mat);mesh.rotation.x=-Math.PI/2;
 mesh.position.set(0,-4,-10);scene.add(mesh);
}
function land(side){
 const steps=95,rows=15,pos=[],col=[],idx=[];
 const dark=new THREE.Color('#172f2d'),light=new THREE.Color('#5b6550');
 for(let j=0;j<=rows;j++)for(let i=0;i<=steps;i++){
  const z=-30+i/steps*80,v=j/rows;
  const coast=(side===-1?-1:1)*(8+1.9*Math.sin(z*.16)+noise(z*.14,side*10)*1.1);
  const x=lerp(coast,side*64,v);
  const y=-3.95+v*v*(.7+noise(z*.10,15)*.25)+noise(x*.30+z*.14,8)*.08;
  pos.push(x,y,z);
  const cc=dark.clone().lerp(light,v*.48+noise(x*.13+z*.1,22)*.08);
  col.push(cc.r,cc.g,cc.b);
  if(j<rows&&i<steps){const a=j*(steps+1)+i,b=a+steps+1;idx.push(a,a+1,b,b,a+1,b+1);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeVertexNormals();
 scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide})));
}
function foreground(){
 const g=new THREE.PlaneGeometry(125,46,70,28);g.rotateX(-Math.PI/2);
 const p=g.getAttribute('position');
 for(let i=0;i<p.count;i++)p.setY(i,-3.35+noise(p.getX(i)*.24+p.getZ(i)*.16,2)*.13);
 p.needsUpdate=true;g.computeVertexNormals();
 scene.add(new THREE.Mesh(g,new THREE.MeshLambertMaterial({color:'#314737',side:THREE.DoubleSide}))).position.set(0,0,36);
}
function cloudTexture(){
 return texture((c,w,h)=>{
  for(let i=0;i<44;i++){
   const x=w*(.08+rng()*.84),y=h*(.3+rng()*.4),r=12+rng()*49;
   const g=c.createRadialGradient(x,y,1,x,y,r);
   g.addColorStop(0,'rgba(225,212,235,.10)');g.addColorStop(.5,'rgba(182,197,227,.06)');
   g.addColorStop(1,'rgba(165,181,229,0)');c.fillStyle=g;
   c.beginPath();c.ellipse(x,y,r,r*.30,0,0,TAU);c.fill();
  }
 },512,180);
}
function cloudField(){
 const t=cloudTexture();
 for(let i=0;i<11;i++){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(24+rng()*29,7+rng()*7),
   new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,fog:false,opacity:.45+rng()*.35}));
  const x=-100+rng()*200;
  m.position.set(x,9+rng()*20,-102+rng()*22);
  m.userData={x,speed:.10+rng()*.4,phase:rng()*TAU};
  scene.add(m);clouds.push(m);
 }state.clouds=clouds.length;
}
function forest(){
 const tex=texture((c,w,h)=>{
  let seed=92161;const r=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  c.lineCap='round';const cx=w/2;
  for(let j=0;j<7;j++){
   c.strokeStyle=j%2?'rgba(29,67,64,.85)':'rgba(60,101,84,.52)';
   c.lineWidth=.7+r()*2;c.beginPath();c.moveTo(cx+(r()-.5)*4,h);
   c.lineTo(cx+(r()-.5)*3,h*.08);c.stroke();
  }
  for(let i=0;i<110;i++){
   const t=i/110,y=h*(.12+t*.8),len=4+t*.95*95;
   for(const dir of [-1,1]){
    const tx=cx+dir*len*(.65+r()*.38),ty=y+(r()-.5)*13+t*18;
    c.strokeStyle=i%5===0?'rgba(110,149,129,.53)':'rgba(27,77,71,.8)';
    c.lineWidth=.8+r()*1.6;c.beginPath();c.moveTo(cx,y);
    c.quadraticCurveTo(cx+dir*len*.55,y-5,tx,ty);c.stroke();
    for(let k=0;k<8;k++){
     const v=r(),x=lerp(cx,tx,v),yy=lerp(y,ty,v),p=5+r()*11;
     c.strokeStyle=k%3===0?'rgba(149,177,142,.35)':'rgba(25,73,70,.73)';
     c.lineWidth=.5+r()*1;c.beginPath();c.moveTo(x,yy);
     c.lineTo(x+dir*p*.42,yy-p);c.stroke();
    }
   }
  }
 },256,384);
 const g=new THREE.PlaneGeometry(1,1,1,12);g.translate(0,.5,0);
 const mat=new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,
  alphaTest:.065,side:THREE.DoubleSide,fog:false});
 mat.onBeforeCompile=shader=>{
  shader.uniforms.uWindTime=windClock;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nuniform float uWindTime;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   `#include <begin_vertex>
    #ifdef USE_INSTANCING
      transformed.x+=pow(max(position.y,0.),1.8)*.06*
        sin(uWindTime*.65-instanceMatrix[3].x*.15);
    #endif`);
 };
 mat.customProgramCacheKey=()=> 'gongang-forest-breeze';
 const count=330,mesh=new THREE.InstancedMesh(g,mat,count),obj=new THREE.Object3D();
 const colA=new THREE.Color('#9abbb0'),colB=new THREE.Color('#56848a');
 for(let i=0;i<count;i++){
  const x=-102+rng()*204,crest=-4.1+ridge(x,45)*1.15,h=.95+rng()*3.3;
  obj.position.set(x,crest-.25-Math.pow(rng(),1.4)*2.2,-55+rng()*7);
  obj.rotation.set(0,(rng()-.5)*.4,0);obj.scale.set(h*(.33+rng()*.13),h,1);
  obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);
  mesh.setColorAt(i,colA.clone().lerp(colB,rng()*.8));
 }
 mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
 scene.add(mesh);state.trees=count;
}
function plants(){
 const t=new THREE.TextureLoader().load('/assets/foliage-atlas.svg');
 t.colorSpace=THREE.SRGBColorSpace;t.minFilter=THREE.LinearFilter;t.magFilter=THREE.LinearFilter;
 windClock={value:0};
 const groups=[[],[],[],[],[]];
 for(let i=0;i<420;i++){
  const side=i%2?-1:1,z=-29+rng()*72;
  const edge=8.6+rng()*21;
  const x=side*(edge+Math.sin(z*.16)*1.6)+(rng()-.5)*2;
  const height=1.25+rng()*2.6+(z>9?rng():0);
  const variant=i%19===0?4:i%9===0?2:i%4===0?3:i%2===0?1:0;
  groups[variant].push({x,y:-3.84+edge*.024,z,h:height,w:height*(.33+rng()*.3),a:(rng()-.5)*.6});
 }
 for(let i=0;i<140;i++){
  const x=(rng()-.5)*95,z=14+rng()*43;
  if(Math.abs(x)<8&&z<28)continue;
  const height=1.4+rng()*2.9;
  groups[i%4].push({x,y:-3.35,z,h:height,w:height*(.34+rng()*.25),a:(rng()-.5)*.6});
 }
 for(let type=0;type<5;type++){
  const group=groups[type];if(!group.length)continue;
  const geo=new THREE.PlaneGeometry(1,1,1,18);geo.translate(0,.5,0);
  const uv=geo.getAttribute('uv');for(let i=0;i<uv.count;i++)uv.setX(i,(uv.getX(i)+type)/5);
  const mat=new THREE.MeshBasicMaterial({
   map:t,color:'#d3d9be',alphaTest:.075,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false
  });
  mat.onBeforeCompile=shader=>{
   shader.uniforms.uWindTime=windClock;
   shader.vertexShader=shader.vertexShader.replace('#include <common>',
    '#include <common>\nuniform float uWindTime;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
      #ifdef USE_INSTANCING
       float wx=instanceMatrix[3].x;float wz=instanceMatrix[3].z;
       float front=sin(uWindTime*.86-wx*.16-wz*.08);
       float gust=pow(max(0.,sin(uWindTime*.35-wx*.075)),2.);
       float flutter=sin(uWindTime*1.89+wx*.77);
       transformed.x+=pow(max(position.y,0.),1.65)*
         (.19*front+.08*gust+.017*flutter);
      #endif`
   );
  };
  mat.customProgramCacheKey=()=> 'gongang-wind-v2-'+type;
  const mesh=new THREE.InstancedMesh(geo,mat,group.length);mesh.frustumCulled=false;
  const obj=new THREE.Object3D();
  group.forEach((item,i)=>{obj.position.set(item.x,item.y,item.z);obj.rotation.set(0,item.a,0);
    obj.scale.set(item.w,item.h,1);obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);});
  mesh.instanceMatrix.needsUpdate=true;scene.add(mesh);state.plants+=group.length;
 }
}
function init(){
 try{
  const probe=document.createElement('canvas').getContext('webgl2');
  if(!probe)throw Error('WebGL2 is unavailable');
  probe.getExtension('WEBGL_lose_context')?.loseContext();
  renderer=new THREE.WebGLRenderer({powerPreference:'low-power',antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;
  scene=new THREE.Scene();scene.background=new THREE.Color('#121d3d');
  scene.fog=new THREE.FogExp2('#315b72',.006);
  camera=new THREE.OrthographicCamera(-20,20,12,-12,.1,500);
  camera.position.set(0,7,39);camera.lookAt(0,1,-23);
  scene.add(new THREE.HemisphereLight('#ddd9ef','#26403d',2.3));
  const key=new THREE.DirectionalLight('#c5d4ff',1.6);key.position.set(-8,26,9);scene.add(key);
  sky();
  mountain(-116,-2.4,12,'#7c8cb1','#394968');
  mountain(-94,-.9,37,'#617f9f','#264863');
  mountain(-73,-1.7,81,'#376d7c','#14394a');
  mountain(-56,-4.1,45,'#326772','#0b2938');
  water();land(-1);land(1);foreground();cloudField();plants();forest();
  state.ready=true;
 }catch(e){state.failed=true;state.error=String(e?.message||e);console.warn('Diorama fallback',e);}
}
function draw(ctx,t,now,{personal=false}={}){
 if(!state.ready)return false;
 try{
  const factor=innerWidth<680?.76:.85;
  const w=Math.min(1220,Math.max(240,Math.round(t.width*factor)));
  const h=Math.min(850,Math.max(240,Math.round(t.height*factor)));
  if(w!==state.width||h!==state.height){renderer.setSize(w,h,false);state.width=w;state.height=h;}
  const aspect=w/h;camera.left=-worldH*aspect/2;camera.right=worldH*aspect/2;
  camera.top=worldH/2;camera.bottom=-worldH/2;camera.updateProjectionMatrix();
  if(personal!==state.personal){camera.position.set(0,personal?12:7,39);
   camera.lookAt(0,personal?8:1,-23);state.personal=personal;}
  state.reducedMotion=Boolean(reduced?.matches);
  const sec=state.reducedMotion?0:(debugTimeMs===null?now:debugTimeMs)/1000;
  state.lastWind=Math.sin(sec*.86);
  waterClock.value=sec;windClock.value=sec;
  stars.material.uniforms.uTime.value=sec;
  for(const c of clouds)c.position.x=c.userData.x+Math.sin(sec*c.userData.speed*.04+c.userData.phase)*5.3;
  renderer.render(scene,camera);
  ctx.drawImage(renderer.domElement,t.x,t.y,t.width,t.height);
  state.renderCount++;return true;
 }catch(e){state.failed=true;state.ready=false;state.error=String(e?.message||e);return false;}
}
init();window.GongangDiorama3D={draw,state,get ready(){return state.ready},
 debugSetTime(ms){debugTimeMs=Number.isFinite(ms)?ms:null;}};
