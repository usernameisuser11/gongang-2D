import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer as createTcpServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';

async function randomPort(){
  const listener=createTcpServer();
  await new Promise(resolve=>listener.listen(0,'127.0.0.1',resolve));
  const port=listener.address().port;
  await new Promise(resolve=>listener.close(resolve));
  return port;
}
async function waitForServer(origin){
  for(let i=0;i<90;i++){
    try{const r=await fetch(origin+'/healthz');if(r.ok)return r.json()}catch{}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw new Error('Local server did not start in time');
}
function state(x=1600,z=1610,pose='sit'){
  return JSON.stringify({type:'state',x,z,yaw:0,pose,gesture:0,signal:0});
}
function waitForType(ws,type,condition=()=>true,timeout=6000){
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{ws.off('message',onMessage);reject(new Error('Timed out waiting for '+type))},timeout);
    function onMessage(data){
      let message;try{message=JSON.parse(data.toString())}catch{return}
      if(message.type===type&&condition(message)){
        clearTimeout(timer);ws.off('message',onMessage);resolve(message);
      }
    }
    ws.on('message',onMessage);
  });
}

test('stargaze preserves 8-person multiplayer and synchronizes fireworks', {timeout:30000}, async t=>{
  const port=await randomPort(),origin='http://127.0.0.1:'+port;
  const server=spawn(process.execPath,['server.mjs'],{
    env:{...process.env,PORT:String(port),SUPABASE_URL:'',SUPABASE_ANON_KEY:''},
    stdio:['ignore','pipe','pipe']
  });
  let stderr='';
  server.stderr.on('data',chunk=>{stderr+=String(chunk)});
  const sockets=[];
  t.after(async()=>{
    for(const socket of sockets)socket.terminate();
    if(server.exitCode===null)server.kill('SIGTERM');
    await Promise.race([once(server,'exit').catch(()=>{}),new Promise(r=>setTimeout(r,2000))]);
  });
  const health=await waitForServer(origin);
  assert.equal(health.capacity,8);
  assert.ok(Object.hasOwn(health.rooms,'stargaze'));
  const script=await fetch(origin+'/stargaze.js');
  assert.equal(script.status,200);
  assert.match(script.headers.get('content-type'),/javascript/);
  assert.match(await script.text(),/GongangStargaze/);
  for(let i=0;i<8;i++){
    const socket=new WebSocket('ws://127.0.0.1:'+port+'/presence?map=stargaze',{
      headers:{Origin:origin}
    });
    sockets.push(socket);
    await once(socket,'open');
    socket.send(state(1450+i*45,1620,i%2?'lie':'sit'));
  }
  const [a]=sockets;
  const snapshot=await waitForType(a,'snapshot',msg=>msg.players.length===8);
  assert.equal(snapshot.players.filter(p=>p.pose==='sit').length,4);
  assert.equal(snapshot.players.filter(p=>p.pose==='lie').length,4);
  const overflow=new WebSocket('ws://127.0.0.1:'+port+'/presence?map=stargaze',{headers:{Origin:origin}});
  sockets.push(overflow);
  const full=waitForType(overflow,'full');
  await full;
  const shared=sockets.slice(0,8).map(socket=>waitForType(socket,'sky_event'));
  a.send(JSON.stringify({type:'sky_event',kind:'fireworks'}));
  const [x,...others]=await Promise.all(shared);
  assert.equal(x.kind,'fireworks');
  for(const y of others)assert.deepEqual(x,y,'All eight room members must receive one identical event');
  assert.ok(x.startsAt>Date.now()-1000);
  const unavailable=waitForType(a,'sky_event_unavailable');
  a.send(JSON.stringify({type:'sky_event',kind:'meteor'}));
  assert.ok((await unavailable).waitMs>0);
  const h=await (await fetch(origin+'/healthz')).json();
  assert.equal(h.rooms.stargaze,8);
});
