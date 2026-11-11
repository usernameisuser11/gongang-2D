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
  { name: 'desktop-live-dawn', width: 1440, height: 900, query: '?map=stargaze&time=06:10&weather=clear', kind: 'live', expectedHour: 6.1667, expectedWeather: 'clear' },
  { name: 'desktop-live-day', width: 1440, height: 900, query: '?map=stargaze&time=13:20&weather=cloudy', kind: 'live', expectedHour: 13.3333, expectedWeather: 'cloudy' },
  { name: 'desktop-live-sunset', width: 1440, height: 900, query: '?map=stargaze&time=18:10&weather=clear', kind: 'live', expectedHour: 18.1667, expectedWeather: 'clear' },
  { name: 'desktop-live-night', width: 1440, height: 900, query: '?map=stargaze&time=23:20&weather=clear', kind: 'live', expectedHour: 23.3333, expectedWeather: 'clear' },
  { name: 'mobile-live-rain', width: 390, height: 844, query: '?map=stargaze&time=16:10&weather=rain', kind: 'live', expectedHour: 16.1667, expectedWeather: 'rain' },
  { name: 'mobile-live-snow', width: 390, height: 844, query: '?map=stargaze&time=08:10&weather=snow', kind: 'live', expectedHour: 8.1667, expectedWeather: 'snow' },
  { name: 'desktop-painterly-baseline', width: 1440, height: 900, query: '?map=stargaze&renderer=2d', kind: 'painterly' },
  { name: 'desktop-hybrid-baseline', width: 1440, height: 900, query: '?map=stargaze&renderer=2d&hybrid=on', kind: 'hybrid' },
  { name: 'desktop-sculpted-3d-baseline', width: 1440, height: 900, query: '?map=stargaze&renderer=3d', kind: '3d' }
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
    page.on('response', response => {
      if (response.status() >= 400 && response.url().includes('/assets/models/')) {
        errors.push('Asset HTTP ' + response.status() + ': ' + response.url());
      }
    });
    try {
      await page.goto(ROOT + '/' + config.query, { waitUntil: 'domcontentloaded' });
      if (config.kind === '3d' || config.kind === 'live') {
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
          liveMode: s.liveMode,
          sculptedRidges:s.sculptedRidges, groveAnchored:s.groveAnchored, freeSeating:s.freeSeating, geologyPieces:s.geologyPieces
        };
      });
      const canvas = page.locator('#game');
      await canvas.screenshot({ path: 'artifacts/landscape/' + config.name + '.png' });
      results.push({ name: config.name, state, errors });
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
          assert.equal(state.groveAnchored, true, '3D pine trees must follow actual ridge surfaces');
          assert.equal(state.freeSeating, true, 'The middle of the vista must remain available for sitting');
          assert.ok(state.geologyPieces>=20, 'Actual 3D edge geology missing');
          assert.equal(state.environment?.weather, config.expectedWeather, 'Weather preset mismatch');
          assert.ok(Math.abs(state.environment.hour-config.expectedHour)<.025, 'Incorrect time-of-day');
          assert.ok(state.environment.renderCount > 2, 'Sky/lighting did not advance');
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
} finally {
  await writeFile('artifacts/landscape/report.json',
    JSON.stringify({ results, serverTail: logs.slice(-4000) }, null, 2));
  if (browser) await browser.close();
  server.kill('SIGTERM');
}

console.log('Gongang visual QA complete:', results.map(r => r.name).join(', '));
