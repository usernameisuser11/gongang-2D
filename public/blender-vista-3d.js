/* Gongang 2D — Blender-authored scene, rendered with the existing Three.js.
 * No photographed panorama or CSS-filtered still image. The original .blend
 * produces the .glb and remains the only source of the sculpt and vegetation.
 * Optional ?renderer=blender; existing WebSocket players/photos stay on Canvas.
 */
import * as THREE from '/vendor/three.module.js';
import { GLTFLoader } from '/vendor/GLTFLoader.js';

const state={
  ready:false,loading:true,failed:false,error:null,
  meshCount:0,triangles:0,frames:0,renderWidth:0,renderHeight:0,
  quality:'authored Blender geometry + realtime atmosphere'
};
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const portrait=innerWidth<700 && innerHeight>innerWidth*1.20;
const skyClock={value:0},skyDay={value:0},skyDusk={value:0},skyRain={value:0};
let renderer, scene, camera, root, sun, hemi, haze, stars, grassMaterials=[];
let weather={cloud:0.25,rain:0,wind:1,updated:0};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;

function rng(seed){
  return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function buildAtmosphere(){
  const sky=new THREE.Mesh(
    new THREE.SphereGeometry(320,32,20),
    new THREE.ShaderMaterial({
      side:THREE.BackSide,depthWrite:false,fog:false,
      uniforms:{uTime:skyClock,uDay:skyDay,uDusk:skyDusk,uRain:skyRain},
      vertexShader: "varying vec3 vRay;void main(){vRay=normalize(position);vec4 p=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_Position=p.xyww;}",
      fragmentShader: [
        "precision highp float;varying vec3 vRay;",
        "uniform float uTime,uDay,uDusk,uRain;",
        "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
        "float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
        "return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}",
        "float fbm(vec2 p){float v=0.,w=.50;for(int i=0;i<4;i++){v+=w*n2(p);p*=2.04;w*=.51;}return v;}",
        "void main(){vec3 d=normalize(vRay);float alt=clamp(d.y*.92+.26,0.,1.);",
        "vec3 night=mix(vec3(.09,.18,.30),vec3(.007,.018,.057),smoothstep(.06,.96,alt));",
        "vec3 daylight=mix(vec3(.54,.73,.79),vec3(.13,.37,.70),smoothstep(.06,1.,alt));",
        "vec3 rose=vec3(.82,.39,.46)*exp(-pow((alt-.08)*8.0,2.));",
        "vec3 col=mix(night,daylight,uDay)+rose*uDusk*.62;",
        "vec2 p=vec2(atan(d.z,d.x)*3.1+uTime*.004,d.y*7.8);",
        "float c=fbm(p*1.35+vec2(4.0,15.0))*.72+fbm(p*2.3)*.28;",
        "float band=smoothstep(.54,.77,c)*smoothstep(.02,.30,alt)*(1.-smoothstep(.72,1.0,alt));",
        "col=mix(col,mix(vec3(.30,.39,.59),vec3(.94,.87,.77),uDay),",
        "band*mix(.22,.50,uDay)*(1.-uRain*.35));",
        "float milky=fbm(vec2(atan(d.z,d.x)*7.,d.y*11.)+vec2(10.,-4.));",
        "milky=pow(max(0.,milky-.38),2.4)*2.1*smoothstep(.0,.45,alt);",
        "col+=vec3(.19,.18,.29)*milky*(1.-uDay)*.32;",
        "gl_FragColor=vec4(col,1.);}"
      ].join('\n')
    })
  );
  sky.frustumCulled=false;
  sky.renderOrder=-100;
  scene.add(sky);
  const random=rng(7719),points=[],brightness=[];
  for(let i=0;i<3800;i++){
    const theta=random()*Math.PI*2;
    const elev=.02+random()*.96;
    const rad=Math.sqrt(Math.max(0,1-elev*elev));
    points.push(Math.cos(theta)*rad*295,elev*295,Math.sin(theta)*rad*295);
    brightness.push(.2+Math.pow(random(),6)*.8);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
  geometry.setAttribute('aBright',new THREE.Float32BufferAttribute(brightness,1));
  stars=new THREE.Points(geometry,new THREE.ShaderMaterial({
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    uniforms:{uDay:skyDay,uTime:skyClock},
    vertexShader:"attribute float aBright;varying float vBright;void main(){vBright=aBright;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=1.3+aBright*1.8;}",
    fragmentShader:"precision mediump float;uniform float uDay,uTime;varying float vBright;void main(){float r=length(gl_PointCoord-.5);float a=pow(max(0.,1.-r*2.),1.7)*vBright*(1.-uDay)*(.88+.12*sin(uTime+vBright*52.));gl_FragColor=vec4(.78,.88,1.,a);}"
  }));
  stars.frustumCulled=false;
  stars.renderOrder=-99;
  scene.add(stars);
}
function hourInSeoul(time){
  // QA override only. Ordinary visitors always see the actual Seoul time.
  const forced=new URLSearchParams(location.search).get('time');
  if(/^([01]\d|2[0-3]):[0-5]\d$/.test(forced||'')){
    const [h,m]=forced.split(':').map(Number);
    return h+m/60;
  }
  const parts=new Intl.DateTimeFormat('en-GB',{
    timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
  }).formatToParts(new Date(time));
  const h=Number(parts.find(p=>p.type==='hour')?.value||0);
  const m=Number(parts.find(p=>p.type==='minute')?.value||0);
  return h+m/60;
}
function updateLight(now){
  const hour=hourInSeoul(now);
  const altitude=Math.sin((hour-6.2)/12.0*Math.PI);
  const daylight=smooth(-.12,.28,altitude);
  const dusk=(1-smooth(.06,.48,Math.abs(altitude)))*(hour>11?1:.66);
  skyDay.value=daylight;
  skyDusk.value=dusk;
  skyClock.value=now*.001;
  skyRain.value=weather.rain;
  const night=1-daylight;
  const sunny=new THREE.Color('#fff5d5'),moon=new THREE.Color('#a1bfff');
  sun.color.copy(moon).lerp(sunny,daylight);
  sun.intensity=mix(1.0,2.4,daylight)*(1-weather.cloud*.36);
  const a=(hour/24)*Math.PI*2;
  sun.position.set(70*Math.cos(a),30+70*Math.max(.12,Math.abs(altitude)),45*Math.sin(a));
  hemi.color.set('#e6f1ff').lerp(new THREE.Color('#ffe7d4'),daylight*.72);
  hemi.groundColor.set('#102b32').lerp(new THREE.Color('#567263'),daylight*.8);
  hemi.intensity=mix(1.6,2.25,daylight);
  haze.color.set('#152c47').lerp(new THREE.Color('#a4bbc5'),daylight*.83);
  haze.density=.0042+weather.cloud*.0018+weather.rain*.0015;
  root?.traverse(o=>{
    if(o.isMesh && o.material){
      const mats=Array.isArray(o.material)?o.material:[o.material];
      for(const mat of mats){
        if(mat.userData?._dynamicGongang) continue;
        mat.userData._dynamicGongang=true;
        // Keep authored roughness and colors: physical lights change by time.
        mat.side=THREE.DoubleSide;
      }
    }
  });
}
async function getWeather(){
  if(Date.now()-weather.updated<15*60*1000)return;
  weather.updated=Date.now();
  try{
    const url='https://api.open-meteo.com/v1/forecast?latitude=37.57&longitude=126.98&current=cloud_cover,rain,snowfall,wind_speed_10m&timezone=Asia%2FSeoul';
    const response=await fetch(url,{signal:AbortSignal.timeout(3500)});
    if(!response.ok)return;
    const d=(await response.json()).current||{};
    weather.cloud=clamp((d.cloud_cover||0)/100,0,1);
    weather.rain=clamp(((d.rain||0)+(d.snowfall||0))/.5,0,1);
    weather.wind=clamp((d.wind_speed_10m||0)/7,0,3);
  }catch{/* Local default atmosphere remains usable offline. */}
}
function instanceRepeatedForest(group){
  // Blender's linked objects share the same geometry in glTF. Turn the
  // imported instances into a handful of GPU draw calls on portrait phones.
  group.updateMatrixWorld(true);
  const buckets=new Map();
  group.traverse(node=>{
    if(!node.isMesh||!node.geometry||!node.material)return;
    // Only the botanicals reuse the same geometry many times; terrain,
    // grass and river have unique geometry and are left in place.
    // Avoid matching Blender object names, which glTF may sanitize.
    const mats=Array.isArray(node.material)?node.material:[node.material];
    const key=node.geometry.uuid+'/'+mats.map(m=>m.uuid).join(',');
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push(node);
  });
  let merged=0,instances=0;
  for(const nodes of buckets.values()){
    if(nodes.length<2)continue;
    const original=nodes[0];
    const gpu=new THREE.InstancedMesh(original.geometry,original.material,nodes.length);
    gpu.name='Blender forest | GPU instanced '+original.name;
    gpu.frustumCulled=false;
    gpu.castShadow=false;gpu.receiveShadow=false;
    const matrix=new THREE.Matrix4();
    nodes.forEach((node,i)=>{
      node.updateWorldMatrix(true,false);
      matrix.copy(node.matrixWorld);
      gpu.setMatrixAt(i,matrix);
    });
    gpu.instanceMatrix.needsUpdate=true;
    for(const node of nodes)node.parent?.remove(node);
    scene.add(gpu);
    merged++;
    instances+=nodes.length;
  }
  state.forestInstancedDraws=merged;
  state.forestInstances=instances;
}
async function prepare(){
  try{
    if(!document.createElement('canvas').getContext('webgl2'))throw Error('WebGL2 unsupported');
    renderer=new THREE.WebGLRenderer({
      alpha:false,antialias:true,preserveDrawingBuffer:true,
      powerPreference:'high-performance'
    });
    renderer.setPixelRatio(1);
    renderer.setClearColor('#09152a');
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.24;
    scene=new THREE.Scene();
    haze=new THREE.FogExp2('#294b5e',.005);
    scene.fog=haze;
    camera=new THREE.OrthographicCamera(-25,25,27.5,-27.5,.1,550);
    camera.position.set(0,13,-42);
    camera.lookAt(0,5.5,65);
    hemi=new THREE.HemisphereLight('#e3edff','#244c45',1.7);
    scene.add(hemi);
    sun=new THREE.DirectionalLight('#c7d8ff',1.5);
    sun.position.set(-40,60,30);
    // Mobile can keep high quality normals without a costly dynamic shadowmap.
    renderer.shadowMap.enabled=false;
    scene.add(sun);
    buildAtmosphere();
    const gltf=await new GLTFLoader().loadAsync('/assets/models/blender-cinematic-valley.glb');
    root=gltf.scene;
    root.name='Gongang | Blender sculpt / original geometric assets';
    root.traverse(o=>{
      if(!o.isMesh)return;
      state.meshCount++;
      const positions=o.geometry?.getAttribute('position');
      const index=o.geometry?.getIndex();
      state.triangles+=(index?index.count:positions?.count||0)/3;
      o.frustumCulled=true;
      o.castShadow=false;o.receiveShadow=false;
    });
    scene.add(root);
    instanceRepeatedForest(root);
    state.ready=true;
    state.loading=false;
    await getWeather();
  }catch(error){
    state.failed=true;state.loading=false;
    state.error=String(error?.message||error);
    renderer?.dispose();
    console.warn('Gongang Blender scene unavailable; painterly fallback remains:',state.error);
  }
}
function draw(ctx,t,now,{personal=false,scroll=0}={}){
  if(!state.ready||!root)return false;
  try{
    const factor=portrait?.83:.90;
    const w=Math.max(256,Math.min(portrait?900:1360,Math.round(t.width*factor)));
    const h=Math.max(256,Math.min(portrait?1220:900,Math.round(t.height*factor)));
    if(w!==state.renderWidth||h!==state.renderHeight){
      renderer.setSize(w,h,false);
      state.renderWidth=w;state.renderHeight=h;
    }
    const aspect=w/h;
    const worldHeight=personal?46:55;
    camera.left=-worldHeight*aspect/2;
    camera.right=worldHeight*aspect/2;
    camera.top=worldHeight/2;
    camera.bottom=-worldHeight/2;
    camera.updateProjectionMatrix();
    const horizontal=portrait?-4.8:0;
    const drift=clamp(scroll,-1,1)*(personal?3.2:2.1);
    camera.position.set(horizontal+drift,personal?17:13,-42);
    camera.lookAt(horizontal+drift*.30,personal?9:5.5,65);
    skyClock.value=now*.001;
    if((state.frames%30)===0){updateLight(now);getWeather();}
    if(!reduced){
      // Only the sky and clouds are moved: real trees stay rooted in 3D soil.
      stars.rotation.y=Math.sin(now*.000005)*.011;
    }
    renderer.render(scene,camera);
    ctx.drawImage(renderer.domElement,t.x,t.y,t.width,t.height);
    state.frames++;
    return true;
  }catch(error){
    state.failed=true;state.ready=false;
    state.error=String(error?.message||error);
    console.warn('Gongang Blender draw failed; using previous scenery:',state.error);
    return false;
  }
}
window.GongangBlenderVista={state,draw};
prepare();
