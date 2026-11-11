/* Gongang Living World: time-driven WebGL environment, not a photo panorama.
 * Seoul clock and optional current Seoul weather; procedural sky/stellar cloud shaders,
 * shader precipitation, sunlight, moonlight and scene fog update every frame.
 */
const VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SKY=`
precision highp float;
varying vec2 vUv;
uniform float uTime,uNight,uTwilight,uCloud,uRain,uWind;
uniform vec3 uTop,uHorizon;
float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
            mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);
}
float fbm(vec2 p){
 float v=0.,w=.5;
 for(int j=0;j<4;j++){v+=w*noise(p);p=p*2.07+vec2(17.4,4.9);w*=.5;}
 return v;
}
float gauss(float x,float spread){return exp(-pow(x/spread,2.));}
void main(){
 vec2 p=vUv;
 // Match visible camera frustum (vUv Y ~.35-.55) to one complete sky dome.
 float h=clamp((p.y-.355)*5.45,0.,1.);
 float sx=clamp((p.x-.385)*4.35,0.,1.);
 float t=uTime;
 float twilight=uTwilight;
 vec3 col=mix(uHorizon,uTop,pow(h,.78));
 // The sky is dark cobalt overhead, indigo in mid-altitude, and a warm
 // orange-pink band over the far peaks — not a uniform maroon tint.
 col=mix(col,vec3(.88,.18,.39),twilight*gauss(h-.31,.25)*.86);
 col=mix(col,vec3(1.06,.49,.23),twilight*gauss(h-.045,.17)*.87);
 col=mix(col,vec3(.09,.06,.28),twilight*smoothstep(.62,.98,h)*.67);
 col+=vec3(.20,.038,.11)*twilight*gauss(h-.22,.25)*gauss(sx-.55,.70);
 // Independent, advecting high-altitude cirrus and stratified lower clouds.
 vec2 flow=vec2(sx*5.8-t*(.003+.001*uWind),h*4.8);
 float n=fbm(flow+vec2(11.3,7.8));
 float fine=fbm(flow*vec2(2.8,1.9)+vec2(26.1,5.5));
 float swirl=fbm(flow*vec2(1.9,1.3)+vec2(73.,19.));
 float filament=smoothstep(.54,.70,n*.82+fine*.26+swirl*.16);
 float cirrus=smoothstep(.62,.82,fbm(vec2(sx*17.-t*.0014,h*4.9)+vec2(17.,51.)))
   *gauss(h-.68,.33);
 float cloudCover=clamp(uCloud*.87+.09,0.,.9);
 float clouds=(filament*(.25+.75*gauss(h-.41,.38))+cirrus*.32)*cloudCover;
 vec3 cloudTone=mix(vec3(.15,.18,.33),vec3(.29,.38,.62),fine);
 cloudTone=mix(cloudTone,vec3(.88,.37,.63),twilight*(.36+.35*(1.-h)));
 cloudTone=mix(cloudTone,vec3(.69,.83,.96),1.-uNight);
 col=mix(col,cloudTone,clouds*.84);
 // Detailed Milky Way: a broad translucent dust cloud, dark lanes, cold
 // blue star clusters. It is not a thin neon line or a flat sprite.
 float axis=sx*.47+h*.31-.45;
 float galacticBand=gauss(axis,.19)*smoothstep(.18,.72,h);
 float core=fbm(vec2(sx*7.6+14.,h*10.8+3.));
 float dust=fbm(vec2(sx*22.+39.,h*22.+9.));
 float galactic=galacticBand*(.23+.78*core)*(.67+.33*dust);
 float veil=max(0.,uNight-.05)*(1.-clouds*.80);
 col+=vec3(.18,.20,.39)*galactic*veil;
 col+=vec3(.10,.18,.38)*gauss(axis+.065,.085)*dust*veil*.7;
 col-=vec3(.06,.045,.08)*galactic*(1.-dust)*veil;
 // Many independent sub-pixel stars: 3 size populations and deterministic
 // per-cell twinkle. No screen-covering white flashes.
 vec2 g=vec2((p.x-.5)*830.,(p.y-.5)*730.);
 vec2 id=floor(g),d=fract(g)-.5;
 d-=(vec2(hash(id+vec2(7.,3.)),hash(id+vec2(9.,18.)))-.5)*.64;
 float starProb=hash(id+vec2(13.,31.));
 float tiny=step(.986,starProb)*exp(-length(d)*34.);
 float shine=(.69+.31*sin(t*(.4+hash(id+vec2(7.,21.))*.63)+starProb*6.28));
 vec2 g2=vec2((p.x-.5)*245.,(p.y-.5)*280.);
 vec2 i2=floor(g2),d2=fract(g2)-.5;
 d2-=(vec2(hash(i2+vec2(1.,3.)),hash(i2+vec2(4.,8.)))-.5)*.62;
 float bright=step(.976,hash(i2+vec2(4.,19.)))*exp(-length(d2)*22.);
 vec2 g3=vec2((p.x-.5)*83.,(p.y-.5)*96.);
 vec2 i3=floor(g3),d3=fract(g3)-.5;
 d3-=(vec2(hash(i3+vec2(2.,8.)),hash(i3+vec2(16.,1.)))-.5)*.50;
 float beacon=step(.991,hash(i3+vec2(12.,2.)))*exp(-length(d3)*9.);
 float stars= (tiny*shine*.75+bright*.75+beacon*1.7)*
   max(uNight,twilight*.62)*smoothstep(.12,.50,h)*(1.-clouds*.91);
 col+=vec3(.78,.85,1.)*stars;
 col*=1.-uRain*.17;
 gl_FragColor=vec4(max(col,0.),1.);
}`;
const BODY=`
precision mediump float;varying vec2 vUv;
uniform float uMoon,uNight,uPhase;
void main(){
 vec2 p=(vUv-.5)*2.;float d=length(p);
 float edge=1.-smoothstep(.44,.48,d);
 float haze=exp(-d*5.)*.24+exp(-d*17.)*.13;
 if(uMoon>.5){
   // Geometry-backed terminator: waxing and waning naturally change the disc.
   float halfWidth=sqrt(max(0.,.44*.44-p.y*p.y));
   float terminator=cos(6.283185*uPhase)*halfWidth;
   float waxing=1.-step(.5,uPhase);
   float litWax=smoothstep(terminator-.018,terminator+.018,p.x);
   float litWane=1.-smoothstep(-terminator-.018,-terminator+.018,p.x);
   float illumination=mix(litWane,litWax,waxing);
   float crescent=edge*illumination;
   gl_FragColor=vec4(vec3(.97,.94,1.),crescent*.97+haze*uNight*.20);
 }else{
   gl_FragColor=vec4(vec3(1.,.84,.52),edge*.92+haze*.65);
 }
}`;
const PARTICLE_VERT=`
attribute float aSeed;uniform float uTime,uWind,uSnow,uIntensity;
varying float vAlpha;
void main(){
 vec3 p=position;float t=uTime*(.6+fract(aSeed*71.)*.8);
 p.y=mod(p.y+16.-t*mix(20.,3.2,uSnow),32.)-16.;
 p.x=mod(p.x+32.+t*uWind*.6+sin(t*.5+aSeed*8.)*uSnow,64.)-32.;
 gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
 gl_PointSize=mix(2.6,3.7,uSnow);
 vAlpha=uIntensity*(.55+.45*fract(aSeed*23.));
}`;
const PARTICLE_FRAG=`
precision mediump float;uniform float uSnow;varying float vAlpha;
void main(){
 vec2 q=gl_PointCoord-.5;
 float rain=(1.-smoothstep(.04,.18,abs(q.x)))*(1.-smoothstep(.21,.48,abs(q.y)));
 float snow=1.-smoothstep(.22,.5,length(q));
 gl_FragColor=vec4(mix(vec3(.57,.74,.92),vec3(.95,.96,1.),uSnow),mix(rain,snow,uSnow)*vAlpha*.78);
}`;
const C={
 night:{top:'#03081b',horizon:'#183762',fog:'#233b67',key:'#b2bdec',ambient:'#6679a9'},
 dawn:{top:'#0b214b',horizon:'#ffa36d',fog:'#8b8ca5',key:'#ffc99b',ambient:'#adb9d8'},
 day:{top:'#1260a5',horizon:'#b0dced',fog:'#8db9c8',key:'#fff2d7',ambient:'#d9e8f0'},
 dusk:{top:'#050f32',horizon:'#ff8a68',fog:'#6b7095',key:'#ffb18b',ambient:'#afb4de'}
};
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const curve=(a,b,v)=>{let t=clamp((v-a)/(b-a));return t*t*(3-2*t);};
function koreaHour(ms=Date.now()){
 const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms));
 return Number(p.find(x=>x.type==='hour').value)+Number(p.find(x=>x.type==='minute').value)/60;
}
function palette(THREE,key,hour,sunrise,sunset){
 let a,b,t;
 if(hour<sunrise-1.3||hour>=sunset+1.7){a=b='night';t=0;}
 else if(hour<sunrise+.15){a='night';b='dawn';t=curve(sunrise-1.3,sunrise+.15,hour);}
 else if(hour<sunrise+2.2){a='dawn';b='day';t=curve(sunrise+.15,sunrise+2.2,hour);}
 else if(hour<sunset-1.0){a=b='day';t=0;}
 else if(hour<sunset+.25){a='day';b='dusk';t=curve(sunset-1.0,sunset+.25,hour);}
 else {a='dusk';b='night';t=curve(sunset+.25,sunset+1.7,hour);}
 return new THREE.Color(C[a][key]).lerp(new THREE.Color(C[b][key]),t);
}
// Approximate latitude-aware daylight schedule for Seoul; no device location access.
function koreanSolarTimes(ms=Date.now()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',
  year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
 const year=Number(parts.find(p=>p.type==='year').value);
 const month=Number(parts.find(p=>p.type==='month').value);
 const day=Number(parts.find(p=>p.type==='day').value);
 const doy=Math.round((Date.UTC(year,month-1,day)-Date.UTC(year,0,0))/86400000);
 const daylight=12+2.45*Math.cos((doy-172)*2*Math.PI/365.2425);
 const noon=12.30;
 return {sunrise:noon-daylight/2,sunset:noon+daylight/2};
}
function moonPhase(ms=Date.now()){
 // Synodic phase approximation from reference new moon; not precise ephemeris.
 const jd=ms/86400000+2440587.5;
 return ((jd-2451550.1)/29.530588853%1+1)%1;
}
export function createLivingEnvironment(THREE,scene,{reducedMotion=false}={}){
 const query=new URLSearchParams(location.search);
 const requestedHour=query.get('time');
 const hourOverride=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(requestedHour||'')?
  Number(requestedHour.slice(0,2))+Number(requestedHour.slice(3))/60:null;
 const weatherOverride=query.get('weather');
 const moonPreview=query.get('moon')==='show';
 const state={ready:true,mode:'real-time-webgl',weatherSource:'fallback',weather:'clear',
   hour:koreaHour(),nightFactor:1,windKmh:6,cloudCover:.20,rain:0,snow:0,
   fetchError:null,renderCount:0,solarPosition:'Seoul seasonal solar approximation',moonPhase:0,sunrise:0,sunset:0};
 const uniforms={uTime:{value:0},uNight:{value:1},uTwilight:{value:0},
  uCloud:{value:.25},uRain:{value:0},uWind:{value:.3},
  uTop:{value:new THREE.Color(C.night.top)},
  uHorizon:{value:new THREE.Color(C.night.horizon)}};
 const sky=new THREE.Mesh(new THREE.PlaneGeometry(230,100),new THREE.ShaderMaterial({
  uniforms,vertexShader:VS,fragmentShader:SKY,
  depthWrite:false,depthTest:false,fog:false}));
 sky.position.set(0,-3,-164);sky.renderOrder=-100;scene.add(sky);
 function celestial(moon){
  const mat=new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:BODY,
   uniforms:{uMoon:{value:moon?1:0},uNight:{value:1},uPhase:{value:.15}},transparent:true,
   depthWrite:false,depthTest:false,fog:false});
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(moon?8.2:9.1,moon?8.2:9.1),mat);
  mesh.renderOrder=-99;scene.add(mesh);return mesh;
 }
 const sun=celestial(false),moon=celestial(true);
 const fill=new THREE.HemisphereLight('#b0c5ed','#243f39',1.3);
 const key=new THREE.DirectionalLight('#f8dcae',1.2);
 key.position.set(-10,22,8);scene.add(fill,key);
 const count=innerWidth<680?160:420,positions=new Float32Array(count*3),seeds=new Float32Array(count);
 let seed=23487;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
 for(let i=0;i<count;i++){
  positions[i*3]=(random()-.5)*60;positions[i*3+1]=random()*30-12;
  positions[i*3+2]=2+random()*31;seeds[i]=random();
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
 geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
 const precipitation=new THREE.ShaderMaterial({
  vertexShader:PARTICLE_VERT,fragmentShader:PARTICLE_FRAG,transparent:true,depthTest:false,
  depthWrite:false,uniforms:{uTime:{value:0},uWind:{value:.25},uSnow:{value:0},uIntensity:{value:0}}});
 const particles=new THREE.Points(geometry,precipitation);particles.frustumCulled=false;
 scene.add(particles);
 let weather={cloud:.25,wind:6,rain:0,snow:0},lastFetch=-Infinity;
 function setWeather(w,src){
  weather={cloud:clamp(Number(w.cloud)||0),wind:clamp(Number(w.wind)||0,0,90),
    rain:clamp(Number(w.rain)||0),snow:clamp(Number(w.snow)||0)};
  state.weatherSource=src;
  state.weather=weather.snow>.03?'snow':weather.rain>.03?'rain':weather.cloud>.65?'cloudy':'clear';
 }
 if(['clear','cloudy','rain','snow'].includes(weatherOverride)){
  setWeather({cloud:weatherOverride==='clear'?.12:.83,wind:17,
    rain:weatherOverride==='rain'?.8:0,snow:weatherOverride==='snow'?.9:0},'preview');
 }
 async function fetchWeather(){
  if(['clear','cloudy','rain','snow'].includes(weatherOverride))return;
  if(Date.now()-lastFetch<15*60*1000)return;
  lastFetch=Date.now();
  try{
   const url='https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.978'
     +'&current=cloud_cover,wind_speed_10m,precipitation,rain,snowfall'
     +'&timezone=Asia%2FSeoul';
   const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),4500);
   let response;try{response=await fetch(url,{signal:ctrl.signal});}finally{clearTimeout(timer);}
   if(!response.ok)throw Error('Weather HTTP '+response.status);
   const data=(await response.json()).current;
   if(!data||!Number.isFinite(data.cloud_cover))throw Error('Missing weather values');
   setWeather({cloud:data.cloud_cover/100,wind:data.wind_speed_10m,
     rain:clamp((data.rain||data.precipitation||0)/2),
     snow:clamp((data.snowfall||0)/1.2)},'Open-Meteo · Seoul');
   state.fetchError=null;
  }catch(error){state.fetchError=String(error?.message||error);}
 }
 fetchWeather();
 let cloud=.25,rain=0,snow=0,wind=.25;
 let lastClockRefresh=Date.now(),clockHour=koreaHour(lastClockRefresh);
 let lastSolarDate=-1,solar={sunrise:6.4,sunset:18.2};
 return {state,update(seconds){
  const time=Number.isFinite(seconds)?seconds:0;
  const now=Date.now();
  if(now-lastClockRefresh>10000){clockHour=koreaHour(now);lastClockRefresh=now;}
  const hour=hourOverride===null?clockHour+(now-lastClockRefresh)/3600000:hourOverride;
  const dateIndex=Math.floor((now+9*3600000)/86400000);
  if(dateIndex!==lastSolarDate){solar=koreanSolarTimes(now);lastSolarDate=dateIndex;}
  const {sunrise,sunset}=solar;
  const daylight=curve(sunrise-.2,sunrise+1.8,hour)*
    (1-curve(sunset-1.4,sunset+.35,hour));
  const night=clamp(1-daylight*1.29);
  const twilight=Math.max(Math.exp(-Math.pow((hour-(sunset+.02))/1.3,2)),
    .70*Math.exp(-Math.pow((hour-(sunrise-.10))/1.2,2)));
  const smoothing=reducedMotion?1:.025;
  cloud+=(weather.cloud-cloud)*smoothing;
  rain+=(weather.rain-rain)*smoothing;
  snow+=(weather.snow-snow)*smoothing;
  wind+=(clamp(weather.wind/28,.08,2.4)-wind)*smoothing;
  uniforms.uTime.value=reducedMotion?0:time;
  uniforms.uNight.value=night;uniforms.uTwilight.value=twilight;
  uniforms.uCloud.value=cloud;uniforms.uRain.value=rain+snow*.5;uniforms.uWind.value=wind;
  uniforms.uTop.value.copy(palette(THREE,'top',hour,sunrise,sunset));
  uniforms.uHorizon.value.copy(palette(THREE,'horizon',hour,sunrise,sunset));
  key.color.copy(palette(THREE,'key',hour,sunrise,sunset));key.intensity=.45+daylight*1.5+twilight*.3;
  fill.color.copy(palette(THREE,'ambient',hour,sunrise,sunset));fill.intensity=1.0+daylight*.65;
  if(scene.fog){scene.fog.color.copy(palette(THREE,'fog',hour,sunrise,sunset));
    scene.fog.density=.004+cloud*.009+(rain+snow)*.01;}
  const sunProgress=(hour-sunrise)/(sunset-sunrise);
  const sunY=-14+Math.sin(Math.PI*clamp(sunProgress))*38;
  sun.position.set((sunProgress-.5)*72,sunY,-147);
  sun.visible=sunProgress>-.02&&sunProgress<1.02&&sunY>-11;
  key.position.set(sun.position.x*.3,Math.max(5,sunY),12);
  const phase=moonPhase(now);
  const moonTransit=(12+phase*24)%24;
  const moonDiff=((hour-moonTransit+36)%24)-12;
  const moonHeight=-14+Math.sin((moonDiff+6)*Math.PI/12)*37;
  moon.position.set(moonPreview?1.6:-moonDiff*1.20,moonPreview?9.8:14.5+Math.max(-3,moonHeight*.13),-146);
  moon.visible=moonPreview||(night>.12&&Math.abs(moonDiff)<6.5&&phase>.015&&phase<.985);
  moon.material.uniforms.uNight.value=night;
  moon.material.uniforms.uPhase.value=phase;
  state.moonPhase=phase;state.sunrise=sunrise;state.sunset=sunset;
  precipitation.uniforms.uTime.value=reducedMotion?0:time;
  precipitation.uniforms.uWind.value=wind;
  precipitation.uniforms.uSnow.value=snow>rain?1:0;
  precipitation.uniforms.uIntensity.value=Math.max(snow,rain);
  particles.visible=Math.max(snow,rain)>.02;
  state.hour=hour;state.nightFactor=night;state.windKmh=weather.wind;
  state.cloudCover=cloud;state.rain=rain;state.snow=snow;state.renderCount++;
  if(Date.now()-lastFetch>15*60*1000)fetchWeather();
  return {hour,night,daylight,twilight,wind,cloud,rain,snow};
 },dispose(){
  scene.remove(sky,sun,moon,key,fill,particles);
  for(const o of [sky,sun,moon]){o.geometry.dispose();o.material.dispose();}
  geometry.dispose();precipitation.dispose();
 }};
}
