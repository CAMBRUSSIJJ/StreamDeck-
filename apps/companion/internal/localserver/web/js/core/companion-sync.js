const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const bool = value => value === true;

export function normalizeIntegrationStatus(input = {}) {
  const status = input || {};
  return {
    id: String(status.id || ''),
    name: String(status.name || status.id || 'Integração'),
    configured: Boolean(status.configured),
    connected: Boolean(status.connected),
    detail: String(status.detail || ''),
    error: String(status.error || ''),
    state: status.state && typeof status.state === 'object' ? status.state : {}
  };
}

export function normalizeCompanionStatus(input = {}, meta = {}) {
  const seenAt = num(meta.seenAt) ?? Date.now();
  const latencyMs = num(meta.latencyMs);
  const online = input?.online !== false;
  const rawAudio = input?.audio && typeof input.audio === 'object' ? input.audio : {};
  const audioAvailable = rawAudio.available === true;
  const volumePercent = audioAvailable ? Math.max(0, Math.min(100, Math.round(num(rawAudio.volumePercent) ?? 0))) : null;
  const integrations = {};
  for (const [id, status] of Object.entries(input?.integrations || {})) integrations[id] = normalizeIntegrationStatus({ ...status, id:status?.id || id });
  const spotify = integrations.spotify?.state || {};
  return {
    online,
    hostname: String(input?.hostname || ''),
    platform: String(input?.platform || ''),
    version: String(input?.version || ''),
    transport: String(meta.transport || input?.transport || 'local'),
    latencyMs,
    seenAt,
    serverTime: String(input?.serverTime || ''),
    syncSequence: num(input?.syncSequence),
    activeApp: input?.activeApp && typeof input.activeApp === 'object' ? input.activeApp : null,
    audio: {
      available: audioAvailable,
      volumePercent,
      muted: audioAvailable ? bool(rawAudio.muted) : false
    },
    integrations,
    spotify: {
      available: Boolean(integrations.spotify?.connected),
      playing: bool(spotify.playing),
      track: String(spotify.track || ''),
      artist: String(spotify.artist || ''),
      album: String(spotify.album || ''),
      artworkUrl: String(spotify.artworkUrl || ''),
      spotifyUrl: String(spotify.spotifyUrl || ''),
      uri: String(spotify.uri || ''),
      device: String(spotify.device || ''),
      progressMs: num(spotify.progressMs),
      durationMs: num(spotify.durationMs),
      volumePercent: num(spotify.volumePercent),
      shuffle: bool(spotify.shuffle),
      repeat: String(spotify.repeat || 'off')
    }
  };
}

export function companionIsFresh(status, now = Date.now(), maxAgeMs = 12000) {
  return Boolean(status?.online && Number.isFinite(status?.seenAt) && now - status.seenAt <= maxAgeMs);
}

export function connectionQuality(status, now = Date.now()) {
  if (!companionIsFresh(status, now)) return { id:'offline', label:'Offline' };
  const latency = num(status?.latencyMs);
  if (latency == null) return { id:'online', label:'Online' };
  if (latency <= 25) return { id:'excellent', label:'Excelente' };
  if (latency <= 80) return { id:'good', label:'Boa' };
  if (latency <= 180) return { id:'fair', label:'Instável' };
  return { id:'poor', label:'Lenta' };
}

export function integrationRollup(status) {
  const entries = Object.values(status?.integrations || {});
  return {
    total: entries.length,
    connected: entries.filter(item => item.connected).length,
    configured: entries.filter(item => item.configured).length,
    errors: entries.filter(item => item.error).length
  };
}

export function mediaSummary(status) {
  if (status?.spotify?.available && (status.spotify.track || status.spotify.artist)) {
    return {
      source:'Spotify',
      title: status.spotify.track || 'Spotify',
      subtitle: status.spotify.artist || (status.spotify.playing ? 'Reproduzindo' : 'Pausado'),
      playing: Boolean(status.spotify.playing),
      progressMs: status.spotify.progressMs
    };
  }
  return { source:'Windows', title:'Mídia do Windows', subtitle:'Controles rápidos', playing:false, progressMs:null };
}
