/**
 * /api/capsules — cápsulas do tempo.
 *
 * SEGURANÇA TEMPORAL (regra central do projeto):
 * a comparação "data atual x unlock_date" é feita AQUI, no servidor, com o relógio
 * do Cloudflare. Enquanto a data não chegou, o JSON devolve só os metadados
 * (autor, título, data e segundos restantes). O campo `content` nem existe na resposta,
 * e o texto também nem sai do banco (o SELECT já o anula via CASE).
 *
 *   GET  : lista cápsulas da turma (públicas) + as do próprio usuário logado.
 *   POST : cria cápsula (exige sessão; data de desbloqueio precisa estar no futuro).
 */
import { cleanText, getSessionUser, isSameOrigin, json, readJsonBody } from "../_lib/util.js";
import { buildCapsuleDto } from "../_lib/capsule.js";

const MAX_CAPSULES_PER_USER = 50;
const MAX_YEARS_AHEAD = 30;
const MIN_LEAD_MS = 60 * 1000; // pelo menos 1 minuto no futuro

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: "database_unavailable" }, 503);

  const user = await getSessionUser(request, env);
  const now = new Date();
  const nowIso = now.toISOString();

  // `content` só sai do banco se a data já passou; do contrário vem NULL.
  const { results } = await env.DB.prepare(
    `SELECT c.id, c.user_id, c.title, c.audience, c.unlock_date, c.created_at,
            CASE WHEN c.unlock_date <= ? THEN c.content ELSE NULL END AS content,
            u.username, u.avatar
       FROM capsules c JOIN users u ON u.id = c.user_id
      WHERE c.audience = 'turma' OR c.user_id = ?
      ORDER BY c.unlock_date ASC, c.id ASC
      LIMIT 200`
  ).bind(nowIso, user ? user.id : "").all();

  const nowMs = now.getTime();
  return json({
    server_time: nowIso,
    capsules: results.map((r) => buildCapsuleDto(r, nowMs, user ? user.id : null)),
  });
}

export async function onRequestPost({ request, env }) {
  if (!isSameOrigin(request)) return json({ error: "forbidden_origin" }, 403);
  if (!env.DB) return json({ error: "database_unavailable" }, 503);

  const user = await getSessionUser(request, env);
  if (!user) return json({ error: "login_required" }, 401);

  const body = await readJsonBody(request);
  if (!body) return json({ error: "invalid_body" }, 400);

  const title = cleanText(body.title, 1, 100);
  const content = cleanText(body.content, 1, 2000);
  const audience = body.audience;
  if (!title) return json({ error: "invalid_title", message: "O título deve ter de 1 a 100 caracteres." }, 400);
  if (!content) return json({ error: "invalid_content", message: "A mensagem deve ter de 1 a 2000 caracteres." }, 400);
  if (audience !== "turma" && audience !== "self") {
    return json({ error: "invalid_audience", message: "Destinatário deve ser 'turma' ou 'self'." }, 400);
  }

  // Data de desbloqueio: validada e normalizada pelo servidor.
  const parsed = typeof body.unlock_date === "string" ? Date.parse(body.unlock_date) : NaN;
  if (Number.isNaN(parsed)) {
    return json({ error: "invalid_unlock_date", message: "Data de desbloqueio inválida." }, 400);
  }
  const nowMs = Date.now();
  if (parsed < nowMs + MIN_LEAD_MS) {
    return json({ error: "unlock_date_not_future", message: "A data de desbloqueio precisa estar no futuro." }, 400);
  }
  if (parsed > nowMs + MAX_YEARS_AHEAD * 365 * 24 * 3600 * 1000) {
    return json({ error: "unlock_date_too_far", message: `O limite é de ${MAX_YEARS_AHEAD} anos no futuro.` }, 400);
  }
  const unlockDate = new Date(parsed).toISOString();

  const countRow = await env.DB.prepare("SELECT COUNT(*) AS n FROM capsules WHERE user_id = ?").bind(user.id).first();
  if (countRow && countRow.n >= MAX_CAPSULES_PER_USER) {
    return json({ error: "capsule_limit", message: `Limite de ${MAX_CAPSULES_PER_USER} cápsulas por usuário.` }, 429);
  }

  const createdAt = new Date(nowMs).toISOString();
  const res = await env.DB.prepare(
    `INSERT INTO capsules (user_id, title, content, audience, unlock_date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(user.id, title, content, audience, unlockDate, createdAt).run();

  const dto = buildCapsuleDto(
    {
      id: res.meta ? res.meta.last_row_id : null,
      user_id: user.id,
      title,
      content,
      audience,
      unlock_date: unlockDate,
      created_at: createdAt,
      username: user.username,
      avatar: user.avatar,
    },
    nowMs,
    user.id
  );
  return json(dto, 201);
}
