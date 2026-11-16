"use strict";

const $ = (id) => document.getElementById(id);
const state = { user: null, game: null, busy: false };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
const NS = "http://www.w3.org/2000/svg";

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

/* ---------- Ilustrações dos astros (SVG montado por nós, sem dados do servidor) ---------- */
// id: [cor clara, cor escura, traços: c=crateras b=faixas r=anel l=continentes s=raios k=cauda]
const BODIES = {
  mercurio: ["#cfc9be", "#4f4a44", "c"], venus: ["#ffd98a", "#b8571a", "b"], terra: ["#6fd3ff", "#0a3d91", "l"],
  marte: ["#ff9a6b", "#7d2412", "c"], jupiter: ["#f6dcb4", "#9a5a33", "b"], saturno: ["#f7e4a8", "#a8842f", "br"],
  urano: ["#b2fbf5", "#2b9c9a", "r"], netuno: ["#7f9bff", "#1a2796", "b"], lua: ["#f1f1f6", "#6f6f7c", "c"],
  sol: ["#fff3b0", "#ff6a00", "s"], plutao: ["#ecd3c4", "#8a5a4a", "c"], cometa: ["#e0f7ff", "#3aa0ff", "k"],
};

function el(tag, attrs = {}, kids = []) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
}

function buildArt(id) {
  const def = BODIES[id];
  if (!def) return null;
  const [a, b, f] = def;
  const gid = "g-" + id, cid = "c-" + id;
  const R = f.includes("s") ? 24 : 30;
  const svg = el("svg", { viewBox: "0 0 100 100", "aria-hidden": "true" });
  const grad = el("radialGradient", { id: gid, cx: ".35", cy: ".3", r: ".85" }, [
    el("stop", { offset: "0", "stop-color": a }), el("stop", { offset: "1", "stop-color": b })]);
  svg.append(el("defs", {}, [grad, el("clipPath", { id: cid }, [el("circle", { cx: 50, cy: 50, r: R })])]));
  const ringT = "rotate(" + (f.includes("r") && id === "urano" ? 70 : -20) + " 50 50)";
  if (f.includes("r")) svg.append(el("ellipse", { cx: 50, cy: 50, rx: 46, ry: 12, fill: "none", stroke: a, "stroke-width": 4, opacity: ".55", transform: ringT }));
  if (f.includes("s")) for (let i = 0; i < 12; i++) svg.append(el("line", { x1: 50, y1: 12, x2: 50, y2: 2, stroke: a, "stroke-width": 3, "stroke-linecap": "round", transform: "rotate(" + i * 30 + " 50 50)" }));
  if (f.includes("k")) {
    svg.append(el("path", { d: "M62 38 C40 50 22 70 6 94 C30 84 52 66 70 50Z", fill: b, opacity: ".55" }));
    svg.append(el("path", { d: "M60 40 C46 52 34 62 22 76 C40 68 54 58 66 46Z", fill: a, opacity: ".8" }));
    svg.append(el("circle", { cx: 68, cy: 38, r: 13, fill: "url(#" + gid + ")" }));
    return svg;
  }
  svg.append(el("circle", { cx: 50, cy: 50, r: R, fill: "url(#" + gid + ")" }));
  const clip = el("g", { "clip-path": "url(#" + cid + ")" });
  if (f.includes("b")) [38, 48, 58].forEach((y, i) => clip.append(el("rect", { x: 20, y, width: 60, height: 5 + i * 1.5, fill: b, opacity: ".35" })));
  if (f.includes("c")) [[40, 42, 5], [58, 54, 7], [47, 64, 3.5]].forEach(([x, y, r]) => clip.append(el("circle", { cx: x, cy: y, r, fill: b, opacity: ".45" })));
  if (f.includes("l")) {
    clip.append(el("path", { d: "M34 38 Q44 32 52 40 Q48 50 38 52 Q30 46 34 38Z", fill: "#4cc26a" }));
    clip.append(el("path", { d: "M56 56 Q68 52 72 62 Q66 72 56 68Z", fill: "#4cc26a" }));
  }
  svg.append(clip);
  if (f.includes("r")) svg.append(el("path", { d: "M4 50 A46 12 0 0 0 96 50", fill: "none", stroke: a, "stroke-width": 4, transform: ringT }));
  return svg;
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
  const art = el.querySelector(".memory-art");
  const name = el.querySelector(".memory-name");
  art.replaceChildren();
  name.textContent = "";
  let desc;
  if (String(face.text).startsWith("img:")) {
    const svg = buildArt(face.text.slice(4));
    if (svg) art.append(svg);
    desc = "Imagem de " + face.text.slice(4);
  } else {
    name.textContent = face.text;
    desc = "Nome: " + face.text;
  }
  el.setAttribute("aria-label", desc);
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

  pointerFx();
  $("newGameBtn").addEventListener("click", startGame);
  await loadMe();
  if (state.user) {
    loadLeaderboard();
    startGame();
  }
}

init();
