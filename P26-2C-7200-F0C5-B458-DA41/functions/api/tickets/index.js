/**
 * /api/tickets
 *  GET  — lista chamados (filtros: status, severity, q, mine=1)
 *  POST — abre um chamado { title, location, severity, description }
 */
import { requireUser } from "../../_lib/session.js";
import { json, fail, readJson, sameOrigin, requireDb } from "../../_lib/http.js";
import { validateTicketInput, parseListFilters, generateTicketCode } from "../../_lib/rules.js";

const MAX_OPEN_PER_HOUR = 10;

export async function onRequestGet({ request, env }) {
  const noDb = requireDb(env);
  if (noDb) return noDb;
  const { user, response } = await requireUser(request, env);
  if (response) return response;

  const f = parseListFilters(new URL(request.url).searchParams);
  const where = [];
  const binds = [];
  if (f.status) { where.push("t.status = ?"); binds.push(f.status); }
  if (f.severity) { where.push("t.severity = ?"); binds.push(f.severity); }
  if (f.mine) { where.push("t.author_id = ?"); binds.push(user.user_id); }
  if (f.q) {
    where.push("(t.title LIKE ? ESCAPE '\\' OR t.location LIKE ? ESCAPE '\\' OR t.code LIKE ? ESCAPE '\\')");
    const like = `%${f.q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    binds.push(like, like, like);
  }

  const sql = `
    SELECT t.code, t.title, t.location, t.severity, t.status, t.created_at, t.updated_at,
           t.author_id, u.username AS author_name, u.avatar AS author_avatar,
           (SELECT COUNT(*) FROM ticket_events e WHERE e.ticket_id = t.id AND e.kind = 'comentario') AS comments
      FROM tickets t JOIN users u ON u.user_id = t.author_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY CASE t.status WHEN 'resolvido' THEN 1 ELSE 0 END,
              CASE t.severity WHEN 'critica' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
              t.updated_at DESC
     LIMIT 200`;
  const { results } = await env.DB.prepare(sql).bind(...binds).all();

  const counts = await env.DB.prepare("SELECT status, COUNT(*) AS n FROM tickets GROUP BY status").all();
  const totals = { aberto: 0, em_analise: 0, aguardando: 0, resolvido: 0 };
  for (const r of counts.results || []) totals[r.status] = r.n;

  return json({ ok: true, tickets: results || [], totals });
}

export async function onRequestPost({ request, env }) {
  const noDb = requireDb(env);
  if (noDb) return noDb;
  if (!sameOrigin(request)) return fail(403, "Origem não permitida.");
  const { user, response } = await requireUser(request, env);
  if (response) return response;

  const body = await readJson(request);
  if (!body) return fail(400, "Envie um JSON válido.");
  const v = validateTicketInput(body);
  if (!v.ok) return fail(422, "Dados inválidos.", { errors: v.errors });

  // Regra anti-spam: no máximo N chamados por usuário por hora
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM tickets WHERE author_id = ? AND created_at > ?")
    .bind(user.user_id, since).first();
  if ((recent?.n || 0) >= MAX_OPEN_PER_HOUR) {
    return fail(429, `Limite de ${MAX_OPEN_PER_HOUR} chamados por hora atingido. Tente novamente mais tarde.`);
  }

  const { title, location, severity, description } = v.data;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateTicketCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    try {
      // batch = transação: chamado e evento "criado" são gravados juntos ou nenhum dos dois
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO tickets (code, title, location, severity, description, author_id)
           VALUES (?, ?, ?, ?, ?, ?)`
        ).bind(code, title, location, severity, description, user.user_id),
        env.DB.prepare(
          `INSERT INTO ticket_events (ticket_id, author_id, kind, to_status, body)
           SELECT id, ?, 'criado', 'aberto', NULL FROM tickets WHERE code = ?`
        ).bind(user.user_id, code),
      ]);

      return json({ ok: true, code }, 201);
    } catch (err) {
      if (!String(err && err.message).includes("UNIQUE")) throw err;
      // colisão de código: tenta outro
    }
  }
  return fail(500, "Não foi possível gerar um código único. Tente novamente.");
}
