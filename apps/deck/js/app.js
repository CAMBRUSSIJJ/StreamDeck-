import { createPairingIdentity, derivePairKey, decryptJson, encryptJson, importDeviceKey, randomId } from './core/crypto.js';
import { RealtimeChannel } from './core/realtime.js';
import { actionLabels, createCommand } from './core/protocol.js';
import { loadState, resetState, saveState } from './core/store.js';

const $ = selector => document.querySelector(selector);
const els = {
  grid: $('#deck-grid'), dock: $('#page-dock'), pageTitle: $('#page-title'), addButton: $('#add-button'), editToggle: $('#edit-toggle'), editBadge: $('#edit-badge'),
  devicePill: $('#device-pill'), deviceName: $('#device-name'), deviceDialog: $('#device-dialog'), deviceList: $('#device-list'), deviceClose: $('#device-close'), pairCode: $('#pair-code'), pairStart: $('#pair-start'), pairProgress: $('#pair-progress'),
  settingsOpen: $('#settings-open'), settingsDialog: $('#settings-dialog'), settingsClose: $('#settings-close'), cloudStatus: $('#cloud-status'), resetData: $('#reset-data'),
  buttonDialog: $('#button-dialog'), buttonForm: $('#button-form'), buttonDialogTitle: $('#button-dialog-title'), btnLabel: $('#btn-label'), btnIcon: $('#btn-icon'), btnColor: $('#btn-color'), btnActionType: $('#btn-action-type'), actionFields: $('#action-fields'), deleteButton: $('#delete-button'),
  toastRegion: $('#toast-region')
};

let state = loadState();
let editing = false;
let editingButtonId = null;
let cloudConfig = null;
const deviceChannels = new Map();
const deviceStatuses = new Map();
const pendingAcks = new Map();

function toast(message, type = '') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  els.toastRegion.append(node);
  setTimeout(() => node.remove(), 3000);
}

function currentPage() {
  return state.pages.find(p => p.id === state.activePageId) || state.pages[0];
}

function activeDevice() {
  return state.devices.find(d => d.id === state.activeDeviceId) || state.devices[0] || null;
}

function persist() { saveState(state); }

function render() {
  renderPages();
  renderButtons();
  renderDeviceState();
}

function renderPages() {
  const page = currentPage();
  els.pageTitle.textContent = page.name;
  els.dock.replaceChildren(...state.pages.map(p => {
    const b = document.createElement('button');
    b.className = `page-tab ${p.id === page.id ? 'active' : ''}`;
    b.type = 'button';
    b.textContent = `${p.icon} ${p.name}`;
    b.addEventListener('click', () => { state.activePageId = p.id; persist(); render(); });
    return b;
  }));
}

function subtitleFor(action) {
  if (!action) return 'Sem ação';
  if (action.type === 'media') return `Mídia · ${String(action.key).replaceAll('_', ' ')}`;
  if (action.type === 'hotkey') return `Atalho · ${action.keys?.join(' + ') || ''}`;
  return actionLabels[action.type] || action.type;
}

function renderButtons() {
  const page = currentPage();
  els.grid.replaceChildren(...page.buttons.map(button => {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = `deck-button ${editing ? 'editing' : ''}`;
    node.style.setProperty('--button-color', button.color || '#5b8cff');
    node.innerHTML = `<span class="deck-icon"></span><span><span class="deck-label"></span><span class="deck-subtitle"></span></span>`;
    node.querySelector('.deck-icon').textContent = button.icon || '⌘';
    node.querySelector('.deck-label').textContent = button.label;
    node.querySelector('.deck-subtitle').textContent = editing ? 'Toque para editar' : subtitleFor(button.action);
    node.addEventListener('click', () => editing ? openButtonEditor(button.id) : executeButton(button));
    return node;
  }));
}

function renderDeviceState() {
  const device = activeDevice();
  if (!device) {
    els.deviceName.textContent = 'Nenhum PC';
    els.devicePill.classList.remove('online');
    els.devicePill.classList.add('offline');
    return;
  }
  const status = deviceStatuses.get(device.id);
  els.deviceName.textContent = device.name || 'PC';
  els.devicePill.classList.toggle('online', Boolean(status?.online && Date.now() - status.seenAt < 25_000));
  els.devicePill.classList.toggle('offline', !els.devicePill.classList.contains('online'));
}

function renderDeviceDialog() {
  const rows = state.devices.map(device => {
    const row = document.createElement('div');
    row.className = 'device-row';
    const status = deviceStatuses.get(device.id);
    const online = Boolean(status?.online && Date.now() - status.seenAt < 25_000);
    row.innerHTML = `<div class="device-meta"><strong></strong><span></span></div><div></div>`;
    row.querySelector('strong').textContent = device.name;
    row.querySelector('span').textContent = `${online ? '● Online' : '○ Offline'} · ${device.platform || 'Windows'}`;
    const actions = row.lastElementChild;
    const select = document.createElement('button');
    select.className = 'ghost-button';
    select.textContent = state.activeDeviceId === device.id ? 'Ativo' : 'Usar';
    select.addEventListener('click', () => { state.activeDeviceId = device.id; persist(); render(); renderDeviceDialog(); });
    actions.append(select);
    return row;
  });
  if (!rows.length) {
    const empty = document.createElement('div');
    empty.className = 'device-row';
    empty.textContent = 'Nenhum computador pareado ainda.';
    rows.push(empty);
  }
  els.deviceList.replaceChildren(...rows);
}

function openButtonEditor(id = null) {
  editingButtonId = id;
  const button = id ? currentPage().buttons.find(b => b.id === id) : null;
  els.buttonDialogTitle.textContent = button ? 'Editar botão' : 'Novo botão';
  els.btnLabel.value = button?.label || '';
  els.btnIcon.value = button?.icon || '⌘';
  els.btnColor.value = button?.color || '#5b8cff';
  els.btnActionType.value = button?.action?.type || 'open_url';
  els.deleteButton.classList.toggle('hidden', !button);
  renderActionFields(button?.action);
  els.buttonDialog.showModal();
}

function renderActionFields(action = null) {
  const type = els.btnActionType.value;
  els.actionFields.replaceChildren();
  const label = document.createElement('label');
  if (type === 'open_url') {
    label.textContent = 'URL';
    const input = document.createElement('input'); input.id = 'action-url'; input.placeholder = 'https://...'; input.value = action?.type === type ? action.url : 'https://'; label.append(input);
  } else if (type === 'launch_app') {
    label.textContent = 'Caminho do aplicativo no Windows';
    const input = document.createElement('input'); input.id = 'action-path'; input.placeholder = 'C:\\Program Files\\Aplicativo\\app.exe'; input.value = action?.type === type ? action.path : ''; label.append(input);
  } else if (type === 'hotkey') {
    label.textContent = 'Teclas (separadas por +)';
    const input = document.createElement('input'); input.id = 'action-hotkey'; input.placeholder = 'CTRL+SHIFT+K'; input.value = action?.type === type ? action.keys.join('+') : ''; label.append(input);
  } else if (type === 'media') {
    label.textContent = 'Comando';
    const select = document.createElement('select'); select.id = 'action-media';
    [['play_pause','Play / Pause'],['next','Próxima faixa'],['previous','Faixa anterior'],['volume_up','Volume +'],['volume_down','Volume −'],['volume_mute','Silenciar']].forEach(([value,text]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    });
    select.value = action?.type === type ? action.key : 'play_pause'; label.append(select);
  }
  els.actionFields.append(label);
}

function actionFromForm() {
  const type = els.btnActionType.value;
  if (type === 'open_url') return { type, url: $('#action-url').value.trim() };
  if (type === 'launch_app') return { type, path: $('#action-path').value.trim(), args: [] };
  if (type === 'hotkey') return { type, keys: $('#action-hotkey').value.toUpperCase().split('+').map(v => v.trim()).filter(Boolean) };
  return { type, key: $('#action-media').value };
}

async function executeButton(button) {
  const device = activeDevice();
  if (!device) { toast('Pareie um computador primeiro.', 'error'); els.deviceDialog.showModal(); return; }
  const connection = deviceChannels.get(device.id);
  if (!connection?.channel?.joined) { toast('O computador está offline ou reconectando.', 'error'); return; }
  try {
    const id = randomId(12);
    const command = createCommand(button.action, id);
    const envelope = await encryptJson(command, connection.key, `nexus:${device.roomId}:v1`);
    connection.channel.broadcast(envelope);
    const result = await waitForAck(id, 6000);
    toast(result.ok ? `${button.label}: executado` : `${button.label}: ${result.error || 'falhou'}`, result.ok ? 'success' : 'error');
  } catch (error) { toast(error.message || 'Falha ao executar ação', 'error'); }
}

function waitForAck(commandId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendingAcks.delete(commandId); reject(new Error('O PC não confirmou o comando')); }, timeoutMs);
    pendingAcks.set(commandId, result => { clearTimeout(timer); pendingAcks.delete(commandId); resolve(result); });
  });
}

async function connectDevice(device) {
  if (!cloudConfig?.configured || deviceChannels.has(device.id)) return;
  const key = await importDeviceKey(device.secret);
  const channel = new RealtimeChannel(cloudConfig, `nexus-device-${device.roomId}`, async payload => {
    try {
      const message = await decryptJson(payload, key, `nexus:${device.roomId}:v1`);
      if (message.type === 'status') {
        deviceStatuses.set(device.id, { ...message.body, online: true, seenAt: Date.now() });
        renderDeviceState();
        if (els.deviceDialog.open) renderDeviceDialog();
      } else if (message.type === 'ack') {
        pendingAcks.get(message.body.commandId)?.(message.body);
      }
    } catch {}
  }, stateName => {
    if (stateName === 'disconnected') {
      const status = deviceStatuses.get(device.id);
      if (status) deviceStatuses.set(device.id, { ...status, online: false, seenAt: Date.now() });
      renderDeviceState();
    }
  });
  deviceChannels.set(device.id, { channel, key });
  channel.start().catch(() => {});
}

async function connectAllDevices() {
  for (const device of state.devices) await connectDevice(device);
}

async function pairDevice(code) {
  if (!cloudConfig?.configured) throw new Error('Configure SUPABASE_URL e SUPABASE_ANON_KEY no Vercel primeiro');
  if (!/^\d{6}$/.test(code)) throw new Error('Informe o código de 6 dígitos');
  const identity = await createPairingIdentity();
  const requestId = randomId(12);
  let resolveResponse;
  const responsePromise = new Promise(resolve => { resolveResponse = resolve; });
  const channel = new RealtimeChannel(cloudConfig, `nexus-pair-${code}`, payload => {
    if (payload?.kind === 'pair-response' && payload.requestId === requestId) resolveResponse(payload);
  });
  await channel.start();
  channel.broadcast({ kind:'pair-request', requestId, clientPublicKey:identity.publicKey, clientNonce:identity.nonce });
  const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Pareamento expirou. Gere um novo código no PC.')), 90_000));
  const response = await Promise.race([responsePromise, timeout]);
  const pairKey = await derivePairKey(identity.privateKey, response.serverPublicKey, code, identity.nonce, response.serverNonce);
  const device = await decryptJson(response.envelope, pairKey, `pair:${code}:${requestId}`);
  channel.stop();
  if (!device?.id || !device?.roomId || !device?.secret) throw new Error('Resposta de pareamento inválida');
  state.devices = state.devices.filter(d => d.id !== device.id);
  state.devices.push(device);
  state.activeDeviceId = device.id;
  persist();
  await connectDevice(device);
  render();
  return device;
}

async function loadCloudConfig() {
  try {
    const response = await fetch('/api/config', { cache:'no-store' });
    const json = await response.json();
    if (!response.ok || !json.configured) throw new Error('Cloud Relay não configurado');
    cloudConfig = json;
    els.cloudStatus.textContent = 'Configurado';
    els.cloudStatus.style.color = '#35d07f';
    await connectAllDevices();
  } catch {
    cloudConfig = { configured:false };
    els.cloudStatus.textContent = 'Não configurado';
    els.cloudStatus.style.color = '#ff8b93';
  }
}

els.editToggle.addEventListener('click', () => {
  editing = !editing;
  els.editBadge.classList.toggle('hidden', !editing);
  els.editToggle.style.background = editing ? 'rgba(91,140,255,.18)' : '';
  renderButtons();
});
els.addButton.addEventListener('click', () => openButtonEditor());
els.btnActionType.addEventListener('change', () => renderActionFields());
els.buttonForm.addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  try {
    const record = { id: editingButtonId || randomId(8), label: els.btnLabel.value.trim(), icon: els.btnIcon.value.trim() || '⌘', color: els.btnColor.value, action: actionFromForm() };
    createCommand(record.action, 'validation');
    if (!record.label) throw new Error('Informe um nome');
    const page = currentPage();
    const index = page.buttons.findIndex(b => b.id === editingButtonId);
    if (index >= 0) page.buttons[index] = record; else page.buttons.push(record);
    persist(); renderButtons(); els.buttonDialog.close(); toast('Botão salvo.', 'success');
  } catch (error) { toast(error.message, 'error'); }
});
els.deleteButton.addEventListener('click', () => {
  if (!editingButtonId) return;
  currentPage().buttons = currentPage().buttons.filter(b => b.id !== editingButtonId);
  persist(); renderButtons(); els.buttonDialog.close(); toast('Botão removido.');
});
els.devicePill.addEventListener('click', () => { renderDeviceDialog(); els.deviceDialog.showModal(); });
els.deviceClose.addEventListener('click', () => els.deviceDialog.close());
els.pairStart.addEventListener('click', async () => {
  els.pairStart.disabled = true;
  els.pairProgress.classList.remove('hidden');
  els.pairProgress.textContent = 'Conectando ao computador…';
  try {
    const device = await pairDevice(els.pairCode.value.trim());
    els.pairProgress.textContent = `${device.name} pareado com sucesso.`;
    els.pairCode.value = '';
    renderDeviceDialog();
    toast(`${device.name} conectado.`, 'success');
  } catch (error) { els.pairProgress.textContent = error.message; toast(error.message, 'error'); }
  finally { els.pairStart.disabled = false; }
});
els.settingsOpen.addEventListener('click', () => els.settingsDialog.showModal());
els.settingsClose.addEventListener('click', () => els.settingsDialog.close());
els.resetData.addEventListener('click', () => {
  if (!confirm('Apagar todos os perfis, botões e dispositivos deste iPad?')) return;
  for (const item of deviceChannels.values()) item.channel.stop();
  deviceChannels.clear(); deviceStatuses.clear();
  state = resetState(); persist(); render(); els.settingsDialog.close(); toast('Dados locais apagados.');
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
setInterval(() => renderDeviceState(), 5000);
render();
loadCloudConfig();
