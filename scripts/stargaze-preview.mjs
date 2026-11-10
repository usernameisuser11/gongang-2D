import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { once } from 'node:events';
const port=18731,origin='http://127.0.0.1:'+port;
const server=spawn(process.execPath,['server.mjs'],{
  env:{...process.env,PORT:String(port),SUPABASE_URL:'',SUPABASE_ANON_KEY:''},
  stdio:['ignore','pipe','pipe']
});
let browser;
async function health(){
  for(let i=0;i<90;i++){
    if(server.exitCode!==null)throw Error('Server exited before browser preview');
    try{const r=await fetch(origin+'/healthz');if(r.ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  throw Error('Preview server unavailable');
}
try{
  await health();
  await mkdir('artifacts/stargaze',{recursive:true});
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  page.on('console',msg=>{if(msg.type()==='error'&&!msg.text().includes('favicon'))errors.push(msg.text())});
  await page.goto(origin+'/?map=stargaze',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__stargazeDebug?.get().art?.ready && window.__stargazeDebug?.get().rendered>=4,{timeout:25000});
  await page.waitForTimeout(400);
  if(!(await page.locator('#skyDock').isVisible()))throw Error('Sky controls not visible');
  const grains=await page.evaluate(()=>window.__stargazeDebug?.get().grains);
  if(!grains||grains.textureSize!==128)
    throw Error('Original Quasar v129 grain renderer missing: '+JSON.stringify(grains));
  for(const [name,minSize] of [
    ['scenic_overlook.webp',200000],['scenic_overlook_mobile.webp',50000],
    ['meadow_foreground.webp',40000],['mountain_depth.webp',40000],
    ['mist_high.webp',1000],['mist_low.webp',1000]
  ]){
    const asset=await fetch(origin+'/assets/'+name);
    if(!asset.ok||!asset.headers.get('content-type')?.includes('image/webp'))
      throw Error('Painterly art asset not served: '+name);
    const bytes=(await asset.arrayBuffer()).byteLength;
    if(bytes<minSize)throw Error('Unexpectedly small art asset '+name+': '+bytes);
  }
  const grainScript=await fetch(origin+'/stellar-grains.js');
  if(!grainScript.ok||!(await grainScript.text()).includes('11.4')){
    throw new Error('Native Stellar Explosion profile missing from public script');
  }
  console.log('Original Quasar profile preserved; first-party compressed painterly art assets verified');

  if(await page.locator('[data-map="campus"]').count())throw Error('Retired autumn campus is still listed');
  const retired=await browser.newPage({viewport:{width:900,height:640}});
  await retired.goto(origin+'/?map=campus',{waitUntil:'domcontentloaded'});
  await retired.waitForFunction(()=>window.__stargazeDebug?.get().scene==='stargaze',{timeout:20000});
  if(!retired.url().includes('map=stargaze'))throw Error('Old campus link was not redirected');
  await retired.close();
  const imageStats=await page.evaluate(()=>{
    const c=document.querySelector('#game'),context=c.getContext('2d');
    const {width,height}=c;
    const pts=[[.36,.24],[.50,.35],[.61,.34],[.42,.68],[.74,.78],[.14,.9]];
    return pts.map(([x,y])=>[...context.getImageData(Math.floor(width*x),Math.floor(height*y),1,1).data].slice(0,3));
  });
  if(new Set(imageStats.map(c=>c.join(','))).size<4)throw Error('Landscape looks flat or blank');
  await page.screenshot({path:'artifacts/stargaze/panorama.png'});
  // Ensure the existing high-resolution PNG photo workflow still works.
  await page.locator('#enterPhoto').click();
  await page.waitForFunction(()=>window.__photoUxDebug?.get().photo===true,{timeout:8000});
  await page.locator('#uxShutter').click();
  await page.waitForFunction(()=>window.__photoUxDebug?.get().preview===true,{timeout:20000});
  await page.locator('#uxDismiss').click();
  await page.locator('#closePhoto').click();
  await page.waitForFunction(()=>window.__photoUxDebug?.get().photo===false);
  await page.locator('[data-sky-view]').click();
  await page.waitForFunction(()=>window.__stargazeDebug?.get().view==='personal');
  for(const pose of ['sit','lie']){
    await page.locator('[data-pose="'+pose+'"]').click();
    if(!await page.locator('[data-pose="'+pose+'"]').evaluate(el=>el.classList.contains('active')))
      throw Error(pose+' pose control failed');
  }
  await page.screenshot({path:'artifacts/stargaze/personal.png'});
  await page.locator('[data-sky-view]').click();
  await page.waitForFunction(()=>window.__stargazeDebug?.get().view==='wide');
  await page.waitForFunction(()=>!document.querySelector('[data-sky-event="fireworks"]')?.disabled,{timeout:15000});
  await page.locator('[data-sky-event="fireworks"]').click();
  await page.waitForFunction(()=>window.__stargazeDebug?.get().event?.kind==='fireworks',{timeout:7000});
  await page.waitForTimeout(2300);
  await page.screenshot({path:'artifacts/stargaze/fireworks.png'});
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  mobile.on('pageerror',e=>errors.push(String(e)));
  await mobile.goto(origin+'/?map=stargaze',{waitUntil:'domcontentloaded'});
  await mobile.waitForFunction(()=>window.__stargazeDebug?.get().art?.ready && window.__stargazeDebug?.get().rendered>=4,{timeout:25000});
  await mobile.screenshot({path:'artifacts/stargaze/mobile.png'});
  for(const target of [page,mobile]){
    const info=await target.evaluate(()=>window.__stargazeDebug.get());
    if(!info.art?.ready||info.art.failed.length)
      throw Error('Painterly art failed to load: '+JSON.stringify(info));
    if(info.staticLayers!==0||info.cachedMegabytes>1)
      throw Error('Heavy procedural scene must not be rebuilt when photo art loads: '+JSON.stringify(info));
    if(info.art.renderCount<4)
      throw Error('Painterly background did not repaint');
    if(info.grains.animatedGrains>155)throw Error('Animated star budget exceeded');
    console.log('Painterly WebP panorama ready in '+info.art.loadMs+'ms, '+info.art.renderCount+' frames, procedural canvas caches: '+info.staticLayers);
  }
  for(const file of ['panorama','personal','fireworks','mobile']){
    const size=(await stat('artifacts/stargaze/'+file+'.png')).size;
    if(size<30000)throw Error(file+' screenshot unexpectedly small '+size);
    console.log(file+': '+size+' bytes');
  }
  if(errors.length)throw Error('Browser JS errors: '+errors.join('\n'));
  console.log('Stargaze screenshots and shared event smoke checks passed');
}finally{
  await browser?.close();
  server.kill('SIGTERM');
  if(server.exitCode===null)await Promise.race([once(server,'exit').catch(()=>{}),new Promise(r=>setTimeout(r,1500))]);
}
