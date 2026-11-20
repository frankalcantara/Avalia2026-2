/**
 * Jogo da Memória — Vanilla JS.
 * O servidor embaralha, valida os pares e conta os movimentos (D1).
 * Este arquivo só desenha o tabuleiro e chama a API.
 */
(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const MISMATCH_DELAY = 900;

  const state = {
    user: null,
    gameId: null,
    cardIds: [],
    totalPairs: 0,
    matchedPairs: 0,
    moves: 0,
    open: [], // botões virados aguardando validação
    busy: false,
    finished: false,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(path, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch { /* resposta sem JSON */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || "http_" + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /* ---------- Cabeçalho e telas ---------- */

  function renderHeader() {
    const box = $("#discordProfile");
    box.replaceChildren();
    if (!state.user) {
      const a = document.createElement("a");
      a.className = "btn btn-discord";
      a.id = "discordLoginLink";
      a.href = "/api/auth/discord";
      a.textContent = "Entrar com Discord";
      box.appendChild(a);
      return;
    }
    const chip = document.createElement("div");
    chip.className = "user-chip";
    const img = document.createElement("img");
    img.alt = "";
    img.src = state.user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
    img.referrerPolicy = "no-referrer";
    const name = document.createElement("span");
    name.textContent = state.user.username;
    name.title = "Discord ID: " + state.user.userId;
    const out = document.createElement("button");
    out.type = "button";
    out.className = "btn btn-ghost";
    out.textContent = "Sair";
    out.addEventListener("click", logout);
    chip.append(img, name);
    box.append(chip, out);
  }

  function showView() {
    $("#loginView").hidden = Boolean(state.user);
    $("#gameView").hidden = !state.user;
  }

  function setMessage(text, kind) {
    const el = $("#message");
    el.textContent = text || "";
    el.className = "message" + (kind ? " " + kind : "");
  }

  function renderStats(efficiency) {
    $("#movesValue").textContent = String(state.moves);
    $("#pairsValue").textContent = state.matchedPairs + " / " + state.totalPairs;
    $("#efficiencyValue").textContent = efficiency != null ? efficiency + "%" : "—";
  }

  /* ---------- Tabuleiro ---------- */

  function buildCard(id, index) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.dataset.id = id;
    btn.setAttribute("aria-label", "Carta " + (index + 1) + ", virada para baixo");

    const inner = document.createElement("div");
    inner.className = "card-inner";

    const cover = document.createElement("div");
    cover.className = "face cover";
    cover.textContent = "?";

    const content = document.createElement("div");
    content.className = "face content";

    inner.append(cover, content);
    btn.appendChild(inner);
    btn.addEventListener("click", () => onCardClick(btn));
    return btn;
  }

  function renderBoard() {
    const board = $("#board");
    board.replaceChildren(...state.cardIds.map(buildCard));
  }

  function showFace(btn, data) {
    const face = btn.querySelector(".content");
    face.replaceChildren();
    const tag = document.createElement("span");
    tag.className = "tag";
    tag.textContent = data.kind === "code" ? "código" : "saída";
    const text = document.createElement("span");
    text.textContent = data.content;
    face.append(tag, text);
    btn.classList.add("flipped", data.kind === "code" ? "is-code" : "is-output");
    btn.setAttribute("aria-label", (data.kind === "code" ? "Código: " : "Saída: ") + data.content);
  }

  function hideFace(btn) {
    btn.classList.remove("flipped", "mismatch", "is-code", "is-output");
    btn.setAttribute("aria-label", "Carta virada para baixo");
    // Só limpa o texto depois da animação, para o servidor ser a única fonte do conteúdo.
    setTimeout(() => {
      if (!btn.classList.contains("flipped")) btn.querySelector(".content").replaceChildren();
    }, 600);
  }

  /* ---------- Fluxo do jogo ---------- */

  async function startGame() {
    if (state.busy) return;
    state.busy = true;
    $("#winPanel").hidden = true;
    setMessage("Embaralhando no servidor...");
    try {
      const data = await api("/api/game/start", { method: "POST" });
      state.gameId = data.gameId;
      state.cardIds = data.cards;
      state.totalPairs = data.totalPairs;
      state.matchedPairs = 0;
      state.moves = data.moves;
      state.open = [];
      state.finished = false;
      renderBoard();
      renderStats(null);
      setMessage("Vire duas cartas para começar.");
    } catch (err) {
      handleError(err);
    } finally {
      state.busy = false;
    }
  }

  async function onCardClick(btn) {
    if (state.busy || state.finished || !state.gameId) return;
    if (btn.classList.contains("flipped") || btn.classList.contains("matched")) return;

    state.busy = true;
    try {
      const data = await api("/api/game/flip", { method: "POST", body: { gameId: state.gameId, cardId: btn.dataset.id } });
      showFace(btn, data);
      state.open.push(btn);
      if (state.open.length === 2) await resolvePair();
    } catch (err) {
      handleError(err);
    } finally {
      state.busy = false;
    }
  }

  async function resolvePair() {
    const [a, b] = state.open;
    try {
      const r = await api("/api/game/check", {
        method: "POST",
        body: { gameId: state.gameId, cardA: a.dataset.id, cardB: b.dataset.id },
      });
      state.moves = r.moves;
      state.matchedPairs = r.matchedPairs;
      state.totalPairs = r.totalPairs;
      renderStats(r.finished ? r.efficiency : null);

      if (r.match) {
        a.classList.add("matched");
        b.classList.add("matched");
        setMessage("Par encontrado!", "ok");
      } else {
        a.classList.add("mismatch");
        b.classList.add("mismatch");
        setMessage("Não é um par. Tente de novo.", "bad");
        await sleep(MISMATCH_DELAY);
        hideFace(a);
        hideFace(b);
      }
      if (r.finished) onFinished(r);
    } finally {
      state.open = [];
    }
  }

  function onFinished(r) {
    state.finished = true;
    $("#winText").textContent =
      "Movimentos: " + r.moves + " · Eficiência: " + r.efficiency + "% (pares ÷ movimentos).";
    $("#winPanel").hidden = false;
    setMessage("Partida concluída e registrada no servidor.", "ok");
    loadRanking();
  }

  function handleError(err) {
    if (err.status === 401) {
      state.user = null;
      renderHeader();
      showView();
      return;
    }
    // Cartas viradas ficam inconsistentes se algo falhou: desvira e pede novo jogo.
    state.open.forEach(hideFace);
    state.open = [];
    setMessage("Algo deu errado (" + err.message + "). Clique em \"Novo jogo\".", "bad");
  }

  /* ---------- Ranking, sessão ---------- */

  async function loadRanking() {
    const list = $("#rankingList");
    try {
      const data = await api("/api/ranking");
      list.replaceChildren();
      if (!data.ranking.length) {
        const li = document.createElement("li");
        li.className = "muted";
        li.textContent = "Ninguém terminou uma partida ainda. Seja o primeiro!";
        list.appendChild(li);
        return;
      }
      data.ranking.forEach((row) => {
        const li = document.createElement("li");
        const wrap = document.createElement("div");
        wrap.className = "rank-row";
        const img = document.createElement("img");
        img.alt = "";
        img.src = row.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
        img.referrerPolicy = "no-referrer";
        const name = document.createElement("span");
        name.className = "rank-name";
        name.textContent = row.username;
        const score = document.createElement("span");
        score.className = "rank-score";
        score.textContent = row.bestEfficiency + "% · " + row.bestMoves + " mov.";
        wrap.append(img, name, score);
        li.appendChild(wrap);
        list.appendChild(li);
      });
    } catch {
      list.innerHTML = "";
      const li = document.createElement("li");
      li.className = "muted";
      li.textContent = "Não foi possível carregar o ranking.";
      list.appendChild(li);
    }
  }

  async function logout() {
    try { await api("/api/auth/logout", { method: "POST" }); } catch { /* ignora */ }
    state.user = null;
    state.gameId = null;
    renderHeader();
    showView();
  }

  function showAuthError() {
    const params = new URLSearchParams(location.search);
    const err = params.get("auth_error");
    if (params.has("auth_error") || params.has("login")) {
      history.replaceState(null, "", location.pathname);
    }
    if (err) {
      const el = $("#authError");
      el.textContent = "Não foi possível entrar com o Discord (" + err + "). Tente novamente.";
      el.hidden = false;
    }
  }

  async function init() {
    showAuthError();
    $("#newGameBtn").addEventListener("click", startGame);
    $("#playAgainBtn").addEventListener("click", startGame);

    try {
      const me = await api("/api/me");
      state.user = me.user;
    } catch {
      state.user = null;
    }
    renderHeader();
    showView();
    if (state.user) {
      loadRanking();
      startGame();
    }
  }

  init();
})();
