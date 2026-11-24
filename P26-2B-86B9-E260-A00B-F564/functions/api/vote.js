/**
 * Cloudflare Pages Function — POST /api/vote
 * Registra voto verificando no servidor:
 *  - sessão Discord OAuth2 válida;
 *  - existência da enquete e da opção;
 *  - prazo de encerramento (closes_at);
 *  - voto duplicado do mesmo user_id na mesma enquete.
 */
import { ensureSchema, getSession, json, loadPolls, toPositiveInt, upsertSessionUser } from "./_lib.js";

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.DB) return json({ ok: false, error: "d1_unavailable" }, 503);

  await ensureSchema(env);
  const session = await getSession(request, env);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  await upsertSessionUser(env, session);

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "invalid_json" }, 400);

  const pollId = toPositiveInt(body.pollId);
  const optionId = toPositiveInt(body.optionId);
  if (!pollId || !optionId) return json({ ok: false, error: "invalid_payload" }, 400);

  const poll = await env.DB.prepare("SELECT id, closes_at FROM polls WHERE id = ?")
    .bind(pollId)
    .first();
  if (!poll) return json({ ok: false, error: "poll_not_found" }, 404);

  if (new Date(poll.closes_at).getTime() <= Date.now()) {
    const polls = await loadPolls(env, session.userId, pollId);
    return json({ ok: false, error: "poll_closed", poll: polls[0] || null }, 409);
  }

  const option = await env.DB.prepare(
    "SELECT id FROM poll_options WHERE id = ? AND poll_id = ?"
  )
    .bind(optionId, pollId)
    .first();
  if (!option) return json({ ok: false, error: "option_not_found" }, 404);

  const existingVote = await env.DB.prepare(
    "SELECT id FROM votes WHERE poll_id = ? AND user_id = ?"
  )
    .bind(pollId, session.userId)
    .first();

  if (existingVote) {
    const polls = await loadPolls(env, session.userId, pollId);
    return json({ ok: false, error: "already_voted", poll: polls[0] || null }, 409);
  }

  try {
    await env.DB.prepare("INSERT INTO votes (poll_id, option_id, user_id) VALUES (?, ?, ?)")
      .bind(pollId, optionId, session.userId)
      .run();
  } catch (error) {
    const message = String(error && error.message ? error.message : "");
    if (/unique/i.test(message)) {
      const polls = await loadPolls(env, session.userId, pollId);
      return json({ ok: false, error: "already_voted", poll: polls[0] || null }, 409);
    }
    return json({ ok: false, error: "vote_failed" }, 500);
  }

  const polls = await loadPolls(env, session.userId, pollId);
  return json({ ok: true, poll: polls[0] || null }, 201);
}
