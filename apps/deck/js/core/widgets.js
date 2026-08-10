export const CONTROL_KINDS = new Set(['button','toggle','volume','media_panel','status','clock']);

export const CONTROL_KIND_LABELS = {
  button: 'Botão',
  toggle: 'Toggle',
  volume: 'Volume',
  media_panel: 'Mídia',
  status: 'Status do PC',
  clock: 'Relógio'
};

const presets = {
  button: { label:'Novo controle', icon:'⌘', color:'#6478ff', size:'square', action:{type:'open_url', url:'https://'} },
  toggle: { label:'Alternar', icon:'◉', color:'#42d98b', size:'square', state:false, action:{type:'media', key:'volume_mute'} },
  volume: { label:'Volume', icon:'🔊', color:'#ffb94b', size:'wide', value:50 },
  media_panel: { label:'Mídia', icon:'▶', color:'#42d98b', size:'large' },
  status: { label:'PC Principal', icon:'●', color:'#31b8ff', size:'wide' },
  clock: { label:'Agora', icon:'◷', color:'#8b6cff', size:'wide' }
};

export function normalizeKind(kind) {
  return CONTROL_KINDS.has(kind) ? kind : 'button';
}

export function defaultControlForKind(kind, id = '') {
  const normalized = normalizeKind(kind);
  return { id, kind:normalized, ...structuredClone(presets[normalized]) };
}

export function applyKindPreset(control, kind) {
  const current = control || {};
  const preset = defaultControlForKind(kind, current.id || '');
  return { ...current, ...preset, id:current.id || preset.id };
}

export function clampVolume(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(100, Math.max(0, Math.round(number)));
}

export function volumeKeySteps(fromValue, toValue, step = 5) {
  const from = clampVolume(fromValue);
  const to = clampVolume(toValue);
  const delta = to - from;
  if (!delta) return { key:null, count:0 };
  return {
    key: delta > 0 ? 'volume_up' : 'volume_down',
    count: Math.min(20, Math.max(1, Math.round(Math.abs(delta) / Math.max(1, step))))
  };
}

export function toggleState(value) {
  return !Boolean(value);
}
