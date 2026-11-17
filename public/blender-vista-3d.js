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
let renderer, scene, camera, root, sun, hemi, haze, stars, moon, moonGlow, fireflies;
const windClock={value:0},windPower={value:0};
const cloudiness={value:.25};
let weather={cloud:0.25,rain:0,wind:1,updated:0};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
const mix=(a,b,t)=>a+(b-a)*t;

function rng(seed){
  return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
}
function paintMoonTexture(halo=false){
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=256;
  const ctx=canvas.getContext('2d');
  const center=128,radius=halo?127:112;
  const gradient=ctx.createRadialGradient(
    halo?128:113,halo?128:107,halo?0:12,128,128,radius);
  if(halo){
    gradient.addColorStop(0,'rgba(255,245,219,.32)');
    gradient.addColorStop(.13,'rgba(243,226,229,.16)');
    gradient.addColorStop(.4,'rgba(159,179,229,.048)');
    gradient.addColorStop(1,'rgba(120,162,219,0)');
  }else{
    gradient.addColorStop(0,'rgba(255,251,233,1)');
    gradient.addColorStop(.75,'rgba(240,241,231,1)');
    gradient.addColorStop(.92,'rgba(218,232,239,.94)');
    gradient.addColorStop(1,'rgba(208,227,241,0)');
  }
  ctx.fillStyle=gradient;
  ctx.fillRect(0,0,256,256);
  if(!halo){
    const random=rng(1945);
    for(let i=0;i<65;i++){
      const a=random()*Math.PI*2,d=Math.sqrt(random())*.68;
      const x=128+Math.cos(a)*d*94,y=128+Math.sin(a)*d*94;
      const size=1.3+random()*6.4;
      ctx.fillStyle=i%4===0?'rgba(77,100,123,.09)':'rgba(119,135,147,.055)';
      ctx.beginPath();ctx.ellipse(x,y,size,size*(.42+random()),a,0,Math.PI*2);ctx.fill();
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
function buildMoon(){
  const glowTexture=paintMoonTexture(true);
  moonGlow=new THREE.Sprite(new THREE.SpriteMaterial({
    map:glowTexture,transparent:true,depthWrite:false,depthTest:false,
    blending:THREE.AdditiveBlending,fog:false
  }));
  moonGlow.scale.set(45,45,1);
  moonGlow.renderOrder=-2;
  scene.add(moonGlow);
  moon=new THREE.Sprite(new THREE.SpriteMaterial({
    map:paintMoonTexture(false),transparent:true,depthWrite:false,
    depthTest:false,fog:false
  }));
  moon.scale.set(4.1,4.1,1);
  moon.renderOrder=-1;
  scene.add(moon);
  state.moonReady=true;
}
function buildValleyMist(){
  const layers=[
    {z:25,y:2,width:110,height:19,alpha:.095,phase:.3},
    {z:79,y:8,width:165,height:27,alpha:.15,phase:1.4},
    {z:144,y:13,width:210,height:32,alpha:.18,phase:2.6}
  ];
  state.mistLayers=layers.length;
  for(const layer of layers){
    const uniforms={
      uTime:skyClock,uDay:skyDay,uDusk:skyDusk,
      uCloud:cloudiness,
      uOpacity:{value:layer.alpha},uPhase:{value:layer.phase}
    };
    const mat=new THREE.ShaderMaterial({
      uniforms,transparent:true,depthWrite:false,depthTest:true,
      side:THREE.DoubleSide,
      vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:[
        "precision mediump float;varying vec2 vUv;",
        "uniform float uTime,uDay,uDusk,uCloud,uOpacity,uPhase;",
        "float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}",
        "float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);",
        "return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}",
        "void main(){vec2 p=vUv*vec2(6.2,3.0)+vec2(uPhase,uPhase*.7);",
        "float n=noise(p+vec2(uTime*.008,0.));n=.60*n+.40*noise(p*2.15-vec2(uTime*.014,0.));",
        "float wave=.56+.20*sin(vUv.x*9.+uPhase)+.09*cos(vUv.x*21.+uPhase);",
        "float height=(vUv.y-wave);",
        "float band=exp(-height*height*29.)*(.43+.57*n);",
        "float fade=smoothstep(0.,.17,vUv.x)*(1.-smoothstep(.83,1.,vUv.x));",
        "fade*=smoothstep(.05,.25,vUv.y)*(1.-smoothstep(.84,1.,vUv.y));",
        "vec3 color=mix(vec3(.24,.38,.49),vec3(.72,.80,.82),uDay);",
        "color=mix(color,vec3(.74,.56,.69),uDusk*.26);",
        "float a=band*fade*uOpacity*(.80+uCloud*.28);",
        "gl_FragColor=vec4(color,a);}"
      ].join('\n')
    });
    const plane=new THREE.Mesh(new THREE.PlaneGeometry(layer.width,layer.height),mat);
    plane.position.set(0,layer.y,layer.z);
    plane.frustumCulled=false;
    plane.renderOrder=1;
    scene.add(plane);
  }
}
function buildFireflies(){
  const random=rng(2517),verts=[],phase=[];
  for(let i=0;i<125;i++){
    const x=(random()-.5)*86,z=-32+random()*60;
    verts.push(x,-3.1+random()*3.0,z);
    phase.push(random()*Math.PI*2);
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  geo.setAttribute('aPhase',new THREE.Float32BufferAttribute(phase,1));
  fireflies=new THREE.Points(geo,new THREE.ShaderMaterial({
    uniforms:{uTime:skyClock,uDay:skyDay},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:[
      "attribute float aPhase;uniform float uTime;varying float vA;",
      "void main(){vA=aPhase;vec3 p=position;",
      "p.x+=sin(uTime*.37+aPhase*3.)*.17;p.y+=sin(uTime*.52+aPhase)*.10;",
      "gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);",
      "gl_PointSize=1.6+2.2*pow(.5+.5*sin(uTime*.9+aPhase*8.),3.);}"
    ].join('\n'),
    fragmentShader:[
      "precision highp float;uniform float uTime,uDay;varying float vA;",
      "void main(){float r=length(gl_PointCoord-.5);",
      "float halo=pow(max(0.,1.-r*2.),2.8);",
      "float glow=(.35+.65*pow(.5+.5*sin(uTime*.84+vA*7.),2.));",
      "gl_FragColor=vec4(.78,.91,.74,halo*glow*(1.-uDay)*.42);}"
    ].join('\n')
  }));
  fireflies.frustumCulled=false;
  scene.add(fireflies);
  state.fireflyCount=verts.length/3;
}
function applyBotanicalWind(){
  const visited=new Set();
  let count=0;
  scene.traverse(o=>{
    if(!o.isMesh||!o.material)return;
    const mats=Array.isArray(o.material)?o.material:[o.material];
    for(const mat of mats){
      if(visited.has(mat))continue;
      visited.add(mat);
      if(/Conifer needles|Broadleaf velvet|Wildflower petals|Grass blade/i.test(mat.name)){
        mat.side=THREE.DoubleSide;
      }
      if(!/Conifer needles|Broadleaf velvet/i.test(mat.name))continue;
      mat.onBeforeCompile=shader=>{
        shader.uniforms.gongangWindTime=windClock;
        shader.uniforms.gongangWindPower=windPower;
        shader.vertexShader=shader.vertexShader.replace(
          '#include <common>',
          '#include <common>\nuniform float gongangWindTime;\nuniform float gongangWindPower;');
        shader.vertexShader=shader.vertexShader.replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\n'+
          'float gw= smoothstep(.65,6.8,position.y);'+
          'float gp=position.x*.28+position.z*.34;\n'+
          '#ifdef USE_INSTANCING\n'+
          'gp+=instanceMatrix[3].x*.092+instanceMatrix[3].z*.064;\n'+
          '#endif\n'+
          'transformed.x+=sin(gongangWindTime*.73+gp+position.y*.27)*.13*gw*gongangWindPower;'+
          'transformed.z+=cos(gongangWindTime*.56+gp*1.31)*.067*gw*gongangWindPower;');
      };
      mat.customProgramCacheKey=()=> 'gongang-leaf-wind-v2';
      mat.needsUpdate=true;
      count++;
    }
  });
  state.windMaterials=count;
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
        "vec2 gal=vec2(atan(d.z,d.x)*1.5,d.y);",
        "float bend=gal.x*.33+gal.y-.12+.065*sin(gal.x*3.7);",
        "bend+=(fbm(gal*9.1+vec2(3.,11.))-.47)*.16;",
        "float core=exp(-pow(bend*5.4,2.));",
        "float grain=fbm(gal*21.2+vec2(71.,12.));",
        "float bands=.4+.6*smoothstep(.24,.75,grain);",
        "float dust=exp(-pow((bend+.065)*24.,2.))*smoothstep(.38,.67,fbm(gal*35.+vec2(8.,19.)));",
        "float galactic=core*bands*(1.-dust*.82)*smoothstep(.06,.38,alt);",
        "col+=mix(vec3(.10,.17,.30),vec3(.38,.28,.43),grain)*galactic*(1.-uDay)*.87;",
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
  buildMoon();
  buildValleyMist();
  buildFireflies();
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
  cloudiness.value=weather.cloud;
  const night=1-daylight;
  if(moon&&moonGlow){
    const lunarArc=((hour-18.2)/12)*Math.PI;
    const moonPos=new THREE.Vector3(
      70*Math.cos(lunarArc),23+29*Math.max(0,Math.sin(lunarArc)),235);
    moon.position.copy(moonPos);
    moonGlow.position.copy(moonPos);
    const opacity=night*(1-weather.cloud*.63);
    moon.material.opacity=opacity;
    moonGlow.material.opacity=opacity;
  }
  const sunny=new THREE.Color('#fff5d5'),moonlightColor=new THREE.Color('#a1bfff');
  sun.color.copy(moonlightColor).lerp(sunny,daylight);
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
    applyBotanicalWind();
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
    const worldHeight=personal?46:(portrait?61:55);
    camera.left=-worldHeight*aspect/2;
    camera.right=worldHeight*aspect/2;
    camera.top=worldHeight/2;
    camera.bottom=-worldHeight/2;
    camera.updateProjectionMatrix();
    const horizontal=portrait?-4.8:0;
    const drift=clamp(scroll,-1,1)*(personal?3.2:2.1);
    camera.position.set(horizontal+drift,personal?17:(portrait?15:13),-42);
    camera.lookAt(horizontal+drift*.30,personal?9:(portrait?10.5:5.5),65);
    skyClock.value=now*.001;
    windClock.value=now*.001;
    windPower.value=reduced?0:clamp(.30+weather.wind*.30,.24,1.1);
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
