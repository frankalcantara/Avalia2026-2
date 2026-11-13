// Batalha Naval Tático — cliente vanilla JS. Toda regra é validada no servidor (Cloudflare Functions + D1).
const CHAVE_PROJETO = "P26-2A-93BE-4A78-BC67-3577";
const N = 10;
const COLS = "ABCDEFGHIJ";

const state = {
  user: null,
  game: null,        // { id, status, turn, winner }
  fleet: [],         // [{ key, label, size }]
  placed: new Map(), // key -> { name, row, col, orientation }
  selected: null,    // key do navio sendo posicionado
  orientation: "H",
  hover: null,       // [row, col]
  myShips: [],       // frota do jogador (servidor)
  shots: [],         // todos os tiros (servidor)
  cpu: null,         // { shipsRemaining, sunk }
  busy: false,
};

const $ = (id) => document.getElementById(id);

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else if (v === true) node.setAttribute(k, "");
    else if (v !== false && v != null) node.setAttribute(k, v);
  }
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function say(text, kind = "") {
  const m = $("message");
  m.textContent = text || "";
  m.className = "message " + kind;
}

async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    credentials: "same-origin",
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* resposta sem JSON */ }
  return { status: res.status, ok: res.ok && data?.ok !== false, data: data || {} };
}

/* ---------- Regras de posicionamento (só para pré-visualizar; o servidor valida de verdade) ---------- */
function cellsFor(size, row, col, orientation) {
  return Array.from({ length: size }, (_, i) => (orientation === "H" ? [row, col + i] : [row + i, col]));
}
function occupied(exceptKey) {
  const set = new Set();
  for (const [key, s] of state.placed) {
    if (key === exceptKey) continue;
    const spec = state.fleet.find((f) => f.key === key);
    cellsFor(spec.size, s.row, s.col, s.orientation).forEach(([r, c]) => set.add(`${r},${c}`));
  }
  return set;
}
function canPlace(key, row, col, orientation) {
  const spec = state.fleet.find((f) => f.key === key);
  const taken = occupied(key);
  return cellsFor(spec.size, row, col, orientation).every(
    ([r, c]) => r >= 0 && r < N && c >= 0 && c < N && !taken.has(`${r},${c}`)
  );
}
function randomPlacement() {
  state.placed.clear();
  for (const spec of state.fleet) {
    for (let tries = 0; tries < 500; tries++) {
      const orientation = Math.random() < 0.5 ? "H" : "V";
      const row = Math.floor(Math.random() * N);
      const col = Math.floor(Math.random() * N);
      if (canPlace(spec.key, row, col, orientation)) {
        state.placed.set(spec.key, { name: spec.key, row, col, orientation });
        break;
      }
    }
  }
}

/* ---------- Tabuleiro ---------- */
function buildBoard(title, cellFn) {
  const board = el("div", { class: "board", role: "grid", "aria-label": title });
  board.append(el("div", { class: "lbl" }));
  for (let c = 0; c < N; c++) board.append(el("div", { class: "lbl", text: COLS[c] }));
  for (let r = 0; r < N; r++) {
    board.append(el("div", { class: "lbl", text: String(r + 1) }));
    for (let c = 0; c < N; c++) board.append(cellFn(r, c));
  }
  return el("div", { class: "board-wrap" }, el("h3", { text: title }), board);
}

const SYMBOL = { agua: "•", acerto: "✹", afundado: "✖" };

function placementBoard() {
  const taken = occupied(null);
  let preview = new Set();
  let previewOk = false;
  if (state.selected && state.hover) {
    const spec = state.fleet.find((f) => f.key === state.selected);
    const cells = cellsFor(spec.size, state.hover[0], state.hover[1], state.orientation);
    previewOk = canPlace(state.selected, state.hover[0], state.hover[1], state.orientation);
    preview = new Set(cells.map(([r, c]) => `${r},${c}`));
  }
  return buildBoard("Posicione a sua frota", (r, c) => {
    const k = `${r},${c}`;
    const cls = ["cell"];
    if (taken.has(k)) cls.push("ship");
    if (preview.has(k)) cls.push(previewOk ? "preview-ok" : "preview-bad");
    return el("button", {
      type: "button", class: cls.join(" "), "aria-label": `${COLS[c]}${r + 1}`,
      onmouseenter: () => { state.hover = [r, c]; renderPlacementOnly(); },
      onclick: () => placeAt(r, c),
    });
  });
}

function myBoard() {
  const shipCells = new Set();
  for (const s of state.myShips) cellsFor(s.size, s.row, s.col, s.orientation).forEach(([r, c]) => shipCells.add(`${r},${c}`));
  const incoming = new Map(state.shots.filter((s) => s.shooter === "cpu").map((s) => [`${s.row},${s.col}`, s.result]));
  return buildBoard("Sua frota", (r, c) => {
    const k = `${r},${c}`;
    const res = incoming.get(k);
    const cls = ["cell"];
    if (shipCells.has(k)) cls.push("ship");
    if (res) cls.push(res);
    return el("div", { class: cls.join(" "), text: res ? SYMBOL[res] : "" });
  });
}

function radarBoard(canShoot) {
  const mine = new Map(state.shots.filter((s) => s.shooter === "player").map((s) => [`${s.row},${s.col}`, s.result]));
  return buildBoard("Águas inimigas (clique para atirar)", (r, c) => {
    const res = mine.get(`${r},${c}`);
    return el("button", {
      type: "button", class: "cell" + (res ? " " + res : ""), text: res ? SYMBOL[res] : "",
      "aria-label": `${COLS[c]}${r + 1}` + (res ? ` — ${res}` : ""),
      disabled: !canShoot || !!res || state.busy,
      onclick: () => shoot(r, c),
    });
  });
}

/* ---------- Telas ---------- */
function renderPlacementOnly() {
  // Atualiza só o tabuleiro ao passar o mouse (evita redesenhar botões e barra de ferramentas).
  const old = document.querySelector(".board-wrap");
  if (old && state.game?.status === "posicionando") old.replaceWith(placementBoard());
}

function renderPlacement() {
  const view = $("gameView");
  view.replaceChildren();
  view.append(el("p", { class: "desc", text: "Fase 1 — posicione os 5 navios na malha 10×10. Escolha um navio, gire (H/V ou tecla R) e clique no tabuleiro. O servidor valida limites e sobreposição." }));

  const list = el("div", { class: "ship-list" });
  for (const spec of state.fleet) {
    const placed = state.placed.has(spec.key);
    list.append(el("button", {
      type: "button",
      class: "ship-btn" + (state.selected === spec.key ? " active" : "") + (placed ? " placed" : ""),
      text: `${spec.label} (${spec.size})${placed ? " ✓" : ""}`,
      onclick: () => { state.selected = spec.key; renderPlacement(); },
    }));
  }
  view.append(list);

  const done = state.placed.size === state.fleet.length;
  view.append(el("div", { class: "toolbar" },
    el("button", { type: "button", class: "btn-secondary", text: `Orientação: ${state.orientation === "H" ? "Horizontal" : "Vertical"} (R)`, onclick: toggleOrientation }),
    el("button", { type: "button", class: "btn-secondary", text: "Posição aleatória", onclick: () => { randomPlacement(); state.selected = null; renderPlacement(); } }),
    el("button", { type: "button", class: "btn-secondary", text: "Limpar", onclick: () => { state.placed.clear(); state.selected = state.fleet[0].key; renderPlacement(); } }),
    el("button", { type: "button", class: "btn-primary", text: "Iniciar combate", disabled: !done || state.busy, onclick: sendFleet }),
  ));
  view.append(el("div", { class: "boards" }, placementBoard()));
}

function renderCombat() {
  const view = $("gameView");
  view.replaceChildren();
  const over = state.game.status === "finalizada";

  if (over) {
    const win = state.game.winner === "player";
    view.append(el("div", { class: "result-banner " + (win ? "win" : "lose"), text: win ? "Vitória! Você afundou toda a frota inimiga." : "Derrota. O computador afundou a sua frota." }));
    view.append(el("div", { class: "toolbar" }, el("button", { type: "button", class: "btn-primary", text: "Nova partida", onclick: newGame })));
  } else {
    view.append(el("p", { class: "desc", text: "Fase 2 — combate. Clique em uma célula das águas inimigas; o servidor responde apenas água, acerto ou navio afundado." }));
  }

  const remaining = state.cpu ? state.cpu.shipsRemaining : state.fleet.length;
  const sunk = state.cpu?.sunk?.length ? ` · Afundados: ${state.cpu.sunk.map(labelOf).join(", ")}` : "";
  view.append(el("p", { class: "legend", text: `Navios inimigos restantes: ${remaining}${sunk}` }));
  view.append(el("div", { class: "boards" }, radarBoard(!over), myBoard()));
  view.append(el("p", { class: "legend", text: "• água · ✹ acerto · ✖ navio afundado" }));
}

function renderIntro() {
  const view = $("gameView");
  view.replaceChildren();
  view.append(el("p", { class: "desc", text: "Jogue contra o computador em uma malha 10×10: posicione a frota, depois bombardeie as coordenadas inimigas. A matriz do adversário nunca sai do servidor. O placar é atualizado ao fim de cada partida." }));
  if (!state.user) {
    view.append(el("a", { class: "btn-primary", href: "/api/auth/discord", text: "Entrar com Discord para jogar" }));
  } else {
    view.append(el("button", { type: "button", class: "btn-primary", text: "Nova partida", onclick: newGame }));
  }
}

function labelOf(key) {
  return state.fleet.find((f) => f.key === key)?.label || key;
}

function render() {
  renderUser();
  if (!state.user || !state.game) return renderIntro();
  if (state.game.status === "posicionando") return renderPlacement();
  return renderCombat();
}

function renderUser() {
  const area = $("userArea");
  area.replaceChildren();
  if (!state.user) {
    area.append(el("a", { class: "btn-secondary", href: "/api/auth/discord", text: "Entrar com Discord" }));
    return;
  }
  if (state.user.avatar) area.append(el("img", { src: state.user.avatar, alt: "" }));
  area.append(el("span", { class: "discord-badge", text: state.user.username }));
  area.append(el("button", { type: "button", class: "btn-secondary", text: "Sair", onclick: logout }));
}

/* ---------- Ações ---------- */
function toggleOrientation() {
  state.orientation = state.orientation === "H" ? "V" : "H";
  renderPlacement();
}

function placeAt(row, col) {
  if (!state.selected) return say("Escolha um navio primeiro.", "err");
  if (!canPlace(state.selected, row, col, state.orientation)) return say("Posição inválida: fora do tabuleiro ou sobreposta.", "err");
  state.placed.set(state.selected, { name: state.selected, row, col, orientation: state.orientation });
  const next = state.fleet.find((f) => !state.placed.has(f.key));
  state.selected = next ? next.key : null;
  say("");
  renderPlacement();
}

async function loadGame(id) {
  const r = await api("GET", `/api/games/${id}`);
  if (!r.ok) return say(r.data.error || "Não foi possível carregar a partida.", "err");
  state.game = r.data.game;
  state.fleet = r.data.fleet || state.fleet;
  state.myShips = r.data.player?.ships || [];
  state.shots = r.data.shots || [];
  state.cpu = r.data.cpu;
}

async function newGame() {
  state.busy = true;
  const r = await api("POST", "/api/games");
  state.busy = false;
  if (!r.ok) return say(r.data.error || "Erro ao criar partida.", "err");
  state.fleet = r.data.fleet;
  state.placed.clear();
  state.selected = state.fleet[0].key;
  await loadGame(r.data.game.id);
  say("");
  render();
}

async function sendFleet() {
  state.busy = true;
  say("Enviando a frota para validação no servidor…");
  const r = await api("POST", `/api/games/${state.game.id}/fleet`, { ships: [...state.placed.values()] });
  state.busy = false;
  if (!r.ok) { say(r.data.error || "Frota recusada.", "err"); return renderPlacement(); }
  await loadGame(state.game.id);
  say("Frota aceita! Dispare contra as águas inimigas.", "ok");
  render();
}

const RESULT_TEXT = { agua: "água", acerto: "acerto", afundado: "navio afundado" };

async function shoot(row, col) {
  if (state.busy) return;
  // busy fica ligado até a tela ser redesenhada: evita clique duplo na mesma célula.
  state.busy = true;
  renderCombat();
  try {
    const r = await api("POST", `/api/games/${state.game.id}/shoot`, { row, col });
    if (!r.ok) {
      say(r.data.error || "Tiro recusado.", "err");
      await loadGame(state.game.id); // ressincroniza com o servidor
      return;
    }
    const { shot, cpuShot, game } = r.data;
    await loadGame(state.game.id);
    const parts = [`Seu tiro em ${COLS[shot.col]}${shot.row + 1}: ${RESULT_TEXT[shot.result]}${shot.ship ? " (" + labelOf(shot.ship) + ")" : ""}.`];
    if (cpuShot) parts.push(`Computador em ${COLS[cpuShot.col]}${cpuShot.row + 1}: ${RESULT_TEXT[cpuShot.result]}${cpuShot.ship ? " (" + labelOf(cpuShot.ship) + ")" : ""}.`);
    say(parts.join(" "), "ok");
    if (game.status === "finalizada") { state.game = game; await loadScores(); }
  } finally {
    state.busy = false;
    render();
  }
}

async function logout() {
  await api("POST", "/api/auth/logout");
  state.user = null; state.game = null;
  say("");
  render();
}

async function loadScores() {
  const r = await api("GET", "/api/scores");
  const body = document.querySelector("#scoresTable tbody");
  body.replaceChildren();
  const rows = r.data.scores || [];
  if (!rows.length) {
    body.append(el("tr", {}, el("td", { colspan: "5", text: "Nenhuma partida finalizada ainda." })));
    return;
  }
  rows.forEach((s, i) => {
    const name = el("td", {});
    if (s.avatar) name.append(el("img", { src: s.avatar, alt: "" }));
    name.append(document.createTextNode(s.username));
    body.append(el("tr", {}, el("td", { text: String(i + 1) }), name,
      el("td", { text: String(s.gamesPlayed) }), el("td", { text: String(s.wins) }), el("td", { text: String(s.losses) })));
  });
}

document.addEventListener("keydown", (e) => {
  if ((e.key === "r" || e.key === "R") && state.game?.status === "posicionando") toggleOrientation();
});

/* ---------- Início ---------- */
async function init() {
  const params = new URLSearchParams(location.search);
  if (params.has("auth_error")) say("Falha no login com Discord: " + params.get("auth_error"), "err");
  if (params.has("login") || params.has("auth_error")) history.replaceState(null, "", "/");

  const st = await api("GET", "/api/status");
  state.user = st.data.sessionUser || null;
  if (state.user) {
    const g = await api("GET", "/api/games");
    state.fleet = g.data.fleet || [];
    if (g.data.game) {
      await loadGame(g.data.game.id);
      if (state.game.status === "posicionando") state.selected = state.fleet[0]?.key || null;
    }
  }
  render();
  loadScores();
}
init();
