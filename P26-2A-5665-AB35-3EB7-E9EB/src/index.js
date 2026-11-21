const API_VERSION = "https://discord.com/api/v10";
const AUTH_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const SESSION_COOKIE = "__Host-discord-session";
const STATE_COOKIE = "__Host-discord-oauth-state";
const TIME_ZONE = "America/Sao_Paulo";
const OPEN_MINUTE = 8 * 60;
const CLOSE_MINUTE = 20 * 60;

function discordConfigured(env) {
  return /^\d{17,20}$/.test(env.DISCORD_CLIENT_ID || "")
    && Boolean(env.DISCORD_CLIENT_SECRET && env.DISCORD_REDIRECT_URI);
}

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  },
});

const errorJson = (message, status) => json({ error: message }, status);

function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64url(value) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

function cookies(request) {
  const values = {};
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const separator = part.indexOf("=");
    if (separator > 0) values[part.slice(0, separator).trim()] = part.slice(separator + 1).trim();
  }
  return values;
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function sign(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

async function createSessionCookie(userId, secret) {
  const payload = base64url(new TextEncoder().encode(JSON.stringify({
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7,
  })));
  const value = `${payload}.${await sign(payload, secret)}`;
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

async function sessionUser(request, env) {
  if (!env.DISCORD_CLIENT_SECRET) return null;
  const value = cookies(request)[SESSION_COOKIE];
  if (!value) return null;
  const [payload, signature, extra] = value.split(".");
  if (!payload || !signature || extra) return null;
  const expected = await sign(payload, env.DISCORD_CLIENT_SECRET);
  if (!constantTimeEqual(signature, expected)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(fromBase64url(payload)));
    if (!session.sub || !Number.isFinite(session.exp) || session.exp <= Math.floor(Date.now() / 1000)) return null;
    return await env.DB.prepare("SELECT id, username, display_name, avatar_url FROM users WHERE id = ?")
      .bind(session.sub).first();
  } catch {
    return null;
  }
}

function localNow() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}` };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function timeToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(value || "")) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatTime(minutes) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

async function discordCallback(request, env, url) {
  const cookieState = cookies(request)[STATE_COOKIE];
  const state = url.searchParams.get("state") || "";
  const issuer = url.searchParams.get("iss");
  const code = url.searchParams.get("code");
  const clearState = `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  if (!cookieState || !state || !constantTimeEqual(cookieState, state)) return errorJson("A sessão OAuth expirou; tente entrar novamente.", 400);
  if (issuer !== "https://discord.com") return errorJson("Emissor OAuth inválido.", 400);
  if (url.searchParams.has("error") || !code) return Response.redirect(new URL("/?login=cancelled", url), 303);
  if (!discordConfigured(env)) {
    return errorJson("O login Discord ainda não foi configurado pelo administrador.", 503);
  }

  const tokenBody = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    client_secret: env.DISCORD_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: env.DISCORD_REDIRECT_URI,
  });
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenResponse.ok) return errorJson("Não foi possível validar o login com Discord.", 502);
  const token = await tokenResponse.json();
  const profileResponse = await fetch(`${API_VERSION}/users/@me`, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok) return errorJson("Não foi possível obter o perfil do Discord.", 502);
  const profile = await profileResponse.json();
  if (typeof profile.id !== "string" || typeof profile.username !== "string") return errorJson("O perfil do Discord não contém os dados necessários.", 502);

  const avatarUrl = profile.avatar
    ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png?size=96`
    : null;
  await env.DB.prepare(`
    INSERT INTO users (id, username, display_name, avatar_url)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      username = excluded.username,
      display_name = excluded.display_name,
      avatar_url = excluded.avatar_url,
      updated_at = datetime('now')
  `).bind(profile.id, profile.username, profile.global_name || profile.username, avatarUrl).run();

  const headers = new Headers({
    location: new URL("/", url).toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", clearState);
  headers.append("set-cookie", await createSessionCookie(profile.id, env.DISCORD_CLIENT_SECRET));
  return new Response(null, { status: 303, headers });
}

async function createReservation(request, env, user) {
  let body;
  try { body = await request.json(); } catch { return errorJson("O corpo precisa ser JSON válido.", 400); }
  const { resource_id: resourceId, date, start_time: startTime, duration_minutes: duration } = body || {};
  if (typeof resourceId !== "string" || typeof date !== "string" || !validDate(date)
    || typeof startTime !== "string" || !Number.isInteger(duration) || ![30, 60, 90, 120].includes(duration)) {
    return errorJson("Informe espaço, data e duração válida (30, 60, 90 ou 120 minutos).", 400);
  }
  const startMinute = timeToMinutes(startTime);
  if (startMinute === null || startMinute % 30 !== 0 || startMinute < OPEN_MINUTE) {
    return errorJson("Os horários começam às 08:00 e usam intervalos de 30 minutos.", 400);
  }
  const endMinute = startMinute + duration;
  if (endMinute > CLOSE_MINUTE) return errorJson("A reserva precisa terminar até às 20:00.", 400);
  const endTime = formatTime(endMinute);
  const now = localNow();
  if (date < now.date || (date === now.date && startTime <= now.time)) return errorJson("Não é possível reservar um horário no passado.", 400);

  const resource = await env.DB.prepare("SELECT id FROM resources WHERE id = ? AND active = 1").bind(resourceId).first();
  if (!resource) return errorJson("Espaço não encontrado ou indisponível.", 404);

  const conflict = await env.DB.prepare(`
    SELECT id FROM reservations
    WHERE resource_id = ? AND local_date = ? AND status = 'active'
      AND start_time < ? AND end_time > ?
    LIMIT 1
  `).bind(resourceId, date, endTime, startTime).first();
  if (conflict) return errorJson("Esse espaço já está reservado nesse horário.", 409);

  const usage = await env.DB.prepare(`
    SELECT COALESCE(SUM(duration_minutes), 0) AS minutes
    FROM reservations WHERE user_id = ? AND local_date = ? AND status = 'active'
  `).bind(user.id, date).first();
  if ((usage?.minutes || 0) + duration > 120) return errorJson("Seu limite é de 2 horas de reserva por dia.", 409);

  const id = crypto.randomUUID();
  const inserted = await env.DB.prepare(`
    INSERT INTO reservations (id, resource_id, user_id, local_date, start_time, end_time, duration_minutes)
    SELECT ?, ?, ?, ?, ?, ?, ?
    WHERE EXISTS (SELECT 1 FROM resources WHERE id = ? AND active = 1)
      AND NOT EXISTS (
        SELECT 1 FROM reservations
        WHERE resource_id = ? AND local_date = ? AND status = 'active'
          AND start_time < ? AND end_time > ?
      )
      AND (SELECT COALESCE(SUM(duration_minutes), 0) FROM reservations
        WHERE user_id = ? AND local_date = ? AND status = 'active') + ? <= 120
  `).bind(
    id, resourceId, user.id, date, startTime, endTime, duration,
    resourceId, resourceId, date, endTime, startTime, user.id, date, duration,
  ).run();
  if (!inserted.meta.changes) return errorJson("A reserva conflitou com uma alteração recente. Atualize a agenda e tente outro horário.", 409);
  return json({ id, resource_id: resourceId, date, start_time: startTime, end_time: endTime, duration_minutes: duration, status: "active" }, 201);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);

    try {
      if (url.pathname === "/api/auth/discord/start" && request.method === "GET") {
        if (!discordConfigured(env)) return errorJson("O login Discord ainda não foi configurado corretamente.", 503);
        const stateBytes = crypto.getRandomValues(new Uint8Array(32));
        const state = base64url(stateBytes);
        const authorize = new URL(AUTH_URL);
        authorize.searchParams.set("response_type", "code");
        authorize.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
        authorize.searchParams.set("scope", "identify");
        authorize.searchParams.set("state", state);
        authorize.searchParams.set("redirect_uri", env.DISCORD_REDIRECT_URI);
        return new Response(null, {
          status: 302,
          headers: {
            location: authorize.toString(),
            "set-cookie": `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
            "cache-control": "no-store",
          },
        });
      }

      if (url.pathname === "/api/auth/discord/callback" && request.method === "GET") {
        return await discordCallback(request, env, url);
      }

      if (url.pathname === "/api/auth/status" && request.method === "GET") {
        return json({ discord_configured: discordConfigured(env) });
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        return new Response(null, {
          status: 204,
          headers: { "set-cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` },
        });
      }

      const user = await sessionUser(request, env);
      if (!user && !(url.pathname === "/api/availability" && request.method === "GET")) {
        return errorJson("Entre com Discord para usar a agenda.", 401);
      }

      if (url.pathname === "/api/me" && request.method === "GET") return json(user);

      if (url.pathname === "/api/availability" && request.method === "GET") {
        const date = url.searchParams.get("date");
        if (!validDate(date)) return errorJson("Informe uma data válida no formato AAAA-MM-DD.", 400);
        const [resources, rows, usage] = await Promise.all([
          env.DB.prepare("SELECT id, name, kind FROM resources WHERE active = 1 ORDER BY kind, name").all(),
          env.DB.prepare(`
            SELECT r.id, r.resource_id, r.local_date, r.start_time, r.end_time,
              r.duration_minutes, r.status, r.user_id, u.username, u.display_name
            FROM reservations r JOIN users u ON u.id = r.user_id
            WHERE r.local_date = ? AND r.status = 'active'
            ORDER BY r.start_time
          `).bind(date).all(),
          env.DB.prepare(`
            SELECT COALESCE(SUM(duration_minutes), 0) AS minutes
            FROM reservations WHERE user_id = ? AND local_date = ? AND status = 'active'
          `).bind(user?.id || "", date).first(),
        ]);
        return json({
          date,
          timezone: TIME_ZONE,
          opens_at: "08:00",
          closes_at: "20:00",
          slot_minutes: 30,
          daily_limit_minutes: 120,
          user_minutes_reserved: usage?.minutes || 0,
          resources: resources.results,
          reservations: rows.results.map(row => ({
            id: row.id,
            resource_id: row.resource_id,
            start_time: row.start_time,
            end_time: row.end_time,
            duration_minutes: row.duration_minutes,
            mine: Boolean(user && row.user_id === user.id),
            owner_label: user && row.user_id === user.id ? (row.display_name || row.username) : null,
          })),
        });
      }

      if (url.pathname === "/api/reservations" && request.method === "POST") return await createReservation(request, env, user);

      const reservationMatch = url.pathname.match(/^\/api\/reservations\/([\w-]+)$/);
      if (reservationMatch && request.method === "DELETE") {
        const now = localNow();
        const result = await env.DB.prepare(`
          UPDATE reservations SET status = 'cancelled'
          WHERE id = ? AND user_id = ? AND status = 'active'
            AND (local_date > ? OR (local_date = ? AND start_time > ?))
        `).bind(reservationMatch[1], user.id, now.date, now.date, now.time).run();
        return result.meta.changes ? new Response(null, { status: 204 }) : errorJson("Reserva não encontrada ou já iniciada.", 404);
      }

      return errorJson("Rota não encontrada.", 404);
    } catch (error) {
      if (error instanceof SyntaxError) return errorJson("O corpo da solicitação precisa ser JSON válido.", 400);
      return errorJson("Não foi possível concluir a solicitação.", 500);
    }
  },
};

