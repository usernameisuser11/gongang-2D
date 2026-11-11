/**
 * Dynamic stream embedded in the same real procedural 3D heightfield.
 * Both banks and water vertices query sampleValleyHeight(x,z), so the
 * river is not a separate huge slanted rectangle or static texture.
 */
import { sampleValleyHeight, getValleyFlow } from '/valley-sculpt-3d.js';
const VERT=`
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime,uWind;
void main(){
  vUv=uv;
  vec3 p=position;
  float wave=sin(p.z*.45+uTime*.72)*sin(p.x*2.5-uTime*.43);
  p.y+=wave*(.012+.009*uWind);
  vWorld=p;
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
}`;
const FRAG=`
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
uniform float uTime,uDay,uTwilight,uRain,uWind;
void main(){
  float edge=1.-smoothstep(.74,1.,abs(vUv.x*2.-1.));
  float v=vWorld.z*.21-uTime*.38;
  float r=sin(vWorld.x*2.36+v);
  float r2=sin(vWorld.x*5.31-v*.92+sin(vWorld.z*.23)*1.6);
  float broken=pow(max(0.,r*.6+r2*.4),7.);
  float fleck=pow(max(0.,sin(vWorld.x*7.5+vWorld.z*.91-uTime*.76)),20.);
  vec3 night=mix(vec3(.036,.086,.135),vec3(.066,.16,.22),.5+r*.5);
  vec3 day=mix(vec3(.080,.21,.24),vec3(.16,.37,.42),.5+r*.5);
  vec3 col=mix(night,day,uDay*.85);
  col+=vec3(.12,.16,.25)*broken*(.18+uTwilight*.22+uDay*.30);
  col+=vec3(.19,.27,.31)*fleck*(.06+.20*uDay);
  col+=vec3(.09,.14,.18)*pow(max(0.,1.-abs(vUv.x*2.-1.)),10.)*.14;
  col+=vec3(.045,.065,.07)*uRain*(.5+.5*r2);
  col*=.88+.06*uWind;
  gl_FragColor=vec4(col,edge*(.82+.08*uRain));
}`;
export function createTerrainStream(THREE,scene,{mobile=false}={}){
  const length=26,sections=mobile?38:76,across=mobile?8:12;
  const positions=new Float32Array((sections+1)*(across+1)*3);
  const uvs=new Float32Array((sections+1)*(across+1)*2);
  const indices=new Uint32Array(sections*across*6);
  for(let j=0;j<=sections;j++){
    const t=j/sections;
    const z=-55+length*t;
    const center=getValleyFlow(z);
    const width=.45+1.75*Math.pow(t,1.45);
    for(let i=0;i<=across;i++){
      const acrossT=i/across;
      const x=center+(acrossT*2-1)*width;
      const k=(j*(across+1)+i)*3;
      positions[k]=x;
      positions[k+1]=sampleValleyHeight(x,z)+.085;
      positions[k+2]=z;
      const u=(j*(across+1)+i)*2;
      uvs[u]=acrossT;uvs[u+1]=t;
    }
  }
  let n=0;
  for(let j=0;j<sections;j++)for(let i=0;i<across;i++){
    const a=j*(across+1)+i,b=a+1,c=a+across+1,d=c+1;
    indices[n++]=a;indices[n++]=c;indices[n++]=b;
    indices[n++]=b;indices[n++]=c;indices[n++]=d;
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.BufferAttribute(uvs,2));
  geo.setIndex(new THREE.BufferAttribute(indices,1));
  geo.computeVertexNormals();
  const uniforms={
    uTime:{value:0},uWind:{value:.2},uDay:{value:0},
    uTwilight:{value:0},uRain:{value:0}
  };
  const mat=new THREE.ShaderMaterial({
    vertexShader:VERT,fragmentShader:FRAG,uniforms,
    side:THREE.DoubleSide,transparent:true,depthWrite:false,
    depthTest:true,fog:false
  });
  const mesh=new THREE.Mesh(geo,mat);
  mesh.name='Terrain aligned animated stream';
  mesh.frustumCulled=false;mesh.renderOrder=2;
  scene.add(mesh);
  return{
    ready:true,mesh,vertexCount:positions.length/3,
    update(seconds,env={}){
      uniforms.uTime.value=seconds;
      uniforms.uWind.value=env.wind||0;
      uniforms.uDay.value=env.daylight||0;
      uniforms.uTwilight.value=env.twilight||0;
      uniforms.uRain.value=env.rain||0;
    },
    dispose(){scene.remove(mesh);geo.dispose();mat.dispose();}
  };
}
