const KEY = 'nexus.deck.v0.2';

const defaults = {
  activePageId: 'main',
  activeDeviceId: null,
  devices: [],
  pages: [
    {
      id: 'main', name: 'Principal', icon: '⌂', buttons: [
        { id:'browser', label:'Navegador', icon:'◎', color:'#5b8cff', action:{type:'open_url', url:'https://www.google.com'} },
        { id:'obsidian', label:'Obsidian', icon:'◈', color:'#8b5cf6', action:{type:'open_url', url:'obsidian://open'} },
        { id:'mail', label:'E-mail', icon:'✉', color:'#2b8cff', action:{type:'open_url', url:'https://mail.google.com'} },
        { id:'play', label:'Play / Pause', icon:'▶', color:'#35d07f', action:{type:'media', key:'play_pause'} },
        { id:'mute', label:'Silenciar', icon:'◌', color:'#ff6b6b', action:{type:'media', key:'volume_mute'} },
        { id:'volup', label:'Volume +', icon:'＋', color:'#f6a83b', action:{type:'media', key:'volume_up'} },
        { id:'voldown', label:'Volume −', icon:'−', color:'#f6a83b', action:{type:'media', key:'volume_down'} },
        { id:'next', label:'Próxima faixa', icon:'⏭', color:'#35d07f', action:{type:'media', key:'next'} }
      ]
    },
    { id:'work', name:'Trabalho', icon:'▦', buttons:[] },
    { id:'media', name:'Mídia', icon:'♪', buttons:[] }
  ]
};

function clone(value) { return JSON.parse(JSON.stringify(value)); }

export function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY));
    if (!parsed || !Array.isArray(parsed.pages) || !Array.isArray(parsed.devices)) return clone(defaults);
    return { ...clone(defaults), ...parsed };
  } catch { return clone(defaults); }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(KEY);
  return clone(defaults);
}
