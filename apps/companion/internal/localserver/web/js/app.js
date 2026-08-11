import { createPairingIdentity, derivePairKey, decryptJson, encryptJson, importDeviceKey, randomId } from './core/crypto.js';
import { RealtimeChannel } from './core/realtime.js';
import { createPing, getLocalInfo, pairLocalDevice, sendLocalMessage, supportsSecureLocalCrypto } from './core/local.js';
import { actionLabels, createCommand, macroDurationHint } from './core/protocol.js';
import { backupSummary, exportPortableState, importPortableState, loadState, resetState, saveState } from './core/store.js';
import { duplicateControl, duplicatePage, moveItemById, reorderById, uniquePageName } from './core/editor.js';
import { CONTROL_KIND_LABELS, applyKindPreset, clampVolume, defaultControlForKind, normalizeKind, toggleState, volumeKeySteps } from './core/widgets.js';
import { findMatchingPage, normalizeProfile, profileAppsText, profileLabel } from './core/profiles.js';
import { integrationActionLabel, integrationCommand, integrationDescriptor, integrationServices, normalizeIntegrationAction } from './core/integrations.js';
import { hydrateStaticIcons, iconSvg, semanticIcon } from './ui/icons.js';
import { APP_ICON_OPTIONS, resolvedAppIcon } from './ui/app-icons.js';
import { LAYOUT_PRESETS, applyPreset, layoutSummary, normalizeLayout, normalizeSavedLayouts } from './core/layout.js';
import { columnsForViewport, normalizeMobilePreferences, orientationForViewport, pageIdByDelta, qualifiesAsSwipe } from './core/mobile.js';

const $ = selector => document.querySelector(selector);
const els = {
  grid: $('#deck-grid'), deckStage: $('.deck-stage'), dock: $('#page-dock'), pageTitle: $('#page-title'), pageSummary: $('#page-summary'), addButton: $('#add-button'), editToggle: $('#edit-toggle'), editToggleLabel: $('#edit-toggle-label'), editBadge: $('#edit-badge'), editToolbar: $('#edit-toolbar'), pageManage: $('#page-manage'), layoutOpen: $('#layout-open'),
  pageDialog: $('#page-dialog'), pageClose: $('#page-close'), pageList: $('#page-list'), pageCreate: $('#page-create'), newPageName: $('#new-page-name'),
  layoutDialog: $('#layout-dialog'), layoutClose: $('#layout-close'), layoutCancel: $('#layout-cancel'), layoutSave: $('#layout-save'), layoutReset: $('#layout-reset'), layoutApplyAll: $('#layout-apply-all'), layoutPresetGrid: $('#layout-preset-grid'), layoutPageName: $('#layout-page-name'), layoutDraftSummary: $('#layout-draft-summary'), layoutDensity: $('#layout-density'), layoutColumns: $('#layout-columns'), layoutIconSize: $('#layout-icon-size'), layoutTextAlign: $('#layout-text-align'), layoutCardStyle: $('#layout-card-style'), layoutRadius: $('#layout-radius'), layoutRadiusValue: $('#layout-radius-value'), layoutDock: $('#layout-dock'), layoutHeader: $('#layout-header'), layoutTheme: $('#layout-theme'), savedLayoutList: $('#saved-layout-list'), savedLayoutName: $('#saved-layout-name'), savedLayoutSave: $('#saved-layout-save'),
  devicePill: $('#device-pill'), deviceName: $('#device-name'), deviceStatusText: $('#device-status-text'), deviceDialog: $('#device-dialog'), deviceList: $('#device-list'), deviceClose: $('#device-close'), pairCode: $('#pair-code'), pairStart: $('#pair-start'), pairProgress: $('#pair-progress'),
  settingsOpen: $('#settings-open'), settingsDialog: $('#settings-dialog'), settingsClose: $('#settings-close'), cloudStatus: $('#cloud-status'), localStatus: $('#local-status'), localUrl: $('#local-url'), resetData: $('#reset-data'), exportDeck: $('#export-deck'), importDeck: $('#import-deck'), importDeckFile: $('#import-deck-file'), accentPicker: $('#accent-picker'), smartProfilesToggle: $('#smart-profiles-toggle'), foregroundStatus: $('#foreground-status'), integrationObsStatus: $('#integration-obs-status'), integrationSpotifyStatus: $('#integration-spotify-status'), integrationDiscordStatus: $('#integration-discord-status'), integrationBrowserStatus: $('#integration-browser-status'), deckDiagnostic: $('#deck-diagnostic'), deckDiagnosticExport: $('#deck-diagnostic-export'), deckDiagnosticResult: $('#deck-diagnostic-result'), onboardingOpen: $('#onboarding-open'), onboardingDialog: $('#onboarding-dialog'), onboardingClose: $('#onboarding-close'), onboardingPrev: $('#onboarding-prev'), onboardingNext: $('#onboarding-next'), onboardingStepLabel: $('#onboarding-step-label'), onboardingProgressBar: $('#onboarding-progress-bar'),
  buttonDialog: $('#button-dialog'), buttonForm: $('#button-form'), buttonDialogTitle: $('#button-dialog-title'), btnKind: $('#btn-kind'), btnLabel: $('#btn-label'), btnIcon: $('#btn-icon'), btnAppIcon: $('#btn-app-icon'), btnColor: $('#btn-color'), btnSize: $('#btn-size'), btnActionType: $('#btn-action-type'), actionTypeLabel: $('#action-type-label'), actionSection: $('#action-section'), actionSectionTitle: $('#action-section-title'), actionFields: $('#action-fields'), deleteButton: $('#delete-button'), duplicateButton: $('#duplicate-button'), editorPreview: $('#editor-preview'), previewIcon: $('#preview-icon'), previewLabel: $('#preview-label'), previewSize: $('#preview-size'),
  clockTime: $('#clock-time'), clockDate: $('#clock-date'), toastRegion: $('#toast-region'),
  mobileLockIndicator: $('#mobile-lock-indicator'), mobileImmersiveToggle: $('#mobile-immersive-toggle'), mobileLockToggle: $('#mobile-lock-toggle'), mobileSwipeToggle: $('#mobile-swipe-toggle'), mobileLongpressToggle: $('#mobile-longpress-toggle'), mobileScale: $('#mobile-scale'), mobilePortraitColumns: $('#mobile-portrait-columns'), mobileLandscapeColumns: $('#mobile-landscape-columns'), mobileOrientationStatus: $('#mobile-orientation-status'), mobileColumnsStatus: $('#mobile-columns-status'), mobileDisplayStatus: $('#mobile-display-status')
};

let state = loadState();
let editing = false;
let editingButtonId = null;
let cloudConfig = null;
let localConfig = null;
let suppressClickUntil = 0;
let manualPageId = state.activePageId;
let autoProfilePageId = null;
let profileOverrideUntil = 0;
let lastProfileProcess = '';
const deviceChannels = new Map();
const deviceStatuses = new Map();
const pendingAcks = new Map();
const sizeLabels = { square:'1 × 1', wide:'2 × 1', tall:'1 × 2', large:'2 × 2' };
const actionChips = { open_url:'Web', launch_app:'App', hotkey:'Atalho', media:'Mídia', system:'Sistema', integration:'Integração', macro:'Macro' };
const kindChips = { button:'Ação', toggle:'Toggle', macro:'Macro', volume:'Volume', media_panel:'Mídia', status:'Status', clock:'Relógio' };
const ONBOARDING_KEY = 'nexus.deck.onboarding.v1.4';
const ERROR_LOG_KEY = 'nexus.deck.errors.v1';
let onboardingStep = 0;
let lastDeckDiagnostic = null;
let layoutEditingPageId = null;
let layoutDraft = null;
const touchDeck = navigator.maxTouchPoints > 0 && (window.matchMedia?.('(pointer: coarse)').matches ?? true);
let mobileGesture = null;
let mobileResizeTimer = null;

hydrateStaticIcons();
for (const [value, label] of APP_ICON_OPTIONS.slice(2)) { const option=document.createElement('option'); option.value=value; option.textContent=label; els.btnAppIcon?.append(option); }
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


function recordClientError(message, source = 'runtime') {
  try {
    const previous = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]');
    previous.push({ at:new Date().toISOString(), source, message:String(message || 'Erro desconhecido').slice(0,500) });
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(previous.slice(-20)));
  } catch {}
}

window.addEventListener('error', event => recordClientError(event.message, 'window.error'));
window.addEventListener('unhandledrejection', event => recordClientError(event.reason?.message || event.reason, 'promise'));

function downloadJSON(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename;
  document.body.append(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildDeckDiagnostic() {
  const device = activeDevice();
  const deviceStatus = device ? deviceStatuses.get(device.id) : null;
  const checks = [];
  const add = (label, status, detail) => checks.push({ label, status, detail });
  add('Armazenamento local', 'ok', `${state.pages.length} página(s) e ${state.pages.reduce((n,p)=>n+p.buttons.length,0)} controle(s)`);
  add('Modo local', localConfig?.configured ? 'ok' : 'warn', localConfig?.configured ? (localConfig.localUrl || 'Companion local detectado') : 'Esta origem não está sendo servida pelo Companion local');
  add('Pareamento', state.devices.length ? 'ok' : 'warn', state.devices.length ? `${state.devices.length} computador(es) salvo(s)` : 'Nenhum computador pareado');
  if (device) add('PC ativo', deviceStatus?.online ? 'ok' : 'warn', `${device.name || 'PC'} · ${deviceStatus?.online ? 'online' : 'offline/reconectando'} · ${device.transport || 'cloud'}`);
  else add('PC ativo', 'warn', 'Nenhum PC selecionado');
  let storageStatus = 'ok'; let storageDetail = 'Escrita no navegador disponível';
  try { localStorage.setItem('nexus.deck.diag.tmp','1'); localStorage.removeItem('nexus.deck.diag.tmp'); } catch (error) { storageStatus='error'; storageDetail=error.message; }
  add('Persistência', storageStatus, storageDetail);
  let errors = [];
  try { errors = JSON.parse(localStorage.getItem(ERROR_LOG_KEY) || '[]'); } catch {}
  add('Erros recentes', errors.length ? 'warn' : 'ok', errors.length ? `${errors.length} evento(s) registrado(s) neste iPad` : 'Nenhum erro de runtime registrado');
  return {
    format:'nexus-deck-diagnostic', version:1, appVersion:'1.4.0', generatedAt:new Date().toISOString(),
    localMode:Boolean(localConfig?.configured), localUrl:localConfig?.localUrl || null,
    activeDevice:device ? { name:device.name, platform:device.platform, transport:device.transport } : null,
    checks, errors:errors.slice(-10)
  };
}

function renderDeckDiagnostic(report) {
  lastDeckDiagnostic = report;
  if (!els.deckDiagnosticResult) return;
  els.deckDiagnosticResult.classList.remove('hidden');
  els.deckDiagnosticResult.replaceChildren(...report.checks.map(check => {
    const row = document.createElement('div'); row.className = `deck-diagnostic-row ${check.status}`;
    const dot = document.createElement('span'); dot.className='deck-diagnostic-dot';
    const copy = document.createElement('div'); const strong=document.createElement('strong'); strong.textContent=check.label; const small=document.createElement('small'); small.textContent=check.detail; copy.append(strong,small); row.append(dot,copy); return row;
  }));
}

function renderOnboarding() {
  const pages = [...document.querySelectorAll('[data-onboarding-step]')];
  pages.forEach((page,index) => page.classList.toggle('hidden', index !== onboardingStep));
  const total = pages.length || 4;
  if (els.onboardingStepLabel) els.onboardingStepLabel.textContent = `${onboardingStep + 1} de ${total}`;
  if (els.onboardingProgressBar) els.onboardingProgressBar.style.width = `${((onboardingStep + 1) / total) * 100}%`;
  if (els.onboardingPrev) els.onboardingPrev.disabled = onboardingStep === 0;
  if (els.onboardingNext) els.onboardingNext.textContent = onboardingStep === total - 1 ? 'Concluir' : 'Próximo';
}

function openOnboarding() {
  onboardingStep = 0; renderOnboarding();
  if (!els.onboardingDialog?.open) els.onboardingDialog?.showModal();
}

function finishOnboarding() {
  localStorage.setItem(ONBOARDING_KEY, 'done');
  els.onboardingDialog?.close();
}

function currentPage() { return state.pages.find(p => p.id === state.activePageId) || state.pages[0]; }
function activeDevice() { return state.devices.find(d => d.id === state.activeDeviceId) || state.devices[0] || null; }
function persist() { saveState(state); }
function applyLayoutToDocument(input = null) {
  const layout = normalizeLayout(input || currentPage()?.layout);
  const body = document.body;
  body.dataset.layout = layout.preset;
  body.dataset.density = layout.density;
  body.dataset.iconSize = layout.iconSize;
  body.dataset.textAlign = layout.textAlign;
  body.dataset.cardStyle = layout.cardStyle;
  body.dataset.dock = layout.dock;
  body.dataset.header = layout.header;
  body.dataset.theme = layout.theme;
  body.style.setProperty('--layout-card-radius', `${layout.radius}px`);
  els.grid?.style.setProperty('--layout-columns', String(layout.columns));
  return layout;
}

function currentMobilePreferences() {
  state.preferences = { ...(state.preferences || {}), mobile:normalizeMobilePreferences(state.preferences?.mobile) };
  return state.preferences.mobile;
}

function isStandaloneDeck() {
  return Boolean(navigator.standalone) || Boolean(window.matchMedia?.('(display-mode: standalone)').matches);
}

function updateMobileEnvironment() {
  const mobile = currentMobilePreferences();
  const orientation = orientationForViewport(window.innerWidth, window.innerHeight);
  const columns = columnsForViewport(mobile, window.innerWidth, window.innerHeight);
  document.body.classList.toggle('touch-deck', touchDeck);
  document.body.classList.toggle('standalone-deck', isStandaloneDeck());
  document.body.classList.toggle('control-locked', touchDeck && mobile.locked);
  document.body.dataset.mobileImmersive = String(Boolean(mobile.immersive));
  document.body.dataset.mobileScale = mobile.scale;
  document.body.dataset.orientation = orientation;
  document.body.style.setProperty('--mobile-columns', String(columns));
  els.mobileLockIndicator?.classList.toggle('hidden', !(touchDeck && mobile.locked));
  if (els.mobileImmersiveToggle) els.mobileImmersiveToggle.checked = mobile.immersive;
  if (els.mobileLockToggle) els.mobileLockToggle.checked = mobile.locked;
  if (els.mobileSwipeToggle) els.mobileSwipeToggle.checked = mobile.swipePages;
  if (els.mobileLongpressToggle) els.mobileLongpressToggle.checked = mobile.longPressEdit;
  if (els.mobileScale) els.mobileScale.value = mobile.scale;
  if (els.mobilePortraitColumns) els.mobilePortraitColumns.value = String(mobile.portraitColumns);
  if (els.mobileLandscapeColumns) els.mobileLandscapeColumns.value = String(mobile.landscapeColumns);
  if (els.mobileOrientationStatus) els.mobileOrientationStatus.textContent = orientation === 'landscape' ? 'Horizontal' : 'Vertical';
  if (els.mobileColumnsStatus) els.mobileColumnsStatus.textContent = touchDeck ? `${columns} colunas` : 'Layout da página';
  if (els.mobileDisplayStatus) els.mobileDisplayStatus.textContent = isStandaloneDeck() ? 'Tela de Início · standalone' : (touchDeck ? 'Safari' : 'Desktop');
}

function setMobilePreference(key, value) {
  const mobile = { ...currentMobilePreferences(), [key]:value };
  state.preferences.mobile = normalizeMobilePreferences(mobile);
  if (state.preferences.mobile.locked && editing) editing = false;
  persist(); applyAppearance(); renderEditingState(); renderButtons();
}

function applyAppearance() {
  updateMobileEnvironment();
  const accent = state.preferences?.accent || 'indigo';
  document.body.dataset.accent = accent;
  els.accentPicker?.querySelectorAll('[data-accent]').forEach(button => button.classList.toggle('active', button.dataset.accent === accent));
  if (els.smartProfilesToggle) els.smartProfilesToggle.checked = state.preferences?.smartProfiles !== false;
  applyLayoutToDocument(layoutDraft && els.layoutDialog?.open ? layoutDraft : currentPage()?.layout);
}

function render() {
  applyAppearance();
  renderPages();
  renderButtons();
  renderDeviceState();
  renderEditingState();
}

function selectPageManually(pageId, { overrideMs = 30_000 } = {}) {
  if (!state.pages.some(page => page.id === pageId)) return;
  manualPageId = pageId;
  autoProfilePageId = null;
  profileOverrideUntil = Date.now() + overrideMs;
  state.activePageId = pageId;
  persist();
  render();
}

function renderPages() {
  const page = currentPage();
  els.pageTitle.textContent = page.name;
  const count = page.buttons.length;
  const auto = autoProfilePageId === page.id ? `Perfil automático · ${profileLabel(page)}` : '';
  const layoutName = LAYOUT_PRESETS[normalizeLayout(page.layout).preset]?.name || 'Layout personalizado';
  els.pageSummary.textContent = auto || (count ? `${count} ${count === 1 ? 'controle' : 'controles'} · ${layoutName}` : `${layoutName} · pronto para personalizar`);
  els.dock.replaceChildren(...state.pages.map(p => {
    const b = document.createElement('button');
    b.className = `page-tab ${p.id === page.id ? 'active' : ''} ${p.profile?.enabled ? 'smart' : ''}`.trim();
    b.type = 'button';
    const icon = document.createElement('span'); icon.className = 'page-tab-icon';
    const svg = iconSvg(p.icon || 'grid'); icon.innerHTML = svg || p.icon || '•';
    const label = document.createElement('span'); label.className = 'page-tab-label'; label.textContent = p.name;
    b.append(icon, label);
    if (p.profile?.enabled) { const dot = document.createElement('span'); dot.className = 'smart-dot'; dot.title = `Perfil: ${profileAppsText(p)}`; b.append(dot); }
    b.addEventListener('click', () => selectPageManually(p.id));
    return b;
  }));
}

function renderIntegrationStatuses(statuses = null) {
  const map = statuses || {};
  const targets = { obs:els.integrationObsStatus, spotify:els.integrationSpotifyStatus, discord:els.integrationDiscordStatus, browser:els.integrationBrowserStatus };
  Object.entries(targets).forEach(([id,node]) => {
    if (!node) return;
    const status = map?.[id];
    node.classList.remove('online','offline');
    if (!status) { node.textContent = 'Sem dados'; return; }
    if (status.connected) { node.textContent = '● Conectado'; node.classList.add('online'); return; }
    if (status.configured) { node.textContent = '○ Indisponível'; node.classList.add('offline'); return; }
    node.textContent = 'Não configurado';
  });
}

function applySmartProfile(status) {
  renderIntegrationStatuses(status?.integrations);
  const activeApp = status?.activeApp || null;
  const processName = String(activeApp?.processName || '').toLocaleLowerCase('en-US');
  if (els.foregroundStatus) els.foregroundStatus.textContent = processName ? `${activeApp.processName}${activeApp.windowTitle ? ` · ${activeApp.windowTitle}` : ''}` : 'Nenhum aplicativo detectado';
  if (state.preferences?.smartProfiles === false || editing || Date.now() < profileOverrideUntil) return;

  const match = findMatchingPage(state.pages, activeApp);
  if (match) {
    if (autoProfilePageId !== match.id || state.activePageId !== match.id) {
      if (!autoProfilePageId) manualPageId = state.activePageId;
      autoProfilePageId = match.id;
      state.activePageId = match.id;
      persist(); render();
      if (processName && processName !== lastProfileProcess) toast(`Perfil “${match.name}” ativado por ${activeApp.processName}.`, 'success');
    }
    lastProfileProcess = processName;
    return;
  }

  lastProfileProcess = processName;
  if (autoProfilePageId) {
    autoProfilePageId = null;
    const target = state.pages.some(page => page.id === manualPageId) ? manualPageId : state.pages[0]?.id;
    if (target && state.activePageId !== target) {
      state.activePageId = target;
      persist(); render();
    }
  }
}



function layoutTargetPage() {
  return state.pages.find(page => page.id === layoutEditingPageId) || currentPage();
}

function fillLayoutControls() {
  if (!layoutDraft) return;
  const layout = normalizeLayout(layoutDraft);
  layoutDraft = layout;
  els.layoutDensity.value = layout.density;
  els.layoutColumns.value = String(layout.columns);
  els.layoutIconSize.value = layout.iconSize;
  els.layoutTextAlign.value = layout.textAlign;
  els.layoutCardStyle.value = layout.cardStyle;
  els.layoutRadius.value = String(layout.radius);
  els.layoutRadiusValue.textContent = `${layout.radius} px`;
  els.layoutDock.value = layout.dock;
  els.layoutHeader.value = layout.header;
  els.layoutTheme.value = layout.theme;
  els.layoutDraftSummary.textContent = layoutSummary(layout);
  els.layoutPresetGrid.querySelectorAll('[data-layout-preset]').forEach(button => button.classList.toggle('active', button.dataset.layoutPreset === layout.preset));
}

function renderLayoutPresets() {
  els.layoutPresetGrid.replaceChildren(...Object.values(LAYOUT_PRESETS).map(preset => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'layout-preset-card';
    button.dataset.layoutPreset = preset.id;
    button.setAttribute('role','radio');
    button.innerHTML = `<span class="layout-preset-preview preset-${preset.id}"><i></i><i></i><i></i><i></i><i></i><i></i></span><span class="layout-preset-copy"><strong></strong><small></small></span><span class="layout-preset-check">✓</span>`;
    button.querySelector('strong').textContent = preset.name;
    button.querySelector('small').textContent = preset.description;
    button.addEventListener('click', () => {
      layoutDraft = applyPreset(preset.id, layoutDraft);
      fillLayoutControls(); applyLayoutToDocument(layoutDraft);
    });
    return button;
  }));
}

function renderSavedLayouts() {
  const saved = normalizeSavedLayouts(state.preferences?.savedLayouts);
  state.preferences = { ...(state.preferences || {}), savedLayouts:saved };
  if (!saved.length) {
    const empty = document.createElement('div'); empty.className='saved-layout-empty'; empty.textContent='Nenhum layout salvo ainda.';
    els.savedLayoutList.replaceChildren(empty); return;
  }
  els.savedLayoutList.replaceChildren(...saved.map(item => {
    const row=document.createElement('div'); row.className='saved-layout-row';
    const copy=document.createElement('div'); const strong=document.createElement('strong'); strong.textContent=item.name; const small=document.createElement('small'); small.textContent=layoutSummary(item.layout); copy.append(strong,small);
    const actions=document.createElement('div');
    const use=document.createElement('button'); use.type='button'; use.className='mini-text-button'; use.textContent='Aplicar';
    const remove=document.createElement('button'); remove.type='button'; remove.className='mini-text-button danger'; remove.textContent='Excluir';
    use.addEventListener('click',()=>{ layoutDraft=normalizeLayout(item.layout); fillLayoutControls(); applyLayoutToDocument(layoutDraft); toast(`Layout “${item.name}” aplicado na prévia.`, 'success'); });
    remove.addEventListener('click',()=>{ state.preferences.savedLayouts=saved.filter(savedItem=>savedItem.id!==item.id); persist(); renderSavedLayouts(); });
    actions.append(use,remove); row.append(copy,actions); return row;
  }));
}

function openLayoutEditor(pageId = state.activePageId) {
  const page = state.pages.find(item => item.id === pageId) || currentPage();
  layoutEditingPageId = page.id;
  layoutDraft = normalizeLayout(page.layout);
  els.layoutPageName.textContent = page.name;
  renderLayoutPresets(); renderSavedLayouts(); fillLayoutControls();
  applyLayoutToDocument(layoutDraft);
  if (!els.layoutDialog.open) els.layoutDialog.showModal();
}

function cancelLayoutEditor() {
  layoutDraft = null; layoutEditingPageId = null;
  if (els.layoutDialog.open) els.layoutDialog.close();
  applyAppearance();
}

function updateLayoutDraftFromControls() {
  if (!layoutDraft) return;
  layoutDraft = normalizeLayout({
    ...layoutDraft,
    density:els.layoutDensity.value,
    columns:Number(els.layoutColumns.value),
    iconSize:els.layoutIconSize.value,
    textAlign:els.layoutTextAlign.value,
    cardStyle:els.layoutCardStyle.value,
    radius:Number(els.layoutRadius.value),
    dock:els.layoutDock.value,
    header:els.layoutHeader.value,
    theme:els.layoutTheme.value
  });
  fillLayoutControls(); applyLayoutToDocument(layoutDraft);
}

function saveLayoutEditor() {
  const page=layoutTargetPage(); if (!page || !layoutDraft) return;
  page.layout=normalizeLayout(layoutDraft); persist();
  layoutDraft=null; layoutEditingPageId=null; els.layoutDialog.close(); render(); toast('Layout da página salvo.', 'success');
}

function applyLayoutToAllPages() {
  if (!layoutDraft) return;
  if (!confirm('Aplicar esta composição visual a todas as páginas do deck?')) return;
  state.pages.forEach(page => { page.layout=normalizeLayout(layoutDraft); }); persist();
  layoutDraft=null; layoutEditingPageId=null; els.layoutDialog.close(); render(); toast('Layout aplicado em todas as páginas.', 'success');
}

function saveCustomLayout() {
  if (!layoutDraft) return;
  const name=els.savedLayoutName.value.trim();
  if (!name) { toast('Dê um nome para o layout.', 'error'); return; }
  const current=normalizeSavedLayouts(state.preferences?.savedLayouts);
  const duplicate=current.find(item => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'));
  const record={ id:duplicate?.id || randomId(8), name, layout:normalizeLayout(layoutDraft) };
  state.preferences={ ...(state.preferences||{}), savedLayouts:duplicate ? current.map(item=>item.id===duplicate.id?record:item) : [...current,record].slice(-12) };
  els.savedLayoutName.value=''; persist(); renderSavedLayouts(); toast(`Layout “${name}” salvo.`, 'success');
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
    meta.textContent = `${page.buttons.length} ${page.buttons.length === 1 ? 'controle' : 'controles'} · ${LAYOUT_PRESETS[normalizeLayout(page.layout).preset]?.name || 'Layout'}${page.id === state.activePageId ? ' · ativa' : ''}`;
    copy.append(name, meta);
    identity.append(iconWrap, copy);

    const profileEditor = document.createElement('div');
    profileEditor.className = 'page-profile-editor';
    const profileToggle = document.createElement('label');
    profileToggle.className = 'profile-toggle';
    const profileCheck = document.createElement('input'); profileCheck.type = 'checkbox'; profileCheck.checked = Boolean(page.profile?.enabled);
    const profileToggleText = document.createElement('span'); profileToggleText.textContent = 'Perfil automático';
    profileToggle.append(profileCheck, profileToggleText);
    const profileInput = document.createElement('input');
    profileInput.className = 'profile-app-input';
    profileInput.placeholder = 'obsidian.exe, code.exe';
    profileInput.value = profileAppsText(page);
    profileInput.disabled = !profileCheck.checked;
    profileInput.setAttribute('aria-label', `Aplicativos do perfil ${page.name}`);
    const profileHint = document.createElement('span');
    profileHint.className = 'profile-hint';
    profileHint.textContent = page.profile?.enabled ? `Ativa quando: ${profileLabel(page)}` : 'Troca esta página quando um aplicativo estiver em primeiro plano.';
    profileEditor.append(profileToggle, profileInput, profileHint);

    const saveProfile = () => {
      page.profile = normalizeProfile({ enabled:profileCheck.checked, apps:profileInput.value });
      profileCheck.checked = page.profile.enabled;
      profileInput.disabled = !profileCheck.checked;
      persist(); render(); renderPageManager();
    };
    profileCheck.addEventListener('change', () => { profileInput.disabled = !profileCheck.checked; saveProfile(); });
    profileInput.addEventListener('change', saveProfile);

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
    const appearance = miniIconButton('grid', 'Editar layout');
    const up = miniIconButton('chevronUp', 'Mover para cima');
    const down = miniIconButton('chevronDown', 'Mover para baixo');
    const duplicate = miniIconButton('copy', 'Duplicar página');
    const remove = miniIconButton('trash', 'Excluir página', 'danger-mini');

    activate.addEventListener('click', () => { selectPageManually(page.id); renderPageManager(); });
    appearance.addEventListener('click', () => { els.pageDialog.close(); openLayoutEditor(page.id); });
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
      clone.profile = { enabled:false, apps:[] };
      state.pages.splice(index + 1, 0, clone);
      state.activePageId = clone.id; manualPageId = clone.id; autoProfilePageId = null;
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

    controls.append(iconSelect, activate, appearance, up, down, duplicate, remove);
    row.append(identity, profileEditor, controls);
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
  const page = { id: randomId(7), name, icon:'grid', profile:{ enabled:false, apps:[] }, layout:normalizeLayout({ preset:'minimal' }), buttons:[] };
  state.pages.push(page);
  state.activePageId = page.id; manualPageId = page.id; autoProfilePageId = null;
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
  if (action.type === 'system') return action.key === 'lock' ? 'Bloquear Windows' : 'Comando do sistema';
  if (action.type === 'integration') return integrationActionLabel(action);
  if (action.type === 'macro') {
    const count = action.steps?.length || 0;
    const seconds = Math.round(macroDurationHint(action) / 100) / 10;
    return `${count} ${count === 1 ? 'etapa' : 'etapas'}${seconds ? ` · ${seconds}s de espera` : ''}`;
  }
  return actionLabels[action.type] || action.type;
}

function buttonIconMarkup(button) {
  const app = resolvedAppIcon(button);
  if (app) return `<span class="app-icon" data-app-icon="${app.id}" title="${app.name}">${app.svg}</span>`;
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
  const appIcon = resolvedAppIcon(button);
  if (appIcon) node.dataset.appIcon = appIcon.id;
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
  const isMacro = kind === 'macro' || button.action?.type === 'macro';
  if (isToggle && button.state) node.classList.add('is-on');
  node.innerHTML = `<span class="deck-top"><span class="deck-icon">${buttonIconMarkup(button)}</span><span class="action-chip"></span></span><span class="deck-copy"><span class="deck-label"></span><span class="deck-subtitle"></span></span>${isToggle ? '<span class="toggle-track"><span></span></span>' : ''}${isMacro ? '<span class="macro-progress"><span class="macro-progress-bar"></span></span>' : ''}${editHandleMarkup()}`;
  const fallback = node.querySelector('.fallback-icon');
  if (fallback) fallback.textContent = button.icon || '⌘';
  node.querySelector('.action-chip').textContent = editing ? 'Editar' : (isToggle ? (button.state ? 'ON' : 'OFF') : (isMacro ? 'Macro' : (actionChips[button.action?.type] || 'Ação')));
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
  node.innerHTML = `<span class="deck-top"><span class="deck-icon">${buttonIconMarkup(button)}</span><span class="action-chip">${editing ? 'Editar' : 'Sistema'}</span></span><div class="status-widget"><div><span class="deck-label"></span><span class="status-live-copy" data-live-status>Desconectado</span><small class="status-latency" data-live-latency></small></div><span class="status-orb" data-live-orb></span></div>${editHandleMarkup()}`;
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

function bindMobileLongPress(node, button) {
  if (!touchDeck || editing) return;
  const mobile = currentMobilePreferences();
  if (mobile.locked || !mobile.longPressEdit) return;
  let timer = null; let startX = 0; let startY = 0; let fired = false;
  const clear = () => { if (timer) clearTimeout(timer); timer = null; };
  node.addEventListener('pointerdown', event => {
    if (event.pointerType && event.pointerType !== 'touch') return;
    if (event.target.closest('input,select,textarea,.media-controls button,.edit-handle')) return;
    startX = event.clientX; startY = event.clientY; fired = false; clear();
    timer = setTimeout(() => {
      fired = true; suppressClickUntil = performance.now() + 700;
      navigator.vibrate?.(18);
      editing = true; renderEditingState(); renderButtons();
      setTimeout(() => openButtonEditor(button.id), 20);
    }, 560);
  }, { passive:true });
  node.addEventListener('pointermove', event => { if (Math.hypot(event.clientX-startX,event.clientY-startY) > 12) clear(); }, { passive:true });
  node.addEventListener('pointerup', clear, { passive:true });
  node.addEventListener('pointercancel', clear, { passive:true });
  node.addEventListener('contextmenu', event => { if (fired || touchDeck) event.preventDefault(); });
}

function animatePageSwipe(delta) {
  if (!els.deckStage) return;
  const cls = delta > 0 ? 'page-swipe-next' : 'page-swipe-prev';
  els.deckStage.classList.remove('page-swipe-next','page-swipe-prev');
  void els.deckStage.offsetWidth;
  els.deckStage.classList.add(cls);
  setTimeout(() => els.deckStage?.classList.remove(cls), 220);
}

function navigatePageByDelta(delta) {
  const nextId = pageIdByDelta(state.pages, state.activePageId, delta);
  if (!nextId || nextId === state.activePageId) return;
  animatePageSwipe(delta);
  selectPageManually(nextId, { overrideMs:30_000 });
}

function bindMobileGestures() {
  if (!els.deckStage) return;
  els.deckStage.addEventListener('pointerdown', event => {
    const mobile = currentMobilePreferences();
    if (!touchDeck || editing || !mobile.swipePages) return;
    if (event.pointerType && event.pointerType !== 'touch') return;
    if (event.target.closest('input,select,textarea,.media-controls button,.edit-handle')) return;
    mobileGesture = { pointerId:event.pointerId, x:event.clientX, y:event.clientY, time:performance.now() };
  }, { passive:true });
  els.deckStage.addEventListener('pointerup', event => {
    if (!mobileGesture || event.pointerId !== mobileGesture.pointerId) return;
    const start = mobileGesture; mobileGesture = null;
    const delta = qualifiesAsSwipe(start, { x:event.clientX, y:event.clientY, time:performance.now() });
    if (!delta) return;
    suppressClickUntil = performance.now() + 550;
    navigatePageByDelta(delta);
  }, { passive:true });
  els.deckStage.addEventListener('pointercancel', () => { mobileGesture = null; }, { passive:true });
}

function renderControl(button, index) {
  let node;
  switch (normalizeKind(button.kind)) {
    case 'volume': node = renderVolumeWidget(button, index); break;
    case 'media_panel': node = renderMediaWidget(button, index); break;
    case 'status': node = renderStatusWidget(button, index); break;
    case 'clock': node = renderClockWidget(button, index); break;
    case 'macro':
    case 'toggle':
    case 'button':
    default: node = renderActionButton(button, index);
  }
  if (!editing) bindMobileLongPress(node, button);
  return node;
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
  document.querySelectorAll('[data-live-latency]').forEach(el => {
    el.textContent = online && Number.isFinite(status?.latencyMs) ? `${Math.round(status.latencyMs)} ms · ${device?.transport === 'local' ? 'LAN' : 'Cloud'}` : '';
  });
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
  if (touchDeck && currentMobilePreferences().locked) editing = false;
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
    renderIntegrationStatuses();
    return;
  }
  const status = deviceStatuses.get(device.id);
  const online = Boolean(status?.online && Date.now() - status.seenAt < 25_000);
  els.deviceName.textContent = device.name || 'PC';
  els.deviceStatusText.textContent = online ? (device.transport === 'local' ? `Local · ${Math.round(status?.latencyMs || 0)} ms` : 'Cloud · Online') : 'Offline';
  els.devicePill.classList.toggle('online', online);
  els.devicePill.classList.toggle('offline', !online);
  updateLiveWidgets();
  renderIntegrationStatuses(online ? status?.integrations : null);
}

function renderDeviceDialog() {
  const rows = state.devices.map(device => {
    const row = document.createElement('div');
    row.className = 'device-row';
    const status = deviceStatuses.get(device.id);
    const online = Boolean(status?.online && Date.now() - status.seenAt < 25_000);
    row.innerHTML = `<div class="device-meta"><strong></strong><span></span></div><div></div>`;
    row.querySelector('strong').textContent = device.name;
    row.querySelector('span').textContent = `${online ? '● Online' : '○ Offline'} · ${device.transport === 'local' ? 'LAN' : 'Cloud'} · ${device.platform || 'Windows'}${online && Number.isFinite(status?.latencyMs) ? ` · ${Math.round(status.latencyMs)} ms` : ''}`;
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
    empty.innerHTML = `<div class="device-meta"><strong>Nenhum computador pareado</strong><span>Abra o endereço local mostrado no Companion e faça o pareamento.</span></div>`;
    rows.push(empty);
  }
  els.deviceList.replaceChildren(...rows);
}

function updateEditorPreview() {
  els.editorPreview.style.setProperty('--preview-color', els.btnColor.value || '#6478ff');
  const previewControl = { id:editingButtonId || '', label:els.btnLabel.value.trim(), icon:els.btnIcon.value.trim(), appIcon:els.btnAppIcon?.value || 'auto' };
  const app = resolvedAppIcon(previewControl);
  els.previewIcon.classList.toggle('has-app-icon', Boolean(app));
  if (app) { els.previewIcon.innerHTML = `<span class="app-icon" data-app-icon="${app.id}">${app.svg}</span>`; els.previewIcon.title = app.name; }
  else { els.previewIcon.textContent = els.btnIcon.value.trim() || '⌘'; els.previewIcon.removeAttribute('title'); }
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
  if (els.btnAppIcon) els.btnAppIcon.value = source.appIcon || 'auto';
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
  const current = { id:editingButtonId || '', label:els.btnLabel.value.trim(), icon:els.btnIcon.value.trim(), appIcon:els.btnAppIcon?.value || 'auto', color:els.btnColor.value, size:els.btnSize.value };
  const preset = applyKindPreset(current, kind);
  els.btnLabel.value = preset.label || '';
  els.btnIcon.value = preset.icon || '⌘';
  if (els.btnAppIcon && !editingButtonId) els.btnAppIcon.value = preset.appIcon || 'auto';
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
  } else if (type === 'integration') {
    return createIntegrationEditor(action?.type === 'integration' ? action : null);
  } else if (type === 'media') {
    label.textContent = 'Comando';
    const select = document.createElement('select'); select.id = 'action-media';
    [['play_pause','Play / Pause'],['next','Próxima faixa'],['previous','Faixa anterior'],['volume_up','Volume +'],['volume_down','Volume −'],['volume_mute','Silenciar']].forEach(([value,text]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    });
    select.value = action?.type === type ? action.key : 'play_pause'; label.append(select);
  } else if (type === 'system') {
    label.textContent = 'Comando do Windows';
    const select = document.createElement('select'); select.id = 'action-system';
    [['lock','Bloquear computador']].forEach(([value,text]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    });
    select.value = action?.type === type ? action.key : 'lock'; label.append(select);
  }
  return label;
}

function createIntegrationEditor(action = null, compact = false) {
  const normalized = normalizeIntegrationAction(action || {});
  const wrapper = document.createElement('div');
  wrapper.className = `integration-action-editor ${compact ? 'compact' : ''}`.trim();
  const serviceLabel = document.createElement('label'); serviceLabel.textContent = 'Integração';
  const service = document.createElement('select'); service.className = 'integration-service';
  integrationServices().forEach(item => { const option=document.createElement('option'); option.value=item.id; option.textContent=`${item.name} · ${item.kind}`; service.append(option); });
  service.value = normalized.service; serviceLabel.append(service);
  const commandLabel = document.createElement('label'); commandLabel.textContent = 'Comando';
  const command = document.createElement('select'); command.className = 'integration-command'; commandLabel.append(command);
  const params = document.createElement('div'); params.className = 'integration-params';
  const hint = document.createElement('div'); hint.className = 'integration-editor-hint';
  wrapper.append(serviceLabel, commandLabel, params, hint);

  const refresh = (preserveAction = null) => {
    const descriptor = integrationDescriptor(service.value);
    command.replaceChildren(...Object.entries(descriptor?.commands || {}).map(([id,meta]) => { const option=document.createElement('option'); option.value=id; option.textContent=meta.label; return option; }));
    if (preserveAction && preserveAction.service === service.value && descriptor?.commands?.[preserveAction.command]) command.value = preserveAction.command;
    refreshParams(preserveAction);
  };
  const refreshParams = (preserveAction = null) => {
    const meta = integrationCommand(service.value, command.value);
    params.replaceChildren();
    (meta?.params || []).forEach(field => {
      const fieldLabel=document.createElement('label'); fieldLabel.textContent=field.label;
      const input=document.createElement('input'); input.className='integration-param'; input.dataset.param=field.key; input.type=field.type || 'text'; input.placeholder=field.placeholder || '';
      if (field.min != null) input.min=String(field.min); if (field.max != null) input.max=String(field.max); if (field.step != null) input.step=String(field.step);
      const value = preserveAction?.service === service.value && preserveAction?.command === command.value ? preserveAction.params?.[field.key] : undefined;
      if (value != null) input.value=String(value); else if (field.placeholder && field.type==='number') input.value=String(field.placeholder);
      fieldLabel.append(input); params.append(fieldLabel);
    });
    const descriptor=integrationDescriptor(service.value); hint.textContent = `${descriptor?.name || 'Integração'} · configure a conexão no Nexus Companion do Windows.`;
  };
  service.addEventListener('change', () => refresh(null));
  command.addEventListener('change', () => refreshParams(null));
  refresh(normalized);
  return wrapper;
}

function integrationActionFromContainer(container) {
  const service = container.querySelector('.integration-service')?.value;
  const command = container.querySelector('.integration-command')?.value;
  const meta = integrationCommand(service, command);
  const params = {};
  (meta?.params || []).forEach(field => {
    const input = container.querySelector(`[data-param="${field.key}"]`);
    params[field.key] = field.type === 'number' ? Number(input?.value) : String(input?.value || '').trim();
  });
  return { type:'integration', service, command, params };
}

function macroActionEditorFields(row, action = null) {
  const host = row.querySelector('.macro-step-fields');
  const type = row.querySelector('.macro-step-type').value;
  host.replaceChildren();
  const label = document.createElement('label');
  label.className = 'macro-step-field';
  if (type === 'open_url') {
    label.textContent = 'URL';
    const input = document.createElement('input'); input.dataset.role = 'value'; input.placeholder = 'https://...'; input.value = action?.type === type ? action.url : 'https://'; label.append(input);
  } else if (type === 'launch_app') {
    label.textContent = 'Aplicativo';
    const input = document.createElement('input'); input.dataset.role = 'value'; input.placeholder = 'C:\\Program Files\\Aplicativo\\app.exe'; input.value = action?.type === type ? action.path : ''; label.append(input);
  } else if (type === 'hotkey') {
    label.textContent = 'Atalho';
    const input = document.createElement('input'); input.dataset.role = 'value'; input.placeholder = 'CTRL+SHIFT+K'; input.value = action?.type === type ? (action.keys || []).join('+') : ''; label.append(input);
  } else if (type === 'integration') {
    host.append(createIntegrationEditor(action?.type === 'integration' ? action : null, true));
    return;
  } else if (type === 'media') {
    label.textContent = 'Comando';
    const select = document.createElement('select'); select.dataset.role = 'value';
    [['play_pause','Play / Pause'],['next','Próxima faixa'],['previous','Faixa anterior'],['volume_up','Volume +'],['volume_down','Volume −'],['volume_mute','Silenciar']].forEach(([value,text]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option);
    });
    select.value = action?.type === type ? action.key : 'play_pause'; label.append(select);
  } else if (type === 'system') {
    label.textContent = 'Sistema';
    const select = document.createElement('select'); select.dataset.role = 'value';
    const option = document.createElement('option'); option.value = 'lock'; option.textContent = 'Bloquear computador'; select.append(option);
    select.value = action?.type === type ? action.key : 'lock'; label.append(select);
  }
  host.append(label);
}

function refreshMacroStepNumbers(container) {
  container.querySelectorAll('.macro-step-row').forEach((row, index) => {
    row.dataset.index = String(index);
    const number = row.querySelector('.macro-step-number');
    if (number) number.textContent = String(index + 1).padStart(2, '0');
  });
}

function createMacroStepRow(step = null, index = 0) {
  const normalized = step || { id:randomId(6), when:'always', delayMs:0, action:{type:'open_url', url:'https://'} };
  const row = document.createElement('div');
  row.className = 'macro-step-row';
  row.dataset.stepId = normalized.id || randomId(6);
  row.innerHTML = `
    <div class="macro-step-head">
      <span class="macro-step-number">${String(index + 1).padStart(2,'0')}</span>
      <strong>Etapa</strong>
      <button type="button" class="macro-remove-step" aria-label="Remover etapa">×</button>
    </div>
    <div class="macro-step-grid">
      <label>Ação
        <select class="macro-step-type">
          <option value="open_url">Abrir URL</option>
          <option value="launch_app">Abrir aplicativo</option>
          <option value="hotkey">Atalho de teclado</option>
          <option value="media">Controle de mídia</option>
          <option value="system">Sistema</option>
          <option value="integration">Integração</option>
        </select>
      </label>
      <label>Executar quando
        <select class="macro-step-when">
          <option value="always">Sempre</option>
          <option value="previous_success">Etapa anterior funcionou</option>
          <option value="previous_failed">Etapa anterior falhou</option>
        </select>
      </label>
      <label>Aguardar antes
        <div class="macro-delay-wrap"><input class="macro-step-delay" type="number" min="0" max="10000" step="100" value="0"><span>ms</span></div>
      </label>
    </div>
    <div class="macro-step-fields"></div>`;
  row.querySelector('.macro-step-type').value = normalized.action?.type || 'open_url';
  row.querySelector('.macro-step-when').value = normalized.when || 'always';
  row.querySelector('.macro-step-delay').value = String(Math.max(0, Math.min(10000, Number(normalized.delayMs) || 0)));
  macroActionEditorFields(row, normalized.action);
  row.querySelector('.macro-step-type').addEventListener('change', () => macroActionEditorFields(row, null));
  row.querySelector('.macro-remove-step').addEventListener('click', () => {
    const container = row.closest('.macro-steps');
    if (container.querySelectorAll('.macro-step-row').length <= 1) { toast('A macro precisa ter pelo menos uma etapa.', 'error'); return; }
    row.remove(); refreshMacroStepNumbers(container);
  });
  return row;
}

function renderMacroEditor(action = null) {
  const macro = action?.type === 'macro' ? action : { type:'macro', stopOnError:true, steps:[{id:randomId(6), when:'always', delayMs:0, action:{type:'open_url', url:'https://'}}] };
  const wrapper = document.createElement('div'); wrapper.className = 'macro-editor';
  const intro = document.createElement('div'); intro.className = 'widget-editor-note'; intro.textContent = 'Execute até 20 ações em ordem. Atrasos e condições são validados pelo Companion; macros aninhadas e comandos de shell não são permitidos.';
  const policy = document.createElement('label'); policy.className = 'macro-policy';
  const stop = document.createElement('input'); stop.type = 'checkbox'; stop.id = 'macro-stop-on-error'; stop.checked = macro.stopOnError !== false;
  const policyCopy = document.createElement('span'); policyCopy.innerHTML = '<strong>Parar ao encontrar erro</strong><small>Desative para permitir etapas condicionais após uma falha.</small>';
  policy.append(stop, policyCopy);
  const steps = document.createElement('div'); steps.className = 'macro-steps';
  (macro.steps?.length ? macro.steps : [{id:randomId(6), when:'always', delayMs:0, action:{type:'open_url', url:'https://'}}]).forEach((step, index) => steps.append(createMacroStepRow(step, index)));
  const add = document.createElement('button'); add.type = 'button'; add.className = 'ghost-button macro-add-step'; add.textContent = '+ Adicionar etapa';
  add.addEventListener('click', () => {
    if (steps.querySelectorAll('.macro-step-row').length >= 20) { toast('Limite de 20 etapas por macro.', 'error'); return; }
    steps.append(createMacroStepRow(null, steps.children.length));
    steps.lastElementChild.scrollIntoView({ behavior:'smooth', block:'nearest' });
  });
  wrapper.append(intro, policy, steps, add);
  return wrapper;
}

function macroActionFromRow(row) {
  const type = row.querySelector('.macro-step-type').value;
  const value = row.querySelector('[data-role="value"]')?.value?.trim?.() ?? row.querySelector('[data-role="value"]')?.value;
  if (type === 'open_url') return { type, url:value };
  if (type === 'launch_app') return { type, path:value, args:[] };
  if (type === 'hotkey') return { type, keys:String(value || '').toUpperCase().split('+').map(v => v.trim()).filter(Boolean) };
  if (type === 'integration') return integrationActionFromContainer(row.querySelector('.integration-action-editor'));
  return { type, key:value };
}

function macroFromForm() {
  const rows = [...els.actionFields.querySelectorAll('.macro-step-row')];
  return {
    type:'macro',
    stopOnError:Boolean($('#macro-stop-on-error')?.checked),
    steps:rows.map(row => ({
      id:row.dataset.stepId || randomId(6),
      when:row.querySelector('.macro-step-when').value,
      delayMs:Number(row.querySelector('.macro-step-delay').value) || 0,
      action:macroActionFromRow(row)
    }))
  };
}

function renderActionFields(source = null) {
  const kind = normalizeKind(els.btnKind.value);
  els.actionFields.replaceChildren();
  const action = source?.action || source;
  const actionKinds = new Set(['button','toggle']);
  els.actionTypeLabel.classList.toggle('hidden', !actionKinds.has(kind));
  els.actionSectionTitle.textContent = kind === 'macro' ? 'Automação' : (actionKinds.has(kind) ? 'Ação' : 'Widget');
  if (actionKinds.has(kind)) {
    els.actionFields.append(actionInputFields(action));
    return;
  }
  if (kind === 'macro') {
    els.actionFields.append(renderMacroEditor(action));
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
  if (type === 'integration') return integrationActionFromContainer(els.actionFields.querySelector('.integration-action-editor'));
  if (type === 'system') return { type, key: $('#action-system').value };
  return { type, key: $('#action-media').value };
}

function controlFromForm() {
  const kind = normalizeKind(els.btnKind.value);
  const record = {
    id:editingButtonId || randomId(8), kind, label:els.btnLabel.value.trim(), icon:els.btnIcon.value.trim() || '⌘', appIcon:els.btnAppIcon?.value || 'auto',
    color:els.btnColor.value, size:els.btnSize.value
  };
  if (kind === 'button' || kind === 'toggle') {
    record.action = actionFromForm();
    createCommand(record.action, 'validation');
  }
  if (kind === 'macro') {
    record.action = macroFromForm();
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
  const status = deviceStatuses.get(device.id);
  const online = Boolean(status?.online && Date.now() - status.seenAt < 25_000);
  if (!connection || !online) { toast('O computador está offline ou reconectando.', 'error'); return null; }
  if (device.transport !== 'local' && !connection?.channel?.joined) { toast('O Cloud Relay está reconectando.', 'error'); return null; }
  return { device, connection };
}

async function sendLocalCommand(device, connection, action) {
  const id = randomId(12);
  const command = createCommand(action, id);
  const response = await sendLocalMessage(device, connection.key, command);
  if (response.type !== 'ack' || response.body?.commandId !== id) throw new Error('Confirmação local inválida');
  return response.body;
}

async function broadcastAction(action, options = {}) {
  const target = await connectionForAction(options);
  if (!target) return null;
  const { device, connection } = target;
  if (device.transport === 'local') return sendLocalCommand(device, connection, action);
  const id = randomId(12);
  const command = createCommand(action, id);
  const envelope = await encryptJson(command, connection.key, `nexus:${device.roomId}:v1`);
  connection.channel.broadcast(envelope);
  return id;
}

async function executeAction(action, label = 'Controle', options = {}) {
  try {
    const result = await broadcastAction(action, options);
    if (!result) return false;
    const ack = typeof result === 'string' ? await waitForAck(result, 6000) : result;
    toast(ack.ok ? `${label}: executado` : `${label}: ${ack.error || 'falhou'}`, ack.ok ? 'success' : 'error');
    return Boolean(ack.ok);
  } catch (error) { toast(error.message || 'Falha ao executar ação', 'error'); return false; }
}

async function sendMediaBurst(key, count, label = 'Volume') {
  if (!count) return;
  const target = await connectionForAction({ allowOfflineVisual:true });
  if (!target) return;
  try {
    for (let i = 0; i < count; i += 1) {
      if (target.device.transport === 'local') {
        await sendLocalCommand(target.device, target.connection, { type:'media', key });
      } else {
        const id = randomId(12);
        const command = createCommand({ type:'media', key }, id);
        const envelope = await encryptJson(command, target.connection.key, `nexus:${target.device.roomId}:v1`);
        target.connection.channel.broadcast(envelope);
      }
      if (i < count - 1) await new Promise(resolve => setTimeout(resolve, 45));
    }
    toast(`${label}: ajustado`, 'success');
  } catch (error) { toast(error.message || 'Falha ao ajustar volume', 'error'); }
}

async function executeMacro(button) {
  const card = document.querySelector(`.deck-button[data-button-id="${CSS.escape(button.id)}"]`);
  const bar = card?.querySelector('.macro-progress-bar');
  const subtitle = card?.querySelector('.deck-subtitle');
  const steps = button.action?.steps || [];
  const estimatedMs = Math.max(1200, macroDurationHint(button.action) + steps.length * 450);
  let progress = 0;
  card?.classList.add('macro-running');
  if (bar) bar.style.width = '4%';
  if (subtitle) subtitle.textContent = `Executando 0/${steps.length}`;
  const started = performance.now();
  const timer = setInterval(() => {
    const elapsed = performance.now() - started;
    progress = Math.min(88, Math.max(progress, Math.round((elapsed / estimatedMs) * 88)));
    if (bar) bar.style.width = `${progress}%`;
    if (subtitle && steps.length) subtitle.textContent = `Executando · ${Math.min(steps.length, Math.max(1, Math.ceil((progress / 88) * steps.length)))}/${steps.length}`;
  }, 180);
  try {
    const result = await broadcastAction(button.action);
    if (!result) return false;
    const ack = typeof result === 'string' ? await waitForAck(result, Math.max(30_000, macroDurationHint(button.action) + 20_000)) : result;
    clearInterval(timer);
    if (bar) bar.style.width = '100%';
    const report = ack.report;
    const completed = report?.steps?.filter(step => step.ok && !step.skipped).length ?? (ack.ok ? steps.length : 0);
    if (subtitle) subtitle.textContent = ack.ok ? `${completed}/${steps.length} etapas concluídas` : (ack.error || 'Macro interrompida');
    toast(ack.ok ? `${button.label}: macro concluída` : `${button.label}: ${ack.error || 'macro falhou'}`, ack.ok ? 'success' : 'error');
    return Boolean(ack.ok);
  } catch (error) {
    clearInterval(timer);
    if (subtitle) subtitle.textContent = error.message || 'Falha na macro';
    toast(error.message || 'Falha ao executar macro', 'error');
    return false;
  } finally {
    setTimeout(() => {
      card?.classList.remove('macro-running');
      if (bar) bar.style.width = '0%';
      if (subtitle) subtitle.textContent = subtitleFor(button.action);
    }, 900);
  }
}

async function executeButton(button) {
  if (button.action?.type === 'macro' || normalizeKind(button.kind) === 'macro') return executeMacro(button);
  return executeAction(button.action, button.label);
}

function waitForAck(commandId, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendingAcks.delete(commandId); reject(new Error('O PC não confirmou o comando')); }, timeoutMs);
    pendingAcks.set(commandId, result => { clearTimeout(timer); pendingAcks.delete(commandId); resolve(result); });
  });
}

async function pollLocalDevice(device, connection) {
  const started = performance.now();
  try {
    const message = await sendLocalMessage(device, connection.key, createPing());
    if (message.type !== 'status') throw new Error('Status local inválido');
    deviceStatuses.set(device.id, { ...message.body, online:true, latencyMs:performance.now() - started, seenAt:Date.now() });
    if (device.id === activeDevice()?.id) applySmartProfile(message.body);
  } catch {
    const previous = deviceStatuses.get(device.id) || {};
    deviceStatuses.set(device.id, { ...previous, online:false, seenAt:Date.now() });
  }
  renderDeviceState();
  if (els.deviceDialog.open) renderDeviceDialog();
}

async function connectLocalDevice(device) {
  if (deviceChannels.has(device.id)) return;
  let key = null;
  if (supportsSecureLocalCrypto() && device.localSecurity !== 'lan-token') {
    try { key = await importDeviceKey(device.secret); } catch { key = null; }
  }
  const connection = { transport:'local', key, timer:null };
  deviceChannels.set(device.id, connection);
  await pollLocalDevice(device, connection);
  connection.timer = setInterval(() => pollLocalDevice(device, connection), 5000);
}

async function connectCloudDevice(device) {
  if (!cloudConfig?.configured || deviceChannels.has(device.id)) return;
  const key = await importDeviceKey(device.secret);
  const channel = new RealtimeChannel(cloudConfig, `nexus-device-${device.roomId}`, async payload => {
    try {
      const message = await decryptJson(payload, key, `nexus:${device.roomId}:v1`);
      if (message.type === 'status') {
        deviceStatuses.set(device.id, { ...message.body, online:true, seenAt:Date.now() });
        if (device.id === activeDevice()?.id) applySmartProfile(message.body);
        renderDeviceState();
        if (els.deviceDialog.open) renderDeviceDialog();
      } else if (message.type === 'ack') pendingAcks.get(message.body.commandId)?.(message.body);
    } catch {}
  }, stateName => {
    if (stateName === 'disconnected') {
      const status = deviceStatuses.get(device.id);
      if (status) deviceStatuses.set(device.id, { ...status, online:false, seenAt:Date.now() });
      renderDeviceState();
    }
  });
  deviceChannels.set(device.id, { transport:'cloud', channel, key });
  channel.start().catch(() => {});
}

async function connectDevice(device) {
  if (device.transport === 'local') return connectLocalDevice(device);
  return connectCloudDevice(device);
}

async function connectAllDevices() { for (const device of state.devices) await connectDevice(device); }

async function pairDevice(code) {
  if (localConfig?.configured) {
    const device = await pairLocalDevice(code, { name:'iPad Nexus Deck', platform:navigator.platform || 'iPadOS / Safari' });
    state.devices = state.devices.filter(d => d.id !== device.id);
    state.devices.push(device); state.activeDeviceId = device.id; persist();
    await connectDevice(device); render(); return device;
  }
  if (!cloudConfig?.configured) throw new Error('Abra o endereço local exibido no Nexus Companion para parear sem Supabase.');
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
  device.transport = 'cloud';
  state.devices = state.devices.filter(d => d.id !== device.id);
  state.devices.push(device); state.activeDeviceId = device.id; persist();
  await connectDevice(device); render(); return device;
}

async function loadLocalConfig() {
  try {
    const info = await getLocalInfo();
    localConfig = { configured:true, ...info };
    if (els.localStatus) { els.localStatus.textContent = supportsSecureLocalCrypto() ? 'Disponível · AES-GCM' : 'Disponível · LAN'; els.localStatus.style.color = '#42d98b'; }
    if (els.localUrl) els.localUrl.textContent = location.origin;
    await connectAllDevices();
  } catch {
    localConfig = { configured:false };
    if (els.localStatus) { els.localStatus.textContent = 'Abra pelo Companion'; els.localStatus.style.color = '#9aa4b4'; }
    if (els.localUrl) els.localUrl.textContent = 'Use o endereço LAN mostrado no Windows';
  }
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

els.editToggle.addEventListener('click', () => {
  if (touchDeck && currentMobilePreferences().locked) { applyAppearance(); els.settingsDialog.showModal(); toast('Edição bloqueada. Desative “Bloquear edição” nos Ajustes.'); return; }
  editing = !editing; renderEditingState(); renderButtons();
});
els.addButton.addEventListener('click', () => openButtonEditor());
els.btnKind.addEventListener('change', editorKindPreset);
els.btnActionType.addEventListener('change', () => renderActionFields({ action:null }));
[els.btnLabel, els.btnIcon, els.btnColor, els.btnSize].forEach(input => input.addEventListener('input', updateEditorPreview));
els.btnAppIcon?.addEventListener('change', updateEditorPreview);
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
els.layoutOpen?.addEventListener('click', () => openLayoutEditor(state.activePageId));
els.layoutClose?.addEventListener('click', cancelLayoutEditor);
els.layoutDialog?.addEventListener('close', () => { if (layoutDraft) { layoutDraft=null; layoutEditingPageId=null; applyAppearance(); } });
els.layoutCancel?.addEventListener('click', cancelLayoutEditor);
els.layoutSave?.addEventListener('click', saveLayoutEditor);
els.layoutApplyAll?.addEventListener('click', applyLayoutToAllPages);
els.layoutReset?.addEventListener('click', () => { if (!layoutDraft) return; layoutDraft=applyPreset(layoutDraft.preset); fillLayoutControls(); applyLayoutToDocument(layoutDraft); });
els.savedLayoutSave?.addEventListener('click', saveCustomLayout);
[els.layoutDensity,els.layoutColumns,els.layoutIconSize,els.layoutTextAlign,els.layoutCardStyle,els.layoutDock,els.layoutHeader,els.layoutTheme].forEach(input => input?.addEventListener('change', updateLayoutDraftFromControls));
els.layoutRadius?.addEventListener('input', updateLayoutDraftFromControls);
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
els.mobileImmersiveToggle?.addEventListener('change', () => setMobilePreference('immersive', els.mobileImmersiveToggle.checked));
els.mobileLockToggle?.addEventListener('change', () => {
  setMobilePreference('locked', els.mobileLockToggle.checked);
  toast(els.mobileLockToggle.checked ? 'Edição bloqueada no iPad.' : 'Edição desbloqueada.', 'success');
});
els.mobileSwipeToggle?.addEventListener('change', () => setMobilePreference('swipePages', els.mobileSwipeToggle.checked));
els.mobileLongpressToggle?.addEventListener('change', () => setMobilePreference('longPressEdit', els.mobileLongpressToggle.checked));
els.mobileScale?.addEventListener('change', () => setMobilePreference('scale', els.mobileScale.value));
els.mobilePortraitColumns?.addEventListener('change', () => setMobilePreference('portraitColumns', Number(els.mobilePortraitColumns.value)));
els.mobileLandscapeColumns?.addEventListener('change', () => setMobilePreference('landscapeColumns', Number(els.mobileLandscapeColumns.value)));

els.settingsOpen.addEventListener('click', () => { applyAppearance(); els.settingsDialog.showModal(); });
els.settingsClose.addEventListener('click', () => els.settingsDialog.close());
els.accentPicker.addEventListener('click', event => {
  const button = event.target.closest('[data-accent]'); if (!button) return;
  state.preferences = { ...(state.preferences || {}), accent:button.dataset.accent }; persist(); applyAppearance();
});
els.smartProfilesToggle?.addEventListener('change', () => {
  state.preferences = { ...(state.preferences || {}), smartProfiles:els.smartProfilesToggle.checked };
  if (!els.smartProfilesToggle.checked && autoProfilePageId) { autoProfilePageId = null; if (state.pages.some(page => page.id === manualPageId)) state.activePageId = manualPageId; }
  persist(); render(); toast(els.smartProfilesToggle.checked ? 'Perfis inteligentes ativados.' : 'Perfis inteligentes pausados.', 'success');
});
els.exportDeck?.addEventListener('click', () => {
  const payload = exportPortableState(state);
  downloadJSON(`nexus-deck-backup-${new Date().toISOString().slice(0,10)}.json`, payload);
  toast('Backup V2 exportado com verificação de integridade.', 'success');
});
els.importDeck?.addEventListener('click', () => els.importDeckFile?.click());
els.importDeckFile?.addEventListener('change', async () => {
  const file = els.importDeckFile.files?.[0];
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const summary = backupSummary(payload);
    if (!confirm(`Importar este backup?\n\n${summary.pages} página(s) · ${summary.controls} controle(s) · ${summary.macros} macro(s) · ${summary.profiles} perfil(is) automático(s)\n\nOs computadores pareados neste iPad serão preservados.`)) return;
    state = importPortableState(state, payload); manualPageId = state.activePageId; autoProfilePageId = null; profileOverrideUntil = 0; persist(); render();
    toast('Deck importado. Integridade validada e dispositivos preservados.', 'success');
  } catch (error) { toast(error.message || 'Falha ao importar backup', 'error'); }
  finally { els.importDeckFile.value = ''; }
});


els.deckDiagnostic?.addEventListener('click', () => {
  const report = buildDeckDiagnostic(); renderDeckDiagnostic(report); toast('Diagnóstico rápido concluído.', 'success');
});
els.deckDiagnosticExport?.addEventListener('click', () => {
  const report = lastDeckDiagnostic || buildDeckDiagnostic(); renderDeckDiagnostic(report);
  downloadJSON(`nexus-deck-diagnostico-${new Date().toISOString().slice(0,10)}.json`, report); toast('Diagnóstico exportado.', 'success');
});
els.onboardingOpen?.addEventListener('click', () => { els.settingsDialog?.close(); openOnboarding(); });
els.onboardingClose?.addEventListener('click', finishOnboarding);
els.onboardingPrev?.addEventListener('click', () => { onboardingStep = Math.max(0,onboardingStep-1); renderOnboarding(); });
els.onboardingNext?.addEventListener('click', () => {
  const total = document.querySelectorAll('[data-onboarding-step]').length || 4;
  if (onboardingStep >= total - 1) { finishOnboarding(); return; }
  onboardingStep += 1; renderOnboarding();
});

els.resetData.addEventListener('click', () => {
  if (!confirm('Apagar todos os perfis, controles e dispositivos deste iPad?')) return;
  for (const item of deviceChannels.values()) { item.channel?.stop?.(); if (item.timer) clearInterval(item.timer); }
  deviceChannels.clear(); deviceStatuses.clear(); state = resetState(); manualPageId = state.activePageId; autoProfilePageId = null; profileOverrideUntil = 0; persist(); render(); els.settingsDialog.close(); toast('Dados locais apagados.');
});

bindMobileGestures();
window.addEventListener('resize', () => { clearTimeout(mobileResizeTimer); mobileResizeTimer=setTimeout(() => { updateMobileEnvironment(); }, 90); }, { passive:true });
window.addEventListener('orientationchange', () => setTimeout(updateMobileEnvironment, 120));

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
setInterval(() => renderDeviceState(), 5000);
render();
await loadLocalConfig();
loadCloudConfig();
if (localStorage.getItem(ONBOARDING_KEY) !== 'done') setTimeout(openOnboarding, 250);
