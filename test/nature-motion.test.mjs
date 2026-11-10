import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source=readFileSync(new URL('../public/nature-motion.js',import.meta.url),'utf8');

function setup(reduceMotion=false){
  const preference={matches:reduceMotion};
  const win={matchMedia:()=>preference};
  class ImageMock{
    set src(value){this._src=value;this.onload?.();}
  }
  runInNewContext(source,{window:win,Image:ImageMock,console:{warn(){}}});
  return {nature:win.GongangNature,preference};
}
function mockContext(){
  const calls=[];
  const ctx={
    save(){},restore(){},translate(){},scale(){},rotate(){},
    drawImage(...args){calls.push(args)}
  };
  return {ctx,calls};
}

test('foreground uses independently bending plants with fixed roots',()=>{
  const {nature}=setup();
  assert.equal(nature.state.assetReady,true);
  assert.ok(nature.state.grassCount>=100);
  assert.ok(nature.state.leafCount>=10);
  const a=nature.debugAt(0),b=nature.debugAt(2500);
  assert.deepEqual(a.grassRoot,b.grassRoot);
  assert.deepEqual(a.leafRoot,b.leafRoot);
  assert.equal(a.grassTip.y,b.grassTip.y);
  assert.ok(Math.abs(a.grassTip.x-b.grassTip.x)>8,'The reed crown must bend visibly over time');
  assert.ok(Math.abs(a.leafTip.x-b.leafTip.x)>0.5,'Branch tips should move independently');
});

test('Canvas2D fallback paints the curved reed strips, not just a frozen image',()=>{
  const {nature}=setup();
  const {ctx,calls}=mockContext();
  nature.draw(ctx,{x:0,y:0,width:1672,height:941},1800);
  assert.equal(nature.state.drawCalls,1);
  assert.equal(nature.state.gpu,false);
  assert.ok(calls.length>nature.state.grassCount+nature.state.leafCount);
});

test('reduced-motion preference freezes vegetation without hiding it',()=>{
  const {nature}=setup(true);
  const {ctx,calls}=mockContext();
  nature.draw(ctx,{x:0,y:0,width:1672,height:941},1300);
  const count=calls.length;
  nature.draw(ctx,{x:0,y:0,width:1672,height:941},4000);
  assert.equal(nature.state.reducedMotion,true);
  assert.equal(calls.length,count*2);
});
