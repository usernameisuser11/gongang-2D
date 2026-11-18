import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const HOST='http://127.0.0.1:4017';
const OUT='artifacts/blender-vista';
await mkdir(OUT,{recursive:true});
const child=spawn(process.execPath,['server.mjs'],{
  cwd:process.cwd(),
  env:{...process.env,PORT:'4017'},
  stdio:['ignore','pipe','pipe']
});
let output='';
child.stdout.on('data',d=>{output+=String(d)});
child.stderr.on('data',d=>{output+=String(d)});
let browser;
try{
  let running=false;
  for(let i=0;i<100;i++){
    try{const r=await fetch(HOST+'/healthz');if(r.ok){running=true;break;}}
    catch{}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!running)throw Error('Gongang server did not start: '+output.slice(-800));
  browser=await chromium.launch({
    headless:true,
    executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
    args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader',
      '--enable-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader']
  });
  // Captures the latest sculpted fern and portrait-frame GLB, not an old preview.
  const scenes=[
    {name:'desktop-night',width:1440,height:900,dpr:1,time:'23:20'},
    {name:'desktop-dusk',width:1440,height:900,dpr:1,time:'18:10'},
    {name:'mobile-portrait-night',width:390,height:844,dpr:2,time:'23:20'},
    {name:'mobile-portrait-day',width:390,height:844,dpr:2,time:'12:15'}
  ];
  const report=[];
  for(const scene of scenes){
    const page=await browser.newPage({
      viewport:{width:scene.width,height:scene.height},
      deviceScaleFactor:scene.dpr,
      isMobile:scene.width<700,
      hasTouch:scene.width<700
    });
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{
      if(message.type()==='error' && /THREE.WebGLProgram|Shader Error|GLSL|WebGL shader/i.test(message.text()))
        errors.push(message.text());
    });
    const url=HOST+'/?map=stargaze&renderer=blender&time='+scene.time;
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(
      ()=>Boolean(window.GongangBlenderVista?.state?.ready||
                  window.GongangBlenderVista?.state?.failed),
      null,{timeout:40000}
    );
    await page.waitForTimeout(1100);
    const state=await page.evaluate(()=>({...window.GongangBlenderVista.state}));
    report.push({name:scene.name,state,errors});
    await page.screenshot({path:OUT+'/'+scene.name+'.png',fullPage:true});
    await page.locator('#game').screenshot({path:OUT+'/'+scene.name+'-scene.png'});
    await page.locator('#game').screenshot({path:OUT+'/'+scene.name+'-scene.jpg',type:'jpeg',quality:84});
    await page.close();
    if(!state.ready||state.failed)throw Error(scene.name+': '+state.error);
    if(state.meshCount<50||state.triangles<2000)
      throw Error(scene.name+': unexpectedly empty Blender model '+JSON.stringify(state));
    if(state.forestInstances<100||state.forestInstancedDraws<4)
      throw Error(scene.name+': forest was not GPU-instanced '+JSON.stringify(state));
    if(!state.moonReady||state.mistLayers!==3||state.fireflyCount<100||state.windMaterials<2||state.riverMaterials<1||state.terrainMaterials<1||state.moonlitFoliageMaterials<3)
      throw Error(scene.name+': cinematic atmosphere not complete '+JSON.stringify(state));
    if(state.portraitTrees<3||state.portraitTreesVisible!==(scene.width<700?state.portraitTrees:0))
      throw Error(scene.name+': mobile composition was not separated from desktop '+JSON.stringify(state));
    if(scene.width<700 && Math.max(state.renderWidth,state.renderHeight)<1024)
      throw Error(scene.name+': insufficient mobile scenic backing resolution '+JSON.stringify(state));
    const renderedAspect=state.renderWidth/Math.max(1,state.renderHeight);
    if(Math.abs(renderedAspect-state.sourceAspect)/state.sourceAspect>.02)
      throw Error(scene.name+': WebGL scenic rectangle is stretched '+JSON.stringify({renderedAspect,sourceAspect:state.sourceAspect}));
    if(errors.length)throw Error(scene.name+': browser shader errors '+errors.join(' | '));
  }
  await writeFile(OUT+'/report.json',JSON.stringify(report,null,2));
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}finally{
  if(browser)await browser.close();
  child.kill('SIGTERM');
}
