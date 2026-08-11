import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('apps/deck');
const required = [
  'index.html','styles.css','manifest.webmanifest','sw.js','js/app.js','js/ui/icons.js',
  'js/core/editor.js','js/core/widgets.js','js/core/crypto.js','js/core/realtime.js',
  'js/core/local.js','js/core/protocol.js','js/core/store.js','js/core/layout.js','js/core/profiles.js','js/core/integrations.js','js/ui/app-icons.js'
];
for (const file of required) await access(resolve(root, file));
const html = await readFile(resolve(root, 'index.html'), 'utf8');
if (!html.includes('manifest.webmanifest')) throw new Error('manifest ausente no HTML');
if (!html.includes('viewport-fit=cover')) throw new Error('safe-area do iPad ausente');
if (!html.includes('value="macro"')) throw new Error('tipo Macro ausente do editor');
if (!html.includes('smart-profiles-toggle')) throw new Error('ajuste de perfis inteligentes ausente');
for (const id of ['onboarding-dialog','deck-diagnostic','deck-diagnostic-export','export-deck','import-deck','btn-app-icon','layout-dialog','layout-open','layout-preset-grid']) {
  if (!html.includes(`id="${id}"`)) throw new Error(`elemento V1.3 ausente: ${id}`);
}
const app = await readFile(resolve(root, 'js/app.js'), 'utf8');
if (!app.includes("ONBOARDING_KEY")) throw new Error('onboarding V1.3 não inicializado');
if (!app.includes('buildDeckDiagnostic')) throw new Error('diagnóstico rápido ausente');
if (!app.includes('APP_ICON_OPTIONS')) throw new Error('biblioteca de ícones de apps V1.3 não inicializada');
const store = await readFile(resolve(root, 'js/core/store.js'), 'utf8');
if (!store.includes("version: 2")) throw new Error('backup V2 ausente');
if (!store.includes('backupChecksum')) throw new Error('checksum do backup ausente');
const manifest = JSON.parse(await readFile(resolve(root, 'manifest.webmanifest'), 'utf8'));
if (manifest.display !== 'standalone') throw new Error('PWA precisa usar display standalone');
if (!manifest.icons?.some(i => i.sizes === '512x512')) throw new Error('ícone 512 ausente');
const sw = await readFile(resolve(root, 'sw.js'), 'utf8');
if (!sw.includes('nexus-deck-v1.3.0')) throw new Error('cache do SW sem versão');
const layout = await readFile(resolve(root, 'js/core/layout.js'), 'utf8');
if (!layout.includes('LAYOUT_PRESETS')) throw new Error('Layout Engine V1.2 ausente');
if (!layout.includes('Media Keys')) throw new Error('presets de control surface ausentes');
console.log('Web checks OK:', required.length, 'arquivos críticos validados.');
