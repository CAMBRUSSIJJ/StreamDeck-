const icons = {
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3c2.2 2.5 3.4 5.5 3.4 9S14.2 18.5 12 21c-2.2-2.5-3.4-5.5-3.4-9S9.8 5.5 12 3Z"/></svg>',
  diamond: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="m12 3 7.5 6.2L12 21 4.5 9.2 12 3Z"/><path d="m4.5 9.2 7.5 3.2 7.5-3.2M12 12.4V21"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4V8Z"/></svg>',
  mute: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="m16 9 5 5m0-5-5 5"/></svg>',
  volumeUp: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/></svg>',
  volumeDown: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15 9a4 4 0 0 1 0 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="m5 6 8 6-8 6V6Z"/><path d="m13 6 8 6-8 6V6ZM21 6v12"/></svg>',
  previous: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="m19 6-8 6 8 6V6Z"/><path d="m11 6-8 6 8 6V6ZM3 6v12"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.8-1.8l.9-2-2.1-2.1-2 .9a7 7 0 0 0-1.8-.8L10.5 2h-3L6.8 4a7 7 0 0 0-1.8.8l-2-.9L.9 6l.9 2A7 7 0 0 0 1 9.8l-2 .7v3l2 .7A7 7 0 0 0 1.8 16l-.9 2L3 20.1l2-.9a7 7 0 0 0 1.8.8l.7 2h3l.7-2a7 7 0 0 0 1.8-.8l2 .9 2.1-2.1-.9-2a7 7 0 0 0 .8-1.8l2-.7Z" transform="translate(1.5 0) scale(.87)"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.9"><path d="M12 5v14M5 12h14"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.9"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></svg>',
  sparkles: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7"><path d="M12 3c.7 3.1 2.4 4.8 5.5 5.5C14.4 9.2 12.7 11 12 14c-.7-3-2.4-4.8-5.5-5.5C9.6 7.8 11.3 6.1 12 3Z"/><path d="M19 14c.4 1.8 1.4 2.8 3 3.2-1.6.4-2.6 1.4-3 3.1-.4-1.7-1.4-2.7-3-3.1 1.6-.4 2.6-1.4 3-3.2Z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="4" y="4" width="6" height="6" rx="1.4"/><rect x="14" y="4" width="6" height="6" rx="1.4"/><rect x="4" y="14" width="6" height="6" rx="1.4"/><rect x="14" y="14" width="6" height="6" rx="1.4"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>',
  chevronUp: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="m6 15 6-6 6 6"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" fill="none" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none"><circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/></svg>'
};

export function iconSvg(name) { return icons[name] || ''; }

export function semanticIcon(button) {
  if (button.id === 'browser') return 'globe';
  if (button.id === 'obsidian') return 'diamond';
  if (button.id === 'mail') return 'mail';
  const action = button.action || {};
  if (action.type === 'media') {
    if (action.key === 'play_pause') return 'play';
    if (action.key === 'volume_mute') return 'mute';
    if (action.key === 'volume_up') return 'volumeUp';
    if (action.key === 'volume_down') return 'volumeDown';
    if (action.key === 'next') return 'next';
    if (action.key === 'previous') return 'previous';
  }
  if (action.type === 'open_url') return 'globe';
  return null;
}

export function hydrateStaticIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach(node => {
    const svg = iconSvg(node.dataset.icon);
    if (svg) node.innerHTML = svg;
  });
}
