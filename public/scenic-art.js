/* Gongang painterly panorama — art-first, with no per-frame procedural landscape generation. */
(() => {
 'use strict';
 const ART_DIR = window.GONGANG_ART_DIR || './assets/';
 const assets={};
 const sizes={width:1672,height:941};
 const files={
   scene:window.matchMedia('(max-width: 700px)').matches?'scenic_overlook_mobile.webp':'scenic_overlook.webp',
   valley:'mountain_depth.webp',
   meadow:'meadow_foreground.webp',
   mistFar:'mist_high.webp',
   mistNear:'mist_low.webp'
 };
 const state={ready:false,loading:true,failed:[],renderCount:0,loadMs:0,pending:0};
 const start=performance.now();
 const loadImage=(url)=>new Promise((resolve,reject)=>{
   const img=new Image();img.decoding='async';
   img.onload=()=>resolve(img);
   img.onerror=()=>reject(new Error('Image unavailable: '+url));
   img.src=url;
 });
 const ready=Promise.all(Object.entries(files).map(async ([key,path])=>{
   try{assets[key]=await loadImage(ART_DIR+path);}catch(error){state.failed.push(key);}
 })).then(()=>{
   state.ready=Boolean(assets.scene);state.loading=false;
   state.loadMs=Math.round(performance.now()-start);
   return state.ready;
 });
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function drawImage(c,img,t,dx=0,scale=1){
   if(!img)return;
   const sw=t.width*scale,sh=t.height*scale;
   c.drawImage(img,t.x-(sw-t.width)/2+dx,t.y-(sh-t.height)/2,sw,sh);
 }
 function draw(c,view,now,options={}){
   if(!state.ready)return false;
   const scroll=clamp(options.scroll||0,-1,1);
   const viewport=options.personal?1.25:1;
   const w=view.width*viewport,h=view.height*viewport;
   // A person looking at the sky should see the upper part of the
   // panorama, not a magnified patch of the foreground meadow.
   const t={
     x:view.x-(w-view.width)*(.5+scroll*.10),
     y:options.personal?view.y-(h-view.height)*.10:view.y,
     width:w,height:h
   };
   state.lastPersonalSourceTop=options.personal
     ?Math.max(0,-t.y/t.height):null;
   drawImage(c,assets.scene,t);
   if(typeof options.onSky === 'function')options.onSky(t);
   const deep=scroll*t.width*.0034;
   drawImage(c,assets.valley,t,deep,1.014);
   const mistPhase=now*.000015;
   drawImage(c,assets.mistFar,t,Math.sin(mistPhase+1.2)*t.width*.009,1.026);
   drawImage(c,assets.mistNear,t,Math.cos(mistPhase*.83+.5)*t.width*.012,1.032);
   drawImage(c,assets.meadow,t,scroll*t.width*.008,1.02);
   // Existing multiplayer world still paints real characters on top.
   // Most stars are baked into the art; only a few stars twinkle live.
   c.save();c.translate(t.x,t.y);c.scale(t.width/sizes.width,t.height/sizes.height);
   for(let i=0;i<38;i++){
     const x=55+((i*521.71)%1)*(sizes.width-110);
     const y=28+((i*71.593)%1)*355;
     const phase=i*5.73;
     const power=.5+.5*Math.sin(now*.0007+phase);
     if(power<.30)continue;
     const radius=(i%7===0?1.25:.6)*(.7+power*.32);
     c.globalAlpha=.065+.22*power;
     c.fillStyle=i%6===0?'#f7d8ff':'#e4f1ff';
     c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.fill();
   }
   c.restore();
   state.renderCount++;
   return true;
 }
 // Compact state exposure for scripted tests and future photo-pipeline integration.
 window.GongangPainterly={assets,state,ready,draw,get readyToDraw(){return state.ready;}};
})();
