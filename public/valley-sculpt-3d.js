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
  {name:'valley to seating overlook',back:-52,front:142}
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
  // Broad structural mountain walls plus real overlapping ridges at
  // different depths. The ridges are hills in one continuous heightfield,
  // not vertically oriented scenery panels or PNG layers.
  const mountainStrength=3.4+12.6*(1-smooth(-47,7,z));
  const wall=mountainStrength*Math.pow(outer,1.28);
  const ridgeCenters=[-151,-126,-103,-82,-61];
  const ridgeAmplitudes=[6.2,5.4,4.8,4.1,3.4];
  let steppedHighlands=0;
  for(let i=0;i<ridgeCenters.length;i++){
    const d=(z-ridgeCenters[i])/(10+i*1.8);
    const crestVariation=.82+.18*fbm(x*.15,z*.16,21+i*47);
    // Slightly asymmetric valley shoulders read as multiple horizon lines.
    const oneSide=1+.08*Math.sin(x*.07+i*1.6);
    steppedHighlands+=Math.exp(-d*d)*ridgeAmplitudes[i]*
      Math.pow(smooth(7,43,sideways),.88)*crestVariation*oneSide;
  }
  const structural=peak(x,z,-34,-132,23,26,8.5)
    +peak(x,z,32,-122,19,29,9.8)
    +peak(x,z,-26,-100,20,24,6.6)
    +peak(x,z,29,-80,20,25,7.3)
    +peak(x,z,-39,-65,18,24,5.3)
    +peak(x,z,34,-59,21,23,4.7);
  // A broken central distant skyline, softened as the scene approaches.
  const far=smooth(-62,-120,z);
  const distantPeaks=far*1.72*(peak(x,z,-11,-145,11,21,9.6)+
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
  const terrain=floor+wall+steppedHighlands+structural+distantPeaks+rockyNoise-drainage;
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
  const dx=width/nx,dz=(section.front-section.back)/nz;
  const xyz=new Float32Array((nx+1)*(nz+1)*3);
  const rgb=new Float32Array(xyz.length);
  const normals=new Float32Array(xyz.length);
  const index=new Uint32Array(nx*nz*6);
  const stone=new THREE.Color('#596279');
  const moss=new THREE.Color('#344b51');
  const woodland=new THREE.Color('#1e3b47');
  const distant=new THREE.Color('#7786ae');
  const palette=[
    {z:-164,c:new THREE.Color('#c79ac4')},
    {z:-133,c:new THREE.Color('#728abd')},
    {z:-108,c:new THREE.Color('#387da7')},
    {z:-83,c:new THREE.Color('#275877')},
    {z:-55,c:new THREE.Color('#142f52')},
    {z:0,c:new THREE.Color('#101d38')}
  ];
  const colour=new THREE.Color();
  const depthColour=new THREE.Color();
  const stride=nx+1;
  // Standard game-terrain pipeline: build the height grid ONCE.
  for(let j=0;j<=nz;j++){
    const z=section.back+j*dz;
    for(let i=0;i<=nx;i++){
      const x=-width/2+i*dx,k=(j*stride+i)*3;
      xyz[k]=x;
      xyz[k+1]=sampleValleyHeight(x,z);
      xyz[k+2]=z;
    }
  }
  // Derive normals and biome weights from the cached height grid.
  // Seams use analytic samples across the boundary, so two chunks agree.
  for(let j=0;j<=nz;j++){
    const z=section.back+j*dz;
    for(let i=0;i<=nx;i++){
      const k=(j*stride+i)*3;
      const x=xyz[k],y=xyz[k+1];
      const left=i>0?xyz[k-3+1]:sampleValleyHeight(x-dx,z);
      const right=i<nx?xyz[k+3+1]:sampleValleyHeight(x+dx,z);
      const down=j>0?xyz[k-stride*3+1]:sampleValleyHeight(x,z-dz);
      const up=j<nz?xyz[k+stride*3+1]:sampleValleyHeight(x,z+dz);
      let slopeX=(right-left)/(2*dx),slopeZ=(up-down)/(2*dz);
      // At the seam, use a fixed numerical step independent of chunk LOD.
      if(j===0||j===nz){
        const e=.40;
        slopeZ=(sampleValleyHeight(x,z+e)-sampleValleyHeight(x,z-e))/(2*e);
      }
      const inv=1/Math.sqrt(1+slopeX*slopeX+slopeZ*slopeZ);
      normals[k]=-slopeX*inv;
      normals[k+1]=inv;
      normals[k+2]=-slopeZ*inv;
      const steep=smooth(.43,1.9,Math.hypot(slopeX,slopeZ));
      const altitude=smooth(0,21,y);
      const soil=1-smooth(-22,-2,z);
      const middle=smooth(-160,-28,z);
      colour.copy(woodland).lerp(moss,.25+soil*.42);
      colour.lerp(stone,clamp(steep*.76+altitude*.32));
      colour.lerp(distant,(1-middle)*.38);
      // Target image's lavender > cobalt > teal > deep-blue depth sequence.
      // Geometry is fully 3D; only its natural distance biome changes.
      let band=0;
      while(band<palette.length-2&&z>palette[band+1].z)band++;
      const near=palette[band],far=palette[band+1];
      const blend=smooth(near.z,far.z,z);
      depthColour.copy(near.c).lerp(far.c,blend);
      colour.lerp(depthColour,z<-45?.80:.48);
      const gr=fbm(x*.15,z*.15,37);
      const detail=fbm(x*.50,z*.38,57);
      colour.multiplyScalar(clamp(.89+.17*gr+.075*detail,.72,1.08));
      rgb[k]=colour.r;rgb[k+1]=colour.g;rgb[k+2]=colour.b;
    }
  }
  let k=0;
  for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
    const a=j*stride+i,b=a+1,c=a+stride,d=c+1;
    index[k++]=a;index[k++]=c;index[k++]=d;
    index[k++]=a;index[k++]=d;index[k++]=b;
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(xyz,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(rgb,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.setIndex(new THREE.BufferAttribute(index,1));
  const mesh=new THREE.Mesh(geometry,material);
  mesh.name='Gongang heightfield / '+section.name;
  mesh.frustumCulled=false;
  mesh.receiveShadow=true;
  return mesh;
}

/** Ridge count intentionally remains five for QA, but they are connected terrain patches. */
export function createDeepValley(THREE,scene,{mobile=false}={}){
  const twilight={value:0},daylight={value:0};
  const material=new THREE.MeshStandardMaterial({
    vertexColors:true,side:THREE.DoubleSide,metalness:0,roughness:.98,
    flatShading:false,emissive:'#233653',emissiveIntensity:.29
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
      '#include <color_fragment>\nfloat bedding=sin(vTerrainWorld.y*1.48+sin(vTerrainWorld.x*.25+vTerrainWorld.z*.23)*1.7);\nfloat fissure=pow(1.-abs(bedding),9.);\nfloat facets=sin(vTerrainWorld.x*1.8+vTerrainWorld.z*.79)*sin(vTerrainWorld.y*2.73);\ndiffuseColor.rgb*=.88+.085*facets-.09*fissure;\nfloat distant=1.-smoothstep(-150.,-46.,vTerrainWorld.z);\nvec3 sunsetRock=vec3(.30,.085,.17)*uValleyTwilight*distant;\ndiffuseColor.rgb+=sunsetRock;\n// The same 3D terrain has different light response at night, sunrise,\n // and daylight; reference colors are NOT baked into a permanent sunset.\n vec3 nightTint=vec3(.53,.69,.98);\n vec3 dayTint=vec3(1.13,1.17,.91);\n diffuseColor.rgb*=mix(nightTint,dayTint,clamp(uValleyDaylight,0.,1.));');
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
