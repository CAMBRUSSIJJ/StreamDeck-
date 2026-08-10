import test from 'node:test';
import assert from 'node:assert/strict';
import { integrationActionLabel, integrationServices, normalizeIntegrationAction, validateIntegrationAction } from '../js/core/integrations.js';

test('catálogo inclui quatro integrações profissionais', () => {
  const ids = integrationServices().map(item => item.id);
  assert.deepEqual(ids.sort(), ['browser','discord','obs','spotify']);
});

test('ação OBS com cena valida', () => {
  const action = {type:'integration',service:'obs',command:'set_scene',params:{sceneName:'Principal'}};
  assert.equal(validateIntegrationAction(action), true);
  assert.match(integrationActionLabel(action), /OBS Studio/);
});

test('Spotify rejeita volume inválido', () => {
  assert.throws(() => validateIntegrationAction({type:'integration',service:'spotify',command:'set_volume',params:{volumePercent:150}}));
});

test('normalização escolhe integração segura conhecida', () => {
  const action = normalizeIntegrationAction({type:'integration',service:'nao-existe',command:'x'});
  assert.equal(action.service, 'obs');
});
