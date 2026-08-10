import test from 'node:test';
import assert from 'node:assert/strict';
import { duplicateControl, duplicatePage, moveItemById, reorderById, uniquePageName } from '../js/core/editor.js';

test('reorderById moves a control before the target', () => {
  const result = reorderById([{id:'a'},{id:'b'},{id:'c'}], 'c', 'a');
  assert.deepEqual(result.map(item => item.id), ['c','a','b']);
});

test('moveItemById moves one position safely', () => {
  assert.deepEqual(moveItemById([{id:'a'},{id:'b'}], 'b', -1).map(i => i.id), ['b','a']);
  assert.deepEqual(moveItemById([{id:'a'},{id:'b'}], 'a', -1).map(i => i.id), ['a','b']);
});

test('duplicateControl produces a new id and copied label', () => {
  const copy = duplicateControl({id:'a', label:'Chrome', action:{type:'open_url',url:'https://x.test'}}, 'copy');
  assert.equal(copy.id, 'copy');
  assert.equal(copy.label, 'Chrome cópia');
  assert.equal(copy.action.url, 'https://x.test');
});

test('uniquePageName avoids collisions', () => {
  assert.equal(uniquePageName([{name:'Nova página'}]), 'Nova página 2');
});

test('duplicatePage regenerates control ids', () => {
  let n = 0;
  const copy = duplicatePage({id:'p',name:'P',buttons:[{id:'b1'},{id:'b2'}]}, 'p2', 'P cópia', () => `n${++n}`);
  assert.equal(copy.id, 'p2');
  assert.deepEqual(copy.buttons.map(b => b.id), ['n1','n2']);
});
