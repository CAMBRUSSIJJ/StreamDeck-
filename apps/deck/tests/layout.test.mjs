import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPreset, LAYOUT_PRESETS, layoutFromPreset, normalizeLayout, normalizeSavedLayouts } from '../js/core/layout.js';

test('layout padrão é Minimal Pro', () => {
  const layout = normalizeLayout();
  assert.equal(layout.preset, 'minimal');
  assert.equal(layout.columns, 5);
  assert.equal(layout.theme, 'graphite');
});

test('normalização limita colunas e raio', () => {
  const layout = normalizeLayout({ preset:'compact', columns:99, radius:3 });
  assert.equal(layout.columns, 8);
  assert.equal(layout.radius, 8);
});

test('preset Focus aplica composição profissional', () => {
  const layout = applyPreset('focus');
  assert.equal(layout.columns, 3);
  assert.equal(layout.textAlign, 'center');
  assert.equal(layout.iconSize, 'large');
  assert.equal(layout.theme, 'oled');
});

test('todos os presets possuem identidade única', () => {
  const ids = Object.values(LAYOUT_PRESETS).map(item => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(layoutFromPreset('media').name, 'Media Console');
});

test('layouts salvos são normalizados e limitados', () => {
  const source = Array.from({length:20}, (_,i) => ({ id:`x${i}`, name:`Meu ${i}`, layout:{ preset:'dashboard', columns:7 } }));
  const saved = normalizeSavedLayouts(source);
  assert.equal(saved.length, 12);
  assert.equal(saved[0].layout.columns, 7);
  assert.equal(saved[0].layout.preset, 'dashboard');
});
