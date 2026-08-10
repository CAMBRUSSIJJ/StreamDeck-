import test from 'node:test';
import assert from 'node:assert/strict';
import { backupChecksum, backupSummary, exportPortableState, importPortableState } from '../js/core/store.js';

const state = {
  activePageId:'main', activeDeviceId:'pc1', devices:[{id:'pc1',secret:'hidden'}],
  preferences:{accent:'cyan'},
  pages:[{id:'main',name:'Principal',icon:'home',profile:{enabled:true,apps:['obsidian.exe']},buttons:[{id:'m1',kind:'macro',action:{type:'macro',steps:[]}}]}]
};

test('portable backup v2 excludes device credentials and adds checksum', () => {
  const backup = exportPortableState(state);
  assert.equal(backup.format, 'nexus-deck-backup');
  assert.equal(backup.version, 2);
  assert.equal(backup.appVersion, '1.1.0');
  assert.equal('devices' in backup, false);
  assert.equal(JSON.stringify(backup).includes('hidden'), false);
  assert.equal(backup.checksum, backupChecksum(backup));
});

test('portable backup imports pages without replacing devices', () => {
  const backup = exportPortableState(state);
  backup.pages[0].name = 'Importada';
  backup.checksum = backupChecksum(backup);
  const next = importPortableState(state, backup);
  assert.equal(next.pages[0].name, 'Importada');
  assert.equal(next.devices[0].id, 'pc1');
});

test('portable backup rejects corruption', () => {
  const backup = exportPortableState(state);
  backup.pages[0].name = 'Corrompida';
  assert.throws(() => importPortableState(state, backup), /corrompido/i);
});

test('backup summary counts pages controls macros and profiles', () => {
  const summary = backupSummary(exportPortableState(state));
  assert.deepEqual(summary, { pages:1, controls:1, macros:1, profiles:1 });
});
