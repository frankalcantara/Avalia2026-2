/* Quiz Competitivo Temporizado - SPA em JavaScript puro.
   Regras: nada de innerHTML com dados; o relógio oficial é o do servidor,
   a barra de tempo é apenas visual. */
(function () {
  'use strict';

  var KEY_QUIZ = 'quiz.id';
  var KEY_CAT = 'quiz.cat';

  var app = document.getElementById('app');
  var hdr = document.getElementById('hdr');

  var state = {
    user: null,
    categories: null,
    categoryId: null,
    loginError: null,
    nav: null,
    quiz: { id: null, total: 0, score: 0, answered: false, canNext: false, finished: false, locked: false }
  };
  var ui = {};
  var busy = false;
  var raf = 0;
  var rankToken = 0;

  /* ---------- utilitários ---------- */

  function append(el, kids) {
    for (var i = 0; i < kids.length; i++) {
      var k = kids[i];
      if (k === null || k === undefined || k === false) continue;
      if (Array.isArray(k)) append(el, k);
      else el.appendChild(k instanceof Node ? k : document.createTextNode(String(k)));
    }
  }

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k.indexOf('on') === 0 && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, String(v));
      });
    }
    append(el, Array.prototype.slice.call(arguments, 2));
    return el;
  }

  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignora */ } }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignora */ } }

  function fmt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function secs(ms) { return (Number(ms || 0) / 1000).toFixed(1).replace('.', ','); }

  async function api(method, path, body) {
    var opt = { method: method, credentials: 'same-origin', headers: {} };
    if (method !== 'GET') {
      opt.headers['Content-Type'] = 'application/json';
      opt.body = JSON.stringify(body || {});
    }
    try {
      var r = await fetch(path, opt);
      var data = null;
      try { data = await r.json(); } catch (e) { data = null; }
      return { status: r.status, data: data };
    } catch (e) {
      return { status: 0, data: null };
    }
  }

  /* Chamada com tratamento comum: 401, rede/500 e 429. Devolve null se tratou. */
  async function req(method, path, body, retry) {
    var res = await api(method, path, body);
    if (res.status === 401) { toLogin(); return null; }
    if (res.status === 0 || res.status >= 500) {
      showError('Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.', retry);
      return null;
    }
    if (res.status === 429) {
      showError('Muitas tentativas em pouco tempo. Aguarde alguns segundos e tente de novo.', retry);
      return null;
    }
    return res;
  }

  function stopTimer() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function mount() {
    stopTimer();
    var nodes = Array.prototype.slice.call(arguments);
    app.replaceChildren.apply(app, nodes);
    var focusEl = app.querySelector('h1, h2');
    if (focusEl) { focusEl.setAttribute('tabindex', '-1'); focusEl.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
  }

  function avatar(url, name, size) {
    var fallback = function () {
      var ch = (name || '?').trim().charAt(0).toUpperCase() || '?';
      var s = h('span', { class: 'avatar avatar-fallback', 'aria-hidden': 'true', text: ch });
      if (size) { s.style.width = size + 'px'; s.style.height = size + 'px'; }
      return s;
    };
    if (!url) return fallback();
    var img = h('img', { class: 'avatar', src: url, alt: 'Avatar de ' + (name || 'jogador'), width: size || 36, height: size || 36, loading: 'lazy', referrerpolicy: 'no-referrer' });
    if (size) { img.style.width = size + 'px'; img.style.height = size + 'px'; }
    img.addEventListener('error', function () { if (img.parentNode) img.replaceWith(fallback()); });
    return img;
  }

  /* ---------- cabeçalho ---------- */

  function renderHeader() {
    if (!state.user) { hdr.hidden = true; hdr.replaceChildren(); return; }
    hdr.hidden = false;
    var mk = function (id, label, fn) {
      return h('button', { type: 'button', 'aria-current': state.nav === id ? 'page' : null, onclick: fn, text: label });
    };
    hdr.replaceChildren(
      h('div', { class: 'who' }, avatar(state.user.avatarUrl, state.user.name, 36), h('span', { class: 'who-name', text: state.user.name })),
      h('nav', { class: 'nav', 'aria-label': 'Principal' },
        mk('cats', 'Categorias', function () { if (!busy) showCategories(); }),
        mk('rank', 'Ranking', function () { if (!busy) showRanking(); })),
      h('button', { type: 'button', class: 'linklike', onclick: logout, text: 'Sair' })
    );
  }

  function setNav(id) { state.nav = id; renderHeader(); }

  async function logout() {
    if (busy) return;
    busy = true;
    await api('POST', '/api/auth/logout', {});
    busy = false;
    toLogin();
  }

  /* ---------- erro ---------- */

  function showError(msg, retry) {
    busy = false;
    mount(h('section', { class: 'hero' },
      h('h2', { text: 'Algo deu errado' }),
      h('div', { class: 'alert', role: 'alert' }, h('p', { text: msg })),
      h('div', { class: 'actions' },
        retry ? h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { retry(); }, text: 'Tentar novamente' }) : null,
        state.user ? h('button', { type: 'button', class: 'btn', onclick: showCategories, text: 'Ir para categorias' }) : null)));
  }

  /* ---------- login ---------- */

  var LOGIN_ERRORS = {
    negado: 'Você não autorizou o acesso no Discord. Entre de novo e aceite a permissão para jogar.',
    state: 'A verificação de segurança do login falhou ou expirou. Tente entrar novamente.',
    config: 'O login com Discord ainda não está configurado no servidor.',
    token: 'O Discord recusou o código de acesso. Tente entrar novamente.',
    perfil: 'Não foi possível ler seu perfil do Discord. Tente novamente.',
    discord: 'O Discord está indisponível agora. Tente novamente em alguns minutos.',
    interno: 'Ocorreu um erro interno no servidor. Tente novamente.'
  };

  function toLogin() {
    stopTimer();
    state.user = null;
    state.quiz = { id: null, total: 0, score: 0, answered: false, canNext: false, finished: false, locked: false };
    ssDel(KEY_QUIZ); ssDel(KEY_CAT);
    busy = false;
    state.nav = null;
    renderHeader();
    var err = state.loginError;
    state.loginError = null;
    var msg = err === null ? null : (LOGIN_ERRORS[err] || 'Não foi possível entrar. Tente novamente.');
    mount(h('section', { class: 'hero' },
      h('h1', { text: 'Quiz contra o relógio' }),
      h('p', { class: 'lead', text: 'Escolha uma categoria, responda a tempo e suba no ranking.' }),
      h('div', { class: 'fuse fuse-demo', 'aria-hidden': 'true' }, h('div', { class: 'fuse-fill' })),
      h('ul', { class: 'rules' },
        h('li', { text: '10 perguntas por partida.' }),
        h('li', { text: '15 segundos para cada uma.' }),
        h('li', { text: 'Quanto mais rápida a resposta certa, mais pontos.' }),
        h('li', { text: 'Só vale o relógio do servidor: recarregar a página não devolve tempo.' })),
      msg ? h('div', { class: 'alert', role: 'alert' }, h('p', { text: msg })) : null,
      h('div', { class: 'actions' }, h('a', { class: 'btn btn-primary', href: '/api/auth/login', text: 'Entrar com Discord' }))));
  }

  /* ---------- categorias ---------- */

  async function loadCategories() {
    if (state.categories) return true;
    var res = await req('GET', '/api/categories', null, showCategories);
    if (!res) return false;
    if (res.status !== 200 || !res.data) { showError('Não foi possível carregar as categorias.', showCategories); return false; }
    state.categories = res.data.categories || [];
    return true;
  }

  async function showCategories() {
    setNav('cats');
    mount(h('p', { class: 'loading', text: 'Carregando categorias…' }));
    if (!(await loadCategories())) return;
    var cats = state.categories;
    var list = h('ul', { class: 'cats' });
    cats.forEach(function (c) {
      var btn = h('button', { type: 'button', class: 'cat', onclick: function () { startQuiz(c.id, btn); } },
        h('span', { class: 'cat-name', text: c.name }),
        h('span', { class: 'cat-desc', text: c.description || '' }),
        h('span', { class: 'cat-count', text: c.questionCount + (c.questionCount === 1 ? ' pergunta' : ' perguntas') }));
      list.appendChild(h('li', null, btn));
    });
    mount(h('section', null,
      h('div', { class: 'page-head' },
        h('h2', { text: 'Escolha uma categoria' }),
        h('p', { text: 'O relógio começa assim que a primeira pergunta aparece.' })),
      cats.length ? list : h('div', { class: 'empty' }, h('p', { text: 'Ainda não há categorias disponíveis.' }))));
  }

  async function startQuiz(categoryId) {
    if (busy) return;
    busy = true;
    var res;
    try { res = await req('POST', '/api/quiz/start', { categoryId: categoryId }, function () { startQuiz(categoryId); }); }
    finally { busy = false; }
    if (!res) return;
    if (res.status !== 200 || !res.data || !res.data.quizId) {
      showError((res.data && res.data.message) || 'Não foi possível iniciar o quiz.', function () { startQuiz(categoryId); });
      return;
    }
    state.categoryId = categoryId;
    state.quiz.id = res.data.quizId;
    state.quiz.total = res.data.total;
    state.quiz.score = 0;
    ssSet(KEY_QUIZ, res.data.quizId);
    ssSet(KEY_CAT, categoryId);
    loadNext();
  }

  /* ---------- quiz ---------- */

  async function loadNext() {
    if (busy) return;
    busy = true;
    var res;
    try { res = await req('POST', '/api/quiz/next', { quizId: state.quiz.id }, loadNext); }
    finally { busy = false; }
    if (!res) return;
    if (res.status === 404 || res.status === 409) {
      ssDel(KEY_QUIZ); ssDel(KEY_CAT);
      state.quiz.id = null;
      showCategories();
      return;
    }
    if (res.status !== 200 || !res.data) {
      showError('Resposta inesperada do servidor.', loadNext);
      return;
    }
    if (res.data.done) { showResult(res.data.summary); return; }
    showQuestion(res.data.question);
  }

  function showQuestion(q) {
    ui = {};
    var qs = state.quiz;
    qs.id = q.quizId; qs.position = q.position; qs.total = q.total; qs.score = q.score;
    qs.answered = false; qs.canNext = false; qs.finished = false; qs.locked = false;
    ssSet(KEY_QUIZ, q.quizId);
    setNav('cats');

    var totalSecs = Math.max(1, Math.ceil(q.timeLimitMs / 1000));
    ui.limit = q.timeLimitMs;
    ui.score = h('strong', { text: fmt(q.score) });
    ui.secs = h('span', { class: 'secs' }, h('span', { text: String(Math.ceil(q.remainingMs / 1000)) }), h('small', { text: 's' }));
    ui.secsNum = ui.secs.firstChild;
    ui.fill = h('div', { class: 'fuse-fill' });
    ui.fuse = h('div', {
      class: 'fuse', role: 'progressbar', 'aria-label': 'Tempo restante',
      'aria-valuemin': '0', 'aria-valuemax': String(totalSecs), 'aria-valuenow': String(Math.ceil(q.remainingMs / 1000)),
      'aria-valuetext': Math.ceil(q.remainingMs / 1000) + ' segundos restantes'
    }, ui.fill);
    ui.fuse.style.setProperty('--ticks', String(totalSecs));
    ui.timer = h('div', { class: 'timer' }, ui.fuse, ui.secs);
    ui.feedback = h('div', { class: 'feedback', role: 'status', 'aria-live': 'polite', hidden: true });
    ui.opts = [];

    var list = h('ul', { class: 'opts' });
    q.options.forEach(function (text, i) {
      var b = h('button', { type: 'button', class: 'opt', onclick: function () { submitAnswer(i); } },
        h('span', { class: 'opt-key', 'aria-hidden': 'true', text: String(i + 1) }),
        h('span', { class: 'opt-text', text: text }));
      b.setAttribute('aria-keyshortcuts', String(i + 1));
      ui.opts.push(b);
      list.appendChild(h('li', null, b));
    });

    mount(h('section', null,
      h('div', { class: 'quiz-top' },
        h('p', { text: 'Pergunta ' + q.number + ' de ' + q.total }),
        h('p', null, 'Pontos: ', ui.score)),
      ui.timer,
      h('h2', { class: 'question', text: q.text }),
      list,
      ui.feedback,
      h('p', { class: 'hint', text: 'Atalhos: teclas 1 a 4 respondem; Enter avança.' })));

    startTimer(q.remainingMs);
  }

  function startTimer(remainingMs) {
    stopTimer();
    var end = performance.now() + Math.max(0, remainingMs);
    var lastSec = -1;
    var tick = function () {
      var rem = Math.max(0, end - performance.now());
      var ratio = Math.min(1, rem / ui.limit);
      ui.fill.style.transform = 'scaleX(' + ratio + ')';
      var low = ratio < 0.25;
      ui.fuse.classList.toggle('low', low);
      ui.timer.classList.toggle('low', low);
      var s = Math.ceil(rem / 1000);
      if (s !== lastSec) {
        lastSec = s;
        ui.secsNum.textContent = String(s);
        ui.fuse.setAttribute('aria-valuenow', String(s));
        ui.fuse.setAttribute('aria-valuetext', s + ' segundos restantes');
      }
      if (rem <= 0) { raf = 0; submitAnswer(null); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  async function submitAnswer(choice) {
    var qs = state.quiz;
    if (busy || qs.locked || qs.answered) return;
    busy = true;
    qs.locked = true;
    stopTimer();
    ui.opts.forEach(function (b) { b.disabled = true; });
    if (choice !== null && ui.opts[choice]) ui.opts[choice].classList.add('chosen');

    var res;
    try {
      res = await req('POST', '/api/quiz/answer', { quizId: qs.id, position: qs.position, choice: choice }, function () {
        qs.locked = false; submitAnswer(choice);
      });
    } finally { busy = false; }
    if (!res) return;

    if (res.status === 409 && res.data && res.data.error === 'already_answered') { loadNext(); return; }
    if (res.status === 404 || res.status === 409) {
      ssDel(KEY_QUIZ); ssDel(KEY_CAT);
      showCategories();
      return;
    }
    var d = res.data;
    if ((res.status !== 200 && res.status !== 408) || !d || !d.result) {
      showError((d && d.message) || 'Não foi possível registrar a resposta.', function () { qs.locked = false; submitAnswer(choice); });
      return;
    }
    showFeedback(d, choice);
  }

  function showFeedback(d, choice) {
    var qs = state.quiz;
    qs.answered = true;
    qs.score = d.score;
    qs.finished = !!d.finished;
    ui.score.textContent = fmt(d.score);

    var title, detail, cls = '';
    if (d.result === 'correct') {
      cls = 'fb-correct';
      title = 'Correto! +' + fmt(d.points) + ' pontos';
      detail = 'Você respondeu em ' + secs(d.elapsedMs) + ' s.';
      if (ui.opts[choice]) ui.opts[choice].classList.add('is-correct');
    } else if (d.result === 'wrong') {
      cls = 'fb-wrong';
      title = 'Resposta errada';
      detail = 'A alternativa correta está destacada em verde.';
      if (ui.opts[choice]) ui.opts[choice].classList.add('is-wrong');
      if (d.correctIndex !== null && d.correctIndex !== undefined && ui.opts[d.correctIndex]) ui.opts[d.correctIndex].classList.add('is-correct');
    } else if (d.result === 'timeout') {
      title = 'Tempo esgotado';
      detail = 'Sem pontos nesta pergunta. A resposta certa aparece na revisão final.';
    } else {
      title = 'Pergunta pulada';
      detail = 'Sem pontos nesta pergunta. A resposta certa aparece na revisão final.';
    }

    var next = h('button', { type: 'button', class: 'btn btn-primary', onclick: goNext, text: qs.finished ? 'Ver resultado' : 'Próxima pergunta' });
    qs.canNext = true;
    ui.feedback.className = 'feedback ' + cls;
    ui.feedback.replaceChildren(h('p', { class: 'fb-title', text: title }), h('p', { class: 'fb-detail', text: detail }), h('div', { class: 'actions' }, next));
    ui.feedback.hidden = false;
    next.focus();
  }

  function goNext() {
    if (busy || !state.quiz.canNext) return;
    state.quiz.canNext = false;
    loadNext();
  }

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || !ui.opts || !state.user) return;
    var qs = state.quiz;
    if (!qs.answered && !qs.locked && !busy && e.key >= '1' && e.key <= '4') {
      var i = Number(e.key) - 1;
      if (ui.opts[i]) { e.preventDefault(); submitAnswer(i); }
    } else if (e.key === 'Enter' && qs.canNext && !busy) {
      var tag = document.activeElement && document.activeElement.tagName;
      if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'SELECT') { e.preventDefault(); goNext(); }
    }
  });

  /* ---------- resultado ---------- */

  var RESULT_LABEL = { correct: 'Acertou', wrong: 'Errou', timeout: 'Tempo esgotado', skipped: 'Sem resposta' };

  function showResult(s) {
    stopTimer();
    ssDel(KEY_QUIZ);
    state.quiz.id = null;
    if (!s) { showCategories(); return; }
    var cat = state.categoryId || ssGet(KEY_CAT);
    ssDel(KEY_CAT);
    setNav(null);

    var review = h('ol', { class: 'review' });
    (s.review || []).forEach(function (r) {
      var opts = h('ul', { class: 'rev-opts' });
      (r.options || []).forEach(function (t, i) {
        var isC = i === r.correctIndex, isCh = i === r.chosenIndex;
        opts.appendChild(h('li', { class: 'rev-opt' + (isC ? ' is-correct' : (isCh ? ' is-wrong' : '')) },
          h('span', { text: t }),
          isC ? h('span', { class: 'tag', text: 'Resposta correta' }) : null,
          isCh ? h('span', { class: 'tag', text: 'Sua resposta' }) : null));
      });
      review.appendChild(h('li', { class: 'rev' },
        h('div', { class: 'rev-head' },
          h('strong', { text: 'Pergunta ' + r.number }),
          h('span', null, h('span', { class: 'badge ' + (r.result === 'correct' ? 'ok' : 'no'), text: RESULT_LABEL[r.result] || r.result }),
            ' · ' + fmt(r.points) + ' pontos' + (r.result === 'correct' || r.result === 'wrong' ? ' · ' + secs(r.elapsedMs) + ' s' : ''))),
        h('p', { class: 'rev-text', text: r.text }),
        opts));
    });

    mount(h('section', null,
      h('h2', { text: 'Fim da partida' }),
      h('div', { class: 'stats' },
        h('div', { class: 'stat stat-main' }, h('div', { class: 'stat-v', text: fmt(s.score) }), h('div', { class: 'stat-l', text: 'pontos' })),
        h('div', { class: 'stat' }, h('div', { class: 'stat-v', text: s.correctCount + '/' + s.total }), h('div', { class: 'stat-l', text: 'acertos' })),
        h('div', { class: 'stat' }, h('div', { class: 'stat-v', text: Math.round((s.accuracy || 0) * 100) + '%' }), h('div', { class: 'stat-l', text: 'precisão' }))),
      h('div', { class: 'actions' },
        cat ? h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { startQuiz(cat); }, text: 'Jogar de novo' }) : null,
        h('button', { type: 'button', class: cat ? 'btn' : 'btn btn-primary', onclick: function () { showRanking(cat); }, text: 'Ver ranking' }),
        h('button', { type: 'button', class: 'btn', onclick: showCategories, text: 'Outras categorias' })),
      h('h3', { text: 'Revisão' }),
      review));
  }

  /* ---------- ranking ---------- */

  async function showRanking(catId) {
    setNav('rank');
    mount(h('p', { class: 'loading', text: 'Carregando ranking…' }));
    if (!(await loadCategories())) return;
    var cats = state.categories;
    if (!cats.length) { mount(h('section', null, h('h2', { text: 'Ranking' }), h('div', { class: 'empty' }, h('p', { text: 'Ainda não há categorias.' })))); return; }
    var current = catId || state.categoryId;
    if (!cats.some(function (c) { return c.id === current; })) current = cats[0].id;

    var body = h('div', { 'aria-live': 'polite' });
    var select = h('select', { class: 'select', id: 'rank-cat', onchange: function () { loadRanking(select.value, body); } });
    cats.forEach(function (c) { select.appendChild(h('option', { value: c.id, text: c.name })); });
    select.value = current;

    mount(h('section', null,
      h('div', { class: 'page-head' }, h('h2', { text: 'Ranking' }), h('p', { text: 'Melhor pontuação de cada jogador. Top 10 por categoria.' })),
      h('div', { class: 'field' }, h('label', { for: 'rank-cat', text: 'Categoria' }), select),
      body));
    loadRanking(current, body);
  }

  async function loadRanking(catId, body) {
    var token = ++rankToken;
    body.replaceChildren(h('p', { class: 'loading', text: 'Carregando…' }));
    var res = await req('GET', '/api/ranking?categoryId=' + encodeURIComponent(catId), null, function () { showRanking(catId); });
    if (!res || token !== rankToken) return;
    if (res.status !== 200 || !res.data) {
      body.replaceChildren(h('div', { class: 'alert', role: 'alert' }, h('p', { text: (res.data && res.data.message) || 'Não foi possível carregar o ranking.' })));
      return;
    }
    var rows = res.data.ranking || [];
    if (!rows.length) {
      body.replaceChildren(h('div', { class: 'empty' },
        h('p', { text: 'Ninguém terminou uma partida nesta categoria ainda. Seja o primeiro do ranking.' }),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { startQuiz(catId); }, text: 'Jogar agora' })));
      return;
    }
    var tbody = h('tbody');
    rows.forEach(function (r) {
      tbody.appendChild(h('tr', { class: r.isMe ? 'me' : null, 'aria-current': r.isMe ? 'true' : null },
        h('td', { class: 'pos', text: String(r.rank) }),
        h('td', null, h('div', { class: 'player' }, avatar(r.avatarUrl, r.name, 32), h('span', { text: r.name + (r.isMe ? ' (você)' : '') }))),
        h('td', { class: 'num', text: fmt(r.best) }),
        h('td', { class: 'num', text: String(r.games) })));
    });
    var me = res.data.me;
    var mine = null;
    if (me && !rows.some(function (r) { return r.isMe; })) {
      mine = h('p', { class: 'mine' }, h('strong', { text: 'Sua posição: ' + me.rank + 'º' }), ' com ' + fmt(me.best) + ' pontos em ' + me.games + (me.games === 1 ? ' partida.' : ' partidas.'));
    }
    body.replaceChildren(
      h('table', { class: 'rank' },
        h('caption', { class: 'sr', text: 'Ranking da categoria' }),
        h('thead', null, h('tr', null,
          h('th', { scope: 'col', text: '#' }), h('th', { scope: 'col', text: 'Jogador' }),
          h('th', { scope: 'col', class: 'num', text: 'Melhor' }), h('th', { scope: 'col', class: 'num', text: 'Partidas' }))),
        tbody),
      mine);
  }

  /* ---------- início ---------- */

  async function boot() {
    var params = new URLSearchParams(location.search);
    if (params.has('erro')) {
      state.loginError = params.get('erro') || '';
      history.replaceState(null, '', location.pathname);
    }
    mount(h('p', { class: 'loading', text: 'Carregando…' }));
    var res = await api('GET', '/api/me');
    if (res.status === 401) { toLogin(); return; }
    if (res.status !== 200 || !res.data || !res.data.user) {
      showError('Não foi possível verificar sua sessão. Tente novamente.', boot);
      return;
    }
    state.user = res.data.user;
    var saved = ssGet(KEY_QUIZ);
    if (saved) {
      state.quiz.id = saved;
      state.categoryId = ssGet(KEY_CAT);
      renderHeader();
      loadNext();
    } else {
      showCategories();
    }
  }

  boot();
})();
