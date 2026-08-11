import { validateIntegrationAction } from './integrations.js';
export const PROTOCOL_VERSION = 1;
export const APP_VERSION = '1.4.0';

export const actionLabels = {
  open_url: 'Abrir URL',
  launch_app: 'Abrir aplicativo',
  hotkey: 'Atalho',
  media: 'Mídia',
  system: 'Sistema',
  integration: 'Integração',
  macro: 'Macro'
};

const mediaKeys = new Set(['play_pause', 'next', 'previous', 'volume_up', 'volume_down', 'volume_mute']);
const systemKeys = new Set(['lock']);
const macroConditions = new Set(['always', 'previous_success', 'previous_failed']);

function validatePrimitiveAction(action) {
  if (!action || typeof action !== 'object') throw new Error('Ação inválida');
  switch (action.type) {
    case 'open_url': {
      const url = new URL(action.url);
      if (!['http:', 'https:', 'mailto:', 'obsidian:'].includes(url.protocol)) throw new Error('Protocolo de URL não permitido');
      return true;
    }
    case 'launch_app':
      if (typeof action.path !== 'string' || !action.path.trim()) throw new Error('Caminho do aplicativo ausente');
      if (action.args && (!Array.isArray(action.args) || action.args.some(v => typeof v !== 'string'))) throw new Error('Argumentos inválidos');
      return true;
    case 'hotkey':
      if (!Array.isArray(action.keys) || action.keys.length < 1 || action.keys.length > 5) throw new Error('Atalho inválido');
      if (action.keys.some(k => !/^[A-Z0-9_+\-]{1,16}$/.test(k))) throw new Error('Tecla inválida');
      return true;
    case 'media':
      if (!mediaKeys.has(action.key)) throw new Error('Comando de mídia inválido');
      return true;
    case 'system':
      if (!systemKeys.has(action.key)) throw new Error('Comando de sistema inválido');
      return true;
    case 'integration':
      return validateIntegrationAction(action);
    default:
      throw new Error('Tipo de ação não suportado');
  }
}

export function normalizeMacro(action) {
  if (!action || action.type !== 'macro') throw new Error('Macro inválida');
  const steps = Array.isArray(action.steps) ? action.steps : [];
  return {
    type:'macro',
    stopOnError: action.stopOnError !== false,
    steps: steps.map((step, index) => ({
      id: typeof step.id === 'string' && step.id ? step.id : `step-${index + 1}`,
      when: macroConditions.has(step.when) ? step.when : 'always',
      delayMs: Number.isFinite(Number(step.delayMs)) ? Math.max(0, Math.min(10_000, Math.round(Number(step.delayMs)))) : 0,
      action: step.action
    }))
  };
}

export function validateAction(action) {
  if (!action || typeof action !== 'object') throw new Error('Ação inválida');
  if (action.type !== 'macro') return validatePrimitiveAction(action);
  const macro = normalizeMacro(action);
  if (macro.steps.length < 1 || macro.steps.length > 20) throw new Error('A macro deve ter entre 1 e 20 etapas');
  let totalDelay = 0;
  for (const step of macro.steps) {
    if (!macroConditions.has(step.when)) throw new Error('Condição de macro inválida');
    if (step.delayMs < 0 || step.delayMs > 10_000) throw new Error('Atraso de macro inválido');
    totalDelay += step.delayMs;
    if (totalDelay > 60_000) throw new Error('A macro ultrapassa 60 segundos de atraso');
    if (!step.action || step.action.type === 'macro') throw new Error('Macros aninhadas não são permitidas');
    validatePrimitiveAction(step.action);
  }
  return true;
}

export function macroDurationHint(action) {
  if (!action || action.type !== 'macro' || !Array.isArray(action.steps)) return 0;
  return action.steps.reduce((sum, step) => sum + Math.max(0, Number(step.delayMs) || 0), 0);
}

export function createCommand(action, id) {
  validateAction(action);
  return { type:'command', id, ts:Date.now(), body:{ action } };
}
