'use strict';

const $ = (id) => document.getElementById(id);
const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const money = (cents) => BRL.format(cents / 100);
const state = { categories: { receita: [], despesa: [] }, items: [], byCategory: [], truncated: false, editingId: null };
let loadSeq = 0;
let toastTimer = null;

const ERROS_LOGIN = {
  negado: 'Você cancelou o login no Discord.',
  estado: 'O login expirou. Tente entrar novamente.',
  discord: 'Não foi possível falar com o Discord. Tente de novo em instantes.',
  servidor: 'Não foi possível salvar o login. Tente de novo em instantes.',
};

// Mesma regra do servidor: aceita 25,90 | 25.90 | 1.234,56. Retorna centavos ou null.
function parseAmount(value) {
  const s = String(value).trim();
  let norm;
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) norm = s.replace(/\./g, '').replace(',', '.');
  else if (/^\d+([.,]\d{1,2})?$/.test(s)) norm = s.replace(',', '.');
  else return null;
  const [int, dec = ''] = norm.split('.');
  const cents = parseInt(int, 10) * 100 + parseInt((dec + '00').slice(0, 2), 10);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 99999999999 ? cents : null;
}

const plain = (cents) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const formatDate = (iso) => iso.split('-').reverse().join('/');

function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

async function api(path, options = {}) {
  const init = { credentials: 'same-origin', ...options };
  if (options.body) init.headers = { 'Content-Type': 'application/json' };
  const res = await fetch(path, init);
  let data = null;
  try { data = await res.json(); } catch { /* resposta sem corpo */ }
  if (res.status === 401) { showLogin(); throw new Error('Sua sessão expirou. Entre novamente.'); }
  if (!res.ok) throw new Error((data && data.error) || 'Algo deu errado. Tente novamente.');
  return data;
}

function toast(message) {
  const box = $('toast');
  box.textContent = message;
  box.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.hidden = true; }, 3000);
}

function showLogin(message) {
  $('app').hidden = true;
  $('login').hidden = false;
  const box = $('login-error');
  box.textContent = message || '';
  box.hidden = !message;
}

function setOptions(select, values, firstLabel) {
  select.replaceChildren();
  if (firstLabel) { const o = el('option', firstLabel); o.value = ''; select.append(o); }
  for (const v of values) { const o = el('option', v); o.value = v; select.append(o); }
}

const currentType = () => document.querySelector('input[name="type"]:checked').value;
const refreshCategories = () => setOptions($('category'), state.categories[currentType()]);

function renderSummary(b) {
  $('income').textContent = money(b.income);
  $('expense').textContent = money(b.expense);
  const net = $('net');
  net.textContent = money(b.net);
  net.className = b.net < 0 ? 'neg' : '';
}

function renderList() {
  const rows = $('rows');
  rows.replaceChildren();
  $('empty').hidden = state.items.length > 0;
  $('table-wrap').hidden = state.items.length === 0;
  for (const t of state.items) {
    const tr = el('tr');
    const sign = t.type === 'receita' ? '+ ' : '− ';
    const edit = el('button', 'Editar', 'btn ghost small');
    const del = el('button', 'Excluir', 'btn ghost small');
    edit.type = del.type = 'button';
    edit.setAttribute('aria-label', `Editar ${t.description || t.category}`);
    del.setAttribute('aria-label', `Excluir ${t.description || t.category}`);
    edit.addEventListener('click', () => startEdit(t));
    del.addEventListener('click', () => remove(t));
    const act = el('td', null, 'act');
    act.append(edit, del);
    tr.append(
      el('td', formatDate(t.date)),
      el('td', t.description || '—'),
      el('td', t.category),
      el('td', sign + money(t.amount_cents), `num ${t.type === 'receita' ? 'pos' : 'neg'}`),
      act
    );
    rows.append(tr);
  }
}

// Gráfico de barras horizontais feito só com <div>: largura proporcional ao % gasto por categoria.
function renderChart() {
  const chart = $('chart');
  chart.replaceChildren();
  const sum = state.byCategory.reduce((a, r) => a + r.total, 0);
  $('chart-total').textContent = sum ? `Total de despesas no filtro: ${money(sum)}` : 'Nenhuma despesa neste filtro.';
  for (const { category: name, total: cents } of state.byCategory) {
    const pct = (cents / sum) * 100;
    const fill = el('div', null, 'fill');
    fill.style.width = `${pct.toFixed(1)}%`;
    const track = el('div', null, 'track');
    track.append(fill);
    const head = el('div', null, 'bar-head');
    head.append(el('div', name), el('div', `${money(cents)} · ${pct.toFixed(1).replace('.', ',')}%`));
    const row = el('div');
    row.append(head, track);
    chart.append(row);
  }
}

async function load() {
  const month = $('f-month').value.trim();
  if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) { toast('Use o mês no formato AAAA-MM, como 2026-11.'); return; }
  const seq = ++loadSeq;
  const query = new URLSearchParams();
  if ($('f-month').value) query.set('month', $('f-month').value);
  if ($('f-category').value) query.set('category', $('f-category').value);
  try {
    const data = await api(`/api/transactions?${query}`);
    if (seq !== loadSeq) return; // resposta antiga: já existe uma busca mais nova
    state.items = data.items;
    state.byCategory = data.byCategory;
    state.truncated = data.truncated;
    $('list-note').hidden = !data.truncated;
    renderSummary(data.balance);
    renderList();
    renderChart();
  } catch (err) { toast(err.message); }
}

function resetForm() {
  state.editingId = null;
  $('tx-form').reset();
  $('date').value = today();
  refreshCategories();
  $('form-title').textContent = 'Nova transação';
  $('save').textContent = 'Adicionar';
  $('cancel').hidden = true;
  $('form-error').hidden = true;
}

function startEdit(t) {
  state.editingId = t.id;
  document.querySelector(`input[name="type"][value="${t.type}"]`).checked = true;
  refreshCategories();
  $('amount').value = plain(t.amount_cents);
  $('date').value = t.date;
  $('category').value = t.category;
  $('description').value = t.description;
  $('form-title').textContent = 'Editar transação';
  $('save').textContent = 'Salvar alterações';
  $('cancel').hidden = false;
  $('form-error').hidden = true;
  $('tx-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('amount').focus();
}

async function remove(t) {
  if (!confirm(`Excluir "${t.description || t.category}"?`)) return;
  try {
    await api(`/api/transactions/${t.id}`, { method: 'DELETE' });
    if (state.editingId === t.id) resetForm();
    await load();
    toast('Transação excluída.');
  } catch (err) { toast(err.message); }
}

async function submitForm(event) {
  event.preventDefault();
  const error = $('form-error');
  const body = {
    type: currentType(),
    amount: $('amount').value,
    category: $('category').value,
    date: $('date').value,
    description: $('description').value.trim(),
  };
  const problem = !parseAmount(body.amount) ? 'Informe um valor maior que zero, como 25,90.'
    : !body.date ? 'Informe a data.'
    : !body.category ? 'Escolha uma categoria.' : '';
  if (problem) { error.textContent = problem; error.hidden = false; return; }
  error.hidden = true;

  const editing = state.editingId;
  $('save').disabled = true;
  try {
    await api(editing ? `/api/transactions/${editing}` : '/api/transactions', {
      method: editing ? 'PUT' : 'POST',
      body: JSON.stringify(body),
    });
    resetForm();
    await load();
    toast(editing ? 'Alterações salvas.' : 'Transação adicionada.');
  } catch (err) {
    error.textContent = err.message;
    error.hidden = false;
  } finally {
    $('save').disabled = false;
  }
}

async function logout() {
  try { await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* segue para a tela de login */ }
  showLogin();
}

async function init() {
  const code = new URLSearchParams(location.search).get('erro');
  if (code) history.replaceState(null, '', location.pathname);
  let data;
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    if (!res.ok) return showLogin(ERROS_LOGIN[code]);
    data = await res.json();
  } catch { return showLogin('Não foi possível conectar. Verifique sua internet.'); }

  state.categories = data.categories;
  $('username').textContent = data.user.username;
  $('uid').textContent = `ID ${data.user.id}`;
  $('avatar').src = data.user.avatar_url;
  const all = [...new Set([...data.categories.receita, ...data.categories.despesa])];
  setOptions($('f-category'), all, 'Todas as categorias');
  resetForm();
  $('login').hidden = true;
  $('app').hidden = false;
  await load();
}

document.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', refreshCategories));
$('amount').addEventListener('blur', () => {
  const cents = parseAmount($('amount').value);
  if (cents) $('amount').value = plain(cents); // mostra como o valor foi entendido
});
$('tx-form').addEventListener('submit', submitForm);
$('cancel').addEventListener('click', resetForm);
$('logout').addEventListener('click', logout);
$('f-month').addEventListener('change', load);
$('f-category').addEventListener('change', load);
$('f-clear').addEventListener('click', () => { $('f-month').value = ''; $('f-category').value = ''; load(); });
init();
