import { clampVolume, normalizeKind } from './widgets.js';
import { normalizeMacro } from './protocol.js';
import { normalizeProfile } from './profiles.js';

const KEY = 'nexus.deck.v0.2';

const defaults = {
  activePageId: 'main',
  activeDeviceId: null,
  devices: [],
  preferences: { accent: 'indigo', smartProfiles: true },
  pages: [
    {
      id: 'main', name: 'Principal', icon: 'home', buttons: [
        { id:'browser', kind:'button', label:'Navegador', icon:'◎', color:'#4f8cff', size:'square', action:{type:'open_url', url:'https://www.google.com'} },
        { id:'obsidian', kind:'button', label:'Obsidian', icon:'◈', color:'#8b6cff', size:'square', action:{type:'open_url', url:'obsidian://open'} },
        { id:'mail', kind:'button', label:'E-mail', icon:'✉', color:'#31b8ff', size:'square', action:{type:'open_url', url:'https://mail.google.com'} },
        { id:'play', kind:'button', label:'Play / Pause', icon:'▶', color:'#42d98b', size:'square', action:{type:'media', key:'play_pause'} },
        { id:'mute', kind:'toggle', label:'Silenciar', icon:'◌', color:'#ff6573', size:'square', state:false, action:{type:'media', key:'volume_mute'} },
        { id:'volume', kind:'volume', label:'Volume', icon:'🔊', color:'#ffb94b', size:'wide', value:50 },
        { id:'media-center', kind:'media_panel', label:'Mídia', icon:'▶', color:'#42d98b', size:'large' },
        { id:'pc-status', kind:'status', label:'PC Principal', icon:'●', color:'#31b8ff', size:'wide' }
      ]
    },
    { id:'work', name:'Trabalho', icon:'grid', buttons:[] },
    { id:'media', name:'Mídia', icon:'music', buttons:[
      { id:'media-page-center', kind:'media_panel', label:'Central de mídia', icon:'▶', color:'#42d98b', size:'large' },
      { id:'media-page-volume', kind:'volume', label:'Volume', icon:'🔊', color:'#ffb94b', size:'wide', value:50 },
      { id:'media-page-clock', kind:'clock', label:'Agora', icon:'◷', color:'#8b6cff', size:'wide' }
    ] }
  ]
};

const allowedSizes = new Set(['square','wide','tall','large']);
const allowedAccents = new Set(['indigo','cyan','emerald','rose']);
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function normalizeControl(button) {
  const inferredKind = !button.kind && button.id === 'mute' ? 'toggle' : button.kind;
  const kind = normalizeKind(inferredKind);
  const defaultSizes = { volume:'wide', media_panel:'large', status:'wide', clock:'wide' };
  const normalized = {
    ...button,
    kind,
    size: allowedSizes.has(button.size) ? button.size : (defaultSizes[kind] || (button.id === 'volup' ? 'wide' : 'square'))
  };
  if (kind === 'volume') normalized.value = clampVolume(button.value ?? 50);
  if (kind === 'toggle') normalized.state = Boolean(button.state);
  if (kind === 'macro') {
    try { normalized.action = normalizeMacro(button.action); }
    catch { normalized.action = { type:'macro', stopOnError:true, steps:[{ id:'step-1', when:'always', delayMs:0, action:{type:'open_url', url:'https://'} }] }; }
  }
  return normalized;
}

function normalizePage(page) {
  const oldPageIcons = { '⌂':'home', '▦':'grid', '♪':'music' };
  const icon = oldPageIcons[page.icon] || page.icon || (page.id === 'main' ? 'home' : page.id === 'media' ? 'music' : 'grid');
  return {
    ...page,
    icon,
    profile: normalizeProfile(page.profile),
    buttons: Array.isArray(page.buttons) ? page.buttons.map(normalizeControl) : []
  };
}

function migrateStarterWidgets(state) {
  const main = state.pages.find(page => page.id === 'main');
  if (!main) return state;
  const ids = new Set(main.buttons.map(button => button.id));
  const legacyStarter = ['browser','obsidian','mail','play','mute','volup','voldown','next'].filter(id => ids.has(id)).length >= 6;
  const alreadyHasWidgets = main.buttons.some(button => ['volume','media_panel','status','clock'].includes(button.kind));
  if (!legacyStarter || alreadyHasWidgets) return state;
  main.buttons = main.buttons.filter(button => !['volup','voldown'].includes(button.id));
  main.buttons.push(
    normalizeControl({ id:'volume-v05', kind:'volume', label:'Volume', icon:'🔊', color:'#ffb94b', size:'wide', value:50 }),
    normalizeControl({ id:'media-center-v05', kind:'media_panel', label:'Mídia', icon:'▶', color:'#42d98b', size:'large' }),
    normalizeControl({ id:'pc-status-v05', kind:'status', label:'PC Principal', icon:'●', color:'#31b8ff', size:'wide' })
  );
  return state;
}

export function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (!parsed || !Array.isArray(parsed.pages) || !Array.isArray(parsed.devices)) return clone(defaults);
    const merged = { ...clone(defaults), ...parsed };
    merged.preferences = { ...clone(defaults.preferences), ...(parsed.preferences || {}) };
    if (!allowedAccents.has(merged.preferences.accent)) merged.preferences.accent = 'indigo';
    merged.pages = parsed.pages.map(normalizePage);
    return migrateStarterWidgets(merged);
  } catch { return clone(defaults); }
}

export function saveState(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
export function resetState() { localStorage.removeItem(KEY); return clone(defaults); }


export function backupChecksum(payload) {
  const copy = clone(payload);
  delete copy.checksum;
  const text = JSON.stringify(copy);
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function backupSummary(payload) {
  const pages = Array.isArray(payload?.pages) ? payload.pages : [];
  const controls = pages.reduce((total, page) => total + (Array.isArray(page.buttons) ? page.buttons.length : 0), 0);
  const macros = pages.reduce((total, page) => total + (Array.isArray(page.buttons) ? page.buttons.filter(button => button.kind === 'macro' || button.action?.type === 'macro').length : 0), 0);
  const profiles = pages.filter(page => page.profile?.enabled).length;
  return { pages:pages.length, controls, macros, profiles };
}

export function exportPortableState(state) {
  const payload = {
    format: 'nexus-deck-backup',
    version: 2,
    appVersion: '1.0.0',
    exportedAt: new Date().toISOString(),
    activePageId: state.activePageId,
    preferences: clone(state.preferences || defaults.preferences),
    pages: clone(state.pages || [])
  };
  return { ...payload, checksum:backupChecksum(payload) };
}

export function importPortableState(currentState, payload) {
  if (!payload || payload.format !== 'nexus-deck-backup' || !Array.isArray(payload.pages) || payload.pages.length < 1) {
    throw new Error('Backup do Nexus inválido');
  }
  if (Number(payload.version || 1) >= 2) {
    if (!payload.checksum || backupChecksum(payload) !== payload.checksum) throw new Error('Backup corrompido ou incompleto');
  }
  const pages = payload.pages.map(normalizePage);
  const activePageId = pages.some(page => page.id === payload.activePageId) ? payload.activePageId : pages[0].id;
  const accent = allowedAccents.has(payload.preferences?.accent) ? payload.preferences.accent : (currentState.preferences?.accent || 'indigo');
  return {
    ...currentState,
    activePageId,
    preferences: { ...(currentState.preferences || {}), accent, smartProfiles: payload.preferences?.smartProfiles !== false },
    pages
  };
}
