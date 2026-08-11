import { defineHandler } from 'nitro';

export default defineHandler((event) => {
  const requestURL = new URL(event.req.url);
  const relayProtocol = requestURL.protocol === 'https:' ? 'wss:' : 'ws:';
  return {
    configured: true,
    mode: 'nexus-relay',
    relayUrl: `${relayProtocol}//${requestURL.host}/api/relay`,
    version: '1.8.0',
    protocolVersion: 1,
    uiSource: 'vercel'
  };
});
