/**
 * Real-time foreground contact shadows on a small 3D resting shelf.
 * Terrain and projected shadows respond to the SAME solar lighting model
 * as the hills; faded ellipses replace expensive full-scene shadow maps.
 * This is an intentional 2.5D game rendering optimization.
 */
import { parallaxShift } from '/parallax-25d.js';
import { overlookGroundHeight } from '/overlook-ground-25d.js';
const VS=`
varying vec2 vUV;
void main(){
 vUV=uv;
 gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);
}`;
const FS=`
precision highp float;
varying vec2 vUV;
uniform float uOpacity,uCloud,uWind,uTime;
void main(){
 // A tree crown has irregular overlapping lobes and broken leaf clusters,
 // not the perfect oval stamped by the previous projected shadow shader.
 vec2 q=(vUV-.5)*2.;
 q.x+=sin(uTime*.27+q.y*3.1)*uWind*.013*abs(q.y);
 float angle=atan(q.y,q.x);
 float radius=length(q);
 float crown=.84+.072*sin(angle*5.+.8*sin(angle*3.))
   +.035*sin(angle*11.3+1.7);
 float softEdge=1.-smoothstep(crown-.23,crown+.12,radius);
 float branches=(1.-smoothstep(.035,.17,abs(q.x+.13*sin(q.y*3.7))))
   *(1.-smoothstep(.20,.88,abs(q.y)))*.23;
 float leafGaps=.78+.11*sin(q.x*17.+q.y*9.2)
   +.08*sin(q.x*33.4-q.y*22.7);
 float shade=clamp(softEdge*leafGaps+branches,0.,1.);
 float penumbra=1.-smoothstep(.67,1.05,radius);
 float alpha=clamp(uOpacity*(1.-uCloud*.46),0.,.72);
 gl_FragColor=vec4(.018,.030,.064,alpha*shade*penumbra);
}`;
export function createOverlookShadows25D(THREE,scene,{mobile=false}={}){
  const source=mobile?
    [[-9.0,15,8.7],[-7.4,27,6.2],[9,16,8.3],[7.2,28,6.1]]:
    [[-24,14,12.4],[-21,23,9.1],[-17.5,36,6.7],
     [24,15,12.8],[21,24,9.2],[17.7,37,6.6]];
  const geom=new THREE.PlaneGeometry(1,1);
  geom.rotateX(-Math.PI/2);
  const uniform={uOpacity:{value:0},uCloud:{value:0},
    uWind:{value:0},uTime:{value:0}};
  const material=new THREE.ShaderMaterial({
    uniforms:uniform,vertexShader:VS,fragmentShader:FS,
    transparent:true,depthWrite:false,depthTest:true,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1
  });
  const mesh=new THREE.InstancedMesh(geom,material,source.length);
  mesh.name='Soft time-varying projected foreground pine shadows';
  mesh.frustumCulled=false;
  mesh.renderOrder=3;
  scene.add(mesh);
  const actor=new THREE.Object3D();
  return {
    count:source.length,mesh,
    update(light,view,seconds=0,wind=0){
      const length=Math.max(0,light.shadowLength);
      uniform.uTime.value=seconds;
      uniform.uWind.value=wind;
      uniform.uOpacity.value=light.shadowStrength*.68;
      uniform.uCloud.value=light.cloud;
      for(let i=0;i<source.length;i++){
        const [sx,sz,size]=source[i];
        const shift=parallaxShift(view,sz);
        // Project to the ground plane away from the sun, with a little
        // asymmetry from the direction of light. Shadows stay on real ground.
        // Cast along both horizontal axes, opposite the current sun/moon.
        // A fixed Z offset made shadows point in the same direction all day.
        const x=sx+shift.x-light.direction[0]*length*.74;
        const z=sz-light.direction[2]*length*.74;
        actor.position.set(x,overlookGroundHeight(x-shift.x,z-77)+.08+shift.y,z);
        actor.rotation.set(0,Math.atan2(light.direction[0],light.direction[2]),0);
        actor.scale.set(size*.63,1,Math.max(size*.66,length*1.55));
        actor.updateMatrix();mesh.setMatrixAt(i,actor.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    },
    dispose(){scene.remove(mesh);mesh.dispose();geom.dispose();material.dispose();}
  };
}
