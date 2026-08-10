function cleanAppName(value) {
  return String(value || '').trim().toLocaleLowerCase('en-US').replaceAll('\\', '/').split('/').pop();
}

export function normalizeProfile(profile) {
  const apps = Array.isArray(profile?.apps)
    ? profile.apps.map(cleanAppName).filter(Boolean)
    : String(profile?.apps || '').split(',').map(cleanAppName).filter(Boolean);
  return {
    enabled: Boolean(profile?.enabled),
    apps: [...new Set(apps)].slice(0, 12)
  };
}

export function normalizeActiveApp(activeApp) {
  if (!activeApp || typeof activeApp !== 'object') return null;
  const processName = cleanAppName(activeApp.processName || activeApp.exe || activeApp.processPath);
  if (!processName) return null;
  return {
    processName,
    processPath: String(activeApp.processPath || ''),
    windowTitle: String(activeApp.windowTitle || ''),
    pid: Number.isFinite(Number(activeApp.pid)) ? Number(activeApp.pid) : 0
  };
}

export function pageMatchesApp(page, activeApp) {
  const app = normalizeActiveApp(activeApp);
  if (!app) return false;
  const profile = normalizeProfile(page?.profile);
  if (!profile.enabled) return false;
  return profile.apps.includes(app.processName);
}

export function findMatchingPage(pages, activeApp) {
  return (pages || []).find(page => pageMatchesApp(page, activeApp)) || null;
}

export function profileAppsText(page) {
  return normalizeProfile(page?.profile).apps.join(', ');
}

export function profileLabel(page) {
  const profile = normalizeProfile(page?.profile);
  if (!profile.enabled) return 'Manual';
  return profile.apps.length ? profile.apps.join(' · ') : 'Sem aplicativos';
}
