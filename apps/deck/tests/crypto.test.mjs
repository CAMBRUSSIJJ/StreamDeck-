import test from 'node:test';
import assert from 'node:assert/strict';
if (!globalThis.btoa) globalThis.btoa = s => Buffer.from(s, 'binary').toString('base64');
if (!globalThis.atob) globalThis.atob = s => Buffer.from(s, 'base64').toString('binary');

const cryptoModule = await import('../public/js/core/crypto.js');
const { createPairingIdentity, derivePairKey, encryptJson, decryptJson, bytesToBase64Url, randomBytes } = cryptoModule;

test('AES-GCM round trip preserves payload', async () => {
  const secret = bytesToBase64Url(randomBytes(32));
  const key = await cryptoModule.importDeviceKey(secret);
  const source = { type:'command', body:{ action:{ type:'media', key:'play_pause' } } };
  const envelope = await encryptJson(source, key, 'nexus:test:v1');
  const result = await decryptJson(envelope, key, 'nexus:test:v1');
  assert.deepEqual(result, source);
});

test('pairing derives the same key on both peers', async () => {
  const a = await createPairingIdentity();
  const b = await createPairingIdentity();
  const keyA = await derivePairKey(a.privateKey, b.publicKey, '123456', a.nonce, b.nonce);
  const keyB = await derivePairKey(b.privateKey, a.publicKey, '123456', a.nonce, b.nonce);
  const envelope = await encryptJson({ ok:true }, keyA, 'pair:123456:req');
  assert.deepEqual(await decryptJson(envelope, keyB, 'pair:123456:req'), { ok:true });
});

test('AAD mismatch fails authentication', async () => {
  const secret = bytesToBase64Url(randomBytes(32));
  const key = await cryptoModule.importDeviceKey(secret);
  const envelope = await encryptJson({ value:42 }, key, 'room:a');
  await assert.rejects(() => decryptJson(envelope, key, 'room:b'));
});
