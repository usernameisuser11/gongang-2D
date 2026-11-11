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
import { scenicLighting } from '/scenic-lighting-25d.js';
import { createOverlookShadows25D } from '/overlook-shadows-25d.js';
import { overlookGroundHeight } from '/overlook-ground-25d.js';
import { createMeadowEdge25D } from '/meadow-edge-25d.js';
import { createVistaDetails25D } from '/vista-details-25d.js';

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
/** Stable coherent 2D rock strata — geometry, not a surface color decal. */
function terrainNoise2(x,y,seed){
 const ix=Math.floor(x),iy=Math.floor(y);
 let fx=x-ix,fy=y-iy;
 fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
 const h=(a,b)=>{
   let n=(Math.imul(a,374761393)+Math.imul(b,668265263)+Math.imul(seed,1442695041))|0;
   n=Math.imul(n^(n>>>13),1274126177);
   return ((n^(n>>>16))>>>0)/2147483647.5-1;
 };
 const a=h(ix,iy)*(1-fx)+h(ix+1,iy)*fx;
 const b=h(ix,iy+1)*(1-fx)+h(ix+1,iy+1)*fx;
 return a*(1-fy)+b*fy;
}
/** Heightfield with curved drainage channels, projecting ridges and recessed gullies.
 * x and t are sampled on the SAME connected terrain strip: no overlapping cliffs.
 * Across the eight mountain layers, depth controls how far a spur may project.
 */
function sculptedMountainPoint(x,t,layer){
 const depth=clamp((layer.z+172)/110);
 const cap=Math.sin(Math.PI*t);
 const envelope=Math.pow(Math.max(0,cap),.78);
 const warp=terrainNoise2(x*.047,t*2.5,layer.seed+31)*3.5
   +terrainNoise2(x*.135,t*4.1,layer.seed+17)*1.10;
 const u=x+warp*(.53+depth*.48);
 const spine=terrainNoise2(u*.095,t*1.25,layer.seed+41);
 const branch=terrainNoise2(u*.18+t*.18,t*.66,layer.seed+59);
 const chips=terrainNoise2(u*.53,t*4.1,layer.seed+89);
 const channel=terrainNoise2(u*.13+t*.21,t*.87+.71,layer.seed+73);
 // Broad twisting gullies are depressions in *both* height and depth.
 const gully=smooth(.30,.84,channel*.57+branch*.43);
 const protrusion=(spine*1.45+branch*1.05+chips*.20)*(1.10+depth*.90);
 const carve=gully*(2.7+depth*2.25);
 const y=crest(x,layer)-t*47+
   envelope*(protrusion*.90-carve);
 const z=layer.z+t*(3.0+depth*7.9)+
   envelope*(spine*(1.1+depth*2.0)+branch*(1.5+depth*2.6)
     -gully*(1.65+depth*2.8));
 return {y,z,gully,spine,branch,chips,envelope};
}
function crest(x,l){
 // Each ridge has a different saddle, asymmetric shoulder and eroded spurs.
 // No mirrored V-walls or an identical hill repeated at every distance.
 const axis=x-l.turn+(l.seed%7-3)*.52;
 const distance=Math.abs(axis);
 const hill=(cx,w,h)=>h*Math.exp(-Math.pow((x-cx)/w,2)*1.7);
 const asym=axis<0?.88+((l.seed%4)*.045):1.10-((l.seed%3)*.035);
 const shoulder=l.rise*Math.pow(distance/28.8,1.34)*asym;
 const pedestal=.63*noise(x*.046,l.seed+91)*Math.min(1,distance/16);
 const contour=noise(x*.093,l.seed+5)*1.02
   +noise(x*.25,l.seed+16)*.34+noise(x*.66,l.seed+33)*.14;
 const alpine=l.alpine||0;
 const farPeak=alpine*(hill(-32+(l.seed%6),7.1,2.4)
   +hill(24-(l.seed%8),9.5,2.1)
   +hill(-8+(l.seed%5),4.1,.75))
   +alpine*Math.pow(Math.max(0,noise(x*.32,l.seed+77)),3)*1.3;
 const spurL=hill(-27+(l.seed%9),12.5,2.1+.26*(l.seed%4));
 const spurR=hill(18+(l.seed%11),9.8,2.0+.32*(l.seed%3));
 const saddle=hill((l.seed%11)-5,8.7,-.80);
 const erosion=contour*(.30+.70*Math.min(1,distance/23));
 return l.center+shoulder+pedestal+erosion+farPeak
   +spurL+spurR+saddle+hill(4+(l.seed%7),5.9,l.peak*.53);
}
const LAYERS=[
 {name:'far alpine snow',z:-172,center:-12.2,rise:3.5,turn:2,peak:2.4,alpine:1.5,seed:8,base:'#849bc9',day:'#b0c5c9'},
 {name:'blue alpine summits',z:-157,center:-13.2,rise:4.1,turn:-1,peak:2.5,alpine:1.8,seed:13,base:'#758bc0',day:'#9fbac3'},
 {name:'horizon foothills',z:-143,center:-13.5,rise:4.5,turn:0,peak:2.3,alpine:.9,seed:19,base:'#6f86b5',day:'#92b1ad'},
 {name:'lavender peaks',z:-126,center:-14.2,rise:5.4,turn:-4,peak:3.0,alpine:.4,seed:27,base:'#6484ba',day:'#7da4aa'},
 {name:'distant cobalt',z:-110,center:-13.8,rise:6.6,turn:3,peak:2.6,seed:33,base:'#386c9b',day:'#6d9e9c'},
 {name:'teal valleys',z:-94,center:-13.7,rise:7.5,turn:-2,peak:2.3,seed:41,base:'#28688d',day:'#6a9a82'},
 {name:'deep fir hills',z:-78,center:-12.8,rise:8.8,turn:2,peak:2.0,seed:55,base:'#173d67',day:'#507f69'},
 {name:'near forest slopes',z:-62,center:-12.0,rise:9.8,turn:-1,peak:1.8,seed:67,base:'#0d2c51',day:'#466c59'}
];
const MOUNTAIN_VS=`
attribute vec2 aGeology;
varying vec2 vGeology;
varying vec3 vPigment,vFaceNormal;
varying float vDepth;varying vec2 vUV;
void main(){
 vGeology=aGeology;
 vPigment=color;vDepth=position.y;vUV=uv;
 vFaceNormal=normalize(normalMatrix*normal);
 gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;
const MOUNTAIN_FS=`
precision highp float;
varying vec2 vGeology;
varying vec3 vPigment,vFaceNormal;
varying float vDepth;varying vec2 vUV;
uniform float uDay,uTwilight,uStorm,uWind,uTime,uCloud,uShadow,uSunAzimuth,uSunElevation,uDepthWeight;
uniform vec3 uLightDir,uLightColor,uDayHue;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float rockNoise(vec2 p){
  vec2 i=floor(p),f=fract(p);
  f=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
    mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
void main(){
  float folded=sin(vUV.x*24.7+sin(vUV.y*6.9)*3.8);
  float strata=sin(vUV.x*36.0+vUV.y*9.0+sin(vUV.x*13.)*1.9);
  float mineral=hash(floor(vUV*vec2(244.,37.)));
  float eroded=sin(vUV.x*83.5+sin(vUV.y*18.1)*2.4);
  float cracks=pow(1.-abs(eroded),8.0);
  float detail=sin(vUV.x*161.0+sin(vUV.y*31.)*4.0)*.032;
  // Nested rock weathering: broad fractures, eroded scree, fine
  // crystalline pigment. Non-repeating 2D fields replace stripe textures.
  float ravine=rockNoise(vUV*vec2(23.,7.)+vec2(8.,3.));
  float scree=rockNoise(vUV*vec2(79.,31.)+vec2(17.,11.));
  float mineralDust=rockNoise(vUV*vec2(211.,96.)+vec2(31.,7.));
  float erosionBand=rockNoise(vUV*vec2(8.3,14.6)+vec2(4.,12.));
  float brokenShale=pow(1.-abs(2.*scree-1.),7.);
  float weathering=.79+.18*ravine+.07*scree+.055*mineralDust;
  float cliffExposure=smoothstep(.40,.71,ravine*.65+erosionBand*.35);
  float texture=(.94+.055*folded+.045*(mineral-.5)+.039*strata
    -cracks*.072+detail*.60)*weathering;
  // Ridgeline facets and fine gullies act like sculpted normal-map detail.
  // They catch the sunrise/sunset direction differently at each hour.
  vec3 relief=normalize(vFaceNormal+vec3(
    .21*folded+.11*strata+.17*(ravine-.5),
    .065*folded+.10*(scree-.5),
    .15*strata+.16*(erosionBand-.5)));
  vec3 lightVector=normalize(uLightDir);
  float incidence=max(0.,dot(relief,lightVector));
  // Actual displaced-face normals create broad illuminated slopes.
  float diffuse=.63+.53*incidence;
  float selfOcclusion=smoothstep(-.20,.54,
    sin(vUV.x*19.4+strata*1.6+uSunAzimuth*1.8));
  float ridgeShade=1.-uShadow*(1.-incidence)*(.20+.30*selfOcclusion);
  float terrainShadow=1.-uShadow*(1.-selfOcclusion)*.14;
  vec3 night=vPigment*vec3(.84,.91,1.15);
  vec3 day=mix(vPigment*vec3(1.12,1.25,1.0),
    uDayHue*(.65+.31*vUV.y),.62);
  vec3 col=mix(night,day,clamp(uDay,0.,1.));
  col*=mix(.82,1.24,uDay*.92)*diffuse*ridgeShade*terrainShadow;
  // A broad daylight bounce from the open sky reaches mid-valley faces.
  col+=uDay*(1.-uDepthWeight)*vec3(.027,.046,.029)*(1.-uStorm*.65);
  // Aerial perspective lets far mountains catch blue-lavender twilight.
  // Close forest hills stay in silhouette; not one flat filter on every hill.
  col+=vec3(.065,.125,.21)*uTwilight*uDepthWeight*(.35+.65*vUV.y);
  col*=1.+uTwilight*uDepthWeight*.15;
  col*=mix(vec3(1.0),uLightColor,.54*uDay+.32*uTwilight);
  // Warm sun rim only when light comes from a low angle; night remains blue.
  float horizon=clamp((vUV.y-.30)*1.45,0.,1.);
  col+=vec3(.19,.069,.075)*uTwilight*horizon*(.4+.6*incidence);
  // Cliff outcrops stay readable in moonlight; distant rock
  // weathers more softly through haze instead of flashing white.
  float stoneMask=cliffExposure*(.32+.68*brokenShale);
  float nearby=1.-uDepthWeight;
  col=mix(col,col*vec3(.77,.88,.98),
    stoneMask*(.11+.17*nearby)*(1.-uStorm*.30));
  // Geological channels follow curved noise fields, not stripes.
  // A low-cost cloud mask crosses the hillside with the shared world clock.
  vec2 carved=vec2(vUV.x*18.0+.65*ravine,vUV.y*7.3+.38*erosionBand);
  float drainage=rockNoise(carved+vec2(3.7,21.2));
  float tributary=rockNoise(carved*2.41+vec2(11.5,6.0));
  float rockChannel=smoothstep(.35,.68,
    drainage*.79+tributary*.21)
    *smoothstep(.02,.37,1.-vUV.y);
  float exposed=rockNoise(vec2(vUV.x*8.2,vUV.y*12.9)+vec2(18.,7.));
  float fineCliffs=smoothstep(.38,.69,exposed*.52+erosionBand*.48);
  float cutDepth=(.12+.30*nearby)*rockChannel
    +(.07+.13*nearby)*fineCliffs;
  col*=1.-cutDepth*(.55+.45*uDay);
  // Connected geometry channels have their own pigment and shadow;
  // unlike procedurally painted cracks, they continue across the mesh.
  col*=1.-vGeology.x*(.12+.16*nearby)*(.45+.55*uDay);
  col*=.94+.13*vGeology.y;
  float spill=clamp(dot(relief,lightVector),0.,1.);
  col+=vec3(.11,.12,.115)*fineCliffs*spill*uDay*(.08+.23*nearby);
  float cloudBand=rockNoise(vec2(
    vUV.x*6.8-uTime*(.00060+.00033*uWind),
    vUV.y*2.7+12.5));
  float movingShade=smoothstep(.39,.67,cloudBand)
    *uCloud*uDay*(1.-uStorm*.55);
  col*=1.-movingShade*(.08+.18*nearby);
  col*=mix(1.,texture,.57+.39*nearby)*(1.-uStorm*.13);
  gl_FragColor=vec4(max(col,0.),1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const FIR_VS=`
varying vec3 vTreeColor;
varying float vTreeLight;
uniform float uTime,uWind;
uniform vec2 uParallax;
uniform vec3 uLightDir,uLightColor;
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
uniform vec3 uLightColor;
void main(){
 vec3 day=vTreeColor*vec3(1.25,1.39,1.14);
 vec3 col=mix(vTreeColor*.81,day,uDay);
 col*=mix(1.,vTreeLight,.64*uShadow);
 col*=mix(vec3(1.),uLightColor,.49*uDay+.29*uTwilight);
 col+=vec3(.11,.042,.052)*uTwilight*.24;
 gl_FragColor=vec4(col*(1.-uStorm*.10),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
function makeMountain(THREE,scene,layer,mobile){
 // A terrain strip is tessellated in both dimensions: rock grooves and
 // weathering are displaced into geometry, not faked by a flat color plate.
 const across=mobile?175:352,rows=mobile?28:46;
 const pos=new Float32Array((across+1)*(rows+1)*3);
 const rgb=new Float32Array(pos.length),uv=new Float32Array((across+1)*(rows+1)*2);
 const geology=new Float32Array((across+1)*(rows+1)*2);
 const index=new Uint32Array(across*rows*6);
 let actualMinZ=Infinity,actualMaxZ=-Infinity;
 let actualMinY=Infinity,actualMaxY=-Infinity;
 const near=new THREE.Color(layer.base),
   low=near.clone().multiplyScalar(.39),
   granite=new THREE.Color('#8b899c'),
   lichen=new THREE.Color('#647584'),
   alpineSnow=new THREE.Color('#c4d4d6'),
   tone=new THREE.Color();
 for(let j=0;j<=rows;j++){
  const t=j/rows;
  for(let i=0;i<=across;i++){
   const x=-80+i/across*160;
   const ridgeline=crest(x,layer);
   const k=(j*(across+1)+i)*3,q=(j*(across+1)+i)*2;
   // Real depth displacement, coherent across each strip. Its surface
   // normals drive sun and moon lighting rather than a fake stripe pattern.
   const distance=clamp((layer.z+172)/110);
   const rock=sculptedMountainPoint(x,t,layer);
   pos[k]=x;pos[k+1]=rock.y;pos[k+2]=rock.z;
   actualMinZ=Math.min(actualMinZ,rock.z);
   actualMaxZ=Math.max(actualMaxZ,rock.z);
   actualMinY=Math.min(actualMinY,rock.y);
   actualMaxY=Math.max(actualMaxY,rock.y);
   geology[q]=rock.gully*rock.envelope;
   geology[q+1]=rock.spine*.5+.5;
   // Color fields follow the displaced rock and broken talus.
   const rockExposure=clamp(.14+.46*rock.gully+
     .19*Math.abs(rock.branch)+.10*distance,0,.85);
   tone.copy(near).lerp(low,t*.53);
   tone.lerp(granite,rockExposure*(.12+distance*.23));
   tone.lerp(lichen,(1-t)*clamp((rock.spine*.5+.5)*.17));
   // Patchy high-alpine snow remains on the actual elevated cliff faces.
   if(layer.alpine){
     const snowCap=smooth(.28,.91,1-t)
       *smooth(.18,.86,rock.spine*.5+rock.chips*.22+.50);
     tone.lerp(alpineSnow,snowCap*layer.alpine*.22);
   }
   const faceLight=.88+.13*(.5+.5*rock.branch)
     -.13*rock.gully*rock.envelope;
   tone.multiplyScalar(faceLight);
   rgb[k]=tone.r;rgb[k+1]=tone.g;rgb[k+2]=tone.b;
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
 g.setAttribute('aGeology',new THREE.BufferAttribute(geology,2));
 g.setIndex(new THREE.BufferAttribute(index,1));
 g.computeVertexNormals();
 const u={
   uDay:{value:0},uTwilight:{value:0},uStorm:{value:0},uCloud:{value:0},
   uWind:{value:0},uTime:{value:0},uLightDir:{value:new THREE.Vector3(.1,.7,1).normalize()},
   uSunAzimuth:{value:0},uSunElevation:{value:.5},uShadow:{value:0},
   uLightColor:{value:new THREE.Vector3(1,1,1)},
   uDayHue:{value:new THREE.Color(layer.day)},
   uDepthWeight:{value:smooth(-62,-172,layer.z)}
 };
 const mat=new THREE.ShaderMaterial({
   uniforms:u,vertexShader:MOUNTAIN_VS,fragmentShader:MOUNTAIN_FS,
   vertexColors:true,side:THREE.DoubleSide,depthWrite:true,fog:false
 });
 const mesh=new THREE.Mesh(g,mat);
 mesh.name='Real parallax mountain / '+layer.name;
 mesh.frustumCulled=false;
 scene.add(mesh);
 return {mesh,u,layer,basePosition:mesh.position.clone(),
   vertexCount:pos.length/3,reliefDepth:actualMaxZ-actualMinZ,
   heightExtent:actualMaxY-actualMinY};
}
// Original triangulated organic branch silhouette (geometry, not billboard photo).
function firGeometry(THREE,variant=0,mobile=false){
 const vertices=[],indices=[];let k=0;
 const tri=(a,b,c)=>{vertices.push(...a,...b,...c);indices.push(k,k+1,k+2);k+=3;};
 // Distinct real 3D architectures: drooping spruce, open alpine pine,
 // and a dense broad fir. No reused identical cone outline.
 const spruce=variant===0,pine=variant===1;
 const levels=mobile?(spruce?20:17):(spruce?29:pine?23:27);
 const width=spruce?.35:pine?.44:.42;
 const taper=spruce?.77:pine?.60:.71;
 tri([-.029,0,0],[.036,0,0],[.014,1.08,0]);
 for(let j=0;j<levels;j++){
  const t=j/levels,y=.06+t*.90;
  if(pine&&(j===5||j===12||j===18))continue;
  const spread=width*Math.pow(1-t,taper)*
    (.80+.14*Math.sin(j*2.76+variant*1.8)+.08*Math.sin(j*5.7));
  for(const angle of [0,Math.PI*.5]){
   const cs=Math.cos(angle),sn=Math.sin(angle);
   for(const side of [-1,1]){
    const length=spread*(.86+.14*Math.sin(j*2.3+side*.7));
    const drop=pine?-.032*(1-t):spruce?.054*(1-t):.020*(1-t);
    const x=cs*length*side,z=sn*length*side;
    tri([0,y+.012,0],[x*.38,y+.045,z*.38],[x,y-drop,z]);
    for(let m=0;m<3;m++){
     const u=.26+m*.22;
     const twigLen=(.050+.014*Math.sin(j*.87+m*2.3))*(1-t);
     const qx=x*u,qz=z*u;
     tri([qx-sn*side*twigLen,y+.019,qz+cs*side*twigLen],
       [qx+sn*side*twigLen,y+.036*(1-t),qz-cs*side*twigLen],
       [x*(u+.20),y-drop*u,z*(u+.20)]);
     if(!pine||m===1)
       tri([qx,y-.025*(1-t),qz],
         [x*(u+.22),y-drop*u,z*(u+.22)],
         [qx+cs*.048*side*(1-t),y+.038*(1-t),qz+sn*.048*side*(1-t)]);
    }
   }
  }
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geometry.setIndex(indices);
 geometry.computeVertexNormals();
 return geometry;
}
function makeForest(THREE,scene,mobile){
 const random=(()=>{
   let seed=202611111;
   return()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 })();
 const trees=[],colors=[];
 const push=(x,y,z,size,color)=>{
   trees.push([x,y,z,size,.94+random()*.56,.79+random()*.35,random()*6.283]);
   colors.push(color);
 };
 const palette=['#718fb1','#627c9d','#4f7299','#416e9a',
   '#31648a','#235374','#153d63','#091f3c'];
 for(let i=0;i<LAYERS.length;i++){
   const l=LAYERS[i];
   const count=mobile?35+i*5:65+i*15;
   for(let k=0;k<count;k++){
     const side=k%2===0?-1:1;
     const gap=i<2?8.0:i<5?6.2:8.1;
     const x=side*(gap+Math.pow(random(),.76)*34);
     const y=crest(x,l)-.14;
     const size=(1.20+i*.45)+random()*(.64+i*.31);
     push(x,y,l.z+1.50,size,palette[i]);
   }
 }
 // Vegetation also grows down the V slopes: tree lines have depth and
 // break up the uniform triangular hill shapes, while the valley stays open.
 for(let i=2;i<LAYERS.length;i++){
   const l=LAYERS[i];
   const count=mobile?24+i*2:49+i*9;
   for(let k=0;k<count;k++){
     const side=k%2===0?-1:1;
     const x=side*(4.0+Math.pow(random(),.65)*24);
     const y=crest(x,l)-(1.0+random()*3.65);
     const size=(1.25+i*.39)*(.57+random()*.73);
     push(x,y,l.z+2.5+random()*2.7,size,palette[i]);
   }
 }
 // Close trees rise well above the hills to frame the sky as in the
 // reference. They do not intrude on the central visitor/photo clearing.
 const framing=mobile?
   [[-10.5,15,10.1],[-8.5,27,7.3],[10.4,16,10.0],[8.7,28,7.3]]:
   [[-25,12,17.5],[-22,24,12.5],[-18.1,35,9.7],[-13.8,17,7.2],
    [25,12,17.1],[22,25,12.6],[18.4,35,9.7],[14.1,18,6.9]];
 for(const [x,z,size] of framing)push(x,-6.6,z,size,'#081629');
 const uniforms={uTime:{value:0},uWind:{value:0},uDay:{value:0},
   uTwilight:{value:0},uStorm:{value:0},uShadow:{value:0},
   uLightDir:{value:new THREE.Vector3(.1,.7,1).normalize()},
   uLightColor:{value:new THREE.Vector3(1,1,1)},
   uParallax:{value:new THREE.Vector2()}};
 const actor=new THREE.Object3D(),shade=new THREE.Color();
 const pools=[[],[],[]];
 for(let i=0;i<trees.length;i++){
   const variant=trees[i][2]>0?i%3:Math.floor(random()*3);
   pools[variant].push(i);
 }
 const meshes=[];
 for(let variant=0;variant<3;variant++){
   const geometry=firGeometry(THREE,variant,mobile);
   const material=new THREE.ShaderMaterial({
     uniforms,vertexShader:FIR_VS,fragmentShader:FIR_FS,
     side:THREE.DoubleSide,depthWrite:true
   });
   const mesh=new THREE.InstancedMesh(geometry,material,pools[variant].length);
   pools[variant].forEach((index,j)=>{
     const [x,y,z,h,w,d,angle]=trees[index];
     actor.position.set(x,y,z);actor.scale.set(h*w,h,h*d);
     actor.rotation.set(0,angle,0);actor.updateMatrix();
     mesh.setMatrixAt(j,actor.matrix);
     shade.set(colors[index]).multiplyScalar(.73+random()*.34);
     mesh.setColorAt(j,shade);
   });
   mesh.name=['Drooping forest spruce','Sparse alpine pine',
     'Broad branch mountain fir'][variant];
   mesh.frustumCulled=false;
   mesh.instanceMatrix.needsUpdate=true;
   if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
   scene.add(mesh);meshes.push(mesh);
 }
 return {meshes,u:uniforms,count:trees.length,species:3};
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
/**
 * Small sculpted overlook shelf with a real upward-facing surface and
 * biome colors. This receives analytically projected pine contact shadows;
 * distant mountains remain lightweight 2.5D parallax geometry.
 */
function makeOverlookSoil(THREE,scene){
 // One continuous near-camera hillside, not three overlapping foreground
 // mountain curtain meshes (those created the horizontal cut-off slabs).
 const geometry=new THREE.PlaneGeometry(294,190,104,54);
 geometry.rotateX(-Math.PI/2);
 const p=geometry.getAttribute('position');
 const rgb=new Float32Array(p.count*3);
 const centerColor=new THREE.Color('#324a4e');
 const edgeColor=new THREE.Color('#10242e');
 for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i);
   const edge=smooth(12,92,Math.abs(x));
   const level=overlookGroundHeight(x,z);
   // The back shoreline follows an eroded natural curve instead of
   // the straight rectangular rear edge of a PlaneGeometry.
   const farEdge=1.-smooth(-95,-79,z);
   const rearWarp=-4.5*Math.exp(-Math.pow(x/38,2))
     +4.5*edge+2.8*noise(x*.11,31)+1.1*noise(x*.38,43);
   p.setZ(i,z+farEdge*rearWarp);
   p.setY(i,level);
   const stone=centerColor.clone().lerp(edgeColor,edge*.58);
   const grain=noise(x*.23-z*.21,22)*.065+noise(x*.71+z*.44,37)*.021;
   stone.multiplyScalar(.93+grain);
   rgb[i*3]=stone.r;rgb[i*3+1]=stone.g;rgb[i*3+2]=stone.b;
 }
 p.needsUpdate=true;
 geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
 geometry.computeVertexNormals();
 const soilUniforms={uSoilWetness:{value:0}};
 const material=new THREE.MeshStandardMaterial({
   vertexColors:true,roughness:1,metalness:0,
   side:THREE.DoubleSide,transparent:true,depthWrite:false,
   emissive:'#16243a',emissiveIntensity:.45
 });
 // A gradual dirt-to-valley transition replaces the harsh rear straight
 // edge visible in screenshots. Alpha only changes over the distant 30m
 // of the real Three.js soil mesh; shadows remain a separate later pass.
 material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,soilUniforms);
   shader.vertexShader=shader.vertexShader.replace(
     '#include <common>',
     '#include <common>\nvarying float vSoilBlend;\nvarying vec2 vSoilXZ;');
   shader.vertexShader=shader.vertexShader.replace(
     '#include <begin_vertex>',
     '#include <begin_vertex>\nvSoilBlend=smoothstep(-95.,-62.,position.z);\nvSoilXZ=position.xz;');
   shader.fragmentShader=shader.fragmentShader.replace(
     '#include <common>',
     `#include <common>
     varying float vSoilBlend;
     varying vec2 vSoilXZ;
     uniform float uSoilWetness;
     float gSoilHash(vec2 p){
       return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);
     }
     float gSoilNoise(vec2 p){
       vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
       return mix(mix(gSoilHash(i),gSoilHash(i+vec2(1.,0.)),f.x),
         mix(gSoilHash(i+vec2(0.,1.)),gSoilHash(i+vec2(1.,1.)),f.x),f.y);
     }
     `);
   shader.fragmentShader=shader.fragmentShader.replace(
     '#include <color_fragment>',
     `#include <color_fragment>
     // Dirt, patches of lichen and hundreds of tiny static pebbles are part
     // of the terrain material. They are not individually spawned meshes.
     // Four scales of compacted soil stay fixed to the real terrain surface.
     // Preserve low spatial frequencies so the ground reads naturally at
     // both seated-player scale and distant photographic composition.
     float broad=gSoilNoise(vSoilXZ*.055);
     float fine=gSoilNoise(vSoilXZ*1.85);
     float rough=gSoilNoise(vSoilXZ*9.5);
     float clay=gSoilNoise(vSoilXZ*.31+vec2(12.6,-3.8));
     float soilTone=.76+.20*broad+.12*fine+.040*rough;
     vec3 soilHue=mix(vec3(.88,.92,.97),vec3(1.03,.99,.85),clay);
     diffuseColor.rgb*=soilTone*soilHue;
     // Lichen actually grows in uneven, eroded colonies. No separate
     // geometry, glowing circles, or repetitive oval patch sprites.
     float colony=gSoilNoise(vSoilXZ*.13+vec2(8.7,-2.5));
     float branch=gSoilNoise(vSoilXZ*.59+vec2(-3.1,5.4));
     float grain=gSoilNoise(vSoilXZ*2.45+vec2(6.2,1.8));
     float mossField=colony*.57+branch*.43;
     float moss=smoothstep(.54,.73,mossField)
       *(.24+.76*smoothstep(.31,.66,grain))
       *(.18+.70*smoothstep(7.,24.,abs(vSoilXZ.x)));
     vec3 mossPigment=mix(vec3(.44,.62,.55),vec3(.63,.74,.58),grain);
     diffuseColor.rgb=mix(diffuseColor.rgb,
       diffuseColor.rgb*mossPigment,moss*.72);
     vec2 cell=vSoilXZ*1.68;
     vec2 id=floor(cell);
     vec2 randomCenter=vec2(
       gSoilHash(id+vec2(4.0,1.0)),
       gSoilHash(id+vec2(7.0,9.0)));
     vec2 uv=(fract(cell)-(.23+.54*randomCenter));
     uv.x*=.92+.65*gSoilHash(id+vec2(3.0,5.0));
     uv.y*=1.25;
     float pebbleSeed=gSoilHash(id+vec2(11.0,23.0));
     float d=length(uv);
     float pebble=step(.82,pebbleSeed)*(1.-smoothstep(.095,.152,d));
     float pebbleShadow=step(.82,pebbleSeed)
       *(1.-smoothstep(.125,.205,length(uv-vec2(.026,-.036))));
     vec3 gravel=vec3(.54,.65,.79)
       *(.75+.50*gSoilHash(id+vec2(14.0,7.0)));
     diffuseColor.rgb=mix(diffuseColor.rgb,
       diffuseColor.rgb*.55,pebbleShadow*.18);
     diffuseColor.rgb=mix(diffuseColor.rgb,gravel,pebble*.57);
     // Rain darkens exposed clay and gives the material a slight sheen,
     // rather than adding an expensive transparent puddle mesh.
     diffuseColor.rgb*=mix(1.,.72,uSoilWetness);
     diffuseColor.a*=vSoilBlend;
     `);
   shader.fragmentShader=shader.fragmentShader.replace(
     '#include <roughnessmap_fragment>',
     '#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.54,uSoilWetness*.78);');
 };
 material.customProgramCacheKey=()=>'gongang-dirt-moss-pebbles-wet-v4';
 const mesh=new THREE.Mesh(geometry,material);
 mesh.name='3D shared sitting platform, soft earthen hillside';
 mesh.position.z=77;
 mesh.renderOrder=2;
 mesh.frustumCulled=false;
 scene.add(mesh);
 return {mesh,baseX:mesh.position.x,baseY:mesh.position.y,uniforms:soilUniforms};
}
let scene,camera,renderer,environment,ridges=[],forest,atmosphere,soil,shadows,meadow,vistaDetails;
let smoothView={x:0,y:0},lastParallaxFrame=null;
const soilNightColor=new THREE.Color('#183151');
const soilDayColor=new THREE.Color('#274943');
const soilDuskColor=new THREE.Color('#4e325b');
const requestedRenderer=new URLSearchParams(location.search).get('renderer');
const enabled=!['2d','painterly','3d','live3d'].includes(requestedRenderer);
const portrait=innerWidth<700&&innerHeight>innerWidth*1.2;
if(enabled)try{
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'low-power',
   preserveDrawingBuffer:true});
 if(!renderer.getContext())throw Error('WebGL unavailable');
 renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.16;
 scene=new THREE.Scene();
 scene.background=new THREE.Color('#020712');
 camera=new THREE.OrthographicCamera(-21,21,HALF_HEIGHT,-HALF_HEIGHT,.1,390);
 camera.position.set(0,7,39);camera.lookAt(0,1,-23);
 environment=createLivingEnvironment(THREE,scene,{camera,
   reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
 ridges=LAYERS.map(l=>makeMountain(THREE,scene,l,portrait));
 // The three older full-width foreground hill curtains were intersecting
 // each other and clipping the character's feet in every screenshot.
 // Keep the actual curved resting hillside as the single foreground layer.
 atmosphere=createAtmosphericDepth25D(THREE,scene);
 soil=makeOverlookSoil(THREE,scene);
 forest=makeForest(THREE,scene,portrait);
 shadows=createOverlookShadows25D(THREE,scene,{mobile:portrait});
 meadow=createMeadowEdge25D(THREE,scene,{mobile:portrait});
 vistaDetails=createVistaDetails25D(THREE,scene,{mobile:portrait});
 state.ridgeCount=ridges.length;state.treeCount=forest.count;
 state.ridgeSurfaceVertices=ridges.reduce((n,r)=>n+r.vertexCount,0);
 state.ridgeReliefDepths=ridges.map(r=>Number(r.reliefDepth.toFixed(2)));
 state.ridgeGeometry='coherent-carved-3d-mountain-heightfields';
 state.ridgeMaterial='carved-drainage-v2-and-moving-cloud-shadows';
 state.forestSpecies=forest.species;
 state.atmosphereLayers=atmosphere.count;
 state.shadowCasters=shadows.count;
 state.meadowPlants=meadow.count;
 state.rockCount=vistaDetails.rockCount;
 state.soilDetail='painted-dirt-lichen-pebbles';
 state.soilDetailVersion=4;
 state.soilWetnessEnabled=true;
 state.flowerCount=vistaDetails.flowerCount;
 state.weather=environment.state;
 state.ready=true;
}catch(error){
 state.failed=true;state.error=String(error?.stack||error);
 console.error('Living overlook initialization failed; retaining legacy view',error);
}
function draw(ctx,t,now,{personal=false,view=null}={}){
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
  const input=parallaxInput(view||{}, {width:w,height:h});
  // Damped like an actual scrolling game camera; speed independent of FPS.
  const nowMs=performance.now();
  const elapsed=lastParallaxFrame===null?1/60:clamp((nowMs-lastParallaxFrame)/1000,0,.1);
  lastParallaxFrame=nowMs;
  const ease=1-Math.exp(-elapsed*4.1);
  smoothView.x+=(input.x-smoothView.x)*ease;
  smoothView.y+=(input.y-smoothView.y)*ease;
  for(const ridge of ridges){
    const delta=parallaxShift(smoothView,ridge.layer.z);
    ridge.mesh.position.x=ridge.basePosition.x+delta.x;
    ridge.mesh.position.y=ridge.basePosition.y+delta.y;
  }
  atmosphere.applyParallax(smoothView);
  const groundShift=parallaxShift(smoothView,soil.mesh.position.z);
  soil.mesh.position.x=soil.baseX+groundShift.x;
  soil.mesh.position.y=soil.baseY+groundShift.y;
  const light=scenicLighting({
    ...env,sunrise:environment.state.sunrise,sunset:environment.state.sunset
  },environment.state.moonVisible);
  const lightDir=new THREE.Vector3(...light.direction);
  soil.mesh.material.emissive.copy(soilNightColor)
    .lerp(soilDayColor,env.daylight*.93)
    .lerp(soilDuskColor,env.twilight*.37);
  soil.mesh.material.emissiveIntensity=
    .42+env.daylight*.31+env.twilight*.21;
  soil.uniforms.uSoilWetness.value=clamp(env.rain*.94+env.snow*.22);
  state.lighting={
    daylight:light.daylight,shadowStrength:light.shadowStrength,
    azimuth:light.azimuth,sunElevation:light.sunElevation,
    shadowLength:light.shadowLength
  };
  state.parallax={...smoothView};
  state.nearShift=parallaxShift(smoothView,22).x;
  state.farShift=parallaxShift(smoothView,-143).x;
  shadows.update(light,smoothView,seconds,env.wind);
  meadow.update(seconds,env,smoothView,light);
  vistaDetails.update(seconds,env,smoothView);
  for(const ridge of ridges){
    ridge.u.uDay.value=env.daylight;
    ridge.u.uTwilight.value=env.twilight;
    ridge.u.uStorm.value=Math.max(env.rain,env.snow);
    ridge.u.uCloud.value=env.cloud;
    ridge.u.uTime.value=seconds;
    ridge.u.uWind.value=env.wind;
    ridge.u.uLightDir.value.copy(lightDir);
    ridge.u.uLightColor.value.set(...light.color);
    ridge.u.uSunAzimuth.value=light.azimuth;
    ridge.u.uSunElevation.value=light.sunElevation;
    ridge.u.uShadow.value=light.shadowStrength;
  }
  atmosphere.update(seconds,env);
  forest.u.uTime.value=seconds;
  forest.u.uWind.value=env.wind;
  forest.u.uDay.value=env.daylight;
  forest.u.uTwilight.value=env.twilight;
  forest.u.uStorm.value=Math.max(env.rain,env.snow);
  forest.u.uShadow.value=light.shadowStrength;
  forest.u.uLightDir.value.copy(lightDir);
  forest.u.uLightColor.value.set(...light.color);
  forest.u.uParallax.value.set(smoothView.x,smoothView.y);
  renderer.toneMappingExposure=1.16*light.exposure;
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
