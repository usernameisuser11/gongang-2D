/* Gongang 2D — restrained botanical motion over the painted panorama.
   Roots stay fixed. Each tip bends in a smooth, spatially correlated gust.
   No per-frame noise textures, filters, or image-data operations. */
(() => {
  'use strict';
  const W=1672,H=941,TAU=Math.PI*2;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const ease=x=>x*x*(3-2*x);
  function seeded(value){
    let n=value>>>0;
    return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296};
  }
  const r=seeded(903214);
  const grasses=[],leaves=[];
  const grassColors=[
    'rgba(174,190,149,.27)','rgba(120,157,135,.27)',
    'rgba(205,180,134,.22)','rgba(99,142,119,.28)',
    'rgba(169,169,141,.24)'
  ];
  const leafColors=[
    'rgba(42,72,62,.37)','rgba(56,81,67,.34)',
    'rgba(103,106,72,.23)','rgba(130,131,83,.18)',
    'rgba(27,59,57,.39)'
  ];
  // The illustrated foreground already contains plants: draw only sparse,
  // foreground botanical accents; never cover the seated visitors.
  for(let i=0;i<116;i++){
    const u=r(),x=u<.36?35+r()*485:u<.70?520+r()*565:1080+r()*565;
    const gy=u<.36?710+r()*215:u<.70?790+r()*145:760+r()*170;
    const depth=clamp((gy-650)/300,.12,1);
    grasses.push({
      x,y:gy,len:(12+r()*33)*(.63+depth*.62),
      width:.5+r()*.9,lean:(r()-.5)*11,
      phase:r()*TAU,stiffness:.40+r()*.8,
      group:Math.floor(x/160),color:grassColors[Math.floor(r()*grassColors.length)],
      seed:i%13===0
    });
  }
  // Only the outer left branches have movable leaf detail; central stars
  // and the scenic silhouette remain free of extra synthetic decoration.
  for(let i=0;i<58;i++){
    const x=12+r()*467,y=4+r()*255;
    if(x>360&&y>105)continue;
    leaves.push({
      x,y,ang:-.65+r()*2.1,len:5+r()*12,
      width:1.1+r()*2.4,phase:r()*TAU,
      stiffness:.5+r()*.65,group:Math.floor(x/105),
      color:leafColors[Math.floor(r()*leafColors.length)]
    });
  }
  const state={drawCalls:0,grassCount:grasses.length,leafCount:leaves.length,
    reducedMotion:false, lastWind:0};
  const prefersReduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  function wind(t,x,phase=0){
    // Slow air masses, small turbulent variations, and adjacent stems
    // receiving similar gusts. All frequencies are low enough to avoid
    // robotic synchronized swaying and random frame-to-frame jitter.
    const large=Math.sin(t*.42+x*.0021);
    const pulse=Math.sin(t*.17+1.4)+.34*Math.sin(t*.065+.3);
    const detail=Math.sin(t*1.08+x*.009+phase)*.22;
    const gust=Math.max(.12,.48+.28*pulse+.18*large);
    return gust*(.63*large+.33*Math.sin(t*.76+x*.0033+phase*.12)+detail);
  }
  function grassTip(g,t){
    const displacement=wind(t,g.x,g.phase)*g.len*.16*g.stiffness;
    return {x:g.x+g.lean+displacement,y:g.y-g.len};
  }
  function paintGrass(c,g,t){
    const tip=grassTip(g,t);
    // A cubic stem whose first control point stays near the stationary root.
    c.strokeStyle=g.color;c.lineWidth=g.width;c.lineCap='round';
    c.beginPath();c.moveTo(g.x,g.y);
    c.bezierCurveTo(
      g.x+g.lean*.11,g.y-g.len*.31,
      g.x+g.lean*.7+(tip.x-g.x-g.lean)*.64,g.y-g.len*.80,
      tip.x,tip.y
    );
    c.stroke();
    if(!g.seed)return;
    // Delicate feather heads respond to the same wind as their stems.
    const dir=tip.x>g.x?1:-1;
    c.save();c.translate(tip.x,tip.y);c.rotate(-.18*dir);
    c.strokeStyle='rgba(208,200,171,.23)';c.lineWidth=.65;
    for(let n=0;n<6;n++){
      const yy=-n*1.8-.8,xx=dir*(1+n*.45);
      c.beginPath();c.moveTo(0,yy+3);c.quadraticCurveTo(xx*1.8,yy+1,xx*2.7,yy-1);c.stroke();
    }
    c.restore();
  }
  function paintLeaf(c,l,t){
    const gust=wind(t,l.x,l.phase);
    const angle=l.ang+gust*.085*l.stiffness;
    const dx=Math.cos(angle)*l.len,dy=Math.sin(angle)*l.len;
    // Attachment remains at (x,y). Only the outer leaf surface bends.
    c.fillStyle=l.color;c.beginPath();c.moveTo(l.x,l.y);
    c.quadraticCurveTo(l.x+dx*.28-dy*.22,l.y+dy*.28+dx*.12,
                       l.x+dx,l.y+dy);
    c.quadraticCurveTo(l.x+dx*.36+dy*.16,l.y+dy*.36-dx*.11,
                       l.x,l.y);
    c.fill();
  }
  function draw(c,transform,now,{personal=false}={}){
    if(!transform)return;
    const t=now/1000,reduce=Boolean(prefersReduced?.matches);
    state.reducedMotion=reduce;
    const sceneTime=reduce?0:t;
    state.lastWind=wind(sceneTime,720,.7);
    c.save();
    c.translate(transform.x,transform.y);
    c.scale(transform.width/W,transform.height/H);
    // In close sky view the foreground is only a supporting element.
    c.globalAlpha=personal?.48:1;
    for(const g of grasses)paintGrass(c,g,sceneTime);
    for(const l of leaves)paintLeaf(c,l,sceneTime);
    c.restore();
    state.drawCalls++;
  }
  function debugAt(ms=0){
    const g=grasses[0],l=leaves[0];
    return {grassRoot:{x:g.x,y:g.y},grassTip:grassTip(g,ms/1000),
      leafRoot:{x:l.x,y:l.y},count:grasses.length+leaves.length};
  }
  window.GongangNature={draw,state,debugAt};
})();
