import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('apps/deck');
const required = ['index.html','styles.css','manifest.webmanifest','sw.js','js/app.js','js/core/crypto.js','js/core/realtime.js','js/core/protocol.js','js/core/store.js'];
for (const file of required) await access(resolve(root, file));
const html = await readFile(resolve(root, 'index.html'), 'utf8');
if (!html.includes('manifest.webmanifest')) throw new Error('manifest ausente no HTML');
if (!html.includes('viewport-fit=cover')) throw new Error('safe-area do iPad ausente');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone') throw new Error('PWA precisa usar display standalone');
if (!manifest.icons?.some(i => i.sizes === '512x512')) throw new Error('ícone 512 ausente');
const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
if (!sw.includes('nexus-deck-v0.2.0')) throw new Error('cache do SW sem versão');
console.log('Web checks OK:', required.length, 'arquivos críticos validados.');
