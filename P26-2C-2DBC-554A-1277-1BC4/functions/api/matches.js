const CHAVE_PROJETO = "P26-2C-2DBC-554A-1277-1BC4";

function getSessionUser(request) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const match = cookieHeader.match(/discord_session=([^;]+)/);
  if (match) {
    try {
      const parsed = JSON.parse(decodeURIComponent(atob(match[1])));
      if (parsed && parsed.userId) {
        return {
          userId: String(parsed.userId).slice(0, 64),
          username: String(parsed.username || "Jogador").slice(0, 80),
          avatar: String(parsed.avatar || "https://cdn.discordapp.com/embed/avatars/0.png"),
          authenticated: true,
        };
      }
    } catch {}
  }
  return null;
}

async function ensureSchema(db) {
  if (!db) return;
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS discord_users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL, avatar TEXT, rating INTEGER NOT NULL DEFAULT 1000, wins INTEGER NOT NULL DEFAULT 0, losses INTEGER NOT NULL DEFAULT 0, draws INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
  ).run();
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'minimax', player_x_id TEXT NOT NULL, player_o_id TEXT NOT NULL, board_json TEXT NOT NULL, turn TEXT NOT NULL DEFAULT 'X', status TEXT NOT NULL DEFAULT 'in_progress', winner TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
  ).run();
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS match_history (id INTEGER PRIMARY KEY AUTOINCREMENT, match_id TEXT NOT NULL, mode TEXT NOT NULL, player_x_id TEXT NOT NULL, player_o_id TEXT NOT NULL, winner TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
  ).run();
}

export async function onRequest(context) {
  const { request, env } = context;
  const session = getSessionUser(request);

  if (request.method === "GET") {
    if (!env.DB) {
      return Response.json({
        ok: true,
        chave: CHAVE_PROJETO,
        d1Connected: false,
        activeMatches: [],
        history: [],
        ranking: [],
      });
    }

    await ensureSchema(env.DB);
    const activeRes = await env.DB.prepare(
      "SELECT id, mode, player_x_id, player_o_id, board_json, turn, status, winner, updated_at FROM matches WHERE status = 'in_progress' ORDER BY updated_at DESC LIMIT 20"
    ).all();
    const historyRes = await env.DB.prepare(
      "SELECT id, match_id, mode, player_x_id, player_o_id, winner, summary, created_at FROM match_history ORDER BY id DESC LIMIT 20"
    ).all();
    const rankingRes = await env.DB.prepare(
      "SELECT user_id, username, avatar, rating, wins, losses, draws FROM discord_users ORDER BY rating DESC, wins DESC LIMIT 20"
    ).all();

    return Response.json({
      ok: true,
      chave: CHAVE_PROJETO,
      d1Connected: true,
      activeMatches: (activeRes.results || []).map((m) => ({
        ...m,
        board: JSON.parse(m.board_json || '["","","","","","","","",""]'),
      })),
      history: historyRes.results || [],
      ranking: rankingRes.results || [],
    });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ ok: false, error: "Payload JSON inválido." }, { status: 400 });
    }

    const mode = body.mode === "async" ? "async" : "minimax";
    const actorId = session?.userId || String(body.userId || "").trim().slice(0, 64);
    const actorName = session?.username || String(body.username || "").trim().slice(0, 80);
    const actorAvatar = session?.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";

    if (!actorId || !actorName) {
      return Response.json({ ok: false, error: "Identificação do jogador obrigatória." }, { status: 401 });
    }

    const opponentId = mode === "minimax"
      ? "minimax_ai"
      : String(body.opponentId || "").trim().slice(0, 64);

    if (mode === "async" && (!opponentId || opponentId === actorId)) {
      return Response.json({ ok: false, error: "Informe um user_id válido de colega diferente para partida assíncrona." }, { status: 400 });
    }

    const humanSymbol = body.humanSymbol === "O" ? "O" : "X";
    const playerXId = mode === "minimax" ? (humanSymbol === "X" ? actorId : "minimax_ai") : actorId;
    const playerOId = mode === "minimax" ? (humanSymbol === "O" ? actorId : "minimax_ai") : opponentId;
    const matchId = "match_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
    const initialBoard = Array(9).fill("");

    if (env.DB) {
      await ensureSchema(env.DB);
      await env.DB.prepare(
        "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
      ).bind(actorId, actorName, actorAvatar).run();

      if (mode === "minimax") {
        await env.DB.prepare(
          "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES ('minimax_ai', 'Minimax Engine', 'https://cdn.discordapp.com/embed/avatars/1.png', CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING"
        ).run();
      } else {
        await env.DB.prepare(
          "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, 'https://cdn.discordapp.com/embed/avatars/2.png', CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO NOTHING"
        ).bind(opponentId, "Colega " + opponentId).run();
      }

      await env.DB.prepare(
        "INSERT INTO matches (id, mode, player_x_id, player_o_id, board_json, turn, status, winner) VALUES (?, ?, ?, ?, ?, 'X', 'in_progress', NULL)"
      ).bind(matchId, mode, playerXId, playerOId, JSON.stringify(initialBoard)).run();
    }

    return Response.json({
      ok: true,
      match: {
        id: matchId,
        mode,
        player_x_id: playerXId,
        player_o_id: playerOId,
        board: initialBoard,
        turn: "X",
        status: "in_progress",
        winner: null,
      },
    }, { status: 201 });
  }

  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}