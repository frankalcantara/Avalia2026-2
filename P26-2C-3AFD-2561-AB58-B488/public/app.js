'use strict';
// Cliente em JavaScript puro. Todo texto de usuário entra no DOM via textContent
// (nunca innerHTML), então citações e anotações não executam HTML/JS injetado.

const $ = (sel, root = document) => root.querySelector(sel);

const state = { user: null, scope: 'mine', q: '', editingId: null, lastRandomId: null };

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { showLogin(); throw new Error('Sua sessão expirou. Entre de novo.'); }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Algo deu errado. Tente de novo.'), { details: data.details });
  return data;
}

function avatarUrl(u) {
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`;
  const idx = Number((BigInt(u.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

/* ---------- telas ---------- */
function showLogin() {
  $('#app-view').hidden = true;
  $('#login-view').hidden = false;
  const erro = new URLSearchParams(location.search).get('erro');
  if (erro) {
    const p = $('#login-error');
    p.textContent = erro;
    p.hidden = false;
    history.replaceState(null, '', location.pathname);
  }
}

function showApp() {
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  $('#user-name').textContent = state.user.username;
  const img = $('#user-avatar');
  img.src = avatarUrl(state.user);
  img.alt = `Avatar de ${state.user.username}`;
}

/* ---------- lista ---------- */
function formatDate(s) {
  const d = new Date(s.replace(' ', 'T') + 'Z');
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR');
}

function quoteCard(q) {
  const meta = el('div', { class: 'quote__meta' },
    el('span', { class: 'quote__author' }, q.author),
    el('span', { class: 'quote__work' }, q.work),
    el('span', {}, `p. ${q.page}`),
    q.theme && el('span', { class: 'chip' }, q.theme),
    q.mine
      ? el('span', { class: q.is_public ? 'chip chip--public' : 'chip' }, q.is_public ? 'Pública' : 'Privada')
      : el('span', {}, `por ${q.owner.username}`),
    el('span', {}, formatDate(q.created_at)),
  );
  const body = el('div', { class: 'quote__body' },
    el('blockquote', { class: 'quote__text' }, q.text),
    q.notes && el('p', { class: 'quote__notes' }, q.notes),
    q.mine && el('div', { class: 'quote__actions' },
      el('button', { class: 'btn btn--quiet', type: 'button', onclick: () => openForm(q) }, 'Editar'),
      el('button', { class: 'btn btn--quiet btn--danger', type: 'button', onclick: () => removeQuote(q) }, 'Excluir'),
    ),
  );
  return el('article', { class: 'quote' }, meta, body);
}

let loadToken = 0; // evita que uma resposta antiga sobrescreva uma busca mais nova
async function load() {
  const token = ++loadToken;
  const status = $('#status');
  status.textContent = 'Carregando…';
  try {
    const params = new URLSearchParams({ scope: state.scope });
    if (state.q) params.set('q', state.q);
    const { quotes } = await api(`/api/quotes?${params}`);
    if (token !== loadToken) return;
    const list = $('#list');
    list.replaceChildren(...quotes.map(quoteCard));
    if (quotes.length === 0) list.append(emptyState());
    status.textContent = quotes.length ? `${quotes.length} ${quotes.length === 1 ? 'citação' : 'citações'}` : '';
  } catch (e) {
    if (token === loadToken) status.textContent = e.message;
  }
}

function emptyState() {
  let msg;
  if (state.q) msg = `Nada encontrado para “${state.q}”. Tente outro autor ou tema.`;
  else if (state.scope === 'mine') msg = 'Seu acervo está vazio. Use “Nova citação” para guardar o primeiro trecho.';
  else msg = 'Ainda não há citações públicas. Marque uma das suas como pública para começar o feed.';
  return el('p', { class: 'empty' }, msg);
}

/* ---------- ações ---------- */
async function removeQuote(q) {
  if (!confirm(`Excluir a citação de ${q.author}? Esta ação não pode ser desfeita.`)) return;
  try { await api(`/api/quotes/${q.id}`, { method: 'DELETE' }); load(); }
  catch (e) { $('#status').textContent = e.message; }
}

async function showRandom() {
  const btn = $('#random');
  btn.disabled = true;
  try {
    const params = state.lastRandomId ? `?exclude=${state.lastRandomId}` : '';
    const { quote } = await api(`/api/quotes/random${params}`);
    const slot = $('#random-slot');
    if (!quote) {
      slot.replaceChildren(el('p', { class: 'empty' }, 'Ainda não há citações públicas para sortear.'));
    } else {
      state.lastRandomId = quote.id;
      slot.replaceChildren(
        el('figure', { style: 'margin:0' },
          el('blockquote', {}, quote.text),
          el('figcaption', {}, `${quote.author}, ${quote.work}, p. ${quote.page} · compartilhada por ${quote.owner.username}`),
          quote.notes && el('p', { class: 'reflection' }, quote.notes),
        ),
        el('button', { class: 'btn btn--quiet', type: 'button', onclick: () => slot.hidden = true }, 'Fechar'),
      );
    }
    slot.hidden = false;
    slot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (e) { $('#status').textContent = e.message; }
  finally { btn.disabled = false; }
}

/* ---------- formulário ---------- */
const dialog = $('#form-dialog');
const form = $('#quote-form');

function clearErrors() {
  form.querySelectorAll('[data-err]').forEach((n) => (n.textContent = ''));
  $('#form-error').textContent = '';
}

function openForm(q = null) {
  state.editingId = q ? q.id : null;
  form.reset();
  clearErrors();
  $('#form-title').textContent = q ? 'Editar citação' : 'Nova citação';
  if (q) {
    for (const k of ['text', 'author', 'work', 'page', 'theme', 'notes']) form.elements[k].value = q[k] ?? '';
    form.elements.is_public.checked = q.is_public;
  }
  dialog.showModal();
  form.elements.text.focus();
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  clearErrors();
  const f = form.elements;
  const payload = {
    text: f.text.value, author: f.author.value, work: f.work.value,
    page: f.page.value, theme: f.theme.value, notes: f.notes.value,
    is_public: f.is_public.checked,
  };
  const save = $('#save');
  save.disabled = true;
  try {
    const editing = state.editingId;
    await api(editing ? `/api/quotes/${editing}` : '/api/quotes', { method: editing ? 'PUT' : 'POST', body: payload });
    dialog.close();
    load();
  } catch (e) {
    for (const [field, msg] of Object.entries(e.details || {})) {
      const slot = form.querySelector(`[data-err="${field}"]`);
      if (slot) slot.textContent = msg;
    }
    $('#form-error').textContent = e.details ? 'Corrija os campos destacados.' : e.message;
  } finally { save.disabled = false; }
});
$('#cancel').addEventListener('click', () => dialog.close());

/* ---------- eventos ---------- */
$('#new').addEventListener('click', () => openForm());
$('#random').addEventListener('click', showRandom);
$('#logout').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* sem sessão: segue para o login */ }
  state.user = null;
  showLogin();
});

let debounce;
$('#search').addEventListener('input', (ev) => {
  clearTimeout(debounce);
  debounce = setTimeout(() => { state.q = ev.target.value.trim(); load(); }, 250);
});

document.querySelectorAll('.tabs [role=tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    state.scope = tab.dataset.scope;
    document.querySelectorAll('.tabs [role=tab]').forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    load();
  });
});

/* ---------- início ---------- */
(async function init() {
  try {
    const { user } = await api('/api/me');
    state.user = user;
    showApp();
    load();
  } catch { showLogin(); }
})();
