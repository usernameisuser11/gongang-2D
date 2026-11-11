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
precision mediump float;
varying vec2 vUV;
uniform float uOpacity,uCloud;
void main(){
 vec2 q=(vUV-.5)*2.;
 float d=dot(q,q);
 float penumbra=pow(max(0.,1.-d),2.4);
 float breaking=(.90+.10*sin(q.x*9.+q.y*3.));
 gl_FragColor=vec4(.018,.030,.064,
   clamp(uOpacity*(1.-uCloud*.34),0.,.7)*penumbra*breaking);
}`;
export function createOverlookShadows25D(THREE,scene,{mobile=false}={}){
  const source=mobile?
    [[-9.0,15,8.7],[-7.4,27,6.2],[9,16,8.3],[7.2,28,6.1]]:
    [[-24,14,12.4],[-21,23,9.1],[-17.5,36,6.7],
     [24,15,12.8],[21,24,9.2],[17.7,37,6.6]];
  const geom=new THREE.PlaneGeometry(1,1);
  geom.rotateX(-Math.PI/2);
  const uniform={uOpacity:{value:0},uCloud:{value:0}};
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
    update(light,view){
      const length=Math.max(0,light.shadowLength);
      uniform.uOpacity.value=light.shadowStrength*.68;
      uniform.uCloud.value=light.cloud;
      for(let i=0;i<source.length;i++){
        const [sx,sz,size]=source[i];
        const shift=parallaxShift(view,sz);
        // Project to the ground plane away from the sun, with a little
        // asymmetry from the direction of light. Shadows stay on real ground.
        const x=sx+shift.x-light.direction[0]*length*.62;
        const z=sz-length*.29;
        actor.position.set(x,overlookGroundHeight(x-shift.x,z-26)+.08+shift.y,z);
        actor.rotation.set(0,light.azimuth*.75,0);
        actor.scale.set(size*.53,1,Math.max(size*.65,length*1.8));
        actor.updateMatrix();mesh.setMatrixAt(i,actor.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;
    },
    dispose(){scene.remove(mesh);mesh.dispose();geom.dispose();material.dispose();}
  };
}
