"use strict";

const $ = (id) => document.getElementById(id);
const state = { user: null, game: null, busy: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

const AUTH_ERRORS = {
  access_denied: "Login cancelado.",
  invalid_state: "Sessão de login inválida. Tente novamente.",
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

/* ---------- Ilustrações (SVG fixo no código; nenhum dado do servidor entra no HTML) ---------- */
// id: [cor 1 do fundo, cor 2 do fundo, desenho]
const ART = {
  foguete: ["#3b1d8f", "#ff4d8d", `<path d="M50 6C68 22 70 48 64 72H36C30 48 32 22 50 6Z" fill="#fff"/><circle cx="50" cy="38" r="9" fill="#5ee7ff"/><path d="M36 54L18 76L36 72ZM64 54L82 76L64 72Z" fill="#ff4d6d"/><path d="M41 76L50 98L59 76Z" fill="#ffb703"/>`],
  astronauta: ["#0f4c81", "#5ee7ff", `<rect x="28" y="72" width="44" height="24" rx="10" fill="#e8ecff"/><circle cx="50" cy="42" r="30" fill="#fff"/><rect x="28" y="30" width="44" height="26" rx="13" fill="#1b1f4b"/><ellipse cx="38" cy="40" rx="6" ry="3" fill="#fff" stroke="none"/><circle cx="50" cy="84" r="4" fill="#ff4d6d"/>`],
  ovni: ["#12324a", "#7cfc5b", `<path d="M30 48A20 20 0 0 1 70 48Z" fill="#9ff3ff"/><ellipse cx="50" cy="52" rx="42" ry="13" fill="#b0b8d8"/><circle cx="26" cy="54" r="3.5" fill="#ffd60a"/><circle cx="50" cy="58" r="3.5" fill="#ffd60a"/><circle cx="74" cy="54" r="3.5" fill="#ffd60a"/><path d="M38 66L24 96H76L62 66Z" fill="#fff" opacity=".35" stroke="none"/>`],
  buraco: ["#2a0a4a", "#ff7a00", `<circle cx="50" cy="50" r="40" fill="none" stroke="#a259ff" stroke-width="4"/><ellipse cx="50" cy="50" rx="46" ry="13" fill="none" stroke="#ffb703" stroke-width="8" transform="rotate(-20 50 50)"/><circle cx="50" cy="50" r="22" fill="#000"/>`],
  alien: ["#0b3d2e", "#ffe14d", `<path d="M50 10C80 10 90 46 66 68C58 76 42 76 34 68C10 46 20 10 50 10Z" fill="#7cfc5b"/><ellipse cx="36" cy="44" rx="9" ry="14" fill="#000" transform="rotate(20 36 44)"/><ellipse cx="64" cy="44" rx="9" ry="14" fill="#000" transform="rotate(-20 64 44)"/><circle cx="34" cy="40" r="3" fill="#fff" stroke="none"/><circle cx="62" cy="40" r="3" fill="#fff" stroke="none"/><path d="M42 64Q50 70 58 64M34 12L26 4M66 12L74 4" fill="none"/><circle cx="26" cy="4" r="3" fill="#ffe14d"/><circle cx="74" cy="4" r="3" fill="#ffe14d"/>`],
  lua: ["#1a1f6b", "#6f7bff", `<path d="M60 10A40 40 0 1 0 90 66A36 36 0 0 1 60 10Z" fill="#ffe27a"/><circle cx="30" cy="42" r="4" fill="#e0b84a"/><circle cx="38" cy="66" r="6" fill="#e0b84a"/><circle cx="78" cy="22" r="4" fill="#fff" stroke="none"/><circle cx="88" cy="40" r="2.5" fill="#fff" stroke="none"/>`],
  saturno: ["#5b2a86", "#ff9d00", `<ellipse cx="50" cy="50" rx="46" ry="12" fill="none" stroke="#ffe0a3" stroke-width="7" transform="rotate(-20 50 50)"/><circle cx="50" cy="50" r="27" fill="#ffb347"/><path d="M26 42Q50 52 74 40M25 56Q50 66 75 54" fill="none" stroke="#e07b00" stroke-width="3"/><path d="M4 50A46 12 0 0 0 96 50" fill="none" stroke="#ffe0a3" stroke-width="7" transform="rotate(-20 50 50)"/>`],
  cometa: ["#001a4d", "#00b4d8", `<path d="M72 30C48 40 26 62 6 94C36 86 64 66 80 46Z" fill="#90e0ef"/><path d="M70 34C52 46 40 58 26 78C46 70 62 58 76 44Z" fill="#fff" stroke="none" opacity=".7"/><circle cx="76" cy="32" r="16" fill="#ffd60a"/><circle cx="71" cy="27" r="4" fill="#fff" stroke="none"/>`],
  satelite: ["#2b1055", "#ff5fa2", `<rect x="4" y="38" width="30" height="24" fill="#2a6bff"/><rect x="66" y="38" width="30" height="24" fill="#2a6bff"/><path d="M19 38V62M4 50H34M81 38V62M66 50H96M50 34V18" fill="none" stroke="#9ec1ff" stroke-width="2"/><rect x="36" y="34" width="28" height="32" rx="6" fill="#e8ecff"/><circle cx="50" cy="50" r="7" fill="#ff4d6d"/><circle cx="50" cy="15" r="4" fill="#ffd60a"/>`],
  sol: ["#ff4d00", "#ffb703", `<path d="M50 4V16M50 84V96M4 50H16M84 50H96M17 17L25 25M75 75L83 83M83 17L75 25M25 75L17 83" fill="none" stroke="#fff3b0" stroke-width="5"/><circle cx="50" cy="50" r="28" fill="#ffd60a"/><rect x="28" y="40" width="20" height="12" rx="4" fill="#111"/><rect x="52" y="40" width="20" height="12" rx="4" fill="#111"/><path d="M47 45H53M36 62Q50 72 64 62" fill="none"/>`],
  galaxia: ["#10002b", "#c77dff", `<circle cx="50" cy="50" r="40" fill="#240046" stroke="none"/><path d="M50 50C50 38 64 36 68 46C74 60 58 74 42 70C22 64 20 38 38 26C58 14 84 32 82 56" fill="none" stroke="#ff7ad9" stroke-width="6"/><path d="M50 50C50 62 36 64 32 54C26 40 42 26 58 30C78 36 80 62 62 76" fill="none" stroke="#5ee7ff" stroke-width="5"/><circle cx="50" cy="50" r="7" fill="#fff"/>`],
  telescopio: ["#0b3d91", "#ffb703", `<path d="M44 58L30 96M52 60V96M60 58L74 94" fill="none" stroke="#e8ecff" stroke-width="5"/><rect x="10" y="30" width="62" height="22" rx="5" fill="#ff9d00" transform="rotate(-25 40 41)"/><rect x="60" y="20" width="12" height="26" rx="3" fill="#ffd60a" transform="rotate(-25 40 41)"/><circle cx="84" cy="16" r="4" fill="#fff" stroke="none"/><circle cx="16" cy="60" r="3" fill="#fff" stroke="none"/>`],
};

function buildArt(id) {
  const d = ART[id];
  if (!d) return null;
  const doc = new DOMParser().parseFromString(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true"><g stroke="#0b0d1c" stroke-width="3" stroke-linejoin="round" stroke-linecap="round">' + d[2] + "</g></svg>",
    "image/svg+xml"
  );
  return document.importNode(doc.documentElement, true);
}

function heroArt() {
  const box = document.createElement("div");
  box.className = "hero-art";
  box.setAttribute("aria-hidden", "true");
  [["foguete", 4, 0, -10], ["ovni", 40, 6, 8], ["alien", 66, 32, -6], ["lua", 2, 40, 7], ["galaxia", 32, 52, -9], ["sol", 62, 66, 10]].forEach(([id, x, y, r], k) => {
    const c = document.createElement("div");
    c.className = "hc";
    c.style.cssText = `--x:${x}%;--y:${y}%;--r:${r}deg;--k:${k};--c1:${ART[id][0]};--c2:${ART[id][1]}`;
    c.append(buildArt(id));
    box.append(c);
  });
  $("loginPrompt").append(box);
}

/* ---------- Cabeçalho, login e título animado ---------- */
function splitText(root) {
  root.querySelectorAll("[data-split]").forEach((h) => {
    if (h.dataset.done) return;
    const text = h.textContent;
    h.dataset.done = "1";
    h.setAttribute("aria-label", text);
    h.replaceChildren(...[...text].map((c, i) => {
      const s = document.createElement("span");
      s.className = "ch";
      s.setAttribute("aria-hidden", "true");
      s.style.setProperty("--i", i);
      s.textContent = c === " " ? "\u00a0" : c;
      return s;
    }));
  });
}

function renderHeader() {
  const box = $("discordProfile");
  box.replaceChildren();
  const isAuth = Boolean(state.user);
  $("topbar").hidden = !isAuth;
  $("loginPrompt").hidden = isAuth;
  $("gameSection").hidden = !isAuth;
  $("rankingSection").hidden = !isAuth;

  if (isAuth) {
    const wrap = document.createElement("div");
    wrap.className = "profile";
    const avatar = String(state.user.avatar || "");
    if (avatar.startsWith("https://cdn.discordapp.com/")) {
      const img = document.createElement("img");
      img.src = avatar;
      img.alt = "Avatar de " + state.user.username;
      wrap.append(img);
    }
    const info = document.createElement("div");
    info.className = "who";
    const name = document.createElement("span");
    name.textContent = state.user.username;
    const id = document.createElement("small");
    id.textContent = "ID " + state.user.userId;
    info.append(name, id);
    const out = document.createElement("button");
    out.type = "button";
    out.className = "btn-ghost";
    out.textContent = "Desconectar";
    out.addEventListener("click", logout);
    wrap.append(info, out);
    box.append(wrap);
  }
  splitText(document);
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

/* ---------- Cartas ---------- */
function createCard(token, i) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "memory-card";
  btn.style.setProperty("--i", i);
  btn.setAttribute("aria-label", "Carta virada para baixo");

  const tilt = document.createElement("span");
  tilt.className = "tilt";
  const inner = document.createElement("span");
  inner.className = "memory-inner";
  const back = document.createElement("span");
  back.className = "memory-face memory-back";
  const front = document.createElement("span");
  front.className = "memory-face memory-front";
  const art = document.createElement("span");
  art.className = "memory-art";
  const label = document.createElement("span");
  label.className = "memory-name";
  front.append(art, label);
  inner.append(back, front);
  tilt.append(inner);
  btn.append(tilt);

  // inclinação 3D que segue o mouse
  btn.addEventListener("pointermove", (e) => {
    if (calm) return;
    const r = btn.getBoundingClientRect();
    tilt.style.setProperty("--ry", ((e.clientX - r.left) / r.width - 0.5) * 22 + "deg");
    tilt.style.setProperty("--rx", (0.5 - (e.clientY - r.top) / r.height) * 22 + "deg");
  });
  btn.addEventListener("pointerleave", () => { tilt.style.setProperty("--rx", "0deg"); tilt.style.setProperty("--ry", "0deg"); });
  btn.addEventListener("click", () => onCardClick(token));
  return btn;
}

function reveal(face) {
  const el = state.game.cards.get(face.token).el;
  const art = el.querySelector(".memory-art"), name = el.querySelector(".memory-name");
  art.replaceChildren();
  name.textContent = "";
  const isImg = String(face.text).startsWith("img:");
  if (isImg) {
    const id = face.text.slice(4), svg = buildArt(id);
    if (svg) { art.append(svg); el.style.setProperty("--c1", ART[id][0]); el.style.setProperty("--c2", ART[id][1]); }
  } else name.textContent = face.text;
  el.dataset.kind = isImg ? "img" : "name";
  el.setAttribute("aria-label", (isImg ? "Imagem de " : "Nome: ") + (isImg ? face.text.slice(4) : face.text));
  el.classList.add("flipped");
}

function hide(token) {
  const el = state.game.cards.get(token).el;
  el.classList.remove("flipped");
  el.setAttribute("aria-label", "Carta virada para baixo");
  setTimeout(() => {
    if (!el.classList.contains("flipped")) {
      el.querySelector(".memory-art").replaceChildren();
      el.querySelector(".memory-name").textContent = "";
      delete el.dataset.kind;
    }
  }, 900);
}

function burst(el, count = 14) {
  if (calm) return;
  const r = el.getBoundingClientRect();
  const colors = ["#f2c46d", "#62e6ff", "#ff5fa2", "#ffffff"];
  for (let i = 0; i < count; i++) {
    const s = document.createElement("i");
    s.className = "spark";
    s.style.background = colors[i % colors.length];
    s.style.left = r.left + r.width / 2 + "px";
    s.style.top = r.top + r.height / 2 + "px";
    document.body.append(s);
    const ang = (Math.PI * 2 * i) / count, d = 60 + Math.random() * 90;
    s.animate(
      [{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${Math.cos(ang) * d}px, ${Math.sin(ang) * d}px) scale(0)`, opacity: 0 }],
      { duration: 800 + Math.random() * 400, easing: "cubic-bezier(.16,1,.3,1)" }
    ).finished.then(() => s.remove());
  }
}

function markMatched(token) {
  const el = state.game.cards.get(token).el;
  el.classList.add("matched");
  el.disabled = true;
  burst(el);
}

function updateStats(moves, found, total, efficiency) {
  $("gameSection").style.setProperty("--p", total ? found / total : 0);
  const set = (id, v) => {
    const n = $(id);
    if (n.textContent === v) return;
    n.textContent = v;
    n.classList.remove("pop");
    void n.offsetWidth;
    n.classList.add("pop");
  };
  set("movesCount", String(moves));
  set("pairsCount", found + "/" + total);
  set("efficiency", efficiency == null ? "—" : efficiency + "%");
}

async function startGame() {
  if (state.busy) return;
  state.busy = true;
  setStatus("Embaralhando as cartas no servidor…");
  const r = await api("/api/game/start", { method: "POST" });
  state.busy = false;
  if (r.status === 401) { await loadMe(); return; }
  if (!r.ok) { setStatus("Não foi possível iniciar a partida. Tente de novo.", true); return; }

  const board = $("board");
  board.replaceChildren();
  const cards = new Map();
  r.data.cards.forEach((c, i) => {
    const el = createCard(c.token, i);
    cards.set(c.token, { el });
    board.append(el);
  });
  // as cartas voam do centro do tabuleiro até a posição final
  const b = board.getBoundingClientRect();
  for (const { el } of cards.values()) {
    const r2 = el.getBoundingClientRect();
    el.style.setProperty("--dx", b.left + b.width / 2 - (r2.left + r2.width / 2) + "px");
    el.style.setProperty("--dy", b.top + b.height / 2 - (r2.top + r2.height / 2) + "px");
  }
  state.game = { id: r.data.gameId, cards, pending: null, finished: false, total: r.data.pairsTotal };
  updateStats(0, 0, r.data.pairsTotal, null);
  setStatus("Vire a primeira carta.");
}

async function onCardClick(token) {
  const game = state.game;
  if (!game || game.finished || state.busy || game.pending === token) return;
  state.busy = true;
  $("board").classList.add("busy");
  try {
    const r = await api("/api/game/pick", { method: "POST", body: { gameId: game.id, token } });
    if (r.status === 401) { await loadMe(); return; }
    if (!r.ok) { setStatus("Jogada rejeitada pelo servidor.", true); return; }

    const d = r.data;
    if (d.state === "first") {
      reveal(d.card);
      game.pending = token;
      setStatus("Agora escolha a segunda carta.");
      return;
    }

    reveal(d.second);
    updateStats(d.moves, d.pairsFound, d.pairsTotal, d.efficiency);
    if (d.match) {
      await sleep(700);
      markMatched(d.first.token);
      markMatched(d.second.token);
      setStatus("Par encontrado!");
    } else {
      setStatus("Não combinam. Memorize as posições.");
      await sleep(1100);
      for (const t of [d.first.token, d.second.token]) {
        const c = state.game.cards.get(t).el;
        c.classList.add("shake");
        setTimeout(() => c.classList.remove("shake"), 500);
      }
      hide(d.first.token);
      hide(d.second.token);
    }
    game.pending = null;
    if (d.finished) {
      game.finished = true;
      setStatus("Partida concluída em " + d.moves + " movimentos. Eficiência: " + d.efficiency + "%.");
      for (const { el } of game.cards.values()) burst(el, 8);
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
    li.textContent = "Nenhuma partida concluída ainda. Seja o primeiro!";
    list.append(li);
    return;
  }
  for (const e of entries) {
    const li = document.createElement("li");
    const n = document.createElement("b");
    n.textContent = e.username;
    const v = document.createElement("span");
    v.textContent = e.efficiency + "% · " + e.moves + " movimentos";
    li.append(n, v);
    list.append(li);
  }
}

/* ---------- Mouse: holofote, paralaxe e botões magnéticos ---------- */
function pointerFx() {
  if (calm) return;
  const root = document.documentElement;
  addEventListener("pointermove", (e) => {
    root.style.setProperty("--mx", e.clientX + "px");
    root.style.setProperty("--my", e.clientY + "px");
    root.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
    root.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
  });
  document.querySelectorAll(".magnetic").forEach((b) => {
    b.addEventListener("pointermove", (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.25}px, ${(e.clientY - r.top - r.height / 2) * 0.35}px)`;
    });
    b.addEventListener("pointerleave", () => { b.style.transform = ""; });
  });
}

async function init() {
  const params = new URLSearchParams(location.search);
  const err = params.get("auth_error");
  if (err) {
    const msg = $("loginMessage");
    msg.textContent = AUTH_ERRORS[err] || "Falha na autenticação via Discord.";
    msg.classList.add("error");
  }
  if (params.has("auth_error") || params.has("login")) history.replaceState(null, "", "/");

  heroArt();
  pointerFx();
  $("newGameBtn").addEventListener("click", startGame);
  await loadMe();
  if (state.user) {
    loadLeaderboard();
    startGame();
  }
}

init();
