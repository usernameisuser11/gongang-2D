/* Gongang / reference-based panoramic illustration, authored geometry.
 * This file uses no image sampling or bitmap panorama. Every ridge, star,
 * tree, rock and light is drawn by Canvas primitives from fixed reference
 * coordinates, then separated into parallax layers.
 */
(() => {
 'use strict';
 const W=1672,H=941, TAU=Math.PI*2;
 const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
 const lerp=(a,b,t)=>a+(b-a)*t;
 const rng=seed=>()=>{seed|=0;seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^(seed>>>15),1|seed);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296};
 const R=rng(934717);
 const color=(c,a=1)=>{if(c[0]==='#'&&c.length===7){const n=parseInt(c.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';}return c;};
 const lgrad=(c,x,y,X,Y,stops)=>{const g=c.createLinearGradient(x,y,X,Y);for(const [n,v] of stops)g.addColorStop(n,v);return g};
 const radial=(c,x,y,r,stops)=>{const g=c.createRadialGradient(x,y,0,x,y,r);for(const [n,v] of stops)g.addColorStop(n,v);return g};
 const ellipse=(c,x,y,rx,ry,fill,rot=0)=>{c.save();c.translate(x,y);c.rotate(rot);c.scale(rx,ry);c.beginPath();c.arc(0,0,1,0,TAU);c.fillStyle=fill;c.fill();c.restore();};
 const line=(c,a,b,col,w=1)=>{c.beginPath();c.moveTo(...a);c.lineTo(...b);c.strokeStyle=col;c.lineWidth=w;c.stroke()};
 const poly=(c,pts,fill)=>{c.beginPath();c.moveTo(...pts[0]);for(let i=1;i<pts.length;i++)c.lineTo(...pts[i]);c.closePath();c.fillStyle=fill;c.fill()};
 const smoothPath=(c,pts)=>{c.moveTo(...pts[0]);for(let i=1;i<pts.length-1;i++){const m=[(pts[i][0]+pts[i+1][0])/2,(pts[i][1]+pts[i+1][1])/2];c.quadraticCurveTo(pts[i][0],pts[i][1],...m);}c.lineTo(...pts[pts.length-1])};
 function ridge(c,pts,top,bottom,seed){
  c.beginPath();smoothPath(c,pts);c.lineTo(W,H);c.lineTo(0,H);c.closePath();
  c.fillStyle=lgrad(c,0,pts[0][1],0,H,[[0,top],[1,bottom]]);c.fill();
  const r=rng(seed);c.save();c.globalCompositeOperation='source-atop';
  for(let i=0;i<80;i++){
   const x=r()*W, y=345+r()*450,dx=(r()-.5)*120;
   line(c,[x,y],[x+dx,y+r()*95],color('#8193b7',.010+r()*.023),.6+r()*2.1);
  }c.restore();
 }
 function sky(c){
  c.fillStyle=lgrad(c,0,0,0,635,[
   [0,'#050d29'],[.23,'#11194c'],[.43,'#39265f'],
   [.61,'#804078'],[.77,'#e56880'],[.91,'#ff9770'],[1,'#f9af79']
  ]);c.fillRect(0,0,W,H);
  c.fillStyle=radial(c,845,365,560,[[0,'rgba(255,156,105,.46)'],[.53,'rgba(237,105,130,.13)'],[1,'rgba(238,94,113,0)']]);c.fillRect(0,0,W,620);
  c.fillStyle=radial(c,930,110,450,[[0,'rgba(80,97,183,.14)'],[1,'rgba(30,61,134,0)']]);c.fillRect(0,0,W,600);
  // Wind-sheared, broken cloud families. Each is built from paths, not ellipses.
  function cloudBand(cx,cy,width,weight,shade,light,seed){
   const r=rng(seed);const steps=18;const b=[];
   for(let j=0;j<=steps;j++){const t=j/steps;const x=cx-width/2+t*width,phase=t*6.3+seed;
    const h=weight*(.37+.63*Math.sin(t*Math.PI))*(.72+.28*r());
    b.push([x,cy+Math.sin(phase)*8-h*.65]);
   }
   c.beginPath();smoothPath(c,b);
   for(let j=steps;j>=0;j--){const t=j/steps;
    c.lineTo(cx-width/2+t*width,cy+weight*.48+8*Math.sin(t*7+seed));}
   c.closePath();c.fillStyle=lgrad(c,cx,cy-weight,cx,cy+weight,[[0,light],[.52,shade],[1,'rgba(47,45,112,.12)']]);c.fill();
   c.save();c.lineCap='round';
   for(let n=0;n<15;n++){const t=r(),x=cx+(t-.5)*width,y=cy+(r()-.5)*weight;
    line(c,[x,y],[x+30+r()*145,y-4-r()*11],color('#ffb1a0',.03+r()*.11),.6+r()*1.5);
   }c.restore();
  }
  cloudBand(285,315,650,72,'rgba(169,75,135,.52)','rgba(250,116,158,.45)',10);
  cloudBand(1440,318,635,71,'rgba(147,64,136,.45)','rgba(247,126,158,.45)',20);
  cloudBand(415,244,555,36,'rgba(65,57,128,.53)','rgba(154,90,155,.36)',30);
  cloudBand(1293,222,572,33,'rgba(54,51,122,.49)','rgba(139,88,154,.31)',40);
  cloudBand(640,362,480,23,'rgba(169,93,151,.30)','rgba(255,172,158,.23)',50);
  cloudBand(1104,362,477,24,'rgba(163,85,141,.30)','rgba(255,166,155,.21)',60);
  for(let i=0;i<90;i++){const t=R(),x=t*W,y=70+290*R(),span=14+R()*108;
   line(c,[x,y],[x+span,y-1-R()*12],color(i%3?'#e29abc':'#fe9baf',.014+R()*.055),.4+R()*1.1);}
  // The star fields are drawn in place, fixed to the skyline.
  const stars=rng(35077);
  for(let i=0;i<1330;i++){
   const x=stars()*W,y=stars()*365;
   if(y>260&&stars()<.72)continue;
   const rad=stars()<.975?.38+stars()*.73:1.3+stars()*1.55;
   const intensity=stars()*.72+.18;
   c.fillStyle=color(i%5?'#dae4ff':'#f8cbf6',intensity);
   c.fillRect(x,y,rad,rad);
   if(rad>1.6){line(c,[x-5,y],[x+5,y],color('#c5d4ff',.26),.6);line(c,[x,y-5],[x,y+5],color('#d9d3ff',.27),.6);}
  }
  // Milky Way: thousands of tiny individually drawn dust particles along a
  // drifting diagonal band. No baked artwork or composited photograph.
  for(let j=0;j<3900;j++){
   const x=420+R()*920;
   const center=90-(x-850)*.19, yy=center+(R()+R()+R()-1.5)*103;
   if(yy<4||yy>310)continue;
   const dust=R(),radius=.25+R()*(dust>.98?1.5:.65);
   c.fillStyle=color(dust>.80?'#dbcaf8':dust>.46?'#8796ea':'#697abd',.025+R()*.23);
   c.fillRect(x,yy,radius,radius);
  }
  // Gold crescent at x≈906 y≈185, aligned to the reference composition.
  const mx=903,my=184;
  c.fillStyle=radial(c,mx,my,113,[[0,'rgba(255,190,126,.17)'],[.42,'rgba(245,153,128,.075)'],[1,'rgba(237,152,126,0)']]);
  c.fillRect(mx-120,my-120,240,240);
  c.beginPath();c.arc(mx,my,53,-1.07,2.57,false);
  c.bezierCurveTo(mx-6,my+30,mx-10,my-19,mx-28,my-55);
  c.closePath();
  c.fillStyle=lgrad(c,mx-49,my-55,mx+49,my+50,[[0,'#fff2c8'],[.4,'#ffd9b0'],[1,'#cf8d9f']]);c.fill();
  c.strokeStyle='rgba(255,240,205,.72)';c.lineWidth=1.2;c.stroke();
  // Lunar granular details inside the illuminated crescent.
  c.save();c.globalAlpha=.28;for(let i=0;i<60;i++){let x=mx-41+R()*82,y=my-50+R()*104;
   if(Math.hypot(x-mx,y-my)>49)continue;ellipse(c,x,y,.4+R()*2,.4+R()*2,'rgba(144,88,124,.4)');
  }c.restore();
 }
 const mountains=[
  {pts:[[0,388],[112,374],[235,379],[335,351],[410,336],[476,373],[523,365],[591,397],[667,397],[753,418],[828,414],[924,420],[1040,414],[1162,376],[1233,355],[1359,336],[1427,375],[1510,365],[1672,394]],a:'#6274b0',b:'#293e73',seed:11},
  {pts:[[0,397],[128,409],[263,409],[365,416],[461,401],[558,414],[659,428],[742,422],[847,439],[967,434],[1074,421],[1181,405],[1292,398],[1440,411],[1560,409],[1672,392]],a:'#596da2',b:'#2d4578',seed:12},
  {pts:[[0,439],[149,433],[293,452],[421,439],[568,457],[684,456],[789,461],[902,451],[1078,438],[1205,445],[1338,418],[1478,442],[1672,434]],a:'#536598',b:'#283b70',seed:13},
  {pts:[[0,480],[154,465],[306,453],[475,468],[618,465],[723,485],[829,468],[990,476],[1152,450],[1328,460],[1506,443],[1672,473]],a:'#405885',b:'#213b70',seed:14},
  {pts:[[0,532],[115,500],[262,479],[413,496],[542,508],[707,497],[852,517],[986,489],[1133,485],[1295,500],[1483,480],[1672,496]],a:'#314d7c',b:'#173862',seed:15},
  {pts:[[0,557],[146,531],[281,518],[426,537],[550,537],[694,566],[829,548],[943,570],[1104,536],[1285,531],[1427,535],[1672,505]],a:'#284a70',b:'#123255',seed:16},
  {pts:[[0,601],[150,577],[276,561],[411,583],[562,592],[685,611],[826,593],[955,608],[1104,577],[1256,578],[1408,554],[1672,551]],a:'#1a3d62',b:'#102647',seed:17}
 ];
 function mountainLayer(c,index){
  const m=mountains[index];
  ridge(c,m.pts,m.a,m.b,m.seed);
  // A few authored geology facets, not high-frequency noise over all slopes.
  if(index<3){c.save();c.globalAlpha=.18;const r=rng(index+200);
   for(let k=0;k<12;k++){const x=200+r()*1220;const pts=m.pts;let closest=pts[0];
    for(const p of pts)if(Math.abs(p[0]-x)<Math.abs(closest[0]-x))closest=p;
    const y=closest[1]+6;
    poly(c,[[x,y],[x+11+r()*28,y+12],[x+33+r()*46,y+37+r()*34],[x-18,y+65]],k%2?'#b7a5bf':'#2d4173');
   }c.restore();}
 }
 function fir(c,x,y,height,seed,col,weight=1){
   const r=rng(seed);const wid=height*(.19+r()*.06);
   c.save();c.translate(x,y);c.globalAlpha=weight;
   // Leaning organic trunk and irregular forked branches.
   const lean=(r()-.5)*height*.07;
   c.beginPath();c.moveTo(-1,0);c.quadraticCurveTo(lean*.3,-height*.5,lean,-height);
   c.strokeStyle=color(col,.87);c.lineWidth=Math.max(1.2,height*.028);c.stroke();
   for(let i=0;i<19;i++){
    const t=i/19; const yy=-height*(.14+t*.77),side=i%2?1:-1;
    const length=wid*Math.pow(1-t,.91)*(.72+r()*.43);
    const tx=lean*t+side*length,tipY=yy+height*(.018+r()*.033);
    c.beginPath();c.moveTo(lean*t,yy-height*.028);c.quadraticCurveTo(tx*.52,yy-height*.065,tx,tipY);
    c.strokeStyle=color(col,.86);c.lineWidth=Math.max(1,height*.019*(1-t));c.stroke();
    // Tapered foliage clumps made of multiple slightly varied needles.
    for(let j=0;j<7;j++){const f=(j+.5)/7,ox=lerp(lean*t,tx,f),oy=lerp(yy,tipY,f);
     const size=(1-t)*(2.3+r()*4.5)*height/110;
     line(c,[ox-size*.45,oy-size*.66],[ox+side*size*.7,oy+size*.38],color(col,.42+r()*.42),Math.max(.55,height*.006));
    }
   }
   c.restore();
 }
 function treeLine(c,y0,y1,seed,col,count,near=false){
  const r=rng(seed);
  for(let i=0;i<count;i++){
   const x=r()*W,y=y0+(r()-.5)*24,h=20+(near?65:36)*r()+(y-y0)*.25;
   if(!near&&x>690&&x<1010&&r()<.70)continue;
   fir(c,x,y,h,seed*193+i,col,near?.84:.71);
  }
 }
 function valley(c){
  // The thin winding river follows the photographed S-curve, not a
  // horizontal lake strip. It receives the same late-sunset pink light.
  const path=[[943,498],[938,522],[912,544],[947,566],[917,591],[983,617],[938,640],[1013,668]];
  c.save();c.lineCap='round';c.lineJoin='round';c.beginPath();smoothPath(c,path);
  c.strokeStyle='rgba(245,164,177,.31)';c.lineWidth=15;c.shadowColor='#e9989b';c.shadowBlur=17;c.stroke();
  c.shadowBlur=0;c.strokeStyle='rgba(255,179,158,.63)';c.lineWidth=3.2;c.stroke();c.restore();
  // Fog is a ragged transparent condensation layer, concentrated in valleys.
  const r=rng(4509);
  for(let i=0;i<115;i++){
   const x=60+r()*1500,y=480+r()*170,rx=22+r()*135,ry=4+r()*18;
   if(x<200&&i%2===0)continue;
   ellipse(c,x,y,rx,ry,color(i%3?'#8799c3':'#b2a1c9',.012+r()*.038),-.07);
  }
  treeLine(c,565,640,751,'#193857',230,false);
  treeLine(c,628,683,752,'#102c49',220,true);
  for(let i=0;i<12;i++){
   const x=430+i*73,y=640+(i%4)*7;
   ellipse(c,x,y,43+i%3*8,10,color('#647cab',.045+i%3*.012));
  }
 }
 function foreground(c){
   // Left and right framing bluffs. Front and rear edges are separate
   // curves so every stone has a discernible top and side plane.
   poly(c,[[0,510],[55,520],[100,530],[144,551],[185,568],[214,619],[278,668],[336,711],[374,768],[340,807],[190,825],[0,806]],lgrad(c,0,515,260,830,[[0,'#263d60'],[.46,'#263453'],[1,'#101d37']]));
   poly(c,[[1672,520],[1618,521],[1569,534],[1524,568],[1497,610],[1450,652],[1387,676],[1323,727],[1291,770],[1432,840],[1672,806]],lgrad(c,1410,515,1620,833,[[0,'#343e67'],[.35,'#26345b'],[1,'#15213c']]));
   for(let side=0;side<2;side++){
    const r=rng(side+171);
    for(let j=0;j<50;j++){const x=side?1320+r()*355:r()*345,y=558+r()*205;
     const xx=x+(side?-1:1)*(20+r()*59),yy=y+15+r()*90;
     line(c,[x,y],[xx,yy],color(j%4?'#7e709b':'#dc8295',.025+r()*.16),.55+r()*2.7);
    }
   }
   // Central clearing remains broad enough for a shared group photo.
   poly(c,[[0,737],[142,749],[310,755],[464,736],[598,736],[737,751],[894,736],[1048,742],[1214,746],[1401,726],[1550,738],[1672,735],[1672,941],[0,941]],
      lgrad(c,0,730,0,941,[[0,'#6a555a'],[.24,'#50434b'],[.7,'#283446'],[1,'#151e35']]));
   c.fillStyle=radial(c,856,748,467,[[0,'rgba(249,157,97,.30)'],[.55,'rgba(194,108,112,.085)'],[1,'rgba(180,97,118,0)']]);c.fillRect(380,630,950,310);
   // Hand-authored large rocks (position in pixels matches the original).
   rock(c,71,823,274,137,131);
   rock(c,364,860,244,103,132);
   rock(c,1360,841,291,116,133);
   rock(c,1293,754,177,82,134);
   rock(c,521,736,137,61,135);
   rock(c,1043,764,118,49,136);
   rock(c,818,860,145,70,137);
   // Detail stones and ground texture are contained to the lower third.
   const r=rng(8735);
   for(let k=0;k<710;k++){
    const x=r()*W,y=765+r()*175,rad=1+r()*8;
    ellipse(c,x,y,rad,rad*.27,color(k%3?'#87909d':'#d49e9a',.07+r()*.18),-.20);
   }
   // Roots stay fixed; foliage tip oscillates independently at render time.
   for(let k=0;k<2650;k++){
    const x=r()*W,y=721+r()*215;
    const amount=.13+.87*Math.pow((y-713)/231,.67);
    const len=(4+r()*26)*amount, tilt=(r()-.5)*13;
    line(c,[x,y],[x+tilt,y-len],color(k%8===0?'#f1bf81':k%4===0?'#a1a27a':k%3===0?'#8c8b73':'#526d61',.08+r()*.32),.35+r()*1.25);
   }
   // Irregular pink and pale alpine wildflowers, carefully kept off center.
   for(let i=0;i<285;i++){
     const x=r()*W,y=694+r()*245;
     if(x>630&&x<1130&&y<822&&r()>.34)continue;
     const len=4+r()*19,sz=.7+r()*2.8;
     line(c,[x,y],[x+r()*4-2,y-len],color('#8b856b',.27),.65);
     const bloom=y-len;
     if(r()<.54){for(let k=0;k<5;k++){const a=k*TAU/5;
      ellipse(c,x+Math.cos(a)*sz,bloom+Math.sin(a)*sz,sz*.64,sz*.82,color(i%3?'#ed9bcc':'#c5a7e9',.21+r()*.5));}
     }else ellipse(c,x,bloom,sz*.75,sz*.9,color('#e4d6d7',.22+r()*.55));
   }
   // Small constellation-like warm fireflies near the grass, restrained.
   for(let k=0;k<30;k++){
    const x=350+r()*980,y=665+r()*186,rr=1+r()*1.6;
    c.fillStyle=radial(c,x,y,rr*9,[[0,'rgba(255,205,128,.23)'],[1,'rgba(255,180,92,0)']]);c.fillRect(x-rr*9,y-rr*9,rr*18,rr*18);
    ellipse(c,x,y,rr*.6,rr*.6,color('#ffcc8d',.35+r()*.3));
   }
   logSeat(c);
   lantern(c,1058,749);
   // Small stone cairn to the left, understated.
   rock(c,527,715,40,27,203);
   rock(c,526,702,30,18,204);
   rock(c,529,689,19,13,205);
   // Foreground corners create a subtle vignette, not black rectangles.
   c.fillStyle=radial(c,841,680,1190,[[0,'rgba(10,14,27,0)'],[.72,'rgba(10,14,27,.05)'],[1,'rgba(3,8,18,.38)']]);c.fillRect(0,0,W,H);
 }
 function rock(c,x,y,w,h,seed){
   const r=rng(seed),pts=[[x-w*.49,y],[x-w*.40,y-h*.57],[x-w*.20,y-h*.91],[x+w*.15,y-h],[x+w*.43,y-h*.69],[x+w*.52,y-h*.23],[x+w*.43,y+h*.12],[x-w*.37,y+h*.17]];
   poly(c,pts,lgrad(c,x,y-h,x+w*.13,y+h*.18,[[0,'#72718e'],[.28,'#485577'],[.66,'#323b59'],[1,'#182743']]));
   poly(c,[[x-w*.49,y],[x-w*.40,y-h*.57],[x-w*.20,y-h*.91],[x+w*.06,y-h*.88],[x-w*.11,y-h*.33]],'rgba(167,153,170,.12)');
   for(let k=0;k<28;k++){const xx=x+(r()-.5)*w*.85,yy=y-h*r()*.79;line(c,[xx,yy],[xx+(r()-.5)*w*.19,yy+(r()-.5)*h*.12],color(k%4?'#a8a3ba':'#e89d99',.04+r()*.22),.5+r()*1.8);}
   c.save();c.beginPath();smoothPath(c,pts.slice(1,5));c.strokeStyle='rgba(255,154,137,.22)';c.lineWidth=1.8;c.stroke();c.restore();
 }
 function logSeat(c){
  // A fallen wooden sitting log and draped woven blanket, rather than an
  // arbitrary bench rectangle. Photo reference seat at (710..991,724..793).
  c.fillStyle='rgba(10,13,27,.25)';ellipse(c,838,790,172,23,'rgba(8,12,24,.27)');
  const wood=lgrad(c,730,722,745,788,[[0,'#81513e'],[.25,'#4e3535'],[.62,'#43312d'],[1,'#261d29']]);
  c.beginPath();c.moveTo(725,727);c.bezierCurveTo(786,716,918,717,978,731);
  c.lineTo(982,776);c.bezierCurveTo(915,793,780,794,720,768);c.closePath();
  c.fillStyle=wood;c.fill();c.strokeStyle='rgba(239,153,119,.43)';c.lineWidth=2;c.stroke();
  for(let k=0;k<20;k++){const x=734+k*12;line(c,[x,732+(k%3)*2],[x+2,768+(k%4)*3],color(k%2?'#9c6854':'#281f29',.15+k%3*.038),1.1);}
  // Folded crimson wool blanket, with a woven border and tassel shapes.
  poly(c,[[778,725],[881,722],[877,766],[850,777],[839,768],[795,782]],'#5b3548');
  poly(c,[[782,726],[873,724],[869,741],[791,742]],'#97616e');
  for(let k=0;k<10;k++){const x=791+k*9;
   line(c,[x,730],[x-2,763+(k%4)*2],color('#d6a48a',.12+(k%3)*.08),1);
  }
 }
 function lantern(c,x,y){
  // Grounded warm light source: tiny lamp, halo and real contact glow.
  c.fillStyle=radial(c,x,y-26,120,[[0,'rgba(255,182,88,.31)'],[.45,'rgba(255,128,79,.065)'],[1,'rgba(255,117,80,0)']]);c.fillRect(x-130,y-150,260,260);
  c.fillStyle='rgba(16,18,26,.64)';ellipse(c,x,y+6,39,9,'rgba(15,19,29,.36)');
  c.beginPath();c.moveTo(x-14,y-52);c.lineTo(x+14,y-52);c.lineTo(x+17,y-5);c.lineTo(x-17,y-5);c.closePath();c.fillStyle='#3d3032';c.fill();
  c.fillStyle=lgrad(c,x,y-48,x,y-8,[[0,'#ffc98c'],[.38,'#ffdf8b'],[1,'#bf6c46']]);c.fillRect(x-10,y-48,20,36);
  c.fillStyle='rgba(255,241,167,.9)';ellipse(c,x,y-31,5,14,'rgba(255,240,183,.85)');
  c.lineWidth=3;c.strokeStyle='#282531';c.strokeRect(x-12,y-51,24,44);
  line(c,[x,y-53],[x,y-66],'#282635',3);
  c.beginPath();c.arc(x,y-65,5,Math.PI,TAU);c.strokeStyle='#3c3437';c.lineWidth=2;c.stroke();
  poly(c,[[x-17,y-56],[x,y-67],[x+17,y-56]],'#2d2834');
  line(c,[x-19,y-8],[x+19,y-8],'#252531',4);
 }
 const layerDefs=[
  [sky],[(c)=>mountainLayer(c,0),(c)=>mountainLayer(c,1),(c)=>mountainLayer(c,2)],
  [(c)=>mountainLayer(c,3),(c)=>mountainLayer(c,4)],
  [(c)=>mountainLayer(c,5),(c)=>mountainLayer(c,6),valley],
  [foreground]
 ];
 function paintLayer(fns){const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
   const ctx=canvas.getContext('2d',{alpha:true});for(const fn of fns)fn(ctx);return canvas;}
 const layers=[];
 let painted=false,failed=false,error='';
 const state={ready:false,frames:0,mode:'coordinate-repaint-no-bitmap',coordinates:'1672x941',layers:0,error:null,light:'twilight'};
 function ensure(){if(painted)return;try{
  for(const defs of layerDefs)layers.push(paintLayer(defs));
  state.ready=true;state.layers=layers.length;painted=true;
 }catch(e){failed=true;state.error=error=String(e);console.warn('Reference vista paint failed',e);}}
 function draw(ctx,t,now,opts={}){
  ensure();if(failed||!state.ready)return false;
  const relative=clamp((opts.scroll||0),-1,1);
  const scaleX=t.width/W,scaleY=t.height/H;
  ctx.save();ctx.beginPath();ctx.rect(t.x,t.y,t.width,t.height);ctx.clip();
  for(let i=0;i<layers.length;i++){
   const parallax=[0,2.2,5.3,9.2,14.0][i]*relative;
   const drift= i===3?Math.sin(now*.00008)*.6:0;
   ctx.drawImage(layers[i],t.x-(parallax+drift)*scaleX,t.y, t.width,t.height);
  }
  // Sparse real-time distant haze and firefly twinkle sit on top of
  // separately authored layers; the painted reference is never loaded.
  ctx.globalCompositeOperation='screen';
  const phase=now*.00034;
  for(let i=0;i<22;i++){
    const x=t.x+(350+(i*59.71)%920)/W*t.width,
      y=t.y+(695+(i*13.9)%110)/H*t.height;
    const alpha=(.06+.11*(.5+.5*Math.sin(phase+i*1.7)));
    ctx.fillStyle='rgba(255,221,139,'+alpha.toFixed(3)+')';
    ctx.beginPath();ctx.arc(x,y,Math.max(.35,1.15*scaleX),0,TAU);ctx.fill();
  }
  ctx.globalCompositeOperation='source-over';
  ctx.restore();
  state.frames++;return true;
 }
 window.GongangReferenceVista={draw,state,get ready(){ensure();return state.ready;},ensure};
})();
