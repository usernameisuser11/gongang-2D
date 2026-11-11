/* Gongang Living World: time-driven WebGL environment, not a photo panorama.
 * Seoul clock and optional current Seoul weather; procedural sky/stellar cloud shaders,
 * shader precipitation, sunlight, moonlight and scene fog update every frame.
 */
const VS=`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SKY=`
precision highp float;
varying vec2 vUv;
uniform float uTime,uNight,uTwilight,uCloud,uRain,uWind,uSunFocus;
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
 // Deep cobalt zenith and a warm opening toward the far horizon.
 // This atmospheric sun glow is broad, never a sharp beam or neon ring.
 vec3 col=mix(uHorizon,uTop,pow(h,.66));
 float focus=clamp(uSunFocus,.18,.82);
 float deltaX=(sx-focus)/.36;
 float deltaY=(h-.18)/.30;
 float horizonGlow=exp(-(deltaX*deltaX+deltaY*deltaY)*.90);
 float solarGlow=(1.-uNight)*(.22+.34*uTwilight);
 vec3 apricot=mix(vec3(.26,.36,.36),vec3(.62,.30,.18),uTwilight);
 col+=apricot*horizonGlow*solarGlow*(1.-uRain*.40);
 // Soft broken light behind the clouds, no hard geometric shafts.
 float shaft=sin((sx-focus)*12.5+h*6.3+1.1);
 float sunbreak=smoothstep(.22,.92,shaft)*exp(-pow((h-.28)/.56,2.));
 col+=vec3(.19,.14,.10)*horizonGlow*sunbreak
   *(1.-uNight)*(.08+.23*uTwilight)*(1.-uCloud*.54);
 // The sky is dark cobalt overhead, indigo in mid-altitude, and a warm
 // orange-pink band over the far peaks — not a uniform maroon tint.
 col=mix(col,vec3(.48,.12,.33),twilight*gauss(h-.49,.30)*.80);
 col=mix(col,vec3(1.18,.37,.18),twilight*gauss(h-.20,.20)*.89);
 col=mix(col,vec3(.008,.012,.065),twilight*smoothstep(.67,.98,h)*.82);
 col+=vec3(.20,.038,.11)*twilight*gauss(h-.22,.25)*gauss(sx-.55,.70);
 col+=vec3(.54,.22,.078)*twilight*gauss(h-.06,.105)*gauss(sx-.51,.37);
 // Cloud masses stretch along the winds and split into translucent
 // fibrous sheets. Independent scales avoid an oversized noisy ceiling.
 // This remains a single GPU sky plane rather than dozens of cloud sprites.
 vec2 flow=vec2(sx*5.8-t*(.0017+.0007*uWind),h*4.8);
 float n=fbm(flow+vec2(11.3,7.8));
 float fine=fbm(flow*vec2(2.8,1.9)+vec2(26.1,5.5));
 float swirl=fbm(flow*vec2(1.9,1.3)+vec2(73.,19.));
 float cloudField=.62*n+.25*fine+.13*swirl;
 float cloudCover=clamp(uCloud*.87+.09,0.,.94);
 // Three connected cloud strata share the same wind field:
 // distant bright banks, broken mid-level cloudlets and high thin cirrus.
 // Clouds are density volumes projected through one shader, not
 // repeated oval meshes or rectangles covering the mountains.
 float filament=smoothstep(.29,.61,cloudField);
 float veilField=fbm(vec2(sx*13.-t*.0008,h*3.8)+vec2(17.,51.));
 float cirrus=smoothstep(.38,.69,veilField)*gauss(h-.70,.35);
 float bank=smoothstep(.31,.57,n*.70+fine*.30)
    *gauss(h-.33,.24);
 float breakup=smoothstep(.27,.62,swirl)
    *gauss(h-.54,.31);
 float clouds=clamp((filament*(.34+.47*gauss(h-.46,.36))
   +bank*.66+breakup*.16+cirrus*.20)*cloudCover,0.,.91);
 // The tops receive solar scatter while undersides remain slate-blue,
 // and low clouds pick up pink/gold only near real twilight.
 float litTop=clamp(.39+(n-fine)*1.36+.35*h,0.,1.);
 vec3 cloudNight=mix(vec3(.061,.11,.23),vec3(.24,.30,.48),litTop);
 // Softer silver tops and blue-grey shaded undersides make actual
 // cumulus masses legible against the bright daytime atmosphere.
 vec3 cloudDay=mix(vec3(.33,.47,.62),vec3(.99,1.01,1.07),litTop);
 vec3 cloudTone=mix(cloudNight,cloudDay,1.-uNight);
 vec3 sunsetCloud=mix(vec3(.38,.24,.45),vec3(1.04,.64,.53),litTop);
 cloudTone=mix(cloudTone,sunsetCloud,twilight*.82*(1.-.22*h));
 col=mix(col,cloudTone,clouds*.96);
 // Multiple scattering near the horizon is a diffuse gradient, not a
 // hard white strip. Morning haze is bluer, golden only near twilight.
 vec3 daylightHaze=vec3(.17,.30,.37)*(1.-uNight);
 vec3 horizonWarm=vec3(.32,.14,.10)*twilight;
 col+=(daylightHaze+horizonWarm)*gauss(h-.06,.23)*.24;
 // Elongated painted cirrus: wind-sheared high-altitude filaments instead
 // of oversized soft circular cloud blobs. Their edges split at multiple
 // scales, so dawn/day/dusk have distinct natural silhouettes.
 float upper=h+.047*sin(sx*9.2+n*5.1);
 vec2 streakCoord=vec2(sx*6.8-t*(.0019+.0004*uWind),upper*19.0);
 float fibrous=fbm(streakCoord+vec2(2.4,39.1));
 float wispy=fbm(streakCoord*vec2(2.7,.48)+vec2(19.3,4.1));
 float strand=smoothstep(.60,.76,fibrous*.75+wispy*.35);
 float bandMask=gauss(upper-.47,.27)*(1.-gauss(upper-.93,.19));
 float streak=strand*bandMask*cloudCover*.46;
 vec3 shadowedCirrus=mix(vec3(.15,.27,.48),vec3(.70,.79,.92),fine);
 vec3 sunsetCirrus=mix(vec3(.44,.23,.47),vec3(.96,.38,.55),1.-h);
 shadowedCirrus=mix(shadowedCirrus,sunsetCirrus,twilight*.82);
 col=mix(col,shadowedCirrus,streak);
 // Detailed Milky Way: a broad translucent dust cloud, dark lanes, cold
 // blue star clusters. It is not a thin neon line or a flat sprite.
 float axis=sx*.47+h*.31-.45;
 float galacticBand=gauss(axis,.145)*smoothstep(.18,.72,h);
 float core=fbm(vec2(sx*7.6+14.,h*10.8+3.));
 float dust=fbm(vec2(sx*22.+39.,h*22.+9.));
 float galactic=galacticBand*(.23+.78*core)*(.67+.33*dust);
 float veil=max(0.,uNight-.05)*(1.-clouds*.80);
 col+=vec3(.16,.22,.39)*galactic*veil*.78;
 col+=vec3(.09,.17,.33)*gauss(axis+.065,.079)*dust*veil*.61;
 col-=vec3(.06,.045,.08)*galactic*(1.-dust)*veil;
 // Many independent sub-pixel stars: 3 size populations and deterministic
 // per-cell twinkle. No screen-covering white flashes.
 vec2 g=vec2((p.x-.5)*830.,(p.y-.5)*730.);
 vec2 id=floor(g),d=fract(g)-.5;
 d-=(vec2(hash(id+vec2(7.,3.)),hash(id+vec2(9.,18.)))-.5)*.64;
 float starProb=hash(id+vec2(13.,31.));
 float tiny=step(.982,starProb)*exp(-length(d)*16.);
 float shine=(.69+.31*sin(t*(.4+hash(id+vec2(7.,21.))*.63)+starProb*6.28));
 vec2 g2=vec2((p.x-.5)*245.,(p.y-.5)*280.);
 vec2 i2=floor(g2),d2=fract(g2)-.5;
 d2-=(vec2(hash(i2+vec2(1.,3.)),hash(i2+vec2(4.,8.)))-.5)*.62;
 float bright=step(.966,hash(i2+vec2(4.,19.)))*exp(-length(d2)*13.);
 vec2 g3=vec2((p.x-.5)*83.,(p.y-.5)*96.);
 vec2 i3=floor(g3),d3=fract(g3)-.5;
 d3-=(vec2(hash(i3+vec2(2.,8.)),hash(i3+vec2(16.,1.)))-.5)*.50;
 float beacon=step(.993,hash(i3+vec2(12.,2.)))*exp(-length(d3)*9.);
 float stars=(tiny*shine*.88+bright*.76+beacon*.68)*
   max(uNight,twilight*.80)*smoothstep(.12,.47,h)*(1.-clouds*.83);
 col+=vec3(.78,.85,1.)*stars;
 col*=1.-uRain*.17;
 gl_FragColor=vec4(max(col,0.),1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const BODY=`
precision highp float;
varying vec2 vUv;
uniform float uMoon,uNight,uPhase;
float hash(vec2 p){
 return fract(sin(dot(p,vec2(123.3,371.7)))*43758.5453);
}
float textured(vec2 p){
 vec2 g=p*16.0;
 vec2 i=floor(g),f=fract(g);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
  mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
void main(){
 vec2 p=(vUv-.5)*2.;
 float r=length(p);
 float disk=1.-smoothstep(.436,.454,r);
 float halo=exp(-r*r*9.)*.042+exp(-r*r*43.)*.10;
 if(uMoon>.5){
   // A lit spherical disc with correct waxing / waning terminator,
   // rather than a bright geometric C stamped on a transparent card.
   float width=sqrt(max(0.,.445*.445-p.y*p.y));
   float terminator=cos(6.283185*uPhase)*width;
   float waxing=1.-step(.5,uPhase);
   float softness=.010+.009*(1.-clamp(width/.445,0.,1.));
   float litRight=smoothstep(terminator-softness,terminator+softness,p.x);
   float litLeft=1.-smoothstep(-terminator-softness,-terminator+softness,p.x);
   float lit=mix(litLeft,litRight,waxing);
   float sphere=sqrt(max(0.,1.-pow(clamp(r/.445,0.,1.),2.)));
   // Maria, small impact basins and granular regolith are very subtle:
   // surface marks vary continuously and never form discrete sticker circles.
   float sea=.61*textured(p*1.55+vec2(3.1,-1.2))
     +.27*textured(p*4.2-vec2(1.8,2.4))
     +.12*textured(p*11.5);
   float basin1=exp(-dot((p-vec2(-.12,.13))*vec2(4.5,7.8),
                         (p-vec2(-.12,.13))*vec2(4.5,7.8)))*.045;
   float basin2=exp(-dot((p-vec2(.18,-.09))*vec2(7.4,5.2),
                         (p-vec2(.18,-.09))*vec2(7.4,5.2)))*.034;
   float surface=.92+.14*(sea-.5)-basin1-basin2;
   float limbShade=.78+.22*pow(sphere,.35);
   vec3 ivory=vec3(.99,.96,.88)*surface*limbShade;
   vec3 earth=vec3(.075,.111,.158)*( .84+.18*sea);
   vec3 color=mix(earth,ivory,lit);
   float earthshine=.012*uNight*(1.-lit);
   float alpha=disk*(lit*.97+earthshine);
   // Restrained atmosphere bloom, mostly perceptible around the night moon.
   color+=vec3(.13,.17,.26)*halo*.16*uNight;
   gl_FragColor=vec4(color,alpha+halo*.13*uNight);
 }else{
   float shine=1.-smoothstep(.43,.47,r);
   gl_FragColor=vec4(vec3(1.,.83,.51),shine*.91+halo*.58);
 }
}
`;
const PARTICLE_VERT=`
precision highp float;
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
precision highp float;uniform float uSnow;varying float vAlpha;
void main(){
 vec2 q=gl_PointCoord-.5;
 float rain=(1.-smoothstep(.04,.18,abs(q.x)))*(1.-smoothstep(.21,.48,abs(q.y)));
 float snow=1.-smoothstep(.22,.5,length(q));
 gl_FragColor=vec4(mix(vec3(.57,.74,.92),vec3(.95,.96,1.),uSnow),mix(rain,snow,uSnow)*vAlpha*.78);
}`;
const C={
 night:{top:'#040715',horizon:'#17335b',fog:'#193b62',key:'#b2bdec',ambient:'#6b7fae'},
 dawn:{top:'#3555a0',horizon:'#ffbb91',fog:'#8f9bb0',key:'#ffd4ab',ambient:'#c2cce1'},
 day:{top:'#237fbd',horizon:'#b9dddf',fog:'#82b5b7',key:'#fff4dc',ambient:'#d8e9e7'},
 dusk:{top:'#394b91',horizon:'#ffb18a',fog:'#777fa3',key:'#ffd0a8',ambient:'#c9b6dc'}
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
export function createLivingEnvironment(THREE,scene,{reducedMotion=false,camera=null}={}){
 const query=new URLSearchParams(location.search);
 const requestedHour=query.get('time');
 const hourOverride=/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(requestedHour||'')?
  Number(requestedHour.slice(0,2))+Number(requestedHour.slice(3))/60:null;
 const weatherOverride=query.get('weather');
 const moonPreview=query.get('moon')==='show';
 const state={ready:true,mode:'real-time-webgl',weatherSource:'fallback',weather:'clear',
   hour:koreaHour(),nightFactor:1,windKmh:6,cloudCover:.20,rain:0,snow:0,
   fetchError:null,renderCount:0,solarPosition:'Seoul seasonal solar approximation',moonPhase:0,sunrise:0,sunset:0,moonVisible:false,moonUV:null};
 const uniforms={uTime:{value:0},uNight:{value:1},uTwilight:{value:0},
  uCloud:{value:.25},uRain:{value:0},uWind:{value:.3},uSunFocus:{value:.52},
  uTop:{value:new THREE.Color(C.night.top)},
  uHorizon:{value:new THREE.Color(C.night.horizon)}};
 const sky=new THREE.Mesh(new THREE.PlaneGeometry(230,100),new THREE.ShaderMaterial({
  uniforms,vertexShader:VS,fragmentShader:SKY,
  depthWrite:false,depthTest:false,fog:false}));
 sky.position.set(0,-3,-164);sky.renderOrder=-100;scene.add(sky);
 function celestial(moon){
  const mat=new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:BODY,
   uniforms:{uMoon:{value:moon?1:0},uNight:{value:1},uPhase:{value:.15}},transparent:true,
   depthWrite:false,depthTest:true,fog:false});
  const size=moon?4.4:5.7;
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(size,size),mat);
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
 // Preview weather is visible from the first rendered frame.
 // Otherwise the slow screenshot renderer captured a clear sky while
 // the UI reported cloudy/rainy/snowy.
 let cloud=weather.cloud,rain=weather.rain,snow=weather.snow;
 let wind=clamp(weather.wind/28,.08,2.4);
 let previousWeatherTick=performance.now();
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
  // Time-based easing works at 60 fps and with slow software WebGL.
  const weatherTick=performance.now();
  const weatherDt=clamp((weatherTick-previousWeatherTick)/1000,0,.75);
  previousWeatherTick=weatherTick;
  const smoothing=reducedMotion?1:1-Math.exp(-weatherDt*1.70);
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
    // Modest, distance-aware haze; heavy white fog erased all 3D mountains on mobile.
    scene.fog.density=.0019+cloud*.0027+(rain+snow)*.0042;}
  const sunProgress=(hour-sunrise)/(sunset-sunrise);
  uniforms.uSunFocus.value=clamp(.50+(sunProgress-.5)*.64,.22,.78);
  const sunY=-14+Math.sin(Math.PI*clamp(sunProgress))*38;
  sun.position.set((sunProgress-.5)*72,sunY,-147);
  sun.visible=sunProgress>-.02&&sunProgress<1.02&&sunY>-11;
  key.position.set(sun.position.x*.3,Math.max(5,sunY),12);
  const phase=moonPhase(now);
  const moonTransit=(12+phase*24)%24;
  const moonDiff=((hour-moonTransit+36)%24)-12;
  const moonHeight=-14+Math.sin((moonDiff+6)*Math.PI/12)*37;
  // Keep the lunar disc within the visible upper third of the fixed
  // orthographic overlook; -10 world Y projected onto the actual grass.
  moon.position.set(moonPreview?9.0:-moonDiff*.95,
    moonPreview?-1.8:-2.2+Math.max(-1,Math.min(1,moonHeight/24))*3.2,-146);
  moon.rotation.z=moonPreview?-.53:-.30-Math.sin(phase*6.283)*.23;
  moon.visible=moonPreview||(night>.12&&Math.abs(moonDiff)<6.5&&phase>.015&&phase<.985);
  moon.material.uniforms.uNight.value=night;
  moon.material.uniforms.uPhase.value=moonPreview?.105:phase;
  state.moonPhase=phase;state.sunrise=sunrise;state.sunset=sunset;
  state.moonVisible=moon.visible;
  if(camera&&moon.visible){
    const projected=moon.position.clone().project(camera);
    state.moonUV={x:(projected.x+1)*.5,y:(1-projected.y)*.5};
  }else state.moonUV=null;
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
