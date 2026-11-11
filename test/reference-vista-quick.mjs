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
 for(const cfg of [{name:'reference-desktop',width:1440,height:900},{name:'reference-mobile',width:390,height:844}]){
  const page=await browser.newPage({viewport:{width:cfg.width,height:cfg.height},deviceScaleFactor:1});
  const failures=[];
  page.on('pageerror',e=>failures.push(String(e)));
  await page.goto(base+'/?map=stargaze&renderer=reference&time=18:10&weather=clear',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.GongangReferenceVista?.state?.frames>1 || window.GongangReferenceVista?.state?.error,
    null,{timeout:25000});
  const state=await page.evaluate(()=>({...window.GongangReferenceVista.state}));
  assert.equal(state.ready,true,JSON.stringify(state));
  assert.ok(state.frames>1);
  assert.equal(state.layers,5);
  assert.equal(state.mode,'coordinate-repaint-no-bitmap');
  assert.deepEqual(failures,[],'Javascript errors '+JSON.stringify(failures));
  await page.screenshot({path:'artifacts/reference-vista/'+cfg.name+'.png',timeout:60000});
  results.push({name:cfg.name,...state});
  await page.close();
 }
 await writeFile('artifacts/reference-vista/result.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{if(browser)await browser.close();server.kill();}
