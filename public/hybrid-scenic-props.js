/* Gongang 2.5D proof of concept:
 * Preserve the fully authored panorama, render only a Blender-editable
 * scenic bench/lantern in transparent WebGL on top.
 * This avoids the uncanny procedural terrain replacing good painted scenery.
 * Opt-in via ?hybrid=on for visual QA; offline/failed WebGL keeps the art.
 */
import * as THREE from '/vendor/three.module.js';
import { loadLookoutModel } from '/scenic-model-loader.js';

const state={
  ready:false,failed:false,error:null,frames:0,
  renderWidth:0,renderHeight:0,modelParts:0,
  mode:'painterly-background-plus-blender-props'
};

let renderer,scene,camera,props;
const WORLD_HEIGHT=29;
const portrait=innerWidth<700 && innerHeight>innerWidth*1.22;

async function prepare(){
  try {
    const probe=document.createElement('canvas').getContext('webgl2');
    if(!probe)throw Error('WebGL2 unavailable; painterly mode retained');

    renderer=new THREE.WebGLRenderer({
      alpha:true,antialias:true,preserveDrawingBuffer:true,
      powerPreference:'low-power',premultipliedAlpha:true
    });
    renderer.setClearColor(0x000000,0);
    renderer.setPixelRatio(1);
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.17;

    scene=new THREE.Scene();
    camera=new THREE.OrthographicCamera(-20,20,14.5,-14.5,.1,350);
    scene.add(new THREE.HemisphereLight('#e9e8ff','#253d36',2.3));
    const fill=new THREE.DirectionalLight('#f5ddc9',1.55);
    fill.position.set(-12,15,14);scene.add(fill);

    props=await loadLookoutModel(THREE,scene);
    // The painted foreground already contains natural grass, stones and
    // wildflowers. The OBJ's sculpted stone clearing formed an uncanny floating
    // island over that art, so keep only the bench and lantern details.
    for (const piece of props.children) {
      if (!piece.isMesh) continue;
      const key = piece.name;
      if (key.startsWith('Stone') || key.startsWith('Leaf') ||
          key.startsWith('Flower') || key === 'ReedStem') {
        piece.visible = false;
      }
    }

    // Anchor the authored furniture onto the lower foreground grass, avoiding
    // the lower action dock. Portrait camera eye is shifted 5 units left.
    props.position.set(portrait ? -5.6 : 10.8, portrait ? -4.2 : -5.35, 11.2);
    props.rotation.set(0,-.28,0);
    props.scale.setScalar(portrait ? .56 : .84);

    // A feathered contact shadow gives the transparent bench legs weight
    // without adding a drawn platform or a realtime shadow-map pass.
    const shadowCanvas=document.createElement('canvas');
    shadowCanvas.width=128;shadowCanvas.height=48;
    const g=shadowCanvas.getContext('2d');
    const shadowFill=g.createRadialGradient(64,24,2,64,24,61);
    shadowFill.addColorStop(0,'rgba(10,22,25,.23)');
    shadowFill.addColorStop(.55,'rgba(10,22,25,.10)');
    shadowFill.addColorStop(1,'rgba(10,22,25,0)');
    g.fillStyle=shadowFill;g.fillRect(0,0,128,48);
    const shadowTexture=new THREE.CanvasTexture(shadowCanvas);
    const contact=new THREE.Sprite(new THREE.SpriteMaterial({
      map:shadowTexture,transparent:true,depthWrite:false,
      depthTest:false,fog:false
    }));
    contact.name='Soft bench contact shadow';
    contact.position.set(0,.08,-.1);
    contact.scale.set(5.8,1.10,1);
    props.add(contact);
    state.modelParts=props.children.filter(child=>child.isMesh && child.visible).length;
    state.ready=true;
  }catch(error){
    state.failed=true;state.error=String(error?.message||error);
    console.warn('Gongang hybrid props skipped; retaining original artwork',error);
  }
}

function draw(ctx,t,now,{personal=false}={}){
  if(!state.ready)return false;
  try{
    const w=Math.max(240,Math.min(1050,Math.round(t.width*.80)));
    const h=Math.max(240,Math.min(850,Math.round(t.height*.80)));
    if(w!==state.renderWidth || h!==state.renderHeight){
      renderer.setSize(w,h,false);
      state.renderWidth=w;state.renderHeight=h;
    }
    const aspect=w/h;
    camera.left=-WORLD_HEIGHT*aspect/2;
    camera.right=WORLD_HEIGHT*aspect/2;
    camera.top=WORLD_HEIGHT/2;camera.bottom=-WORLD_HEIGHT/2;
    camera.updateProjectionMatrix();
    const eye=portrait?-5:0;
    camera.position.set(eye,personal?10:7,39);
    camera.lookAt(eye,personal?6:1,-23);
    renderer.render(scene,camera);
    ctx.drawImage(renderer.domElement,t.x,t.y,t.width,t.height);
    state.frames++;
    return true;
  }catch(error){
    state.failed=true;state.ready=false;state.error=String(error?.message||error);
    console.warn('Gongang hybrid overlay stopped; original panorama continues',error);
    return false;
  }
}
const exposed={draw,state,get ready(){return state.ready;}};
window.GongangHybrid3D=exposed;
prepare();
export default exposed;
