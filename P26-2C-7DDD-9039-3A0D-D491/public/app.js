var currentUser = null;
var currentTransactions = [];
var editingTransactionId = null;
var moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

function formatMoney(cents) {
  return moneyFormatter.format((Number(cents) || 0) / 100);
}

function formatDate(value) {
  var parts = value.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function getLocalDate() {
  var date = new Date();
  var month = String(date.getMonth() + 1).padStart(2, '0');
  var day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function setMessage(elementId, message, kind) {
  var element = document.getElementById(elementId);
  element.textContent = message || '';
  element.classList.remove('is-error', 'is-success');
  if (kind) {
    element.classList.add('is-' + kind);
  }
}

async function requestJson(url, options) {
  var response = await fetch(url, options || {});
  var data = {};
  try {
    data = await response.json();
  } catch (error) {
    if (response.ok) {
      throw new Error('O servidor retornou uma resposta inválida.');
    }
  }
  if (!response.ok) {
    throw new Error(data.error || 'Não foi possível concluir a solicitação.');
  }
  return data;
}

function showSignedOut(message) {
  document.getElementById('signed-out').hidden = false;
  document.getElementById('dashboard').hidden = true;
  document.getElementById('user-area').hidden = true;
  if (message) {
    var error = document.getElementById('login-error');
    error.textContent = message;
    error.hidden = false;
  }
}

function showUser(user) {
  currentUser = user;
  document.getElementById('signed-out').hidden = true;
  document.getElementById('dashboard').hidden = false;
  document.getElementById('user-area').hidden = false;
  document.getElementById('user-avatar').src = user.avatar;
  document.getElementById('user-avatar').alt = 'Avatar de ' + user.username;
  document.getElementById('user-name').textContent = user.username;
}

function getFilterUrl() {
  var params = new URLSearchParams();
  var month = document.getElementById('filter-month').value;
  var category = document.getElementById('filter-category').value;
  if (month) {
    params.set('month', month);
  }
  if (category) {
    params.set('category', category);
  }
  var query = params.toString();
  return '/api/transactions' + (query ? '?' + query : '');
}

function renderBalance(balance) {
  document.getElementById('net-balance').textContent = formatMoney(balance.net_cents);
  document.getElementById('income-total').textContent = formatMoney(balance.income_cents);
  document.getElementById('expense-total').textContent = formatMoney(balance.expense_cents);
}

function renderChart(transactions) {
  var totals = {};
  var totalExpenses = 0;
  var maxAmount = 0;
  for (var i = 0; i < transactions.length; i++) {
    var transaction = transactions[i];
    if (transaction.type === 'despesa') {
      totals[transaction.category] = (totals[transaction.category] || 0) + transaction.amount_cents;
      totalExpenses += transaction.amount_cents;
      maxAmount = Math.max(maxAmount, totals[transaction.category]);
    }
  }

  var chart = document.getElementById('expense-chart');
  chart.replaceChildren();
  var categories = Object.keys(totals).sort(function (a, b) {
    return totals[b] - totals[a];
  });
  document.getElementById('chart-empty').hidden = categories.length > 0;

  for (var j = 0; j < categories.length; j++) {
    var category = categories[j];
    var amount = totals[category];
    var share = totalExpenses ? amount / totalExpenses * 100 : 0;
    var row = document.createElement('div');
    row.className = 'chart-row';

    var label = document.createElement('div');
    label.className = 'chart-category';
    label.textContent = category;

    var track = document.createElement('div');
    track.className = 'bar-track';
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', category + ': ' + share.toFixed(1) + '% das despesas');
    var fill = document.createElement('div');
    fill.className = 'bar-fill';
    fill.style.width = (maxAmount ? amount / maxAmount * 100 : 0) + '%';
    track.appendChild(fill);

    var value = document.createElement('div');
    value.className = 'chart-value';
    value.textContent = formatMoney(amount) + ' · ' + share.toFixed(1) + '%';

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    chart.appendChild(row);
  }
}

function renderTransactions(transactions) {
  var list = document.getElementById('transaction-list');
  list.replaceChildren();
  document.getElementById('transactions-empty').hidden = transactions.length > 0;

  for (var i = 0; i < transactions.length; i++) {
    var transaction = transactions[i];
    var row = document.createElement('article');
    row.className = 'transaction-row';
    row.setAttribute('data-id', transaction.id);

    var info = document.createElement('div');
    info.className = 'transaction-info';
    var title = document.createElement('p');
    title.className = 'transaction-title';
    title.textContent = transaction.description || transaction.category;
    var meta = document.createElement('div');
    meta.className = 'transaction-meta';
    var category = document.createElement('span');
    category.textContent = transaction.category;
    var date = document.createElement('span');
    date.textContent = formatDate(transaction.date);
    meta.appendChild(category);
    meta.appendChild(date);
    info.appendChild(title);
    info.appendChild(meta);

    var amount = document.createElement('div');
    amount.className = 'transaction-amount ' + (transaction.type === 'receita' ? 'income' : 'expense');
    amount.textContent = (transaction.type === 'receita' ? '+ ' : '- ') + formatMoney(transaction.amount_cents);

    var actions = document.createElement('div');
    actions.className = 'transaction-actions';
    var editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.textContent = 'Editar';
    editButton.setAttribute('data-action', 'edit');
    var deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'delete-button';
    deleteButton.textContent = 'Excluir';
    deleteButton.setAttribute('data-action', 'delete');
    actions.appendChild(editButton);
    actions.appendChild(deleteButton);

    row.appendChild(info);
    row.appendChild(amount);
    row.appendChild(actions);
    list.appendChild(row);
  }
}

async function loadTransactions() {
  setMessage('transactions-message', '');
  try {
    var result = await requestJson(getFilterUrl());
    currentTransactions = result.transactions;
    renderBalance(result.balance);
    renderTransactions(result.transactions);
    renderChart(result.transactions);
  } catch (error) {
    setMessage('transactions-message', error.message, 'error');
  }
}

function validateForm(data) {
  var amount = data.amount.trim().replace(',', '.');
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0) {
    return 'Informe um valor positivo com até duas casas decimais.';
  }
  if (!data.category) {
    return 'Selecione uma categoria.';
  }
  if (!data.date) {
    return 'Informe a data da transação.';
  }
  return '';
}

function resetForm() {
  document.getElementById('transaction-form').reset();
  document.getElementById('transaction-date').value = getLocalDate();
  document.getElementById('transaction-type').value = 'despesa';
  document.getElementById('form-title').textContent = 'Nova transação';
  document.getElementById('save-button').textContent = 'Adicionar transação';
  document.getElementById('cancel-edit').hidden = true;
  editingTransactionId = null;
  setMessage('form-message', '');
}

function startEditing(id) {
  var transaction = null;
  for (var i = 0; i < currentTransactions.length; i++) {
    if (Number(currentTransactions[i].id) === id) {
      transaction = currentTransactions[i];
      break;
    }
  }
  if (!transaction) {
    setMessage('transactions-message', 'Não foi possível localizar esta transação.', 'error');
    return;
  }
  editingTransactionId = transaction.id;
  document.getElementById('transaction-type').value = transaction.type;
  document.getElementById('transaction-amount').value = (transaction.amount_cents / 100).toFixed(2).replace('.', ',');
  document.getElementById('transaction-category').value = transaction.category;
  document.getElementById('transaction-date').value = transaction.date;
  document.getElementById('transaction-description').value = transaction.description || '';
  document.getElementById('form-title').textContent = 'Editar transação';
  document.getElementById('save-button').textContent = 'Salvar alterações';
  document.getElementById('cancel-edit').hidden = false;
  document.getElementById('transaction-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveTransaction(event) {
  event.preventDefault();
  var data = {
    type: document.getElementById('transaction-type').value,
    amount: document.getElementById('transaction-amount').value,
    category: document.getElementById('transaction-category').value,
    date: document.getElementById('transaction-date').value,
    description: document.getElementById('transaction-description').value
  };
  var validationError = validateForm(data);
  if (validationError) {
    setMessage('form-message', validationError, 'error');
    return;
  }

  var url = '/api/transactions' + (editingTransactionId ? '?id=' + encodeURIComponent(editingTransactionId) : '');
  var method = editingTransactionId ? 'PUT' : 'POST';
  try {
    await requestJson(url, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    resetForm();
    setMessage('form-message', 'Transação salva com sucesso.', 'success');
    await loadTransactions();
  } catch (error) {
    setMessage('form-message', error.message, 'error');
  }
}

async function handleTransactionAction(event) {
  var button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  var row = button.closest('.transaction-row');
  var id = Number(row.getAttribute('data-id'));
  if (button.getAttribute('data-action') === 'edit') {
    startEditing(id);
    return;
  }
  if (!window.confirm('Deseja excluir esta transação?')) {
    return;
  }
  try {
    await requestJson('/api/transactions?id=' + encodeURIComponent(id), { method: 'DELETE' });
    await loadTransactions();
  } catch (error) {
    setMessage('transactions-message', error.message, 'error');
  }
}

async function logout() {
  try {
    await requestJson('/api/logout', { method: 'POST' });
    window.location.reload();
  } catch (error) {
    document.getElementById('app-error').textContent = error.message;
    document.getElementById('app-error').hidden = false;
  }
}

async function initializeApp() {
  try {
    var result = await requestJson('/api/me');
    if (!result.user) {
      showSignedOut();
      return;
    }
    showUser(result.user);
    document.getElementById('transaction-date').value = getLocalDate();
    await loadTransactions();
  } catch (error) {
    showSignedOut();
    document.getElementById('login-error').textContent = error.message;
    document.getElementById('login-error').hidden = false;
  }
}

document.getElementById('transaction-form').addEventListener('submit', saveTransaction);
document.getElementById('cancel-edit').addEventListener('click', resetForm);
document.getElementById('filter-month').addEventListener('change', loadTransactions);
document.getElementById('filter-category').addEventListener('change', loadTransactions);
document.getElementById('transaction-list').addEventListener('click', handleTransactionAction);
document.getElementById('logout-button').addEventListener('click', logout);
initializeApp();
