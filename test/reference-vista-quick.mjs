import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';

const port=43119,base='http://127.0.0.1:'+port;
const output='artifacts/reference-vista';
const sourceHash=createHash('sha256').update(await readFile('public/reference-vista.js')).digest('hex');
const revision=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={revision,sourceSha256:sourceHash,runUrl:process.env.GITHUB_RUN_ID?
  `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`:null,
  generatedAt:new Date().toISOString(),results:[]};
const server=spawn(process.execPath,['server.mjs'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser;
await mkdir(output,{recursive:true});
try{
 let healthy=false;
 for(let i=0;i<100;i++){
  try{const r=await fetch(base+'/healthz');if(r.ok){healthy=true;break;}}
  catch{}
  await new Promise(res=>setTimeout(res,180));
 }
 assert.ok(healthy,'Local game server must become healthy before capture');
 browser=await chromium.launch({headless:true});
 const nightConfigs=[
  {name:'reference-night-clear',width:1672,height:941,time:'23:20',weather:'clear',season:'summer',expectedWinter:false,expectedLight:'night',minStars:.6},
  {name:'reference-night-desktop',width:1440,height:900,time:'23:20',weather:'clear',season:'summer',expectedWinter:false,expectedLight:'night',minStars:.6},
  {name:'reference-mobile-night',width:390,height:844,time:'23:20',weather:'clear',season:'summer',expectedLight:'night',expectedMobileFraming:true},
  {name:'reference-mobile-small',width:360,height:780,time:'23:20',weather:'clear',season:'summer',expectedLight:'night',expectedMobileFraming:true},
  {name:'reference-winter-night',width:1440,height:900,time:'23:20',weather:'clear',season:'winter',expectedWinter:true,expectedSeason:'winter',expectedLight:'night',minStars:.6},
  {name:'reference-overcast-night',width:1440,height:900,time:'23:20',weather:'rain',season:'autumn',expectedWinter:false,expectedWeather:'rain',expectedLight:'night',minStars:.30},
  {name:'reference-edge-canopy',width:1440,height:900,time:'23:20',weather:'clear',season:'summer',edgeTrees:'canopy',expectedEdgeTrees:'canopy',expectedLight:'night',minStars:.6},
  {name:'reference-edge-open',width:1440,height:900,time:'23:20',weather:'clear',season:'summer',edgeTrees:'open',expectedEdgeTrees:'open',expectedLight:'night',minStars:.6},
  {name:'reference-tree-painterly',width:1440,height:900,time:'23:20',weather:'clear',season:'summer',edgeTrees:'open',treeTexture:'painterly',expectedTreeTexture:'painterly',expectedLight:'night',minStars:.6},
  {name:'reference-tree-needles',width:1440,height:900,time:'23:20',weather:'clear',season:'summer',edgeTrees:'open',treeTexture:'needles',expectedTreeTexture:'needles',expectedLight:'night',minStars:.6},
  {name:'reference-spring-dawn',width:1440,height:900,time:'06:55',weather:'clear',season:'spring',expectedWinter:false,expectedSeason:'spring'},
  {name:'reference-summer-day',width:1440,height:900,time:'13:20',weather:'clear',season:'summer',expectedWinter:false,expectedSeason:'summer',expectedLight:'day',maxStars:.03},
  {name:'reference-autumn-dusk',width:1440,height:900,time:'17:15',weather:'cloudy',season:'autumn',expectedWinter:false,expectedSeason:'autumn',expectedWeather:'cloudy'},
  {name:'reference-winter-warm',width:1440,height:900,time:'13:20',weather:'clear',season:'winter',tempC:9,expectedWinter:false,expectedSeason:'winter',expectedLight:'day'}
 ];
 const configs=process.env.REFERENCE_QA_NIGHT_ONLY==='1'?nightConfigs:[...nightConfigs,
  {name:'reference-day-clear',width:1440,height:900,time:'13:20',weather:'clear',expectedLight:'day',maxStars:.03},
  {name:'reference-dusk-cloudy',width:1440,height:900,time:'17:15',weather:'cloudy',expectedWeather:'cloudy'},
  {name:'reference-mobile-rain',width:390,height:844,time:'16:10',weather:'rain',expectedWeather:'rain',expectedMobileFraming:true}
 ];
 for(const cfg of configs){
  const page=await browser.newPage({viewport:{width:cfg.width,height:cfg.height},deviceScaleFactor:1});
  const failures=[],failedAssets=[];
  page.on('pageerror',e=>failures.push(String(e)));
  page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)failedAssets.push({url:r.url(),status:r.status()});});
  const url=base+'/?map=stargaze&renderer=reference&time='+encodeURIComponent(cfg.time)+
    '&weather='+cfg.weather+(cfg.season?'&season='+cfg.season:'')+
    (cfg.tempC!==undefined?'&tempC='+cfg.tempC:'')+
    (cfg.edgeTrees?'&edgeTrees='+cfg.edgeTrees:'')+
    (cfg.treeTexture?'&treeTexture='+cfg.treeTexture:'');
  const started=Date.now();
  await page.goto(url,{waitUntil:'commit'});
  await page.waitForFunction(()=>window.GongangReferenceVista?.state?.ready&&window.GongangReferenceVista.state.frames>=3,null,{timeout:90000});
  await page.evaluate(()=>document.fonts.ready);
  const state=await page.evaluate(()=>({
    ...window.GongangReferenceVista.state,
    loaded:!!window.GongangReferenceVista,
    stargaze:!!window.GongangStargaze,
    traveler:typeof window.GongangStargaze?.drawTraveler==='function',
    selected:new URLSearchParams(location.search).get('renderer')
  }));
  const pixels=await page.evaluate(()=>{
    const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d');
    const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
    let opaque=0,samples=0,min=255,max=0;const colors=new Set();
    for(let y=0;y<canvas.height;y+=13)for(let x=0;x<canvas.width;x+=13){
      const i=(y*canvas.width+x)*4,luma=(data[i]+data[i+1]+data[i+2])/3;
      samples++;if(data[i+3]>240)opaque++;
      min=Math.min(min,luma);max=Math.max(max,luma);
      colors.add((data[i]>>3)+','+(data[i+1]>>3)+','+(data[i+2]>>3));
    }
    return {width:canvas.width,height:canvas.height,opaqueFraction:opaque/samples,
      quantizedColors:colors.size,luminanceRange:max-min};
  });
  const result={name:cfg.name,viewport:{width:cfg.width,height:cfg.height},url,
    elapsedMs:Date.now()-started,state,pixels,failures,failedAssets};
  report.results.push(result);
  // Save the real browser frame before assertions so failed captures remain inspectable.
  const capture=await page.screenshot({path:output+'/'+cfg.name+'.png',timeout:60000});
  result.screenshot={file:cfg.name+'.png',sha256:createHash('sha256').update(capture).digest('hex')};
  if(cfg.name==='reference-night-clear'){
    const bands=await page.evaluate(()=>window.GongangReferenceVista.inspectBands());
    result.bands=bands;
    const foreground=bands.find(b=>b.layer===4);
    assert.ok(foreground?.peaks?.every(p=>p.y!==630||p.color<55),
      'Warm meadow glow must not produce a hard rectangular seam at y=630');
  }
  if(cfg.expectedMobileFraming){
    assert.equal(state.mobileFraming,'portrait-canopy-v1',
      'Portrait decorative trees must frame the original world');
    const camera=await page.evaluate(()=>window.GongangViewCamera.sample());
    assert.ok(camera.zoom<.9,'Phone camera must start with the full sky visible');
  }else assert.equal(state.mobileFraming,'desktop','Laptop visuals must remain unchanged');
  assert.equal(state.ready,true);
  assert.equal(state.error,null);
  assert.equal(state.layers,5);
  assert.equal(state.coordinates,'1672x941','Approved world coordinate system must remain unchanged');
  assert.equal(state.mode,'coordinate-repaint-no-bitmap');
  assert.equal(state.selected,'reference');
  assert.equal(state.traveler,true,'Original traveler renderer must remain available');
  assert.equal(state.moonVisible,false,'Fixed moon must be removed');
  if(cfg.expectedEdgeTrees)assert.equal(state.edgeTrees,cfg.expectedEdgeTrees,
    'Scene must render selected edge framing design');
  if(cfg.expectedTreeTexture)assert.equal(state.treeTexture,cfg.expectedTreeTexture,
    'Requested procedural tree material must be active');
  if(cfg.expectedWinter!==undefined){
    assert.equal(state.winterSnow,cfg.expectedWinter,
      'Snowcaps require both winter and cold real-world conditions');
    assert.equal(state.snowyRocks,cfg.expectedWinter,
      'Winter rock snow overlays must follow the exact snowfall condition');
  }
  if(cfg.expectedSeason)assert.equal(state.season,cfg.expectedSeason,
    'Seasonal foliage layer must match requested season');
  assert.ok(Array.isArray(state.seasonBlend)&&state.seasonBlend.length>=1);
  if(cfg.tempC!==undefined)
    assert.equal(state.temperatureC,cfg.tempC,
      'Warm winter preview must drive live snowpack condition');
  assert.equal(state.weatherSource,'preview','Weather override must drive actual sky');
  const [hour,minute]=cfg.time.split(':').map(Number);
  assert.ok(Math.abs(state.hour-(hour+minute/60))<.001,'Requested capture time must drive actual sky');
  if(cfg.expectedLight)assert.equal(state.light,cfg.expectedLight,JSON.stringify(state));
  if(cfg.expectedWeather)assert.equal(state.weather,cfg.expectedWeather,JSON.stringify(state));
  if(cfg.minStars!==undefined)assert.ok(state.starVisibility>=cfg.minStars,JSON.stringify(state));
  if(cfg.maxStars!==undefined)assert.ok(state.starVisibility<=cfg.maxStars,JSON.stringify(state));
  assert.equal(pixels.width,cfg.width);
  assert.equal(pixels.height,cfg.height);
  assert.ok(pixels.opaqueFraction>.98,'Actual game canvas must cover the viewport');
  assert.ok(pixels.quantizedColors>70&&pixels.luminanceRange>45,'Canvas must contain a detailed rendered scene');
  assert.deepEqual(failures,[],'Javascript errors '+JSON.stringify(failures));
  assert.deepEqual(failedAssets,[],'Failed local assets '+JSON.stringify(failedAssets));
  if(cfg.name==='reference-night-clear'){
    // Exercise the unchanged photograph/camera UI against this real renderer.
    await page.locator('#enterPhoto').click();
    await page.waitForFunction(()=>window.__photoUxDebug?.get().photo===true);
    const before=await page.evaluate(()=>window.GongangReferenceVista.state.frames);
    await page.waitForFunction(n=>window.GongangReferenceVista.state.frames>n+1,before);
    result.photo=await page.evaluate(()=>window.__photoUxDebug.get());
    assert.ok(result.photo.crop.w>0&&result.photo.crop.h>0,'Photo crop must remain valid');
    await page.locator('#closePhoto').click();
    await page.waitForFunction(()=>window.__photoUxDebug.get().photo===false);
  }
  assert.deepEqual(failures,[],'Javascript errors after photograph check '+JSON.stringify(failures));
  assert.deepEqual(failedAssets,[],'Failed local assets after photograph check '+JSON.stringify(failedAssets));
  console.log('REFERENCE DIAG',JSON.stringify(result));
  await page.close();
 }
 report.passed=true;
}catch(error){report.passed=false;report.error=String(error?.stack||error);throw error;}
finally{
 await writeFile(output+'/result.json',JSON.stringify(report,null,2));
 if(browser)await browser.close();server.kill();
}
