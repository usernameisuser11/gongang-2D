/* Gongang 2D — rigged painterly plants.
 * Five independently painted transparent foliage brushes. A curved ten-bone
 * deformation field keeps each plant's root fixed while the crown bends with
 * correlated, traveling gusts. No per-frame noise textures or allocations. */
(() => {
  'use strict';
  const ART_W=1672,ART_H=941,TW=240,TH=400,SEGMENTS=20;
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function seeded(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);}
  const random=seeded(113468);
  const grass=[],leaves=[],asset=new Image();
  let debugClock=null;
  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const state={assetReady:false,assetFailed:false,drawCalls:0,grassCount:0,leafCount:0,
    reducedMotion:false,lastWind:0,rigSegments:SEGMENTS,mode:'living-meadow-v2',gpu:false};
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
  const heroPoints=[105,265,455,655,835,1045,1240,1430,1600];
  // Independent brush clusters animate in front of the still-painted field.
  // Density increases near the viewer; GPU instancing keeps the cost stable.
  for(let i=0;i<108;i++){
    const hero=i<heroPoints.length;
    const center=hero?heroPoints[i]:anchors[(i*5)%anchors.length];
    const x=clamp(center+(random()-.5)*(hero?65:240),25,ART_W-25);
    const depth=hero?.67+random()*.24:.10+.90*random();
    let rootY=grassline(x)+28+depth*212;
    rootY=clamp(rootY,635,ART_H+16);
    const variant=hero?(i%3===0?3:0):
      [0,1,3,2,1,0,3,2,0][(i+Math.floor(random()*5))%9];
    const height=hero?170+random()*90:
      (85+random()*115)*(.62+depth*.48);
    const width=hero?126+random()*52:
      (64+random()*92)*(.70+depth*.40);
    grass.push({
      x,rootY,width,height,variant,
      alpha:hero?.82+random()*.12:(.44+random()*.36),
      amplitude:hero?72+random()*46:38+random()*60,
      phase:random()*TAU,stiffness:.80+random()*.38,
      direction:1,hero
    });
  }
  // A few distinct leafy sprays hang from the actual left-hand tree. The
  // source illustration stays untouched: these are independent transparent
  // branch tips above the background, not a duplicate translated canopy.
  for(let i=0;i<13;i++){
    const x=30+random()*355;
    const rootY=38+random()*170;
    leaves.push({
      x,rootY,width:62+random()*75,height:75+random()*80,
      variant:4,alpha:.26+random()*.27,
      amplitude:15+random()*28,phase:random()*TAU,
      stiffness:.74+random()*.40,direction:1,
      angle:.70+(random()-.5)*.8
    });
  }
  state.grassCount=grass.length;
  state.leafCount=leaves.length;

  // Coherent gusts travel across the hillside, affecting neighboring plants
  // together without causing every stalk to mirror the same oscillation.
  function wind(t,x,phase){
    // Gust fronts advance across the meadow. Nearby stems broadly agree
    // on direction, but their crowns respond with slightly different delays.
    const front=Math.sin(t*.88-x*.0081);
    const gust=Math.pow(Math.max(0,Math.sin(t*.35-x*.0032+.65)),3);
    const flutter=.19*Math.sin(t*1.71+x*.012+phase);
    const breathing=.73+.20*Math.sin(t*.19+1.2)+.09*Math.sin(t*.43-.8);
    return (.27+front*.63+gust*.42+flutter)*clamp(breathing,.40,1.04);
  }
  function bend(item,t,q){
    // The first (root) vertex is exactly stationary. The traveling phase
    // introduces delayed motion toward the tip, like a flexible stalk.
    if(q<=0)return 0;
    const delayed=t-q*.34;
    return item.amplitude*item.stiffness*Math.pow(q,1.55)
      *wind(delayed,item.x,item.phase)*item.direction;
  }
  function tip(item,t){
    return {x:item.x+bend(item,t,1),y:item.rootY-item.height};
  }
  // The atlas is decoded once. Every frame, 11 overlapping source rows make
  // a smooth deformation mesh, with the bottom source row anchored at zero.
  function paintSprite(c,item,t){
    c.save();
    c.translate(item.x,item.rootY);
    c.rotate(item.angle||0);
    c.globalAlpha=item.alpha;
    if(!item.hero){
      // Lightweight fallback for distant plants on devices without WebGL2.
      const turn=Math.atan2(bend(item,t,1),item.height)*.78;
      c.rotate(turn);
      c.drawImage(asset,item.variant*TW,0,TW,TH,
        -item.width*.5,-item.height,item.width,item.height);
    }else{
      // Near reeds use actual curved strips, not a rotated flat picture.
      // Source rows overlap slightly to prevent cracks while the root stays
      // fixed. This matches the GPU mesh's height-dependent deformation.
      const n=SEGMENTS;
      for(let k=0;k<n;k++){
        const q0=k/n,q1=(k+1)/n,q=(q0+q1)*.5;
        const sy=(1-q1)*TH,sh=(q1-q0)*TH;
        const x=-item.width*.5+bend(item,t,q);
        c.drawImage(asset,item.variant*TW,sy,TW,sh,x,
          -item.height*q1-.55,item.width,item.height*(q1-q0)+1.1);
      }
    }
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
      c.globalAlpha=personal?.72:1;
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
      wind:wind(t,g.x,g.phase),count:grass.length+leaves.length};
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