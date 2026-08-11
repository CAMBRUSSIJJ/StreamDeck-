import test from 'node:test';
import assert from 'node:assert/strict';
import { columnsForViewport, normalizeMobilePreferences, orientationForViewport, pageIdByDelta, qualifiesAsSwipe } from '../js/core/mobile.js';

test('normaliza preferências mobile e limita colunas', () => {
  const value = normalizeMobilePreferences({ scale:'huge', portraitColumns:9, landscapeColumns:2, locked:1 });
  assert.equal(value.scale,'normal');
  assert.equal(value.portraitColumns,5);
  assert.equal(value.landscapeColumns,4);
  assert.equal(value.locked,true);
});

test('resolve orientação e colunas específicas', () => {
  const prefs = { portraitColumns:3, landscapeColumns:7 };
  assert.equal(orientationForViewport(768,1024),'portrait');
  assert.equal(orientationForViewport(1180,820),'landscape');
  assert.equal(columnsForViewport(prefs,768,1024),3);
  assert.equal(columnsForViewport(prefs,1180,820),7);
});

test('navegação por delta faz wrap entre páginas', () => {
  const pages = [{id:'a'},{id:'b'},{id:'c'}];
  assert.equal(pageIdByDelta(pages,'a',-1),'c');
  assert.equal(pageIdByDelta(pages,'c',1),'a');
  assert.equal(pageIdByDelta(pages,'b',1),'c');
});

test('gesto horizontal válido vira swipe e vertical não', () => {
  assert.equal(qualifiesAsSwipe({x:200,y:100,time:0},{x:100,y:110,time:300}),1);
  assert.equal(qualifiesAsSwipe({x:100,y:100,time:0},{x:190,y:108,time:300}),-1);
  assert.equal(qualifiesAsSwipe({x:100,y:100,time:0},{x:120,y:220,time:300}),0);
});
