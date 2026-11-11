import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sampleValleyHeight, sampleValleyNormal,
  getValleyFlow, createValleyGroveLayout
} from '../public/valley-sculpt-3d.js';

test('one continuous terrain elevation across all five game-world chunk boundaries',()=>{
  for(const seam of [-130,-104,-79,-52]){
    for(const x of [-60,-30,-15,0,15,30,60]){
      const left=sampleValleyHeight(x,seam-.0001);
      const middle=sampleValleyHeight(x,seam);
      const right=sampleValleyHeight(x,seam+.0001);
      assert.ok([left,middle,right].every(Number.isFinite));
      assert.ok(Math.abs(left-middle)<.10 && Math.abs(middle-right)<.10,
        'Terrain tear at x='+x+', z='+seam);
    }
  }
});
test('real valley basin is lower than both highland walls; center overlook is walkable',()=>{
  for(const z of [-126,-90,-65]){
    const axis=getValleyFlow(z);
    const mid=sampleValleyHeight(axis,z);
    const left=sampleValleyHeight(axis-57,z);
    const right=sampleValleyHeight(axis+57,z);
    assert.ok(left>mid+2 && right>mid+2, 'No geometric valley at '+z);
  }
  const seat=sampleValleyHeight(0,18);
  const n=sampleValleyNormal(0,18);
  assert.ok(seat>-4.5&&seat<-2.0, 'Overlook should be near view-point elevation');
  assert.ok(n.y>.85, 'The center area must be suitable for sitting');
});
test('forest meshes sample the same ground used by the renderer',()=>{
  for(const mobile of [false,true]){
    const trees=createValleyGroveLayout({mobile});
    assert.ok(trees.length>30);
    for(const tree of trees){
      const [x,y,z]=tree.position;
      assert.ok(Math.abs(y-sampleValleyHeight(x,z)-.04)<.001,
        'Tree trunk floating above/below terrain');
    }
  }
});
test('terrain slopes and rivers remain finite across desktop and mobile ranges',()=>{
  for(let z=-158;z<=43;z+=5){
    for(let x=-85;x<=85;x+=11){
      const y=sampleValleyHeight(x,z),normal=sampleValleyNormal(x,z);
      assert.ok(Number.isFinite(y)&&y>-80&&y<110);
      assert.ok(Number.isFinite(normal.y)&&normal.y>0&&normal.y<=1);
    }
    assert.ok(Number.isFinite(sampleValleyHeight(getValleyFlow(z),z)));
  }
});
