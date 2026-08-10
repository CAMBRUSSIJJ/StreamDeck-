export const INTEGRATION_CATALOG = {
  obs: {
    name:'OBS Studio', kind:'API direta', color:'#f2f4f8',
    commands:{
      toggle_stream:{ label:'Iniciar / parar transmissão' },
      toggle_record:{ label:'Iniciar / parar gravação' },
      toggle_virtual_camera:{ label:'Alternar câmera virtual' },
      save_replay:{ label:'Salvar Replay Buffer' },
      set_scene:{ label:'Trocar cena', params:[{key:'sceneName',label:'Nome da cena',type:'text',placeholder:'Cena Principal'}] },
      toggle_input_mute:{ label:'Alternar mute de fonte', params:[{key:'inputName',label:'Nome da fonte',type:'text',placeholder:'Mic/Aux'}] },
      toggle_studio_mode:{ label:'Alternar Studio Mode' }
    }
  },
  spotify: {
    name:'Spotify', kind:'Web API', color:'#1ed760',
    commands:{
      play:{label:'Reproduzir'}, pause:{label:'Pausar'}, next:{label:'Próxima faixa'}, previous:{label:'Faixa anterior'},
      set_volume:{label:'Definir volume',params:[{key:'volumePercent',label:'Volume (%)',type:'number',min:0,max:100,step:5,placeholder:'50'}]},
      seek:{label:'Ir para posição',params:[{key:'positionMs',label:'Posição (ms)',type:'number',min:0,max:86400000,step:1000,placeholder:'30000'}]},
      shuffle_on:{label:'Ativar aleatório'}, shuffle_off:{label:'Desativar aleatório'},
      repeat_track:{label:'Repetir faixa'}, repeat_context:{label:'Repetir contexto'}, repeat_off:{label:'Desativar repetição'}
    }
  },
  discord: {
    name:'Discord Desktop', kind:'Atalho seguro', color:'#5865f2',
    commands:{ toggle_mute:{label:'Alternar microfone'}, toggle_deafen:{label:'Alternar áudio'}, open:{label:'Abrir Discord'} }
  },
  browser: {
    name:'Navegador', kind:'Desktop', color:'#31b8ff',
    commands:{
      new_tab:{label:'Nova aba'}, close_tab:{label:'Fechar aba'}, reopen_tab:{label:'Reabrir aba'}, next_tab:{label:'Próxima aba'}, previous_tab:{label:'Aba anterior'},
      reload:{label:'Recarregar'}, focus_address:{label:'Focar barra de endereço'}, fullscreen:{label:'Tela cheia'}, incognito:{label:'Nova janela anônima'}
    }
  }
};

export function integrationServices() { return Object.entries(INTEGRATION_CATALOG).map(([id,value]) => ({id,...value})); }
export function integrationDescriptor(service) { return INTEGRATION_CATALOG[service] || null; }
export function integrationCommand(service, command) { return INTEGRATION_CATALOG[service]?.commands?.[command] || null; }

export function normalizeIntegrationAction(action = {}) {
  const service = INTEGRATION_CATALOG[action.service] ? action.service : 'obs';
  const descriptor = INTEGRATION_CATALOG[service];
  const command = descriptor.commands[action.command] ? action.command : Object.keys(descriptor.commands)[0];
  const schema = descriptor.commands[command]?.params || [];
  const params = {};
  for (const field of schema) {
    const value = action.params?.[field.key];
    if (field.type === 'number') {
      const numeric = Number(value);
      params[field.key] = Number.isFinite(numeric) ? numeric : Number(field.placeholder || 0);
    } else params[field.key] = typeof value === 'string' ? value : '';
  }
  return { type:'integration', service, command, params };
}

export function validateIntegrationAction(action) {
  if (!action || action.type !== 'integration') throw new Error('Integração inválida');
  const service = integrationDescriptor(action.service);
  if (!service) throw new Error('Integração não suportada');
  const command = integrationCommand(action.service, action.command);
  if (!command) throw new Error('Comando da integração não suportado');
  for (const field of command.params || []) {
    const value = action.params?.[field.key];
    if (field.type === 'number') {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new Error(`${field.label} inválido`);
      if (field.min != null && n < field.min) throw new Error(`${field.label} abaixo do mínimo`);
      if (field.max != null && n > field.max) throw new Error(`${field.label} acima do máximo`);
    } else if (typeof value !== 'string' || !value.trim()) throw new Error(`Informe ${field.label.toLocaleLowerCase('pt-BR')}`);
  }
  return true;
}

export function integrationActionLabel(action) {
  const service = integrationDescriptor(action?.service);
  const command = integrationCommand(action?.service, action?.command);
  if (!service || !command) return 'Integração';
  return `${service.name} · ${command.label}`;
}

export function integrationStateSummary(statuses = {}) {
  return Object.entries(INTEGRATION_CATALOG).map(([id,descriptor]) => {
    const status = statuses?.[id] || {};
    return { id, name:descriptor.name, connected:Boolean(status.connected), configured:Boolean(status.configured), detail:status.error || status.detail || '' };
  });
}
