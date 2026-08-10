import { createPairingIdentity, decryptJson, derivePairKey, encryptJson, randomId } from './crypto.js';

export function localAAD(deviceId) {
  if (!deviceId) throw new Error('ID do dispositivo local ausente');
  return `nexus-local:${deviceId}:v1`;
}

export function supportsSecureLocalCrypto() {
  return Boolean(globalThis.crypto?.subtle && globalThis.isSecureContext);
}

export async function getLocalInfo() {
  const response = await fetch('/api/local/info', { cache:'no-store' });
  const json = await response.json();
  if (!response.ok || !json.localMode) throw new Error(json.error || 'Companion local indisponível');
  return json;
}

export async function pairLocalDevice(code, client = {}) {
  if (!/^\d{6}$/.test(code)) throw new Error('Informe o código de 6 dígitos');
  if (!supportsSecureLocalCrypto()) {
    const response = await fetch('/api/local/pair-simple', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body:JSON.stringify({ code, clientName:client.name || 'iPad', clientPlatform:client.platform || 'iPadOS / Safari' })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Falha no pareamento local');
    if (!json.device?.id || !json.device?.secret || json.device.transport !== 'local') throw new Error('Dispositivo local inválido');
    return { ...json.device, localSecurity:'lan-token' };
  }

  const identity = await createPairingIdentity();
  const requestId = randomId(12);
  const request = {
    code,
    requestId,
    clientPublicKey:identity.publicKey,
    clientNonce:identity.nonce,
    clientName:client.name || 'iPad',
    clientPlatform:client.platform || 'iPadOS / Safari'
  };
  const response = await fetch('/api/local/pair', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify(request)
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Falha no pareamento local');
  if (json.kind !== 'local-pair-response' || json.requestId !== requestId) throw new Error('Resposta local inválida');
  const pairKey = await derivePairKey(identity.privateKey, json.serverPublicKey, code, identity.nonce, json.serverNonce);
  const device = await decryptJson(json.envelope, pairKey, `local-pair:${code}:${requestId}`);
  if (!device?.id || !device?.secret || device.transport !== 'local') throw new Error('Dispositivo local inválido');
  return { ...device, localSecurity:'aes-gcm' };
}

export async function sendLocalMessage(device, key, message) {
  if (!key || device.localSecurity === 'lan-token' || !supportsSecureLocalCrypto()) {
    const response = await fetch('/api/local/message-simple', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${device.secret}` },
      cache:'no-store',
      body:JSON.stringify({ deviceId:device.id, message })
    });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Falha na conexão local');
    if (!json.message) throw new Error('Resposta local inválida');
    return json.message;
  }

  const aad = localAAD(device.id);
  const envelope = await encryptJson(message, key, aad);
  const response = await fetch('/api/local/message', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    cache:'no-store',
    body:JSON.stringify({ deviceId:device.id, envelope })
  });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Falha na conexão local');
  if (!json.envelope) throw new Error('Resposta local sem envelope');
  return decryptJson(json.envelope, key, aad);
}

export function createPing(id = randomId(10)) {
  return { type:'ping', id, ts:Date.now(), body:{} };
}
