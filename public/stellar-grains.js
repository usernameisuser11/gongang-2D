/* Gongang 2D | Stellar Explosion v31.9 grain-texture port
   Ported from the user's original Stellar_Explosion_v31.9_Quasar_RGB_Stable_Finish.html:
   makeQuasarV129StarTexture core=exp(-r*r*11.4), aura=.29*exp(-r*r*4.4),
   smooth 0.82..1.0 feather, soft colored grains, restrained bloom.
   No bundled Three.js or GPU supernova engine: one-time 2D particle field.
*/
(() => {
  'use strict';
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const palette=[
    '#b5eaff', // quasar cyan
    '#82b5f8', // remnant blue
    '#b8a0ef', // ionized violet
    '#edb5d6', // rose
    '#f4dfb8', // warm distant star
    '#dfefff'  // hot blue white
  ];
  function randomMaker(seed){
    return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  }
  function createNativeProfile(){
    // Identical alpha equation to the v31.9's Quasar v129 GPU texture.
    const size=128,canvas=document.createElement('canvas');
    canvas.width=canvas.height=size;
    const c=canvas.getContext('2d',{willReadFrequently:true});
    const image=c.createImageData(size,size);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){
      const dx=(x+.5-size*.5)/(size*.5);
      const dy=(y+.5-size*.5)/(size*.5);
      const rr=Math.hypot(dx,dy);
      const core=Math.exp(-rr*rr*11.4);
      const aura=.29*Math.exp(-rr*rr*4.4);
      const t=clamp((rr-.82)/.18,0,1);
      const feather=1-t*t*(3-2*t);
      const a=clamp((core+aura)*feather,0,1);
      const i=(y*size+x)*4;
      image.data[i]=255;image.data[i+1]=255;image.data[i+2]=255;
      image.data[i+3]=Math.round(255*a);
    }
    c.putImageData(image,0,0);
    return canvas;
  }
  const source=createNativeProfile();
  const sprites=palette.map(tint=>{
    const canvas=document.createElement('canvas');
    canvas.width=canvas.height=128;
    const c=canvas.getContext('2d');
    c.drawImage(source,0,0);
    c.globalCompositeOperation='source-in';
    c.fillStyle=tint;c.fillRect(0,0,128,128);
    return canvas;
  });
  const twinkles=[];
  let fieldSize=0;
  function one(ctx,x,y,size,alpha,tint,bloom=false){
    const sprite=sprites[tint%palette.length];
    if(bloom && size>2.4){
      ctx.globalAlpha=alpha*.14;
      const halo=size*3.45;
      ctx.drawImage(sprite,x-halo*.5,y-halo*.5,halo,halo);
    }
    ctx.globalAlpha=alpha;
    ctx.drawImage(sprite,x-size*.5,y-size*.5,size,size);
  }
  function scatter(ctx,width,height,galaxyAt,visibility=()=>1,options={}){
    const r=randomMaker(915715);
    twinkles.length=0;
    ctx.save();ctx.globalCompositeOperation='screen';
    let count=0;
    // v31.9 separates 8,500 distant space grains from denser remnant
    // particles. We preserve that population distinction on a landscape sky.
    for(let i=0;i<8500;i++){
      const bx=r()*width,by=r()*height*.70;
      const [x,y]=options.projectBackground?.(bx,by) ?? [bx,by];
      const shade=r();
      const tint=shade<.20?4:shade<.51?5:shade<.77?1:2;
      const rare=Math.pow(r(),7);
      const size=.55+rare*4.7;
      const alpha=(.20+r()*.58)*(1-.48*(y/(height*.70))**2);
      if(size<1.25){
        ctx.globalAlpha=alpha*.54;
        ctx.fillStyle=palette[tint];
        ctx.fillRect(x,y,.55+r()*.52,.55+r()*.52);
      }else one(ctx,x,y,size,alpha,tint,size>3.2);
      if(size>2.7 && twinkles.length<95 && r()>.33){
        twinkles.push({x,y,size:size*.72,phase:r()*TAU,tint,alpha:(.14+r()*.14)*visibility(x,y)});
      }
      count++;
    }
    // Across the Milky Way the grains cluster along an irregular tilted
    // channel. Sparse bright individual grains sit on top of faint nebula.
    for(let i=0;i<15700;i++){
      const gy=r()*730;
      const center=1200-1.08*gy;
      const side=(r()+r()+r()-1.5)*348+(r()-.5)*33;
      const gx=center+side;
      const [x,y]=options.projectGalaxy?.(gx,gy) ?? [gx,gy];
      if(x<0||x>=width)continue;
      const dist=Math.abs(side), density=Math.max(.20,1-dist/430);
      const field=galaxyAt?.(x,y);
      // Use the nebula's actual dust lanes, so stars do not fill in its shadows.
      const transmission=field?(.30+field.light*1.7)*(1-field.dust*.86):1;
      const hue=r();
      const tint=hue<.29?1:hue<.52?2:hue<.70?0:hue<.84?3:5;
      const rare=Math.pow(r(),6.3);
      const size=.62+rare*4.9;
      const alpha=(.18+r()*.59)*(.4+.6*density)*transmission;
      if(size<1.26){
        ctx.globalAlpha=alpha*.58;
        ctx.fillStyle=palette[tint];ctx.fillRect(x,y,.58+r()*.44,.58+r()*.44);
      }else one(ctx,x,y,size,alpha,tint,size>3);
      if(size>3.1 && twinkles.length<155 && r()>.38){
        twinkles.push({x,y,size:size*.78,phase:r()*TAU,tint,alpha:(.16+r()*.16)*transmission*visibility(x,y)});
      }
      count++;
    }
    ctx.restore();
    fieldSize=count;
    return count;
  }
  function animate(ctx,now){
    if(!twinkles.length)return;
    ctx.save();ctx.globalCompositeOperation='screen';
    for(const star of twinkles){
      // The original shader uses ~2.5% shimmer, not blinking every grain.
      const pulse=.975+.025*Math.sin(now*.00036+star.phase);
      const brighter=.60+.40*Math.sin(now*.00065+star.phase*3.1)**2;
      one(ctx,star.x,star.y,star.size*1.35,star.alpha*pulse*brighter,star.tint,false);
    }
    ctx.restore();
  }
  window.StellarGrains={
    paint:scatter,animate,
    getDebug(){return{source:'Stellar Explosion v31.9 / Quasar v129 profile',grainCount:fieldSize,animatedGrains:twinkles.length,textureSize:128,palette:palette.slice()}}
  };
})();
