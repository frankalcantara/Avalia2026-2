'use strict';

const byId = (id) => document.getElementById(id);
const tabs = [...document.querySelectorAll('[role="tab"]')];
const panelIds = { inventory: 'panel-items', critical: 'panel-critical', history: 'panel-history' };
const number = new Intl.NumberFormat('pt-BR');
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' });
const movementDialog = byId('movement-dialog');
const movementForm = byId('movement-form');
const quantityField = byId('quantity');
const searchField = byId('search');
const categoryField = byId('category');
const refreshButton = byId('refresh');

let currentUser = null;
let items = null;
let movements = null;
let itemsError = '';
let historyError = '';
let refreshing = false;
let refreshQueued = false;
let stockRevision = 0;
let selectedItem = null;
let activeMovement = null;
let submitting = false;
let movementButton = null;

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, options) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
    ...options,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) {
    throw new ApiError(data?.error || 'Não foi possível concluir a operação. Tente novamente.', response.status);
  }
  return data;
}

function setNotice(message, tone = 'success') {
  const notice = byId('notice');
  notice.textContent = message;
  notice.dataset.tone = tone;
  notice.hidden = !message;
}

function initialAuthMessage() {
  const url = new URL(location.href);
  const authResult = url.searchParams.get('auth');
  if (!authResult) return;
  url.searchParams.delete('auth');
  history.replaceState(null, '', url);
  if (authResult === 'denied') {
    setNotice('O login pelo Discord foi cancelado. Você pode tentar novamente.', 'error');
  } else {
    setNotice('O login pelo Discord falhou. Tente entrar novamente.', 'error');
  }
}

function renderAccount(user) {
  byId('account').hidden = !user;
  const avatar = byId('avatar-image');
  avatar.hidden = true;
  avatar.removeAttribute('src');
  if (!user) return;

  byId('username').textContent = user.username;
  byId('account-id').textContent = 'ID Discord ' + user.user_id;
  const fallback = byId('avatar-fallback');
  fallback.textContent = user.username.slice(0, 1).toLocaleUpperCase('pt-BR');
  fallback.hidden = false;

  if (user.avatar_url?.startsWith('https://cdn.discordapp.com/')) {
    avatar.src = user.avatar_url;
  }
}

byId('avatar-image').addEventListener('load', (event) => {
  if (!currentUser || event.currentTarget.src !== currentUser.avatar_url) return;
  event.currentTarget.hidden = false;
  byId('avatar-fallback').hidden = true;
});
byId('avatar-image').addEventListener('error', (event) => {
  event.currentTarget.hidden = true;
  byId('avatar-fallback').hidden = false;
});

function showSession(user) {
  currentUser = user;
  byId('initial-state').hidden = true;
  byId('welcome').hidden = Boolean(user);
  byId('dashboard').hidden = !user;
  renderAccount(user);
}

function endSession(message, tone) {
  if (movementDialog.open) movementDialog.close();
  items = null;
  movements = null;
  itemsError = '';
  historyError = '';
  searchField.value = '';
  categoryField.value = '';
  activateTab(tabs[0]);
  renderInventory();
  renderHistory();
  showSession(null);
  setNotice(message, tone);
  byId('welcome-title').setAttribute('tabindex', '-1');
  byId('welcome-title').focus();
}

async function loadSession() {
  byId('initial-message').textContent = 'Verificando sessão...';
  byId('retry-session').hidden = true;
  try {
    const { user } = await request('/api/session');
    showSession(user);
    if (user) await refreshData();
  } catch {
    byId('initial-message').textContent = 'Não foi possível verificar sua sessão. Tente novamente.';
    byId('retry-session').hidden = false;
  }
}

function activateTab(tab) {
  for (const candidate of tabs) {
    const selected = candidate === tab;
    candidate.setAttribute('aria-selected', String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    byId(panelIds[candidate.dataset.view]).hidden = !selected;
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => activateTab(tab));
  tab.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(tab);
    const targetIndexes = {
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      ArrowRight: (index + 1) % tabs.length,
      Home: 0,
      End: tabs.length - 1,
    };
    if (!Object.hasOwn(targetIndexes, event.key)) return;
    event.preventDefault();
    const target = tabs[targetIndexes[event.key]];
    activateTab(target);
    target.focus();
  });
}

function setPanelState(panel, message, failed = false) {
  const state = byId(panel + '-state');
  state.hidden = !message;
  state.dataset.tone = failed ? 'error' : '';
  byId(panel + '-message').textContent = message;
  byId('retry-' + panel).hidden = !failed;
}

function updateCategories() {
  const previous = categoryField.value;
  const categories = [...new Set(items.map((item) => item.category))];
  categories.sort((left, right) => left.localeCompare(right, 'pt-BR'));
  categoryField.replaceChildren(new Option('Todas as categorias', ''));
  for (const category of categories) categoryField.add(new Option(category, category));
  if (categories.includes(previous)) categoryField.value = previous;
}

function normalized(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('pt-BR').trim();
}

function isCritical(item) {
  return item.quantity <= item.minimum_quantity;
}

function tableCell(tag, value, label, className) {
  const cell = document.createElement(tag);
  cell.textContent = value;
  if (label) cell.dataset.label = label;
  if (className) cell.className = className;
  if (tag === 'th') {
    cell.scope = 'row';
    cell.setAttribute('role', 'rowheader');
  } else {
    cell.setAttribute('role', 'cell');
  }
  return cell;
}

function addSubline(cell, text) {
  const line = document.createElement('span');
  line.className = 'muted-line';
  line.textContent = text;
  cell.append(line);
}

function inventoryRow(item) {
  const row = document.createElement('tr');
  row.setAttribute('role', 'row');
  row.classList.toggle('critical-row', isCritical(item));

  const name = tableCell('th', item.name);
  addSubline(name, item.category);
  const locationCell = tableCell('td', item.location, 'Localização');
  const available = tableCell('td', number.format(item.quantity), 'Disponível', 'numeric');
  if (isCritical(item)) {
    const badge = document.createElement('span');
    badge.className = 'badge badge-critical';
    badge.textContent = number.format(item.quantity) + ' · Crítico';
    available.replaceChildren(badge);
  }
  const minimum = tableCell('td', number.format(item.minimum_quantity), 'Limite mínimo', 'numeric');
  const action = tableCell('td', '', '', 'row-action');
  const button = document.createElement('button');
  button.textContent = 'Movimentar';
  button.className = 'button button-secondary';
  button.type = 'button';
  button.dataset.itemId = item.id;
  button.setAttribute('aria-label', 'Movimentar ' + item.name);
  button.addEventListener('click', () => openMovement(item, button));
  action.append(button);
  row.append(name, locationCell, available, minimum, action);
  return row;
}

function renderItemRows(prefix, rows, emptyMessage) {
  byId(prefix + '-rows').replaceChildren(...rows.map(inventoryRow));
  byId(prefix + '-table').hidden = rows.length === 0;
  byId(prefix + '-count').textContent = rows.length
    ? number.format(rows.length) + (rows.length === 1 ? ' item exibido.' : ' itens exibidos.')
    : '';
  setPanelState(prefix, rows.length ? itemsError : (itemsError || emptyMessage), Boolean(itemsError));
}

function renderInventory() {
  const previouslyFocused = document.activeElement?.dataset.itemId;
  byId('filters').hidden = !items?.length;
  if (!items) {
    byId('total-items').textContent = '—';
    byId('total-units').textContent = '—';
    byId('total-critical').textContent = '—';
    renderItemRows('items', [], 'Carregando catálogo...');
    renderItemRows('critical', [], 'Carregando estoque crítico...');
    return;
  }

  const critical = items.filter(isCritical).sort((left, right) =>
    left.quantity - right.quantity || left.name.localeCompare(right.name, 'pt-BR'));
  byId('total-items').textContent = number.format(items.length);
  byId('total-units').textContent = number.format(items.reduce((subtotal, item) => subtotal + item.quantity, 0));
  byId('total-critical').textContent = number.format(critical.length);

  const term = normalized(searchField.value);
  const category = categoryField.value;
  const visibleItems = items.filter((item) => {
    if (category && item.category !== category) return false;
    return normalized([item.name, item.category, item.location].join(' ')).includes(term);
  });

  renderItemRows('items', visibleItems, items.length ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item foi cadastrado.');
  renderItemRows('critical', critical, 'Nenhum item está em estoque crítico.');
  if (previouslyFocused) focusInventoryItem(previouslyFocused);
}

function movementRow(movement) {
  const row = document.createElement('tr');
  row.setAttribute('role', 'row');
  const name = tableCell('th', movement.item_name);
  const isWithdrawal = movement.type === 'withdrawal';
  const type = tableCell('td', '', 'Movimentação');
  const badge = document.createElement('span');
  badge.className = 'badge ' + (isWithdrawal ? 'badge-withdrawal' : 'badge-return');
  badge.textContent = isWithdrawal ? 'Retirada' : 'Devolução';
  type.append(badge);
  const quantity = tableCell('td', number.format(movement.quantity), 'Quantidade', 'numeric');
  const actor = tableCell('td', movement.username || movement.user_id, 'Usuário', 'history-user');
  addSubline(actor, 'ID Discord ' + movement.user_id);

  const timestamp = movement.created_at.includes('T')
    ? movement.created_at
    : movement.created_at.replace(' ', 'T') + 'Z';
  const date = new Date(timestamp);
  const dateCell = tableCell('td', '', 'Data e hora');
  const time = document.createElement('time');
  if (Number.isNaN(date.getTime())) {
    time.textContent = movement.created_at;
  } else {
    time.dateTime = date.toISOString();
    time.textContent = dateTime.format(date);
  }
  dateCell.append(time);
  row.append(name, type, quantity, actor, dateCell);
  return row;
}

function renderHistory() {
  const hasRows = Boolean(movements?.length);
  byId('history-table').hidden = !hasRows;
  byId('history-rows').replaceChildren(...(movements || []).map(movementRow));
  const message = movements ? 'Ainda não há movimentações registradas.' : 'Carregando histórico...';
  setPanelState('history', historyError || (hasRows ? '' : message), Boolean(historyError));
}

async function refreshData() {
  if (!currentUser) return;
  if (refreshing) {
    refreshQueued = true;
    return;
  }
  const refreshingFor = currentUser;
  const revision = stockRevision;
  refreshing = true;
  refreshButton.disabled = true;
  refreshButton.setAttribute('aria-busy', 'true');
  const inventoryFailed = Boolean(itemsError);
  const historyFailed = Boolean(historyError);
  itemsError = '';
  historyError = '';
  if (!items || inventoryFailed) renderInventory();
  if (!movements || historyFailed) renderHistory();

  try {
    const [stock, log] = await Promise.allSettled([request('/api/items'), request('/api/movements')]);
    if (currentUser !== refreshingFor || stockRevision !== revision) return;
    if ([stock, log].some((result) => result.status === 'rejected' && result.reason.status === 401)) {
      endSession('Sua sessão expirou. Entre novamente com o Discord.', 'error');
      return;
    }

    if (stock.status === 'fulfilled') {
      items = stock.value.items;
      updateCategories();
    } else {
      itemsError = 'Não foi possível carregar o catálogo.';
    }
    if (log.status === 'fulfilled') {
      movements = log.value.movements;
    } else {
      historyError = 'Não foi possível carregar o histórico.';
    }
    renderInventory();
    renderHistory();
  } finally {
    refreshing = false;
    refreshButton.disabled = false;
    refreshButton.removeAttribute('aria-busy');
    if (refreshQueued) {
      refreshQueued = false;
      void refreshData();
    }
  }
}

function openMovement(item, button) {
  selectedItem = item;
  activeMovement = null;
  movementButton = button;
  movementForm.reset();
  const withdrawal = movementForm.elements.type[0];
  const returnItem = movementForm.elements.type[1];
  withdrawal.disabled = item.quantity === 0;
  withdrawal.checked = item.quantity > 0;
  returnItem.checked = item.quantity === 0;
  byId('selected-item').textContent = item.name + ' · ' + item.location;
  byId('movement-hint').textContent = 'Saldo atual: ' + number.format(item.quantity) + ' un.';
  byId('movement-error').hidden = true;
  movementDialog.showModal();
  quantityField.focus();
  quantityField.select();
}

function movementError(message) {
  byId('movement-error').textContent = message;
  byId('movement-error').hidden = false;
}

function setSubmitting(active) {
  submitting = active;
  byId('confirm-movement').disabled = active;
  byId('confirm-movement').textContent = active ? 'Registrando...' : 'Confirmar';
  byId('cancel-movement').disabled = active;
  quantityField.readOnly = active;
  for (const radio of movementForm.elements.type) {
    radio.disabled = active || (radio.value === 'withdrawal' && selectedItem?.quantity === 0);
  }
}

movementForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (submitting || !selectedItem) return;

  const type = movementForm.elements.type.value;
  const quantity = quantityField.valueAsNumber;
  if (!Number.isSafeInteger(quantity) || quantity < 1) {
    movementError('Informe uma quantidade inteira maior que zero.');
    return;
  }

  if (activeMovement?.type !== type || activeMovement?.quantity !== quantity) {
    activeMovement = { item_id: selectedItem.id, type, quantity, request_id: crypto.randomUUID() };
  }

  const name = selectedItem.name;
  byId('movement-error').hidden = true;
  setSubmitting(true);

  try {
    const result = await request('/api/movements', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(activeMovement),
    });
    stockRevision += 1;
    items = items.map((item) => item.id === result.item.id ? result.item : item);
    movements = [result.movement, ...(movements || []).filter((entry) => entry.id !== result.movement.id)].slice(0, 50);
    renderInventory();
    renderHistory();
    movementDialog.close();
    const label = type === 'withdrawal' ? 'Retirada registrada' : 'Devolução registrada';
    setNotice(label + ' · ' + name + ' · ' + number.format(quantity) + ' un.');
    void refreshData();
  } catch (error) {
    if (error.status === 401) {
      endSession('Sua sessão expirou. Entre novamente com o Discord.', 'error');
    } else {
      movementError(error.status
        ? error.message
        : 'Não foi possível confirmar a movimentação. Tente novamente com os mesmos dados.');
    }
  } finally {
    setSubmitting(false);
  }
});

byId('cancel-movement').addEventListener('click', () => movementDialog.close());
movementDialog.addEventListener('cancel', (event) => {
  if (submitting) event.preventDefault();
});
function focusInventoryItem(itemId) {
  const matchingButton = [...document.querySelectorAll('button[data-item-id]')].find((button) =>
    button.dataset.itemId === String(itemId) && !button.closest('[hidden]'));
  const activeTab = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
  (matchingButton || activeTab)?.focus();
}

movementDialog.addEventListener('close', () => {
  if (currentUser && movementButton?.isConnected) movementButton.focus();
  else if (currentUser) focusInventoryItem(selectedItem?.id);
  selectedItem = null;
  movementButton = null;
  activeMovement = null;
});

byId('logout').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  setNotice('');
  button.disabled = true;
  try {
    await request('/api/logout', { method: 'POST' });
    endSession('Você saiu do almoxarifado.');
  } catch {
    setNotice('Não foi possível sair. Tente novamente.', 'error');
  } finally {
    button.disabled = false;
  }
});

searchField.addEventListener('input', renderInventory);
categoryField.addEventListener('change', renderInventory);
refreshButton.addEventListener('click', refreshData);
for (const panel of ['items', 'critical', 'history']) {
  byId('retry-' + panel).addEventListener('click', refreshData);
}
byId('retry-session').addEventListener('click', loadSession);

initialAuthMessage();
void loadSession();
