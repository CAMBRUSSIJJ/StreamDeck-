import test from 'node:test';
import assert from 'node:assert/strict';
import { createPing, localAAD } from '../public/js/core/local.js';

test('localAAD is device scoped', () => {
  assert.equal(localAAD('abc123'), 'nexus-local:abc123:v1');
  assert.throws(() => localAAD(''));
});

test('createPing creates fresh local protocol message', () => {
  const ping = createPing('ping-1');
  assert.equal(ping.type, 'ping');
  assert.equal(ping.id, 'ping-1');
  assert.equal(typeof ping.ts, 'number');
  assert.deepEqual(ping.body, {});
});
