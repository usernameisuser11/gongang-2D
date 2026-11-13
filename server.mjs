import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

const ROOT = dirname(fileURLToPath(import.meta.url));
const MAX_PEERS = 8;
const MAPS = ['river', 'stargaze'];
// Server-side guard: old tabs and custom clients must never put avatars on roofs.
const WALK_LIMITS = {river:{minX:115,maxX:3080,minZ:1540,maxZ:1750},stargaze:{minX:115,maxX:3080,minZ:1500,maxZ:1740}};
const rooms = Object.fromEntries(MAPS.map(m => [m, new Map()]));
// Local preview runners pass --port; Railway supplies PORT through the env.
const portFlag = process.argv.indexOf('--port');
const previewPort = portFlag >= 0 ? process.argv[portFlag + 1] : undefined;
const port = Number(process.env.PORT || previewPort || 3000);
const dbURL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const dbKey = String(process.env.SUPABASE_ANON_KEY || '');
const html = await readFile(join(ROOT, 'public', 'index.html'));
const stargazeScript = await readFile(join(ROOT, 'public', 'stargaze.js'));
const stellarGrainScript = await readFile(join(ROOT, 'public', 'stellar-grains.js'));
const painterlyScript = await readFile(join(ROOT, 'public', 'scenic-art.js'));
const referenceVistaScript = await readFile(join(ROOT, 'public', 'reference-vista.js'));
const natureMotionScript = await readFile(join(ROOT, 'public', 'nature-motion.js'));
const dioramaScript = await readFile(join(ROOT, 'public', 'diorama-3d.js'));
const scenicModelLoader = await readFile(join(ROOT, 'public', 'scenic-model-loader.js'));
const cinematicAtmosphere = await readFile(join(ROOT, 'public', 'cinematic-atmosphere.js'));
const livingEnvironment = await readFile(join(ROOT, 'public', 'living-environment-3d.js'));
const livingOverlook25d = await readFile(join(ROOT, 'public', 'overlook-25d.js'));
const parallax25d = await readFile(join(ROOT, 'public', 'parallax-25d.js'));
const scenicLighting25d = await readFile(join(ROOT, 'public', 'scenic-lighting-25d.js'));
const overlookShadows25d = await readFile(join(ROOT, 'public', 'overlook-shadows-25d.js'));
const overlookGround25d = await readFile(join(ROOT, 'public', 'overlook-ground-25d.js'));
const meadowEdge25d = await readFile(join(ROOT, 'public', 'meadow-edge-25d.js'));
const vistaDetails25d = await readFile(join(ROOT, 'public', 'vista-details-25d.js'));
const atmosphericDepth25d = await readFile(join(ROOT, 'public', 'atmospheric-depth-25d.js'));
const valleySculpt = await readFile(join(ROOT, 'public', 'valley-sculpt-3d.js'));
const terrainStream = await readFile(join(ROOT, 'public', 'terrain-stream-3d.js'));
const overlookDetails3d = await readFile(join(ROOT, 'public', 'overlook-details-3d.js'));
const cinematicForest3d = await readFile(join(ROOT, 'public', 'cinematic-forest-3d.js'));
const rockMaterials = await readFile(join(ROOT, 'public', 'rock-materials-3d.js'));
const foliageBillboards3d = await readFile(join(ROOT, 'public', 'foliage-billboards-3d.js'));
const hybridScenicProps = await readFile(join(ROOT, 'public', 'hybrid-scenic-props.js'));
const painterlyClouds = await readFile(join(ROOT, 'public', 'painterly-clouds-3d.js'));
const scenicModelNames = [
  'moonlit-lookout.obj', 'moonlit-lookout.mtl',
  'alpine-valley.obj', 'alpine-valley.mtl',
  'alpine-pine.obj', 'alpine-pine.mtl',
  'alpine-grove.json'
];
const scenicModelAssets = new Map(await Promise.all(scenicModelNames.map(async name => [
  '/assets/models/' + name,
  await readFile(join(ROOT, 'public', 'assets', 'models', name))
])));
const threeModule = await readFile(join(ROOT, 'node_modules', 'three', 'build', 'three.module.js'));
const threeCore = await readFile(join(ROOT, 'node_modules', 'three', 'build', 'three.core.js'));
const foliageGpuScript = await readFile(join(ROOT, 'public', 'foliage-gpu.js'));
const foliageAtlas = await readFile(join(ROOT, 'public', 'assets', 'foliage-atlas.svg'));
const artFileNames = [
  'scenic_overlook.webp', 'scenic_overlook_mobile.webp',
  'mountain_depth.webp', 'meadow_foreground.webp', 'mist_high.webp', 'mist_low.webp'
];
const painterlyAssets = new Map(await Promise.all(artFileNames.map(async name => [
  '/assets/' + name, await readFile(join(ROOT, 'public', 'assets', name))
])));

let lastDbError = null;
let dbWriteOk = false;

async function saveVisit(map) {
  if (!dbURL || !dbKey) {
    lastDbError = 'Supabase environment not configured';
    return;
  }
  try {
    const result = await fetch(dbURL + '/rest/v1/gongang2d_visits', {
      method: 'POST',
      headers: {
        apikey: dbKey,
        Authorization: 'Bearer ' + dbKey,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal'
      },
      body: JSON.stringify({ visit_id: randomUUID(), map_id: map }),
      signal: AbortSignal.timeout(5000)
    });
    if (!result.ok) throw new Error('Supabase HTTP ' + result.status);
    dbWriteOk = true;
    lastDbError = null;
  } catch (error) {
    dbWriteOk = false;
    lastDbError = String(error?.message || error);
    console.error('Supabase visit log unavailable:', lastDbError);
  }
}

const server = createServer((req, res) => {
  let path;
  try { path = new URL(req.url, 'http://localhost').pathname; }
  catch { res.writeHead(400).end(); return; }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' }).end(); return;
  }
  if (path === '/healthz') {
    const body = JSON.stringify({
      ok: true, mode: '2d', capacity: MAX_PEERS,
      dbConfigured: Boolean(dbURL && dbKey), dbWriteOk,
      rooms: Object.fromEntries(MAPS.map(m => [m, rooms[m].size]))
    });
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(req.method === 'HEAD' ? undefined : body);
    return;
  }
  if (path === '/' || path === '/index.html') {
    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Length': html.length,
      'Content-Security-Policy': "default-src 'self' data: blob:; img-src 'self' data: blob:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://api.open-meteo.com ws: wss:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"
    });
    if (req.method === 'HEAD') res.end();
    else res.end(html);
    return;
  }
  if (path === '/assets/foliage-atlas.svg') {
    res.writeHead(200, {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Content-Length': foliageAtlas.byteLength,
      'Cache-Control': 'public, max-age=86400',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    });
    res.end(req.method === 'HEAD' ? undefined : foliageAtlas);
    return;
  }
  if (path === '/foliage-gpu.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': foliageGpuScript.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : foliageGpuScript);
    return;
  }
  if (path === '/nature-motion.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': natureMotionScript.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : natureMotionScript);
    return;
  }
  if (path === '/diorama-3d.js' || path === '/vendor/three.module.js' || path === '/vendor/three.core.js') {
    const source = path === '/diorama-3d.js' ? dioramaScript :
      path === '/vendor/three.module.js' ? threeModule : threeCore;
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': source.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : source);
    return;
  }
  // The browser loads the editable 3D meshes as static content; no path traversal.
  if (path === '/scenic-model-loader.js' ||
      path === '/cinematic-atmosphere.js' ||
      path === '/living-environment-3d.js' ||
      path === '/overlook-25d.js' ||
      path === '/parallax-25d.js' ||
      path === '/scenic-lighting-25d.js' ||
      path === '/overlook-shadows-25d.js' ||
      path === '/overlook-ground-25d.js' ||
      path === '/meadow-edge-25d.js' ||
      path === '/vista-details-25d.js' ||
      path === '/atmospheric-depth-25d.js' ||
      path === '/valley-sculpt-3d.js' ||
      path === '/terrain-stream-3d.js' ||
      path === '/overlook-details-3d.js' ||
      path === '/cinematic-forest-3d.js' ||
      path === '/rock-materials-3d.js' ||
      path === '/foliage-billboards-3d.js' ||
      path === '/hybrid-scenic-props.js' ||
      path === '/painterly-clouds-3d.js') {
    const script = path === '/scenic-model-loader.js' ? scenicModelLoader
      : path === '/cinematic-atmosphere.js' ? cinematicAtmosphere
      : path === '/living-environment-3d.js' ? livingEnvironment
      : path === '/overlook-25d.js' ? livingOverlook25d
      : path === '/parallax-25d.js' ? parallax25d
      : path === '/scenic-lighting-25d.js' ? scenicLighting25d
      : path === '/overlook-shadows-25d.js' ? overlookShadows25d
      : path === '/overlook-ground-25d.js' ? overlookGround25d
      : path === '/meadow-edge-25d.js' ? meadowEdge25d
      : path === '/vista-details-25d.js' ? vistaDetails25d
      : path === '/atmospheric-depth-25d.js' ? atmosphericDepth25d
      : path === '/valley-sculpt-3d.js' ? valleySculpt
      : path === '/terrain-stream-3d.js' ? terrainStream
      : path === '/overlook-details-3d.js' ? overlookDetails3d
      : path === '/cinematic-forest-3d.js' ? cinematicForest3d
      : path === '/rock-materials-3d.js' ? rockMaterials
      : path === '/foliage-billboards-3d.js' ? foliageBillboards3d
      : path === '/hybrid-scenic-props.js' ? hybridScenicProps
      : painterlyClouds;
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': script.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : script);
    return;
  }
  if (scenicModelAssets.has(path)) {
    const asset = scenicModelAssets.get(path);
    const type = path.endsWith('.json') ? 'application/json' : 'text/plain';
    res.writeHead(200, {
      'Content-Type': type + '; charset=utf-8',
      'Content-Length': asset.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : asset);
    return;
  }
  if (path === '/reference-vista.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': referenceVistaScript.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : referenceVistaScript);
    return;
  }
  if (path === '/scenic-art.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': painterlyScript.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : painterlyScript);
    return;
  }
  if (painterlyAssets.has(path)) {
    const asset = painterlyAssets.get(path);
    res.writeHead(200, {
      'Content-Type': 'image/webp',
      'Content-Length': asset.byteLength,
      'Cache-Control': 'public, max-age=86400'
    });
    res.end(req.method === 'HEAD' ? undefined : asset);
    return;
  }
  if (path === '/stellar-grains.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': stellarGrainScript.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : stellarGrainScript);
    return;
  }
  if (path === '/stargaze.js') {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Content-Length': stargazeScript.byteLength,
      'Cache-Control': 'public, max-age=300'
    });
    res.end(req.method === 'HEAD' ? undefined : stargazeScript);
    return;
  }
  if (path === '/favicon.ico') { res.writeHead(204).end(); return; }
  res.writeHead(404).end();
});

const presence = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 1024 });
function send(ws, msg) {
  if (ws.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > 65536) { ws.terminate(); return; }
  ws.send(typeof msg === 'string' ? msg : JSON.stringify(msg));
}
function validState(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 1024) return null;
  let s;
  try { s = JSON.parse(raw); } catch { return null; }
  if (!s || s.type !== 'state' || !['idle', 'walk', 'sit', 'lie'].includes(s.pose)) return null;
  const { x, z, yaw, gesture = 0, signal = 0, pose } = s;
  if (![x, z, yaw].every(v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 10000)) return null;
  if (![gesture, signal].every(v => Number.isSafeInteger(v) && v >= 0)) return null;
  return { x, z, yaw, pose, gesture, signal };
}
const pending = new Map();
const skyEventState = new Map();
const SKY_EVENT_COOLDOWN_MS = 90000;
function snapshot(map) {
  pending.delete(map);
  const players = [...rooms[map].values()].filter(peer => peer.state).map(peer => ({ id: peer.id, ...peer.state }));
  const text = JSON.stringify({ type: 'snapshot', players });
  for (const ws of rooms[map].keys()) send(ws, text);
}
function schedule(map) {
  if (!pending.has(map)) pending.set(map, setTimeout(() => snapshot(map), 55));
}
server.on('upgrade', (req, socket, head) => {
  let url;
  try { url = new URL(req.url, 'http://localhost'); }
  catch { socket.destroy(); return; }
  if (url.pathname !== '/presence') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
  }
  const origin = req.headers.origin;
  let goodOrigin = false;
  try {
    const parsed = new URL(origin);
    goodOrigin = ['https:', 'http:'].includes(parsed.protocol) && parsed.host === req.headers.host;
  } catch { /* invalid origin */ }
  if (!goodOrigin) {
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return;
  }
  const map = MAPS.includes(url.searchParams.get('map')) ? url.searchParams.get('map') : 'stargaze';
  presence.handleUpgrade(req, socket, head, ws => presence.emit('connection', ws, map));
});
presence.on('connection', (ws, map) => {
  const room = rooms[map];
  if (room.size >= MAX_PEERS) {
    send(ws, { type: 'full' });
    ws.close(1013, 'Room full');
    return;
  }
  const peer = { id: randomUUID(), state: null, lastSent: 0, alive: true };
  room.set(ws, peer);
  const latestSkyEvent = skyEventState.get(map);
  send(ws, {
    type: 'welcome', id: peer.id, capacity: MAX_PEERS, serverTime: Date.now(),
    skyEvent: latestSkyEvent && Date.now() < latestSkyEvent.startsAt
      + latestSkyEvent.duration * 1000 ? latestSkyEvent : null
  });
  const handshake = setTimeout(() => {
    if (peer.state === null) ws.close(1008, 'State required');
  }, 12000);
  ws.on('pong', () => { peer.alive = true; });
  ws.on('error', () => ws.terminate());
  ws.on('message', (data, binary) => {
    if (binary) return;
    const raw = data.toString();
    if (Buffer.byteLength(raw) > 1024) return;
    let command = null;
    try { command = JSON.parse(raw); } catch { return; }
    if (command?.type === 'sky_event') {
      if (map !== 'stargaze' || !peer.state || !['meteor', 'fireworks'].includes(command.kind)) return;
      const now = Date.now();
      const last = skyEventState.get(map);
      const elapsed = last ? now - (last.startsAt - 1100) : Infinity;
      if (elapsed < SKY_EVENT_COOLDOWN_MS) {
        send(ws, { type: 'sky_event_unavailable', waitMs: Math.max(0, SKY_EVENT_COOLDOWN_MS - elapsed) });
        return;
      }
      const next = {
        type: 'sky_event',
        kind: command.kind,
        startsAt: now + 1100,
        seed: Math.floor(Math.random() * 0x7fffffff),
        duration: command.kind === 'meteor' ? 15 : 17
      };
      skyEventState.set(map, next);
      for (const client of room.keys()) send(client, next);
      return;
    }
    if (command?.type === 'group_action') {
      if (!peer.state || !['heart','wave','cheer'].includes(command.action)) return;
      const now = Date.now();
      if (now - (peer.lastGroupAt || 0) < 5800) return;
      const members = [...room.values()].filter(other =>
        other.state &&
        Math.abs(other.state.x - peer.state.x) <= 250 &&
        Math.abs(other.state.z - peer.state.z) <= 115
      );
      const need = command.action === 'cheer' ? 3 : 2;
      if (members.length < need) {
        send(ws, { type:'group_unavailable',need,nearby:members.length });
        return;
      }
      peer.lastGroupAt = now;
      const event = {
        type: 'group_pose',
        action: command.action,
        participants: members.map(member => member.id).slice(0, MAX_PEERS),
        expiresAt: now + 9000
      };
      for (const client of room.keys()) send(client, event);
      return;
    }
    const state = validState(raw);
    if (!state) return;
    const bounds = WALK_LIMITS[map];
    state.x = Math.min(bounds.maxX, Math.max(bounds.minX, state.x));
    state.z = Math.min(bounds.maxZ, Math.max(bounds.minZ, state.z));
    const now = Date.now();
    const actionChanged = peer.state && ['pose', 'gesture', 'signal'].some(k => state[k] !== peer.state[k]);
    if (!actionChanged && now - peer.lastSent < 40) return;
    peer.lastSent = now;
    if (peer.state && Object.keys(state).every(k => state[k] === peer.state[k])) return;
    const first = peer.state === null;
    peer.state = state;
    if (first) {
      clearTimeout(handshake);
      void saveVisit(map);
    }
    schedule(map);
  });
  ws.on('close', () => {
    clearTimeout(handshake);
    room.delete(ws);
    schedule(map);
  });
});
const heartbeat = setInterval(() => {
  for (const map of MAPS) for (const [ws, peer] of rooms[map]) {
    if (!peer.alive) { ws.terminate(); continue; }
    if (ws.readyState === WebSocket.OPEN) { peer.alive = false; ws.ping(); }
  }
}, 15000);
function shutdown() {
  clearInterval(heartbeat);
  for (const map of MAPS) for (const ws of rooms[map].keys()) ws.terminate();
  server.close();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.listen(port, '0.0.0.0', () => console.log('Gongang 2D listening on ' + port));
