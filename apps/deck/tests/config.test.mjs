import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const configSource = await readFile(new URL('../server/api/config.ts', import.meta.url), 'utf8');
const relaySource = await readFile(new URL('../server/api/relay.ts', import.meta.url), 'utf8');

test('V1.8 config endpoint exposes same-origin Nexus Relay metadata', () => {
  assert.match(configSource, /mode:\s*'nexus-relay'/);
  assert.match(configSource, /\/api\/relay/);
  assert.match(configSource, /protocolVersion:\s*1/);
  assert.match(configSource, /uiSource:\s*'vercel'/);
  assert.doesNotMatch(configSource, /SUPABASE_/i);
});

test('relay accepts only Nexus pair/device room shapes and forwards nexus frames', () => {
  assert.match(relaySource, /nexus-pair-\\d\{6\}/);
  assert.match(relaySource, /nexus-device-/);
  assert.match(relaySource, /defineWebSocketHandler/);
  assert.match(relaySource, /peer\.publish\('nexus'/);
  assert.match(relaySource, /MAX_MESSAGE_BYTES/);
});
