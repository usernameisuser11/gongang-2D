/**
 * Cinematic forest. A real GPU-instanced 3D conifer canopy anchored to sculpted
 * mountain elevations. Hand-shaped boughs and twig clusters, not triangular
 * cone primitives, texture billboards or a static background photograph.
 */
function randgen(seed=12951){return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);}
function pineGeometry(THREE){
  const v=[],colors=[],indices=[];let n=0;
  const color=(r,g,b)=>[r,g,b];
  function tri(a,b,c,ca,cb,cc){
    for(const [p,t] of [[a,ca],[b,cb],[c,cc]]){
      v.push(...p);colors.push(...t);
    }
    indices.push(n,n+1,n+2);n+=3;
  }
  const twig=(y,side,length,seed,angle)=>{
    // Each branch is a tapering fan with a hooked, needle-frayed tip.
    const x=side*length;
    const droop=.024+.035*Math.sin(seed*13.7);
    const near=[0,y,0],lower=[0,y-.045,0];
    const top=[x*.82,y+.016+angle,x*.14*Math.sin(seed)];
    const tip=[x,y-droop+angle,x*.12*Math.cos(seed*2)];
    const shadow=color(.56,.68,.81), mid=color(.73,.80,.93),low=color(.35,.55,.69);
    tri(near,top,tip,low,mid,shadow);
    tri(lower,near,tip,shadow,low,mid);
    // Irregular short needle sprays ensure silhouettes don't end in straight wedges.
    for(let k=0;k<4;k++){
      const f=.33+k*.145;
      const tx=x*f,ty=y+(.018+angle)*f;
      const spur=(.028+.012*Math.sin(seed*9+k*4))*side*(1-f*.50);
      tri([tx,ty,0],[tx+spur,ty+.045*(1-f),.008],
        [tx+spur*.67,ty-.026*(1-f),-.007],mid,low,shadow);
    }
  };
  for(let q=0;q<2;q++){
    const rot=q*Math.PI/2;
    const oldLen=v.length;
    tri([-.018,0,0],[.018,0,0],[.010,1.04,0],
      color(.22,.35,.43),color(.33,.42,.50),color(.50,.57,.65));
    for(let i=0;i<27;i++){
      const t=i/27, y=.08+t*.88;
      const taper=Math.pow(1-t,.83);
      const length=(.28*taper+.016)*(1+.08*Math.sin(i*5.9+q*3));
      // Shorter upper sprays and drooping lower branchlets.
      for(const side of [-1,1]){
        twig(y,side,length,4.1+i*1.47+q*.17,
          .013*Math.sin(i*.7+q)+.008*Math.sin(i*2.1));
      }
    }
    if(q===1){
      for(let k=oldLen;k<v.length;k+=3){
        const x=v[k],z=v[k+2];
        v[k]=Math.cos(rot)*x+Math.sin(rot)*z;
        v[k+2]=-Math.sin(rot)*x+Math.cos(rot)*z;
      }
    }
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
const LAYERS=[
  {z:-140,depth:17,center:-5.9,lift:7.6,width:27,seed:12,h:2.6,count:150,tint:'#6084a7'},
  {z:-119,depth:18,center:-8.5,lift:9.2,width:32,seed:31,h:3.4,count:190,tint:'#37668e'},
  {z:-98,depth:18,center:-10.7,lift:11.1,width:34,seed:51,h:4.4,count:230,tint:'#1b506f'},
  {z:-77,depth:16,center:-13.7,lift:13.9,width:35,seed:79,h:5.4,count:290,tint:'#123d5b'},
  {z:-58,depth:18,center:-17.6,lift:16.4,width:34,seed:91,h:6.3,count:330,tint:'#0a273d'}
];
const fract=x=>x-Math.floor(x),smooth=t=>t*t*(3-2*t);
function hash(i,s){return fract(Math.sin(i*127.1+s*311.7)*43758.54531);}
function noise(x,s){let i=Math.floor(x),f=smooth(x-i);return (hash(i,s)*(1-f)+hash(i+1,s)*f)*2-1;}
function fbm(x,s){return noise(x,s)*.57+noise(x*2.21,s+11)*.27+noise(x*4.37,s+29)*.12+noise(x*9.14,s+41)*.04;}
function crest(x,c){
 const t=Math.abs(x/c.width);
 const rugged=fbm(x*.11,c.seed)*2.08+fbm(x*.34,c.seed+41)*.86+noise(x*.66,c.seed+10)*.36;
 const cliff=(center,l,r,h)=>Math.pow(Math.max(0,1-((x<center?(center-x)/l:(x-center)/r))),1.6)*h;
 const p=c.seed===12?cliff(-29,10,15,3.1)+cliff(-12,9,10,3.6)+cliff(7,7,11,4.3)+cliff(24,13,9,2.8):
  c.seed===31?cliff(-24,10,15,2.1)+cliff(-6,8,9,3)+cliff(15,10,8,3.1):
  c.seed===51?cliff(-23,13,8,2.5)+cliff(4,7,10,2.2)+cliff(22,9,9,2.7):
  c.seed===79?cliff(-25,11,11,2.4)+cliff(26,8,13,3.1):
  cliff(-30,13,12,3.1)+cliff(31,13,10,3.0);
 return c.center+c.lift*Math.pow(t,1.53)+rugged+p-1.1*Math.exp(-Math.pow((x+(c.seed%11)-6)/13.5,2));
}
export function createCinematicForest(THREE,scene,{mobile=false}={}){
  const geometry=pineGeometry(THREE),material=new THREE.MeshBasicMaterial({
    side:THREE.DoubleSide,vertexColors:true,fog:true,depthWrite:true,
    transparent:false,color:'#b7d6e1'
  });
  const random=randgen(202611111);
  const instances=[];
  for(const c of LAYERS){
    const count=Math.round(c.count*(mobile?.56:1));
    for(let i=0;i<count;i++){
      // Woods grow on either side of the ravine; occasional trees on the
      // center ridgeline give natural silhouette breaks.
      const side=i%2?-1:1;
      const x=side*(3.9+Math.pow(random(),.72)*38);
      const t=random()*.19; // near the visible upper contours
      const floor=-24+(c.center+10)*.32;
      const y=crest(x,c)*(1-Math.pow(t,.78))+floor*Math.pow(t,.78)+
        fbm(x*.42+t*3.1,c.seed+23)*.55*Math.sin(Math.PI*t)-
        Math.max(0,noise(x*.27+t*8.7,c.seed+7))*.85*t;
      const z=c.z-c.depth*(.52-t)+noise(x*.26+t*4,c.seed+5)*.46;
      const scale=c.h*(.53+random()*.72);
      instances.push({x,y,z,scale,tint:c.tint,rotation:random()*6.28});
    }
  }
  // Important art-direction detail: strong trees to left/right near camera,
  // not an obstructive central pine or enormous upright flat panel.
  const framing=mobile?
    [[-17.9,11.8,6.2],[13.4,11.6,5.9],[-21.3,22,7.7],[19.2,22,6.8]]:
    [[-23.0,12.0,10.1],[22.8,13.8,9.5],[-19.6,24,8.2],[19.3,26,8.0],
     [-26.0,33,12.5],[25.5,34,10.9]];
  for(const [x,z,scale] of framing)
    instances.push({x,y:-3.15,z,scale,rotation:random()*6.28,tint:'#0b1b32'});
  const instanced=new THREE.InstancedMesh(geometry,material,instances.length);
  const actor=new THREE.Object3D(),tone=new THREE.Color();
  for(let i=0;i<instances.length;i++){
    const t=instances[i];
    actor.position.set(t.x,t.y,t.z);
    actor.scale.set(t.scale*(.88+random()*.2),t.scale*(.9+random()*.18),
      t.scale*(.65+random()*.12));
    actor.rotation.set(0,t.rotation,0);
    actor.updateMatrix();instanced.setMatrixAt(i,actor.matrix);
    tone.set(t.tint).multiplyScalar(.75+random()*.36);
    instanced.setColorAt(i,tone);
  }
  instanced.name='Cinematic 3D forest - canopy layers';
  instanced.frustumCulled=false;
  instanced.instanceMatrix.needsUpdate=true;
  if(instanced.instanceColor)instanced.instanceColor.needsUpdate=true;
  scene.add(instanced);
  return {
    count:instances.length,mesh:instanced,
    dispose(){scene.remove(instanced);instanced.dispose();geometry.dispose();material.dispose();}
  };
}
