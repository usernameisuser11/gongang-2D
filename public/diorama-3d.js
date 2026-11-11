/* Gongang: fixed-camera living 3D diorama. Fallback: existing painterly Canvas2D. */
import * as THREE from '/vendor/three.module.js';
import { loadLookoutModel, loadValleyTerrain, loadAlpineGrove } from '/scenic-model-loader.js';
import { createCinematicAtmosphere } from '/cinematic-atmosphere.js';
import { createPainterlyClouds } from '/painterly-clouds-3d.js';
import { createLivingEnvironment } from '/living-environment-3d.js';
import { createDeepValley, createValleyGroveLayout } from '/valley-sculpt-3d.js';
import { buildOverlookDetails } from '/overlook-details-3d.js';
import { createCinematicForest } from '/cinematic-forest-3d.js';
const TAU=Math.PI*2,worldH=29;
// QA: ?map=stargaze&models=off compares the old painted scenery to real 3D assets.
const rendererChoice=new URLSearchParams(location.search).get('renderer');
const liveMode=rendererChoice!=='3d'&&rendererChoice!=='2d'&&rendererChoice!=='painterly';
const editableModelsEnabled=new URLSearchParams(location.search).get('models')!=='off';
const cinemaEnabled=new URLSearchParams(location.search).get('cinema')!=='off';
const state={ready:false,failed:false,error:null,mode:'fixed-camera-3d',renderCount:0,plants:0,clouds:0,width:0,height:0,personal:false,modelLoaded:false,modelParts:0,modelError:null,terrainLoaded:false,terrainParts:0,terrainError:null,groveLoaded:false,pineCount:0,groveError:null,editableModelsEnabled,cinemaEnabled,hazeLayers:0,cinemaError:null,liveMode,environment:null,sculptedRidges:0,groveAnchored:false,freeSeating:true};
const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
let renderer,scene,camera,waterClock,windClock,windStrength={value:1},stars,clouds=[],moonSprite,moonGlow,debugTimeMs=null,lookoutModel=null,legacyMountains=[],legacyForest=null,cinematicAtmosphere=null,painterlyClouds=null,livingEnvironment=null,waterMaterial=null,deepValley=null,overlookDetails=null,cinematicForest=null;
const rng=(()=>{let s=20261110;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)})();
const lerp=(a,b,t)=>a+(b-a)*t,smooth=t=>t*t*(3-2*t);
const hash=n=>{n=Math.imul(n^(n>>>15),2246822519);n=Math.imul(n^(n>>>13),3266489917);return ((n^(n>>>16))>>>0)/4294967295};
const noise=(x,seed=0)=>{const i=Math.floor(x),t=smooth(x-i);return lerp(hash(i+seed*997),hash(i+seed*997+1),t)*2-1};
const ridge=(x,s)=>noise(x*.052,s)*2.9+noise(x*.18,s+9)*1.35+noise(x*.57,s+21)*.38+Math.exp(-Math.pow((x-(s%2?8:-12))/18,2))*1.25;
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
   for(let i=0;i<84;i++){
     const y=rand()*h*.87,bandX=w*(.61-.40*y/h)+Math.sin(y*.016)*29;
     const x=bandX+(rand()+rand()+rand()-1.5)*w*.15;
     const r=11+rand()*72;
     const nebula=c.createRadialGradient(x,y,0,x,y,r);
     const tint=i%3===0?'187,152,218':i%3===1?'87,156,226':'185,135,193';
     nebula.addColorStop(0,'rgba('+tint+',.022)');
     nebula.addColorStop(1,'rgba('+tint+',0)');
     c.fillStyle=nebula;c.fillRect(x-r,y-r,r*2,r*2);
   }
   for(let i=0;i<6300;i++){
     const y=rand()*h,mid=w*(.61-.40*y/h)+Math.sin(y*.016)*29;
     const x=mid+(rand()+rand()+rand()-1.5)*w*.27;
     if(x<0||x>=w)continue;
     const strength=.04+.31*Math.pow(rand(),2.6),size=.18+rand()**3*.75;
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
 moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({
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
 moonSprite=new THREE.Sprite(new THREE.SpriteMaterial({
   map:disc,transparent:true,depthWrite:false,depthTest:false,fog:false}));
 moonSprite.position.set(9,-1,-149);moonSprite.scale.set(1.36,1.36,1);
 moonSprite.renderOrder=2;scene.add(moonSprite);
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
    void main(){vPhase=aPhase;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=1.8*uDensity;}`,
  fragmentShader:`precision mediump float;uniform float uTime;varying float vPhase;
    void main(){float r=length(gl_PointCoord-.5);
      gl_FragColor=vec4(.85,.93,1.,pow(max(0.,1.-r*2.),2.4)*(.60+.40*sin(uTime*.9+vPhase)));}`
 }));
 scene.add(stars);
}
let rockPattern;
function mountainTexture(){
 const hash2=(x,y,seed)=>{
   let n=Math.imul(x,374761393)^Math.imul(y,668265263)^seed;
   n=Math.imul(n^(n>>>13),1274126177);
   return ((n^(n>>>16))>>>0)/4294967295;
 };
 const n2=(x,y,seed)=>{
   const ix=Math.floor(x),iy=Math.floor(y),fx=smooth(x-ix),fy=smooth(y-iy);
   const a=lerp(hash2(ix,iy,seed),hash2(ix+1,iy,seed),fx);
   const b=lerp(hash2(ix,iy+1,seed),hash2(ix+1,iy+1,seed),fx);
   return lerp(a,b,fy)*2-1;
 };
 return texture((c,w,h)=>{
   const pixels=c.createImageData(w,h);
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
     // Independent 2D noise prevents the long diagonal stripes of 1D noise.
     const large=n2(x*.010,y*.014,71);
     const fold=n2(x*.046+y*.010,y*.035,16);
     const rock=n2(x*.16,y*.15,34);
     const fine=n2(x*.44,y*.43,93);
     const shaded=.78+large*.15+fold*.10+rock*.05+fine*.017;
     const v=Math.max(.52,Math.min(1,shaded));
     const i=(y*w+x)*4;
     pixels.data[i]=Math.round(v*248);
     pixels.data[i+1]=Math.round(v*251);
     pixels.data[i+2]=Math.round(Math.min(255,v*258));
     pixels.data[i+3]=255;
   }
   c.putImageData(pixels,0,0);
   const random=(()=>{let seed=10319;return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296)})();
   c.lineCap='round';
   for(let i=0;i<1550;i++){
     const x=random()*w,y=random()*h,len=4+random()*28;
     c.strokeStyle=i%5===0?'rgba(220,235,249,.08)':'rgba(11,33,58,.08)';
     c.lineWidth=.35+random()*1.3;
     c.beginPath();c.moveTo(x,y);
     c.bezierCurveTo(x+len*.12,y+len*.2,x-len*.32,y+len*.7,x-len*.25,y+len);
     c.stroke();
   }
 },768,384);
}
function mountainCrest(x,seed,base,z){
  let y=base+ridge(x,seed)*(z<-90?.72:1.15);
  // An open valley through the center reveals the real lake beyond. The
  // ridge rises naturally at the sides instead of forming a solid poster wall.
  if(seed===45)y-=6.7*Math.exp(-Math.pow((x-4)/28,2));
  if(seed===81)y-=2.1*Math.exp(-Math.pow((x+7)/33,2));
  // Irregular narrow alpine summits break the rounded horizon.
  const peak=(center,left,right,height)=>{
    const d=x<center?(center-x)/left:(x-center)/right;
    return height*Math.pow(Math.max(0,1-d),1.33);
  };
  if(seed===12)y+=peak(8,9,14,4.8)+peak(-12,7,12,2.4);
  if(seed===37)y+=peak(-7,7,13,1.7);
  return y;
}
function mountain(z,base,seed,top,bottom){
 const steps=240,rows=8,pos=[],col=[],uvs=[],indices=[],ct=new THREE.Color(top),cb=new THREE.Color(bottom);
 for(let j=0;j<=rows;j++){
  const v=j/rows;
  for(let i=0;i<=steps;i++){
   const x=-110+i/steps*220;
   const y=lerp(mountainCrest(x,seed,base,z),-25,v);
   pos.push(x,y,z+v*1.5);uvs.push(i/steps,1-v);
   const tone=.83+noise(x*.30+v*7,seed+3)*.12;
   const cc=ct.clone().lerp(cb,v*.9).multiplyScalar(tone);
   if(seed===12){
     const cap=Math.min(1,Math.max(0,(y-1.0)/3.4));
     const snow=cap*Math.pow(1-v,1.6)*(.72+noise(x*.42+v*3,31)*.19);
     cc.lerp(new THREE.Color('#f0eced'),Math.max(0,Math.min(.82,snow)));
   }
   col.push(cc.r,cc.g,cc.b);
   if(j<rows&&i<steps){const a=j*(steps+1)+i,b=a+steps+1;indices.push(a,b,a+1,b,b+1,a+1);}
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
 g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(indices);
 if(!rockPattern)rockPattern=mountainTexture();
 const oldMountain=new THREE.Mesh(g,new THREE.MeshBasicMaterial({map:rockPattern,vertexColors:true,side:THREE.DoubleSide,fog:false}));
  scene.add(oldMountain);legacyMountains.push(oldMountain);
}
function water(){
 waterClock={value:0};
 // The original flat water plane crossed the entire valley like a sea.
 // The living world has a real winding river disappearing into the mountains.
 const g=liveMode?new THREE.PlaneGeometry(1,1,44,96):
   new THREE.PlaneGeometry(190,110,65,48);
 if(liveMode){
   const p=g.getAttribute('position');
   for(let i=0;i<p.count;i++){
     const t=p.getY(i)+.5; // near river = 0; distant river = 1
     const width=.65+Math.pow(1-t,1.7)*4.6;
     const center=1.5*Math.sin(t*5.4+.20)+.35*Math.sin(t*12.5);
     const edge=(Math.abs(p.getX(i))-.36)*.18*
       Math.sin(t*85.+p.getX(i)*11.);
     p.setX(i,center+p.getX(i)*width*2.+edge);
     p.setY(i,-21+t*82);
   }
   p.needsUpdate=true;g.computeVertexNormals();
 }
 const mat=new THREE.ShaderMaterial({
  uniforms:{uTime:waterClock,uDaylight:{value:0},uTwilight:{value:0},uRain:{value:0}},side:THREE.DoubleSide,
  vertexShader:`uniform float uTime;varying vec2 vPos;varying float vRipple;
   void main(){vec3 p=position;
    float a=sin(p.x*.6+p.y*.18+uTime*.6);float b=sin(p.y*.74-p.x*.2-uTime*.41);
    p.z+=a*.055+b*.035;vPos=p.xy;vRipple=.6*a+.4*b;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`precision highp float;
    uniform float uTime,uDaylight,uTwilight,uRain;varying vec2 vPos;varying float vRipple;
    void main(){
      vec2 p=vPos;
      float gust=sin(p.x*.12+p.y*.086-uTime*.16)*1.15
        +sin(p.x*.37-p.y*.16+uTime*.29)*.63;
      float swell=sin(p.x*.48+p.y*.37-uTime*.54+gust*.80);
      float current=sin(p.y*1.70-p.x*.82+uTime*1.08+gust*.70);
      float chop=sin(p.x*2.35+p.y*3.57-uTime*1.13
        +sin(p.x*.47+p.y*.38-uTime*.20)*1.25);
      float depth=smoothstep(-52.,37.,p.y);
      vec3 col=mix(vec3(.020,.062,.110),vec3(.028,.143,.168),depth*.81);
       col=mix(col,vec3(.12,.32,.40)+vec3(.09,.13,.16)*depth,uDaylight*.65);
       col=mix(col,vec3(.22,.15,.28),uTwilight*.18);
      float waveLight=max(0.,swell*.28+current*.23+chop*.12);
      col+=vec3(.047,.115,.123)*waveLight;
      float softRipple=pow(max(0.,.52+.48*(swell*.55+current*.3+chop*.15)),5.);
      col+=vec3(.10,.16,.18)*softRipple*.18;
      // Irregular lunar caustics: not a perfectly straight luminous stripe.
      float drift=sin(p.y*.16-uTime*.22)*1.5+
        sin(p.y*.43+uTime*.48+gust*.27)*.63;
      float path=(p.x-9.+drift)*.20;
      float moonColumn=exp(-abs(path)*1.7);
      float broken=pow(max(0.,sin(p.y*2.20+p.x*.54
        +uTime*.61+gust*1.4+current*.51)),13.);
      float flecks=pow(max(0.,sin(p.x*3.25-p.y*4.4
        -uTime*.87+gust*2.0)),28.);
      float glint=moonColumn*(.022+.46*broken+.13*flecks)*(1.-depth*.32);
      col+=mix(vec3(.61,.50,.44),vec3(.90,.86,.65),uDaylight)*glint;
       col+=vec3(.042,.085,.11)*uRain*abs(chop);
      col+=vec3(.035,.08,.09)*max(0.,vRipple*.30);
      gl_FragColor=vec4(col,1.);
    }`
 });
 const mesh=new THREE.Mesh(g,mat);mesh.rotation.x=-Math.PI/2;
 waterMaterial=mat;
 mesh.position.set(0,liveMode?-4.28:-4,-10);scene.add(mesh);
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
 const g=new THREE.PlaneGeometry(125,84,70,40);
 g.rotateX(-Math.PI/2);
 const p=g.getAttribute('position'),cols=[];
 const dark=new THREE.Color('#193331'),light=new THREE.Color('#46604b');
 for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i);
   const b=noise(x*.24+z*.16,2);
   const frontEdge=9+2.8*Math.sin(x*.15)+1.6*noise(x*.08,29);
   const shoreShift=Math.max(0,1-(z+42)/84);
   p.setZ(i,z+shoreShift*(frontEdge-10)*.8);
   p.setY(i,-3.22+b*.18);
   const organic=noise(x*.25+z*.22,47)*.27+noise(x*.71-z*.31,61)*.15;
   const v=Math.max(.10,Math.min(.90,.45+organic));
   const col=dark.clone().lerp(light,v);
   cols.push(col.r,col.g,col.b);
 }
 p.needsUpdate=true;g.setAttribute('color',new THREE.Float32BufferAttribute(cols,3));
 g.computeVertexNormals();
 const mat=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});
 scene.add(new THREE.Mesh(g,mat)).position.set(0,0,49);
}
function cloudTexture(){
 return texture((c,w,h)=>{
  for(let i=0;i<46;i++){
   const x=w*(.08+rng()*.84),y=h*(.28+rng()*.44),r=18+rng()*64;
   const g=c.createRadialGradient(x,y,1,x,y,r);
   g.addColorStop(0,'rgba(186,196,222,.12)');g.addColorStop(.5,'rgba(135,164,206,.055)');
   g.addColorStop(1,'rgba(165,181,229,0)');c.fillStyle=g;
   c.beginPath();c.ellipse(x,y,r,r*.30,0,0,TAU);c.fill();
  }
 },512,180);
}
function cloudField(){
 const t=cloudTexture();
 for(let i=0;i<5;i++){
  const m=new THREE.Mesh(new THREE.PlaneGeometry(24+rng()*29,7+rng()*7),
   new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,fog:false,opacity:.40+rng()*.20}));
  const x=-100+rng()*200;
  m.position.set(x,-5+rng()*11,-104+rng()*19);
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
  shader.uniforms.uWindStrength=windStrength;
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
   '#include <common>\nuniform float uWindTime;uniform float uWindStrength;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
   `#include <begin_vertex>
    #ifdef USE_INSTANCING
      transformed.x+=pow(max(position.y,0.),1.8)*.06*uWindStrength*
        sin(uWindTime*.65-instanceMatrix[3].x*.15);
    #endif`);
 };
 mat.customProgramCacheKey=()=> 'gongang-forest-breeze';
 const count=330,mesh=new THREE.InstancedMesh(g,mat,count),obj=new THREE.Object3D();
 const colA=new THREE.Color('#9abbb0'),colB=new THREE.Color('#56848a');
 for(let i=0;i<count;i++){
  const x=-102+rng()*204,crest=mountainCrest(x,45,-4.1,-56),h=.95+rng()*3.3;
  const aboveWater=crest>-3.4;
  obj.position.set(x,aboveWater?crest-.25:-100,-55+rng()*7);
  obj.rotation.set(0,(rng()-.5)*.4,0);
  obj.scale.set(aboveWater?h*(.33+rng()*.13):0,aboveWater?h:0,1);
  obj.updateMatrix();mesh.setMatrixAt(i,obj.matrix);
  mesh.setColorAt(i,colA.clone().lerp(colB,rng()*.8));
 }
 mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
 scene.add(mesh);legacyForest=mesh;state.trees=count;
}

/* Actual 3D foreground tree trunks and wind-reactive layered canopy cards.
 * The forest is not baked into a sliding background image; only foliage bends.
 */
function buildFramingTrees(){
  const crown=texture((ctx,w,h)=>{
    const random=(()=>{let n=39028;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296)})();
    const lobes=[];
    for(let i=0;i<21;i++){
      const a=random()*TAU,d=.04+Math.sqrt(random())*.31;
      const x=w*(.5+Math.cos(a)*d),y=h*(.48+Math.sin(a)*d*.65);
      lobes.push({x,y,rx:w*(.11+random()*.13),ry:h*(.09+random()*.13)});
    }
    // Irregular overlapping leaf masses produce no square sprite outline.
    for(const l of lobes){
      ctx.save();ctx.translate(l.x,l.y);ctx.scale(1,l.ry/l.rx);
      // Gradient coordinates must be local to the translated crown lobe.
      // Otherwise most of the texture is transparent on actual devices.
      const g=ctx.createRadialGradient(-l.rx*.15,-l.rx*.11,0,0,0,l.rx);
      g.addColorStop(0,'rgba(140,183,157,.68)');
      g.addColorStop(.38,'rgba(63,126,120,.84)');
      g.addColorStop(.78,'rgba(31,76,85,.84)');
      g.addColorStop(1,'rgba(16,46,58,0)');
      ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,l.rx,0,TAU);ctx.fill();ctx.restore();
    }
    for(let i=0;i<4600;i++){
      const x=w*(.12+random()*.76),y=h*(.14+random()*.67);
      const inside=lobes.some(l=>Math.pow((x-l.x)/l.rx,2)+Math.pow((y-l.y)/l.ry,2)<.74);
      if(!inside)continue;
      const len=1+random()*4.4,width=.45+random()*1.4;
      ctx.strokeStyle=i%5===0?'rgba(210,218,166,.34)':i%3===0?
        'rgba(108,165,154,.44)':'rgba(18,57,67,.56)';
      ctx.lineWidth=width;ctx.lineCap='round';
      ctx.beginPath();ctx.moveTo(x,y);
      ctx.quadraticCurveTo(x+len*.15,y-len*.5,x+len*.65,y-len*.88);
      ctx.stroke();
    }
  },512,512);
  const leafGeo=new THREE.PlaneGeometry(1,1,1,12);
  leafGeo.translate(0,.5,0);
  const mat=new THREE.MeshBasicMaterial({map:crown,transparent:true,
    alphaTest:.045,depthWrite:false,side:THREE.DoubleSide,color:'#bdc9b4',fog:false});
  mat.onBeforeCompile=shader=>{
    shader.uniforms.uWindTime=windClock;
  shader.uniforms.uWindStrength=windStrength;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nuniform float uWindTime;uniform float uWindStrength;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      `#include <begin_vertex>
       #ifdef USE_INSTANCING
       float phase=instanceMatrix[3].x*.27+instanceMatrix[3].z*.32;
       float breeze=sin(uWindTime*.48+phase)+.21*sin(uWindTime*1.17+phase*2.1);
       transformed.x+=pow(max(position.y,0.),1.45)*.11*breeze*uWindStrength;
       #endif`);
  };
  mat.customProgramCacheKey=()=> 'gongang-broadleaf-breeze-1';
  const specs=[
    [-23,15,6.0,.85],[-31,30,11,1.12],
    [23,14,6.8,.89],[31,29,10.4,1.06],
    [-15,3,4.3,.64],[16,2,4.0,.61]
  ];
  const clusters=[],bark=new THREE.MeshLambertMaterial({color:'#443d38'}),
    bark2=new THREE.MeshLambertMaterial({color:'#514b42'});
  const cylinder=new THREE.CylinderGeometry(.10,.16,1,7,1);
  const dirY=new THREE.Vector3(0,1,0);
  function branch(from,to,radius,material){
    const delta=new THREE.Vector3().subVectors(to,from),len=delta.length();
    const mesh=new THREE.Mesh(cylinder,material);
    mesh.position.copy(from).addScaledVector(delta,.5);
    mesh.scale.set(radius/.13,len,radius/.13);
    mesh.quaternion.setFromUnitVectors(dirY,delta.multiplyScalar(1/len));
    scene.add(mesh);
  }
  for(const [x,z,height,spread] of specs){
    const base=new THREE.Vector3(x,-3.20,z);
    const top=base.clone().add(new THREE.Vector3((rng()-.5)*.75,height,0));
    branch(base,top,.20+(height/10)*.12,bark);
    const n=height>8?10:7;
    for(let k=0;k<n;k++){
      const f=.49+.40*rng(),ang=TAU*k/n+rng()*.5,
        len=(1.2+rng()*2.0)*spread*(height/7);
      const start=base.clone().lerp(top,f);
      const end=start.clone().add(new THREE.Vector3(
        Math.cos(ang)*len,.25+rng()*1.5,Math.sin(ang)*len*.60));
      branch(start,end,.08+(1-f)*.09,bark2);
      clusters.push({x:end.x,y:end.y-.7,z:end.z,w:len*(1.35+rng()*.45),
        h:height*(.29+rng()*.13),rot:(rng()-.5)*.42});
    }
    // A sparse top crown joins the branches without becoming a solid blob.
    clusters.push({x:top.x,y:top.y-height*.22,z:top.z,w:height*.57,
      h:height*.40,rot:(rng()-.5)*.20});
  }
  const leaves=new THREE.InstancedMesh(leafGeo,mat,clusters.length),o=new THREE.Object3D();
  for(let i=0;i<clusters.length;i++){
    const l=clusters[i];o.position.set(l.x,l.y,l.z);
    o.rotation.set(0,l.rot,0);o.scale.set(l.w,l.h,1);o.updateMatrix();
    leaves.setMatrixAt(i,o.matrix);
  }
  leaves.instanceMatrix.needsUpdate=true;leaves.frustumCulled=false;
  leaves.renderOrder=9;scene.add(leaves);
  state.foregroundTrees=specs.length;state.canopyClusters=clusters.length;
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
   map:t,color:'#adbbb0',alphaTest:.075,transparent:true,depthWrite:false,side:THREE.DoubleSide,fog:false
  });
  mat.onBeforeCompile=shader=>{
   shader.uniforms.uWindTime=windClock;
  shader.uniforms.uWindStrength=windStrength;
   shader.vertexShader=shader.vertexShader.replace('#include <common>',
    '#include <common>\nuniform float uWindTime;uniform float uWindStrength;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    `#include <begin_vertex>
      #ifdef USE_INSTANCING
       float wx=instanceMatrix[3].x;float wz=instanceMatrix[3].z;
       float front=sin(uWindTime*.86-wx*.16-wz*.08);
       float gust=pow(max(0.,sin(uWindTime*.35-wx*.075)),2.);
       float flutter=sin(uWindTime*1.89+wx*.77);
       transformed.x+=pow(max(position.y,0.),1.65)*
         (.19*front+.08*gust+.017*flutter)*uWindStrength;
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
  if(liveMode){
    livingEnvironment=createLivingEnvironment(THREE,scene,{reducedMotion:Boolean(reduced?.matches)});
    state.environment=livingEnvironment.state;
  }else{
    scene.add(new THREE.HemisphereLight('#ddd9ef','#26403d',2.3));
    const key=new THREE.DirectionalLight('#c5d4ff',1.6);key.position.set(-8,26,9);scene.add(key);
    sky();
  }
  if(liveMode) {
    // Five real 3D depth-bearing mountains, with a wide open central corridor.
    // Do not replace their shapes with image textures or curtain polygons.
    deepValley=createDeepValley(THREE,scene,{mobile:innerWidth<700});
    state.sculptedRidges=deepValley.count;
    state.terrainLoaded=true;
    state.terrainParts=deepValley.count;
  } else {
    mountain(-116,-2.4,12,'#7c8cb1','#394968');
    mountain(-94,-.9,37,'#617f9f','#264863');
    mountain(-73,-1.7,81,'#376d7c','#14394a');
    mountain(-56,-4.1,45,'#326772','#0b2938');
  }
  water();land(-1);land(1);foreground();plants();
  if(!liveMode){forest();buildFramingTrees();}
  if(liveMode){
    cinematicForest=createCinematicForest(THREE,scene,{mobile:innerWidth<700});
    state.pineCount=cinematicForest.count;
    state.groveLoaded=true;
    state.groveAnchored=true;
    state.forestLayers=5;
    overlookDetails=buildOverlookDetails(THREE,scene,{mobile:innerWidth<700});
    state.geologyPieces=overlookDetails.count;
  }
  // Consciously restrained cloud and atmosphere passes: no moving rectangles,
  // no fluorescent glow; debug with ?cinema=off without changing the artwork.
  if(cinemaEnabled&&!liveMode){
    try{
      const mobile=innerWidth<700;
      painterlyClouds=createPainterlyClouds(THREE,scene,{mobile});
      cinematicAtmosphere=createCinematicAtmosphere(THREE,scene,{mobile});
      state.clouds=painterlyClouds.count;
      state.hazeLayers=cinematicAtmosphere.count;
    }catch(error){
      state.cinemaError=String(error?.message||error);
      console.warn('Cinematic layers unavailable; using legacy clouds:',error);
      painterlyClouds?.dispose();
      cinematicAtmosphere?.dispose();
      painterlyClouds=null;cinematicAtmosphere=null;
      cloudField();
    }
  }else if(!liveMode)cloudField();
  if(editableModelsEnabled){
   // An actual mesh asset created for Gongang, also editable in Blender.
   // Async loading cannot delay or break the original 3D/Canvas scene.
   loadLookoutModel(THREE,scene).then(model=>{
     lookoutModel=model;state.modelLoaded=true;
     state.modelParts=model.userData.geometryCount;
     if(liveMode){
       // Keep the middle of the viewpoint clear for people to sit freely.
       for(const piece of model.children){
         if(piece.isMesh && /^(Stone|Flower|Leaf|ReedStem)/.test(piece.name))
           piece.visible=false;
       }
       model.position.x=18;
       model.position.z=14;
       model.scale.setScalar(.72);
     }
   }).catch(error=>{
     state.modelError=String(error?.message||error);
     console.warn('Gongang scenic model unavailable, original landscape retained:',error);
   });
  // Legacy imported mountains are retained in the older ?renderer=3d scene.
  // In live mode our five sculpted ridges are the actual terrain instead.
  if(!liveMode)loadValleyTerrain(THREE,scene).then(group=>{
    legacyMountains.forEach(mesh=>{mesh.visible=false;});
    state.terrainLoaded=true;state.terrainParts=group.children.length;
  }).catch(error=>{
    state.terrainError=String(error?.message||error);
    console.warn('3D terrain unavailable; keeping ridge fallback:',error);
  });
  if(!liveMode)loadAlpineGrove(THREE,scene,{}).then(group=>{
    if(legacyForest)legacyForest.visible=false;
    state.groveLoaded=true;state.pineCount=group.userData.count;
    state.groveAnchored=liveMode;
  }).catch(error=>{
    state.groveError=String(error?.message||error);
    console.warn('3D pines unavailable; keeping 2D forest:',error);
  });
  }
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
  // The canvas crop may be wider than the physical phone screen.
  // Use viewport orientation to frame the moon and near-bank composition.
  const portrait=innerWidth<700 && innerHeight>innerWidth*1.22;
  const eyeX=portrait?-5:0;
   if(lookoutModel && lookoutModel.userData.portrait!==portrait){
     lookoutModel.position.x=liveMode?(portrait?13:18):(portrait?-4.0:7);
     lookoutModel.scale.setScalar(liveMode?(portrait?.58:.72):(portrait?.79:.82));
     lookoutModel.userData.portrait=portrait;
   }
  // A portrait composition looks toward the moon without rotating the view.
  if(personal!==state.personal || state.lastPortrait!==portrait){
    camera.position.set(eyeX,personal?12:7,39);
    camera.lookAt(eyeX,personal?8:1,-23);
    if(moonSprite){
      moonSprite.position.set(portrait?-5:-2,portrait?-2.2:-1,-149);
      moonGlow.position.set(portrait?-5:-2,portrait?-2.2:-1,-150);
    }
    state.personal=personal;state.lastPortrait=portrait;
  }
  state.reducedMotion=Boolean(reduced?.matches);
  const sec=state.reducedMotion?0:(debugTimeMs===null?now:debugTimeMs)/1000;
  windStrength.value=state.reducedMotion?0:1;
  state.lastWind=Math.sin(sec*.86);
  waterClock.value=sec;windClock.value=sec;
  if(stars)stars.material.uniforms.uTime.value=sec;
  if(livingEnvironment){
    const env=livingEnvironment.update(sec);
    state.environment=livingEnvironment.state;
    windClock.value=sec*(.58+env.wind*.32);
    windStrength.value=state.reducedMotion?0:Math.max(.10,Math.min(2.3,env.wind));
    if(waterMaterial){
      waterMaterial.uniforms.uDaylight.value=env.daylight;
      waterMaterial.uniforms.uTwilight.value=env.twilight;
      waterMaterial.uniforms.uRain.value=env.rain;
    }
  }
  if(moonSprite){
    const uv=moonSprite.position.clone().project(camera);
    state.moonUV={x:(uv.x+1)*.5,y:(1-uv.y)*.5};
  }
  if(painterlyClouds)painterlyClouds.update(sec);
   else for(const c of clouds)c.position.x=c.userData.x+Math.sin(sec*c.userData.speed*.04+c.userData.phase)*5.3;
   if(cinematicAtmosphere)cinematicAtmosphere.update(sec);
  renderer.render(scene,camera);
  ctx.drawImage(renderer.domElement,t.x,t.y,t.width,t.height);
  state.renderCount++;return true;
 }catch(e){state.failed=true;state.ready=false;state.error=String(e?.message||e);return false;}
}
// In this experimental branch the real-time WebGL world is the default.
// ?renderer=3d is the former fixed-night version; ?renderer=2d is legacy fallback.
const useThreeScene=rendererChoice!=='2d'&&rendererChoice!=='painterly';
if(useThreeScene)init();
window.GongangDiorama3D={draw,state,get ready(){return state.ready},
 debugSetTime(ms){debugTimeMs=Number.isFinite(ms)?ms:null;}};
