'use strict';

/* Rastreador de Hábitos — cliente em JavaScript puro (sem frameworks).
 * O servidor é a fonte da verdade: streaks e taxa mensal vêm de /api/dashboard.
 * O cliente só aplica atualização otimista na grade e nas barras de progresso. */
(() => {
  const MIN_MONTH = '2020-01';
  const ERROS = {
    login_cancelado: 'Login cancelado. Tente novamente quando quiser.',
    state_invalido: 'A sessão de login expirou ou é inválida. Tente entrar de novo.',
    falha_discord: 'Não foi possível concluir o login com o Discord.',
    config: 'O servidor ainda não está configurado com as credenciais do Discord.',
  };

  const $ = (selector) => document.querySelector(selector);
  const views = {
    loading: $('#view-loading'),
    error: $('#view-error'),
    login: $('#view-login'),
    dashboard: $('#view-dashboard'),
  };
  const grid = $('#grid');

  const state = {
    month: null, // "YYYY-MM" exibido
    data: null, // última resposta de /api/dashboard
    queue: Promise.resolve(), // serializa as marcações para não haver corrida
    pending: 0, // marcações ainda não confirmadas pelo servidor
    needsReload: false,
  };

  /* ---------- utilidades ---------- */

  const pad2 = (n) => String(n).padStart(2, '0');

  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key === 'dataset') Object.assign(node.dataset, value);
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value === true ? '' : value);
    }
    node.append(...children);
    return node;
  }

  function showView(name) {
    for (const [key, node] of Object.entries(views)) node.hidden = key !== name;
  }

  let toastTimer;
  function toast(message, kind = 'info') {
    const node = $('#toast');
    node.textContent = message;
    node.dataset.kind = kind;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 4000);
  }

  function shiftMonth(month, delta) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
  }

  function monthLabel(month) {
    const [y, m] = month.split('-').map(Number);
    const text = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('pt-BR', {
      month: 'long', year: 'numeric', timeZone: 'UTC',
    });
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function weekdayLetter(month, day) {
    const [y, m] = month.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('pt-BR', { weekday: 'narrow', timeZone: 'UTC' });
  }

  function fmtPercent(n) {
    return `${Number.isInteger(n) ? n : n.toFixed(1).replace('.', ',')}%`;
  }

  /* ---------- API ---------- */

  class ApiError extends Error {
    constructor(status, message, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, { method = 'GET', body } = {}) {
    const options = { method, credentials: 'same-origin', headers: {} };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    let response;
    try {
      response = await fetch(path, options);
    } catch {
      throw new ApiError(0, 'Sem conexão com o servidor.', 'network');
    }
    let data = null;
    try { data = await response.json(); } catch { /* sem corpo */ }
    if (!response.ok) {
      throw new ApiError(response.status, data?.error?.message || 'Erro inesperado.', data?.error?.code);
    }
    return data;
  }

  /* ---------- carregamento ---------- */

  let loadSeq = 0;
  async function load(month, { initial = false } = {}) {
    const seq = ++loadSeq;
    try {
      const data = await api(`/api/dashboard${month ? `?month=${encodeURIComponent(month)}` : ''}`);
      if (seq !== loadSeq) return; // resposta de uma navegação mais antiga: ignora
      state.data = data;
      state.month = data.month;
      renderUser();
      showView('dashboard');
      buildGrid();
      updateStats();
    } catch (error) {
      if (seq !== loadSeq) return;
      if (error.status === 401) {
        state.data = null;
        showView('login');
      } else if (initial || !state.data) {
        $('#error-message').textContent = error.message;
        showView('error');
      } else {
        toast(error.message, 'error');
      }
    }
  }

  function renderUser() {
    const { user } = state.data;
    const avatar = $('#user-avatar');
    avatar.src = user.avatarUrl;
    $('#user-name').textContent = user.displayName;
  }

  /* ---------- grade ---------- */

  function buildGrid() {
    const { data } = state;
    const [, m] = data.month.split('-').map(Number);
    const todayDay = data.today.startsWith(`${data.month}-`) ? Number(data.today.slice(8)) : null;
    const focused = document.activeElement;

    $('#month-label').textContent = monthLabel(data.month);
    $('#prev-month').disabled = data.month <= MIN_MONTH;
    $('#next-month').disabled = data.month >= data.today.slice(0, 7);
    $('#today-btn').disabled = data.month === data.today.slice(0, 7);
    $('#empty-state').hidden = data.habits.length > 0;
    grid.hidden = data.habits.length === 0;
    // Botão que acabou de ser desabilitado (ex.: "›" ao chegar no mês atual) perde o foco: devolve ao título do mês.
    if (focused && focused.disabled) $('#month-label').focus();

    const headRow = el('tr', {}, el('th', { class: 'habit-col', scope: 'col', text: 'Hábito' }));
    for (let d = 1; d <= data.daysInMonth; d += 1) {
      headRow.append(
        el('th', { class: `day${d === todayDay ? ' is-today' : ''}`, scope: 'col' },
          el('span', { class: 'wd', text: weekdayLetter(data.month, d) }),
          el('span', { class: 'dn', text: String(d) })),
      );
    }

    const body = el('tbody');
    for (const habit of data.habits) body.append(habitRow(habit, todayDay));

    grid.replaceChildren(el('thead', {}, headRow), body);
    syncChecks();
    markStreaksStale(state.pending > 0); // grade recriada durante marcações em voo: mantém o aviso
  }

  function habitRow(habit, todayDay) {
    const { data } = state;
    const [, m] = data.month.split('-').map(Number);
    const row = el('tr', { dataset: { habitId: habit.id } });
    row.style.setProperty('--habit-color', habit.color);

    row.append(
      el('th', { scope: 'row', class: 'habit-cell' },
        el('div', { class: 'habit-head' },
          el('span', { class: 'habit-name', text: habit.name }),
          el('button', {
            type: 'button', class: 'icon-btn', text: '×', title: 'Excluir hábito',
            'aria-label': `Excluir hábito ${habit.name}`,
            onclick: () => deleteHabit(habit),
          })),
        el('div', {
          class: 'progress', role: 'progressbar', 'aria-label': `Progresso de ${habit.name}`,
          'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0,
        }, el('div', { class: 'progress-fill' })),
        el('div', { class: 'habit-meta' },
          el('span', { class: 'meta-progress' }),
          el('span', {
            class: 'meta-streak',
            title: 'Sequência atual (até hoje) e maior sequência de todos os tempos: não dependem do mês exibido.',
          }, el('span', { class: 'ms-cur' }), el('span', { class: 'ms-max' })))),
    );

    for (let d = 1; d <= data.daysInMonth; d += 1) {
      const date = `${data.month}-${pad2(d)}`;
      const input = el('input', {
        type: 'checkbox', class: 'check',
        'aria-label': `${habit.name} — dia ${pad2(d)}/${pad2(m)}`,
        disabled: date > data.today,
        dataset: { date },
        onchange: (event) => onToggle(habit.id, date, event.target),
      });
      row.append(el('td', { class: `cell${d === todayDay ? ' is-today' : ''}` }, input));
    }
    return row;
  }

  /** Alinha os checkboxes com o estado atual (sem reconstruir a tabela, preservando o foco). */
  function syncChecks() {
    for (const habit of state.data.habits) {
      const row = grid.querySelector(`tr[data-habit-id="${habit.id}"]`);
      if (!row) continue;
      const done = new Set(habit.completedDates);
      for (const input of row.querySelectorAll('input.check')) {
        input.checked = done.has(input.dataset.date);
      }
    }
  }

  /** Atualiza barras de progresso e indicadores numéricos. */
  function updateStats() {
    const { data } = state;
    let sumDone = 0;
    let sumEligible = 0;

    for (const habit of data.habits) {
      const row = grid.querySelector(`tr[data-habit-id="${habit.id}"]`);
      if (!row) continue;
      const done = habit.completedDates.length;
      const eligible = habit.stats.monthEligible;
      const percent = eligible ? Math.round((done / eligible) * 1000) / 10 : 0;

      row.querySelector('.progress-fill').style.width = `${percent}%`;
      row.querySelector('.progress').setAttribute('aria-valuenow', String(Math.round(percent)));
      row.querySelector('.meta-progress').textContent = `${done}/${eligible} dias · ${fmtPercent(percent)}`;
      row.querySelector('.ms-cur').textContent = `Sequência atual: ${habit.stats.currentStreak}`;
      row.querySelector('.ms-max').textContent = `Maior sequência: ${habit.stats.maxStreak}`;

      sumDone += done;
      sumEligible += eligible;
    }

    const rate = sumEligible ? Math.round((sumDone / sumEligible) * 1000) / 10 : 0;
    $('#ind-current').textContent = String(data.overall.currentStreak);
    $('#ind-max').textContent = String(data.overall.maxStreak);
    $('#ind-rate').textContent = fmtPercent(rate);
    $('#overall-fill').style.width = `${rate}%`;
    $('#overall-progress').setAttribute('aria-valuenow', String(Math.round(rate)));
  }

  /* ---------- ações ---------- */

  /** Sequências só são calculadas pelo servidor: enquanto há marcações em voo, sinaliza que estão desatualizadas. */
  function markStreaksStale(stale) {
    for (const node of [$('#ind-current').parentElement, $('#ind-max').parentElement, ...grid.querySelectorAll('.meta-streak')]) {
      node.classList.toggle('is-stale', stale);
    }
    $('.indicators').setAttribute('aria-busy', String(stale));
  }

  function onToggle(habitId, date, input) {
    const habit = state.data.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const done = input.checked;

    // Atualização otimista: grade e barras reagem na hora.
    const set = new Set(habit.completedDates);
    if (done) set.add(date); else set.delete(date);
    habit.completedDates = [...set].sort();
    updateStats();
    markStreaksStale(true);

    state.pending += 1;
    state.queue = state.queue.then(async () => {
      try {
        const data = await api(`/api/habits/${habitId}/completions`, { method: 'PUT', body: { date, done } });
        if (state.pending === 1 && state.month === data.month) {
          state.data = data; // última resposta: reconcilia com o servidor (streaks, taxa)
          syncChecks();
          updateStats();
        }
      } catch (error) {
        if (error.status === 401) {
          showView('login');
        } else {
          toast(error.message, 'error');
          state.needsReload = true;
        }
      } finally {
        state.pending -= 1;
        if (state.pending === 0 && state.needsReload) {
          state.needsReload = false;
          await load(state.month);
        }
        if (state.pending === 0) markStreaksStale(false);
      }
    });
  }

  async function deleteHabit(habit) {
    if (!window.confirm(`Excluir o hábito "${habit.name}" e todos os seus registros?`)) return;
    try {
      await api(`/api/habits/${habit.id}`, { method: 'DELETE' });
      toast('Hábito excluído.');
      await load(state.month);
    } catch (error) {
      if (error.status === 401) showView('login');
      else toast(error.message, 'error');
    }
  }

  function setFormError(message) {
    const node = $('#form-error');
    node.textContent = message || '';
    node.hidden = !message;
  }

  $('#habit-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const nameInput = $('#habit-name');
    const name = nameInput.value.trim();
    if (!name) { setFormError('Informe um nome para o hábito.'); return; }

    const button = $('#habit-submit');
    button.disabled = true;
    setFormError('');
    try {
      await api('/api/habits', { method: 'POST', body: { name, color: $('#habit-color').value } });
      nameInput.value = '';
      await load(state.month);
      toast('Hábito criado.');
    } catch (error) {
      if (error.status === 401) showView('login');
      else setFormError(error.message);
    } finally {
      button.disabled = false;
    }
  });

  $('#prev-month').addEventListener('click', () => load(shiftMonth(state.month, -1)));
  $('#next-month').addEventListener('click', () => load(shiftMonth(state.month, 1)));
  $('#today-btn').addEventListener('click', () => load(state.data.today.slice(0, 7)));
  $('#retry-btn').addEventListener('click', () => { showView('loading'); load(state.month, { initial: true }); });

  $('#logout-btn').addEventListener('click', async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch { /* mesmo com falha, volta para a tela de login */ }
    state.data = null;
    showView('login');
  });

  /* ---------- início ---------- */

  (function init() {
    const params = new URLSearchParams(window.location.search);
    const erro = params.get('erro');
    if (erro) {
      const box = $('#login-error');
      box.textContent = ERROS[erro] || 'Não foi possível entrar. Tente novamente.';
      box.hidden = false;
      window.history.replaceState({}, '', window.location.pathname);
    }
    load(null, { initial: true });
  })();
})();
