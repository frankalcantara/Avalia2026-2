
/**
 * DevGratitude - Projeto #29
 * Chave: P26-3A-AB80-1165-A8DC-0585
 *
 * GET  /api/kudos - Consulta reconhecimentos
 * POST /api/kudos - Publica reconhecimento
 */

import { verifySession } from "../lib/auth.js";

const VALID_BADGES = [
  "bug",
  "explanation",
  "teamwork"
];

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return json(
      { error: "Banco D1 não configurado." },
      503
    );
  }

  try {
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") || "all";

    if (!["all", "sent", "received"].includes(filter)) {
      return json({ error: "Filtro inválido." }, 400);
    }

    let sql = `
      SELECT
        k.id,
        k.sender_id AS senderId,
        k.recipient_id AS recipientId,
        k.badge,
        k.message,
        k.created_at AS createdAt,
        sender.username AS senderUsername,
        recipient.username AS recipientUsername
      FROM kudos k
      JOIN discord_users sender
        ON sender.user_id = k.sender_id
      JOIN discord_users recipient
        ON recipient.user_id = k.recipient_id
    `;

    const params = [];

    if (filter !== "all") {
      const user = await verifySession(
        request,
        env.SESSION_SECRET
      );

      if (!user) {
        return json(
          { error: "Entre com Discord para usar este filtro." },
          401
        );
      }

      if (filter === "sent") {
        sql += " WHERE k.sender_id = ?";
      } else {
        sql += " WHERE k.recipient_id = ?";
      }

      params.push(user.userId);
    }

    sql += " ORDER BY k.created_at DESC, k.id DESC LIMIT 100";

    const result = await env.DB
      .prepare(sql)
      .bind(...params)
      .all();

    return json({
      kudos: result.results || []
    });
  } catch {
    return json(
      { error: "Erro ao consultar reconhecimentos." },
      500
    );
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) {
    return json(
      { error: "Banco D1 não configurado." },
      503
    );
  }

  const user = await verifySession(
    request,
    env.SESSION_SECRET
  );

  if (!user) {
    return json(
      { error: "Faça login com Discord para publicar." },
      401
    );
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return json({ error: "JSON inválido." }, 400);
  }

  const recipientId = String(body?.recipientId || "").trim();
  const badge = String(body?.badge || "").trim();
  const message = String(body?.message || "").trim();

  if (!recipientId || !VALID_BADGES.includes(badge)) {
    return json(
      { error: "Destinatário ou selo inválido." },
      400
    );
  }

  if (message.length < 5 || message.length > 280) {
    return json(
      { error: "A mensagem deve ter entre 5 e 280 caracteres." },
      400
    );
  }

  if (recipientId === user.userId) {
    return json(
      { error: "Você não pode reconhecer a si mesmo." },
      400
    );
  }

  try {
    const recipient = await env.DB.prepare(
      "SELECT user_id FROM discord_users WHERE user_id = ?"
    )
      .bind(recipientId)
      .first();

    if (!recipient) {
      return json(
        { error: "Colega não encontrado." },
        404
      );
    }

    const sender = await env.DB.prepare(
      "SELECT user_id FROM discord_users WHERE user_id = ?"
    )
      .bind(user.userId)
      .first();

    if (!sender) {
      return json(
        { error: "Usuário autenticado não cadastrado." },
        403
      );
    }

    const result = await env.DB.prepare(
      `INSERT INTO kudos
       (sender_id, recipient_id, badge, message)
       VALUES (?, ?, ?, ?)`
    )
      .bind(user.userId, recipientId, badge, message)
      .run();

    return json(
      {
        success: true,
        id: result.meta?.last_row_id
      },
      201
    );
  } catch {
    return json(
      { error: "Erro ao salvar reconhecimento." },
      500
    );
  }
}
