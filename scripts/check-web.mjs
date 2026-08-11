import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('apps/deck');
const required = [
  'index.html','styles.css','manifest.webmanifest','sw.js','js/app.js','js/ui/icons.js',
  'js/core/editor.js','js/core/widgets.js','js/core/crypto.js','js/core/realtime.js',
  'js/core/local.js','js/core/protocol.js','js/core/store.js','js/core/layout.js','js/core/mobile.js',
  'js/core/profiles.js','js/core/integrations.js','js/ui/app-icons.js'
];
for (const file of required) await access(resolve(root, file));
const html = await readFile(resolve(root, 'index.html'), 'utf8');
if (!html.includes('manifest.webmanifest')) throw new Error('manifest ausente no HTML');
if (!html.includes('viewport-fit=cover')) throw new Error('safe-area do iPad ausente');
if (!html.includes('apple-mobile-web-app-capable')) throw new Error('modo standalone do iPad ausente');
if (!html.includes('value="macro"')) throw new Error('tipo Macro ausente do editor');
if (!html.includes('smart-profiles-toggle')) throw new Error('ajuste de perfis inteligentes ausente');
for (const id of ['onboarding-dialog','deck-diagnostic','export-deck','import-deck','btn-app-icon','layout-dialog','layout-open','layout-preset-grid','mobile-immersive-toggle','mobile-lock-toggle','mobile-swipe-toggle','mobile-longpress-toggle','mobile-scale','mobile-portrait-columns','mobile-landscape-columns']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`elemento V1.4 ausente: ${id}`);
}
const app = await readFile(resolve(root, 'js/app.js'), 'utf8');
for (const symbol of ['ONBOARDING_KEY','buildDeckDiagnostic','APP_ICON_OPTIONS','bindMobileGestures','bindMobileLongPress','updateMobileEnvironment']) {
  if (!app.includes(symbol)) throw new Error(`fundação V1.4 ausente: ${symbol}`);
}
const mobile = await readFile(resolve(root, 'js/core/mobile.js'), 'utf8');
if (!mobile.includes('columnsForViewport') || !mobile.includes('qualifiesAsSwipe')) throw new Error('Mobile Engine V1.4 incompleto');
const store = await readFile(resolve(root, 'js/core/store.js'), 'utf8');
if (!store.includes("version: 2")) throw new Error('backup V2 ausente');
if (!store.includes('normalizeMobilePreferences')) throw new Error('preferências mobile não persistidas');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone') throw new Error('PWA precisa usar display standalone');
if (!manifest.icons?.some(i => i.sizes === '512x512')) throw new Error('ícone 512 ausente');
const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
if (!sw.includes('nexus-deck-v1.4.0')) throw new Error('cache do SW sem versão V1.4');
if (!sw.includes('/js/core/mobile.js')) throw new Error('Mobile Engine ausente do cache PWA');
const layout = await readFile(resolve(root, 'js/core/layout.js'), 'utf8');
if (!layout.includes('LAYOUT_PRESETS')) throw new Error('Layout Engine ausente');
console.log('Web checks OK:', required.length, 'arquivos críticos validados.');
