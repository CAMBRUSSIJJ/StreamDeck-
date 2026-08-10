import test from 'node:test';
import assert from 'node:assert/strict';
import { createCommand, macroDurationHint, normalizeMacro, validateAction } from '../js/core/protocol.js';

const sample = {
  type:'macro',
  stopOnError:true,
  steps:[
    { id:'a', when:'always', delayMs:0, action:{type:'open_url', url:'https://example.com'} },
    { id:'b', when:'previous_success', delayMs:500, action:{type:'media', key:'play_pause'} }
  ]
};

test('macro válida é aceita pelo protocolo', () => {
  assert.equal(validateAction(sample), true);
  assert.equal(createCommand(sample, 'macro-1').body.action.steps.length, 2);
});

test('macro calcula dica de duração pelos atrasos', () => {
  assert.equal(macroDurationHint(sample), 500);
});

test('macro aninhada é rejeitada', () => {
  assert.throws(() => validateAction({ type:'macro', steps:[{ action:sample, delayMs:0, when:'always' }] }));
});

test('macro limita atraso total e quantidade de etapas', () => {
  const tooLong = { type:'macro', steps:Array.from({length:7}, (_, i) => ({ id:String(i), when:'always', delayMs:10_000, action:{type:'media', key:'next'} })) };
  assert.throws(() => validateAction(tooLong));
  const tooMany = { type:'macro', steps:Array.from({length:21}, (_, i) => ({ id:String(i), when:'always', delayMs:0, action:{type:'media', key:'next'} })) };
  assert.throws(() => validateAction(tooMany));
});

test('normalização aplica defaults seguros', () => {
  const normalized = normalizeMacro({ type:'macro', steps:[{ action:{type:'media', key:'next'}, delayMs:25_000, when:'x' }] });
  assert.equal(normalized.steps[0].delayMs, 10_000);
  assert.equal(normalized.steps[0].when, 'always');
});
