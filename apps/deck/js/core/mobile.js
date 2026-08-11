export const MOBILE_DEFAULTS = Object.freeze({
  immersive:true,
  locked:false,
  swipePages:true,
  longPressEdit:true,
  scale:'normal',
  portraitColumns:4,
  landscapeColumns:6
});

const scales = new Set(['compact','normal','large']);
const clamp = (value,min,max) => Math.max(min,Math.min(max,Number(value)||min));

export function normalizeMobilePreferences(input = null) {
  const source = input || {};
  return {
    immersive: source.immersive !== false,
    locked: Boolean(source.locked),
    swipePages: source.swipePages !== false,
    longPressEdit: source.longPressEdit !== false,
    scale: scales.has(source.scale) ? source.scale : MOBILE_DEFAULTS.scale,
    portraitColumns: clamp(source.portraitColumns ?? MOBILE_DEFAULTS.portraitColumns, 2, 5),
    landscapeColumns: clamp(source.landscapeColumns ?? MOBILE_DEFAULTS.landscapeColumns, 4, 8)
  };
}

export function orientationForViewport(width, height) {
  return Number(width) > Number(height) ? 'landscape' : 'portrait';
}

export function columnsForViewport(preferences, width, height) {
  const mobile = normalizeMobilePreferences(preferences);
  return orientationForViewport(width,height) === 'landscape' ? mobile.landscapeColumns : mobile.portraitColumns;
}

export function pageIdByDelta(pages, activePageId, delta) {
  if (!Array.isArray(pages) || !pages.length) return null;
  const index = Math.max(0,pages.findIndex(page => page.id === activePageId));
  const normalized = ((index + Number(delta || 0)) % pages.length + pages.length) % pages.length;
  return pages[normalized]?.id || pages[0]?.id || null;
}

export function qualifiesAsSwipe(start, end, { minDistance = 64, axisRatio = 1.25, maxDuration = 800 } = {}) {
  if (!start || !end) return 0;
  const dx = Number(end.x) - Number(start.x);
  const dy = Number(end.y) - Number(start.y);
  const duration = Math.max(0, Number(end.time) - Number(start.time));
  if (duration > maxDuration || Math.abs(dx) < minDistance || Math.abs(dx) < Math.abs(dy) * axisRatio) return 0;
  return dx < 0 ? 1 : -1;
}
