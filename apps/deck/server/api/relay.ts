import { defineWebSocketHandler } from 'nitro';

const PAIR_ROOM = /^nexus-pair-\d{6}$/;
const DEVICE_ROOM = /^nexus-device-[A-Za-z0-9_-]{8,128}$/;
const MAX_MESSAGE_BYTES = 384 * 1024;
const RATE_WINDOW_MS = 10_000;

type RelayContext = {
  room: string;
  role: 'web' | 'bridge' | 'client';
  windowStartedAt: number;
  messagesInWindow: number;
};

function validRoom(room: string) {
  return PAIR_ROOM.test(room) || DEVICE_ROOM.test(room);
}

function withinRateLimit(context: RelayContext) {
  const now = Date.now();
  if (now - context.windowStartedAt >= RATE_WINDOW_MS) {
    context.windowStartedAt = now;
    context.messagesInWindow = 0;
  }
  context.messagesInWindow += 1;
  const limit = PAIR_ROOM.test(context.room) ? 30 : 180;
  return context.messagesInWindow <= limit;
}

export default defineWebSocketHandler({
  upgrade(request) {
    const url = new URL(request.url);
    const room = url.searchParams.get('room') || '';
    const rawRole = url.searchParams.get('role') || 'client';
    if (!validRoom(room)) throw new Response('Invalid Nexus room', { status: 400 });
    if (!['web', 'bridge', 'client'].includes(rawRole)) throw new Response('Invalid Nexus role', { status: 400 });
    const role = rawRole as RelayContext['role'];
    return {
      namespace: `nexus-relay:${room}`,
      context: { room, role, windowStartedAt: Date.now(), messagesInWindow: 0 } satisfies RelayContext
    };
  },

  open(peer) {
    const context = peer.context as RelayContext;
    peer.subscribe('nexus');
    peer.send({
      type: 'relay-ready',
      room: context.room,
      role: context.role,
      protocolVersion: 1,
      ts: Date.now()
    });
  },

  message(peer, message) {
    const context = peer.context as RelayContext;
    if (!withinRateLimit(context)) {
      peer.close(1008, 'rate-limit');
      return;
    }

    const text = message.text();
    if (new TextEncoder().encode(text).byteLength > MAX_MESSAGE_BYTES) {
      peer.send({ type: 'relay-error', error: 'message-too-large' });
      return;
    }

    let frame: any;
    try { frame = JSON.parse(text); } catch {
      peer.send({ type: 'relay-error', error: 'invalid-json' });
      return;
    }

    if (frame?.type === 'ping') {
      peer.send({ type: 'pong', ts: Date.now() });
      return;
    }
    if (frame?.type !== 'nexus' || !Object.prototype.hasOwnProperty.call(frame, 'payload')) {
      peer.send({ type: 'relay-error', error: 'invalid-frame' });
      return;
    }

    // Pairing traffic is deliberately narrow. This is not the trust boundary
    // (the Nexus pairing protocol still authenticates the resulting device),
    // but it prevents accidental use of pair rooms as generic broadcast rooms.
    if (PAIR_ROOM.test(context.room)) {
      const kind = frame?.payload?.kind;
      if (context.role === 'web' && kind !== 'pair-request') {
        peer.send({ type: 'relay-error', error: 'invalid-pair-frame' });
        return;
      }
      if (context.role === 'bridge' && kind !== 'pair-response') {
        peer.send({ type: 'relay-error', error: 'invalid-pair-frame' });
        return;
      }
    }

    // Device payloads are encrypted end-to-end by the Nexus protocol before
    // reaching Vercel. The relay only forwards the serialized envelope.
    peer.publish('nexus', text);
  },

  close(peer) {
    peer.unsubscribe('nexus');
  }
});
