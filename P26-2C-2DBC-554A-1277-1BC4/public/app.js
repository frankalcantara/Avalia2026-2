const CHAVE_PROJETO = "P26-2C-2DBC-554A-1277-1BC4";

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

const discordSession = {
  user_id: "discord_" + CHAVE_PROJETO.slice(-4).toLowerCase(),
  username: "Davi",
  avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
};

const gameState = {
  matchId: null,
  playerXId: null,
  playerOId: null,
  board: Array(9).fill(""),
  turn: "X",
  mode: "minimax",
  humanSymbol: "X",
  finished: false,
  winningLine: [],
  scores: { X: 0, O: 0, draw: 0 },
  localHistory: [],
  serverHistory: [],
  activeMatches: [],
  ranking: [],
};

function getAiSymbol() {
  return gameState.humanSymbol === "X" ? "O" : "X";
}

function evaluateBoard(board) {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every((cell) => cell !== "")) {
    return { winner: "draw", line: [] };
  }
  return null;
}

function minimax(board, depth, isMaximizing, aiSymbol, humanSymbol) {
  const result = evaluateBoard(board);
  if (result) {
    if (result.winner === aiSymbol) return 10 - depth;
    if (result.winner === humanSymbol) return depth - 10;
    return 0;
  }
  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] === "") {
        board[i] = aiSymbol;
        best = Math.max(best, minimax(board, depth + 1, false, aiSymbol, humanSymbol));
        board[i] = "";
      }
    }
    return best;
  }
  let best = Infinity;
  for (let i = 0; i < 9; i++) {
    if (board[i] === "") {
      board[i] = humanSymbol;
      best = Math.min(best, minimax(board, depth + 1, true, aiSymbol, humanSymbol));
      board[i] = "";
    }
  }
  return best;
}

function chooseBestMove(board, aiSymbol, humanSymbol) {
  if (board.every((c) => c === "")) return 4;
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === "") {
      board[i] = aiSymbol;
      const score = minimax(board, 0, false, aiSymbol, humanSymbol);
      board[i] = "";
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

function renderDiscordHeader() {
  const textEl = document.getElementById("discordUserText");
  const avatarEl = document.getElementById("discordAvatar");
  if (textEl) {
    textEl.textContent = "Discord: " + discordSession.username + " (" + discordSession.user_id + ")";
  }
  if (avatarEl && discordSession.avatar) {
    avatarEl.src = discordSession.avatar;
  }
}

function renderLists() {
  const activeEl = document.getElementById("activeMatchesList");
  if (activeEl) {
    activeEl.innerHTML = "";
    if (!gameState.activeMatches.length) {
      const li = document.createElement("li");
      li.textContent = "Nenhuma partida em andamento no servidor.";
      activeEl.appendChild(li);
    } else {
      gameState.activeMatches.forEach((m) => {
        const li = document.createElement("li");
        const span = document.createElement("span");
        span.textContent = `${m.id} [${m.mode}] X:${m.player_x_id} vs O:${m.player_o_id} (Turno: ${m.turn})`;
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "resume-btn";
        btn.textContent = "Retomar";
        btn.addEventListener("click", () => resumeServerMatch(m));
        li.appendChild(span);
        li.appendChild(btn);
        activeEl.appendChild(li);
      });
    }
  }

  const histEl = document.getElementById("matchHistoryList");
  if (histEl) {
    histEl.innerHTML = "";
    const entries = gameState.serverHistory.length
      ? gameState.serverHistory.map((h) => `[${h.created_at || "D1"}] ${h.summary}`)
      : gameState.localHistory;

    if (!entries.length) {
      const li = document.createElement("li");
      li.textContent = "Nenhuma partida finalizada ainda. Faça sua primeira jogada!";
      histEl.appendChild(li);
    } else {
      entries.slice(0, 10).forEach((entry) => {
        const li = document.createElement("li");
        li.textContent = entry;
        histEl.appendChild(li);
      });
    }
  }

  const rankEl = document.getElementById("rankingList");
  if (rankEl) {
    rankEl.innerHTML = "";
    if (!gameState.ranking.length) {
      const li = document.createElement("li");
      li.textContent = "Ranking será exibido após partidas concluídas no servidor D1.";
      rankEl.appendChild(li);
    } else {
      gameState.ranking.forEach((row, idx) => {
        const li = document.createElement("li");
        li.textContent = `#${idx + 1} ${row.username} (${row.user_id}) — Rating: ${row.rating} | V:${row.wins} E:${row.draws} D:${row.losses}`;
        rankEl.appendChild(li);
      });
    }
  }
}

function renderBoard() {
  const boardEl = document.getElementById("board");
  const bannerEl = document.getElementById("turnBanner");
  const modeBadgeEl = document.getElementById("modeBadge");
  const matchIdBadgeEl = document.getElementById("matchIdBadge");
  const scoreXEl = document.getElementById("scoreX");
  const scoreOEl = document.getElementById("scoreO");
  const scoreDrawEl = document.getElementById("scoreDraw");

  if (scoreXEl) scoreXEl.textContent = String(gameState.scores.X);
  if (scoreOEl) scoreOEl.textContent = String(gameState.scores.O);
  if (scoreDrawEl) scoreDrawEl.textContent = String(gameState.scores.draw);

  if (modeBadgeEl) {
    const labels = { minimax: "Modo: vs Minimax", async: "Modo: Assíncrona", local2p: "Modo: 2 Jogadores" };
    modeBadgeEl.textContent = labels[gameState.mode] || "Modo: vs Minimax";
  }

  if (matchIdBadgeEl) {
    matchIdBadgeEl.textContent = "Partida: " + (gameState.matchId || "local");
  }

  const cells = boardEl ? boardEl.querySelectorAll(".cell") : [];
  cells.forEach((cell) => {
    const idx = Number(cell.dataset.index);
    const val = gameState.board[idx];
    cell.textContent = val;
    cell.classList.remove("sym-x", "sym-o", "win-cell");
    if (val === "X") cell.classList.add("sym-x");
    if (val === "O") cell.classList.add("sym-o");
    if (gameState.winningLine.includes(idx)) {
      cell.classList.add("win-cell");
    }
    cell.disabled = gameState.finished || val !== "";
  });

  if (bannerEl && !gameState.finished) {
    if (gameState.mode === "minimax") {
      const quemJoga = gameState.turn === gameState.humanSymbol ? "Sua vez" : "Vez do Minimax";
      bannerEl.textContent = quemJoga + " (" + gameState.turn + ")";
    } else if (gameState.mode === "async") {
      bannerEl.textContent = `Assíncrona · Turno de ${gameState.turn}`;
    } else {
      bannerEl.textContent = "Turno atual: " + gameState.turn;
    }
  }
}

function recordLocalResult(outcome) {
  const hora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const modoLabel = gameState.mode === "minimax" ? "Minimax" : "2P Local";
  let resumo = "";
  if (outcome.winner === "draw") {
    gameState.scores.draw += 1;
    resumo = `[${hora}] (${modoLabel}) Empate na partida.`;
  } else {
    gameState.scores[outcome.winner] += 1;
    resumo = `[${hora}] (${modoLabel}) Vitória de ${outcome.winner}!`;
  }
  gameState.localHistory.unshift(resumo);
  renderLists();
}

async function syncServerState() {
  try {
    const res = await fetch("/api/matches");
    if (!res.ok) return;
    const data = await res.json();
    if (!data.ok) return;
    gameState.activeMatches = Array.isArray(data.activeMatches) ? data.activeMatches : [];
    gameState.serverHistory = Array.isArray(data.history) ? data.history : [];
    gameState.ranking = Array.isArray(data.ranking) ? data.ranking : [];
    renderLists();
  } catch {}
}

function resumeServerMatch(m) {
  gameState.matchId = m.id;
  gameState.mode = m.mode;
  gameState.playerXId = m.player_x_id;
  gameState.playerOId = m.player_o_id;
  gameState.board = Array.isArray(m.board) ? m.board : Array(9).fill("");
  gameState.turn = m.turn || "X";
  gameState.finished = m.status === "finished";
  gameState.winningLine = [];

  const modeSelect = document.getElementById("gameModeSelect");
  if (modeSelect) modeSelect.value = m.mode;
  toggleOpponentField();
  renderBoard();
}

function handleLocalMove(index) {
  if (gameState.finished || gameState.board[index] !== "") return;
  gameState.board[index] = gameState.turn;
  const outcome = evaluateBoard(gameState.board);

  if (outcome) {
    gameState.finished = true;
    gameState.winningLine = outcome.line;
    recordLocalResult(outcome);
    renderBoard();
    const bannerEl = document.getElementById("turnBanner");
    if (bannerEl) {
      bannerEl.textContent = outcome.winner === "draw"
        ? "Fim de jogo: Empate! Clique em Nova Partida."
        : "Fim de jogo: Vitória de " + outcome.winner + "!";
    }
    return;
  }

  gameState.turn = gameState.turn === "X" ? "O" : "X";
  renderBoard();

  if (gameState.mode === "minimax" && !gameState.finished && gameState.turn === getAiSymbol()) {
    const aiMove = chooseBestMove([...gameState.board], getAiSymbol(), gameState.humanSymbol);
    if (aiMove !== -1) {
      handleLocalMove(aiMove);
    }
  }
}

async function handleCellClick(index) {
  if (gameState.finished || gameState.board[index] !== "") return;

  if (!gameState.matchId) {
    if (gameState.mode === "minimax" && gameState.turn !== gameState.humanSymbol) return;
    handleLocalMove(index);
    return;
  }

  const bannerEl = document.getElementById("turnBanner");
  try {
    const res = await fetch(`/api/matches/${encodeURIComponent(gameState.matchId)}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        index,
        userId: discordSession.user_id,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      if (bannerEl) bannerEl.textContent = data.error || "Jogada rejeitada pelo servidor.";
      return;
    }

    const m = data.match;
    gameState.board = m.board;
    gameState.turn = m.turn;
    gameState.finished = m.status === "finished";
    gameState.winningLine = m.winningLine || [];
    renderBoard();

    if (gameState.finished && bannerEl) {
      bannerEl.textContent = m.winner === "draw"
        ? "Fim de jogo (D1): Empate!"
        : `Fim de jogo (D1): Vitória de ${m.winner}!`;
    }
    await syncServerState();
  } catch {
    handleLocalMove(index);
  }
}

async function startNewGame() {
  gameState.board = Array(9).fill("");
  gameState.turn = "X";
  gameState.finished = false;
  gameState.winningLine = [];
  gameState.matchId = null;

  const opponentInput = document.getElementById("opponentIdInput");
  const opponentId = opponentInput ? opponentInput.value.trim() : "";

  try {
    const res = await fetch("/api/matches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: gameState.mode === "async" ? "async" : "minimax",
        userId: discordSession.user_id,
        username: discordSession.username,
        avatar: discordSession.avatar,
        humanSymbol: gameState.humanSymbol,
        opponentId,
      }),
    });
    const data = await res.json();
    if (res.ok && data.ok && data.match) {
      gameState.matchId = data.match.id;
      gameState.playerXId = data.match.player_x_id;
      gameState.playerOId = data.match.player_o_id;
      renderBoard();
      await syncServerState();
      return;
    }
  } catch {}

  renderBoard();
  if (gameState.mode === "minimax" && gameState.humanSymbol === "O") {
    const aiMove = chooseBestMove([...gameState.board], getAiSymbol(), gameState.humanSymbol);
    if (aiMove !== -1) {
      handleLocalMove(aiMove);
    }
  }
}

function toggleOpponentField() {
  const fieldEl = document.getElementById("opponentField");
  if (!fieldEl) return;
  fieldEl.style.display = gameState.mode === "async" ? "flex" : "none";
}

async function carregarStatus() {
  const listEl = document.getElementById("recordsList");
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    listEl.innerHTML = "";
    if (data.sessionUser) {
      discordSession.user_id = data.sessionUser.userId;
      discordSession.username = data.sessionUser.username;
      discordSession.avatar = data.sessionUser.avatar || discordSession.avatar;
      renderDiscordHeader();
    }
    const items = Array.isArray(data.ultimosRegistros) ? data.ultimosRegistros : [];
    if (items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "API Online (" + (data.d1Connected ? "D1 Conectado ✅" : "Modo Diagnóstico Serverless ✅") + "). Nenhum registro gravado ainda.";
      listEl.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = "[" + (item.created_at || "agora") + "] " + item.username + " (" + item.user_id + "): " + item.conteudo;
      listEl.appendChild(li);
    });
  } catch {
    listEl.innerHTML = "<li>Modo estático local. Publique no Cloudflare Pages para ativar /api/status.</li>";
  }
}

document.getElementById("board")?.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  if (!cell) return;
  const idx = Number(cell.dataset.index);
  handleCellClick(idx);
});

document.getElementById("newGameBtn")?.addEventListener("click", startNewGame);

document.getElementById("gameModeSelect")?.addEventListener("change", (e) => {
  gameState.mode = e.target.value;
  toggleOpponentField();
  startNewGame();
});

document.getElementById("playerSymbolSelect")?.addEventListener("change", (e) => {
  gameState.humanSymbol = e.target.value;
  startNewGame();
});

document.getElementById("sendBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("recordInput");
  const statusEl = document.getElementById("statusMessage");
  const conteudo = (input.value || "").trim();
  if (!conteudo) return;

  statusEl.textContent = "Enviando para Cloudflare Function...";
  try {
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: discordSession.user_id,
        username: discordSession.username,
        conteudo,
      }),
    });
    if (res.ok) {
      input.value = "";
      statusEl.textContent = "✓ Registro validado e processado na borda!";
      await carregarStatus();
    } else {
      statusEl.textContent = "Erro ao registrar.";
    }
  } catch {
    statusEl.textContent = "API disponível após o deploy no Cloudflare Pages.";
  }
});

renderDiscordHeader();
toggleOpponentField();
renderBoard();
renderLists();
carregarStatus();
syncServerState();