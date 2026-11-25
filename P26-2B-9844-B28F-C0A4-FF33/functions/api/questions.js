import {
  apiError,
  json,
  missingDatabase,
  readJson,
  serverError,
} from "../_shared/http.js";
import { readSession } from "../_shared/session.js";

const QUESTION_FIELDS = `
  q.id,
  q.title,
  q.content,
  q.author_user_id AS authorUserId,
  u.username AS authorUsername,
  u.avatar AS authorAvatar,
  q.status,
  q.accepted_answer_id AS acceptedAnswerId,
  q.created_at AS createdAt,
  q.updated_at AS updatedAt,
  (SELECT COUNT(*) FROM answers a WHERE a.question_id = q.id) AS answerCount
`;

export async function onRequestGet({ request, env }) {
  if (!env.DB) {
    return missingDatabase();
  }

  const status = new URL(request.url).searchParams.get("status");
  if (status && status !== "open" && status !== "resolved") {
    return apiError(400, "invalid_status", "O filtro status deve ser open ou resolved.");
  }

  try {
    const result = await env.DB.prepare(`
      SELECT ${QUESTION_FIELDS}
      FROM questions q
      JOIN discord_users u ON u.user_id = q.author_user_id
      WHERE (? IS NULL OR q.status = ?)
      ORDER BY CASE WHEN q.status = 'open' THEN 0 ELSE 1 END, q.created_at DESC, q.id DESC
    `).bind(status, status).all();

    return json({
      items: (result.results || []).map((item) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        author: {
          userId: item.authorUserId,
          username: item.authorUsername,
          avatar: item.authorAvatar,
        },
        status: item.status,
        acceptedAnswerId: item.acceptedAnswerId,
        answerCount: Number(item.answerCount),
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return serverError("GET /api/questions", error);
  }
}

export async function onRequestPost({ request, env }) {
  const user = await readSession(request, env.SESSION_SECRET);
  if (!user) {
    return apiError(401, "unauthenticated", "Entre com o Discord para abrir uma pergunta.");
  }
  if (!env.DB) {
    return missingDatabase();
  }

  const body = await readJson(request);
  if (!body) {
    return apiError(400, "invalid_json", "Envie um corpo JSON válido.");
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!title || title.length > 180) {
    return apiError(400, "invalid_title", "O título é obrigatório e deve ter até 180 caracteres.");
  }
  if (!content || content.length > 15000) {
    return apiError(400, "invalid_content", "A descrição é obrigatória e deve ter até 15000 caracteres.");
  }

  try {
    const result = await env.DB.prepare(
      "INSERT INTO questions (author_user_id, title, content) VALUES (?, ?, ?)",
    ).bind(user.userId, title, content).run();
    const id = result.meta?.last_row_id;
    const question = await env.DB.prepare(`
      SELECT ${QUESTION_FIELDS}
      FROM questions q
      JOIN discord_users u ON u.user_id = q.author_user_id
      WHERE q.id = ?
    `).bind(id).first();

    if (!question) {
      throw new Error("The newly created question could not be read back.");
    }

    return json({
      id: question.id,
      title: question.title,
      content: question.content,
      author: {
        userId: question.authorUserId,
        username: question.authorUsername,
        avatar: question.authorAvatar,
      },
      status: question.status,
      acceptedAnswerId: question.acceptedAnswerId,
      answerCount: Number(question.answerCount),
      createdAt: question.createdAt,
    }, 201);
  } catch (error) {
    return serverError("POST /api/questions", error);
  }
}
