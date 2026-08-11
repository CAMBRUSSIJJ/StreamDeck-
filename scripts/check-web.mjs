import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve('apps/deck');
const pub = resolve(root, 'public');
const required = [
  'index.html','package.json','vite.config.ts','vercel.json','server/api/config.ts','server/api/relay.ts',
  'public/styles.css','public/manifest.webmanifest','public/sw.js','public/js/app.js','public/js/ui/icons.js',
  'public/js/core/editor.js','public/js/core/widgets.js','public/js/core/crypto.js','public/js/core/realtime.js',
  'public/js/core/local.js','public/js/core/protocol.js','public/js/core/store.js','public/js/core/layout.js','public/js/core/mobile.js',
  'public/js/core/profiles.js','public/js/core/integrations.js','public/js/core/companion-sync.js','public/js/core/focus.js','public/js/ui/app-icons.js'
];
for (const file of required) await access(resolve(root, file));

const html = await readFile(resolve(root, 'index.html'), 'utf8');
if (!html.includes('manifest.webmanifest')) throw new Error('manifest ausente no HTML');
if (!html.includes('viewport-fit=cover')) throw new Error('safe-area do iPad ausente');
if (!html.includes('apple-mobile-web-app-capable')) throw new Error('modo standalone do iPad ausente');
if (!html.includes('value="macro"')) throw new Error('tipo Macro ausente do editor');
if (!html.includes('smart-profiles-toggle')) throw new Error('ajuste de perfis inteligentes ausente');
for (const id of ['onboarding-dialog','deck-diagnostic','export-deck','import-deck','btn-app-icon','layout-dialog','layout-open','layout-preset-grid','mobile-immersive-toggle','mobile-lock-toggle','mobile-swipe-toggle','mobile-longpress-toggle','mobile-scale','mobile-portrait-columns','mobile-landscape-columns','fullscreen-toggle','companion-sync-badge','companion-audio-status','spotify-now-playing','app-focus-dialog','spotify-focus-track','spotify-focus-progress','spotify-focus-queue','spotify-focus-device']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`elemento crítico ausente: ${id}`);
}

const app = await readFile(resolve(pub, 'js/app.js'), 'utf8');
for (const symbol of ['ONBOARDING_KEY','buildDeckDiagnostic','APP_ICON_OPTIONS','bindMobileGestures','bindMobileLongPress','updateMobileEnvironment','toggleFullscreen','renderCompanionCenter','openAppFocus','requestSpotifyFocusSnapshot','runSpotifyFocusCommand']) {
  if (!app.includes(symbol)) throw new Error(`fundação da interface ausente: ${symbol}`);
}
if (!app.includes("Vercel · Online")) throw new Error('status Vercel/Nexus Relay ausente');

const mobile = await readFile(resolve(pub, 'js/core/mobile.js'), 'utf8');
if (!mobile.includes('columnsForViewport') || !mobile.includes('qualifiesAsSwipe')) throw new Error('Mobile Engine incompleto');
const store = await readFile(resolve(pub, 'js/core/store.js'), 'utf8');
if (!store.includes('version: 2')) throw new Error('backup V2 ausente');
if (!store.includes('normalizeMobilePreferences')) throw new Error('preferências mobile não persistidas');
const manifest = JSON.parse(await readFile(resolve(pub, 'manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone') throw new Error('PWA precisa usar display standalone');
if (!manifest.icons?.some(i => i.sizes === '512x512')) throw new Error('ícone 512 ausente');
const sw = await readFile(resolve(pub, 'sw.js'), 'utf8');
if (!sw.includes('nexus-deck-v1.8.0')) throw new Error('cache do SW sem versão V1.8');
for (const asset of ['/js/core/mobile.js','/js/core/companion-sync.js','/js/core/focus.js','/js/core/realtime.js']) {
  if (!sw.includes(asset)) throw new Error(`asset ausente do cache PWA: ${asset}`);
}
const realtime = await readFile(resolve(pub, 'js/core/realtime.js'), 'utf8');
if (!realtime.includes('relayWebsocketUrl') || !realtime.includes('if (!this.config?.relayUrl)')) throw new Error('Nexus Relay client ausente');
const relay = await readFile(resolve(root, 'server/api/relay.ts'), 'utf8');
if (!relay.includes('defineWebSocketHandler') || !relay.includes("peer.publish('nexus'")) throw new Error('Nexus Relay server ausente');
const config = await readFile(resolve(root, 'server/api/config.ts'), 'utf8');
if (!config.includes("uiSource: 'vercel'") || !config.includes('/api/relay')) throw new Error('config Vercel Live UI incompleta');
const deckPackage = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (!String(deckPackage.dependencies?.nitro || '').startsWith('3.')) throw new Error('Nitro V3 ausente');
if (!String(deckPackage.dependencies?.vite || '').startsWith('^8')) throw new Error('Vite 8 ausente');
if (existsSync(resolve('apps/companion/internal/localserver/web'))) throw new Error('UI duplicada ainda está embutida no Windows Bridge');

console.log('Web checks OK:', required.length, 'arquivos críticos validados · Vercel Live UI + Nexus Relay.');
