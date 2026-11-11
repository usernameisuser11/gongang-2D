/** Save desktop/mobile screenshots and assert that the real Three.js meshes load.
 * Run in CI after installing Playwright and Chromium.
 * No live service, secrets, or production deployment required.
 */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { chromium } from 'playwright';

const PORT = 43117;
const ROOT = 'http://127.0.0.1:' + PORT;
const snapshots = [
  { name: 'desktop-25d-dawn', width: 1440, height: 900, query: '?map=stargaze&time=06:10&weather=clear', kind: '25d', expectedHour: 6.1667, expectedWeather: 'clear' },
  { name: 'desktop-25d-day', width: 1440, height: 900, query: '?map=stargaze&time=13:20&weather=cloudy', kind: '25d', expectedHour: 13.3333, expectedWeather: 'cloudy' },
  { name: 'desktop-25d-sunset', width: 1440, height: 900, query: '?map=stargaze&time=18:10&weather=clear', kind: '25d', expectedHour: 18.1667, expectedWeather: 'clear' },
  { name: 'desktop-25d-night', width: 1440, height: 900, query: '?map=stargaze&time=23:20&weather=clear', kind: '25d', expectedHour: 23.3333, expectedWeather: 'clear' },
  { name: 'desktop-25d-parallax', width: 1440, height: 900, query: '?map=stargaze&time=13:20&weather=clear', kind: '25d', expectedHour: 13.3333, expectedWeather: 'clear', checkParallax: true },
  { name: 'desktop-25d-moon', width: 1440, height: 900, query: '?map=stargaze&time=18:10&weather=clear&moon=show', kind: '25d', expectedHour: 18.1667, expectedWeather: 'clear', expectedMoon: true },
  { name: 'mobile-25d-rain', width: 390, height: 844, query: '?map=stargaze&time=16:10&weather=rain', kind: '25d', expectedHour: 16.1667, expectedWeather: 'rain' },
  { name: 'mobile-25d-snow', width: 390, height: 844, query: '?map=stargaze&time=08:10&weather=snow', kind: '25d', expectedHour: 8.1667, expectedWeather: 'snow' },
  { name: 'desktop-painted-baseline', width: 1440, height: 900, query: '?map=stargaze&renderer=2d', kind: 'painterly' },
  { name: 'desktop-legacy-3d', width: 1440, height: 900, query: '?map=stargaze&renderer=3d', kind: '3d' }
];

const server = spawn(process.execPath, ['server.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ['ignore', 'pipe', 'pipe']
});
let logs = '';
for (const channel of [server.stdout, server.stderr]) {
  channel.setEncoding('utf8');
  channel.on('data', data => {
    logs += data;
    if (logs.length > 30000) logs = logs.slice(-30000);
  });
}
let browser = null;
const results = [];

async function readyServer() {
  for (let retry = 0; retry < 100; retry++) {
    if (server.exitCode !== null) throw new Error('Server exited: ' + logs);
    try {
      const response = await fetch(ROOT + '/healthz');
      if (response.ok) return;
    } catch {}
    await sleep(150);
  }
  throw new Error('Server did not become healthy: ' + logs);
}

try {
  await mkdir('artifacts/landscape', { recursive: true });
  await readyServer();
  browser = await chromium.launch({
    headless: true,
    args: ['--enable-webgl', '--enable-unsafe-swiftshader', '--use-gl=angle',
      '--use-angle=swiftshader']
  });
  for (const config of snapshots) {
    const context = await browser.newContext({
      viewport: { width: config.width, height: config.height },
      deviceScaleFactor: 1,
      isMobile: config.width < 600,
      hasTouch: config.width < 600
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      const bad=/WebGLProgram|shader error|GL_INVALID|Shader Error|VALIDATE_STATUS|FRAGMENT_SHADER|VERTEX_SHADER/i.test(message.text());
      if(message.type()==='error' && bad) errors.push('WebGL shader error: '+message.text().slice(0,1200));
    });
    page.on('response', response => {
      if (response.status() >= 400 && response.url().includes('/assets/models/')) {
        errors.push('Asset HTTP ' + response.status() + ': ' + response.url());
      }
    });
    try {
      await page.goto(ROOT + '/' + config.query, { waitUntil: 'domcontentloaded' });
      if (config.kind === '25d') {
        await page.waitForFunction(() => {
          const s = window.GongangOverlook25D?.state;
          return Boolean(s?.frameCount > 2 || s?.failed);
        }, null, { timeout: 30000 });
      } else if (config.kind === '3d' || config.kind === 'live') {
        await page.waitForFunction(() => {
          const s = window.GongangDiorama3D?.state;
          return Boolean(s?.renderCount > 2 || s?.failed);
        }, null, { timeout: 30000 });
        if (config.kind === '3d') await page.waitForFunction(() => {
          const s = window.GongangDiorama3D?.state;
          return Boolean(s?.failed || ((s?.modelLoaded || s?.modelError)
            && (s?.terrainLoaded || s?.terrainError)
            && (s?.groveLoaded || s?.groveError)));
        }, null, { timeout: 30000 });
      } else {
        await page.waitForFunction(() =>
          window.GongangPainterly?.readyToDraw && window.GongangPainterly.state.renderCount > 2,
          null, { timeout: 30000 });
      }
      if (config.kind === 'hybrid') {
        await page.waitForFunction(() => {
          const s = window.GongangHybrid3D?.state;
          return Boolean(s?.ready && s.frames > 2 || s?.failed);
        }, null, { timeout: 30000 });
      }
      await page.waitForTimeout(1100);
      if(config.checkParallax){
        // Synthetic keydown exercises the actual window input listener
        // without unreliable focus in headless Chromium. The condition is
        // evaluated on the rendered parallax, not merely on event delivery.
        const before=await page.evaluate(()=>({
          camera:window.GongangViewCamera?.sample?.(),
          frames:window.GongangOverlook25D?.state.frameCount,
          parallax:window.GongangOverlook25D?.state.parallax.x
        }));
        await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent(
          'keydown',{key:'d',bubbles:true})));
        try{
          await page.waitForFunction(start=>{
            const c=window.GongangViewCamera?.sample?.();
            const p=window.GongangOverlook25D?.state.parallax.x;
            return Number.isFinite(c?.x)&&c.x>(start.camera?.x||1600)+13
              &&Math.abs(p-start.parallax)>.009;
          },before,{timeout:24000,polling:250});
        }finally{
          await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent(
            'keyup',{key:'d',bubbles:true})));
        }
      }
      const state = await page.evaluate(() => {
        const s = window.GongangDiorama3D?.state || {};
        return {
          ready: s.ready, failed: s.failed, error: s.error,
          renderCount: s.renderCount, clouds: s.clouds, hazeLayers: s.hazeLayers,
          modelLoaded: s.modelLoaded, modelError: s.modelError,
          terrainLoaded: s.terrainLoaded, terrainError: s.terrainError,
          groveLoaded: s.groveLoaded, groveError: s.groveError,
          cinemaError: s.cinemaError, pineCount: s.pineCount,
          painterly: window.GongangPainterly?.state || null,
          hybrid: window.GongangHybrid3D?.state || null,
          environment: s.environment || null,
          overlook25d: window.GongangOverlook25D?.state || null,
          liveMode: s.liveMode,
          sculptedRidges:s.sculptedRidges, groveAnchored:s.groveAnchored, freeSeating:s.freeSeating, geologyPieces:s.geologyPieces,
          terrainTopology:s.terrainTopology, terrainTriangles:s.terrainTriangles, terrainStreamVertices:s.terrainStreamVertices
        };
      });
      // Capturing the viewport avoids Playwright waiting for an "element
      // stable" animation frame while the WebGL canvas is actively drawing.
      await page.screenshot({
        path: 'artifacts/landscape/' + config.name + '.png',
        animations: 'disabled',
        timeout: 60000
      });
      results.push({ name: config.name, state, errors });
      if (config.kind === '25d') {
        const o=state.overlook25d;
        assert.equal(o?.failed, false, config.name + ': ' + o?.error);
        assert.equal(o?.ready, true, config.name + ': 2.5D renderer unavailable');
        assert.ok(o.frameCount > 2, config.name + ': world is not animating');
        assert.ok(o.ridgeCount >= 6, 'Several depth-separated mountains are required');
        assert.ok(o.atmosphereLayers >= 4, 'Time-responsive depth mist layers are missing');
        assert.ok(o.shadowCasters >= 4, 'Foreground trees do not have projected shadows');
        assert.ok(o.rockCount >= (config.width < 600 ? 4 : 8),'Large scenic rocks missing');
        assert.equal(o.soilDetail,'painted-dirt-lichen-pebbles',
          'Static dirt and tiny pebbles should be painted into ground shader');
        assert.ok(o.flowerCount >= (config.width < 600 ? 90 : 200),'Wildflowers missing');
        assert.ok(o.meadowPlants >= (config.width < 600 ? 90 : 200),
          'Organic 2.5D wind-driven lookout vegetation is missing');
        assert.ok(Number.isFinite(o.lighting?.azimuth), 'Sun/moon lighting direction missing');
        assert.ok(Number.isFinite(o.lighting?.shadowStrength), 'Moving shadows missing');
        assert.ok(Number.isFinite(o.lighting?.shadowLength), 'Sun-angle shadow length missing');
        if(config.checkParallax){
          assert.ok(Math.abs(o.nearShift)>Math.abs(o.farShift)*9,
            'Nearby forest should scroll more than distant mountains: '+
              JSON.stringify({near:o.nearShift,far:o.farShift}));
        }
        assert.ok(o.treeCount > (config.width < 600 ? 250 : 700),
          '3D tree silhouettes not instanced correctly: '+o.treeCount);
        assert.equal(o.retainsVisitors, true, 'Real visitor compositing disabled');
        assert.equal(o.weather?.weather, config.expectedWeather, 'Weather preview mismatch');
        assert.ok(Math.abs(o.weather?.hour-config.expectedHour)<.025,
          'Clock preview failed: '+o.weather?.hour);
        assert.ok(o.weather?.renderCount > 2, 'Live celestial/weather model not updating');
        if(config.expectedMoon){
          assert.equal(o.weather?.moonVisible, true, 'Crescent scene lost its moon');
          const p=o.weather?.moonUV;
          assert.ok(p && p.x>0 && p.x<1 && p.y>0 && p.y<1,
            'Moon out of visible sky: '+JSON.stringify(p));
        }
      }
      if (config.kind === 'painterly' || config.kind === 'hybrid') {
        assert.equal(state.painterly?.ready, true, config.name + ': painted art missing');
        assert.ok(state.painterly.renderCount > 2, config.name + ': art not rendering');
      }
      if (config.kind === 'hybrid') {
        assert.equal(state.hybrid?.ready, true, config.name + ': hybrid overlay failed: ' + state.hybrid?.error);
        assert.equal(state.hybrid?.failed, false, config.name + ': hybrid overlay failed');
        assert.ok(state.hybrid.frames > 2, config.name + ': hybrid overlay did not draw');
      }
      if (config.kind === '3d' || config.kind === 'live') {
        assert.equal(state.ready, true, config.name + ': 3D renderer is not ready');
        assert.equal(state.failed, false, config.name + ': ' + state.error);
        assert.ok(state.renderCount > 2, config.name + ': 3D not rendering');
        if (config.kind === 'live') {
          assert.equal(state.liveMode, true, 'Live scene not activated');
          assert.equal(state.environment?.ready, true, 'No living environment');
          assert.equal(state.sculptedRidges, 5, 'The live world must show five actual 3D mountain ridges');
          assert.equal(state.terrainTopology, 'continuous-heightfield',
            'Must use connected heightfield terrain, not paper-thin backdrop planes');
          assert.ok(state.terrainTriangles > 10000,
            'Actual 3D terrain needs subdivision for erosion');
          assert.ok(state.terrainStreamVertices >= (config.width < 600 ? 300 : 850),
            'River must follow sampled terrain surface');
          assert.equal(state.groveAnchored, true, '3D pine trees must follow actual ridge surfaces');
          assert.equal(state.freeSeating, true, 'The middle of the vista must remain available for sitting');
          assert.ok(state.geologyPieces>=20, 'Actual 3D edge geology missing');
          assert.equal(state.environment?.weather, config.expectedWeather, 'Weather preset mismatch');
          assert.ok(Math.abs(state.environment.hour-config.expectedHour)<.025, 'Incorrect time-of-day');
          assert.ok(state.environment.renderCount > 2, 'Sky/lighting did not advance');
          assert.ok(state.pineCount >= (config.width < 600 ? 500 : 1000),
            'Dense 3D canopy is missing: ' + state.pineCount);
          if (config.expectedMoon) {
            assert.equal(state.environment.moonVisible, true, 'Crescent preview moon missing');
            const p = state.environment.moonUV;
            assert.ok(p && p.x > .42 && p.x < .63 && p.y > .21 && p.y < .46,
              'Moon is outside sky framing: ' + JSON.stringify(p));
          }
        }
        assert.ok(state.terrainLoaded, 'Terrain model failed: ' + state.terrainError);
        assert.ok(state.groveLoaded, '3D pine forest failed: ' + state.groveError);
        assert.ok(state.modelLoaded, 'Lookout failed: ' + state.modelError);
        if (config.kind === '3d') {
          assert.ok(state.hazeLayers >= 2, 'No atmospheric depth layers rendered');
          assert.ok(state.clouds >= 4, 'No painterly cloud banks');
        }
        assert.equal(state.cinemaError, null, 'Cinematic atmosphere failed');
      }
      assert.equal(errors.length, 0, config.name + ': page script failures: ' + errors.join('; '));
    } finally {
      await context.close();
    }
  }
  // Same world, real different solar lighting/shadow states across clock tests.
  const resultFor=name=>results.find(r=>r.name===name)?.state?.overlook25d?.lighting;
  const noon=resultFor('desktop-25d-day');
  const night=resultFor('desktop-25d-night');
  const dawn=resultFor('desktop-25d-dawn');
  const sunset=resultFor('desktop-25d-sunset');
  assert.ok(noon&&night&&dawn&&sunset,'Dynamic lighting scenes not captured');
  assert.ok(noon.shadowStrength>night.shadowStrength+.12,
    'No meaningful day-to-night projected shadow contrast');
  assert.ok(Math.abs(dawn.azimuth-sunset.azimuth)>.40,
    'Sun direction should change across dawn and dusk');
  assert.ok(dawn.shadowLength>noon.shadowLength,
    'Low angle morning sun should cast longer shadows than daytime');
} finally {
  await writeFile('artifacts/landscape/report.json',
    JSON.stringify({ results, serverTail: logs.slice(-4000) }, null, 2));
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log('Gongang visual QA complete:', results.map(r => r.name).join(', '));
