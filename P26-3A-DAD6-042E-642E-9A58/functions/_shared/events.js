import { avatarUrl } from "./discord.js";
import { isValidDate, isValidTime, todayInSaoPaulo } from "./dates.js";
import { HttpError } from "./http.js";

// ---------------------------------------------------------------------------
// Validação do corpo de criação (o servidor nunca confia no cliente).
// Campos como status, creator_id ou user_id enviados pelo cliente são ignorados.
// ---------------------------------------------------------------------------

const charCount = (text) => [...text].length; // conta como o length() do SQLite
const SINGLE_LINE_CONTROL = /[\u0000-\u001f\u007f]/;
const MULTI_LINE_CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

function textField(value, { min, max, required, multiline }, fields, name, label) {
  if (value === undefined || value === null || (typeof value === "string" && value.trim() === "" && !required)) {
    if (required) fields[name] = `${label} é obrigatório.`;
    return null;
  }
  if (typeof value !== "string") {
    fields[name] = `${label} deve ser texto.`;
    return null;
  }
  const text = value.trim();
  const control = multiline ? MULTI_LINE_CONTROL : SINGLE_LINE_CONTROL;
  if (control.test(text)) {
    fields[name] = `${label} contém caracteres inválidos.`;
    return null;
  }
  const length = charCount(text);
  if (length < min || length > max) {
    fields[name] = min > 0 ? `${label} deve ter entre ${min} e ${max} caracteres.` : `${label} deve ter no máximo ${max} caracteres.`;
    return null;
  }
  return text;
}

export function validateEventInput(body, nowMs = Date.now()) {
  const fields = {};
  const title = textField(body.title, { min: 3, max: 120, required: true }, fields, "title", "O título");
  const location = textField(body.location, { min: 2, max: 120, required: true }, fields, "location", "O local");
  const description = textField(
    body.description,
    { min: 0, max: 2000, required: false, multiline: true },
    fields,
    "description",
    "A descrição",
  );

  const date = body.date;
  if (!isValidDate(date)) {
    fields.date = "Data inválida (use AAAA-MM-DD).";
  } else if (date < todayInSaoPaulo(nowMs)) {
    fields.date = "A data não pode estar no passado.";
  }

  const time = body.time;
  if (!isValidTime(time)) fields.time = "Horário inválido (use HH:MM).";

  const capacity = body.capacity;
  if (typeof capacity !== "number" || !Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
    fields.capacity = "A capacidade deve ser um número inteiro entre 1 e 10000.";
  }

  if (Object.keys(fields).length > 0) {
    throw new HttpError(400, "validation", "Confira os campos destacados.", { fields });
  }
  return { title, description, location, date, time, capacity };
}

// ---------------------------------------------------------------------------
// Consulta de EventSummary. ?1 = user_id da sessão (ou NULL sem sessão).
// Contagens, status e posição na fila calculados pelo próprio D1.
// ---------------------------------------------------------------------------

const SUMMARY_SELECT = `
SELECT e.id, e.title, e.description, e.location, e.event_date, e.event_time,
       e.capacity, e.creator_id,
       u.username AS creator_username, u.avatar AS creator_avatar,
       (SELECT COUNT(*) FROM registrations r
         WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed_count,
       (SELECT COUNT(*) FROM registrations r
         WHERE r.event_id = e.id AND r.status = 'waitlist') AS waitlist_count,
       (SELECT r.status FROM registrations r
         WHERE r.event_id = e.id AND r.user_id = ?1) AS my_status,
       (SELECT COUNT(*) FROM registrations me
          JOIN registrations w
            ON w.event_id = me.event_id AND w.status = 'waitlist'
           AND (w.requested_at < me.requested_at
                OR (w.requested_at = me.requested_at AND w.id <= me.id))
         WHERE me.event_id = e.id AND me.user_id = ?1 AND me.status = 'waitlist') AS my_position
  FROM events e
  LEFT JOIN discord_users u ON u.user_id = e.creator_id`;

const ORDER = " ORDER BY e.event_date, e.event_time, e.id";

export function serializeEvent(row, sessionUserId) {
  const capacity = Number(row.capacity);
  const confirmed = Number(row.confirmed_count) || 0;
  const waitlist = Number(row.waitlist_count) || 0;
  const myStatus = row.my_status === "confirmed" || row.my_status === "waitlist" ? row.my_status : null;
  const position = myStatus === "waitlist" && Number(row.my_position) > 0 ? Number(row.my_position) : null;
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description ?? null,
    location: row.location,
    date: row.event_date,
    time: row.event_time,
    capacity,
    confirmed_count: confirmed,
    waitlist_count: waitlist,
    spots_left: Math.max(0, capacity - confirmed),
    creator: {
      user_id: row.creator_id,
      username: row.creator_username ?? null,
      avatar_url: avatarUrl(row.creator_id, row.creator_avatar ?? null),
    },
    my_status: myStatus,
    my_position: position,
    is_creator: Boolean(sessionUserId) && row.creator_id === sessionUserId,
  };
}

export async function loadEventSummary(env, eventId, sessionUserId) {
  const row = await env.DB.prepare(`${SUMMARY_SELECT} WHERE e.id = ?2`)
    .bind(sessionUserId ?? null, eventId)
    .first();
  return row ? serializeEvent(row, sessionUserId) : null;
}

// scope: "upcoming" (padrão, hoje em diante), "all" ou "mine".
export async function listEventSummaries(env, scope, sessionUserId, nowMs = Date.now()) {
  let statement;
  if (scope === "all") {
    statement = env.DB.prepare(`${SUMMARY_SELECT}${ORDER}`).bind(sessionUserId ?? null);
  } else if (scope === "mine") {
    statement = env.DB.prepare(
      `${SUMMARY_SELECT}
        WHERE e.creator_id = ?1
           OR EXISTS (SELECT 1 FROM registrations r WHERE r.event_id = e.id AND r.user_id = ?1)${ORDER}`,
    ).bind(sessionUserId);
  } else {
    statement = env.DB.prepare(`${SUMMARY_SELECT} WHERE e.event_date >= ?2${ORDER}`).bind(
      sessionUserId ?? null,
      todayInSaoPaulo(nowMs),
    );
  }
  const { results } = await statement.all();
  return (results || []).map((row) => serializeEvent(row, sessionUserId));
}

// Confirmados e fila (ordem de solicitação, desempate pelo id).
export async function loadAttendees(env, eventId) {
  const { results } = await env.DB.prepare(
    `SELECT r.user_id, r.status, r.requested_at, u.username, u.avatar
       FROM registrations r
       LEFT JOIN discord_users u ON u.user_id = r.user_id
      WHERE r.event_id = ?1
      ORDER BY r.requested_at, r.id`,
  )
    .bind(eventId)
    .all();
  const confirmed = [];
  const waitlist = [];
  for (const row of results || []) {
    const attendee = {
      user_id: row.user_id,
      username: row.username ?? null,
      avatar_url: avatarUrl(row.user_id, row.avatar ?? null),
      requested_at: Number(row.requested_at),
    };
    if (row.status === "confirmed") confirmed.push(attendee);
    else waitlist.push({ ...attendee, position: waitlist.length + 1 });
  }
  return { confirmed, waitlist };
}
