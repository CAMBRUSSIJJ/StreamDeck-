import test from 'node:test';
import assert from 'node:assert/strict';
import { APP_ICON_OPTIONS, appIconSvg, inferAppIcon, resolvedAppIcon } from '../js/ui/app-icons.js';

test('biblioteca V1.1 expõe ícones profissionais principais', () => {
  const values = new Set(APP_ICON_OPTIONS.map(([value]) => value));
  for (const id of ['chrome','obsidian','spotify','discord','obs','vscode','notion','gmail','outlook','whatsapp','youtube','twitch']) {
    assert.ok(values.has(id), `ícone ausente: ${id}`);
    assert.match(appIconSvg(id), /^<svg/);
  }
});

test('detecção automática reconhece aplicativos por nome, URL e executável', () => {
  assert.equal(inferAppIcon({ id:'browser', label:'Navegador' }), 'chrome');
  assert.equal(inferAppIcon({ label:'Notas', action:{ type:'launch_app', path:'C:\\Apps\\Obsidian.exe' } }), 'obsidian');
  assert.equal(inferAppIcon({ label:'E-mail', action:{ type:'open_url', url:'https://mail.google.com' } }), 'gmail');
  assert.equal(inferAppIcon({ label:'Editor', action:{ type:'launch_app', path:'C:\\Users\\me\\Code.exe' } }), 'vscode');
});

test('seleção manual vence a detecção automática e none desativa', () => {
  assert.equal(inferAppIcon({ label:'Chrome', appIcon:'spotify' }), 'spotify');
  assert.equal(inferAppIcon({ label:'Chrome', appIcon:'none' }), null);
  assert.equal(resolvedAppIcon({ label:'Spotify' })?.name, 'Spotify');
});
