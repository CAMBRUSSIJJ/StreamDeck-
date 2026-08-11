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
    queueMicrotask(() => {
      this.readyState = 1;
      this.emit('open', {});
      const parsed = new URL(this.url);
      queueMicrotask(() => this.emit('message', { data: JSON.stringify({ type:'relay-ready', room:parsed.searchParams.get('room'), protocolVersion:1 }) }));
    });
  }
  addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); }
  emit(name, event) { for (const fn of this.listeners.get(name) || []) fn(event); }
  send(data) { this.sent.push(JSON.parse(data)); }
  close() { this.readyState = 3; this.emit('close', {}); }
}

globalThis.WebSocket = FakeWebSocket;
const { RealtimeChannel, relayWebsocketUrl } = await import('../public/js/core/realtime.js');

test('Nexus Relay URL carries room and web role', () => {
  const value = relayWebsocketUrl('wss://nexus.example/api/relay', 'nexus-device-Abc_1234');
  const parsed = new URL(value);
  assert.equal(parsed.protocol, 'wss:');
  assert.equal(parsed.pathname, '/api/relay');
  assert.equal(parsed.searchParams.get('room'), 'nexus-device-Abc_1234');
  assert.equal(parsed.searchParams.get('role'), 'web');
});

test('joins Nexus Relay and broadcasts Nexus frames', async () => {
  let received = null;
  const channel = new RealtimeChannel({relayUrl:'wss://nexus.example/api/relay'}, 'nexus-device-Abc_1234', payload => { received = payload; });
  await channel.start(1000);
  const ws = FakeWebSocket.instance;
  assert.equal(new URL(ws.url).pathname, '/api/relay');
  channel.broadcast({hello:'world'});
  assert.deepEqual(ws.sent.at(-1), {type:'nexus', payload:{hello:'world'}});
  ws.emit('message', {data: JSON.stringify({type:'nexus', payload:{ok:true}})});
  assert.deepEqual(received, {ok:true});
  channel.stop();
});
