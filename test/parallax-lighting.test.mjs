import assert from 'node:assert/strict';
import test from 'node:test';
import {parallaxFactor,parallaxInput,parallaxShift} from '../public/parallax-25d.js';
import {scenicLighting} from '../public/scenic-lighting-25d.js';

test('real player movement drives parallax; nearby forest moves much more than distant ridge',()=>{
 const old=parallaxInput({x:1600,z:1530,offsetX:0,offsetY:0});
 const moved=parallaxInput({x:2240,z:1590,offsetX:110,offsetY:40});
 assert.notEqual(moved.x,old.x);
 assert.notEqual(moved.y,old.y);
 const near=parallaxShift(moved,24);
 const far=parallaxShift(moved,-143);
 assert.ok(Math.abs(near.x)>Math.abs(far.x)*12);
 assert.ok(parallaxFactor(24)>parallaxFactor(-143));
});
test('mobile drag changes parallax without moving shared avatar positions',()=>{
 const a=parallaxInput({x:1600,z:1530,offsetX:0,offsetY:0},{width:390,height:844});
 const b=parallaxInput({x:1600,z:1530,offsetX:150,offsetY:-45},{width:390,height:844});
 assert.notEqual(a.x,b.x);
 assert.notEqual(a.y,b.y);
 assert.ok(parallaxFactor(-160)>.02);
});
test('sunlight and its shadow change across the day; clouds reduce shadow contrast',()=>{
 const noon=scenicLighting({hour:12,sunrise:6,sunset:18,daylight:1,cloud:.05});
 const sunrise=scenicLighting({hour:7,sunrise:6,sunset:18,daylight:.45,twilight:.65,cloud:.05});
 const evening=scenicLighting({hour:17,sunrise:6,sunset:18,daylight:.5,twilight:.5,cloud:.05});
 const storm=scenicLighting({hour:12,sunrise:6,sunset:18,daylight:1,cloud:.95,rain:.95});
 const night=scenicLighting({hour:23,sunrise:6,sunset:18,daylight:0},true);
 assert.ok(noon.shadowStrength>storm.shadowStrength);
 assert.ok(sunrise.shadowLength>noon.shadowLength);
 assert.ok(Math.abs(sunrise.direction[0]-evening.direction[0])>.3);
 assert.ok(noon.shadowStrength>night.shadowStrength);
 assert.ok(Math.abs(Math.hypot(...noon.direction)-1)<.00001);
});
