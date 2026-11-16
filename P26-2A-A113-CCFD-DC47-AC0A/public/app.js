"use strict";

const $ = (id) => document.getElementById(id);
const state = { user: null, game: null, busy: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AUTH_ERRORS = {
  access_denied: "Login cancelado.",
  invalid_state: "Sessão de login inválida. Tente entrar novamente.",
  token_exchange_failed: "O Discord recusou o login. Tente novamente.",
  fetch_user_failed: "Não foi possível ler seu perfil do Discord.",
  missing_credentials: "O servidor ainda não está configurado para o login.",
};

async function api(path, options = {}) {
  const init = { method: options.method || "GET", credentials: "same-origin", headers: {} };
  if (options.body) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }
  try {
    const res = await fetch(path, init);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "network" } };
  }
}

function setStatus(msg, isError = false) {
  const el = $("statusMessage");
  el.textContent = msg;
  el.classList.toggle("error", isError);
}

/* ---------- Cabeçalho com dados do Discord ---------- */
function renderHeader() {
  const box = $("discordProfile");
  box.replaceChildren();
  if (!state.user) {
    const a = document.createElement("a");
    a.href = "/api/auth/discord";
    a.textContent = "Entrar com Discord";
    box.append(a);
  } else {
    const wrap = document.createElement("span");
    wrap.className = "profile";
    const avatar = String(state.user.avatar || "");
    if (avatar.startsWith("https://cdn.discordapp.com/")) {
      const img = document.createElement("img");
      img.src = avatar;
      img.alt = "Avatar de " + state.user.username;
      wrap.append(img);
    }
    const name = document.createElement("span");
    name.textContent = state.user.username;
    const id = document.createElement("small");
    id.textContent = "ID " + state.user.userId;
    const out = document.createElement("button");
    out.type = "button";
    out.className = "btn-ghost";
    out.textContent = "Sair";
    out.addEventListener("click", logout);
    wrap.append(name, id, out);
    box.append(wrap);
  }
  $("loginPrompt").hidden = Boolean(state.user);
  $("gameSection").hidden = !state.user;
  $("rankingSection").hidden = !state.user;
}

async function loadMe() {
  const r = await api("/api/me");
  state.user = r.ok && r.data.authenticated ? r.data.user : null;
  renderHeader();
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  state.user = null;
  state.game = null;
  renderHeader();
}

/* ---------- Tabuleiro ---------- */
function createCard(token) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "memory-card";
  btn.setAttribute("aria-label", "Carta virada para baixo");
  const inner = document.createElement("span");
  inner.className = "memory-inner";
  const back = document.createElement("span");
  back.className = "memory-face memory-back";
  back.textContent = "?";
  const front = document.createElement("span");
  front.className = "memory-face memory-front";
  const kind = document.createElement("small");
  kind.className = "memory-kind";
  const text = document.createElement("code");
  text.className = "memory-text";
  front.append(kind, text);
  inner.append(back, front);
  btn.append(inner);
  btn.addEventListener("click", () => onCardClick(token));
  return btn;
}

function reveal(face) {
  const entry = state.game.cards.get(face.token);
  const el = entry.el;
  const label = face.kind === "code" ? "CÓDIGO" : "SAÍDA";
  el.dataset.kind = face.kind;
  el.querySelector(".memory-kind").textContent = label;
  el.querySelector(".memory-text").textContent = face.text;
  el.setAttribute("aria-label", label + ": " + face.text);
  el.classList.add("flipped");
}

function hide(token) {
  const el = state.game.cards.get(token).el;
  el.classList.remove("flipped");
  el.setAttribute("aria-label", "Carta virada para baixo");
  setTimeout(() => {
    if (!el.classList.contains("flipped")) {
      el.querySelector(".memory-kind").textContent = "";
      el.querySelector(".memory-text").textContent = "";
    }
  }, 500);
}

function markMatched(token) {
  const el = state.game.cards.get(token).el;
  el.classList.add("matched");
  el.disabled = true;
}

function updateStats(moves, found, total, efficiency) {
  $("movesCount").textContent = String(moves);
  $("pairsCount").textContent = found + "/" + total;
  $("efficiency").textContent = efficiency == null ? "—" : efficiency + "%";
}

async function startGame() {
  if (state.busy) return;
  state.busy = true;
  setStatus("Embaralhando no servidor...");
  const r = await api("/api/game/start", { method: "POST" });
  state.busy = false;
  if (r.status === 401) { await loadMe(); return; }
  if (!r.ok) { setStatus("Não foi possível iniciar a partida. Tente novamente.", true); return; }

  const board = $("board");
  board.replaceChildren();
  const cards = new Map();
  for (const c of r.data.cards) {
    const el = createCard(c.token);
    cards.set(c.token, { el });
    board.append(el);
  }
  state.game = { id: r.data.gameId, cards, pending: null, finished: false, total: r.data.pairsTotal };
  updateStats(0, 0, r.data.pairsTotal, null);
  setStatus("Partida iniciada. Vire a primeira carta!");
}

async function onCardClick(token) {
  const game = state.game;
  if (!game || game.finished || state.busy || game.pending === token) return;
  state.busy = true;
  $("board").classList.add("busy");
  try {
    const r = await api("/api/game/pick", { method: "POST", body: { gameId: game.id, token } });
    if (r.status === 401) { await loadMe(); return; }
    if (!r.ok) { setStatus("Jogada recusada pelo servidor (" + (r.data.error || "erro") + ").", true); return; }

    const d = r.data;
    if (d.state === "first") {
      reveal(d.card);
      game.pending = token;
      setStatus("Agora vire a segunda carta.");
      return;
    }

    reveal(d.second);
    updateStats(d.moves, d.pairsFound, d.pairsTotal, d.efficiency);
    if (d.match) {
      await sleep(450);
      markMatched(d.first.token);
      markMatched(d.second.token);
      setStatus("É um par!");
    } else {
      setStatus("Não é um par. Memorize as cartas.");
      await sleep(1000);
      hide(d.first.token);
      hide(d.second.token);
    }
    game.pending = null;
    if (d.finished) {
      game.finished = true;
      setStatus("Parabéns! Todos os pares em " + d.moves + " movimentos. Eficiência: " + d.efficiency + "%.");
      loadLeaderboard();
    }
  } finally {
    state.busy = false;
    $("board").classList.remove("busy");
  }
}

async function loadLeaderboard() {
  const list = $("leaderboard");
  const r = await api("/api/game/leaderboard");
  list.replaceChildren();
  const entries = r.ok && Array.isArray(r.data.entries) ? r.data.entries : [];
  if (!entries.length) {
    const li = document.createElement("li");
    li.textContent = "Nenhuma partida finalizada ainda.";
    list.append(li);
    return;
  }
  for (const e of entries) {
    const li = document.createElement("li");
    li.textContent = e.username + " — eficiência " + e.efficiency + "% (" + e.moves + " movimentos)";
    list.append(li);
  }
}

async function init() {
  const params = new URLSearchParams(location.search);
  const err = params.get("auth_error");
  if (err) {
    const msg = $("loginMessage");
    msg.textContent = AUTH_ERRORS[err] || "Não foi possível concluir o login.";
    msg.classList.add("error");
  }
  if (params.has("auth_error") || params.has("login")) history.replaceState(null, "", "/");

  $("newGameBtn").addEventListener("click", startGame);
  await loadMe();
  if (state.user) {
    loadLeaderboard();
    startGame();
  }
}

init();
