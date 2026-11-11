/**
 * Gongang / Sculpted cinematic valley
 *
 * Actual 3D meshes, not a prerendered panorama or Canvas2D drawing. Each ridge
 * is a fully depth-bearing, continuously triangulated surface with an irregular
 * crest, ravines, worn rock microtexture, aerial perspective and organic
 * asymmetric side framing. Authored to leave a broad open valley at center.
 */
const LAYERS=[
 {id:'horizon',z:-140,depth:17,center:-10.7,lift:11.2,width:29,seed:12,top:'#b58dbe',low:'#657aa2'},
 {id:'distant',z:-119,depth:18,center:-12.1,lift:13.4,width:33,seed:31,top:'#7b8cbb',low:'#376b92'},
 {id:'middle',z:-98,depth:18,center:-13.2,lift:15.1,width:34,seed:51,top:'#446f9b',low:'#215978'},
 {id:'near',z:-77,depth:16,center:-15.8,lift:16.5,width:35,seed:79,top:'#215b72',low:'#113c53'},
 {id:'silhouette',z:-58,depth:18,center:-19.3,lift:18.5,width:34,seed:91,top:'#183e57',low:'#0a273c'}
];
const TAU=Math.PI*2;
const smooth=t=>t*t*(3-2*t);
const fract=x=>x-Math.floor(x);
function hash(i,seed){return fract(Math.sin(i*127.1+seed*311.7)*43758.54531);}
function noise(x,seed){
 const i=Math.floor(x),f=smooth(x-i);
 return (hash(i,seed)*(1-f)+hash(i+1,seed)*f)*2-1;
}
function fbm(x,seed){
 return noise(x,seed)*.57+noise(x*2.21,seed+11)*.27+
 noise(x*4.37,seed+29)*.12+noise(x*9.14,seed+41)*.04;
}
function cliff(x,center,l,r,height){
 const d=x<center?(center-x)/l:(x-center)/r;
 return Math.pow(Math.max(0,1-d),1.6)*height;
}
function ridgeAt(x,c){
 const t=Math.abs(x/c.width);
 const shoulders=c.lift*Math.pow(t,1.53);
 const rugged=fbm(x*.11,c.seed)*1.75+
  fbm(x*.34,c.seed+41)*.43+noise(x*.66,c.seed+10)*.18;
 const peaks=c.id==='horizon'
 ?cliff(x,-22,10,18,1.9)+cliff(x,35,18,9,2.0)
 :c.id==='near' ? cliff(x,-38,16,8,2.9)+cliff(x,45,10,18,3.3)
 :cliff(x,-34,15,10,2.4)+cliff(x,29,12,17,1.7);
 const valley=2.0*Math.exp(-Math.pow((x+(c.seed%11)-6)/11.5,2));
 return c.center+shoulders+rugged+peaks-valley;
}
function erosions(x,t,c){
 const channels=Math.max(0,noise(x*.27+t*8.7,c.seed+7))*.85;
 const ridge=fbm(x*.42+t*3.1,c.seed+23)*.55;
 return ridge*Math.sin(Math.PI*t)-channels*t;
}
function sculptOne(THREE,scene,c,mobile){
 const N=mobile?112:214,M=mobile?11:17;
 const vertices=new Float32Array((N+1)*(M+1)*3);
 const colors=new Float32Array(vertices.length);
 const indices=new Uint32Array(N*M*6);
 const top=new THREE.Color(c.top),lower=new THREE.Color(c.low);
 for(let j=0;j<=M;j++){
  const t=j/M;
  for(let i=0;i<=N;i++){
   const x=-100+i/N*200;
   const crest=ridgeAt(x,c);
   const valleyFloor=-24+(c.center+10)*.32;
   const z=c.z-c.depth*(.52-t)+noise(x*.26+t*4,c.seed+5)*.46;
   const y=crest*(1-Math.pow(t,.78))+
     valleyFloor*Math.pow(t,.78)+erosions(x,t,c);
   const k=(j*(N+1)+i)*3;
   vertices[k]=x;
   vertices[k+1]=y;
   vertices[k+2]=z;
   const rockNoise=fbm(x*.22+t*7.6,c.seed+33);
   const incision=Math.max(0,noise(x*.33+t*4.5,c.seed+21));
   const tint=Math.max(.07,Math.min(.90,t*.85+.15+rockNoise*.07));
   const colour=top.clone().lerp(lower,tint);
   const shade=1+rockNoise*.07-incision*.025;
   colors[k]=colour.r*shade;colors[k+1]=colour.g*shade;colors[k+2]=colour.b*shade;
  }
 }
 let idx=0;
 for(let j=0;j<M;j++)for(let i=0;i<N;i++){
  const a=j*(N+1)+i,b=a+1,d=a+N+1,cc=d+1;
  indices[idx++]=a;indices[idx++]=d;indices[idx++]=cc;
  indices[idx++]=a;indices[idx++]=cc;indices[idx++]=b;
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.BufferAttribute(vertices,3));
 geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geo.setIndex(new THREE.BufferAttribute(indices,1));
 geo.computeVertexNormals();
 const mat=new THREE.MeshStandardMaterial({
  vertexColors:true,roughness:1,metalness:0,
  side:THREE.DoubleSide,flatShading:false
 });
 // Micro-erosion is a low-cost surface variation, not painted diagonal lines.
 // This never introduces edges or changes mesh silhouette.
 mat.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>',
    '#include <common>\nvarying vec3 vWorldRock;');
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
    '#include <begin_vertex>\nvWorldRock=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',
    '#include <common>\nvarying vec3 vWorldRock;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
    '#include <color_fragment>\nfloat grain=sin(vWorldRock.x*1.9+sin(vWorldRock.z*2.1))*sin(vWorldRock.y*3.3+vWorldRock.x*.49);\nfloat speck=fract(sin(dot(floor(vWorldRock.xz*4.1),vec2(12.98,78.23)))*43758.5);\ndiffuseColor.rgb*=.955+.042*grain+.033*(speck-.5);');
 };
 mat.customProgramCacheKey=()=> 'gongang-cinematic-stone-20261111';
 const mesh=new THREE.Mesh(geo,mat);
 mesh.name='Deep 3D ridge / '+c.id;
 mesh.frustumCulled=false;
 mesh.castShadow=false;mesh.receiveShadow=false;
 scene.add(mesh);
 return mesh;
}
/**
 * Return on-mesh pine placements for the actual sculpted terrain; never put
 * trees at positions inherited from an unrelated prototype landscape.
 * A broad empty central corridor preserves the valley and sky composition.
 */
export function createValleyGroveLayout({mobile=false}={}){
  const trees=[];
  let seed=202611115;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const put=(x,t,c,scale)=>{
    const crest=ridgeAt(x,c);
    const floor=-24+(c.center+10)*.32;
    const y=crest*(1-Math.pow(t,.78))+floor*Math.pow(t,.78)+erosions(x,t,c);
    const z=c.z-c.depth*(.52-t)+noise(x*.26+t*4,c.seed+5)*.46;
    trees.push({
      position:[+x.toFixed(3),+(y+.03).toFixed(3),+z.toFixed(3)],
      rotationY:+(random()*TAU).toFixed(3),
      scale:+scale.toFixed(3)
    });
  };
  // Forested slopes: trees deepen naturally into the scene, while distant
  // ridges and the entire center remain clear for sky watching.
  const groups=[
    {layer:LAYERS[4],count:mobile?12:17,min:9,max:27,scale:.55},
    {layer:LAYERS[3],count:mobile?10:18,min:10,max:29,scale:.39},
    {layer:LAYERS[2],count:mobile?7:14,min:12,max:30,scale:.27}
  ];
  for(const group of groups){
    for(let i=0;i<group.count;i++){
      const sign=i%2===0?-1:1;
      const x=sign*(group.min+random()*(group.max-group.min));
      const t=.075+random()*.17;
      put(x,t,group.layer,group.scale*(.73+random()*.57));
    }
  }
  // Tall framing pines in the real foreground, well outside the sitting
  // area. They are 3D meshes, not background stickers.
  const near=mobile?[[-16.7,13.8,.70],[7.6,13.4,.63]]:
    [[-21.6,16.2,1.10],[-18.1,22.0,.76],[21.5,17.0,1.16],[18.2,22.4,.74]];
  for(const [x,z,scale] of near){
    trees.push({position:[x,-3.18,z],rotationY:random()*TAU,scale});
  }
  return trees;
}

export function createDeepValley(THREE,scene,{mobile=false}={}){
 const meshes=LAYERS.map(c=>sculptOne(THREE,scene,c,mobile));
 return {
   meshes,ready:true,count:meshes.length,triangleCount:meshes.reduce((n,m)=>n+m.geometry.index.count/3,0),
   dispose(){
    for(const m of meshes){scene.remove(m);m.geometry.dispose();m.material.dispose();}
   }
 };
}
