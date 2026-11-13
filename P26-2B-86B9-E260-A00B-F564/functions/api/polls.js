/**
 * Cloudflare Pages Function — /api/polls
 * GET  -> lista enquetes com resultados consolidados.
 * POST -> cria enquete (requer sessão Discord OAuth2 válida).
 * Todas as regras de negócio são validadas no servidor.
 */
import { ensureSchema, getSession, json, loadPolls, upsertSessionUser } from "./_lib.js";

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return { error: "options_required" };

  const labels = rawOptions
    .map((item) => String(item == null ? "" : item).trim())
    .filter(Boolean)
    .map((label) => label.slice(0, 80));

  if (labels.length < 2) return { error: "options_minimum" };
  if (labels.length > 10) return { error: "options_maximum" };

  const unique = new Set(labels.map((label) => label.toLowerCase()));
  if (unique.size !== labels.length) return { error: "options_duplicated" };

  return { options: labels };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  if (!env.DB) return json({ ok: false, error: "d1_unavailable" }, 503);

  await ensureSchema(env);
  const session = await getSession(request, env);
  const polls = await loadPolls(env, session ? session.userId : null);

  return json({
    ok: true,
    authenticated: Boolean(session),
    user: session
      ? { userId: session.userId, username: session.username, avatar: session.avatar }
      : null,
    polls,
  });
}

export async function onRequestPost(context) {
  const { env, request } = context;
  if (!env.DB) return json({ ok: false, error: "d1_unavailable" }, 503);

  await ensureSchema(env);
  const session = await getSession(request, env);
  if (!session) return json({ ok: false, error: "unauthorized" }, 401);
  await upsertSessionUser(env, session);

  const body = await request.json().catch(() => null);
  if (!body) return json({ ok: false, error: "invalid_json" }, 400);

  const title = String(body.title || "").trim();
  if (title.length < 3 || title.length > 120) {
    return json({ ok: false, error: "title_invalid" }, 400);
  }

  const description = String(body.description || "").trim().slice(0, 1000);

  const closesAtRaw = String(body.closesAt || "").trim();
  const closesAtDate = new Date(closesAtRaw);
  if (!closesAtRaw || Number.isNaN(closesAtDate.getTime())) {
    return json({ ok: false, error: "deadline_invalid" }, 400);
  }
  if (closesAtDate.getTime() <= Date.now()) {
    return json({ ok: false, error: "deadline_past" }, 400);
  }

  const normalized = normalizeOptions(body.options);
  if (normalized.error) return json({ ok: false, error: normalized.error }, 400);

  const closesAt = closesAtDate.toISOString();
  const inserted = await env.DB.prepare(
    "INSERT INTO polls (owner_id, owner_name, title, description, closes_at) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(session.userId, session.username, title, description, closesAt)
    .run();

  const pollId = inserted.meta ? inserted.meta.last_row_id : null;
  if (!pollId) return json({ ok: false, error: "persist_failed" }, 500);

  await env.DB.batch(
    normalized.options.map((label, index) =>
      env.DB.prepare("INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?)").bind(
        pollId,
        label,
        index
      )
    )
  );

  const polls = await loadPolls(env, session.userId, pollId);
  return json({ ok: true, poll: polls[0] || null }, 201);
}
