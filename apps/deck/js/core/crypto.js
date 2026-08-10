const te = new TextEncoder();
const td = new TextDecoder();

export function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function base64UrlToBytes(value) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

export function randomBytes(length) {
  return crypto.getRandomValues(new Uint8Array(length));
}

export function randomId(bytes = 16) {
  return bytesToBase64Url(randomBytes(bytes));
}

export async function createPairingIdentity() {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey));
  return {
    privateKey: keyPair.privateKey,
    publicKey: bytesToBase64Url(publicRaw),
    nonce: bytesToBase64Url(randomBytes(16))
  };
}

function concat(...arrays) {
  const total = arrays.reduce((sum, a) => sum + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { out.set(a, offset); offset += a.length; }
  return out;
}

export async function derivePairKey(privateKey, peerPublicB64, pairCode, clientNonceB64, serverNonceB64) {
  const peerPublicKey = await crypto.subtle.importKey(
    'raw',
    base64UrlToBytes(peerPublicB64),
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: peerPublicKey }, privateKey, 256));
  const saltMaterial = concat(te.encode(pairCode), base64UrlToBytes(clientNonceB64), base64UrlToBytes(serverNonceB64));
  const salt = new Uint8Array(await crypto.subtle.digest('SHA-256', saltMaterial));
  const hkdfKey = await crypto.subtle.importKey('raw', shared, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt, info: te.encode('nexus-deck-pair-v1') },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function importDeviceKey(secretB64) {
  return crypto.subtle.importKey('raw', base64UrlToBytes(secretB64), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptJson(value, key, aad) {
  const iv = randomBytes(12);
  const plain = te.encode(JSON.stringify(value));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: te.encode(aad), tagLength: 128 }, key, plain
  ));
  return { v: 1, iv: bytesToBase64Url(iv), ciphertext: bytesToBase64Url(ciphertext) };
}

export async function decryptJson(envelope, key, aad) {
  if (!envelope || envelope.v !== 1 || !envelope.iv || !envelope.ciphertext) throw new Error('Envelope inválido');
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64UrlToBytes(envelope.iv), additionalData: te.encode(aad), tagLength: 128 },
    key,
    base64UrlToBytes(envelope.ciphertext)
  );
  return JSON.parse(td.decode(plain));
}
