const INTERNAL_PASSWORD = '205431';
const STORAGE_KEY = 'power-controle-producao-v1';
const SESSION_KEY = 'power-controle-session';

const seedModels = [
  { id: 'autoclave', name: 'Autoclave', price: 1 },
  { id: 'bainha', name: 'Bainha', price: 1 },
  { id: 'coleira-mica', name: 'Coleira de mica', price: 1 },
  { id: 'coleira-ceramica', name: 'Coleira ceramica', price: 1 },
  { id: 'placa-mica', name: 'Placa so mica', price: 1 },
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
let state = loadState();
let chartMetric = 'pieces';
let chartDates = [];
let toastTimer;

function getTodayISO() {
  const date = new Date();
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.models) && Array.isArray(saved.entries)) return saved;
  } catch (_) { /* usa os dados iniciais quando o navegador tiver um backup inválido */ }
  return {
    models: seedModels.map((model) => ({ ...model })),
    entries: [{ id: makeId(), date: getTodayISO(), order: '001', modelId: 'autoclave', quantity: 10 }],
  };
}

function makeId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(value) {
  return currency.format(Number(value) || 0);
}

function formatDate(dateString, options = {}) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(`${dateString}T12:00:00`));
}

function shortDate(dateString) {
  return formatDate(dateString, { day: '2-digit', month: '2-digit' });
}

function fullDate(dateString) {
  return formatDate(dateString, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
}

function getModel(modelId) {
  return state.models.find((model) => model.id === modelId);
}

function entryValue(entry) {
  const model = getModel(entry.modelId);
  return (Number(entry.quantity) || 0) * (Number(model?.price) || 0);
}

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

function showApp() {
  $('#login-screen').hidden = true;
  $('#app-shell').hidden = false;
  renderAll();
}

function showLogin() {
  $('#app-shell').hidden = true;
  $('#login-screen').hidden = false;
  $('#password').value = '';
  $('#password').focus();
}

function sumEntries(entries) {
  return entries.reduce((total, entry) => ({
    pieces: total.pieces + Number(entry.quantity || 0),
    value: total.value + entryValue(entry),
  }), { pieces: 0, value: 0 });
}

function dateFromISO(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function isoFromDate(date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const difference = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + difference);
  return result;
}

function rangeLabel(start, end) {
  return `${shortDate(isoFromDate(start))} - ${shortDate(isoFromDate(end))}`;
}

function getPeriodStats(dateString, period) {
  const date = dateFromISO(dateString);
  let start;
  let end;
  if (period === 'today') {
    start = new Date(date); end = new Date(date);
  } else if (period === 'week') {
    start = startOfWeek(date); end = new Date(start); end.setDate(end.getDate() + 6);
  } else {
    start = new Date(date.getFullYear(), date.getMonth(), 1, 12); end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12);
  }
  const entries = state.entries.filter((entry) => {
    const current = dateFromISO(entry.date);
    return current >= start && current <= end;
  });
  return { entries, totals: sumEntries(entries), start, end };
}

function getPreviousPeriod(dateString, period) {
  const current = getPeriodStats(dateString, period);
  const duration = Math.round((current.end - current.start) / 86400000) + 1;
  const end = new Date(current.start);
  end.setDate(end.getDate() - 1);
  const start = new Date(end);
  start.setDate(start.getDate() - (duration - 1));
  const entries = state.entries.filter((entry) => {
    const currentDate = dateFromISO(entry.date);
    return currentDate >= start && currentDate <= end;
  });
  return { entries, totals: sumEntries(entries), start, end };
}

function comparisonLabel(current, previous) {
  if (!previous.entries.length) return 'sem base de comparação';
  if (!current.totals.pieces && !previous.totals.pieces) return 'sem produção nos períodos';
  const delta = previous.totals.pieces ? ((current.totals.pieces - previous.totals.pieces) / previous.totals.pieces) * 100 : 100;
  const arrow = delta >= 0 ? '↑' : '↓';
  return `${arrow} ${Math.abs(Math.round(delta))}% vs período anterior`;
}

function renderStat(period, piecesId, valueId, detailId, badgeId, today) {
  const stats = getPeriodStats(today, period);
  const previous = getPreviousPeriod(today, period);
  const uniqueOrders = new Set(stats.entries.map((entry) => entry.order)).size;
  $(`#${piecesId}`).textContent = number.format(stats.totals.pieces);
  $(`#${valueId}`).textContent = formatMoney(stats.totals.value);
  $(`#${detailId}`).textContent = period === 'today'
    ? `${formatDate(today, { weekday: 'short', day: '2-digit', month: '2-digit' })} · ${uniqueOrders} pedido${uniqueOrders === 1 ? '' : 's'}`
    : `${stats.entries.length} lançamento${stats.entries.length === 1 ? '' : 's'} · ${rangeLabel(stats.start, stats.end)}`;
  $(`#${badgeId}`).textContent = comparisonLabel(stats, previous);
  $(`#${badgeId}`).classList.toggle('badge-positive', Boolean(previous.entries.length && stats.entries.length));
}

function renderDashboard() {
  const today = getTodayISO();
  $('#dashboard-date').textContent = fullDate(today);
  renderStat('today', 'today-pieces', 'today-value', 'today-detail', 'today-badge', today);
  renderStat('week', 'week-pieces', 'week-value', 'week-detail', 'week-badge', today);
  renderStat('month', 'month-pieces', 'month-value', 'month-detail', 'month-badge', today);

  const dates = [];
  const end = dateFromISO(today);
  for (let offset = 20; offset >= 0; offset -= 1) {
    const date = new Date(end);
    date.setDate(date.getDate() - offset);
    dates.push(isoFromDate(date));
  }
  chartDates = dates;
  const values = dates.map((date) => {
    const entries = state.entries.filter((entry) => entry.date === date);
    const totals = sumEntries(entries);
    return chartMetric === 'pieces' ? totals.pieces : totals.value;
  });
  const max = Math.max(...values, chartMetric === 'pieces' ? 1 : 10);
  const latestIndex = values.reduce((last, value, index) => value > 0 ? index : last, -1);
  const latestDate = latestIndex >= 0 ? dates[latestIndex] : today;
  const latestEntries = state.entries.filter((entry) => entry.date === latestDate);
  const latestTotals = sumEntries(latestEntries);
  showChartSummary(latestDate);
  $('#bar-chart').innerHTML = dates.map((date, index) => {
    const current = values[index];
    const height = current ? Math.max(7, (current / max) * 100) : 2;
    const label = index === 0 || index === 6 || index === 13 || index === 20 ? shortDate(date) : '';
    const isActive = current > 0;
    return `<button class="bar-item ${isActive ? 'is-active' : ''}" data-chart-date="${date}" type="button" title="${shortDate(date)}: ${chartMetric === 'pieces' ? number.format(current) + ' peças' : formatMoney(current)}"><span class="bar" style="height:${height}%"><span class="sr-only">${shortDate(date)}: ${chartMetric === 'pieces' ? number.format(current) + ' peças' : formatMoney(current)}</span></span><span class="bar-label">${label}</span></button>`;
  }).join('');

  const currentWeek = getPeriodStats(today, 'week');
  const previousWeek = getPreviousPeriod(today, 'week');
  $('#comparison-copy').textContent = previousWeek.entries.length
    ? `Esta semana tem ${number.format(currentWeek.totals.pieces)} peças e ${formatMoney(currentWeek.totals.value)}. No período anterior foram ${number.format(previousWeek.totals.pieces)} peças e ${formatMoney(previousWeek.totals.value)} — ${comparisonLabel(currentWeek, previousWeek).replace('vs período anterior', 'em relação à semana passada')}.`
    : 'Ainda não existe uma semana anterior com dados para comparar. Registre novos lançamentos e acompanhe a evolução automaticamente.';

  const monthStats = getPeriodStats(today, 'month');
  $('#model-month-total').textContent = `${number.format(monthStats.totals.pieces)} peças`;
  const breakdown = state.models.map((model) => {
    const quantity = monthStats.entries.filter((entry) => entry.modelId === model.id).reduce((total, entry) => total + Number(entry.quantity || 0), 0);
    return { model, quantity };
  }).filter((item) => item.quantity > 0).sort((a, b) => b.quantity - a.quantity);
  const maxModel = Math.max(...breakdown.map((item) => item.quantity), 1);
  $('#model-breakdown').innerHTML = breakdown.length ? breakdown.map(({ model, quantity }) => `<div class="model-row"><span class="model-name">${escapeHtml(model.name)}</span><div class="progress-track"><div class="progress-fill" style="width:${Math.max(8, quantity / maxModel * 100)}%"></div></div><span class="model-total">${number.format(quantity)} peças</span></div>`).join('') : '<p class="muted">Ainda não há produção registrada neste mês.</p>';

  const grouped = new Map();
  [...state.entries].sort((a, b) => b.date.localeCompare(a.date)).forEach((entry) => {
    const group = grouped.get(entry.date) || { orders: new Set(), pieces: 0, value: 0 };
    group.orders.add(entry.order); group.pieces += Number(entry.quantity || 0); group.value += entryValue(entry);
    grouped.set(entry.date, group);
  });
  const latest = [...grouped.entries()].slice(0, 6);
  $('#latest-days-body').innerHTML = latest.length ? latest.map(([date, group]) => `<tr><td>${formatDate(date, { weekday: 'short', day: '2-digit', month: '2-digit' })}</td><td>${group.orders.size}</td><td>${number.format(group.pieces)}</td><td>${formatMoney(group.value)}</td></tr>`).join('') : '<tr><td colspan="4" class="empty-state">Sem lançamentos</td></tr>';
}

function showChartSummary(date) {
  const entries = state.entries.filter((entry) => entry.date === date);
  const totals = sumEntries(entries);
  $('#chart-summary').textContent = entries.length
    ? `${formatDate(date, { weekday: 'short', day: '2-digit', month: '2-digit' })}  ·  ${number.format(totals.pieces)} peças  ·  ${formatMoney(totals.value)}`
    : `${formatDate(date, { weekday: 'short', day: '2-digit', month: '2-digit' })}  ·  sem produção registrada`;
}

function renderLaunchOptions() {
  const select = $('#launch-model');
  const current = select.value;
  select.innerHTML = state.models.length
    ? state.models.map((model) => `<option value="${model.id}">${escapeHtml(model.name)} · ${formatMoney(model.price)}</option>`).join('')
    : '<option value="">Cadastre um modelo primeiro</option>';
  if (state.models.some((model) => model.id === current)) select.value = current;
  $('#launch-date').value ||= getTodayISO();
  updateLaunchTotal();
}

function renderDayEntries() {
  const date = $('#launch-date').value || getTodayISO();
  const entries = state.entries.filter((entry) => entry.date === date).sort((a, b) => b.id.localeCompare(a.id));
  const total = sumEntries(entries);
  $('#day-total').textContent = `Total do dia: ${number.format(total.pieces)}`;
  $('#day-entries-body').innerHTML = entries.length ? entries.map((entry) => {
    const model = getModel(entry.modelId);
    return `<tr><td>${escapeHtml(entry.order)}</td><td>${escapeHtml(model?.name || 'Modelo removido')}</td><td>${number.format(entry.quantity)}</td><td>${formatMoney(model?.price || 0)}</td></tr>`;
  }).join('') : '<tr><td colspan="4" class="empty-state">Nenhum lançamento para este dia</td></tr>';
}

function updateLaunchTotal() {
  const model = getModel($('#launch-model').value);
  const quantity = Number($('#quantity').value || 0);
  $('#launch-total').textContent = formatMoney(quantity * Number(model?.price || 0));
}

function renderModels() {
  $('#models-body').innerHTML = state.models.map((model) => `<tr><td>${escapeHtml(model.name)}</td><td><input class="price-input" data-model-price="${model.id}" type="number" min="0" step="0.01" value="${Number(model.price).toFixed(2)}" aria-label="Preço de ${escapeHtml(model.name)}"></td><td><button class="delete-model" data-delete-model="${model.id}" type="button">Excluir</button></td></tr>`).join('');
  $('#empty-models').hidden = state.models.length > 0;
}

function renderBackup() {
  $('#backup-text').value = JSON.stringify({ models: state.models, entries: state.entries }, null, 2);
}

function renderAll() {
  renderDashboard();
  renderLaunchOptions();
  renderDayEntries();
  renderModels();
  renderBackup();
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function isValidBackup(backup) {
  return backup && Array.isArray(backup.models) && Array.isArray(backup.entries)
    && backup.models.every((model) => model && typeof model.id === 'string' && typeof model.name === 'string' && Number.isFinite(Number(model.price)))
    && backup.entries.every((entry) => entry && typeof entry.id === 'string' && typeof entry.date === 'string' && typeof entry.order === 'string' && typeof entry.modelId === 'string' && Number.isFinite(Number(entry.quantity)) && Number(entry.quantity) >= 0);
}

function switchTab(tab) {
  $$('.tab-button').forEach((button) => button.classList.toggle('is-active', button.dataset.tab === tab));
  $$('.tab-panel').forEach((panel) => panel.classList.toggle('is-visible', panel.dataset.panel === tab));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

$('#login-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const valid = $('#password').value === INTERNAL_PASSWORD;
  $('#login-error').hidden = valid;
  if (!valid) { $('#password').select(); return; }
  localStorage.setItem(SESSION_KEY, 'authorized');
  showApp();
});

$('#toggle-password').addEventListener('click', () => {
  const password = $('#password');
  password.type = password.type === 'password' ? 'text' : 'password';
  $('#toggle-password').setAttribute('aria-label', password.type === 'password' ? 'Mostrar senha' : 'Ocultar senha');
});

$('#exit-button').addEventListener('click', () => {
  localStorage.removeItem(SESSION_KEY);
  showLogin();
});

$$('.tab-button').forEach((button) => button.addEventListener('click', () => switchTab(button.dataset.tab)));
$$('.segment-button').forEach((button) => button.addEventListener('click', () => {
  chartMetric = button.dataset.metric;
  $$('.segment-button').forEach((item) => item.classList.toggle('is-active', item === button));
  renderDashboard();
}));

$('#bar-chart').addEventListener('click', (event) => {
  const bar = event.target.closest('[data-chart-date]');
  if (!bar) return;
  $$('.bar-item').forEach((item) => item.classList.toggle('is-active', item === bar));
  showChartSummary(bar.dataset.chartDate);
});

$('#refresh-button').addEventListener('click', () => { renderDashboard(); showToast('Painel atualizado.'); });
$('#chat-button').addEventListener('click', () => showToast('Mensagens internas em breve.'));
$('#share-button').addEventListener('click', async () => {
  try {
    if (navigator.share) await navigator.share({ title: 'Power — Controle de Produção', text: 'Acesse o Power — Controle de Produção', url: window.location.href });
    else { await navigator.clipboard.writeText(window.location.href); showToast('Link copiado.'); }
  } catch (_) { /* compartilhamento cancelado pelo usuário */ }
});

$('#launch-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const model = getModel($('#launch-model').value);
  const quantity = Number($('#quantity').value);
  if (!model || !quantity || quantity < 1) { showToast('Escolha um modelo e informe uma quantidade válida.'); return; }
  const order = $('#order-number').value.trim();
  const date = $('#launch-date').value || getTodayISO();
  state.entries.push({ id: makeId(), date, order, modelId: model.id, quantity });
  saveState();
  $('#launch-feedback').textContent = `Registrado: ${number.format(quantity)} x ${model.name} (pedido ${order}) em ${shortDate(date)}.`;
  $('#launch-feedback').hidden = false;
  $('#order-number').value = '';
  $('#quantity').value = '';
  renderAll();
  showToast('Produção registrada.');
});

$('#launch-date').addEventListener('change', renderDayEntries);
$('#launch-model').addEventListener('change', updateLaunchTotal);
$('#quantity').addEventListener('input', updateLaunchTotal);

$('#model-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const name = $('#model-name').value.trim();
  const price = Number($('#model-price').value);
  if (!name || Number.isNaN(price) || price < 0) return;
  state.models.push({ id: makeId(), name, price });
  saveState();
  $('#model-form').reset();
  $('#model-feedback').textContent = 'Modelo adicionado.';
  $('#model-feedback').hidden = false;
  renderAll();
  showToast('Modelo adicionado.');
});

$('#models-body').addEventListener('change', (event) => {
  const input = event.target.closest('[data-model-price]');
  if (!input) return;
  const model = getModel(input.dataset.modelPrice);
  if (!model) return;
  model.price = Math.max(0, Number(input.value) || 0);
  saveState();
  renderAll();
  showToast('Valor atualizado.');
});

$('#models-body').addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-model]');
  if (!button) return;
  const model = getModel(button.dataset.deleteModel);
  if (!model || !window.confirm(`Excluir o modelo “${model.name}”?`)) return;
  state.models = state.models.filter((item) => item.id !== model.id);
  saveState();
  renderAll();
  showToast('Modelo excluído.');
});

$('#copy-backup').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('#backup-text').value);
    showToast('Backup copiado para a área de transferência.');
  } catch (_) { $('#backup-text').select(); document.execCommand('copy'); showToast('Backup copiado.'); }
});

$('#restore-backup').addEventListener('click', () => {
  try {
    const backup = JSON.parse($('#backup-text').value);
    if (!isValidBackup(backup)) throw new Error('Formato inválido');
    state = { models: backup.models, entries: backup.entries };
    saveState();
    renderAll();
    showToast('Backup restaurado.');
  } catch (_) { showToast('Não foi possível restaurar: confira o JSON.'); }
});

$('#clear-all').addEventListener('click', () => {
  if (!window.confirm('Apagar todos os modelos e lançamentos deste navegador?')) return;
  state = { models: [], entries: [] };
  saveState();
  renderAll();
  showToast('Todos os dados foram apagados.');
});

if (localStorage.getItem(SESSION_KEY) === 'authorized') showApp();
else showLogin();
