(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    userArea: $("userArea"), loggedOut: $("loggedOut"), gameArea: $("gameArea"),
    authMessage: $("authMessage"), message: $("message"), board: $("board"),
    moves: $("moves"), pairs: $("pairs"), time: $("time"), newGameBtn: $("newGameBtn"),
  };

  let game = null;      // estado da partida atual (vindo do servidor)
  let open = [];        // ids das cartas viradas no turno atual
  let busy = false;     // bloqueia cliques durante requisicoes
  let timer = null;
  let clockOffset = 0;  // diferenca entre relogio do servidor e do navegador

  async function api(path, options) {
    const opts = Object.assign({ headers: { "Content-Type": "application/json" } }, options);
    const res = await fetch(path, opts);
    let data = {};
    try { data = await res.json(); } catch (e) { /* resposta sem corpo */ }
    return { status: res.status, data };
  }

  function say(text, kind) {
    els.message.textContent = text || "";
    els.message.className = "message" + (kind ? " " + kind : "");
  }

  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  function fmtTime(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
  }

  // ---------- cabecalho com dados do Discord ----------
  function renderUser(user) {
    els.userArea.replaceChildren();
    const img = document.createElement("img");
    if (typeof user.avatar === "string" && user.avatar.startsWith("https://cdn.discordapp.com/")) {
      img.src = user.avatar;
    }
    img.alt = "Avatar de " + user.username;
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = user.username;
    const out = document.createElement("button");
    out.type = "button";
    out.textContent = "Sair";
    out.addEventListener("click", async () => {
      await api("/api/auth/logout", { method: "POST" });
      location.reload();
    });
    els.userArea.append(img, name, out);
  }

  // ---------- cronometro (so exibicao; o tempo oficial e do servidor) ----------
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }
  function startTimer(startedAt) {
    stopTimer();
    const tick = () => { els.time.textContent = fmtTime(Date.now() + clockOffset - startedAt); };
    tick();
    timer = setInterval(tick, 500);
  }

  // ---------- cartas ----------
  function setFace(btn, kind, content) {
    const back = btn.querySelector(".back");
    back.dataset.kind = kind;
    back.textContent = content;
  }
  function clearFace(btn) {
    const back = btn.querySelector(".back");
    back.textContent = "";
    delete back.dataset.kind;
  }

  function createCard(c) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card";
    btn.dataset.id = c.id;
    btn.setAttribute("aria-label", "Carta " + (c.position + 1));

    const inner = document.createElement("div");
    inner.className = "card-inner";
    const front = document.createElement("div");
    front.className = "face front";
    front.textContent = "?";
    const back = document.createElement("div");
    back.className = "face back";
    inner.append(front, back);
    btn.append(inner);

    if (c.content) setFace(btn, c.kind, c.content);
    if (c.matched || c.revealed) btn.classList.add("flipped");
    if (c.matched) btn.classList.add("matched");

    btn.addEventListener("click", () => onCardClick(btn));
    return btn;
  }

  function updateStats() {
    els.moves.textContent = String(game.moves);
    els.pairs.textContent = game.matchedPairs + "/" + game.totalPairs;
  }

  function buildBoard(g) {
    game = { gameId: g.gameId, totalPairs: g.totalPairs, matchedPairs: g.matchedPairs, moves: g.moves, finished: false };
    clockOffset = g.serverNow - Date.now();
    open = g.cards.filter((c) => c.revealed && !c.matched).map((c) => c.id);
    els.board.replaceChildren(...g.cards.map(createCard));
    updateStats();
    startTimer(g.startedAt);
    say("");
  }

  // ---------- jogada ----------
  async function onCardClick(btn) {
    if (!game || game.finished || busy || btn.classList.contains("flipped")) return;
    busy = true;
    try {
      const r = await api("/api/game/reveal", {
        method: "POST",
        body: JSON.stringify({ gameId: game.gameId, cardId: btn.dataset.id }),
      });
      if (r.status !== 200 || !r.data.ok) {
        say("Não foi possível virar essa carta.", "err");
        return;
      }
      setFace(btn, r.data.kind, r.data.content);
      btn.classList.add("flipped");
      open.push(btn.dataset.id);
      say("");
      if (open.length === 2) await resolveTurn();
    } catch (e) {
      say("Erro de conexão. Tente novamente.", "err");
    } finally {
      busy = false;
    }
  }

  async function resolveTurn() {
    const r = await api("/api/game/check", {
      method: "POST",
      body: JSON.stringify({ gameId: game.gameId }),
    });
    if (r.status !== 200 || !r.data.ok) {
      say("Falha ao validar o par. Recarregue a página.", "err");
      return;
    }
    const d = r.data;
    const cards = d.cardIds.map((id) => els.board.querySelector('[data-id="' + id + '"]'));
    game.moves = d.moves;
    game.matchedPairs = d.matchedPairs;
    updateStats();
    open = [];

    if (d.match) {
      cards.forEach((c) => c.classList.add("matched"));
      say("Par encontrado!", "ok");
    } else {
      say("Não combinam. Tente de novo.");
      await delay(900);
      cards.forEach((c) => c.classList.remove("flipped"));
      await delay(600);
      cards.forEach(clearFace);
    }

    if (d.finished) {
      game.finished = true;
      stopTimer();
      els.time.textContent = fmtTime(d.durationMs);
      const pct = (d.efficiency * 100).toFixed(1).replace(".", ",");
      say("Parabéns! " + d.moves + " movimentos, tempo " + fmtTime(d.durationMs) + ", eficiência " + pct + "%.", "ok");
    }
  }

  // ---------- carregar / iniciar partida ----------
  async function loadState() {
    const r = await api("/api/game/state");
    if (r.status === 200 && r.data.game) {
      buildBoard(r.data.game);
    } else {
      game = null;
      stopTimer();
      els.board.replaceChildren();
      els.moves.textContent = "0";
      els.pairs.textContent = "0/0";
      els.time.textContent = "00:00";
      say("Clique em “Nova partida” para começar.");
    }
  }

  async function startGame() {
    if (game && !game.finished && !confirm("Isso abandona a partida atual. Continuar?")) return;
    els.newGameBtn.disabled = true;
    try {
      const r = await api("/api/game/start", { method: "POST" });
      if (r.status === 200 && r.data.ok) await loadState();
      else say("Não foi possível iniciar a partida.", "err");
    } catch (e) {
      say("Erro de conexão.", "err");
    } finally {
      els.newGameBtn.disabled = false;
    }
  }

  // ---------- inicio ----------
  async function init() {
    els.newGameBtn.addEventListener("click", startGame);

    const params = new URLSearchParams(location.search);
    const authError = params.get("auth_error");
    if (params.has("auth_error") || params.has("login")) {
      history.replaceState(null, "", "/");
    }

    const me = await api("/api/me");
    if (me.status !== 200 || !me.data.ok) {
      els.loggedOut.hidden = false;
      els.gameArea.hidden = true;
      if (authError) els.authMessage.textContent = "Falha no login (" + authError + "). Tente novamente.";
      return;
    }
    renderUser(me.data.user);
    els.loggedOut.hidden = true;
    els.gameArea.hidden = false;
    await loadState();
  }

  init();
})();