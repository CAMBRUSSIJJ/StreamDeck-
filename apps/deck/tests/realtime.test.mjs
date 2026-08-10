import test from 'node:test';
import assert from 'node:assert/strict';

class FakeWebSocket {
  static OPEN = 1;
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.listeners = new Map();
    this.sent = [];
    FakeWebSocket.instance = this;
    queueMicrotask(() => { this.readyState = 1; this.emit('open', {}); });
  }
  addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); }
  emit(name, event) { for (const fn of this.listeners.get(name) || []) fn(event); }
  send(data) {
    this.sent.push(JSON.parse(data));
    const frame = this.sent.at(-1);
    if (frame[3] === 'phx_join') queueMicrotask(() => this.emit('message', { data: JSON.stringify([frame[0], frame[1], frame[2], 'phx_reply', {status:'ok',response:{postgres_changes:[]}}]) }));
  }
  close() { this.readyState = 3; this.emit('close', {}); }
}

globalThis.WebSocket = FakeWebSocket;
const { RealtimeChannel } = await import('../js/core/realtime.js');

test('joins Supabase protocol v2 channel and broadcasts nexus event', async () => {
  let received = null;
  const channel = new RealtimeChannel({supabaseUrl:'https://abc.supabase.co',supabaseAnonKey:'test key'}, 'nexus-test', payload => { received = payload; });
  await channel.start(1000);
  const ws = FakeWebSocket.instance;
  assert.match(ws.url, /^wss:\/\/abc\.supabase\.co\/realtime\/v1\/websocket\?/);
  const join = ws.sent[0];
  assert.equal(join[2], 'realtime:nexus-test');
  assert.equal(join[3], 'phx_join');
  assert.equal(join[4].config.private, false);
  channel.broadcast({hello:'world'});
  const broadcast = ws.sent.at(-1);
  assert.equal(broadcast[3], 'broadcast');
  assert.deepEqual(broadcast[4], {type:'broadcast',event:'nexus',payload:{hello:'world'}});
  ws.emit('message', {data: JSON.stringify([null,null,'realtime:nexus-test','broadcast',{event:'nexus',payload:{ok:true},type:'broadcast'}])});
  assert.deepEqual(received, {ok:true});
  channel.stop();
});
