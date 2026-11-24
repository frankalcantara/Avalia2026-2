// Catálogo público: busca, filtros, grade de cartões e diálogo de detalhes/pedido.
import { api } from './api.js';
import {
  el, statusPill, tag, personLine, toast, setListStatus, busy, charCounter, fmtDate, isOverdue,
  label, CATEGORY_LABEL, MODE_LABEL, CONDITION_LABEL, TYPE_LABEL, handle,
} from './ui.js';
import { state, isMe, emit } from './state.js';

const form = document.getElementById('filters');
const searchInput = document.getElementById('f-q');
const grid = document.getElementById('book-grid');
const statusNode = document.getElementById('catalog-status');
const dialog = document.getElementById('book-dialog');
const dialogBody = document.getElementById('bd-body');

let controller = null;
let debounceTimer = 0;

export function initCatalog() {
  form.addEventListener('submit', (ev) => { ev.preventDefault(); clearTimeout(debounceTimer); loadCatalog(); });
  searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(loadCatalog, 350);
  });
  form.addEventListener('change', (ev) => { if (ev.target !== searchInput) loadCatalog(); });
  form.addEventListener('reset', () => { clearTimeout(debounceTimer); setTimeout(loadCatalog, 0); });
  // Fecha o diálogo ao clicar no fundo (fora da caixa).
  dialog.addEventListener('click', (ev) => { if (ev.target === dialog) dialog.close(); });
}

function currentParams() {
  const params = new URLSearchParams();
  for (const name of ['q', 'category', 'status', 'mode']) {
    const value = (form.elements[name].value || '').trim();
    if (value) params.set(name, value);
  }
  return params;
}

export async function loadCatalog() {
  state.catalogDirty = false;
  if (controller) controller.abort();
  const mine = new AbortController();
  controller = mine;
  const params = currentParams();
  const qs = params.toString();

  setListStatus(statusNode, 'loading', 'Procurando livros nas estantes…');
  grid.setAttribute('aria-busy', 'true');
  try {
    const data = await api(`/api/books${qs ? `?${qs}` : ''}`, { signal: mine.signal });
    renderGrid(Array.isArray(data.books) ? data.books : [], qs !== '');
  } catch (err) {
    if (err && err.name === 'AbortError') return;
    grid.replaceChildren();
    setListStatus(statusNode, 'error', `Não foi possível carregar o catálogo: ${err.message}`, loadCatalog);
  } finally {
    if (controller === mine) grid.removeAttribute('aria-busy');
  }
}

function renderGrid(books, filtered) {
  grid.replaceChildren(...books.map(bookCard));
  if (books.length === 0) {
    setListStatus(statusNode, 'empty', filtered
      ? 'Nenhum livro encontrado com esses filtros. Tente outra busca ou limpe os filtros.'
      : 'O catálogo ainda está vazio. Que tal cadastrar o primeiro livro em “Meu painel”?');
  } else {
    setListStatus(statusNode, 'ok', books.length === 1 ? '1 livro encontrado.' : `${books.length} livros encontrados.`);
  }
}

function bookCard(book) {
  const mine = book.is_mine || isMe(book.owner);
  const titleId = `book-${book.id}-title`;
  const openBtn = el('button', {
    type: 'button', class: 'btn btn-quiet btn-sm card-open',
    'aria-describedby': titleId,
    text: mine || book.status !== 'Disponível' ? 'Ver detalhes' : 'Ver e pedir',
    onclick: () => openBookDialog(book),
  });

  const card = el('article', { class: `book-card book-card--${book.category || 'outro'}`, 'aria-labelledby': titleId },
    el('div', { class: 'book-card-top' },
      el('span', { class: 'book-category', text: label(CATEGORY_LABEL, book.category) }),
      statusPill(book.status),
    ),
    el('h3', { class: 'book-title', id: titleId, text: book.title }),
    el('p', { class: 'book-author', text: book.author }),
    el('div', { class: 'tags' },
      tag(label(MODE_LABEL, book.mode), 'tag--mode'),
      tag(label(CONDITION_LABEL, book.condition)),
      mine ? tag('Seu livro', 'tag--mine') : null,
    ),
    book.status === 'Emprestado' && book.due_date
      ? el('p', { class: `book-due${isOverdue(book.due_date) ? ' is-overdue' : ''}`, text: `Volta para a estante em ${fmtDate(book.due_date)}` })
      : null,
    el('div', { class: 'book-card-foot' },
      personLine(book.owner, { copy: false }),
      openBtn,
    ),
  );
  // Clique em qualquer parte do cartão abre os detalhes (o botão é o alvo acessível).
  card.addEventListener('click', (ev) => {
    if (ev.target.closest('button, a')) return;
    openBookDialog(book);
  });
  return el('li', { class: 'book-grid-item' }, card);
}

// ---------- Diálogo de detalhes ----------
export function openBookDialog(book) {
  dialogBody.replaceChildren(detailsBlock(book), actionsBlock(book));
  if (!dialog.open) dialog.showModal();
}

function detailRow(term, value) {
  if (value === null || value === undefined || value === '') return null;
  return [el('dt', { text: term }), el('dd', {}, value)];
}

function detailsBlock(book) {
  return el('div', { class: 'details' },
    el('p', { class: 'eyebrow', text: label(CATEGORY_LABEL, book.category) }),
    el('h2', { id: 'bd-title', class: 'details-title', text: book.title }),
    el('p', { class: 'details-author', text: `de ${book.author}` }),
    el('dl', { class: 'details-list' },
      detailRow('Situação', statusPill(book.status)),
      book.status === 'Emprestado' && book.due_date ? detailRow('Devolução prevista', fmtDate(book.due_date)) : null,
      detailRow('Modalidade', label(MODE_LABEL, book.mode)),
      detailRow('Conservação', label(CONDITION_LABEL, book.condition)),
      detailRow('ISBN', book.isbn),
      detailRow('Dono', personLine(book.owner, { prefix: '' })),
    ),
    book.description ? el('p', { class: 'details-desc', text: book.description }) : null,
  );
}

function note(text, extra = '') {
  return el('p', { class: `note ${extra}`.trim(), text });
}

function actionsBlock(book) {
  const wrap = el('div', { class: 'details-actions' });
  if (book.is_mine || isMe(book.owner)) {
    wrap.append(note('Este livro é seu. Edite ou acompanhe os pedidos em “Meu painel”.'),
      el('a', { class: 'btn btn-ghost', href: '#painel', onclick: () => dialog.close(), text: 'Ir para Meu painel' }));
    return wrap;
  }
  if (book.status !== 'Disponível') {
    const why = book.status === 'Emprestado'
      ? `Este livro está emprestado${book.due_date ? ` até ${fmtDate(book.due_date)}` : ''}. Volte depois para pedir.`
      : 'Este livro já tem um pedido em andamento. Volte depois para ver se ficou disponível.';
    wrap.append(note(why));
    return wrap;
  }
  if (!state.user) {
    wrap.append(
      note(`Entre com o Discord para pedir este livro. Seu @username será enviado a ${handle(book.owner)} para combinarem a entrega.`),
      el('a', { class: 'btn btn-discord', href: '/api/auth/discord', text: 'Entrar com Discord' }),
    );
    return wrap;
  }
  wrap.append(requestForm(book));
  return wrap;
}

function requestForm(book) {
  const types = book.mode === 'ambos' ? ['emprestimo', 'troca'] : [book.mode];
  const errorNode = el('p', { class: 'form-error', role: 'alert' });
  const submit = el('button', { type: 'submit', class: 'btn btn-primary' });
  const offeredSelect = el('select', { id: 'rq-offered', name: 'offered_book_id' },
    el('option', { value: '', text: 'Nenhum por enquanto — combinamos pelo Discord' }));
  const offeredHint = el('p', { class: 'hint', id: 'rq-offered-hint', text: 'Opcional. Só aparecem livros seus que estão disponíveis.' });
  offeredSelect.setAttribute('aria-describedby', 'rq-offered-hint');
  const offeredField = el('div', { class: 'field', hidden: true },
    el('label', { for: 'rq-offered', text: 'Livro que você oferece em troca' }), offeredSelect, offeredHint);
  const message = el('textarea', { id: 'rq-message', name: 'message', rows: 3, maxlength: 500, placeholder: 'Ex.: Posso buscar no bloco B na quarta à tarde.' });
  const counter = el('span', { class: 'counter', 'aria-hidden': 'true' });

  let offeredLoaded = false;
  async function loadOffered() {
    if (offeredLoaded) return;
    offeredLoaded = true;
    offeredHint.textContent = 'Carregando seus livros disponíveis…';
    try {
      const data = await api('/api/books?owner=me&status=Dispon%C3%ADvel');
      const mineAvailable = (data.books || []).filter((b) => b.status === 'Disponível' && b.id !== book.id);
      for (const b of mineAvailable) offeredSelect.append(el('option', { value: b.id, text: `${b.title} — ${b.author}` }));
      offeredHint.textContent = mineAvailable.length
        ? 'Opcional. Só aparecem livros seus que estão disponíveis.'
        : 'Você não tem livros disponíveis para oferecer. Pode propor a troca mesmo assim e combinar pelo Discord.';
    } catch (err) {
      offeredLoaded = false;
      offeredHint.textContent = `Não foi possível carregar seus livros: ${err.message}`;
    }
  }

  const radios = types.map((t) => el('label', { class: 'choice' },
    el('input', { type: 'radio', name: 'type', value: t, checked: t === types[0], required: true }),
    el('span', { text: t === 'emprestimo' ? 'Pedir emprestado' : 'Propor troca' })));

  const fm = el('form', { class: 'request-form', novalidate: false },
    el('h3', { class: 'form-title', text: 'Fazer um pedido' }),
    el('fieldset', { class: 'choices' },
      el('legend', { text: types.length > 1 ? 'O que você quer?' : `Este livro aceita só ${label(TYPE_LABEL, types[0]).toLowerCase()}` }),
      radios),
    offeredField,
    el('div', { class: 'field' },
      el('label', { for: 'rq-message' }, 'Mensagem para o dono ', el('span', { class: 'optional', text: '(opcional, até 500 caracteres)' })),
      message, counter),
    el('p', { class: 'hint', text: `Ao enviar, o livro fica Reservado até ${handle(book.owner)} responder. Combine a entrega pessoalmente pelo Discord.` }),
    errorNode,
    el('div', { class: 'form-actions' }, submit),
  );
  charCounter(message, counter);

  function syncType() {
    const type = fm.elements.type.value || types[0];
    submit.textContent = type === 'troca' ? 'Propor troca' : 'Solicitar empréstimo';
    offeredField.hidden = type !== 'troca';
    if (type === 'troca') loadOffered();
  }
  fm.addEventListener('change', (ev) => { if (ev.target.name === 'type') syncType(); });
  syncType();

  fm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    errorNode.textContent = '';
    const type = fm.elements.type.value || types[0];
    const body = { book_id: book.id, type };
    const text = message.value.trim();
    if (text) body.message = text;
    if (type === 'troca' && offeredSelect.value) body.offered_book_id = Number(offeredSelect.value);
    try {
      await busy(submit, 'Enviando…', () => api('/api/requests', { method: 'POST', body }), fm);
      dialog.close();
      toast(`Pedido enviado! Combine a entrega com ${handle(book.owner)} pelo Discord.`, 'success');
      emit('requests-changed');
      loadCatalog();
    } catch (err) {
      errorNode.textContent = err.message;
      if (err.status === 401) toast('Sua sessão expirou. Entre com o Discord novamente.', 'error');
      if (err.status === 409) loadCatalog();
    }
  });
  return fm;
}
