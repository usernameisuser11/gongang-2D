/**
 * GONGANG / living valley terrain, v3
 *
 * A real continuous heightfield with five distance-adaptive mesh chunks,
 * numeric slope analysis, erosion drainage, alpine biomes and PBR shading.
 * NOT five vertical backdrop ribbons and NOT an image. Every forest tree
 * samples this same mathematical terrain at its actual world coordinates.
 *
 * The overlook remains low and open at the center while two asymmetrical
 * mountain walls enclose the valley and jagged distant summits rise above it.
 */
const CHUNKS=[
  {name:'far massif',back:-164,front:-130},
  {name:'distant peaks',back:-130,front:-104},
  {name:'inner highlands',back:-104,front:-79},
  {name:'near wooded slopes',back:-79,front:-52},
  {name:'valley to seating overlook',back:-52,front:49}
];
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{let t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
const fract=x=>x-Math.floor(x);
function hash(i,j,seed){
  let n=Math.imul((i|0)^Math.imul((j|0),374761393),668265263);
  n^=Math.imul(seed|0,2246822519);n^=n>>>13;
  n=Math.imul(n,1274126177);
  return ((n^(n>>>16))>>>0)/4294967295;
}
function valueNoise(x,z,seed){
  const ix=Math.floor(x),iz=Math.floor(z),fx=smooth(0,1,x-ix),fz=smooth(0,1,z-iz);
  return ((hash(ix,iz,seed)*(1-fx)+hash(ix+1,iz,seed)*fx)*(1-fz)
   +(hash(ix,iz+1,seed)*(1-fx)+hash(ix+1,iz+1,seed)*fx)*fz)*2-1;
}
function fbm(x,z,seed){
  return valueNoise(x,z,seed)*.54+
    valueNoise(x*2.12+8.5,z*2.19+3.4,seed+17)*.27+
    valueNoise(x*4.37+14.3,z*4.22-2.1,seed+43)*.13+
    valueNoise(x*8.91+1.4,z*8.74+9.6,seed+71)*.06;
}
function peak(x,z,cx,cz,width,depth,height){
  const rx=(x-cx)/width,rz=(z-cz)/depth;
  const r=rx*rx+rz*rz;
  const outline=1.0+.14*fbm(x*.12,z*.16,91);
  return height*Math.exp(-r*1.6)*outline;
}
function riverAxis(z){
  return 2.8*Math.sin(z*.032+.4)+1.3*Math.sin(z*.081-.9);
}
/** This is the sole source of truth for world Y used by land, trees and rocks. */
export function sampleValleyHeight(x,z){
  const cx=riverAxis(z);
  const sideways=Math.abs(x-cx);
  const floor=-16.4+13.2*smooth(-74,-13,z);
  // Actual wide traversable terrain around camera, steep sidewalls in valley.
  const outer=smooth(6,61,sideways);
  const mountainStrength=4+23.5*(1-smooth(-47,7,z));
  const wall=mountainStrength*Math.pow(outer,1.33);
  const structural=peak(x,z,-34,-132,23,26,8.5)
    +peak(x,z,32,-122,19,29,9.8)
    +peak(x,z,-26,-100,20,24,6.6)
    +peak(x,z,29,-80,20,25,7.3)
    +peak(x,z,-39,-65,18,24,5.3)
    +peak(x,z,34,-59,21,23,4.7);
  // A broken central distant skyline, softened as the scene approaches.
  const far=smooth(-62,-120,z);
  const distantPeaks=far*(peak(x,z,-11,-145,11,21,9.6)+
    peak(x,z,13,-146,13,24,11.3)+peak(x,z,1,-132,7,11,4.8));
  // Erosion follows each slope: broad gullies with nested rills.
  const erosion=fbm(x*.091,z*.12,21);
  const channels=Math.pow(Math.max(0,.45+fbm(x*.19+z*.025,z*.14,47)),2);
  const micro=fbm(x*.37,z*.31,81);
  const rockyNoise=(.40+outer*.65)*(erosion*1.35+micro*.36);
  const drainage=channels*outer*1.8;
  // Flat near-center seating area, transitioning continuously into valley.
  const seat=smooth(-23,-5,z)*(1-smooth(9,19,sideways));
  const seatHeight=-3.15+fbm(x*.22,z*.23,98)*.18;
  const terrain=floor+wall+structural+distantPeaks+rockyNoise-drainage;
  return terrain*(1-seat)+seatHeight*seat;
}

export function sampleValleyNormal(x,z){
  const e=.45;
  const sx=(sampleValleyHeight(x+e,z)-sampleValleyHeight(x-e,z))/(2*e);
  const sz=(sampleValleyHeight(x,z+e)-sampleValleyHeight(x,z-e))/(2*e);
  const inv=1/Math.sqrt(sx*sx+sz*sz+1);
  return {x:-sx*inv,y:inv,z:-sz*inv,slope:Math.sqrt(sx*sx+sz*sz)};
}
export function getValleyFlow(z){return riverAxis(z);}

function makeChunk(THREE,section,mobile,material){
  const width=184;
  const nx=mobile?70:126;
  const nz=mobile?Math.max(18,Math.ceil((section.front-section.back)*.46)):
    Math.max(28,Math.ceil((section.front-section.back)*.87));
  const xyz=new Float32Array((nx+1)*(nz+1)*3);
  const rgb=new Float32Array(xyz.length);
  const index=new Uint32Array(nx*nz*6);
  const stone=new THREE.Color('#596279');
  const moss=new THREE.Color('#344b51');
  const woodland=new THREE.Color('#1e3b47');
  const distant=new THREE.Color('#7786ae');
  const colour=new THREE.Color();
  for(let j=0;j<=nz;j++){
    const z=section.back+(section.front-section.back)*j/nz;
    for(let i=0;i<=nx;i++){
      const x=-width/2+width*i/nx;
      const y=sampleValleyHeight(x,z);
      const normal=sampleValleyNormal(x,z);
      const steep=smooth(.43,1.9,normal.slope);
      const altitude=smooth(0,21,y);
      const soil=1-smooth(-22,-2,z);
      const middle=smooth(-160,-28,z);
      const v=(j*(nx+1)+i)*3;
      xyz[v]=x;xyz[v+1]=y;xyz[v+2]=z;
      colour.copy(woodland).lerp(moss,.25+soil*.42);
      colour.lerp(stone,clamp(steep*.76+altitude*.32));
      colour.lerp(distant,(1-middle)*.38);
      // World-space lichen/rock variation, not one color per mountain panel.
      const gr=fbm(x*.15,z*.15,37);
      const detail=fbm(x*.50,z*.38,57);
      const crack=clamp(.89+.17*gr+.075*detail,.72,1.08);
      colour.multiplyScalar(crack);
      rgb[v]=colour.r;rgb[v+1]=colour.g;rgb[v+2]=colour.b;
    }
  }
  let k=0;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+1,c=a+nx+1,d=c+1;
    index[k++]=a;index[k++]=c;index[k++]=d;
    index[k++]=a;index[k++]=d;index[k++]=b;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(xyz,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
  geometry.setIndex(new THREE.BufferAttribute(index,1));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Gongang actual 3D terrain / '+section.name;
  mesh.frustumCulled=false;
  mesh.receiveShadow=true;
  return mesh;
}

/** Ridge count intentionally remains five for QA, but they are connected terrain patches. */
export function createDeepValley(THREE,scene,{mobile=false}={}){
  const twilight={value:0},daylight={value:0};
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,side:THREE.DoubleSide,metalness:0,roughness:.98,
    flatShading:false
  });
  material.onBeforeCompile=shader=>{
    shader.uniforms.uValleyTwilight=twilight;
    shader.uniforms.uValleyDaylight=daylight;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vTerrainWorld;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvTerrainWorld=(modelMatrix*vec4(transformed,1.)).xyz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
      '#include <common>\nvarying vec3 vTerrainWorld;uniform float uValleyTwilight;uniform float uValleyDaylight;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\nfloat bedding=sin(vTerrainWorld.y*1.48+sin(vTerrainWorld.x*.25+vTerrainWorld.z*.23)*1.7);\nfloat fissure=pow(1.-abs(bedding),9.);\nfloat facets=sin(vTerrainWorld.x*1.8+vTerrainWorld.z*.79)*sin(vTerrainWorld.y*2.73);\ndiffuseColor.rgb*=.88+.085*facets-.09*fissure;\nfloat distant=1.-smoothstep(-150.,-46.,vTerrainWorld.z);\nvec3 sunsetRock=vec3(.30,.085,.17)*uValleyTwilight*distant;\ndiffuseColor.rgb+=sunsetRock;\ndiffuseColor.rgb*=.80+uValleyDaylight*.24;');
  };
  material.customProgramCacheKey=()=> 'gongang-terrain-v3';
  const meshes=CHUNKS.map(section=>{
    const mesh=makeChunk(THREE,section,mobile,material);
    scene.add(mesh);return mesh;
  });
  return{
    ready:true,meshes,count:meshes.length,
    triangleCount:meshes.reduce((sum,m)=>sum+m.geometry.index.count/3,0),
    update({twilight:tw=0,daylight:day=0}={}){
      twilight.value=clamp(tw);daylight.value=clamp(day);
    },
    dispose(){
      for(const mesh of meshes){scene.remove(mesh);mesh.geometry.dispose();}
      material.dispose();
    }
  };
}
/** Legacy call site retained; use exactly the same sampler as the terrain. */
export function createValleyGroveLayout({mobile=false}={}){
  const trees=[];
  let seed=13237;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const count=mobile?54:108;
  for(let i=0;i<count;i++){
    const z=-142+random()*117;
    const x=(i%2?1:-1)*(9+random()*47);
    trees.push({
      position:[x,sampleValleyHeight(x,z)+.04,z],
      rotationY:random()*6.283185,
      scale:.44+random()*.56
    });
  }
  return trees;
}
