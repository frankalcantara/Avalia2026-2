import { requireMutation, requireUser } from "../../_shared/auth.js";
import { listEventSummaries, loadEventSummary, validateEventInput } from "../../_shared/events.js";
import { HttpError, handle, json, methodNotAllowed, readJsonBody } from "../../_shared/http.js";
import { getSessionUser } from "../../_shared/session.js";

const SCOPES = new Set(["upcoming", "all", "mine"]);

// GET /api/events[?scope=all|mine]
export const onRequestGet = handle("events list", async ({ request, env }) => {
  const scope = new URL(request.url).searchParams.get("scope") || "upcoming";
  if (!SCOPES.has(scope)) {
    throw new HttpError(400, "validation", "Filtro inválido.", { fields: { scope: "Use all ou mine." } });
  }
  const user = scope === "mine" ? await requireUser(request, env) : await getSessionUser(request, env);
  const events = await listEventSummaries(env, scope, user ? user.user_id : null, Date.now());
  return json(200, { events });
});

// POST /api/events  { title, description?, location, date, time, capacity }
export const onRequestPost = handle("events create", async ({ request, env }) => {
  const user = await requireMutation(request, env);
  const body = await readJsonBody(request);
  const now = Date.now();
  const input = validateEventInput(body, now);

  // creator_id vem da sessão; o cliente não escolhe dono nem contadores.
  const row = await env.DB.prepare(
    `INSERT INTO events (creator_id, title, description, location, event_date, event_time, capacity, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
     RETURNING id`,
  )
    .bind(user.user_id, input.title, input.description, input.location, input.date, input.time, input.capacity, now)
    .first();

  const event = await loadEventSummary(env, Number(row.id), user.user_id);
  return json(201, { event });
});

export function onRequest() {
  return methodNotAllowed("GET, POST");
}
