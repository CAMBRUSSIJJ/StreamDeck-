export const PROTOCOL_VERSION = 1;
export const APP_VERSION = '0.5.0';

export const actionLabels = {
  open_url: 'Abrir URL',
  launch_app: 'Abrir aplicativo',
  hotkey: 'Atalho',
  media: 'Mídia'
};

const mediaKeys = new Set(['play_pause', 'next', 'previous', 'volume_up', 'volume_down', 'volume_mute']);

export function validateAction(action) {
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
    default:
      throw new Error('Tipo de ação não suportado');
  }
}

export function createCommand(action, id) {
  validateAction(action);
  return { type: 'command', id, ts: Date.now(), body: { action } };
}
