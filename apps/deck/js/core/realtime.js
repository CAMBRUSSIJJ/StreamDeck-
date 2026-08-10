const HEARTBEAT_MS = 20_000;

function websocketUrl(supabaseUrl, anonKey) {
  const url = new URL(supabaseUrl);
  const scheme = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${scheme}//${url.host}/realtime/v1/websocket?apikey=${encodeURIComponent(anonKey)}&vsn=2.0.0`;
}

export class RealtimeChannel {
  constructor(config, topic, onBroadcast = () => {}, onState = () => {}) {
    this.config = config;
    this.topic = `realtime:${topic}`;
    this.onBroadcast = onBroadcast;
    this.onState = onState;
    this.socket = null;
    this.joinRef = null;
    this.ref = 0;
    this.heartbeat = null;
    this.reconnectTimer = null;
    this.reconnectAttempt = 0;
    this.stopped = false;
    this.joined = false;
  }

  nextRef() { this.ref += 1; return String(this.ref); }

  async start(timeoutMs = 10_000) {
    this.stopped = false;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('Tempo limite ao conectar ao relay')); }
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
    const ws = new WebSocket(websocketUrl(this.config.supabaseUrl, this.config.supabaseAnonKey));
    this.socket = ws;
    ws.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.joined = false;
      const ref = this.nextRef();
      this.joinRef = ref;
      this.sendFrame(ref, ref, 'phx_join', {
        config: {
          broadcast: { ack: false, self: false },
          presence: { enabled: false, key: '' },
          postgres_changes: [],
          private: false
        }
      });
      this.heartbeat = setInterval(() => this.sendHeartbeat(), HEARTBEAT_MS);
    });
    ws.addEventListener('message', event => this.handleMessage(event.data));
    ws.addEventListener('error', () => this.onState('error', new Error('Falha no WebSocket')));
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
    if (!Array.isArray(frame) || frame.length !== 5) return;
    const [joinRef, ref, topic, event, payload] = frame;
    if (event === 'phx_reply' && ref === this.joinRef && payload?.status === 'ok') {
      this.joined = true;
      this.onState('joined');
      return;
    }
    if (topic === this.topic && event === 'broadcast' && payload?.event === 'nexus') {
      this.onBroadcast(payload.payload);
    }
  }

  sendFrame(joinRef, ref, event, payload, topic = this.topic) {
    if (this.socket?.readyState !== WebSocket.OPEN) throw new Error('Relay desconectado');
    this.socket.send(JSON.stringify([joinRef, ref, topic, event, payload]));
  }

  sendHeartbeat() {
    if (this.socket?.readyState !== WebSocket.OPEN) return;
    const ref = this.nextRef();
    this.socket.send(JSON.stringify([null, ref, 'phoenix', 'heartbeat', {}]));
  }

  broadcast(payload) {
    if (!this.joined) throw new Error('Canal ainda não conectado');
    const ref = this.nextRef();
    this.sendFrame(this.joinRef, ref, 'broadcast', { type: 'broadcast', event: 'nexus', payload });
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
