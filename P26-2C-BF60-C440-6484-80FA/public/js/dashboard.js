// "Meu painel": meus livros (CRUD), pedidos recebidos e meus pedidos.
import { api } from './api.js';
import {
  el, statusPill, requestPill, tag, personLine, toast, setListStatus, busy, charCounter,
  fmtDate, isOverdue, todayUTC, addDaysUTC, label, handle,
  CATEGORY_LABEL, MODE_LABEL, CONDITION_LABEL, TYPE_LABEL,
} from './ui.js';
import { state, on } from './state.js';

const loginCta = document.getElementById('painel-login');
const content = document.getElementById('painel-content');
const pendingNote = document.getElementById('painel-pending');

const myBooksList = document.getElementById('mybooks-list');
const myBooksStatus = document.getElementById('mybooks-status');
const incomingBody = document.getElementById('incoming-body');
const incomingStatus = document.getElementById('incoming-status');
const outgoingList = document.getElementById('outgoing-list');
const outgoingStatus = document.getElementById('outgoing-status');

const formDialog = document.getElementById('book-form-dialog');
const bookForm = document.getElementById('book-form');
const formTitle = document.getElementById('bf-title-heading');
const formError = document.getElementById('bf-error');
const formSubmit = document.getElementById('bf-submit');
let editing = null; // Book em edição ou null (cadastro)
let updateDescCounter = () => {};

export function initDashboard() {
  document.getElementById('new-book-btn').addEventListener('click', () => openBookForm(null));
  bookForm.addEventListener('submit', onBookFormSubmit);
  document.getElementById('bf-cancel').addEventListener('click', () => formDialog.close());
  formDialog.addEventListener('click', (ev) => { if (ev.target === formDialog) formDialog.close(); });
  updateDescCounter = charCounter(bookForm.elements.description, document.getElementById('bf-desc-counter'));

  for (const btn of document.querySelectorAll('[data-jump]')) {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.jump);
      if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); target.focus({ preventScroll: true }); }
    });
  }
  on('requests-changed', () => { if (!content.hidden) loadDashboard(); });
}

/** Chamado ao entrar em #painel e quando o usuário muda. */
export function renderPainel() {
  const logged = !!state.user;
  pendingNote.hidden = state.userKnown;
  if (!state.userKnown) { loginCta.hidden = true; content.hidden = true; return; }
  loginCta.hidden = logged;
  content.hidden = !logged;
  if (logged) loadDashboard();
}

export function loadDashboard() {
  return Promise.all([loadMyBooks(), loadIncoming(), loadOutgoing()]);
}

function afterChange() {
  state.catalogDirty = true;
  return loadDashboard();
}

function handleAuthLoss(err) {
  if (err && err.status === 401) toast('Sua sessão expirou. Entre com o Discord novamente.', 'error');
}

// ===================== Meus livros =====================
async function loadMyBooks() {
  setListStatus(myBooksStatus, 'loading', 'Carregando sua estante…');
  try {
    const data = await api('/api/books?owner=me');
    const books = Array.isArray(data.books) ? data.books : [];
    myBooksList.replaceChildren(...books.map(myBookItem));
    if (books.length) setListStatus(myBooksStatus, 'ok', books.length === 1 ? '1 livro na sua estante.' : `${books.length} livros na sua estante.`);
    else setListStatus(myBooksStatus, 'empty', 'Sua estante ainda está vazia. Cadastre um livro que você topa emprestar ou trocar.');
  } catch (err) {
    myBooksList.replaceChildren();
    setListStatus(myBooksStatus, 'error', `Não foi possível carregar seus livros: ${err.message}`, loadMyBooks);
    handleAuthLoss(err);
  }
}

function myBookItem(book) {
  const lentOverdue = book.status === 'Emprestado' && isOverdue(book.due_date);
  const stateBox = el('div', { class: 'shelf-state' }, statusPill(book.status));

  if (book.status === 'Emprestado') {
    stateBox.append(
      book.holder ? personLine(book.holder, { prefix: 'Com' }) : null,
      book.due_date ? el('p', { class: `due${lentOverdue ? ' is-overdue' : ''}` },
        lentOverdue ? el('strong', { class: 'overdue-flag', text: 'Atrasado' }) : null,
        lentOverdue ? ' · ' : '',
        `Devolução até ${fmtDate(book.due_date)}`) : null,
    );
  } else if (book.status === 'Reservado') {
    stateBox.append(el('p', { class: 'hint', text: 'Há um pedido aguardando — veja em “Pedidos recebidos”.' }));
  }

  const actions = el('div', { class: 'row-actions' },
    el('button', { type: 'button', class: 'btn btn-ghost btn-sm', text: 'Editar', 'aria-label': `Editar ${book.title}`, onclick: () => openBookForm(book) }));
  if (book.status === 'Disponível') {
    const del = el('button', { type: 'button', class: 'btn btn-danger-ghost btn-sm', text: 'Excluir', 'aria-label': `Excluir ${book.title}` });
    del.addEventListener('click', async () => {
      if (!window.confirm(`Excluir “${book.title}” da sua estante? Essa ação não pode ser desfeita.`)) return;
      try {
        await busy(del, 'Excluindo…', () => api(`/api/books/${encodeURIComponent(book.id)}`, { method: 'DELETE' }), actions);
        toast(`“${book.title}” foi removido da sua estante.`, 'success');
        afterChange();
      } catch (err) { toast(err.message, 'error'); handleAuthLoss(err); }
    });
    actions.append(del);
  } else {
    actions.append(el('p', { class: 'hint', text: 'Só é possível excluir livros disponíveis.' }));
  }

  return el('li', { class: `shelf-item book-card--${book.category || 'outro'}${lentOverdue ? ' is-overdue' : ''}` },
    el('div', { class: 'shelf-main' },
      el('h3', { class: 'shelf-title', text: book.title }),
      el('p', { class: 'book-author', text: book.author }),
      el('div', { class: 'tags' },
        tag(label(CATEGORY_LABEL, book.category)),
        tag(label(MODE_LABEL, book.mode), 'tag--mode'),
        tag(label(CONDITION_LABEL, book.condition))),
    ),
    stateBox,
    actions,
  );
}

// ---------- Formulário de livro (cadastro/edição) ----------
function openBookForm(book) {
  editing = book;
  bookForm.reset();
  formError.textContent = '';
  formTitle.textContent = book ? 'Editar livro' : 'Cadastrar livro';
  formSubmit.textContent = book ? 'Salvar alterações' : 'Cadastrar livro';
  if (book) {
    const f = bookForm.elements;
    f.title.value = book.title || '';
    f.author.value = book.author || '';
    f.category.value = book.category || '';
    f.mode.value = book.mode || '';
    f.condition.value = book.condition || '';
    f.isbn.value = book.isbn || '';
    f.description.value = book.description || '';
  }
  updateDescCounter();
  formDialog.showModal();
  bookForm.elements.title.focus();
}

async function onBookFormSubmit(ev) {
  ev.preventDefault();
  formError.textContent = '';
  if (!bookForm.reportValidity()) return;
  const f = bookForm.elements;
  const body = {
    title: f.title.value.trim(),
    author: f.author.value.trim(),
    category: f.category.value,
    mode: f.mode.value,
    condition: f.condition.value,
  };
  const isbn = f.isbn.value.trim();
  const description = f.description.value.trim();
  // No cadastro, campos opcionais vazios são omitidos; na edição, enviamos null para limpar.
  if (isbn) body.isbn = isbn; else if (editing) body.isbn = null;
  if (description) body.description = description; else if (editing) body.description = null;

  const wasEditing = editing;
  try {
    await busy(formSubmit, wasEditing ? 'Salvando…' : 'Cadastrando…', () => (wasEditing
      ? api(`/api/books/${encodeURIComponent(wasEditing.id)}`, { method: 'PATCH', body })
      : api('/api/books', { method: 'POST', body })), bookForm);
    formDialog.close();
    toast(wasEditing ? 'Alterações salvas.' : `“${body.title}” entrou na sua estante e já aparece no catálogo.`, 'success');
    afterChange();
  } catch (err) {
    formError.textContent = err.message;
    handleAuthLoss(err);
  }
}

// ===================== Pedidos (comum) =====================
function requestHeader(req) {
  return el('div', { class: 'req-head' },
    el('h4', { class: 'req-title', text: (req.book && req.book.title) || 'Livro removido' }),
    el('div', { class: 'req-tags' }, tag(label(TYPE_LABEL, req.type), 'tag--mode'), requestPill(req.status)),
  );
}

function requestExtras(req) {
  return [
    req.book && req.book.author ? el('p', { class: 'book-author', text: req.book.author }) : null,
    req.type === 'troca'
      ? el('p', { class: 'req-offer' }, el('span', { class: 'muted', text: 'Oferecido em troca: ' }),
        req.offered_book ? `${req.offered_book.title} — ${req.offered_book.author}` : 'nenhum livro indicado (combinem pelo Discord)')
      : null,
    req.message ? el('blockquote', { class: 'req-message', text: req.message }) : null,
    el('p', { class: 'req-dates muted', text: requestDates(req) }),
  ];
}

function requestDates(req) {
  const parts = [];
  if (req.created_at) parts.push(`Pedido em ${fmtDate(req.created_at)}`);
  if (req.decided_at) parts.push(`respondido em ${fmtDate(req.decided_at)}`);
  if (req.returned_at) parts.push(`devolvido em ${fmtDate(req.returned_at)}`);
  return parts.join(' · ');
}

function contactLine(user, text) {
  return el('p', { class: 'contact' }, `${text} `, el('strong', { text: handle(user) }));
}

function dueLine(dueDate, prefix) {
  if (!dueDate) return null;
  const late = isOverdue(dueDate);
  return el('p', { class: `due${late ? ' is-overdue' : ''}` },
    late ? el('strong', { class: 'overdue-flag', text: 'Atrasado' }) : null,
    late ? ' · ' : '',
    `${prefix} ${fmtDate(dueDate)}`);
}

function group(title, items, render, emptyText, { collapsible = false } = {}) {
  const list = el('ul', { class: 'req-list' }, items.map(render));
  const inner = items.length ? list : el('p', { class: 'empty-note', text: emptyText });
  if (collapsible) {
    return el('details', { class: 'req-group req-group--history' },
      el('summary', {}, el('span', { class: 'group-title', text: title }), el('span', { class: 'count', text: String(items.length) })),
      inner);
  }
  return el('div', { class: 'req-group' },
    el('h3', { class: 'group-title' }, title, ' ', el('span', { class: 'count', text: String(items.length) })),
    inner);
}

async function runAction(button, busyText, scope, path, body, successText) {
  try {
    await busy(button, busyText, () => api(path, { method: 'POST', body }), scope);
    toast(successText, 'success');
    afterChange();
  } catch (err) {
    toast(err.message, 'error');
    handleAuthLoss(err);
    if (err.status === 409) afterChange();
  }
}

// ===================== Pedidos recebidos =====================
async function loadIncoming() {
  setListStatus(incomingStatus, 'loading', 'Carregando pedidos recebidos…');
  try {
    const data = await api('/api/requests?box=incoming');
    const reqs = Array.isArray(data.requests) ? data.requests : [];
    const pending = reqs.filter((r) => r.status === 'pendente');
    const active = reqs.filter((r) => r.status === 'aprovado');
    const history = reqs.filter((r) => r.status !== 'pendente' && r.status !== 'aprovado');
    incomingBody.replaceChildren(
      group('Aguardando sua resposta', pending, incomingPendingItem, 'Nenhum pedido aguardando resposta.'),
      group('Empréstimos em andamento', active, incomingActiveItem, 'Nenhum livro seu está emprestado agora.'),
      group('Histórico', history, historyItemIncoming, 'Nada no histórico ainda.', { collapsible: true }),
    );
    setListStatus(incomingStatus, reqs.length ? 'ok' : 'empty', reqs.length
      ? `${pending.length} aguardando resposta, ${active.length} em andamento.`
      : 'Ninguém pediu seus livros ainda. Quando alguém pedir, aparece aqui.');
  } catch (err) {
    incomingBody.replaceChildren();
    setListStatus(incomingStatus, 'error', `Não foi possível carregar os pedidos recebidos: ${err.message}`, loadIncoming);
    handleAuthLoss(err);
  }
}

function incomingPendingItem(req) {
  const li = el('li', { class: 'req-item req-item--pending' });
  const who = req.requester;
  const actions = el('div', { class: 'req-actions' });
  const reject = el('button', { type: 'button', class: 'btn btn-danger-ghost btn-sm', text: 'Recusar' });
  reject.addEventListener('click', () => {
    if (!window.confirm(`Recusar o pedido de ${handle(who)}? O livro volta a ficar disponível.`)) return;
    runAction(reject, 'Recusando…', li, `/api/requests/${encodeURIComponent(req.id)}/reject`, {}, `Pedido de ${handle(who)} recusado.`);
  });

  if (req.type === 'emprestimo') {
    const today = todayUTC();
    const inputId = `due-${req.id}`;
    const hintId = `due-hint-${req.id}`;
    const date = el('input', {
      type: 'date', id: inputId, name: 'due_date', required: true,
      value: addDaysUTC(today, 14), min: addDaysUTC(today, 1), max: addDaysUTC(today, 90),
      'aria-describedby': hintId,
    });
    const approve = el('button', { type: 'submit', class: 'btn btn-primary btn-sm', text: 'Aprovar empréstimo' });
    const fm = el('form', { class: 'approve-form' },
      el('div', { class: 'field field-inline' },
        el('label', { for: inputId, text: 'Devolver até' }), date,
        el('p', { class: 'hint', id: hintId, text: 'Entre amanhã e 90 dias a partir de hoje.' })),
      el('div', { class: 'req-actions' }, approve, reject));
    fm.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (!fm.reportValidity()) return;
      runAction(approve, 'Aprovando…', li, `/api/requests/${encodeURIComponent(req.id)}/approve`, { due_date: date.value },
        `Empréstimo aprovado. Combine a entrega com ${handle(who)} pelo Discord.`);
    });
    actions.append(fm);
  } else {
    const approve = el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Aprovar troca' });
    approve.addEventListener('click', () => {
      const offered = req.offered_book ? ` e “${req.offered_book.title}” passa a ser seu` : '';
      if (!window.confirm(`Aprovar a troca? “${(req.book && req.book.title) || 'O livro'}” passa para ${handle(who)}${offered}.`)) return;
      runAction(approve, 'Aprovando…', li, `/api/requests/${encodeURIComponent(req.id)}/approve`, {},
        `Troca concluída. Combine a entrega com ${handle(who)} pelo Discord.`);
    });
    actions.append(el('div', { class: 'req-actions' }, approve, reject));
  }

  li.append(
    requestHeader(req),
    personLine(who, { prefix: 'Pedido por' }),
    ...requestExtras(req),
    contactLine(who, 'Combine a entrega pelo Discord:'),
    actions,
  );
  return li;
}

function incomingActiveItem(req) {
  const li = el('li', { class: `req-item${isOverdue(req.due_date) ? ' is-overdue' : ''}` });
  const ret = el('button', { type: 'button', class: 'btn btn-primary btn-sm', text: 'Registrar devolução' });
  ret.addEventListener('click', () => {
    if (!window.confirm(`Confirmar que ${handle(req.requester)} devolveu “${(req.book && req.book.title) || 'o livro'}”?`)) return;
    runAction(ret, 'Registrando…', li, `/api/requests/${encodeURIComponent(req.id)}/return`, {},
      'Devolução registrada. O livro voltou a ficar disponível.');
  });
  li.append(
    requestHeader(req),
    personLine(req.requester, { prefix: 'Com' }),
    dueLine(req.due_date, 'Devolução até'),
    ...requestExtras(req),
    contactLine(req.requester, 'Combine a devolução pelo Discord:'),
    el('div', { class: 'req-actions' }, ret),
  );
  return li;
}

function historyItemIncoming(req) {
  return el('li', { class: 'req-item req-item--history' },
    requestHeader(req),
    personLine(req.requester, { prefix: 'Pedido por', copy: false }),
    ...requestExtras(req));
}

// ===================== Meus pedidos =====================
async function loadOutgoing() {
  setListStatus(outgoingStatus, 'loading', 'Carregando seus pedidos…');
  try {
    const data = await api('/api/requests?box=outgoing');
    const reqs = Array.isArray(data.requests) ? data.requests : [];
    outgoingList.replaceChildren(...reqs.map(outgoingItem));
    const pending = reqs.filter((r) => r.status === 'pendente').length;
    setListStatus(outgoingStatus, reqs.length ? 'ok' : 'empty', reqs.length
      ? `${reqs.length} pedido(s) feitos, ${pending} pendente(s).`
      : 'Você ainda não pediu nenhum livro. Explore o Catálogo!');
  } catch (err) {
    outgoingList.replaceChildren();
    setListStatus(outgoingStatus, 'error', `Não foi possível carregar seus pedidos: ${err.message}`, loadOutgoing);
    handleAuthLoss(err);
  }
}

function outgoingItem(req) {
  const li = el('li', { class: `req-item${req.status === 'aprovado' && isOverdue(req.due_date) ? ' is-overdue' : ''}${req.status === 'pendente' || req.status === 'aprovado' ? '' : ' req-item--history'}` });
  li.append(
    requestHeader(req),
    personLine(req.owner, { prefix: 'Dono' }),
    req.status === 'aprovado' ? dueLine(req.due_date, 'Devolva até') : null,
    ...requestExtras(req),
  );
  if (req.status === 'pendente' || req.status === 'aprovado') {
    li.append(contactLine(req.owner, req.status === 'pendente' ? 'Aguardando resposta. Fale com o dono pelo Discord:' : 'Combine a devolução pelo Discord:'));
  }
  if (req.status === 'pendente') {
    const cancel = el('button', { type: 'button', class: 'btn btn-danger-ghost btn-sm', text: 'Cancelar pedido' });
    cancel.addEventListener('click', () => {
      if (!window.confirm(`Cancelar o pedido de “${(req.book && req.book.title) || 'livro'}”?`)) return;
      runAction(cancel, 'Cancelando…', li, `/api/requests/${encodeURIComponent(req.id)}/cancel`, {}, 'Pedido cancelado.');
    });
    li.append(el('div', { class: 'req-actions' }, cancel));
  }
  return li;
}
