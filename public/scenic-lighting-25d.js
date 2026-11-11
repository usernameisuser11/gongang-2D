/**
 * Lighting model shared by 2.5D terrain, pine canopy and soft projected
 * foreground shadows. Based on local solar hour, not elapsed app uptime.
 * Approximates a stylised sky, not a precise astronomical ephemeris.
 */
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=t=>t*t*(3-2*t);
export function scenicLighting(env={},moonVisible=false){
  const hour=Number.isFinite(env.hour)?env.hour:12;
  const sunrise=Number.isFinite(env.sunrise)?env.sunrise:6;
  const sunset=Number.isFinite(env.sunset)?env.sunset:18;
  const day=clamp(Number(env.daylight)||0);
  const twilight=clamp(Number(env.twilight)||0);
  const cloud=clamp(Number(env.cloud)||0);
  const storm=clamp(Math.max(Number(env.rain)||0,Number(env.snow)||0));
  const sunArc=clamp((hour-sunrise)/Math.max(4,sunset-sunrise));
  const positiveAltitude=Math.sin(Math.PI*sunArc);
  const sunElev=clamp(.06+.94*positiveAltitude,0,1);
  // Sun crosses scene left to right; projected shadows travel the other way.
  const azimuth=(sunArc-.5)*Math.PI*1.40;
  const sunX=Math.sin(azimuth);
  const sunY=.18+.88*sunElev;
  const sunZ=.55+.28*Math.cos(azimuth);
  const length=Math.hypot(sunX,sunY,sunZ)||1;
  const direct=day*(1-cloud*.64)*(1-storm*.64);
  const moonStrength=moonVisible?(1-day)*.21*(1-cloud*.5):0;
  const shadowStrength=clamp(direct*.70+twilight*.21+moonStrength*.32,0,.8);
  // At sunset shadows are longer; at midday they are short.
  const lowAngle=1-smooth(clamp((sunElev-.08)/.82));
  const shadowLength=(1.6+4.1*lowAngle)*(day>.07?1:.42);
  const sunlight=[sunX/length,sunY/length,sunZ/length];
  const nightDirection=[-.36,.62,.69];
  const mix=clamp(day+twilight*.46);
  const dir=sunlight.map((v,i)=>v*mix+nightDirection[i]*(1-mix));
  const norm=Math.hypot(...dir)||1;
  const color=day>.25
    ? [1,.91-.12*twilight,.77-.18*twilight]
    : [.56+.34*twilight,.70-.18*twilight,1-.26*twilight];
  return {
    direction:dir.map(v=>v/norm),
    color,
    shadowStrength,shadowLength,azimuth,sunElevation:sunElev,
    daylight:day,twilight,storm,cloud,
    exposure:.84+day*.25+twilight*.06
  };
}
