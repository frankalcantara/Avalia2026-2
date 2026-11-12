'use strict';

const element = (id) => document.getElementById(id);
const game = element('game');
const welcome = element('welcome');
const gameStatus = element('game-status');
const accessStatus = element('access-status');
const keyboard = element('keyboard');
const loginButton = element('login-button');
const retryButton = element('retry-button');
const statsButton = element('stats-button');
const tiles = [];
const keys = new Map();

const markOrder = { absent: 1, present: 2, correct: 3 };
const markText = {
  absent: 'ausente ou repetida',
  present: 'posição errada',
  correct: 'posição certa',
};

let state = null;
let draft = '';
let busy = false;
let resetAt = NaN;
let clockOffset = 0;
let refreshAfter = 0;

function buildBoard() {
  const board = element('board');
  for (let rowIndex = 0; rowIndex < 6; rowIndex++) {
    const row = document.createElement('div');
    row.className = 'board-row';
    row.setAttribute('role', 'row');
    row.setAttribute('aria-label', `Tentativa ${rowIndex + 1}`);
    const rowTiles = [];
    for (let column = 0; column < 5; column++) {
      const tile = document.createElement('span');
      tile.className = 'tile';
      tile.setAttribute('role', 'gridcell');
      row.append(tile);
      rowTiles.push(tile);
    }
    board.append(row);
    tiles.push(rowTiles);
  }
}

function buildKeyboard() {
  const rows = ['QWERTYUIOP'.split(''), 'ASDFGHJKL'.split(''), ['Enter', ...'ZXCVBNM', 'Backspace']];
  for (const letters of rows) {
    const row = document.createElement('div');
    row.className = 'key-row';
    for (const key of letters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = key.length === 1 ? 'key' : 'key key-wide';
      button.textContent = key === 'Backspace' ? '⌫' : key;
      button.setAttribute('aria-label', key === 'Backspace' ? 'Apagar letra' : key === 'Enter' ? 'Enviar palpite' : key);
      button.addEventListener('click', () => handleKey(key));
      keys.set(key, button);
      row.append(button);
    }
    keyboard.append(row);
  }
}

function renderDraft() {
  const row = tiles[state.attempts.length];
  if (state.status !== 'playing' || !row) return;
  row.forEach((tile, column) => {
    const letter = draft[column] || '';
    tile.textContent = letter;
    tile.setAttribute('aria-label', letter || `Letra ${column + 1} vazia`);
  });
}

function renderBoard(animatedRow = -1) {
  const keyboardMarks = new Map();
  tiles.forEach((row, rowIndex) => {
    const attempt = state.attempts[rowIndex];
    const active = state.status === 'playing' && rowIndex === state.attempts.length;
    row.forEach((tile, column) => {
      const letter = attempt?.guess[column]?.toUpperCase() || '';
      const mark = attempt?.marks[column];
      tile.className = 'tile';
      tile.toggleAttribute('data-active', active);
      tile.textContent = letter;
      if (mark && markOrder[mark]) {
        tile.classList.add(mark);
        if (animatedRow === rowIndex) tile.classList.add('reveal');
        if (markOrder[mark] > (markOrder[keyboardMarks.get(letter)] || 0)) keyboardMarks.set(letter, mark);
      }
      tile.setAttribute('aria-label', markText[mark] ? `${letter}, ${markText[mark]}` : `Letra ${column + 1} vazia`);
    });
  });

  for (const [key, button] of keys) {
    const mark = keyboardMarks.get(key);
    button.classList.remove('absent', 'present', 'correct');
    if (mark) button.classList.add(mark);
    if (key.length === 1) button.setAttribute('aria-label', mark ? `${key}, ${markText[mark]}` : key);
    button.disabled = state.status !== 'playing';
  }

  renderDraft();
}

function renderStats(stats) {
  const summary = element('stats-summary');
  const distribution = element('distribution');
  summary.replaceChildren();
  distribution.replaceChildren();

  for (const [label, value] of [
    ['Partidas', stats.played], ['Vitórias', stats.wins], ['Sequência', stats.streak], ['Recorde', stats.best],
  ]) {
    const group = document.createElement('div');
    const term = document.createElement('dt');
    const result = document.createElement('dd');
    term.textContent = label;
    result.textContent = value;
    group.append(term, result);
    summary.append(group);
  }

  const max = Math.max(1, ...stats.distribution);
  stats.distribution.forEach((count, index) => {
    const row = document.createElement('li');
    const number = document.createElement('span');
    const meter = document.createElement('meter');
    const total = document.createElement('span');
    number.textContent = index + 1;
    meter.setAttribute('aria-label', `Vitórias na tentativa ${index + 1}`);
    meter.max = max;
    meter.value = count;
    total.textContent = count;
    row.append(number, meter, total);
    distribution.append(row);
  });
}

function avatarUrl(user) {
  if (typeof user.avatar === 'string' && user.avatar.startsWith('https://cdn.discordapp.com/')) {
    return user.avatar;
  }
  if (/^\d+$/.test(user.user_id)) {
    if (typeof user.avatar === 'string' && /^(a_)?[a-f0-9]{32}$/i.test(user.avatar)) {
      return `https://cdn.discordapp.com/avatars/${user.user_id}/${user.avatar}.png?size=64`;
    }
    const index = (BigInt(user.user_id) >> 22n) % 6n;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
  }
  return null;
}

function showGame(data, animatedRow) {
  state = data;
  resetAt = typeof data.nextResetAt === 'number' ? data.nextResetAt : Date.parse(data.nextResetAt);
  const serverTime = typeof data.serverNow === 'number' ? data.serverNow : Date.parse(data.serverNow);
  clockOffset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0;
  const avatar = element('avatar');
  const url = avatarUrl(data.user);
  if (url && avatar.getAttribute('src') !== url) avatar.src = url;
  avatar.hidden = !url;
  const username = element('username');
  username.textContent = data.user.username;
  username.title = `Discord · ID ${data.user.user_id}`;
  const formatted = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  element('game-date').textContent = formatted.format(new Date(data.date));
  renderBoard(animatedRow);
  renderStats(data.stats);
  welcome.hidden = true;
  game.hidden = false;
  statsButton.hidden = false;

  if (data.status === 'won') {
    const count = data.attempts.length;
    gameStatus.textContent = `Você acertou em ${count} ${count === 1 ? 'tentativa' : 'tentativas'}!`;
  } else if (data.status === 'lost') {
    gameStatus.textContent = 'Fim das tentativas. Volte amanhã para um novo desafio.';
  } else {
    gameStatus.textContent = `Tentativa ${data.attempts.length + 1} de 6`;
  }
  renderCountdown();
}

function showWelcome(message, canLogin = false, canRetry = false) {
  state = null;
  draft = '';
  resetAt = NaN;
  clockOffset = 0;
  game.hidden = true;
  statsButton.hidden = true;
  if (element('stats-dialog').open) element('stats-dialog').close();
  welcome.hidden = false;
  accessStatus.textContent = message;
  loginButton.hidden = !canLogin;
  retryButton.hidden = !canRetry;
}

async function api(path, options = {}) {
  const response = await fetch(path, { cache: 'no-store', ...options });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const error = new Error(data.error || 'Não foi possível concluir a solicitação.');
    error.status = response.status;
    throw error;
  }
  return response;
}

async function loadGame() {
  if (busy) return;
  busy = true;
  if (!state) showWelcome('Verificando sua sessão…');
  try {
    const response = await api('/api/game');
    draft = '';
    showGame(await response.json());
  } catch (error) {
    if (error.status === 401) {
      const failedLogin = new URLSearchParams(location.search).get('login') === 'error';
      showWelcome(failedLogin ? 'Não foi possível entrar pelo Discord. Tente novamente.' : 'Entre para liberar o desafio de hoje.', true);
    } else if (state) {
      gameStatus.textContent = 'Não foi possível atualizar o desafio. Tentaremos novamente.';
    } else {
      showWelcome('Não foi possível carregar o jogo.', false, true);
    }
  } finally {
    busy = false;
  }
}

async function submitGuess() {
  if (draft.length < 5) {
    gameStatus.textContent = 'Digite uma palavra de cinco letras.';
    return;
  }

  busy = true;
  const previousCount = state.attempts.length;
  const previousDate = state.date;
  gameStatus.textContent = 'Conferindo seu palpite…';
  let reload = false;
  let conflictMessage;
  try {
    const response = await api('/api/game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: draft, date: previousDate }),
    });
    const data = await response.json();
    draft = '';
    showGame(data, data.date === previousDate && data.attempts.length > previousCount ? data.attempts.length - 1 : -1);
  } catch (error) {
    if (error.status === 401) {
      showWelcome('Sua sessão expirou. Entre novamente para recuperar suas tentativas.', true);
    } else if (error.status === 409 || !error.status) {
      reload = true;
      if (error.status === 409) conflictMessage = error.message;
    } else {
      gameStatus.textContent = error.message;
    }
  } finally {
    busy = false;
  }
  if (reload) {
    await loadGame();
    if (conflictMessage && state?.date === previousDate && state.status === 'playing') {
      gameStatus.textContent = conflictMessage;
    }
  }
}

function handleKey(key) {
  if (!state || busy || state.status !== 'playing' || document.querySelector('dialog[open]')) return;
  if (key === 'Enter') {
    void submitGuess();
  } else {
    if (key === 'Backspace') draft = draft.slice(0, -1);
    if (/^[A-Z]$/.test(key) && draft.length < 5) draft += key;
    renderDraft();
  }
}

function renderCountdown() {
  if (!state || !Number.isFinite(resetAt)) return;
  const now = Date.now();
  const remaining = Math.max(0, Math.ceil((resetAt - now - clockOffset) / 1000));
  const parts = [Math.floor(remaining / 3600), Math.floor(remaining / 60) % 60, remaining % 60];
  element('countdown').textContent = parts.map((part) => String(part).padStart(2, '0')).join(':');
  if (!remaining && !busy && now >= refreshAfter) {
    refreshAfter = now + 5000;
    void loadGame();
  }
}

document.addEventListener('keydown', (event) => {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  if (!state || document.querySelector('dialog[open]')) return;
  if (event.key === 'Enter' && event.target instanceof Element && event.target.closest('button, a')) return;
  const key = event.key.length === 1
    ? event.key.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase()
    : event.key;
  if (key === 'Enter' || key === 'Backspace' || /^[A-Z]$/.test(key)) {
    event.preventDefault();
    handleKey(key);
  }
});

element('help-button').addEventListener('click', () => element('help-dialog').showModal());
statsButton.addEventListener('click', () => element('stats-dialog').showModal());
retryButton.addEventListener('click', loadGame);
element('logout-button').addEventListener('click', async () => {
  if (busy) return;
  busy = true;
  try {
    await api('/api/auth/logout', { method: 'POST' });
    showWelcome('Você saiu do jogo.', true);
    loginButton.focus();
  } catch (error) {
    if (error.status === 401) showWelcome('Sua sessão expirou.', true);
    else gameStatus.textContent = 'Não foi possível sair. Tente novamente.';
  } finally {
    busy = false;
  }
});

buildBoard();
buildKeyboard();
setInterval(renderCountdown, 1000);
void loadGame();
