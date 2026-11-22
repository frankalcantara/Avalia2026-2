/* Memorize · JavaScript puro (Vanilla JS), manipulação direta do DOM.
 * Chave: P26-2A-DF64-8C37-3512-F974
 *
 * Toda regra de negócio (dono do baralho, fila diária, SM-2, limites) é validada
 * nas Cloudflare Pages Functions; o cliente só exibe e envia as ações do estudante.
 */
'use strict';

(() => {
  const TZ = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Sao_Paulo'; }
    catch { return 'America/Sao_Paulo'; }
  })();

  const state = {
    user: null,
    today: null,
    deck: null,      // baralho aberto na tela de gerenciamento
    study: null,     // { scope, title, queue, done, total, flipped, busy }
    routeToken: 0,   // evita que respostas antigas sobrescrevam a tela atual
  };

  // ---------- utilidades de DOM ----------
  const $ = (sel, root = document) => root.querySelector(sel);

  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === 'class') el.className = value;
      else if (key === 'text') el.textContent = value;
      else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
      else if (value === true) el.setAttribute(key, '');
      else el.setAttribute(key, String(value));
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  function toast(message, type = 'info') {
    const el = h('div', { class: `toast${type === 'error' ? ' is-error' : ''}`, text: message });
    $('#toasts').append(el);
    setTimeout(() => {
      el.classList.add('is-hiding');
      setTimeout(() => el.remove(), 300);
    }, type === 'error' ? 4500 : 2600);
  }

  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  function fmtInterval(days) {
    if (days < 30) return `${days}d`;
    if (days < 365) { const m = Math.round(days / 30); return `${m} ${m > 1 ? 'meses' : 'mês'}`; }
    const years = Math.round((days / 365) * 10) / 10;
    return `${String(years).replace('.', ',')} ano${years >= 2 ? 's' : ''}`;
  }

  function fmtDue(iso) {
    if (!iso) return '—';
    if (!state.today) return iso;
    const toUtc = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d); };
    const diff = Math.round((toUtc(iso) - toUtc(state.today)) / 86400000);
    if (diff <= 0) return 'hoje';
    if (diff === 1) return 'amanhã';
    if (diff < 30) return `em ${diff} dias`;
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  function fmtLongDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // ---------- API ----------
  class ApiError extends Error {
    constructor(status, message, code) { super(message); this.status = status; this.code = code; }
  }

  async function api(path, { method = 'GET', body } = {}) {
    const init = {
      method,
      credentials: 'same-origin',
      headers: { Accept: 'application/json', 'X-Timezone': TZ },
    };
    if (body !== undefined) {
      init.headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, init);
    } catch {
      throw new ApiError(0, 'Sem conexão com o servidor.', 'network');
    }
    let data = null;
    try { data = await res.json(); } catch { /* corpo vazio */ }
    if (res.status === 401 && path !== '/api/me') {
      state.user = null;
      renderUserChip();
      showView('login');
    }
    if (!res.ok) throw new ApiError(res.status, (data && data.message) || `Erro ${res.status}`, data && data.error);
    return data;
  }

  // ---------- views ----------
  const VIEWS = ['loading', 'login', 'decks', 'deck', 'study'];
  function showView(name) {
    for (const v of VIEWS) $(`#view-${v}`).hidden = v !== name;
    document.body.dataset.view = name;
  }

  function renderUserChip() {
    const chip = $('#user-chip');
    if (!state.user) { chip.hidden = true; return; }
    $('#user-avatar').src = state.user.avatar_url;
    $('#user-name').textContent = state.user.display_name;
    chip.hidden = false;
  }

  // ---------- roteamento por hash ----------
  async function route() {
    const token = ++state.routeToken;
    if (!state.user) { showView('login'); return; }
    const hash = location.hash || '#/';
    let m;
    try {
      if ((m = hash.match(/^#\/deck\/(\d+)$/))) await showDeck(Number(m[1]), token);
      else if ((m = hash.match(/^#\/study\/(all|\d+)$/))) await showStudy(m[1] === 'all' ? null : Number(m[1]), token);
      else await showDecks(token);
      if (document.activeElement !== flashcard) $('#app').focus({ preventScroll: true });
    } catch (err) {
      if (token !== state.routeToken || err.status === 401) return;
      toast(err.message, 'error');
      if ((err.status === 404 || err.status === 400) && hash !== '#/') location.hash = '#/';
      else if (document.body.dataset.view === 'loading') showView('decks');
    }
  }

  // ---------- painel de baralhos ----------
  async function showDecks(token) {
    const [me, list] = await Promise.all([api('/api/me'), api('/api/decks')]);
    if (token !== state.routeToken) return;
    state.user = me.user;
    state.today = me.today;
    renderUserChip();

    $('#greeting').textContent = `Olá, ${me.user.display_name}!`;
    $('#today-label').textContent = `Hoje é ${fmtLongDate(me.today)}.`;
    $('#stat-due').textContent = me.stats.due_today;
    $('#stat-new').textContent = me.stats.new_today;
    $('#stat-reviewed').textContent = me.stats.reviewed_today;
    $('#stat-streak').textContent = plural(me.stats.streak, 'dia', 'dias');
    const studyAll = $('#btn-study-all');
    const anything = me.stats.due_today + me.stats.new_today > 0;
    studyAll.setAttribute('aria-disabled', String(!anything));
    if (anything) studyAll.removeAttribute('tabindex'); else studyAll.setAttribute('tabindex', '-1');
    studyAll.textContent = anything ? `Estudar tudo (${me.stats.due_today + me.stats.new_today})` : 'Nada para hoje';

    const grid = $('#deck-grid');
    grid.replaceChildren();
    if (list.decks.length === 0) {
      grid.append(h('p', { class: 'empty', text: 'Você ainda não tem baralhos. Crie o primeiro acima.' }));
    }
    for (const d of list.decks) {
      const pending = d.due + d.new_today;
      grid.append(
        h('article', { class: 'deck' },
          h('h3', { text: d.name }),
          d.description ? h('p', { text: d.description }) : null,
          h('div', { class: 'deck-meta' },
            h('span', { text: plural(d.total, 'cartão', 'cartões') }),
            d.due ? h('span', { class: 'due', text: `${d.due} p/ revisar` }) : null,
            d.new_today ? h('span', { class: 'new', text: `${d.new_today} novos` }) : null,
            !pending && d.next_due ? h('span', { text: `próxima: ${fmtDue(d.next_due)}` }) : null,
          ),
          h('div', { class: 'actions' },
            h('a', {
              class: 'btn btn-primary btn-sm', href: `#/study/${d.id}`,
              'aria-disabled': pending ? null : 'true',
              tabindex: pending ? null : '-1',
              text: pending ? `Estudar (${pending})` : 'Em dia ✓',
            }),
            h('a', { class: 'btn btn-sm', href: `#/deck/${d.id}`, text: 'Gerenciar' }),
          ),
        ),
      );
    }
    showView('decks');
  }

  $('#form-new-deck').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const { deck } = await api('/api/decks', {
        method: 'POST',
        body: { name: form.name.value, description: form.description.value },
      });
      form.reset();
      toast('Baralho criado!');
      location.hash = `#/deck/${deck.id}`;
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  // ---------- gerenciar baralho ----------
  async function showDeck(id, token) {
    const data = await api(`/api/decks/${id}/cards`);
    if (token !== state.routeToken) return;
    state.deck = data.deck;
    state.today = data.today;
    renderDeckHeader();
    renderCardList(data.cards);
    showView('deck');
  }

  function renderDeckHeader() {
    const d = state.deck;
    $('#deck-title').textContent = d.name;
    $('#deck-desc').textContent = d.description || '';
    $('#btn-study-deck').href = `#/study/${d.id}`;
  }

  function renderCardList(cards) {
    $('#card-count').textContent = cards.length;
    $('#btn-study-deck').setAttribute('aria-disabled', String(cards.length === 0));
    const list = $('#card-list');
    list.replaceChildren();
    if (cards.length === 0) {
      list.append(h('p', { class: 'empty', text: 'Nenhum cartão ainda. Adicione o primeiro acima.' }));
      return;
    }
    for (const c of cards) list.append(cardRow(c));
  }

  function cardRow(c) {
    const info = c.repetitions === 0
      ? 'Novo · ainda não estudado'
      : `Próxima revisão: ${fmtDue(c.due_date)} · intervalo ${plural(c.interval_days, 'dia', 'dias')} · facilidade ${Number(c.ease_factor).toFixed(2).replace('.', ',')} · ${plural(c.repetitions, 'acerto', 'acertos')} seguidos`;
    const row = h('div', { class: 'card-row', 'data-id': c.id },
      h('div', { class: 'side' }, h('small', { text: 'Frente' }), c.front),
      h('div', { class: 'side' }, h('small', { text: 'Verso' }), c.back),
      h('div', { class: 'info', text: info }),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Editar', onclick: () => editCard(c, row) }),
        h('button', { class: 'btn btn-ghost btn-sm btn-danger-ghost', type: 'button', text: 'Excluir', onclick: () => deleteCard(c, row) }),
      ),
    );
    return row;
  }

  const newCardForm = $('#form-new-card');
  newCardForm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const button = form.querySelector('button[type=submit]');
    if (button.disabled) return; // requestSubmit() ignora botão desabilitado
    button.disabled = true;
    try {
      const { cards } = await api(`/api/decks/${state.deck.id}/cards`, {
        method: 'POST',
        body: { front: form.front.value, back: form.back.value },
      });
      form.reset();
      form.front.focus();
      prependCards(cards);
      toast('Cartão adicionado.');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
  newCardForm.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey) && !ev.repeat) {
      ev.preventDefault();
      newCardForm.requestSubmit();
    }
  });

  function prependCards(cards) {
    const list = $('#card-list');
    const empty = list.querySelector('.empty');
    if (empty) empty.remove();
    for (const c of cards) list.prepend(cardRow(c));
    const total = list.querySelectorAll('.card-row').length;
    $('#card-count').textContent = total;
    $('#btn-study-deck').setAttribute('aria-disabled', String(total === 0));
  }

  $('#form-import').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const lines = form.bulk.value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const cards = [];
    const bad = [];
    lines.forEach((line, i) => {
      const sep = line.includes('\t') ? '\t' : ';';
      const idx = line.indexOf(sep);
      const front = idx >= 0 ? line.slice(0, idx).trim() : '';
      const back = idx >= 0 ? line.slice(idx + 1).trim() : '';
      if (front && back) cards.push({ front, back });
      else bad.push(i + 1);
    });
    if (bad.length) { toast(`Linhas sem separador ou incompletas: ${bad.slice(0, 8).join(', ')}`, 'error'); return; }
    if (!cards.length) { toast('Cole pelo menos uma linha "frente ; verso".', 'error'); return; }
    const button = form.querySelector('button[type=submit]');
    button.disabled = true;
    try {
      const res = await api(`/api/decks/${state.deck.id}/cards`, { method: 'POST', body: { cards } });
      form.reset();
      prependCards(res.cards);
      toast(`${plural(res.cards.length, 'cartão importado', 'cartões importados')}.`);
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      button.disabled = false;
    }
  });

  // ---------- diálogo genérico ----------
  function openDialog({ title, fields, okLabel = 'Salvar', danger = false }) {
    const dialog = $('#dialog');
    const body = $('#dialog-body');
    $('#dialog-title').textContent = title;
    const ok = $('#dialog-ok');
    ok.textContent = okLabel;
    ok.className = `btn ${danger ? 'btn-danger-ghost' : 'btn-primary'}`;
    body.replaceChildren(...fields);
    dialog.returnValue = '';
    dialog.showModal();
    const first = body.querySelector('input, textarea');
    if (first) first.focus();
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    });
  }

  function field(label, control) {
    return h('label', { class: 'field' }, h('span', { text: label }), control);
  }

  $('#btn-edit-deck').addEventListener('click', async () => {
    const d = state.deck;
    const name = h('input', { name: 'name', required: true, maxlength: 80 });
    const description = h('input', { name: 'description', maxlength: 300 });
    name.value = d.name;
    description.value = d.description || '';
    if (!(await openDialog({ title: 'Editar baralho', fields: [field('Nome', name), field('Descrição', description)] }))) return;
    try {
      const res = await api(`/api/decks/${d.id}`, { method: 'PUT', body: { name: name.value, description: description.value } });
      state.deck = res.deck;
      renderDeckHeader();
      toast('Baralho atualizado.');
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  $('#btn-delete-deck').addEventListener('click', async () => {
    const d = state.deck;
    const ok = await openDialog({
      title: 'Excluir baralho?',
      fields: [h('p', { text: `“${d.name}” e todos os cartões e históricos dele serão apagados. Isso não pode ser desfeito.` })],
      okLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/decks/${d.id}`, { method: 'DELETE' });
      toast('Baralho excluído.');
      location.hash = '#/';
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  async function editCard(card, row) {
    const front = h('textarea', { name: 'front', required: true, maxlength: 1000, rows: 3 });
    const back = h('textarea', { name: 'back', required: true, maxlength: 1000, rows: 3 });
    const reset = h('input', { type: 'checkbox', name: 'reset' });
    front.value = card.front;
    back.value = card.back;
    const ok = await openDialog({
      title: 'Editar cartão',
      fields: [
        field('Frente', front),
        field('Verso', back),
        h('label', { class: 'checkbox' }, reset, 'Reiniciar progresso (volta a ser um cartão novo)'),
      ],
    });
    if (!ok) return;
    try {
      const res = await api(`/api/cards/${card.id}`, {
        method: 'PUT',
        body: { front: front.value, back: back.value, reset_progress: reset.checked },
      });
      row.replaceWith(cardRow(res.card));
      toast('Cartão atualizado.');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  async function deleteCard(card, row) {
    const ok = await openDialog({
      title: 'Excluir cartão?',
      fields: [h('p', { text: card.front })],
      okLabel: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`/api/cards/${card.id}`, { method: 'DELETE' });
      row.remove();
      const total = $('#card-list').querySelectorAll('.card-row').length;
      $('#card-count').textContent = total;
      if (total === 0) renderCardList([]);
      toast('Cartão excluído.');
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ---------- estudo ----------
  const flashcard = $('#flashcard');
  const flipButton = $('#btn-flip');
  const rating = $('#rating');

  async function showStudy(deckId, token) {
    const data = await api(`/api/study${deckId ? `?deck=${deckId}` : ''}`);
    if (token !== state.routeToken) return;
    state.today = data.today;
    state.study = {
      scope: deckId,
      title: data.deck ? data.deck.name : 'Todos os baralhos',
      queue: data.queue,
      total: data.queue.length,
      done: 0,
      tally: { hard: 0, good: 0, easy: 0 },
      flipped: false,
      busy: false,
    };
    $('#study-title').textContent = state.study.title;
    $('#study-back').href = deckId ? `#/deck/${deckId}` : '#/';
    $('#done-manage').href = deckId ? `#/deck/${deckId}` : '#/';
    $('#done-manage').hidden = !deckId;
    showView('study');
    renderStudyCard();
  }

  function updateCounters() {
    const s = state.study;
    const review = s.queue.filter((c) => !c.is_new).length;
    $('#count-review').textContent = review;
    $('#count-new').textContent = s.queue.length - review;
    const pct = s.total ? Math.round((s.done / s.total) * 100) : 100;
    $('#progress-bar').style.width = `${pct}%`;
    $('#view-study .progress').setAttribute('aria-valuenow', String(pct));
  }

  function setFlipped(flipped) {
    const s = state.study;
    const c = s.queue[0];
    s.flipped = flipped;
    flashcard.classList.toggle('is-flipped', flipped);
    flashcard.setAttribute('aria-pressed', String(flipped));
    flashcard.setAttribute('aria-label', flipped
      ? `Resposta: ${c ? c.back : ''}. Avalie com 1 (Difícil), 2 (Bom) ou 3 (Fácil).`
      : `Pergunta: ${c ? c.front : ''}. Enter para virar.`);
    flipButton.hidden = flipped;
    rating.hidden = !flipped;
    if (flipped) rating.querySelector('.rate-good').focus({ preventScroll: true });
  }

  function fillCard(card) {
    $('#card-front').textContent = card.front;
    $('#card-back').textContent = card.back;
    $('#card-front-mini').textContent = card.front;
    const tag = $('#card-tag');
    tag.textContent = card.is_new ? 'Novo' : 'Revisão';
    tag.className = `card-tag ${card.is_new ? 'is-new' : 'is-review'}`;
    $('#iv-hard').textContent = fmtInterval(card.preview.hard);
    $('#iv-good').textContent = fmtInterval(card.preview.good);
    $('#iv-easy').textContent = fmtInterval(card.preview.easy);
  }

  function renderStudyCard() {
    const s = state.study;
    updateCounters();
    const done = s.queue.length === 0;
    $('#study-area').hidden = done;
    $('#study-done').hidden = !done;
    if (done) {
      const t = s.tally;
      $('#done-summary').textContent = s.done
        ? `Você avaliou ${plural(s.done, 'cartão', 'cartões')}: ${t.hard} difícil, ${t.good} bom, ${t.easy} fácil. Volte amanhã para a próxima fila.`
        : 'Não há cartões para estudar hoje neste escopo. Adicione cartões novos ou volte amanhã.';
      const heading = $('#study-done h2');
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      return;
    }
    flashcard.classList.add('no-anim');
    fillCard(s.queue[0]);
    setFlipped(false);
    void flashcard.offsetWidth; // força reflow para não animar a volta
    flashcard.classList.remove('no-anim');
    flashcard.focus({ preventScroll: true });
  }

  /** Troca para o próximo cartão; só libera novas avaliações depois que ele estiver na tela. */
  function nextCardAnimated() {
    flashcard.classList.add('is-leaving');
    setTimeout(() => {
      flashcard.classList.remove('is-leaving');
      flashcard.classList.add('is-entering');
      renderStudyCard();
      if (state.study) state.study.busy = false;
      rating.querySelectorAll('button').forEach((b) => { b.disabled = false; });
      requestAnimationFrame(() => requestAnimationFrame(() => flashcard.classList.remove('is-entering')));
    }, 220);
  }

  function flip() {
    const s = state.study;
    if (!s || s.busy || !s.queue.length) return;
    setFlipped(!s.flipped);
  }

  async function rate(value) {
    const s = state.study;
    if (!s || s.busy || !s.flipped || !s.queue.length) return;
    s.busy = true;
    const buttons = rating.querySelectorAll('button');
    buttons.forEach((b) => { b.disabled = true; });
    const card = s.queue[0];
    let advancing = false;
    try {
      const res = await api('/api/review', {
        method: 'POST',
        body: { card_id: card.id, rating: value, deck_scope: s.scope },
      });
      s.queue.shift();
      s.done++;
      s.tally[value]++;
      const label = { hard: 'Difícil', good: 'Bom', easy: 'Fácil' }[value];
      toast(`${label} · volta ${fmtDue(res.card.due_date)} (${plural(res.card.interval_days, 'dia', 'dias')})`);
      advancing = true;
      nextCardAnimated();
    } catch (err) {
      toast(err.message, 'error');
      if (err.status === 409 || err.status === 404) {
        s.queue.shift();
        s.total = Math.max(s.done, s.total - 1);
        advancing = true;
        nextCardAnimated();
      }
    } finally {
      if (!advancing) {
        s.busy = false;
        buttons.forEach((b) => { b.disabled = false; });
      }
    }
  }

  flashcard.addEventListener('click', flip);
  flipButton.addEventListener('click', flip);
  rating.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-rating]');
    if (btn) rate(btn.dataset.rating);
  });

  document.addEventListener('keydown', (ev) => {
    if (document.body.dataset.view !== 'study' || $('#dialog').open) return;
    if (ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey) return;
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    const s = state.study;
    if (!s) return;
    if (ev.key === 'Enter' && ev.target === flashcard) {
      ev.preventDefault();
      flip();
    } else if (ev.key === ' ' && !s.flipped) {
      ev.preventDefault();
      flip();
    } else if (s.flipped && ['1', '2', '3'].includes(ev.key)) {
      ev.preventDefault();
      rate({ 1: 'hard', 2: 'good', 3: 'easy' }[ev.key]);
    }
  });

  // ---------- logout ----------
  $('#btn-logout').addEventListener('click', async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignora */ }
    state.user = null;
    renderUserChip();
    location.hash = '';
    showView('login');
  });

  // ---------- inicialização ----------
  const LOGIN_ERRORS = {
    cancelado: 'Login cancelado no Discord.',
    estado_invalido: 'A sessão de login expirou. Tente novamente.',
    token: 'O Discord recusou o código de autorização. Tente novamente.',
    perfil: 'Não foi possível ler seu perfil do Discord.',
  };

  async function init() {
    const params = new URLSearchParams(location.search);
    const loginError = params.get('login');
    if (loginError) {
      const box = $('#login-error');
      box.textContent = LOGIN_ERRORS[loginError] || 'Falha no login.';
      box.hidden = false;
      history.replaceState(null, '', location.pathname + location.hash);
    }
    try {
      const me = await api('/api/me');
      state.user = me.user;
      state.today = me.today;
      renderUserChip();
      window.addEventListener('hashchange', route);
      await route();
    } catch (err) {
      showView('login');
      window.addEventListener('hashchange', route);
      if (err.status !== 401) toast(err.message, 'error');
    }
  }

  init();
})();
