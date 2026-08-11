export const LAYOUT_PRESETS = Object.freeze({
  minimal: Object.freeze({
    id:'minimal', name:'Key Grid', description:'Grade principal de teclas, direta e próxima de uma control surface.',
    density:'comfortable', columns:6, iconSize:'large', textAlign:'center', cardStyle:'solid', radius:12, dock:'minimal', header:'compact', theme:'graphite'
  }),
  control: Object.freeze({
    id:'control', name:'Control Keys', description:'Teclas e widgets com leitura rápida para controles do sistema.',
    density:'comfortable', columns:5, iconSize:'medium', textAlign:'center', cardStyle:'solid', radius:12, dock:'minimal', header:'compact', theme:'oled'
  }),
  compact: Object.freeze({
    id:'compact', name:'Dense Keys', description:'Grade densa para reunir o maior número de ações por página.',
    density:'compact', columns:8, iconSize:'small', textAlign:'center', cardStyle:'solid', radius:10, dock:'minimal', header:'compact', theme:'graphite'
  }),
  focus: Object.freeze({
    id:'focus', name:'Focus Keys', description:'Teclas maiores para rotinas, macros e ações críticas.',
    density:'spacious', columns:4, iconSize:'large', textAlign:'center', cardStyle:'solid', radius:14, dock:'minimal', header:'compact', theme:'oled'
  }),
  dashboard: Object.freeze({
    id:'dashboard', name:'Info Deck', description:'Grade de teclas com status, volume e informações do computador.',
    density:'comfortable', columns:6, iconSize:'medium', textAlign:'center', cardStyle:'solid', radius:12, dock:'compact', header:'compact', theme:'slate'
  }),
  media: Object.freeze({
    id:'media', name:'Media Keys', description:'Superfície de mídia para Spotify, OBS, Discord e áudio.',
    density:'comfortable', columns:5, iconSize:'large', textAlign:'center', cardStyle:'solid', radius:12, dock:'minimal', header:'compact', theme:'oled'
  })
});

export const LAYOUT_OPTIONS = Object.freeze({
  densities:['compact','comfortable','spacious'],
  iconSizes:['small','medium','large'],
  textAlignments:['left','center'],
  cardStyles:['solid','elevated','outline','flat'],
  docks:['hidden','minimal','compact','full'],
  headers:['hidden','compact','full'],
  themes:['graphite','midnight','slate','ivory','oled']
});

const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || min));
const oneOf = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

export function layoutFromPreset(id = 'minimal') {
  const source = LAYOUT_PRESETS[id] || LAYOUT_PRESETS.minimal;
  return { ...source };
}

export function normalizeLayout(layout = null) {
  const presetId = LAYOUT_PRESETS[layout?.preset]?.id || LAYOUT_PRESETS[layout?.id]?.id || 'minimal';
  const base = layoutFromPreset(presetId);
  return {
    preset:presetId,
    density:oneOf(layout?.density, LAYOUT_OPTIONS.densities, base.density),
    columns:clamp(layout?.columns ?? base.columns, 3, 8),
    iconSize:oneOf(layout?.iconSize, LAYOUT_OPTIONS.iconSizes, base.iconSize),
    textAlign:oneOf(layout?.textAlign, LAYOUT_OPTIONS.textAlignments, base.textAlign),
    cardStyle:oneOf(layout?.cardStyle, LAYOUT_OPTIONS.cardStyles, base.cardStyle),
    radius:clamp(layout?.radius ?? base.radius, 8, 28),
    dock:oneOf(layout?.dock, LAYOUT_OPTIONS.docks, base.dock),
    header:oneOf(layout?.header, LAYOUT_OPTIONS.headers, base.header),
    theme:oneOf(layout?.theme, LAYOUT_OPTIONS.themes, base.theme)
  };
}

export function applyPreset(id, current = null) {
  const preset = layoutFromPreset(id);
  if (!current) return normalizeLayout({ preset:id, ...preset });
  return normalizeLayout({ ...current, ...preset, preset:id });
}

export function layoutSummary(layout) {
  const normalized = normalizeLayout(layout);
  const preset = LAYOUT_PRESETS[normalized.preset];
  const densityLabel = { compact:'compacto', comfortable:'equilibrado', spacious:'espaçoso' }[normalized.density] || normalized.density;
  return `${preset.name} · ${normalized.columns} colunas · ${densityLabel}`;
}

export function normalizeSavedLayouts(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 12).map((item, index) => ({
    id:String(item?.id || `saved-${index + 1}`).slice(0, 32),
    name:String(item?.name || `Layout ${index + 1}`).trim().slice(0, 32) || `Layout ${index + 1}`,
    layout:normalizeLayout(item?.layout)
  }));
}
