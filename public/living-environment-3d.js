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
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,w=.5;for(int j=0;j<4;j++){v+=w*noise(p);p=p*2.07+vec2(17.4,4.9);w*=.5;}return v;}
void main(){
 vec2 p=vUv;float t=uTime;
 vec3 col=mix(uHorizon,uTop,pow(p.y,.74));
 float n=fbm(vec2(p.x*5.1-t*(.003+.001*uWind),p.y*4.3)+vec2(2.8,6.1));
 float fine=fbm(vec2(p.x*11.6-t*.0048,p.y*7.8)+vec2(19.3,1.4));
 float veil=smoothstep(.48,.73,n*.78+fine*.39);
 float envelope=.32+.68*exp(-pow((p.y-.49)/.30,2.));
 float cloud=uCloud*veil*envelope;
 vec3 cloudColor=mix(vec3(.11,.17,.30),vec3(.38,.43,.59),fine);
 cloudColor=mix(cloudColor,vec3(.84,.51,.60),uTwilight*.69);
 cloudColor=mix(cloudColor,vec3(.85,.89,.94),1.-uNight);
 col=mix(col,cloudColor,cloud*.85);
 float galaxyBand=p.x*.73+p.y*.42-.70;
 float galaxy=exp(-pow(galaxyBand/.16,2.))*(.25+.75*fbm(p*9.2+vec2(3.,8.)));
 col+=vec3(.13,.115,.26)*galaxy*uNight*(1.-cloud*.85);
 vec2 g=p*vec2(188.,96.),id=floor(g),delta=fract(g)-.5;
 vec2 jitter=(vec2(hash(id+7.),hash(id+18.))-.5)*.68;
 float r=length(delta-jitter);
 float exist=step(.950,hash(id+31.));
 float twinkle=.72+.28*sin(t*(.8+hash(id+29.)*.8)+hash(id+16.)*6.28);
 float star=exist*exp(-r*51.)*twinkle;
 col+=vec3(.70,.82,1.)*star*uNight*(1.-cloud*.9)*smoothstep(.21,.42,p.y);
 col+=vec3(.17,.036,.072)*uTwilight*exp(-pow((p.y-.19)/.22,2.));
 col*=1.-uRain*.11;
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
 night:{top:'#03091d',horizon:'#1a2e56',fog:'#274765',key:'#b2bdec',ambient:'#7288b1'},
 dawn:{top:'#14284e',horizon:'#ff9a84',fog:'#8b8ca5',key:'#ffc99b',ambient:'#adb9d8'},
 day:{top:'#246db1',horizon:'#b0d7e9',fog:'#9cb9ca',key:'#fff2d7',ambient:'#d9e8f0'},
 dusk:{top:'#091a3b',horizon:'#ff6481',fog:'#6b7095',key:'#ffb18b',ambient:'#afb4de'}
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
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(12,12),mat);
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
  moon.position.set(-moonDiff*3.0,moonHeight,-146);
  moon.visible=night>.12&&Math.abs(moonDiff)<6.5&&phase>.015&&phase<.985;
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
