const $ = selector => document.querySelector(selector);
let timer = null;
let lastDiagnostics = null;
let latestRelease = null;
let diagnosticsLoaded = false;

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(path, { headers:{ 'Content-Type':'application/json' }, ...options });
  const json = await response.json();
  if (!response.ok) throw new Error(json.error || 'Falha');
  return json;
}

function pairCountdown(expiresAt) {
  clearInterval(timer);
  const box = $('#pair-box');
  box.classList.remove('hidden');
  const tick = () => {
    const sec = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    $('#pair-time').textContent = `Expira em ${String(Math.floor(sec / 60)).padStart(2,'0')}:${String(sec % 60).padStart(2,'0')}`;
    if (!sec) { clearInterval(timer); box.classList.add('hidden'); }
  };
  tick();
  timer = setInterval(tick, 1000);
}

function renderDevices(selector, devices, removePath, emptyText) {
  const rows = (devices || []).map(device => {
    const row = document.createElement('div');
    row.className = 'device';
    row.innerHTML = '<div><strong></strong><small></small></div><button class="ghost">Remover</button>';
    row.querySelector('strong').textContent = device.name || 'iPad';
    row.querySelector('small').textContent = device.platform || 'Dispositivo';
    row.querySelector('button').onclick = async () => {
      try {
        await api(removePath, { method:'POST', body:JSON.stringify({ id:device.id }) });
        toast('Dispositivo removido');
        load();
      } catch (error) { toast(error.message); }
    };
    return row;
  });
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'device empty-device';
    empty.textContent = emptyText;
    rows.push(empty);
  }
  $(selector).replaceChildren(...rows);
}

function integrationStatus(status, id) {
  return status?.integrations?.status?.[id] || null;
}

function renderIntegrationState(id, info) {
  const state = $('#' + id + '-state');
  const detail = $('#' + id + '-detail');
  if (!state) return;
  const connected = Boolean(info?.connected);
  const configured = Boolean(info?.configured);
  state.classList.toggle('online', connected);
  state.classList.toggle('offline', configured && !connected);
  state.textContent = connected ? '● Conectado' : configured ? '○ Indisponível' : 'Não configurado';
  if (detail && (info?.error || info?.detail)) detail.textContent = info.error || info.detail;
}

function renderIntegrations(status) {
  const settings = status.integrations?.settings || {};
  $('#obs-url').value = settings.obs?.url || 'ws://127.0.0.1:4455';
  $('#spotify-client-id').value = settings.spotify?.clientId || '';
  $('#discord-mute-hotkey').value = settings.discord?.muteHotkey || '';
  $('#discord-deafen-hotkey').value = settings.discord?.deafenHotkey || '';
  const ids = ['obs','spotify','discord','browser'];
  let connected = 0;
  ids.forEach(id => { const info = integrationStatus(status,id); renderIntegrationState(id,info); if (info?.connected) connected += 1; });
  $('#integration-summary').textContent = `${connected}/${ids.length} disponíveis`;
  const spotify = integrationStatus(status,'spotify');
  if (spotify?.state?.track) $('#spotify-detail').textContent = `${spotify.state.track}${spotify.state.artist ? ' · ' + spotify.state.artist : ''}`;
  const obs = integrationStatus(status,'obs');
  if (obs?.connected && obs.state?.sceneName) $('#obs-detail').textContent = `Cena ativa: ${obs.state.sceneName}${obs.state.streaming ? ' · AO VIVO' : ''}${obs.state.recording ? ' · GRAVANDO' : ''}`;
}


function renderSetup(status) {
  const paired = (status.localDevices || []).length > 0;
  const startupOn = Boolean(status.startupEnabled);
  $('#setup-companion').textContent = `Ativo · v${status.version}`;
  $('#setup-url').textContent = status.localUrl || 'Endereço local indisponível';
  $('#setup-pair').textContent = paired ? `${status.localDevices.length} iPad(s) autorizado(s)` : 'Nenhum iPad autorizado';
  $('#setup-startup').textContent = startupOn ? 'Inicia automaticamente com o Windows' : 'Inicialização automática desativada';
  const completed = 2 + Number(paired) + Number(startupOn);
  $('#setup-progress').textContent = `${completed}/4 concluídos`;
  $('#startup-toggle').checked = startupOn;
  $('#installed-version').textContent = `v${status.version}`;
}

function renderDiagnostics(data) {
  lastDiagnostics = data;
  const list = $('#diagnostics-list');
  list.replaceChildren(...(data.checks || []).map(check => {
    const row = document.createElement('div'); row.className = `diagnostic-row ${check.status}`;
    const dot = document.createElement('span'); dot.className = 'diagnostic-dot';
    const label = document.createElement('strong'); label.className = 'diagnostic-label'; label.textContent = check.label;
    const detail = document.createElement('span'); detail.className = 'diagnostic-detail'; detail.textContent = check.detail;
    row.append(dot,label,detail); return row;
  }));
  const summary = data.summary || {ok:0,warn:0,error:0};
  const el = $('#diagnostics-summary');
  el.classList.remove('good','warning','bad');
  if (summary.error) { el.classList.add('bad'); el.textContent = `${summary.error} erro(s), ${summary.warn} aviso(s) e ${summary.ok} teste(s) OK.`; }
  else if (summary.warn) { el.classList.add('warning'); el.textContent = `${summary.ok} teste(s) OK e ${summary.warn} aviso(s). O Nexus pode funcionar, mas há itens para revisar.`; }
  else { el.classList.add('good'); el.textContent = `${summary.ok} teste(s) aprovados. Fundação local saudável.`; }
}

async function runDiagnostics(showToast = true) {
  try {
    $('#diagnostics-summary').textContent = 'Executando testes…';
    const data = await api('/api/diagnostics');
    renderDiagnostics(data);
    diagnosticsLoaded = true;
    if (showToast) toast('Diagnóstico concluído');
    return data;
  } catch (error) {
    $('#diagnostics-summary').className = 'diagnostics-summary bad';
    $('#diagnostics-summary').textContent = error.message;
    if (showToast) toast(error.message);
    return null;
  }
}

function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function load() {
  try {
    const status = await api('/api/status');
    $('#state-pill').textContent = 'Nexus Local ativo';
    $('#state-pill').classList.add('online');
    $('#supabase-url').value = status.supabaseUrl || '';
    $('#version').textContent = 'v' + status.version;
    $('#config-path').textContent = status.configPath || '';
    $('#local-url').textContent = status.localUrl || 'Indisponível';
    const pair = status.localPair || {};
    if (pair.active) {
      $('#pair-code').textContent = pair.code;
      pairCountdown(pair.expiresAt);
    } else $('#pair-box').classList.add('hidden');
    renderDevices('#local-devices', status.localDevices, '/api/local/device/remove', 'Nenhum iPad local autorizado ainda.');
    renderDevices('#devices', status.devices, '/api/device/remove', status.configured ? 'Nenhum dispositivo Cloud pareado.' : 'Cloud Relay não configurado.');
    renderIntegrations(status);
    renderSetup(status);
    if (!diagnosticsLoaded) runDiagnostics(false);
  } catch (error) { toast(error.message); }
}

$('#settings-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await api('/api/settings', { method:'POST', body:JSON.stringify({ supabaseUrl:$('#supabase-url').value.trim(), supabaseAnonKey:$('#supabase-key').value.trim() }) });
    $('#supabase-key').value = '';
    toast('Cloud Relay salvo');
    load();
  } catch (error) { toast(error.message); }
});

$('#pair-start').addEventListener('click', async () => {
  try {
    const pair = await api('/api/local/pair/start', { method:'POST', body:'{}' });
    $('#pair-code').textContent = pair.code;
    pairCountdown(pair.expiresAt);
    toast('Código local criado');
  } catch (error) { toast(error.message); }
});

$('#copy-url').addEventListener('click', async () => {
  const value = $('#local-url').textContent.trim();
  try {
    await navigator.clipboard.writeText(value);
    toast('Endereço copiado');
  } catch {
    toast('Selecione e copie o endereço manualmente');
  }
});

$('#obs-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await api('/api/integrations/obs/settings', { method:'POST', body:JSON.stringify({ url:$('#obs-url').value.trim(), password:$('#obs-password').value, keepPassword:!$('#obs-password').value }) });
    $('#obs-password').value = '';
    toast('Configuração do OBS salva');
    load();
  } catch (error) { toast(error.message); }
});

$('#obs-test').addEventListener('click', async () => {
  try { await api('/api/integrations/obs/test', { method:'POST', body:'{}' }); toast('OBS conectado'); load(); }
  catch (error) { toast(error.message); }
});

$('#spotify-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await api('/api/integrations/spotify/settings', { method:'POST', body:JSON.stringify({ clientId:$('#spotify-client-id').value.trim() }) });
    toast('Client ID do Spotify salvo'); load();
  } catch (error) { toast(error.message); }
});

$('#spotify-connect').addEventListener('click', async () => {
  try {
    const response = await api('/api/integrations/spotify/connect', { method:'POST', body:'{}' });
    window.open(response.authUrl, '_blank', 'noopener');
    toast('Conclua a autorização na janela do Spotify');
  } catch (error) { toast(error.message); }
});

$('#spotify-disconnect').addEventListener('click', async () => {
  try { await api('/api/integrations/spotify/disconnect', { method:'POST', body:'{}' }); toast('Spotify desconectado'); load(); }
  catch (error) { toast(error.message); }
});

$('#discord-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    await api('/api/integrations/discord/settings', { method:'POST', body:JSON.stringify({ muteHotkey:$('#discord-mute-hotkey').value.trim(), deafenHotkey:$('#discord-deafen-hotkey').value.trim() }) });
    toast('Atalhos do Discord salvos'); load();
  } catch (error) { toast(error.message); }
});


$('#startup-toggle').addEventListener('change', async event => {
  const input = event.currentTarget;
  input.disabled = true;
  try {
    const result = await api('/api/startup', { method:'POST', body:JSON.stringify({ enabled:input.checked }) });
    input.checked = Boolean(result.enabled);
    toast(input.checked ? 'Nexus iniciará com o Windows' : 'Inicialização automática desativada');
    await load();
    await runDiagnostics(false);
  } catch (error) { input.checked = !input.checked; toast(error.message); }
  finally { input.disabled = false; }
});

$('#diagnostics-run').addEventListener('click', () => runDiagnostics(true));
$('#diagnostics-export').addEventListener('click', async () => {
  const data = lastDiagnostics || await runDiagnostics(false);
  if (!data) return;
  downloadJSON(`nexus-diagnostico-${new Date().toISOString().slice(0,10)}.json`, data);
  toast('Relatório exportado');
});

$('#update-check').addEventListener('click', async () => {
  const button = $('#update-check'); button.disabled = true;
  $('#update-detail').textContent = 'Consultando a release mais recente…';
  try {
    latestRelease = await api('/api/update/check');
    const badge = $('#update-state'); badge.classList.remove('muted-badge');
    if (latestRelease.updateAvailable) {
      badge.textContent = 'Atualização disponível';
      $('#update-detail').innerHTML = `Instalada: <strong>v${latestRelease.currentVersion}</strong> · Disponível: <strong>v${latestRelease.latestVersion}</strong>`;
      $('#update-open').classList.remove('hidden');
    } else {
      badge.textContent = 'Atualizado';
      $('#update-detail').innerHTML = `Você está usando a versão mais recente: <strong>v${latestRelease.currentVersion}</strong>.`;
      $('#update-open').classList.toggle('hidden', !latestRelease.releaseUrl);
    }
  } catch (error) {
    $('#update-state').textContent = 'Não verificado';
    $('#update-detail').textContent = error.message;
    toast(error.message);
  } finally { button.disabled = false; }
});

$('#update-open').addEventListener('click', () => {
  if (latestRelease?.releaseUrl) window.open(latestRelease.releaseUrl, '_blank', 'noopener');
});

$('#refresh').addEventListener('click', async () => { await load(); await runDiagnostics(false); });
load();
setInterval(load, 8000);
