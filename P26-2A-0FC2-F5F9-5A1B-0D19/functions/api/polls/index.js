// GET /api/polls: lista enquetes (abertas primeiro pelo prazo mais próximo, depois encerradas mais recentes).
// POST /api/polls: cria enquete validando tudo no servidor; o criador vem da sessão.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { checkPost, error, json, methodNotAllowed, readJson, safe, unauthorized } from "../../_lib/http.js";
import { getSessionUser } from "../../_lib/session.js";
import { validatePollInput } from "../../_lib/polls.js";

export const onRequestGet = safe(async ({ request, env }) => {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();
  const now = Date.now();

  // Contagens e "já votei" calculados no banco; ordenação conforme o SPEC.
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.title, p.description, p.closes_at, u.username, u.avatar_url,
            (SELECT COUNT(*) FROM votes v WHERE v.poll_id = p.id) AS total_votes,
            (SELECT COUNT(*) FROM poll_options o WHERE o.poll_id = p.id) AS option_count,
            EXISTS (SELECT 1 FROM votes v WHERE v.poll_id = p.id AND v.user_id = ?) AS has_voted
       FROM polls p JOIN users u ON u.user_id = p.creator_id
      ORDER BY (p.closes_at > ?) DESC,
               CASE WHEN p.closes_at > ? THEN p.closes_at END ASC,
               p.closes_at DESC`
  ).bind(user.user_id, now, now).all();

  const polls = (results || []).map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    closes_at: r.closes_at,
    is_open: now < r.closes_at,
    total_votes: r.total_votes,
    has_voted: Boolean(r.has_voted),
    option_count: r.option_count,
    creator: { username: r.username, avatar_url: r.avatar_url },
  }));
  return json({ ok: true, server_now: now, polls });
});

export const onRequestPost = safe(async ({ request, env }) => {
  const user = await getSessionUser(request, env);
  if (!user) return unauthorized();
  const bad = checkPost(request);
  if (bad) return bad;
  const body = await readJson(request);
  if (!body.ok) return body.response;

  // Validação com o relógio do servidor (nunca o do cliente).
  const now = Date.now();
  const v = validatePollInput(body.value, now);
  if (!v.ok) return error(400, "dados_invalidos", v.message);
  const { title, description, closesAt, options } = v.value;

  // 1) Cria a enquete e obtém o id com RETURNING.
  const poll = await env.DB.prepare(
    "INSERT INTO polls (creator_id, title, description, closes_at) VALUES (?, ?, ?, ?) RETURNING id"
  ).bind(user.user_id, title, description, closesAt).first();

  // 2) Insere todas as opções em lote (uma transação). Se falhar, remove a enquete órfã.
  let rows;
  try {
    rows = await env.DB.batch(
      options.map((label, i) =>
        env.DB.prepare("INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?) RETURNING id, label")
          .bind(poll.id, label, i)
      )
    );
  } catch (e) {
    await env.DB.prepare("DELETE FROM polls WHERE id = ?").bind(poll.id).run();
    throw e;
  }

  return json({
    ok: true,
    poll: {
      id: poll.id,
      title,
      description,
      closes_at: closesAt,
      is_open: true,
      total_votes: 0,
      has_voted: false,
      creator: { username: user.username, avatar_url: user.avatar_url },
      options: rows.map((r) => r.results[0]),
    },
  }, 201);
});

export const onRequest = () => methodNotAllowed("GET, POST");
