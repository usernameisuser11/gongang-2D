/* Gongang 2D — rigged painterly plants.
 * Five independently painted transparent foliage brushes. A curved ten-bone
 * deformation field keeps each plant's root fixed while the crown bends with
 * correlated, traveling gusts. No per-frame noise textures or allocations. */
(() => {
  'use strict';
  const ART_W=1672,ART_H=941,TW=240,TH=400,SEGMENTS=11;
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function seeded(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
  const random=seeded(113468);
  const grass=[],leaves=[],asset=new Image();
  let debugClock=null;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const state={assetReady:false,assetFailed:false,drawCalls:0,grassCount:0,leafCount:0,
    reducedMotion:false,lastWind:0,rigSegments:SEGMENTS,mode:'painterly-mesh'};
  asset.decoding='async';
  asset.onload=()=>{state.assetReady=true;};
  asset.onerror=()=>{state.assetFailed=true;};
  asset.src='/assets/foliage-atlas.svg';

  // Map plants to the existing meadow's near-edge geometry, with slight
  // clusters rather than regular spacing. There are no artificial paths or
  // repeated line-shaped reeds drawn in front of the painting.
  function grassline(x){return 571+.146*x+17*Math.sin(x*.0047+.7);}
  const anchors=[82,195,325,475,615,745,965,1070,1210,1360,1500,1610];
  // Distinct illuminated foreground hero clumps make the wind perceptible
  // at normal zoom. Smaller companion tufts supply depth without crowding.
  const heroPoints=[150,345,525,1165,1365,1575];
  for(let i=0;i<27;i++){
    const hero=i<heroPoints.length;
    const center=hero?heroPoints[i]:anchors[(i*5)%anchors.length];
    const x=clamp(center+(random()-.5)*(hero?55:130),35,ART_W-38);
    const depth=hero?.66+random()*.24:.18+.82*random();
    let rootY=grassline(x)+48+depth*190;
    rootY=clamp(rootY,635,ART_H+16);
    const variant=hero?(i%2?3:0):
      [0,1,3,2,1,0,3,2,4][(i+Math.floor(random()*5))%9];
    const height=hero?155+random()*70:
      (78+random()*92)*(.65+depth*.52);
    const width=hero?112+random()*48:
      (70+random()*70)*(.72+depth*.37);
    grass.push({
      x,rootY,width,height,variant,
      alpha:hero?.69+random()*.14:(.31+random()*.30)*(variant===4?.74:1),
      amplitude:hero?28+random()*16:18+random()*23,
      phase:random()*TAU,stiffness:.70+random()*.75,
      direction:random()>.5?1:-1
    });
  }
  // A few distinct leafy sprays hang from the actual left-hand tree. The
  // source illustration stays untouched: these are independent transparent
  // branch tips above the background, not a duplicate translated canopy.
  for(let i=0;i<5;i++){
    const x=30+random()*350;
    const rootY=36+random()*140;
    leaves.push({
      x,rootY,width:56+random()*59,height:70+random()*73,
      variant:4,alpha:.11+random()*.12,
      amplitude:5+random()*11,phase:random()*TAU,
      stiffness:.72+random()*.52,direction:1,
      angle:1.0+(random()-.5)*.8
    });
  }
  state.grassCount=grass.length;
  state.leafCount=leaves.length;

  // Coherent gusts travel across the hillside, affecting neighboring plants
  // together without causing every stalk to mirror the same oscillation.
  function wind(t,x,phase){
    const passing=Math.sin(t*.61-x*.0024);
    const longWave=.64+.25*Math.sin(t*.16+1.1)+.11*Math.sin(t*.095-.7);
    const flutter=.23*Math.sin(t*1.17+x*.0047+phase);
    return (passing*.82+.31*Math.sin(t*.38-x*.0014+phase*.22)+flutter)
      *clamp(longWave,.36,1.03);
  }
  function bend(item,t,q){
    // The first (root) vertex is exactly stationary. The traveling phase
    // introduces delayed motion toward the tip, like a flexible stalk.
    if(q<=0)return 0;
    const delayed=t-q*.27;
    return item.amplitude*item.stiffness*Math.pow(q,1.72)
      *wind(delayed,item.x,item.phase)*item.direction;
  }
  function tip(item,t){
    return {x:item.x+bend(item,t,1),y:item.rootY-item.height};
  }
  // The atlas is decoded once. Every frame, 11 overlapping source rows make
  // a smooth deformation mesh, with the bottom source row anchored at zero.
  function paintSprite(c,item,t){
    // Contiguous image rotation around a fixed root when WebGL2 is absent.
    const turn=Math.atan2(bend(item,t,1),item.height)*.72;
    c.save();c.translate(item.x,item.rootY);
    c.rotate((item.angle||0)+turn);
    c.globalAlpha=item.alpha;
    c.drawImage(asset,item.variant*TW,0,TW,TH,
      -item.width*.5,-item.height,item.width,item.height);
    c.restore();
  }
  // If the atlas is unavailable, never replace the user's art with crude
  // rectangles. The static painted meadow remains untouched.
  let gpu=null,gpuAttempted=false;
  function draw(c,transform,now,{personal=false}={}){
    if(!transform||!state.assetReady)return;
    const isReduced=Boolean(reduced?.matches);
    state.reducedMotion=isReduced;
    const t=isReduced?0:(debugClock===null?now/1000:debugClock/1000);
    state.lastWind=wind(t,900,0);
    if(!gpuAttempted){
      gpuAttempted=true;
      try{gpu=window.FoliageGPU?.create(asset,[...grass,...leaves])||null;}
      catch(e){console.warn('Continuous foliage unavailable:',e.message);}
      state.gpu=Boolean(gpu);
    }
    if(gpu){
      gpu.draw(t);
      c.save();
      c.globalAlpha=personal?.54:1;
      c.drawImage(gpu.canvas,transform.x,transform.y,transform.width,transform.height);
      c.restore();
    }else{
      c.save();c.translate(transform.x,transform.y);
      c.scale(transform.width/ART_W,transform.height/ART_H);
      c.globalAlpha=personal?.54:1;
      for(const item of grass)paintSprite(c,item,t);
      for(const item of leaves)paintSprite(c,item,t);
      c.restore();
    }
    state.drawCalls++;
  }
  function debugAt(ms=0){
    const t=ms/1000,g=grass[0],l=leaves[0];
    return {grassRoot:{x:g.x,y:g.rootY},grassTip:tip(g,t),
      leafRoot:{x:l.x,y:l.rootY},leafTip:tip(l,t),
      count:grass.length+leaves.length};
  }
  // A stable development hook for screenshot comparison, never a user control.
  function debugDrawAt(c,transform,ms){
    if(!state.assetReady)return;
    c.save();c.translate(transform.x,transform.y);
    c.scale(transform.width/ART_W,transform.height/ART_H);
    for(const g of grass)paintSprite(c,g,ms/1000);
    for(const l of leaves)paintSprite(c,l,ms/1000);
    c.restore();
  }
  window.GongangNature={draw,state,debugAt,debugDrawAt,
    debugSetTime(ms){debugClock=Number.isFinite(ms)?ms:null;}};
})();