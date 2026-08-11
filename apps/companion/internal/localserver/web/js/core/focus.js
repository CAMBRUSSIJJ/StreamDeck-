export const FOCUS_SERVICES = {
  spotify: { id:'spotify', name:'Spotify', color:'#1ed760', ready:true },
  obs: { id:'obs', name:'OBS Studio', color:'#ffffff', ready:false },
  windows: { id:'windows', name:'Windows', color:'#60a5fa', ready:false }
};

const finite = value => Number.isFinite(Number(value)) ? Number(value) : null;
const text = value => typeof value === 'string' ? value : '';

export function focusServices({ readyOnly = true } = {}) {
  return Object.values(FOCUS_SERVICES).filter(item => !readyOnly || item.ready);
}

export function normalizeFocusAction(action = {}) {
  const service = FOCUS_SERVICES[action?.service]?.ready ? action.service : 'spotify';
  return { type:'focus', service };
}

export function focusActionLabel(action = {}) {
  const normalized = normalizeFocusAction(action);
  return `Abrir ${FOCUS_SERVICES[normalized.service].name} Focus`;
}

export function formatMediaTime(ms) {
  const value = Math.max(0, Math.round((finite(ms) || 0) / 1000));
  const minutes = Math.floor(value / 60);
  const seconds = String(value % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function progressPercent(progressMs, durationMs) {
  const progress = Math.max(0, finite(progressMs) || 0);
  const duration = Math.max(0, finite(durationMs) || 0);
  if (!duration) return 0;
  return Math.max(0, Math.min(100, (progress / duration) * 100));
}

function normalizeTrack(track = {}) {
  return {
    name: text(track.name),
    artist: text(track.artist),
    album: text(track.album),
    artworkUrl: text(track.artworkUrl),
    spotifyUrl: text(track.spotifyUrl),
    uri: text(track.uri),
    durationMs: finite(track.durationMs),
    explicit: Boolean(track.explicit)
  };
}

function normalizeDevice(device = {}) {
  return {
    id: text(device.id),
    name: text(device.name),
    type: text(device.type),
    active: Boolean(device.active),
    restricted: Boolean(device.restricted),
    volumePercent: finite(device.volumePercent)
  };
}

export function normalizeSpotifyFocus(snapshot = {}, fallback = {}) {
  const track = normalizeTrack(snapshot.track || {
    name:fallback.track,
    artist:fallback.artist,
    durationMs:fallback.durationMs,
    artworkUrl:fallback.artworkUrl,
    spotifyUrl:fallback.spotifyUrl,
    album:fallback.album,
    uri:fallback.uri
  });
  const devices = Array.isArray(snapshot.devices) ? snapshot.devices.map(normalizeDevice) : [];
  const queue = Array.isArray(snapshot.queue) ? snapshot.queue.slice(0, 12).map(normalizeTrack) : [];
  const activeDevice = normalizeDevice(snapshot.device || devices.find(item => item.active) || {
    name:fallback.device,
    volumePercent:fallback.volumePercent,
    active:true
  });
  return {
    available: Boolean(snapshot.available ?? fallback.available),
    playing: Boolean(snapshot.playing ?? fallback.playing),
    progressMs: finite(snapshot.progressMs ?? fallback.progressMs),
    shuffle: Boolean(snapshot.shuffle),
    repeat: ['off','track','context'].includes(snapshot.repeat) ? snapshot.repeat : 'off',
    contextType: text(snapshot.contextType),
    track,
    device: activeDevice,
    devices,
    queue,
    fetchedAt: finite(snapshot.fetchedAt) || Date.now()
  };
}

export function nextRepeatMode(mode) {
  if (mode === 'off') return 'context';
  if (mode === 'context') return 'track';
  return 'off';
}
