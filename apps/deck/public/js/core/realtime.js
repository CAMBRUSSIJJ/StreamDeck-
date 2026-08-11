const HEARTBEAT_MS = 20_000;

export function relayWebsocketUrl(relayUrl, topic, role = 'web') {
  const url = new URL(relayUrl);
  if (!['ws:', 'wss:'].includes(url.protocol)) throw new Error('Nexus Relay deve usar ws/wss');
  url.searchParams.set('room', topic);
  url.searchParams.set('role', role);
  return url.toString();
}

export class RealtimeChannel {
  constructor(config, topic, onBroadcast = () => {}, onState = () => {}) {
    this.config = config;
    this.rawTopic = topic;
    this.onBroadcast = onBroadcast;
    this.onState = onState;
    this.socket = null;
    this.heartbeat = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.stopped = false;
    this.joined = false;
  }

  async start(timeoutMs = 10_000) {
    if (!this.config?.relayUrl) throw new Error('Nexus Relay não configurado');
    this.stopped = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('Tempo limite ao conectar ao Nexus Relay')); }
      }, timeoutMs);
      const original = this.onState;
      this.onState = (state, detail) => {
        original(state, detail);
        if (!settled && state === 'joined') { settled = true; clearTimeout(timeout); resolve(); }
        if (!settled && state === 'error') { settled = true; clearTimeout(timeout); reject(detail instanceof Error ? detail : new Error(String(detail || 'Erro de conexão'))); }
      };
      this.connect();
    });
  }

  connect() {
    if (this.stopped) return;
    this.onState('connecting');
    const ws = new WebSocket(relayWebsocketUrl(this.config.relayUrl, this.rawTopic, 'web'));
    this.socket = ws;
    ws.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.joined = false;
      clearInterval(this.heartbeat);
      this.heartbeat = setInterval(() => this.sendHeartbeat(), HEARTBEAT_MS);
    });
    ws.addEventListener('message', event => this.handleMessage(event.data));
    ws.addEventListener('error', () => this.onState('error', new Error('Falha no Nexus Relay')));
    ws.addEventListener('close', () => {
      this.joined = false;
      clearInterval(this.heartbeat);
      this.heartbeat = null;
      this.onState('disconnected');
      if (!this.stopped) this.scheduleReconnect();
    });
  }

  handleMessage(data) {
    let frame;
    try { frame = JSON.parse(data); } catch { return; }
    if (frame?.type === 'relay-ready' && frame.room === this.rawTopic) {
      this.joined = true;
      this.onState('joined');
      return;
    }
    if (frame?.type === 'nexus' && Object.hasOwn(frame, 'payload')) {
      this.onBroadcast(frame.payload);
    }
  }

  sendHeartbeat() {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type:'ping', ts:Date.now() }));
  }

  broadcast(payload) {
    if (!this.joined) throw new Error('Canal ainda não conectado');
    this.socket.send(JSON.stringify({ type:'nexus', payload }));
  }

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(15_000, 800 * 2 ** Math.min(this.reconnectAttempt++, 5));
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeat);
    try { this.socket?.close(); } catch {}
  }
}
