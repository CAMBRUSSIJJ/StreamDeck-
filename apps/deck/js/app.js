import { createPairingIdentity, derivePairKey, decryptJson, encryptJson, importDeviceKey, randomId } from './core/crypto.js';
import { RealtimeChannel } from './core/realtime.js';
import { actionLabels, createCommand } from './core/protocol.js';
import { loadState, resetState, saveState } from './core/store.js';
import { duplicateControl, duplicatePage, moveItemById, reorderById, uniquePageName } from './core/editor.js';
import { CONTROL_KIND_LABELS, applyKindPreset, clampVolume, defaultControlForKind, normalizeKind, toggleState, volumeKeySteps } from './core/widgets.js';
import { hydrateStaticIcons, iconSvg, semanticIcon } from './ui/icons.js';

const $ = selector => document.querySelector(selector);
const els = {
  grid: $('#deck-grid'), dock: $('#page-dock'), pageTitle: $('#page-title'), pageSummary: $('#page-summary'), addButton: $('#add-button'), editToggle: $('#edit-toggle'), editToggleLabel: $('#edit-toggle-label'), editBadge: $('#edit-badge'), editToolbar: $('#edit-toolbar'), pageManage: $('#page-manage'),
  pageDialog: $('#page-dialog'), pageClose: $('#page-close'), pageList: $('#page-list'), pageCreate: $('#page-create'), newPageName: $('#new-page-name'),
  devicePill: $('#device-pill'), deviceName: $('#device-name'), deviceStatusText: $('#device-status-text'), deviceDialog: $('#device-dialog'), deviceList: $('#device-list'), deviceClose: $('#device-close'), pairCode: $('#pair-code'), pairStart: $('#pair-start'), pairProgress: $('#pair-progress'),
  settingsOpen: $('#settings-open'), settingsDialog: $('#settings-dialog'), settingsClose: $('#settings-close'), cloudStatus: $('#cloud-status'), resetData: $('#reset-data'), accentPicker: $('#accent-picker'),
  buttonDialog: $('#button-dialog'), buttonForm: $('#button-form'), buttonDialogTitle: $('#button-dialog-title'), btnKind: $('#btn-kind'), btnLabel: $('#btn-label'), btnIcon: $('#btn-icon'), btnColor: $('#btn-color'), btnSize: $('#btn-size'), btnActionType: $('#btn-action-type'), actionTypeLabel: $('#action-type-label'), actionSection: $('#action-section'), actionSectionTitle: $('#action-section-title'), actionFields: $('#action-fields'), deleteButton: $('#delete-button'), duplicateButton: $('#duplicate-button'), editorPreview: $('#editor-preview'), previewIcon: $('#preview-icon'), previewLabel: $('#preview-label'), previewSize: $('#preview-size'),
  clockTime: $('#clock-time'), clockDate: $('#clock-date'), toastRegion: $('#toast-region')
};

let state = loadState();
let editing = false;
let editingButtonId = null;
let cloudConfig = null;
let suppressClickUntil = 0;
const deviceChannels = new Map();
const deviceStatuses = new Map();
const pendingAcks = new Map();
const sizeLabels = { square:'1 × 1', wide:'2 × 1', tall:'1 × 2', large:'2 × 2' };
const actionChips = { open_url:'Web', launch_app:'App', hotkey:'Atalho', media:'Mídia' };
const kindChips = { button:'Ação', toggle:'Toggle', volume:'Volume', media_panel:'Mídia', status:'Status', clock:'Relógio' };

hydrateStaticIcons();
applyAppearance();
updateClock();
setInterval(updateClock, 20_000);

function updateClock() {
  const now = new Date();
  els.clockTime.textContent = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
  els.clockDate.textContent = now.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' }).replaceAll('.', '');
  updateLiveWidgets(now);
}

function toast(message, type = '') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  els.toastRegion.append(node);
  setTimeout(() => node.remove(), 3000);
}

function currentPage() { return state.pages.find(p => p.id === state.activePageId) || state.pages[0]; }
function activeDevice() { return state.devices.find(d => d.id === state.activeDeviceId) || state.devices[0] || null; }
function persist() { saveState(state); }
function applyAppearance() {
  const accent = state.preferences?.accent || 'indigo';
  document.body.dataset.accent = accent;
  els.accentPicker?.querySelectorAll('[data-accent]').forEach(button => button.classList.toggle('active', button.dataset.accent === accent));
}

function render() {
  applyAppearance();
  renderPages();
  renderButtons();
  renderDeviceState();
  renderEditingState();
}

function renderPages() {
  const page = currentPage();
  els.pageTitle.textContent = page.name;
  const count = page.buttons.length;
  els.pageSummary.textContent = count ? `${count} ${count === 1 ? 'controle' : 'controles'} · toque para executar` : 'Um espaço limpo para seus próximos controles.';
  els.dock.replaceChildren(...state.pages.map(p => {
    const b = document.createElement('button');
    b.className = `page-tab ${p.id === page.id ? 'active' : ''}`;
    b.type = 'button';
    const icon = document.createElement('span'); icon.className = 'page-tab-icon';
    const svg = iconSvg(p.icon || 'grid'); icon.innerHTML = svg || p.icon || '•';
    const label = document.createElement('span'); label.className = 'page-tab-label'; label.textContent = p.name;
    b.append(icon, label);
    b.addEventListener('click', () => { state.activePageId = p.id; persist(); render(); });
    return b;
  }));
}


function renderPageManager() {
  els.pageList.replaceChildren(...state.pages.map((page, index) => {
    const row = document.createElement('div');
    row.className = `page-manager-row ${page.id === state.activePageId ? 'active' : ''}`;
    row.dataset.pageId = page.id;

    const identity = document.createElement('div');
    identity.className = 'page-manager-identity';
    const iconWrap = document.createElement('span');
    iconWrap.className = 'page-manager-icon';
    iconWrap.innerHTML = iconSvg(page.icon || 'grid');
    const copy = document.createElement('div');
    copy.className = 'page-manager-copy';
    const name = document.createElement('input');
    name.className = 'page-name-input';
    name.maxLength = 24;
    name.value = page.name;
    name.setAttribute('aria-label', `Nome da página ${page.name}`);
    const meta = document.createElement('span');
    meta.textContent = `${page.buttons.length} ${page.buttons.length === 1 ? 'controle' : 'controles'}${page.id === state.activePageId ? ' · ativa' : ''}`;
    copy.append(name, meta);
    identity.append(iconWrap, copy);

    const controls = document.createElement('div');
    controls.className = 'page-manager-actions';
    const iconSelect = document.createElement('select');
    iconSelect.className = 'compact-select';
    [['home','Início'],['grid','Grade'],['music','Mídia']].forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value; option.textContent = label; iconSelect.append(option);
    });
    iconSelect.value = page.icon || 'grid';
    iconSelect.setAttribute('aria-label', `Ícone da página ${page.name}`);

    const activate = document.createElement('button');
    activate.type = 'button';
    activate.className = `page-use-button ${page.id === state.activePageId ? 'active' : ''}`;
    activate.textContent = page.id === state.activePageId ? 'Ativa' : 'Usar';
    const up = miniIconButton('chevronUp', 'Mover para cima');
    const down = miniIconButton('chevronDown', 'Mover para baixo');
    const duplicate = miniIconButton('copy', 'Duplicar página');
    const remove = miniIconButton('trash', 'Excluir página', 'danger-mini');

    activate.addEventListener('click', () => { state.activePageId = page.id; persist(); render(); renderPageManager(); });
    name.addEventListener('change', () => {
      const value = name.value.trim();
      if (!value) { name.value = page.name; toast('A página precisa ter um nome.', 'error'); return; }
      page.name = value; persist(); render(); renderPageManager();
    });
    iconSelect.addEventListener('change', () => { page.icon = iconSelect.value; persist(); render(); renderPageManager(); });
    up.disabled = index === 0;
    down.disabled = index === state.pages.length - 1;
    up.addEventListener('click', () => { state.pages = moveItemById(state.pages, page.id, -1); persist(); render(); renderPageManager(); });
    down.addEventListener('click', () => { state.pages = moveItemById(state.pages, page.id, 1); persist(); render(); renderPageManager(); });
    duplicate.addEventListener('click', () => {
      const clone = duplicatePage(page, randomId(7), uniquePageName(state.pages, `${page.name} cópia`), () => randomId(8));
      state.pages.splice(index + 1, 0, clone);
      state.activePageId = clone.id;
      persist(); render(); renderPageManager(); toast('Página duplicada.', 'success');
    });
    remove.disabled = state.pages.length <= 1;
    remove.addEventListener('click', () => {
      if (state.pages.length <= 1) return;
      if (!confirm(`Excluir a página “${page.name}” e todos os controles dela?`)) return;
      state.pages = state.pages.filter(item => item.id !== page.id);
      if (state.activePageId === page.id) state.activePageId = state.pages[Math.max(0, index - 1)]?.id || state.pages[0].id;
      persist(); render(); renderPageManager(); toast('Página removida.');
    });

    controls.append(iconSelect, activate, up, down, duplicate, remove);
    row.append(identity, controls);
    return row;
  }));
}

function miniIconButton(iconName, label, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `mini-icon-button ${extraClass}`.trim();
  button.title = label;
  button.setAttribute('aria-label', label);
  button.innerHTML = `<span class="ui-icon">${iconSvg(iconName)}</span>`;
  return button;
}

function createPage() {
  const requested = els.newPageName.value.trim();
  const name = requested ? uniquePageName(state.pages, requested) : uniquePageName(state.pages, 'Nova página');
  const page = { id: randomId(7), name, icon:'grid', buttons:[] };
  state.pages.push(page);
  state.activePageId = page.id;
  els.newPageName.value = '';
  persist(); render(); renderPageManager(); toast(`Página “${name}” criada.`, 'success');
}

function attachDragHandlers(node, buttonId) {
  const handle = node.querySelector('.edit-handle');
  if (!handle) return;
  let drag = null;

  const cleanup = () => {
    document.querySelectorAll('.deck-button.drag-target').forEach(item => item.classList.remove('drag-target'));
    drag?.ghost?.remove();
    node.classList.remove('dragging');
    document.body.classList.remove('drag-active');
    drag = null;
  };

  handle.addEventListener('pointerdown', event => {
    if (!editing || event.button > 0) return;
    event.preventDefault(); event.stopPropagation();
    const rect = node.getBoundingClientRect();
    const ghost = node.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.classList.remove('editing');
    ghost.style.width = `${rect.width}px`;
    ghost.style.height = `${rect.height}px`;
    ghost.style.left = `${rect.left}px`;
    ghost.style.top = `${rect.top}px`;
    document.body.append(ghost);
    node.classList.add('dragging');
    document.body.classList.add('drag-active');
    handle.setPointerCapture?.(event.pointerId);
    drag = { pointerId:event.pointerId, ghost, targetId:null, offsetX:event.clientX-rect.left, offsetY:event.clientY-rect.top };
  });

  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault();
    drag.ghost.style.left = `${event.clientX - drag.offsetX}px`;
    drag.ghost.style.top = `${event.clientY - drag.offsetY}px`;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('.deck-button[data-button-id]');
    document.querySelectorAll('.deck-button.drag-target').forEach(item => item.classList.remove('drag-target'));
    if (target && target.dataset.buttonId !== buttonId) {
      drag.targetId = target.dataset.buttonId;
      target.classList.add('drag-target');
    } else drag.targetId = null;
  });

  const finish = event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    event.preventDefault(); event.stopPropagation();
    const targetId = drag.targetId;
    cleanup();
    suppressClickUntil = performance.now() + 350;
    if (!targetId) return;
    const page = currentPage();
    page.buttons = reorderById(page.buttons, buttonId, targetId);
    persist(); renderButtons(); toast('Ordem atualizada.', 'success');
  };
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', cleanup);
}

function subtitleFor(action) {
  if (!action) return 'Sem ação';
  if (action.type === 'media') {
    const labels = { play_pause:'Play / Pause', next:'Próxima faixa', previous:'Faixa anterior', volume_up:'Aumentar volume', volume_down:'Diminuir volume', volume_mute:'Alternar silêncio' };
    return labels[action.key] || 'Controle de mídia';
  }
  if (action.type === 'hotkey') return action.keys?.join(' + ') || 'Atalho de teclado';
  if (action.type === 'open_url') {
    try { return new URL(action.url).hostname.replace(/^www\./,''); } catch { return 'Abrir endereço'; }
  }
  if (action.type === 'launch_app') return action.path?.split(/[\\/]/).pop() || 'Aplicativo do Windows';
  return actionLabels[action.type] || action.type;
}

function buttonIconMarkup(button) {
  const semantic = semanticIcon(button);
  const svg = semantic ? iconSvg(semantic) : '';
  return svg ? `<span class="ui-icon">${svg}</span>` : `<span class="fallback-icon"></span>`;
}

function cardBase(button, index, tagName = 'article') {
  const node = document.createElement(tagName);
  if (tagName === 'button') node.type = 'button';
  node.className = `deck-button widget-card kind-${normalizeKind(button.kind)} ${editing ? 'editing' : ''}`;
  node.dataset.size = button.size || 'square';
  node.dataset.buttonId = button.id;
  node.dataset.kind = normalizeKind(button.kind);
  node.style.setProperty('--button-color', button.color || '#6478ff');
  node.style.setProperty('--item-index', String(index));
  return node;
}

function editHandleMarkup() {
  return `<span class="edit-handle" role="button" aria-label="Arrastar controle"><span class="ui-icon">${iconSvg('more')}</span></span>`;
}

function bindEditing(node, button) {
  if (!editing) return;
  node.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) return;
    if (event.target.closest('.edit-handle')) return;
    openButtonEditor(button.id);
  });
  attachDragHandlers(node, button.id);
}

function renderActionButton(button, index) {
  const kind = normalizeKind(button.kind);
  const node = cardBase(button, index, 'button');
  const isToggle = kind === 'toggle';
  if (isToggle && button.state) node.classList.add('is-on');
  node.innerHTML = `<span class="deck-top"><span class="deck-icon">${buttonIconMarkup(button)}</span><span class="action-chip"></span></span><span class="deck-copy"><span class="deck-label"></span><span class="deck-subtitle"></span></span>${isToggle ? '<span class="toggle-track"><span></span></span>' : ''}${editHandleMarkup()}`;
  const fallback = node.querySelector('.fallback-icon');
  if (fallback) fallback.textContent = button.icon || '⌘';
  node.querySelector('.action-chip').textContent = editing ? 'Editar' : (isToggle ? (button.state ? 'ON' : 'OFF') : (actionChips[button.action?.type] || 'Ação'));
  node.querySelector('.deck-label').textContent = button.label;
  node.querySelector('.deck-subtitle').textContent = editing ? `${CONTROL_KIND_LABELS[kind]} · ${sizeLabels[button.size || 'square']}` : (isToggle ? (button.state ? 'Ativo' : 'Inativo') : subtitleFor(button.action));
  node.addEventListener('click', async () => {
    if (performance.now() < suppressClickUntil || editing) return;
    if (isToggle) {
      button.state = toggleState(button.state);
      persist(); renderButtons();
      if (button.action) await executeAction(button.action, button.label, { allowOfflineVisual:true });
      return;
    }
    await executeButton(button);
  });
  if (editing) bindEditing(node, button);
  return node;
}

function renderVolumeWidget(button, index) {
  const node = cardBase(button, index);
  const value = clampVolume(button.value ?? 50);
  button.value = value;
  node.innerHTML = `<span class="deck-top"><span class="deck-icon">${buttonIconMarkup(button)}</span><span class="action-chip">${editing ? 'Editar' : 'Volume'}</span></span><div class="volume-widget"><div class="volume-heading"><span class="deck-label"></span><strong class="volume-value">${value}%</strong></div><input class="volume-slider" type="range" min="0" max="100" step="5" value="${value}" aria-label="Controle de volume"><div class="volume-scale"><span>0</span><span>100</span></div></div>${editHandleMarkup()}`;
  const fallback = node.querySelector('.fallback-icon'); if (fallback) fallback.textContent = button.icon || '🔊';
  node.querySelector('.deck-label').textContent = button.label;
  const slider = node.querySelector('.volume-slider');
  slider.setAttribute('aria-label', button.label || 'Volume');
  slider.style.setProperty('--fill', `${value}%`);
  if (editing) {
    slider.disabled = true;
    bindEditing(node, button);
  } else {
    slider.addEventListener('input', () => { node.querySelector('.volume-value').textContent = `${slider.value}%`; slider.style.setProperty('--fill', `${slider.value}%`); });
    slider.addEventListener('change', async () => {
      const previous = clampVolume(button.value ?? 50);
      const next = clampVolume(slider.value);
      button.value = next; persist();
      const steps = volumeKeySteps(previous, next, 5);
      if (steps.count) await sendMediaBurst(steps.key, steps.count, button.label);
    });
  }
  return node;
}

function renderMediaWidget(button, index) {
  const node = cardBase(button, index);
  node.innerHTML = `<span class="deck-top"><span class="deck-icon">${buttonIconMarkup(button)}</span><span class="action-chip">${editing ? 'Editar' : 'Mídia'}</span></span><div class="media-widget"><div class="media-copy"><span class="deck-label"></span><span class="deck-subtitle">Controles rápidos do Windows</span></div><div class="media-controls"><button type="button" data-media="previous" aria-label="Faixa anterior">◀</button><button type="button" class="media-primary" data-media="play_pause" aria-label="Play ou pause">▶</button><button type="button" data-media="next" aria-label="Próxima faixa">▶▶</button><button type="button" data-media="volume_mute" aria-label="Silenciar">⌁</button></div></div>${editHandleMarkup()}`;
  const fallback = node.querySelector('.fallback-icon'); if (fallback) fallback.textContent = button.icon || '▶';
  node.querySelector('.deck-label').textContent = button.label;
  if (editing) {
    node.querySelectorAll('.media-controls button').forEach(b => b.disabled = true);
    bindEditing(node, button);
  } else {
    node.querySelectorAll('[data-media]').forEach(control => control.addEventListener('click', event => {
      event.stopPropagation();
      executeAction({ type:'media', key:control.dataset.media }, button.label, { allowOfflineVisual:true });
    }));
  }
  return node;
}

function renderStatusWidget(button, index) {
  const node = cardBase(button, index);
  node.innerHTML = `<span class="deck-top"><span class="deck-icon">${buttonIconMarkup(button)}</span><span class="action-chip">${editing ? 'Editar' : 'Sistema'}</span></span><div class="status-widget"><div><span class="deck-label"></span><span class="status-live-copy" data-live-status>Desconectado</span></div><span class="status-orb" data-live-orb></span></div>${editHandleMarkup()}`;
  const fallback = node.querySelector('.fallback-icon'); if (fallback) fallback.textContent = button.icon || '●';
  node.querySelector('.deck-label').textContent = button.label;
  bindEditing(node, button);
  return node;
}

function renderClockWidget(button, index) {
  const node = cardBase(button, index);
  node.innerHTML = `<span class="deck-top"><span class="deck-icon">${buttonIconMarkup(button)}</span><span class="action-chip">${editing ? 'Editar' : 'Agora'}</span></span><div class="clock-widget"><strong data-live-clock>--:--</strong><span data-live-date>---</span></div>${editHandleMarkup()}`;
  const fallback = node.querySelector('.fallback-icon'); if (fallback) fallback.textContent = button.icon || '◷';
  bindEditing(node, button);
  return node;
}

function renderControl(button, index) {
  switch (normalizeKind(button.kind)) {
    case 'volume': return renderVolumeWidget(button, index);
    case 'media_panel': return renderMediaWidget(button, index);
    case 'status': return renderStatusWidget(button, index);
    case 'clock': return renderClockWidget(button, index);
    case 'toggle':
    case 'button':
    default: return renderActionButton(button, index);
  }
}

function updateLiveWidgets(now = new Date()) {
  document.querySelectorAll('[data-live-clock]').forEach(el => { el.textContent = now.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }); });
  document.querySelectorAll('[data-live-date]').forEach(el => { el.textContent = now.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' }); });
  const device = activeDevice();
  const status = device ? deviceStatuses.get(device.id) : null;
  const online = Boolean(status?.online && Date.now() - status.seenAt < 25_000);
  document.querySelectorAll('[data-live-status]').forEach(el => {
    el.textContent = device ? `${online ? 'Online' : 'Offline'} · ${status?.hostname || device.name || 'Windows'}` : 'Nenhum PC conectado';
  });
  document.querySelectorAll('[data-live-orb]').forEach(el => el.classList.toggle('online', online));
}

function renderButtons() {
  const page = currentPage();
  if (!page.buttons.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-deck';
    empty.innerHTML = `<div class="empty-deck-inner"><div class="empty-deck-icon"><span class="ui-icon">${iconSvg('grid')}</span></div><strong>Este deck está vazio</strong><span>${editing ? 'Use “Novo item” para adicionar botões e widgets.' : 'Entre no modo de edição para adicionar seus primeiros controles.'}</span></div>`;
    els.grid.replaceChildren(empty);
    return;
  }
  els.grid.replaceChildren(...page.buttons.map(renderControl));
  updateLiveWidgets();
}

function renderEditingState() {
  document.body.classList.toggle('editing-mode', editing);
  els.editBadge.classList.toggle('hidden', !editing);
  els.editToolbar.classList.toggle('hidden', !editing);
  els.addButton.classList.toggle('hidden', !editing);
  els.editToggle.classList.toggle('active', editing);
  els.editToggleLabel.textContent = editing ? 'Concluir' : 'Editar deck';
}

function renderDeviceState() {
  const device = activeDevice();
  if (!device) {
    els.deviceName.textContent = 'Nenhum PC';
    els.deviceStatusText.textContent = 'Desconectado';
    els.devicePill.classList.remove('online');
    els.devicePill.classList.add('offline');
    updateLiveWidgets();
    return;
  }
  const status = deviceStatuses.get(device.id);
  const online = Boolean(status?.online && Date.now() - status.seenAt < 25_000);
  els.deviceName.textContent = device.name || 'PC';
  els.deviceStatusText.textContent = online ? 'Online' : 'Offline';
  els.devicePill.classList.toggle('online', online);
  els.devicePill.classList.toggle('offline', !online);
  updateLiveWidgets();
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
    empty.innerHTML = `<div class="device-meta"><strong>Nenhum computador pareado</strong><span>A integração será feita depois da etapa visual.</span></div>`;
    rows.push(empty);
  }
  els.deviceList.replaceChildren(...rows);
}

function updateEditorPreview() {
  els.editorPreview.style.setProperty('--preview-color', els.btnColor.value || '#6478ff');
  els.previewIcon.textContent = els.btnIcon.value.trim() || '⌘';
  els.previewLabel.textContent = els.btnLabel.value.trim() || 'Novo item';
  const kind = normalizeKind(els.btnKind.value);
  els.previewSize.textContent = `${CONTROL_KIND_LABELS[kind]} · ${sizeLabels[els.btnSize.value] || '1 × 1'}`;
}

function openButtonEditor(id = null) {
  editingButtonId = id;
  const button = id ? currentPage().buttons.find(b => b.id === id) : null;
  const source = button || defaultControlForKind('button');
  els.buttonDialogTitle.textContent = button ? 'Editar item' : 'Novo item';
  els.btnKind.value = normalizeKind(source.kind);
  els.btnLabel.value = button?.label || '';
  els.btnIcon.value = source.icon || '⌘';
  els.btnColor.value = source.color || '#6478ff';
  els.btnSize.value = source.size || 'square';
  els.btnActionType.value = source.action?.type || 'open_url';
  els.deleteButton.classList.toggle('hidden', !button);
  els.duplicateButton.classList.toggle('hidden', !button);
  renderActionFields(source);
  updateEditorPreview();
  els.buttonDialog.showModal();
}

function editorKindPreset() {
  const kind = normalizeKind(els.btnKind.value);
  const current = { id:editingButtonId || '', label:els.btnLabel.value.trim(), icon:els.btnIcon.value.trim(), color:els.btnColor.value, size:els.btnSize.value };
  const preset = applyKindPreset(current, kind);
  els.btnLabel.value = preset.label || '';
  els.btnIcon.value = preset.icon || '⌘';
  els.btnColor.value = preset.color || '#6478ff';
  els.btnSize.value = preset.size || 'square';
  if (preset.action) els.btnActionType.value = preset.action.type;
  renderActionFields(preset);
  updateEditorPreview();
}

function actionInputFields(action = null) {
  const type = els.btnActionType.value;
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
  return label;
}

function renderActionFields(source = null) {
  const kind = normalizeKind(els.btnKind.value);
  els.actionFields.replaceChildren();
  const action = source?.action || source;
  const actionKinds = new Set(['button','toggle']);
  els.actionTypeLabel.classList.toggle('hidden', !actionKinds.has(kind));
  els.actionSectionTitle.textContent = actionKinds.has(kind) ? 'Ação' : 'Widget';
  if (actionKinds.has(kind)) {
    els.actionFields.append(actionInputFields(action));
    return;
  }
  if (kind === 'volume') {
    const label = document.createElement('label'); label.textContent = 'Volume inicial';
    const row = document.createElement('div'); row.className = 'range-editor-row';
    const input = document.createElement('input'); input.id = 'widget-volume'; input.type = 'range'; input.min = '0'; input.max = '100'; input.step = '5'; input.value = String(clampVolume(source?.value ?? 50));
    const value = document.createElement('strong'); value.textContent = `${input.value}%`;
    input.addEventListener('input', () => value.textContent = `${input.value}%`);
    row.append(input, value); label.append(row); els.actionFields.append(label);
    return;
  }
  const note = document.createElement('div'); note.className = 'widget-editor-note';
  const notes = {
    media_panel:'Central pronta com faixa anterior, play/pause, próxima faixa e silêncio.',
    status:'Mostra o computador ativo e muda automaticamente entre Online e Offline.',
    clock:'Mostra hora e data do iPad em tempo real.'
  };
  note.textContent = notes[kind] || 'Widget visual do Nexus Deck.';
  els.actionFields.append(note);
}

function actionFromForm() {
  const type = els.btnActionType.value;
  if (type === 'open_url') return { type, url: $('#action-url').value.trim() };
  if (type === 'launch_app') return { type, path: $('#action-path').value.trim(), args: [] };
  if (type === 'hotkey') return { type, keys: $('#action-hotkey').value.toUpperCase().split('+').map(v => v.trim()).filter(Boolean) };
  return { type, key: $('#action-media').value };
}

function controlFromForm() {
  const kind = normalizeKind(els.btnKind.value);
  const record = {
    id:editingButtonId || randomId(8), kind, label:els.btnLabel.value.trim(), icon:els.btnIcon.value.trim() || '⌘',
    color:els.btnColor.value, size:els.btnSize.value
  };
  if (kind === 'button' || kind === 'toggle') {
    record.action = actionFromForm();
    createCommand(record.action, 'validation');
  }
  const existing = editingButtonId ? currentPage().buttons.find(b => b.id === editingButtonId) : null;
  if (kind === 'toggle') record.state = existing?.kind === 'toggle' ? Boolean(existing.state) : false;
  if (kind === 'volume') record.value = clampVolume($('#widget-volume')?.value ?? existing?.value ?? 50);
  if (!record.label) throw new Error('Informe um nome');
  return record;
}

async function connectionForAction({ allowOfflineVisual = false } = {}) {
  const device = activeDevice();
  if (!device) {
    if (allowOfflineVisual) { toast('Widget atualizado localmente · conecte um PC para executar.', ''); return null; }
    toast('Conecte um computador para executar este controle.', 'error'); renderDeviceDialog(); els.deviceDialog.showModal(); return null;
  }
  const connection = deviceChannels.get(device.id);
  if (!connection?.channel?.joined) { toast('O computador está offline ou reconectando.', 'error'); return null; }
  return { device, connection };
}

async function broadcastAction(action, options = {}) {
  const target = await connectionForAction(options);
  if (!target) return null;
  const { device, connection } = target;
  const id = randomId(12);
  const command = createCommand(action, id);
  const envelope = await encryptJson(command, connection.key, `nexus:${device.roomId}:v1`);
  connection.channel.broadcast(envelope);
  return id;
}

async function executeAction(action, label = 'Controle', options = {}) {
  try {
    const id = await broadcastAction(action, options);
    if (!id) return false;
    const result = await waitForAck(id, 6000);
    toast(result.ok ? `${label}: executado` : `${label}: ${result.error || 'falhou'}`, result.ok ? 'success' : 'error');
    return Boolean(result.ok);
  } catch (error) { toast(error.message || 'Falha ao executar ação', 'error'); return false; }
}

async function sendMediaBurst(key, count, label = 'Volume') {
  if (!count) return;
  const target = await connectionForAction({ allowOfflineVisual:true });
  if (!target) return;
  try {
    for (let i = 0; i < count; i += 1) {
      const id = randomId(12);
      const command = createCommand({ type:'media', key }, id);
      const envelope = await encryptJson(command, target.connection.key, `nexus:${target.device.roomId}:v1`);
      target.connection.channel.broadcast(envelope);
      if (i < count - 1) await new Promise(resolve => setTimeout(resolve, 45));
    }
    toast(`${label}: ajustado`, 'success');
  } catch (error) { toast(error.message || 'Falha ao ajustar volume', 'error'); }
}

async function executeButton(button) {
  return executeAction(button.action, button.label);
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
      if (status) deviceStatuses.set(device.id, { ...status, online:false, seenAt:Date.now() });
      renderDeviceState();
    }
  });
  deviceChannels.set(device.id, { channel, key });
  channel.start().catch(() => {});
}

async function connectAllDevices() { for (const device of state.devices) await connectDevice(device); }

async function pairDevice(code) {
  if (!cloudConfig?.configured) throw new Error('A nuvem ainda não está configurada. Faremos isso depois da etapa visual.');
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
  state.devices.push(device); state.activeDeviceId = device.id; persist();
  await connectDevice(device); render(); return device;
}

async function loadCloudConfig() {
  try {
    const response = await fetch('/api/config', { cache:'no-store' });
    const json = await response.json();
    if (!response.ok || !json.configured) throw new Error('Cloud Relay não configurado');
    cloudConfig = json;
    els.cloudStatus.textContent = 'Configurado';
    els.cloudStatus.style.color = '#42d98b';
    await connectAllDevices();
  } catch {
    cloudConfig = { configured:false };
    els.cloudStatus.textContent = 'Ainda não configurado';
    els.cloudStatus.style.color = '#9aa4b4';
  }
}

els.editToggle.addEventListener('click', () => { editing = !editing; renderEditingState(); renderButtons(); });
els.addButton.addEventListener('click', () => openButtonEditor());
els.btnKind.addEventListener('change', editorKindPreset);
els.btnActionType.addEventListener('change', () => renderActionFields({ action:null }));
[els.btnLabel, els.btnIcon, els.btnColor, els.btnSize].forEach(input => input.addEventListener('input', updateEditorPreview));
els.btnSize.addEventListener('change', updateEditorPreview);
els.buttonForm.addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  try {
    const record = controlFromForm();
    const page = currentPage();
    const index = page.buttons.findIndex(b => b.id === editingButtonId);
    if (index >= 0) page.buttons[index] = record; else page.buttons.push(record);
    persist(); render(); els.buttonDialog.close(); toast('Controle salvo.', 'success');
  } catch (error) { toast(error.message, 'error'); }
});
els.deleteButton.addEventListener('click', () => {
  if (!editingButtonId) return;
  currentPage().buttons = currentPage().buttons.filter(b => b.id !== editingButtonId);
  persist(); render(); els.buttonDialog.close(); toast('Controle removido.');
});
els.duplicateButton.addEventListener('click', () => {
  if (!editingButtonId) return;
  const page = currentPage();
  const index = page.buttons.findIndex(button => button.id === editingButtonId);
  if (index < 0) return;
  const copy = duplicateControl(page.buttons[index], randomId(8));
  page.buttons.splice(index + 1, 0, copy);
  persist(); render(); els.buttonDialog.close(); toast('Controle duplicado.', 'success');
});
els.pageManage.addEventListener('click', () => { renderPageManager(); els.pageDialog.showModal(); });
els.pageClose.addEventListener('click', () => els.pageDialog.close());
els.pageCreate.addEventListener('click', createPage);
els.newPageName.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); createPage(); } });
els.devicePill.addEventListener('click', () => { renderDeviceDialog(); els.deviceDialog.showModal(); });
els.deviceClose.addEventListener('click', () => els.deviceDialog.close());
els.pairStart.addEventListener('click', async () => {
  els.pairStart.disabled = true; els.pairProgress.classList.remove('hidden'); els.pairProgress.textContent = 'Conectando ao computador…';
  try {
    const device = await pairDevice(els.pairCode.value.trim());
    els.pairProgress.textContent = `${device.name} pareado com sucesso.`; els.pairCode.value = ''; renderDeviceDialog(); toast(`${device.name} conectado.`, 'success');
  } catch (error) { els.pairProgress.textContent = error.message; toast(error.message, 'error'); }
  finally { els.pairStart.disabled = false; }
});
els.settingsOpen.addEventListener('click', () => { applyAppearance(); els.settingsDialog.showModal(); });
els.settingsClose.addEventListener('click', () => els.settingsDialog.close());
els.accentPicker.addEventListener('click', event => {
  const button = event.target.closest('[data-accent]'); if (!button) return;
  state.preferences = { ...(state.preferences || {}), accent:button.dataset.accent }; persist(); applyAppearance();
});
els.resetData.addEventListener('click', () => {
  if (!confirm('Apagar todos os perfis, controles e dispositivos deste iPad?')) return;
  for (const item of deviceChannels.values()) item.channel.stop();
  deviceChannels.clear(); deviceStatuses.clear(); state = resetState(); persist(); render(); els.settingsDialog.close(); toast('Dados locais apagados.');
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
setInterval(() => renderDeviceState(), 5000);
render();
loadCloudConfig();
