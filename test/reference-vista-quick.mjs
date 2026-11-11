import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
const port=43119,base='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser;
try{
 for(let i=0;i<100;i++){
  try{const r=await fetch(base+'/healthz');if(r.ok)break;}
  catch{}
  await new Promise(res=>setTimeout(res,180));
 }
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
 await mkdir('artifacts/reference-vista',{recursive:true});
 const results=[];
 const configs=[
  {name:'reference-night-clear',width:1440,height:900,time:'23:20',weather:'clear',expectedLight:'night',minStars:.6},
  {name:'reference-day-clear',width:1440,height:900,time:'13:20',weather:'clear',expectedLight:'day',maxStars:.03},
  {name:'reference-dusk-cloudy',width:1440,height:900,time:'17:15',weather:'cloudy',expectedWeather:'cloudy'},
  {name:'reference-mobile-rain',width:390,height:844,time:'16:10',weather:'rain',expectedWeather:'rain'}
 ];
 for(const cfg of configs){
  const page=await browser.newPage({viewport:{width:cfg.width,height:cfg.height},deviceScaleFactor:1});
  const failures=[];
  page.on('pageerror',e=>failures.push(String(e)));
  await page.goto(base+'/?map=stargaze&renderer=reference&time='+encodeURIComponent(cfg.time)+'&weather='+cfg.weather,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(3500);
  const state=await page.evaluate(()=>({
    ...(window.GongangReferenceVista?.state||{}),
    loaded:!!window.GongangReferenceVista,
    stargaze:!!window.GongangStargaze,
    painterly:window.GongangPainterly?.state?.renderCount,
    overlook:window.GongangOverlook25D?.state?.frameCount,
    selected:new URLSearchParams(location.search).get('renderer')
  }));
  console.log('REFERENCE DIAG',JSON.stringify({cfg:cfg.name,state,failures}));
  await page.screenshot({path:'artifacts/reference-vista/'+cfg.name+'.png',timeout:60000});
  assert.equal(state.ready,true,JSON.stringify({state,failures}));
  assert.ok(state.frames>1,JSON.stringify({state,failures}));
  assert.equal(state.layers,5);
  assert.equal(state.mode,'coordinate-repaint-no-bitmap');
  assert.equal(state.moonVisible,false,'Fixed moon must be removed');
  assert.equal(state.weatherSource,'preview','Weather override must drive actual sky');
  if(cfg.expectedLight)assert.equal(state.light,cfg.expectedLight,JSON.stringify(state));
  if(cfg.expectedWeather)assert.equal(state.weather,cfg.expectedWeather,JSON.stringify(state));
  if(cfg.minStars!==undefined)assert.ok(state.starVisibility>=cfg.minStars,JSON.stringify(state));
  if(cfg.maxStars!==undefined)assert.ok(state.starVisibility<=cfg.maxStars,JSON.stringify(state));
  assert.deepEqual(failures,[],'Javascript errors '+JSON.stringify(failures));
  results.push({name:cfg.name,...state});
  await page.close();
 }
 await writeFile('artifacts/reference-vista/result.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{if(browser)await browser.close();server.kill();}
