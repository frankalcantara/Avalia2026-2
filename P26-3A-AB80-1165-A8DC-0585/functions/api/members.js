
/**
 * DevGratitude - Projeto #29
 * GET /api/members
 * Lista os usuários Discord cadastrados no D1.
 */

export async function onRequestGet({ env }) {
  if (!env.DB) {
    return Response.json(
      { error: "Banco de dados D1 não configurado." },
      { status: 503 }
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT
         user_id AS userId,
         username,
         avatar
       FROM discord_users
       ORDER BY username COLLATE NOCASE ASC
       LIMIT 200`
    ).all();

    return Response.json(
      { members: result.results || [] },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return Response.json(
      { error: "Não foi possível carregar os colegas." },
      { status: 500 }
    );
  }
}
