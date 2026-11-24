// Cypher — controlador principal da interface (rotas, partida e desafio)

import { Api } from "./api.js";
import { el, mountIcons, setupSheet, toast, announce, closeSheet, spinner, copyText, avatarImg, formatLongDate, ICONS } from "./ui.js";
import { Board, Keyboard } from "./board.js";
import { renderWordmark, renderDial, startDemo } from "./demo.js";
import { openResult, openStats, openVaults, openRanking, openSettings, openHelp } from "./panels.js";

const $ = (id) => document.getElementById(id);
const MODES = ["classico", "sombra", "desafio"];

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* armazenamento indisponível */ } },
};

const ctx = {
  me: null,
  colorblind: () => document.documentElement.dataset.cb === "on",
  setColorblind(on) {
    if (on) document.documentElement.dataset.cb = "on";
    else delete document.documentElement.dataset.cb;
    store.set("cypher-cb", on ? "1" : null);
  },
  theme: () => store.get("cypher-theme") || "system",
  setTheme(t) {
    if (t === "light" || t === "dark") document.documentElement.dataset.theme = t;
    else delete document.documentElement.dataset.theme;
    store.set("cypher-theme", t === "system" ? null : t);
  },
  async logout() {
    try { await Api.logout(); } catch { /* sessão já encerrada */ }
    location.href = "/";
  },
  onAuthError(err) {
    if (err && err.status === 401) {
      closeSheet();
      showLanding();
      return true;
    }
    return false;
  },
  navigate(next) { navigate(next); },
};

// ---------- Rotas ----------
function readRoute() {
  const p = new URLSearchParams(location.search);
  const desafio = p.get("desafio");
  let mode = p.get("modo");
  if (!MODES.includes(mode)) mode = "classico";
  if (desafio) mode = "desafio";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(p.get("data") || "") ? p.get("data") : null;
  return { mode, date: mode === "desafio" ? null : date, desafio };
}

function navigate({ mode = "classico", date = null, desafio = null } = {}, replace = false) {
  const p = new URLSearchParams();
  if (desafio) p.set("desafio", desafio);
  else {
    if (mode !== "classico") p.set("modo", mode);
    if (date) p.set("data", date);
  }
  const url = `${location.pathname}${p.toString() ? `?${p}` : ""}`;
  history[replace ? "replaceState" : "pushState"]({}, "", url);
  route();
}

// ---------- Tela de entrada ----------
let stopDemo = null;
function showLanding() {
  $("app").hidden = true;
  $("landing").hidden = false;
  document.body.classList.remove("in-app");
  const r = readRoute();
  $("landing-invite").hidden = !r.desafio;
  const returnTo = `${location.pathname}${location.search}`;
  $("login-btn").href = `/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`;
  renderWordmark($("landing-title"));
  renderDial($("vault-dial"));
  if (stopDemo) stopDemo();
  stopDemo = startDemo($("demo-board"), document.querySelector(".vault"));
}

function showApp() {
  if (stopDemo) { stopDemo(); stopDemo = null; }
  $("landing").hidden = true;
  $("app").hidden = false;
  document.body.classList.add("in-app");
}

// Ajusta o tamanho das peças ao espaço disponível (altura e largura)
function fitBoard() {
  const wrap = $("board-wrap");
  const node = $("board");
  if (!wrap || wrap.hidden || !node.dataset.mode) return;
  const rows = Number(node.style.getPropertyValue("--rows")) || 6;
  const sombra = node.dataset.mode === "sombra";
  const gap = rows > 6 ? 5 : 6;
  const h = wrap.clientHeight - 4;
  const w = wrap.clientWidth - 4;
  const byH = (h - (rows - 1) * gap) / rows;
  const byW = (w - 4 * gap - (sombra ? 10 : 0)) / (sombra ? 6.4 : 5);
  const tile = Math.max(26, Math.min(62, Math.floor(Math.min(byH, byW))));
  node.style.setProperty("--tile", `${tile}px`);
  node.style.setProperty("--gap", `${gap}px`);
}

// ---------- Partida ----------
let game = null;
let board = null;
let keyboard = null;
let input = "";
let busy = false;
let loadToken = 0;

function headText(g) {
  const left = g.kind === "challenge"
    ? el("span", {}, "Desafio de ", el("strong", { text: g.creator?.username || "um amigo" }))
    : el("span", {}, g.isToday ? "Cifra de hoje, " : "Cofre de ", el("strong", { text: formatLongDate(g.date) }));
  const used = g.attempts.length;
  let right;
  if (g.status === "won") right = el("span", {}, "Aberto em ", el("strong", { text: `${used}/${g.maxAttempts}` }));
  else if (g.status === "lost") right = el("strong", { text: "Lacrado" });
  else right = el("span", {}, "Tentativa ", el("strong", { text: `${used + 1} de ${g.maxAttempts}` }));
  $("game-head").replaceChildren(left, right);
}

function setBanner(g) {
  const b = $("banner");
  if (g.kind === "challenge") {
    b.hidden = false;
    b.replaceChildren(
      el("span", { class: "banner__who" }, avatarImg(g.creator?.avatar, ""), `${g.creator?.username || "Um amigo"} trancou essa palavra pra você.`),
      el("span", { class: "muted", text: "Não conta nas estatísticas." }));
  } else if (g.isArchive) {
    b.hidden = false;
    b.replaceChildren(
      el("span", { text: `Cofre antigo · ${g.date.slice(8, 10)}/${g.date.slice(5, 7)} — não conta para sequência e ranking` }),
      el("button", { type: "button", text: "Voltar para hoje", onclick: () => navigate({ mode: g.mode }) }));
  } else {
    b.hidden = true;
    b.replaceChildren();
  }
}

function setTabs(mode) {
  document.querySelectorAll(".modetab").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.mode === mode)));
}

function showBoardArea(show) {
  $("board-wrap").hidden = !show;
  $("game-head").hidden = !show;
  $("keyboard").hidden = !show;
  $("desafio-view").hidden = show;
}

function renderGame(g, { openFinished = true } = {}) {
  game = g;
  input = "";
  const mode = g.kind === "challenge" ? "classico" : g.mode;
  board = new Board($("board"), { rows: g.maxAttempts, mode });
  fitBoard();
  keyboard.reset();
  $("board-wrap").classList.remove("is-unlocked");
  g.attempts.forEach((a, i) => {
    board.applyRow(i, a.guess, a.feedback, { animate: false });
    if (mode !== "sombra") keyboard.mark(a.guess, a.feedback);
  });
  headText(g);
  setBanner(g);
  requestAnimationFrame(fitBoard);
  keyboard.setDisabled(g.status !== "playing");
  if (g.status !== "playing" && openFinished) setTimeout(() => openResult(ctx, { ...g, mode: g.kind === "challenge" ? "desafio" : g.mode }), 450);
}

async function loadDaily(mode, date) {
  const token = ++loadToken;
  showBoardArea(true);
  $("board").replaceChildren(spinner());
  $("game-head").replaceChildren();
  $("banner").hidden = true;
  try {
    const data = await Api.game(mode, date || undefined);
    if (token !== loadToken) return;
    renderGame({ ...data, kind: "daily" });
  } catch (err) {
    if (token !== loadToken || ctx.onAuthError(err)) return;
    toast(err.message);
    if (date) navigate({ mode }, true);
    else $("board").replaceChildren(el("div", { class: "empty" }, el("strong", { text: "Não deu pra abrir o cofre agora." }), err.message));
  }
}

function typeLetter(ch) {
  if (!game || game.status !== "playing" || busy || input.length >= 5) return;
  input += ch;
  board.setLetters(game.attempts.length, input.split(""));
}

function backspace() {
  if (!game || game.status !== "playing" || busy || !input.length) return;
  input = input.slice(0, -1);
  board.setLetters(game.attempts.length, input.split(""));
}

async function submit() {
  if (!game || game.status !== "playing" || busy) return;
  const row = game.attempts.length;
  if (input.length < 5) {
    board.shake(row);
    toast("Faltam letras: a palavra tem 5.");
    return;
  }
  busy = true;
  keyboard.setDisabled(true);
  const guess = input;
  try {
    const next = game.kind === "challenge"
      ? await Api.challengeGuess(game.id, guess)
      : await Api.guess(game.mode, game.date, guess);
    const last = next.attempts[next.attempts.length - 1];
    const mode = game.kind === "challenge" ? "classico" : game.mode;
    await board.applyRow(row, last.guess, last.feedback, { animate: true });
    if (mode !== "sombra") keyboard.mark(last.guess, last.feedback);
    game = { ...game, ...next, kind: game.kind, creator: game.creator, id: game.id };
    input = "";
    headText(game);
    if (mode === "sombra") announce(`${last.feedback.exact} no lugar certo, ${last.feedback.misplaced} no lugar errado.`);
    if (game.status === "won") {
      $("board-wrap").classList.add("is-unlocked");
      announce("Cofre aberto!");
      setTimeout(() => openResult(ctx, { ...game, mode: game.kind === "challenge" ? "desafio" : game.mode }), 1300);
    } else if (game.status === "lost") {
      announce(`Cofre lacrado. A palavra era ${game.answer}.`);
      setTimeout(() => openResult(ctx, { ...game, mode: game.kind === "challenge" ? "desafio" : game.mode }), 700);
    }
  } catch (err) {
    if (ctx.onAuthError(err)) return;
    if (err.status === 409) {
      toast(err.message);
      route();
    } else {
      board.shake(row);
      toast(err.message);
    }
  } finally {
    busy = false;
    keyboard.setDisabled(!game || game.status !== "playing");
  }
}

function onKey(key) {
  if (key === "Enter") submit();
  else if (key === "Backspace") backspace();
  else if (/^[A-Z]$/.test(key)) typeLetter(key);
}

function onPhysicalKey(e) {
  if ($("app").hidden || $("sheet").open || e.ctrlKey || e.metaKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
  if ($("board-wrap").hidden) return;
  if (e.key === "Enter") {
    if (t && t.tagName === "BUTTON" && !t.classList.contains("key")) return;
    e.preventDefault();
    onKey("Enter");
  } else if (e.key === "Backspace") {
    e.preventDefault();
    onKey("Backspace");
  } else if (e.key.length === 1) {
    const ch = e.key.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
    if (/^[A-Z]$/.test(ch)) onKey(ch);
  }
}

// ---------- Desafio ----------
function challengeUrl(id) {
  return `${location.origin}/d/${id}`;
}

function linkBox(id) {
  const url = challengeUrl(id);
  const invite = `Tranquei uma palavra no Cypher. Duvido você abrir em 6 tentativas: ${url}`;
  return el("div", { class: "linkbox" },
    el("code", { text: url }),
    el("div", { class: "linkbox__actions" },
      el("button", { type: "button", class: "btn btn--small btn--brass", text: "Copiar link", onclick: async () => toast((await copyText(url)) ? "Link copiado." : "Não deu pra copiar.") }),
      el("button", { type: "button", class: "btn btn--small btn--ghost", text: "Copiar convite", onclick: async () => toast((await copyText(invite)) ? "Convite copiado. Cole no Discord." : "Não deu pra copiar.") })));
}

function playsPill(p) {
  if (p.status === "won") return el("span", { class: "pill pill--won", text: `abriu em ${p.attempts}` });
  if (p.status === "lost") return el("span", { class: "pill pill--lost", text: "lacrado" });
  return el("span", { class: "pill pill--playing", text: `jogando ${p.attempts}/6` });
}

async function renderChallengeHub() {
  showBoardArea(false);
  $("banner").hidden = true;
  const view = $("desafio-view");
  const inputEl = el("input", { type: "text", maxlength: "5", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", "aria-label": "Palavra de 5 letras", placeholder: "PRAIA" });
  const result = el("div");
  const btn = el("button", { type: "submit", class: "btn", text: "Trancar palavra" });
  const form = el("form", { class: "field", onsubmit: async (e) => {
    e.preventDefault();
    const word = inputEl.value.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z]/g, "");
    if (word.length !== 5) { toast("A palavra precisa ter 5 letras."); return; }
    btn.disabled = true;
    try {
      const data = await Api.createChallenge(word);
      inputEl.value = "";
      result.replaceChildren(el("p", { text: `Cofre trancado com ${word}. Mande o link:` }), linkBox(data.id),
        el("button", { type: "button", class: "btn btn--small btn--ghost", text: "Ver resultados", onclick: () => navigate({ desafio: data.id }) }));
      loadMine();
    } catch (err) {
      if (!ctx.onAuthError(err)) toast(err.message);
    } finally {
      btn.disabled = false;
    }
  } }, inputEl, btn);

  const mine = el("div", {}, spinner());
  const loadMine = async () => {
    try {
      const data = await Api.myChallenges();
      if (!data.challenges.length) {
        mine.replaceChildren(el("div", { class: "empty" }, el("strong", { text: "Você ainda não trancou nenhuma palavra." }), "Crie o primeiro desafio aqui em cima."));
        return;
      }
      mine.replaceChildren(el("ul", { class: "list" }, ...data.challenges.map((c) => el("li", {},
        el("span", { class: "word grow", text: c.word }),
        el("span", { class: "muted", text: `${c.plays} ${c.plays === 1 ? "jogou" : "jogaram"}, ${c.wins} ${c.wins === 1 ? "abriu" : "abriram"}` }),
        el("button", { type: "button", class: "btn btn--small btn--ghost", text: "Ver", "aria-label": `Ver desafio ${c.word}`, onclick: () => navigate({ desafio: c.id }) })))));
    } catch (err) {
      if (!ctx.onAuthError(err)) mine.replaceChildren(el("p", { class: "note", text: err.message }));
    }
  };

  view.replaceChildren(
    el("section", { class: "card" }, el("h3", { text: "Tranque uma palavra" }),
      el("p", { text: "Escolha uma palavra de 5 letras. Seu amigo entra pelo link e tem 6 tentativas para abrir o cofre." }), form, result),
    el("section", { class: "card" }, el("h3", { text: "Seus desafios" }), mine));
  loadMine();
}

async function loadChallenge(id) {
  const token = ++loadToken;
  showBoardArea(true);
  $("board").replaceChildren(spinner());
  $("game-head").replaceChildren();
  $("banner").hidden = true;
  try {
    const data = await Api.challenge(id);
    if (token !== loadToken) return;
    if (data.isCreator) return renderCreatorView(data);
    renderGame({ ...data, kind: "challenge", mode: "desafio", id });
  } catch (err) {
    if (token !== loadToken || ctx.onAuthError(err)) return;
    toast(err.message);
    navigate({ mode: "desafio" }, true);
  }
}

function renderCreatorView(data) {
  showBoardArea(false);
  const plays = data.plays || [];
  $("desafio-view").replaceChildren(
    el("section", { class: "card" },
      el("h3", { text: "Seu desafio" }),
      el("div", { class: "result-word", "aria-label": `Palavra ${data.word}` }, ...[...data.word].map((ch) => el("span", { class: "tile tile--filled", text: ch }))),
      el("p", { text: "Você criou esse cofre, então não pode jogar nele. Mande o link e acompanhe aqui." }),
      linkBox(data.id)),
    el("section", { class: "card" }, el("h3", { text: "Quem tentou abrir" }),
      plays.length
        ? el("ul", { class: "list" }, ...plays.map((p) => el("li", {}, avatarImg(p.avatar, ""), el("strong", { class: "grow", text: p.username }), playsPill(p))))
        : el("div", { class: "empty" }, el("strong", { text: "Ninguém jogou ainda." }), "Mande o link no seu servidor do Discord.")),
    el("button", { type: "button", class: "btn btn--ghost", text: "Criar outro desafio", onclick: () => navigate({ mode: "desafio" }) }));
}

// ---------- Inicialização ----------
function route() {
  if (!ctx.me) return;
  closeSheet();
  const r = readRoute();
  setTabs(r.mode);
  if (r.desafio) loadChallenge(r.desafio);
  else if (r.mode === "desafio") { ++loadToken; renderChallengeHub(); }
  else loadDaily(r.mode, r.date);
}

function openPanel(name) {
  const mode = game && game.kind === "daily" ? game.mode : "classico";
  if (name === "cofres") openVaults(ctx, mode);
  else if (name === "estatisticas") openStats(ctx, mode);
  else if (name === "ranking") openRanking(ctx);
  else if (name === "config") openSettings(ctx);
  else if (name === "ajuda") openHelp();
}

function cleanAuthParams() {
  const p = new URLSearchParams(location.search);
  const err = p.get("auth_error");
  if (err) toast("Não deu pra entrar com o Discord. Tente de novo.", 3500);
  if (p.has("auth_error") || p.has("login")) {
    p.delete("auth_error");
    p.delete("login");
    history.replaceState({}, "", `${location.pathname}${p.toString() ? `?${p}` : ""}${location.hash}`);
  }
}

async function init() {
  mountIcons();
  setupSheet();
  cleanAuthParams();
  keyboard = new Keyboard($("keyboard"), onKey);
  document.addEventListener("keydown", onPhysicalKey);
  window.addEventListener("popstate", route);
  document.querySelectorAll("[data-panel]").forEach((b) => b.addEventListener("click", () => openPanel(b.dataset.panel)));
  document.querySelectorAll(".modetab").forEach((t) => t.addEventListener("click", () => navigate({ mode: t.dataset.mode })));
  $("seal").innerHTML = ICONS.cadeadoAberto;
  if ("ResizeObserver" in window) new ResizeObserver(fitBoard).observe($("board-wrap"));
  else window.addEventListener("resize", fitBoard);

  try {
    ctx.me = await Api.me();
  } catch (err) {
    if (err.status !== 401) toast(err.message);
    showLanding();
    return;
  }
  const chip = $("user-chip");
  chip.replaceChildren(avatarImg(ctx.me.user.avatar, `Conectado como ${ctx.me.user.username}`));
  chip.title = ctx.me.user.username;
  showApp();
  route();
  const panel = location.hash.replace("#", "");
  if (panel) setTimeout(() => openPanel(panel), 700);
  if (!store.get("cypher-seen-help")) {
    store.set("cypher-seen-help", "1");
    if (!panel) setTimeout(openHelp, 500);
  }
}

init();
