import test from 'node:test';
import assert from 'node:assert/strict';
import { clampVolume, defaultControlForKind, normalizeKind, toggleState, volumeKeySteps } from '../js/core/widgets.js';

test('normaliza tipos desconhecidos como botão', () => {
  assert.equal(normalizeKind('clock'), 'clock');
  assert.equal(normalizeKind('x'), 'button');
});

test('presets de widgets trazem tamanhos adequados', () => {
  assert.equal(defaultControlForKind('volume').size, 'wide');
  assert.equal(defaultControlForKind('media_panel').size, 'large');
  assert.equal(defaultControlForKind('toggle').state, false);
});

test('volume é limitado entre 0 e 100', () => {
  assert.equal(clampVolume(-20), 0);
  assert.equal(clampVolume(44.6), 45);
  assert.equal(clampVolume(140), 100);
});

test('delta de volume vira passos de mídia', () => {
  assert.deepEqual(volumeKeySteps(50, 70), { key:'volume_up', count:4 });
  assert.deepEqual(volumeKeySteps(50, 35), { key:'volume_down', count:3 });
  assert.deepEqual(volumeKeySteps(50, 50), { key:null, count:0 });
});

test('toggle alterna estado booleano', () => {
  assert.equal(toggleState(false), true);
  assert.equal(toggleState(true), false);
});
