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
  let base=null, stars=[],event=null,view='wide',clockOffset=0,lastUi=0,buttonBar=null;
  const metrics={rendered:0,staticLayers:0};
  function glow(c,x,y,r,inner,outer,opacity=1){
    c.save();c.globalAlpha=opacity;
    const g=c.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,inner);g.addColorStop(1,outer);
    c.fillStyle=g;c.fillRect(x-r,y-r,r*2,r*2);c.restore();
  }
  function paintClouds(c){
    // Cloud fields are shaped from overlapping soft-lit masses, not a static
    // rectangular sky image. The luminous undersides face the distant horizon.
    const groups=[
      [185,484,305,64,.47],[550,430,280,70,.41],
      [1190,470,270,68,.54],[1640,535,358,94,.61],
      [650,625,300,58,.32],[1405,632,255,47,.44]
    ];
    groups.forEach(([x,y,w,h,str],gi)=>{
      const r=seeded(616+gi*317);
      for(let k=0;k<19;k++){
        const xx=x+(r()-.5)*w*1.8,yy=y+(r()-.5)*h*.75;
        const rw=w*(.16+.20*r()),rh=h*(.21+.45*r());
        c.save();c.translate(xx,yy);c.scale(1,rh/rw);
        const g=c.createRadialGradient(0,0,0,0,0,rw);
        g.addColorStop(0,gi%3===0?'rgba(101,138,198,.18)':'rgba(98,132,193,.15)');
        g.addColorStop(.53,gi%2===0?'rgba(111,142,189,.12)':'rgba(147,148,191,.12)');
        g.addColorStop(1,'rgba(53,85,143,0)');
        c.fillStyle=g;c.fillRect(-rw,-rw,rw*2,rw*2);c.restore();
      }
      c.globalAlpha=str*.16;
      c.fillStyle='#c5bed9';
      c.beginPath();c.ellipse(x,y+h*.18,w*.47,h*.12,-.03,0,TAU);c.fill();
      c.globalAlpha=1;
    });
  }
  function paintMilkyWay(c){
    const r=seeded(17352);
    c.save();c.globalCompositeOperation='screen';
    for(let i=0;i<380;i++){
      const u=r();
      const x=480+u*840+(r()-.5)*195;
      const y=570-u*610+(r()-.5)*120;
      const rad=16+r()*125;
      glow(c,x,y,rad, i%3===0?'rgba(191,152,232,.065)':'rgba(107,163,239,.063)',
        'rgba(24,47,106,0)',.38+r()*.52);
    }
    c.restore();
    const r2=seeded(731663);
    for(let i=0;i<2450;i++){
      const u=r2(),x=490+u*820+(r2()-.5)*350,y=550-u*620+(r2()-.5)*205;
      if(x<0||x>WIDTH||y<0||y>730)continue;
      const a=.035+.25*r2();
      c.fillStyle='rgba(203,219,255,'+a.toFixed(3)+')';
      const size=.30+r2()*.84;
      c.fillRect(x,y,size,size);
    }
  }
  function ridgeY(x,baseY,amp,seed){
    const p=x/WIDTH;
    return baseY - amp*(.36*Math.sin(p*6.5+seed)+.31*Math.sin(p*13.6-seed*2)
      +.21*Math.sin(p*29.7+seed*2)+.12*Math.sin(p*71.+seed));
  }
  function paintRidge(c,baseY,amp,top,bottom,seed){
    c.save();c.beginPath();c.moveTo(0,HEIGHT);
    for(let x=0;x<=WIDTH;x+=9)c.lineTo(x,ridgeY(x,baseY,amp,seed));
    c.lineTo(WIDTH,HEIGHT);c.closePath();
    const gradient=c.createLinearGradient(0,baseY-amp*2,0,HEIGHT);
    gradient.addColorStop(0,top);gradient.addColorStop(1,bottom);
    c.fillStyle=gradient;c.fill();c.restore();
  }
  function meadowY(x){
    const p=x/WIDTH;
    return 965-172*p+12*Math.sin(p*9.3+.8)+8*Math.sin(p*23.7);
  }
  function paintMeadow(c){
    c.beginPath();c.moveTo(0,HEIGHT);
    for(let x=0;x<=WIDTH;x+=8)c.lineTo(x,meadowY(x));
    c.lineTo(WIDTH,HEIGHT);c.closePath();
    const g=c.createLinearGradient(0,740,0,HEIGHT);
    g.addColorStop(0,'#376a69');g.addColorStop(.35,'#326055');g.addColorStop(1,'#142f38');
    c.fillStyle=g;c.fill();
    const r=seeded(798112);
    for(let i=0;i<3600;i++){
      const x=r()*WIDTH,y=r()*HEIGHT;
      if(y<meadowY(x)+4)continue;
      const near=(y-meadowY(x))/(HEIGHT-meadowY(x));
      const a=.07+r()*.17,stem=2+r()*9*(.3+near),lean=(r()-.5)*5;
      c.strokeStyle='rgba('+(r()>.3?'145,184,140,':'109,151,142,')+a.toFixed(3)+')';
      c.lineWidth=.5+r()*.95;
      c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+lean*.3,y-stem*.63,x+lean,y-stem);c.stroke();
      if(r()<.068){
        c.fillStyle=r()>.45?'rgba(235,217,184,.54)':'rgba(170,177,225,.50)';
        c.beginPath();c.arc(x,y-stem,1.0+r()*1.9,0,TAU);c.fill();
      }
    }
    // Thin rim of moonlight catches grasses along the entire hill crest.
    c.beginPath();
    for(let x=0;x<=WIDTH;x+=6){const y=meadowY(x);if(x===0)c.moveTo(x,y);else c.lineTo(x,y);}
    c.strokeStyle='rgba(169,220,195,.43)';c.lineWidth=2.0;c.stroke();
    for(let i=0;i<420;i++){
      const x=r()*WIDTH,y=meadowY(x)+r()*33;
      c.fillStyle='rgba(255,231,174,'+(.06+r()*.22).toFixed(3)+')';
      c.beginPath();c.arc(x,y,.5+r()*1.25,0,TAU);c.fill();
    }
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
      const x=r()*WIDTH, ridge=ridgeY(x,850,46,5.4);
      const y=ridge-9+r()*75;
      if(y>meadowY(x)-35)continue;
      const a=.15+.60*r()**2;
      c.fillStyle='rgba(255,200,121,'+a.toFixed(3)+')';
      c.fillRect(x,y,.6+r()*2.1,.6+r()*1.5);
    }
  }
  function build(){
    const canvas=document.createElement('canvas');
    canvas.width=WIDTH;canvas.height=HEIGHT;
    const c=canvas.getContext('2d',{alpha:false});
    let g=c.createLinearGradient(0,0,0,HEIGHT);
    for(const [p,col] of [[0,'#071333'],[.25,'#102454'],[.50,'#244b83'],[.66,'#637db0'],[.75,'#b28eb8'],[.81,'#ed9ca7'],[1,'#273e65']])g.addColorStop(p,col);
    c.fillStyle=g;c.fillRect(0,0,WIDTH,HEIGHT);
    glow(c,670,820,500,'rgba(247,154,157,.16)','rgba(231,121,168,0)');
    paintMilkyWay(c);
    // Dense starfield with a restrained glow; richer than white dots alone.
    const r=seeded(71526);
    stars=[];
    for(let i=0;i<2200;i++){
      const x=r()*WIDTH,y=r()*800,s=.25+r()**5*1.7,a=.14+r()*.8;
      c.fillStyle='rgba(217,232,255,'+a.toFixed(3)+')';
      c.fillRect(x,y,s,s);
      if(i%29===0){glow(c,x,y,7,'rgba(186,213,255,.18)','rgba(186,213,255,0)')}
      if(i%31===0)stars.push({x,y,r:.6+r()*1.6,phase:r()*TAU});
    }
    paintClouds(c);
    paintRidge(c,744,35,'#365884','#294c79',1.1);
    paintRidge(c,791,55,'#2c527f','#213e65',2.7);
    paintRidge(c,841,50,'#1f4565','#173b56',5.4);
    paintValley(c);
    paintMeadow(c);
    base=canvas;metrics.staticLayers++;
    return canvas;
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
    for(const st of stars){
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
    const s=1.58, width=t.width*s,height=t.height*s;
    const fx=clamp(state.x/3200,.24,.76);
    const x=clamp(innerWidth*.5-fx*width,innerWidth-width,0);
    const y=innerHeight*.89-height*.79;
    return {x,y,width,height};
  }
  function drawBackground(c,t,now,personal=false){
    const b=base||build(),viewT=makeTransform(t,personal);
    c.drawImage(b,viewT.x,viewT.y,viewT.width,viewT.height);
    drawSkyEffects(c,viewT,now);
    metrics.rendered++;
    // Tiny luminous fireflies at the hillside edge.
    if(!personal){
      for(let i=0;i<19;i++){
        const x=(i*367+130)%WIDTH, y=meadowY(x)+15+(i*19)%85;
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
    window.__stargazeDebug={get:()=>({scene:state.scene,view,event,rendered:metrics.rendered,staticLayers:metrics.staticLayers}),setView:(v)=>{view=v==='personal'?'personal':'wide';showControls()}};
  }
  window.GongangStargaze={
    drawBackground,drawTraveler,receiveEvent,
    onWelcome(data){if(Number.isFinite(data.serverTime))clockOffset=data.serverTime-Date.now();if(data.skyEvent)receiveEvent(data.skyEvent)},
    onUnavailable(data){toast('이벤트는 조금 뒤 다시 시작할 수 있어 · '+Math.ceil((data.waitMs||0)/1000)+'초')},
    get personal(){return view==='personal'}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
