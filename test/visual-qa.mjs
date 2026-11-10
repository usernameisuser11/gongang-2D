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
  { name: 'desktop-cinematic', width: 1440, height: 900, query: '?map=stargaze', threeD: true },
  { name: 'mobile-cinematic', width: 390, height: 844, query: '?map=stargaze', threeD: true },
  { name: 'desktop-old-baseline', width: 1440, height: 900, query: '?map=stargaze&models=off&cinema=off', threeD: false }
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
      await page.waitForFunction(() => {
        const s = window.GongangDiorama3D?.state;
        return Boolean(s?.renderCount > 2 || s?.failed);
      }, null, { timeout: 30000 });
      if (config.threeD) {
        await page.waitForFunction(() => {
          const s = window.GongangDiorama3D?.state;
          return Boolean(s?.failed || (s?.modelLoaded || s?.modelError)
            && (s?.terrainLoaded || s?.terrainError)
            && (s?.groveLoaded || s?.groveError));
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
          cinemaError: s.cinemaError, pineCount: s.pineCount
        };
      });
      const canvas = page.locator('#game');
      await canvas.screenshot({ path: 'artifacts/landscape/' + config.name + '.png' });
      results.push({ name: config.name, state, errors });
      assert.equal(state.ready, true, config.name + ': renderer is not ready');
      assert.equal(state.failed, false, config.name + ': ' + state.error);
      assert.ok(state.renderCount > 2, config.name + ': not rendering frames');
      if (config.threeD) {
        assert.ok(state.terrainLoaded, 'Terrain model failed: ' + state.terrainError);
        assert.ok(state.groveLoaded, '3D pine forest failed: ' + state.groveError);
        assert.ok(state.modelLoaded, 'Lookout failed: ' + state.modelError);
        assert.ok(state.hazeLayers >= 2, 'No atmospheric depth layers rendered');
        assert.ok(state.clouds >= 4, 'No painterly cloud banks');
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
