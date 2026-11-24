const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function evaluateBoard(board) {
  for (const [a, b, c] of WIN_LINES) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: [a, b, c] };
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

function getSessionUser(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/discord_session=([^;]+)/);
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(atob(match[1])));
      if (parsed && parsed.userId) {
        return String(parsed.userId).slice(0, 64);
      }
    } catch {}
  }
  return null;
}

async function applyRankingAndHistory(db, matchRow, outcome) {
  if (!db || !outcome) return;
  const winnerSymbol = outcome.winner;
  const xId = matchRow.player_x_id;
  const oId = matchRow.player_o_id;

  let summary = "";
  if (winnerSymbol === "draw") {
    summary = `Empate (${matchRow.mode}) entre ${xId} e ${oId}`;
    if (xId !== "minimax_ai") {
      await db.prepare("UPDATE discord_users SET draws = draws + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(xId).run();
    }
    if (oId !== "minimax_ai") {
      await db.prepare("UPDATE discord_users SET draws = draws + 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(oId).run();
    }
  } else {
    const winId = winnerSymbol === "X" ? xId : oId;
    const loseId = winnerSymbol === "X" ? oId : xId;
    summary = `Vitória de ${winId} (${winnerSymbol}) sobre ${loseId} (${matchRow.mode})`;

    if (winId !== "minimax_ai") {
      await db.prepare(
        "UPDATE discord_users SET wins = wins + 1, rating = rating + 25, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
      ).bind(winId).run();
    }
    if (loseId !== "minimax_ai") {
      await db.prepare(
        "UPDATE discord_users SET losses = losses + 1, rating = CASE WHEN rating - 15 < 0 THEN 0 ELSE rating - 15 END, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?"
      ).bind(loseId).run();
    }
  }

  await db.prepare(
    "INSERT INTO match_history (match_id, mode, player_x_id, player_o_id, winner, summary) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(matchRow.id, matchRow.mode, xId, oId, winnerSymbol, summary).run();
}

export async function onRequestPost(context) {
  const { request, env, params } = context;
  const matchId = String(params?.id || "").trim();
  const body = await request.json().catch(() => null);

  if (!matchId || !body || typeof body.index !== "number" || !Number.isInteger(body.index) || body.index < 0 || body.index > 8) {
    return Response.json({ ok: false, error: "Índice de jogada inválido (esperado inteiro de 0 a 8)." }, { status: 400 });
  }

  if (!env.DB) {
    return Response.json({ ok: false, error: "Banco Cloudflare D1 não vinculado." }, { status: 503 });
  }

  const matchRow = await env.DB.prepare(
    "SELECT id, mode, player_x_id, player_o_id, board_json, turn, status, winner FROM matches WHERE id = ?"
  ).bind(matchId).first();

  if (!matchRow) {
    return Response.json({ ok: false, error: "Partida não encontrada." }, { status: 404 });
  }

  if (matchRow.status !== "in_progress") {
    return Response.json({ ok: false, error: "Partida já encerrada.", conflict: true }, { status: 409 });
  }

  const actorId = getSessionUser(request) || String(body.userId || "").trim().slice(0, 64);
  const expectedPlayerId = matchRow.turn === "X" ? matchRow.player_x_id : matchRow.player_o_id;

  if (!actorId || actorId !== expectedPlayerId) {
    return Response.json({ ok: false, error: "Não é a vez deste jogador ou jogador não autorizado." }, { status: 403 });
  }

  const board = JSON.parse(matchRow.board_json || '["","","","","","","","",""]');
  if (board[body.index] !== "") {
    return Response.json({ ok: false, error: "Casa já ocupada no tabuleiro.", conflict: true }, { status: 409 });
  }

  board[body.index] = matchRow.turn;
  let nextTurn = matchRow.turn === "X" ? "O" : "X";
  let outcome = evaluateBoard(board);
  let winningLine = outcome ? outcome.line : [];

  if (!outcome && matchRow.mode === "minimax") {
    const aiSymbol = nextTurn;
    const humanSymbol = aiSymbol === "X" ? "O" : "X";
    const aiMove = chooseBestMove([...board], aiSymbol, humanSymbol);
    if (aiMove !== -1 && board[aiMove] === "") {
      board[aiMove] = aiSymbol;
      outcome = evaluateBoard(board);
      winningLine = outcome ? outcome.line : [];
      nextTurn = aiSymbol === "X" ? "O" : "X";
    }
  }

  const newStatus = outcome ? "finished" : "in_progress";
  const winnerVal = outcome ? outcome.winner : null;

  await env.DB.prepare(
    "UPDATE matches SET board_json = ?, turn = ?, status = ?, winner = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
  ).bind(JSON.stringify(board), nextTurn, newStatus, winnerVal, matchId).run();

  if (outcome) {
    await applyRankingAndHistory(env.DB, matchRow, outcome);
  }

  return Response.json({
    ok: true,
    match: {
      id: matchRow.id,
      mode: matchRow.mode,
      player_x_id: matchRow.player_x_id,
      player_o_id: matchRow.player_o_id,
      board,
      turn: nextTurn,
      status: newStatus,
      winner: winnerVal,
      winningLine,
    },
  });
}