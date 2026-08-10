const appIcons = {
  chrome: {
    name:'Google Chrome', color:'#4285F4',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#fff"/><path fill="#EA4335" d="M24 3a21 21 0 0 1 18.2 10.5H23.8a10.7 10.7 0 0 0-9.2 5.3L8.5 8.2A20.9 20.9 0 0 1 24 3Z"/><path fill="#FBBC05" d="M8.5 8.2 17.7 24a10.7 10.7 0 0 0 5.4 9.2L11 40.1A21 21 0 0 1 8.5 8.2Z"/><path fill="#34A853" d="M11 40.1 20.2 24h22A21 21 0 0 1 11 40.1Z"/><circle cx="24" cy="24" r="8.7" fill="#4285F4"/><circle cx="24" cy="24" r="5.8" fill="#5B9BFF"/></svg>`
  },
  edge: {
    name:'Microsoft Edge', color:'#0EA5E9',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#0EA5E9" d="M43 27.3c0-12.4-8.5-22-20.2-22C12.4 5.3 4.1 13 4.1 23.2c0 4.8 1.8 9.1 5.1 12.4 3.4 3.4 8.1 5.5 13.8 5.5 8.1 0 15.2-4.2 18.3-10.4-4 2.5-8.6 3.7-13.5 3.7-7.5 0-13.2-3-13.2-8.3 0-4.7 4.4-8.1 10.3-8.1 5.2 0 9.6 2.3 12.2 6-1.1-7.1-6.8-11.8-14-11.8-6.8 0-12.3 4.2-14.2 10.1 3.5-3.8 8.1-5.7 13.6-5.7 11.9 0 20.5 4.6 20.5 10.7Z"/><path fill="#10D6B4" d="M9.1 22.3c2.1-6 7.5-10.1 14.2-10.1 5.9 0 11 3.1 13.6 7.8-4-2.3-8.7-3.4-14.4-3.4-5.4 0-10 1.9-13.4 5.7Z"/></svg>`
  },
  obsidian: {
    name:'Obsidian', color:'#8B5CF6',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#7C3AED" d="M24.2 3.8 37 12.1l5 17.1L28.8 44 12.4 38.3 6 21.4 15 7.2l9.2-3.4Z"/><path fill="#A78BFA" d="m15 7.2 9.2-3.4-2.1 16.4-10.5 9.1L6 21.4 15 7.2Z"/><path fill="#5B21B6" d="m22.1 20.2 14.9-8.1 5 17.1-19.9-9Z"/><path fill="#C4B5FD" opacity=".7" d="m12.4 38.3-.8-9 10.5-9.1L28.8 44l-16.4-5.7Z"/></svg>`
  },
  spotify: {
    name:'Spotify', color:'#1ED760',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="#1ED760"/><path d="M13 18.4c8-2.2 18.7-1.6 26 2.3" fill="none" stroke="#07120B" stroke-width="4.2" stroke-linecap="round"/><path d="M14.7 25.3c6.9-1.7 15.7-1.1 21.9 2.1" fill="none" stroke="#07120B" stroke-width="3.5" stroke-linecap="round"/><path d="M16.4 31.6c5.5-1.2 12.3-.7 17.3 1.9" fill="none" stroke="#07120B" stroke-width="3" stroke-linecap="round"/></svg>`
  },
  discord: {
    name:'Discord', color:'#5865F2',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="7" width="40" height="34" rx="12" fill="#5865F2"/><path fill="#fff" d="M34.7 15.7a25 25 0 0 0-6.1-1.9l-.8 1.7a23.7 23.7 0 0 0-7.6 0l-.9-1.7a25 25 0 0 0-6.1 1.9C9.4 21.3 8.4 26.8 8.9 32.2a24.8 24.8 0 0 0 7.5 3.9l1.8-2.5a17 17 0 0 1-2.9-1.4l.7-.5c5.6 2.6 11.7 2.6 17.2 0l.8.5a18 18 0 0 1-2.9 1.4l1.8 2.5a24.8 24.8 0 0 0 7.5-3.9c.6-6.3-1.1-11.8-5.7-16.5ZM19 29.6c-1.6 0-2.9-1.5-2.9-3.3S17.4 23 19 23s2.9 1.5 2.9 3.3-1.3 3.3-2.9 3.3Zm10 0c-1.6 0-2.9-1.5-2.9-3.3S27.4 23 29 23s2.9 1.5 2.9 3.3-1.3 3.3-2.9 3.3Z"/></svg>`
  },
  obs: {
    name:'OBS Studio', color:'#6B7280',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#111318"/><circle cx="24" cy="24" r="20" fill="none" stroke="#343841" stroke-width="2"/><path fill="#F4F4F5" d="M25.1 9.3a11 11 0 0 1 8.2 17.2 10.2 10.2 0 0 0-8.6-4.4 8.6 8.6 0 0 1 .4-12.8ZM37.1 28a11 11 0 0 1-19 6.8 10.2 10.2 0 0 0 2.1-9.4 8.6 8.6 0 0 1 16.9 2.6ZM16.2 36.5A11 11 0 0 1 18.9 16a10.2 10.2 0 0 0 6.6 7 8.6 8.6 0 0 1-9.3 13.5Z"/></svg>`
  },
  vscode: {
    name:'Visual Studio Code', color:'#22A7F2',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#22A7F2" d="M35.8 5.4 18.1 22.1 8.7 14.9 4 18.6l9.5 9.3L4 37.4l4.7 3.7 9.5-7.3 17.6 16.7?"/><path fill="#0E90D2" d="M36 5.2 18.1 22.1l-9.4-7.2L4 18.6l9.5 9.3L4 37.4l4.7 3.7 9.4-7.2L36 42.8l8-3.8V9l-8-3.8Zm0 9v19.6L23.1 28 36 14.2Z"/></svg>`
  },
  notion: {
    name:'Notion', color:'#F5F5F5',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="6" y="5" width="36" height="38" rx="5" fill="#F8F8F8"/><rect x="8.5" y="7.5" width="31" height="33" rx="3" fill="#111"/><path fill="#fff" d="M15 14.5h7.4l10.2 15V18.6l-4-1.1v-3h10v3l-3.8 1.1v16.9h-5.9L18.8 20.6v10.8l4.7 1.1v3H13v-3l3.8-1.1V18.5L15 17.7v-3.2Z"/></svg>`
  },
  gmail: {
    name:'Gmail', color:'#EA4335',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#fff" d="M6 10h36v28H6z"/><path fill="#4285F4" d="M6 15.2 12 19v19H6V15.2Z"/><path fill="#34A853" d="M42 15.2 36 19v19h6V15.2Z"/><path fill="#FBBC05" d="m6 15.2 18 13.1 18-13.1v7L24 35.3 6 22.2v-7Z" opacity=".85"/><path fill="#EA4335" d="M6 12.8c0-2.9 3.3-4.6 5.7-2.9L24 18.8 36.3 9.9c2.4-1.7 5.7 0 5.7 2.9v4.1L24 30 6 16.9v-4.1Z"/></svg>`
  },
  outlook: {
    name:'Outlook', color:'#0A64C0',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="17" y="8" width="27" height="32" rx="3" fill="#0A64C0"/><path fill="#28A8EA" d="M17 13h27v22H17z"/><path fill="#fff" d="m17 15 13.5 10L44 15v-2H17v2Z" opacity=".92"/><rect x="4" y="12" width="25" height="28" rx="3" fill="#0A64C0"/><ellipse cx="16.5" cy="26" rx="7.2" ry="8.5" fill="#fff"/><ellipse cx="16.5" cy="26" rx="3.8" ry="5" fill="#0A64C0"/></svg>`
  },
  whatsapp: {
    name:'WhatsApp', color:'#25D366',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#25D366" d="M24 4a20 20 0 0 0-17 30.5L4.2 44l9.8-2.6A20 20 0 1 0 24 4Z"/><path fill="#fff" d="M33.7 27.9c-.5-.3-3-1.5-3.5-1.6-.5-.2-.9-.3-1.3.3-.4.6-1.4 1.6-1.8 2-.3.4-.6.4-1.2.1-3-1.5-5-2.7-7-6.1-.5-.9.5-.8 1.5-2.7.2-.4.1-.7-.1-1l-1.6-3.8c-.4-1-1-1-1.4-1h-1.1c-.4 0-1 .1-1.5.7-1.7 1.8-2.6 4.4-2.5 6.9 0 .5.4 3.5 3.6 6.9 3.5 3.8 7.9 6.5 12.8 7.4 1.5.3 3 .3 4.4-.4 1.3-.6 2.8-2.4 3.2-3.8.4-1.3.4-2.5.3-2.8-.2-.4-.7-.6-1.2-.9l-1.6-.2Z"/></svg>`
  },
  youtube: {
    name:'YouTube', color:'#FF0033',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="4" y="10" width="40" height="28" rx="9" fill="#FF0033"/><path fill="#fff" d="m20 17 13 7-13 7V17Z"/></svg>`
  },
  twitch: {
    name:'Twitch', color:'#9146FF',
    svg:`<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#9146FF" d="M8 5h35v25L33 40H23l-6 6v-6H8V5Z"/><path fill="#fff" d="M13 10v24h8v5l5-5h9l5-5V10H13Zm10 15h-4V15h4v10Zm10 0h-4V15h4v10Z"/></svg>`
  }
};

// Correct the VS Code icon at module load; keep SVG self-contained and valid.
appIcons.vscode.svg = `<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#23A8F2" d="m35.8 5.3-17.7 16.8-9.4-7.2L4 18.7l9.5 9.2L4 37.4l4.7 3.7 9.4-7.2 17.7 8.8L44 38.8V9.2l-8.2-3.9Z"/><path fill="#0E88C7" d="M35.8 14.2v19.6L23 27.9l12.8-13.7Z"/><path fill="#62C8FA" d="M18.1 22.1 35.8 5.3v8.9L23 27.9l-4.9-5.8Z"/></svg>`;

export const APP_ICON_OPTIONS = [
  ['auto','Automático'],['none','Sem ícone de app'],
  ...Object.entries(appIcons).map(([id, value]) => [id, value.name])
];

export function appIconSvg(id) { return appIcons[id]?.svg || ''; }
export function appIconMeta(id) { return appIcons[id] || null; }

function normalizeText(value) { return String(value || '').toLowerCase().replaceAll('\\','/'); }

export function inferAppIcon(control = {}) {
  if (control.appIcon && control.appIcon !== 'auto') return control.appIcon === 'none' ? null : (appIcons[control.appIcon] ? control.appIcon : null);
  const action = control.action || {};
  const haystack = [control.id, control.label, control.icon, action.url, action.path, action.service, action.command, ...(action.args || [])].map(normalizeText).join(' ');
  const rules = [
    ['obsidian', ['obsidian']],
    ['spotify', ['spotify']],
    ['discord', ['discord']],
    ['obs', ['obs studio','obs64','obs32','obs.exe','service obs','obs']],
    ['vscode', ['visual studio code','vscode','code.exe','code - insiders']],
    ['notion', ['notion']],
    ['gmail', ['gmail','mail.google.com']],
    ['outlook', ['outlook','office.com/mail','outlook.live.com']],
    ['whatsapp', ['whatsapp']],
    ['youtube', ['youtube','youtu.be']],
    ['twitch', ['twitch']],
    ['edge', ['msedge','microsoft edge','edge.exe']],
    ['chrome', ['chrome','google.com','browser','navegador']]
  ];
  for (const [id, needles] of rules) if (needles.some(needle => haystack.includes(needle))) return id;
  return null;
}

export function resolvedAppIcon(control = {}) {
  const id = inferAppIcon(control);
  return id ? { id, ...appIcons[id] } : null;
}
