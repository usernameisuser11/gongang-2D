/* 공강 2D · 별빛 전망대 — living landscape, never simulated visitors */
(() => {
  'use strict';
  const WIDTH=1920,HEIGHT=1080;
  const TAU=Math.PI*2;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const smooth=(a,b,t)=>{const q=clamp((t-a)/(b-a),0,1);return q*q*(3-2*q)};
  function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}};
  function hash(n){let x=(Math.imul(n^0x45d9f3b,2654435761)>>>0);x^=x>>>16;return(x>>>0)/4294967295}
  const random=seeded(20261108);
  let base=null,scenicLayers=null,stars=[],event=null,view='wide',clockOffset=0,lastUi=0,buttonBar=null;
  const metrics={rendered:0,staticLayers:0,buildMs:0};
  function glow(c,x,y,r,inner,outer,opacity=1){
    c.save();c.globalAlpha=opacity;
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,inner);g.addColorStop(1,outer);
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
  }
  // Shared, deterministic density fields: baked once, never sampled per frame.
  function noise2(x,y){
    const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
    const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
    const h=(a,b)=>hash(Math.imul(a,374761393)^Math.imul(b,668265263));
    return (h(ix,iy)*(1-u)+h(ix+1,iy)*u)*(1-v)+
      (h(ix,iy+1)*(1-u)+h(ix+1,iy+1)*u)*v;
  }
  function fbm(x,y){
    let value=0,weight=.533;
    for(let i=0;i<4;i++){
      value+=noise2(x,y)*weight;
      const nx=x*1.68+y*1.18+17.1;
      y=y*1.68-x*1.18+9.2;x=nx;weight*=.5;
    }
    return value;
  }
  function galaxyAt(x,y){
    const warp=(fbm(x*.003+31,y*.004+7)-.5)*150;
    const center=1200-1.08*y+warp;
    const side=x-center;
    const broad=Math.exp(-((side/235)**2));
    const core=Math.exp(-((side/105)**2));
    const clouds=fbm(x*.009+8,y*.011+21);
    const fine=fbm(x*.032+13,y*.029+3);
    const laneCenter=25+55*Math.sin(y*.008)+(clouds-.5)*100;
    const lane=Math.exp(-(((side-laneCenter)/(19+clouds*34))**2));
    const split=Math.exp(-(((side+67+Math.sin(y*.014)*24)/17)**2))*.42;
    const fragments=fbm(x*.018+71,y*.016+12);
    const dust=clamp((lane*.78+split*.65)*smooth(.20,.72,fragments),0,.78);
    const light=(broad*(.15+clouds*.8)+core*.20)*(1-dust*.88)*(.65+fine*.72);
    return {light,dust,broad,fine};
  }
  const cloudbanks=[
    // Offset banks leave an open window onto the galactic core.
    [170,448,310,75,.80],[1490,470,390,92,.86],
    [550,643,355,50,.42],[1120,610,265,49,.46]
  ];
  function cloudDensity(x,y,bank){
    const [cx,cy,rx,ry]=bank,u=(x-cx)/rx,v=(y-cy)/ry;
    const n=fbm(x*.009+cx*.03,y*.018+19);
    const billow=noise2(x*.016+5,y*.023+cx);
    const shape=1-u*u-(v+.18*Math.sin(u*8)+.14*(billow-.5))**2;
    return smooth(.03,.72,shape+(n-.5)*1.35)*(.40+n*.60);
  }
  function skyVisibility(x,y){
    if(y>ridgeY(x,756,101,1.1)-3)return 0;
    let transmission=1;
    for(const bank of cloudbanks){
      if(Math.abs(x-bank[0])<bank[2]*1.15&&Math.abs(y-bank[1])<bank[3]*1.4)
        transmission*=1-cloudDensity(x,y,bank)*bank[4]*.94;
    }
    return transmission;
  }
  function paintClouds(c){
    for(const bank of cloudbanks){
      const [cx,cy,rx,ry,opacity]=bank;
      const w=Math.ceil(rx*1.2),h=Math.ceil(ry*1.5);
      const layer=document.createElement('canvas');layer.width=w;layer.height=h;
      const p=layer.getContext('2d'),im=p.createImageData(w,h);
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const x=cx-rx*1.2+i*2,y=cy-ry*1.5+j*2;
        const d=cloudDensity(x,y,bank);
        if(d<.005)continue;
        // Finite differences give cloud tops silver light and dense bases shade.
        const lit=clamp(.43+(d-cloudDensity(x-11,y-15,bank))*2.8,0,1);
        const height=clamp((cy-y)/ry*.5+.5,0,1);
        const detail=fbm(x*.045+4,y*.052+6);
        const tone=clamp(lit*.65+height*.25+detail*.15,0,1),n=(j*w+i)*4;
        im.data[n]=40+tone*113;im.data[n+1]=57+tone*119;im.data[n+2]=91+tone*119;
        im.data[n+3]=Math.round(d*opacity*239);
      }
      p.putImageData(im,0,0);
      c.drawImage(layer,cx-rx*1.2,cy-ry*1.5,w*2,h*2);
    }
  }
  function paintNebula(c){
    const w=960,h=395,layer=document.createElement('canvas');
    layer.width=w;layer.height=h;
    const p=layer.getContext('2d'),pixels=p.createImageData(w,h);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){
      const x=i*2,y=j*2,{light,broad,fine}=galaxyAt(x,y);
      const warm=smooth(170,720,y),grain=(noise2(x*.31,y*.31)-.5)*.035*broad;
      const n=(j*w+i)*4;
      pixels.data[n]=146+warm*86+fine*14;
      pixels.data[n+1]=167+warm*24+fine*20;
      pixels.data[n+2]=237-warm*24;
      pixels.data[n+3]=Math.round(clamp(light*.70+grain,0,1)*255);
    }
    p.putImageData(pixels,0,0);
    c.save();c.globalCompositeOperation='screen';
    c.drawImage(layer,0,0,WIDTH,790);c.restore();
  }
  function paintCirrus(c){
    const r=seeded(2118);
    c.save();c.lineCap='round';
    for(let i=0;i<38;i++){
      const x=r()*2100-130,y=375+r()*350,len=45+r()*210;
      const opacity=.011+r()*.030;
      c.strokeStyle=i%4?'rgba(180,194,232,'+opacity.toFixed(3)+')':
        'rgba(243,191,213,'+opacity.toFixed(3)+')';
      c.lineWidth=.6+r()*2.3;
      c.beginPath();c.moveTo(x,y);
      c.bezierCurveTo(x+len*.26,y-10-r()*26,x+len*.55,y+25-r()*35,x+len,y-18-r()*20);
      c.stroke();
    }
    c.restore();
  }
  function paintMountainDetail(c,baseY,amp,seed){
    const r=seeded(Math.round(seed*1731));
    const far=seed===1.1,near=seed===5.4;
    c.save();
    // Every rock facet is clipped beneath the same irregular mountain crest.
    c.beginPath();c.moveTo(0,HEIGHT);
    for(let x=0;x<=WIDTH;x+=3)c.lineTo(x,ridgeY(x,baseY,amp,seed));
    c.lineTo(WIDTH,HEIGHT);c.closePath();c.clip();
    const layer=document.createElement('canvas'),w=960,h=220;
    layer.width=w;layer.height=h;
    const p=layer.getContext('2d'),im=p.createImageData(w,h);
    const top=baseY-amp*1.7;
    for(let i=0;i<w;i++){
      const x=i*2,crest=ridgeY(x,baseY,amp,seed);
      const slope=(ridgeY(x+42,baseY,amp,seed)-ridgeY(x-42,baseY,amp,seed))/84;
      for(let j=0;j<h;j++){
        const y=top+j*2,depth=y-crest;if(depth<0)continue;
        const drift=x*.013+depth*(.003+slope*.006);
        const folds=fbm(drift,y*.010+seed*19);
        const light=clamp(.46-slope*.24+(folds-.48)*1.65,0,1);
        const texture=fbm(x*.065+seed,y*.047);
        const fade=1-smooth(80,300,depth);
        const n=(j*w+i)*4;
        // Broad asymmetrical faces, fine gullies, increasingly veiled by distance.
        im.data[n]=far?83+light*62:near?15+light*40:31+light*59;
        im.data[n+1]=far?104+light*57:near?44+light*45:64+light*55;
        im.data[n+2]=far?140+light*46:near?65+light*43:96+light*55;
        im.data[n+3]=(far?.38:near?.46:.57)*fade*(.80+texture*.3)*255;
      }
    }
    p.putImageData(im,0,0);c.drawImage(layer,0,top,WIDTH,h*2);
    // Broad straight folds removed: they read as artificial ruled lines.
    // Granular rock-and-forest tones: irregular, subtle, and fully clipped.
    for(let i=0;i<(far?750:near?2350:1550);i++){
      const x=r()*WIDTH,top=ridgeY(x,baseY,amp,seed),depth=8+r()*210;
      const y=top+depth;
      if(y>=HEIGHT)continue;
      const spread=far?.9:near?2.9:1.8;
      c.fillStyle=i%4===0?'rgba(160,184,198,.060)':
        i%3===0?'rgba(65,103,128,.10)':'rgba(15,39,61,.095)';
      c.beginPath();c.ellipse(x,y,spread*(.3+r()),.5+r()*2.8,r()*.5,0,TAU);c.fill();
    }
    c.restore();
    if(near){
      // Tiny spruce silhouettes along selected ridges add scale and break a
      // featureless flat mountain edge; cached in the background.
      const t=seeded(66112);
      c.save();
      for(let i=0;i<390;i++){
        const x=t()*WIDTH,top=ridgeY(x,baseY,amp,seed);
        const h=3+t()*12,w=.9+t()*2.8;
        c.fillStyle=t()>.53?'rgba(16,44,62,.45)':'rgba(22,54,68,.42)';
        c.beginPath();c.moveTo(x,top-h);c.lineTo(x-w,top+2);
        c.lineTo(x+w,top+2);c.fill();
      }
      c.restore();
    }
  }
  function paintAerialHaze(c,y,spread,color){
    const g=c.createLinearGradient(0,y-spread,0,y+spread);
    g.addColorStop(0,'rgba(135,168,215,0)');
    g.addColorStop(.50,color);
    g.addColorStop(1,'rgba(96,138,179,0)');
    c.fillStyle=g;c.fillRect(0,y-spread,WIDTH,spread*2);
  }

  function paintMilkyWay(c){
    const dust=seeded(17352);
    c.save();
    c.globalCompositeOperation='screen';
    // Controlled diffuse nebula knots. Too many blended glows create a flat
    // white beam, so the core is particulate rather than uniformly luminous.
    for(let i=0;i<85;i++){
      const y=dust()*720,x=1195-1.08*y+(dust()-.5)*290;
      const radius=24+dust()*91;
      const core=i%3===0?'rgba(214,149,212,.050)':
        i%3===1?'rgba(114,174,244,.046)':'rgba(154,141,235,.048)';
      glow(c,x,y,radius,core,'rgba(44,62,136,0)',.36+dust()*.56);
    }
    c.restore();

    // The generated nebula texture carries irregular dust gaps itself.
    // Do not paint hard vector lanes over it: those look like giant slashes.

    // More individual celestial grains, brighter near the textured core.
    const points=seeded(731663);
    for(let i=0;i<17200;i++){
      const y=points()*765;
      const x=1195-1.08*y+
        (points()+points()+points()-1.5)*345;
      if(x<0||x>=WIDTH)continue;
      const a=.06+.66*points()**1.8;
      const size=.28+points()**3*1.24;
      c.fillStyle=points()>.74?'rgba(253,217,231,'+a.toFixed(3)+')':
        points()>.44?'rgba(186,218,255,'+a.toFixed(3)+')':
        'rgba(238,237,255,'+a.toFixed(3)+')';
      c.fillRect(x,y,size,size);
    }
  }
  // Mountain profiles are hand-composed nonperiodic summit/saddle lines.
  // No repeated sine-wave ridges: far peaks, asymmetrical faces, fractured
  // crests and valleys remain coherent in every atmospheric depth layer.
  const mountainAnchors={
    '1.1':[[0,.18],[.07,-.15],[.145,-.28],[.205,-.66],[.247,-1.22],
      [.265,-1.10],[.285,-1.28],[.323,-.68],[.365,-.35],[.43,-.12],
      [.51,-.43],[.562,-.90],[.592,-1.02],[.628,-1.55],[.652,-1.31],
      [.68,-.81],[.729,-.49],[.78,-.22],[.846,-.57],[.902,-.72],
      [.94,-1.03],[.964,-.89],[1,-.78]],
    '2.7':[[0,-.40],[.063,-.13],[.124,-.46],[.172,-.79],[.216,-1.26],
      [.238,-1.13],[.273,-.59],[.335,-.15],[.403,.06],[.461,-.42],
      [.498,-.96],[.532,-1.29],[.564,-1.10],[.617,-.74],[.675,-.22],
      [.721,-.40],[.771,-1.03],[.807,-1.39],[.836,-1.22],[.871,-.74],
      [.934,-.39],[1,-.18]],
    '5.4':[[0,-.20],[.09,-.32],[.16,-.47],[.207,-.94],[.245,-.76],
      [.30,-.40],[.40,-.16],[.47,-.67],[.509,-1.08],[.54,-.96],
      [.59,-.62],[.66,-.31],[.713,-.57],[.735,-.72],[.80,-.20],
      [.85,-.58],[.89,-1.04],[.919,-.86],[.955,-.57],[1,-.40]]
  };
  function mountainHash(i,seed){
    let n=Math.imul(i+Math.floor(seed*1907),374761393);
    n=Math.imul(n^(n>>>13),1274126177);
    return ((n^(n>>>16))>>>0)/4294967295;
  }
  function mountainNoise(p,frequency,seed){
    const pos=p*frequency,cell=Math.floor(pos),f=pos-cell;
    const eased=f*f*(3-2*f);
    return mountainHash(cell,seed)*(1-eased)+mountainHash(cell+1,seed)*eased-.5;
  }
  function ridgeY(x,baseY,amp,seed){
    const t=clamp(x/WIDTH,0,1);
    const anchors=mountainAnchors[String(seed)]||mountainAnchors['1.1'];
    let lo=0;
    while(lo+1<anchors.length-1 && t>anchors[lo+1][0])lo++;
    const left=anchors[lo],right=anchors[lo+1];
    const u=clamp((t-left[0])/(right[0]-left[0]),0,1);
    const before=anchors[Math.max(0,lo-1)],after=anchors[Math.min(anchors.length-1,lo+2)];
    const delta=(right[1]-left[1])/(right[0]-left[0]);
    const prev=(left[1]-before[1])/(left[0]-before[0]||1);
    const next=(after[1]-right[1])/(after[0]-right[0]||1);
    const limit=Math.abs(delta)*2.15;
    const m0=lo===0?delta:prev*delta<=0?0:clamp((prev+delta)*.5,-limit,limit);
    const m1=lo+2>=anchors.length?delta:delta*next<=0?0:clamp((delta+next)*.5,-limit,limit);
    const u2=u*u,u3=u2*u,span=right[0]-left[0];
    const rounded=(2*u3-3*u2+1)*left[1]+(u3-2*u2+u)*span*m0+
      (-2*u3+3*u2)*right[1]+(u3-u2)*span*m1;
    const main=rounded*.72+(left[1]+(right[1]-left[1])*u)*.28;
    const detail=mountainNoise(t,22,seed)*.30+
      mountainNoise(t,57,seed+2)*.14+
      mountainNoise(t,157,seed+3)*.06+
      mountainNoise(t,349,seed+4)*.018;
    const summitRoughness=.52+.48*Math.min(1,Math.abs(main)*.75);
    return baseY+amp*(main+detail*summitRoughness);
  }
  function paintRidge(c,baseY,amp,top,bottom,seed){
    c.save();c.beginPath();c.moveTo(0,HEIGHT);
    for(let x=0;x<=WIDTH;x+=2)c.lineTo(x,ridgeY(x,baseY,amp,seed));
    c.lineTo(WIDTH,HEIGHT);c.closePath();
    const gradient=c.createLinearGradient(0,baseY-amp*1.5,0,HEIGHT);
    gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);
    c.fillStyle=gradient;c.fill();c.restore();
  }
  function meadowY(x){
    const p=x/WIDTH;
    return 965-172*p+12*Math.sin(p*9.3+.8)+8*Math.sin(p*23.7);
  }
  function paintMeadow(c){
    c.beginPath();c.moveTo(0,HEIGHT);
    for(let x=0;x<=WIDTH;x+=6)c.lineTo(x,meadowY(x));
    c.lineTo(WIDTH,HEIGHT);c.closePath();
    const g=c.createLinearGradient(0,735,0,HEIGHT);
    g.addColorStop(0,'#4d786c');g.addColorStop(.34,'#366659');g.addColorStop(.72,'#245045');g.addColorStop(1,'#102f38');
    c.fillStyle=g;c.fill();
    const r=seeded(798112);
    // Several scales of grass; lean and clumps avoid a repetitive texture.
    for(let i=0;i<11700;i++){
      const x=r()*WIDTH,y=r()*HEIGHT;
      if(y<meadowY(x))continue;
      const depth=clamp((y-meadowY(x))/(HEIGHT-meadowY(x)),0,1);
      const length=1.6+(3+14*depth)*r(),lean=(r()-.5)*(3+9*depth);
      const shade=r();
      c.strokeStyle=shade>.58?'rgba(161,195,149,'+(.095+r()*.30).toFixed(3)+')':
        shade>.26?'rgba(93,150,133,'+(.075+r()*.22).toFixed(3)+')':
        'rgba(43,97,93,'+(.12+r()*.30).toFixed(3)+')';
      c.lineWidth=.55+r()*(.5+depth*.95);
      c.beginPath();c.moveTo(x,y);
      c.quadraticCurveTo(x+lean*.24,y-length*.56,x+lean,y-length);
      c.stroke();
      if(r()<.044){
        c.fillStyle=r()>.51?'rgba(237,216,177,.55)':'rgba(181,187,221,.44)';
        c.beginPath();c.ellipse(x+lean,y-length,1.1+r()*2.0,1.2+r()*2.0,r()*6.28,0,TAU);c.fill();
      }
    }
    // Painterly moonlit curved blades on the crest catch distant blue light.
    c.beginPath();
    for(let x=0;x<=WIDTH;x+=5){const y=meadowY(x);if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}
    c.strokeStyle='rgba(180,222,190,.47)';c.lineWidth=2.1;c.stroke();
    // Long flower and feather-grass silhouettes in the near field.
    for(let i=0;i<450;i++){
      const x=r()*WIDTH,y=meadowY(x)+10+r()*185;
      if(y>HEIGHT-1)continue;
      const h=10+r()*38,tilt=(r()-.5)*21;
      c.strokeStyle=i%3===0?'rgba(167,193,169,.33)':'rgba(97,152,136,.27)';
      c.lineWidth=.8+r()*1.3;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+tilt*.3,y-h*.63,x+tilt,y-h);c.stroke();
      if(i%4===0){
        c.fillStyle=i%2?'rgba(208,200,206,.25)':'rgba(225,193,155,.24)';
        for(let k=0;k<4;k++){
          c.beginPath();c.ellipse(x+tilt*(k/4),y-h*(.58+k*.1),2+r()*1.6,1.2,tilt*.015,0,TAU);c.fill();
        }
      }
    }
    // Dew-dusted ground, concentrated near the best viewpoints.
    for(let i=0;i<560;i++){
      const x=r()*WIDTH,y=meadowY(x)+r()*45;
      c.fillStyle='rgba(253,233,187,'+(.075+r()*.23).toFixed(3)+')';
      c.beginPath();c.arc(x,y,.4+r()*1.3,0,TAU);c.fill();
    }
  }
  function paintFramingTree(c){
    // An old moonlit tree frames the right edge but never masks the Milky Way.
    c.save();c.lineCap='round';c.lineJoin='round';
    c.strokeStyle='#152c3d';c.lineWidth=72;
    c.beginPath();c.moveTo(1984,935);c.bezierCurveTo(1918,682,1909,450,1795,262);c.stroke();
    c.lineWidth=35;c.strokeStyle='#203749';
    c.beginPath();c.moveTo(1826,338);c.bezierCurveTo(1715,190,1568,165,1442,132);c.stroke();
    c.lineWidth=23;c.beginPath();c.moveTo(1883,515);c.bezierCurveTo(1765,392,1634,364,1532,366);c.stroke();
    c.lineWidth=17;c.beginPath();c.moveTo(1796,278);c.bezierCurveTo(1722,102,1755,45,1666,-80);c.stroke();
    const rnd=seeded(3657);
    for(const [cx,cy,rx,ry] of [
      [1740,84,220,88],[1530,87,164,76],[1735,247,130,63],
      [1860,18,165,96],[1645,304,120,60],[1950,176,105,116]
    ]){
      for(let i=0;i<255;i++){
        const a=rnd()*TAU,rad=Math.sqrt(rnd()),xx=cx+Math.cos(a)*rad*rx,yy=cy+Math.sin(a)*rad*ry;
        const ww=2+rnd()*10,hh=1.6+rnd()*5;
        c.fillStyle=['rgba(39,76,76,.70)','rgba(48,89,87,.58)','rgba(68,111,108,.50)','rgba(105,128,115,.40)'][Math.floor(rnd()*4)];
        c.beginPath();c.ellipse(xx,yy,ww,hh,rnd()*.8-.4,0,TAU);c.fill();
      }
    }
    // Only a whisper of amber, as a resting place rather than a carnival.
    const x=1885,y=317;
    c.strokeStyle='rgba(165,137,97,.57)';c.lineWidth=2;c.beginPath();c.moveTo(x,y-74);c.lineTo(x,y-20);c.stroke();
    glow(c,x,y,90,'rgba(255,197,122,.23)','rgba(255,182,101,0)');
    c.fillStyle='rgba(255,220,159,.80)';
    c.beginPath();c.moveTo(x-10,y-20);c.lineTo(x+10,y-20);c.lineTo(x+15,y+10);c.lineTo(x-15,y+10);c.closePath();c.fill();
    c.strokeStyle='#4c4b43';c.lineWidth=3;c.stroke();
    c.restore();
  }
  function paintValley(c){
    // A river far below the grassy viewpoint, with warm scattered town lights.
    const g=c.createLinearGradient(600,760,940,900);
    g.addColorStop(0,'rgba(97,148,189,0)');
    g.addColorStop(.48,'rgba(84,146,180,.31)');
    g.addColorStop(1,'rgba(124,183,190,0)');
    c.save();c.beginPath();
    c.moveTo(940,765);c.bezierCurveTo(690,794,1030,821,770,852);
    c.bezierCurveTo(590,872,855,893,630,929);
    c.lineTo(790,928);
    c.bezierCurveTo(1010,886,705,871,985,851);
    c.bezierCurveTo(1150,822,875,795,1085,777);
    c.closePath();c.fillStyle=g;c.fill();c.restore();
    const r=seeded(618);
    for(let i=0;i<360;i++){
      const x=r()*WIDTH, ridge=ridgeY(x,901,90,5.4);
      const y=ridge-9+r()*75;
      if(y>meadowY(x)-35)continue;
      const a=.15+.60*r()**2;
      c.fillStyle='rgba(255,200,121,'+a.toFixed(3)+')';
      c.fillRect(x,y,.6+r()*2.1,.6+r()*1.5);
    }
  }

  // Fog hangs inside the valley rather than looking like a translucent
  // rectangle on top of the scene. Everything here is painted only once.
  function paintValleyMist(c,near=false){
    const r=seeded(near?936271:752144);
    const y=near?864:796;
    const hues=near
      ? ['157,190,201','139,167,200','199,187,209']
      : ['165,180,211','150,171,207','205,177,209'];
    c.save();
    for(let i=0;i<(near?46:37);i++){
      const x=-145+r()*2220;
      const cy=y+(r()-.5)*(near?73:57);
      const rx=95+r()*(near?205:280);
      const ry=12+r()*(near?36:44);
      c.save();c.translate(x,cy);c.scale(1,ry/rx);
      const shade=hues[Math.floor(r()*hues.length)];
      const g=c.createRadialGradient(0,0,0,0,0,rx);
      g.addColorStop(0,'rgba('+shade+','+(near?.055:.042)+')');
      g.addColorStop(.53,'rgba('+shade+','+(near?.039:.032)+')');
      g.addColorStop(1,'rgba('+shade+',0)');
      c.fillStyle=g;c.fillRect(-rx,-rx,rx*2,rx*2);
      c.restore();
    }
    const glowBand=c.createLinearGradient(0,y-62,0,y+86);
    glowBand.addColorStop(0,'rgba(161,182,218,0)');
    glowBand.addColorStop(.52,near?'rgba(170,183,206,.043)':'rgba(179,185,214,.033)');
    glowBand.addColorStop(1,'rgba(123,166,195,0)');
    c.fillStyle=glowBand;c.fillRect(0,y-62,WIDTH,148);
    c.restore();
  }
  // A small number of moonlit resting clearings, still entirely natural.
  function paintRestingMeadow(c){
    const r=seeded(408112);
    const places=[
      [410,64,135],[855,57,190],[1305,56,150],[1680,46,105]
    ];
    for(const [x,down,w] of places){
      const y=meadowY(x)+down;
      c.save();c.translate(x,y);c.scale(1,.22);
      const g=c.createRadialGradient(0,0,2,0,0,w);
      g.addColorStop(0,'rgba(190,210,171,.16)');
      g.addColorStop(.40,'rgba(137,187,166,.095)');
      g.addColorStop(.80,'rgba(90,145,144,.032)');
      g.addColorStop(1,'rgba(90,145,144,0)');
      c.fillStyle=g;c.fillRect(-w,-w,w*2,w*2);c.restore();
      // Irregular clumps break up the oval without drawing man-made pads.
      for(let k=0;k<68;k++){
        const xx=x+(r()-.5)*w*1.9,yy=y+(r()-.5)*34;
        const h=2+r()*9;
        c.strokeStyle=r()>.5?'rgba(193,213,162,.18)':'rgba(112,175,157,.14)';
        c.lineWidth=.6+r()*.6;
        c.beginPath();c.moveTo(xx,yy);
        c.quadraticCurveTo(xx-2,yy-h*.6,xx+(r()-.5)*5,yy-h);c.stroke();
      }
    }
  }
  function paintNearSilhouettes(c){
    const r=seeded(428971),horizon=HEIGHT-22;
    // Free-form dark foliage frames only the outer corners, never the
    // travellers' central viewing area or the Milky Way.
    const zones=[
      {x:-70,y:1040,rx:250,ry:104},
      {x:WIDTH+70,y:1035,rx:220,ry:116}
    ];
    for(const z of zones){
      for(let i=0;i<240;i++){
        const angle=r()*TAU,amount=Math.sqrt(r());
        const x=z.x+Math.cos(angle)*z.rx*amount;
        const y=z.y+Math.sin(angle)*z.ry*amount;
        const a=.12+r()*.25;
        c.fillStyle=i%4===0?'rgba(18,41,52,'+a.toFixed(3)+')':
          'rgba(11,35,47,'+a.toFixed(3)+')';
        c.beginPath();c.ellipse(x,y,5+r()*25,2+r()*9,angle*.14,0,TAU);c.fill();
      }
    }
    for(let i=0;i<300;i++){
      const side=i%2===0;
      const x=side?1+r()*340:WIDTH-1-r()*310;
      const y=horizon+(r()-.5)*125;
      const ht=9+r()*48,lean=(r()-.5)*24+(side?8:-8);
      const a=.15+r()*.43;
      c.strokeStyle=i%5===0?'rgba(111,151,137,'+(a*.50).toFixed(3)+')':
        'rgba(17,48,58,'+a.toFixed(3)+')';
      c.lineWidth=.7+r()*2.4;
      c.beginPath();c.moveTo(x,y);
      c.quadraticCurveTo(x+lean*.16,y-ht*.65,x+lean,y-ht);
      c.stroke();
      if(i%12===0){
        c.fillStyle='rgba(198,198,181,'+(.13+r()*.19).toFixed(3)+')';
        c.beginPath();c.ellipse(x+lean,y-ht,1+r()*3,1+r()*3.8,.2,0,TAU);c.fill();
      }
    }
    // Rare pointed leaves and stems at the very bottom create a lens-like
    // foreground edge without the chunky triangles used in older versions.
    for(let i=0;i<45;i++){
      const x=r()*WIDTH,y=HEIGHT+8,ht=4+r()*31,lean=(r()-.5)*16;
      c.fillStyle='rgba(11,37,45,'+(.20+r()*.31).toFixed(3)+')';
      c.beginPath();c.moveTo(x-2,y);c.quadraticCurveTo(x+lean,y-ht*.64,x+lean,y-ht);
      c.quadraticCurveTo(x+lean+4,y-ht*.50,x+5,y);c.closePath();c.fill();
    }
  }

  // The painterly landscape is baked as independently composed canvases.
  // Starfield and mountains are never regenerated on camera or photo changes.
  function scenicCanvas(paint,opaque=false,scale=1){
    const image=document.createElement('canvas');
    image.width=Math.round(WIDTH*scale);
    image.height=Math.round(HEIGHT*scale);
    const c=image.getContext('2d',{alpha:!opaque});
    if(scale!==1)c.scale(scale,scale);
    paint(c);return image;
  }
  function build(){
    const started=performance.now();
    const sky=scenicCanvas(c=>{
      const g=c.createLinearGradient(0,0,0,HEIGHT);
      for(const [p,col] of [[0,'#060e26'],[.25,'#101c3d'],[.50,'#263d69'],
        [.66,'#5b6692'],[.75,'#9884a2'],[.81,'#c995a4'],[1,'#273e65']])
        g.addColorStop(p,col);
      c.fillStyle=g;c.fillRect(0,0,WIDTH,HEIGHT);
      glow(c,670,820,500,'rgba(247,154,157,.16)','rgba(231,121,168,0)');
      paintNebula(c);
      if(window.StellarGrains)window.StellarGrains.paint(c,WIDTH,HEIGHT,galaxyAt,skyVisibility);
      else paintMilkyWay(c);
      stars=[];
      if(!window.StellarGrains){
        const r=seeded(71526);
        for(let i=0;i<2200;i++){
          const x=r()*WIDTH,y=r()*800,sz=.25+r()**5*1.7,a=.14+r()*.8;
          c.fillStyle='rgba(217,232,255,'+a.toFixed(3)+')';
          c.fillRect(x,y,sz,sz);
          if(i%29===0)glow(c,x,y,7,'rgba(186,213,255,.18)','rgba(186,213,255,0)');
          if(i%31===0)stars.push({x,y,r:.6+r()*1.6,phase:r()*TAU});
        }
      }
    },true);
    const clouds=scenicCanvas(c=>{
      paintCirrus(c);paintClouds(c);
      glow(c,530,725,430,'rgba(237,153,190,.13)','rgba(233,127,192,0)',.65);
    });
    const distant=scenicCanvas(c=>{
      paintRidge(c,756,101,'#66829d','#365574',1.1);
      paintMountainDetail(c,756,101,1.1);
      paintAerialHaze(c,781,57,'rgba(155,178,214,.089)');
    });
    const mistFar=scenicCanvas(c=>paintValleyMist(c,false),false,.5);
    const middle=scenicCanvas(c=>{
      paintRidge(c,828,106,'#3d6585','#173f61',2.7);
      paintMountainDetail(c,828,106,2.7);
      paintAerialHaze(c,855,48,'rgba(160,190,216,.068)');
    });
    const mistNear=scenicCanvas(c=>paintValleyMist(c,true),false,.5);
    const near=scenicCanvas(c=>{
      paintRidge(c,901,90,'#23536b','#12394e',5.4);
      paintMountainDetail(c,901,90,5.4);
      paintValley(c);
    });
    const foreground=scenicCanvas(c=>{
      paintMeadow(c);
      paintRestingMeadow(c);
      paintFramingTree(c);
    });
    const silhouettes=scenicCanvas(c=>paintNearSilhouettes(c),false,.5);
    scenicLayers={sky,clouds,distant,mistFar,middle,mistNear,near,foreground,silhouettes};
    base=sky;
    metrics.staticLayers++;
    metrics.layerCount=9;
    metrics.cachedMegabytes=Object.values(scenicLayers).reduce((bytes,img)=>
      bytes+img.width*img.height*4,0)/(1024*1024);
    metrics.buildMs=performance.now()-started;
    return sky;
  }
  function paintParallaxLayer(c,layer,t,shift=0,overscan=0){
    // A small overscan hides strips at the edges when the viewpoint changes.
    const pad=overscan*t.width;
    c.drawImage(layer,t.x-pad+shift,t.y,t.width+pad*2,t.height);
  }
  function drawMeteor(c,t,fx,fy,scale=1,color='#dceeff'){
    const x=fx*WIDTH,y=fy*HEIGHT;
    const headX=x+t*230*scale,headY=y+t*82*scale;
    if(t<0||t>1.3)return;
    const a=Math.min(1,t*3,(1.3-t)*2);
    c.save();c.globalAlpha=clamp(a,0,1);
    const trail=c.createLinearGradient(headX-155*scale,headY-55*scale,headX,headY);
    trail.addColorStop(0,'rgba(115,155,255,0)');trail.addColorStop(.65,color);trail.addColorStop(1,'#ffffff');
    c.strokeStyle=trail;c.lineCap='round';c.lineWidth=2.2*scale;
    c.beginPath();c.moveTo(headX-155*scale,headY-55*scale);c.lineTo(headX,headY);c.stroke();
    glow(c,headX,headY,18*scale,'rgba(225,241,255,.55)','rgba(166,211,255,0)');
    c.restore();
  }
  function fireworks(c,seconds,seed){
    const random=seeded(seed);
    for(let i=0;i<8;i++){
      const x=(.25+random()*.54)*WIDTH,y=(.17+random()*.28)*HEIGHT;
      const cr=['#ffd9a0','#b6d9f5','#efb9d8','#d9c1ff','#b4f0dc'][i%5];
      const age=seconds-i*1.65;
      if(age<0||age>3.2)continue;
      const opacity=Math.min(1,age*2.3,(3.2-age)*.58);
      c.save();c.globalAlpha=clamp(opacity,0,1);
      for(let n=0;n<36;n++){
        const ang=n*TAU/36+random()*.12,vel=47+random()*82;
        const radius=(.22+Math.sqrt(age)*.58)*vel;
        const px=x+Math.cos(ang)*radius;
        const py=y+Math.sin(ang)*radius+age*age*9;
        c.strokeStyle=n%5===0?'#fff3df':cr;c.lineWidth=n%4===0?2.8:1.6;
        c.beginPath();c.moveTo(px,py);c.lineTo(px-Math.cos(ang)*11,py-Math.sin(ang)*11);c.stroke();
      }
      glow(c,x,y,110,'rgba(255,210,155,.11)','rgba(255,210,155,0)',opacity);
      c.restore();
    }
  }
  function drawSkyEffects(c,t,now){
    c.save();c.translate(t.x,t.y);c.scale(t.width/WIDTH,t.height/HEIGHT);
    const time=(Date.now()+clockOffset)/1000;
    const naturalWindow=Math.floor(time/47);
    const naturalTime=time%47-5.0;
    if(naturalTime>0&&naturalTime<1.3){
      const r=seeded(naturalWindow+474);
      drawMeteor(c,naturalTime,.13+r()*.61,.10+r()*.27,.85,'#ccdcff');
    }
    if(window.StellarGrains)window.StellarGrains.animate(c,now);
    else for(const st of stars){
      const lum=.10+.48*(.5+.5*Math.sin(now*.0016+st.phase));
      c.fillStyle='rgba(236,240,255,'+lum.toFixed(3)+')';
      c.beginPath();c.arc(st.x,st.y,st.r,0,TAU);c.fill();
    }
    if(event){
      const elapsed=(Date.now()+clockOffset-event.startsAt)/1000;
      if(elapsed>event.duration+2)event=null;
      else if(elapsed>=0){
        if(event.kind==='fireworks')fireworks(c,elapsed,event.seed);
        else if(event.kind==='meteor'){
          for(let i=0;i<15;i++){
            const r=seeded(event.seed+i*51);
            const time=elapsed-i*.77;
            if(time>0&&time<1.3)drawMeteor(c,time,.08+r()*.67,.12+r()*.32,.72+r()*.54,i%3===0?'#b8ffd2':'#c9dcff');
          }
        }
      }
    }
    c.restore();
  }
  function makeTransform(t,personal){
    if(!personal)return t;
    const lying=state.pose==='lie',s=lying?1.82:state.pose==='sit'?1.62:1.45;
    const width=t.width*s,height=t.height*s;
    const fx=clamp(state.x/3200,.24,.76);
    const x=clamp(innerWidth*.5-fx*width,innerWidth-width,0);
    // A resting person sees proportionally more sky; lying down looks higher.
    const y=lying?innerHeight*.88-height*.89:
      state.pose==='sit'?innerHeight*.89-height*.83:innerHeight*.88-height*.76;
    return {x,y,width,height};
  }
  function drawBackground(c,t,now,personal=false){
    const viewT=makeTransform(t,personal);
    const art=window.GongangPainterly;
    if(art?.readyToDraw){
      const relative=clamp((state.x-1600)/1600,-1,1);
      // The ordinary 1st-person camera was designed for the procedural
      // meadow. With a painterly panorama it zooms into the ground instead
      // of looking up. Use the uncropped scene transform for this sky view.
      art.draw(c,personal?t:viewT,now,{
        personal,scroll:relative,
        onSky:skyTransform=>drawSkyEffects(c,skyTransform,now)
      });
      metrics.rendered++;
      return;
    }
    if(art?.state.loading){
      // Avoid generating 9 expensive procedural canvases while compact
      // first-party WebP art is decoding asynchronously.
      c.fillStyle='#0b1630';
      c.fillRect(viewT.x,viewT.y,viewT.width,viewT.height);
      metrics.rendered++;
      return;
    }
    if(!scenicLayers)build();
    const {sky,clouds,distant,mistFar,middle,mistNear,near,foreground,silhouettes}=scenicLayers;
    const relative=clamp((state.x-1600)/1600,-1,1);
    const subtle=personal?.32:1;
    paintParallaxLayer(c,sky,viewT,0);
    const cloudDrift=Math.sin(now*.000034)*viewT.width*.007;
    paintParallaxLayer(c,clouds,viewT,cloudDrift,.012);
    // Stars and synchronized sky events belong behind the mountains and
    // foreground, not above every object in the scene.
    drawSkyEffects(c,viewT,now);
    paintParallaxLayer(c,distant,viewT,relative*viewT.width*.003*subtle,.006);
    const farDrift=Math.sin(now*.000014)*viewT.width*.012;
    const nearDrift=Math.sin(now*.000018+1.8)*viewT.width*.015;
    paintParallaxLayer(c,mistFar,viewT,farDrift,.017);
    paintParallaxLayer(c,middle,viewT,relative*viewT.width*.008*subtle,.014);
    paintParallaxLayer(c,mistNear,viewT,nearDrift,.02);
    paintParallaxLayer(c,near,viewT,relative*viewT.width*.013*subtle,.023);
    paintParallaxLayer(c,foreground,viewT,relative*viewT.width*.02*subtle,.032);
    paintParallaxLayer(c,silhouettes,viewT,relative*viewT.width*.025*subtle,.04);
    metrics.rendered++;
    if(!personal){
      for(let i=0;i<19;i++){
        const x=(i*367+130)%WIDTH,y=meadowY(x)+15+(i*19)%85;
        const flicker=(.5+.5*Math.sin(now*.0014+i*3.1))*.55;
        if(flicker<.12)continue;
        const xx=viewT.x+x/WIDTH*viewT.width;
        const yy=viewT.y+y/HEIGHT*viewT.height;
        c.fillStyle='rgba(244,221,151,'+(flicker*.55).toFixed(3)+')';
        c.beginPath();c.arc(xx,yy,1.7,0,TAU);c.fill();
      }
    }
  }
  function drawTraveler(c,p,now,isMe){
    const screen=worldScreen(p.x,p.z);
    const scale=cameraTransform().scale*.76;
    if(screen.x<-90||screen.x>innerWidth+90||screen.y<-130||screen.y>innerHeight+110)return;
    c.save();c.translate(screen.x,screen.y);c.scale(scale,scale);
    const sit=p.pose==='sit',lie=p.pose==='lie',walk=p.pose==='walk';
    const sway=walk?Math.sin(now*.009+p.x)*4:Math.sin(now*.0016+p.x)*.9;
    const coat=p.color||hashColor(p.id);
    c.fillStyle='rgba(7,23,33,.30)';
    c.beginPath();c.ellipse(0,0,lie?42:sit?30:21,6,0,0,TAU);c.fill();
    c.translate(0,sway*(walk?.7:.17));
    if(lie){c.translate(5,-8);c.rotate(-Math.PI/2);c.translate(0,-13)}
    else if(sit)c.translate(0,15);
    c.lineCap='round';c.lineJoin='round';
    c.strokeStyle='#273446';c.lineWidth=9;
    c.beginPath();
    c.moveTo(-10,-25);c.lineTo(-10+(walk?sway:0),-4);
    c.moveTo(10,-25);c.lineTo(11-(walk?sway:0),-4);c.stroke();
    c.fillStyle=coat;c.strokeStyle='rgba(23,41,54,.72)';c.lineWidth=2.3;
    c.beginPath();c.moveTo(-17,-61);c.quadraticCurveTo(-25,-47,-21,-29);
    c.quadraticCurveTo(0,-19,22,-29);c.quadraticCurveTo(25,-47,17,-61);c.closePath();c.fill();c.stroke();
    c.strokeStyle='#d5a58b';c.lineWidth=5.5;
    c.beginPath();c.moveTo(-16,-54);c.lineTo(-22,-33);
    const wave=now-(p.gestureAt??-10000);
    const waving=wave>0&&wave<1650?Math.sin(wave/1650*Math.PI)*20:0;
    c.moveTo(16,-54);c.lineTo(22+(.15*waving),-34-waving);c.stroke();
    c.fillStyle='#d8b39c';c.beginPath();c.arc(0,-77,16,0,TAU);c.fill();
    c.fillStyle='#3f384a';c.beginPath();c.arc(0,-81,16.5,Math.PI,TAU);c.lineTo(17,-79);c.quadraticCurveTo(0,-97,-17,-80);c.fill();
    c.strokeStyle='rgba(235,210,184,.48)';c.lineWidth=2;c.beginPath();c.moveTo(-9,-61);c.lineTo(11,-61);c.stroke();
    if(isMe){c.strokeStyle='rgba(254,225,170,.62)';c.lineWidth=1.5;c.beginPath();c.arc(0,-40,35,0,TAU);c.stroke()}
    c.restore();
  }
  function showControls(){
    if(!buttonBar)return;
    buttonBar.hidden=state.scene!=='stargaze'||Boolean(state.photo);
    const connected=online&&!state.solo&&socket?.readyState===WebSocket.OPEN;
    buttonBar.querySelectorAll('[data-sky-event]').forEach(b=>b.disabled=!connected);
    const toggle=buttonBar.querySelector('[data-sky-view]');
    toggle.textContent=view==='wide'?'나만의 시점':'전체 풍경';
    toggle.setAttribute('aria-pressed',String(view==='personal'));
  }
  function sendEvent(kind){
    if(state.scene!=='stargaze'||!['fireworks','meteor'].includes(kind))return;
    if(!online||state.solo||socket?.readyState!==WebSocket.OPEN){
      toast('다른 여행자와 연결되면 함께 이벤트를 볼 수 있어');return;
    }
    socket.send(JSON.stringify({type:'sky_event',kind}));
  }
  function receiveEvent(data){
    if(state.scene!=='stargaze'||!data||!['fireworks','meteor'].includes(data.kind))return;
    if(!Number.isFinite(data.startsAt)||!Number.isFinite(data.seed))return;
    event={kind:data.kind,startsAt:data.startsAt,seed:data.seed|0,duration:data.kind==='fireworks'?17:15};
    toast(data.kind==='fireworks'?'함께 보는 불꽃놀이가 시작돼':'밤하늘에 유성우가 찾아와');
  }
  function init(){
    const style=document.createElement('style');
    style.textContent='#skyDock{position:absolute;z-index:4;right:max(12px,env(safe-area-inset-right));bottom:max(84px,env(safe-area-inset-bottom));display:flex;flex-wrap:wrap;justify-content:flex-end;gap:7px;max-width:min(95vw,440px)}#skyDock[hidden],#app.photographing #skyDock{display:none!important}#skyDock button{border:1px solid rgba(237,232,221,.35);border-radius:24px;background:rgba(13,28,53,.57);backdrop-filter:blur(11px);padding:11px 14px;color:#f5f4e9;font-weight:650;font-size:12px;box-shadow:0 4px 17px rgba(9,15,34,.18)}#skyDock button:disabled{opacity:.42;cursor:not-allowed}@media(max-width:600px){#skyDock{bottom:max(133px,env(safe-area-inset-bottom));right:8px;max-width:calc(100vw - 16px);gap:5px}#skyDock button{padding:9px 10px;font-size:11px}}';
    document.head.appendChild(style);
    buttonBar=document.createElement('div');
    buttonBar.id='skyDock';buttonBar.setAttribute('aria-label','별빛 전망대 감상 및 함께 하는 이벤트');
    buttonBar.innerHTML='<button type="button" data-sky-view>나만의 시점</button><button type="button" data-sky-event="meteor">☄ 유성우</button><button type="button" data-sky-event="fireworks">✦ 불꽃놀이</button>';
    document.getElementById('app').appendChild(buttonBar);
    buttonBar.querySelector('[data-sky-view]').addEventListener('click',()=>{
      view=view==='wide'?'personal':'wide';
      showControls();
      toast(view==='personal'?'내 눈높이에서 하늘 바라보기':'함께하는 전망으로 돌아왔어');
    });
    buttonBar.querySelectorAll('[data-sky-event]').forEach(b=>b.addEventListener('click',()=>sendEvent(b.dataset.skyEvent)));
    setInterval(showControls,750);
    showControls();
    window.__stargazeDebug={get:()=>({scene:state.scene,view,event,rendered:metrics.rendered,staticLayers:metrics.staticLayers,buildMs:metrics.buildMs,layerCount:metrics.layerCount||0,cachedMegabytes:metrics.cachedMegabytes||0,art:window.GongangPainterly?.state||null,grains:window.StellarGrains?.getDebug()}),setView:(v)=>{view=v==='personal'?'personal':'wide';showControls()}};
  }
  window.GongangStargaze={
    drawBackground,drawTraveler,receiveEvent,
    onWelcome(data){if(Number.isFinite(data.serverTime))clockOffset=data.serverTime-Date.now();if(data.skyEvent)receiveEvent(data.skyEvent)},
    onUnavailable(data){toast('이벤트는 조금 뒤 다시 시작할 수 있어 · '+Math.ceil((data.waitMs||0)/1000)+'초')},
    get personal(){return view==='personal'}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
