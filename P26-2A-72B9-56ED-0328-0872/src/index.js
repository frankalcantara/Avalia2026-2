const API_VERSION = "https://discord.com/api/v10";
const AUTH_URL = "https://discord.com/oauth2/authorize";
const TOKEN_URL = "https://discord.com/api/oauth2/token";
const SESSION_COOKIE = "__Host-discord-session";
const STATE_COOKIE = "__Host-discord-oauth-state";
const TIME_ZONE = "America/Sao_Paulo";

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

const MODULES = ["Requisitos", "Arquitetura", "Codificação", "Testes"];

function validIsoDateTime(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
  const date = new Date(`${value}:00-03:00`);
  return Number.isFinite(date.getTime());
}

async function timeEntries(request, env, user) {
  if (request.method === "GET") {
    const url = new URL(request.url);
    const day = url.searchParams.get("date") || localNow().date;
    if (!validDate(day)) return errorJson("Informe uma data válida.", 400);
    const result = await env.DB.prepare(`
      SELECT e.id, e.project_name, e.module, e.description, e.started_at, e.ended_at,
        e.duration_minutes, u.display_name, u.username, e.user_id
      FROM time_entries e JOIN users u ON u.id = e.user_id
      WHERE date(e.started_at, '-3 hours') = ? OR (e.ended_at IS NULL AND e.user_id = ?)
      ORDER BY e.started_at DESC LIMIT 200
    `).bind(day, user.id).all();
    const entries = result.results || [];
    const ownMinutes = entries.filter(row => row.user_id === user.id)
      .reduce((sum, row) => sum + (row.duration_minutes || (row.ended_at ? 0 : Math.max(0, Math.floor((Date.now() - Date.parse(row.started_at)) / 60000)))), 0);
    const teamMinutes = entries.reduce((sum, row) => sum + (row.duration_minutes || (row.ended_at ? 0 : Math.max(0, Math.floor((Date.now() - Date.parse(row.started_at)) / 60000)))), 0);
    const modules = await env.DB.prepare(`
      SELECT m.name, COALESCE(m.estimate_minutes, 0) AS estimate_minutes,
        COALESCE(SUM(CASE WHEN e.ended_at IS NOT NULL THEN e.duration_minutes ELSE MAX(0, CAST((julianday('now') - julianday(e.started_at)) * 1440 AS INTEGER)) END), 0) AS actual_minutes
      FROM project_modules m LEFT JOIN time_entries e ON e.module = m.name
      GROUP BY m.name, m.estimate_minutes ORDER BY m.sort_order
    `).all();
    return json({ date: day, own_minutes: ownMinutes, team_minutes: teamMinutes,
      entries: entries.map(({ user_id, ...entry }) => ({ ...entry, mine: user_id === user.id })),
      modules: modules.results || [] });
  }

  let body;
  try { body = await request.json(); } catch { return errorJson("O corpo precisa ser JSON válido.", 400); }
  if (request.method === "POST" && new URL(request.url).pathname === "/api/time/start") {
    const project = String(body.project_name || "").trim().slice(0, 100);
    const module = String(body.module || "");
    const description = String(body.description || "").trim().slice(0, 300);
    if (!project || !MODULES.includes(module)) return errorJson("Informe o projeto e uma etapa válida.", 400);
    const active = await env.DB.prepare("SELECT id FROM time_entries WHERE user_id = ? AND ended_at IS NULL LIMIT 1").bind(user.id).first();
    if (active) return errorJson("Você já tem um cronômetro em andamento. Encerre antes de iniciar outro.", 409);
    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    await env.DB.prepare("INSERT INTO time_entries (id, user_id, project_name, module, description, started_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, user.id, project, module, description, startedAt).run();
    return json({ id, started_at: startedAt }, 201);
  }
  if (request.method === "POST" && new URL(request.url).pathname === "/api/time/stop") {
    const active = await env.DB.prepare("SELECT id, started_at FROM time_entries WHERE user_id = ? AND ended_at IS NULL LIMIT 1").bind(user.id).first();
    if (!active) return errorJson("Não há cronômetro em andamento.", 404);
    const endedAt = new Date().toISOString();
    const minutes = Math.max(1, Math.floor((Date.parse(endedAt) - Date.parse(active.started_at)) / 60000));
    await env.DB.prepare("UPDATE time_entries SET ended_at = ?, duration_minutes = ? WHERE id = ? AND user_id = ? AND ended_at IS NULL")
      .bind(endedAt, minutes, active.id, user.id).run();
    return json({ id: active.id, ended_at: endedAt, duration_minutes: minutes });
  }
  if (request.method === "POST" && new URL(request.url).pathname === "/api/time/manual") {
    const project = String(body.project_name || "").trim().slice(0, 100);
    const module = String(body.module || "");
    const description = String(body.description || "").trim().slice(0, 300);
    const start = body.started_at;
    const end = body.ended_at;
    if (!project || !MODULES.includes(module) || !validIsoDateTime(start) || !validIsoDateTime(end)) return errorJson("Confira projeto, etapa e horários.", 400);
    const startMs = Date.parse(`${start}:00-03:00`), endMs = Date.parse(`${end}:00-03:00`);
    if (endMs <= startMs || endMs > Date.now()) return errorJson("O fim precisa ser posterior ao início e não pode estar no futuro.", 400);
    const minutes = Math.floor((endMs - startMs) / 60000);
    if (minutes < 1 || minutes > 24 * 60) return errorJson("O apontamento deve ter até 24 horas.", 400);
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO time_entries (id, user_id, project_name, module, description, started_at, ended_at, duration_minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, user.id, project, module, description, new Date(startMs).toISOString(), new Date(endMs).toISOString(), minutes).run();
    return json({ id, duration_minutes: minutes }, 201);
  }
  return errorJson("Rota não encontrada.", 404);
}

async function updateEstimates(request, env, user) {
  if (request.method === "GET") {
    const rows = await env.DB.prepare("SELECT name, estimate_minutes FROM project_modules ORDER BY sort_order").all();
    return json({ modules: rows.results || [] });
  }
  let body;
  try { body = await request.json(); } catch { return errorJson("O corpo precisa ser JSON válido.", 400); }
  const { module, estimate_minutes: estimate } = body || {};
  if (!MODULES.includes(module) || !Number.isInteger(estimate) || estimate < 0 || estimate > 100000) return errorJson("Estimativa inválida.", 400);
  await env.DB.prepare("UPDATE project_modules SET estimate_minutes = ?, updated_by = ?, updated_at = datetime('now') WHERE name = ?")
    .bind(estimate, user.id, module).run();
  return json({ module, estimate_minutes: estimate });
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
      if (!user) return errorJson("Entre com Discord para consultar e apontar horas.", 401);

      if (url.pathname === "/api/me" && request.method === "GET") return json(user);

      if (url.pathname === "/api/time/entries" && (request.method === "GET" || request.method === "POST")) return await timeEntries(request, env, user);
      if (["/api/time/start", "/api/time/stop", "/api/time/manual"].includes(url.pathname) && request.method === "POST") return await timeEntries(request, env, user);
      if (url.pathname === "/api/time/estimates" && ["GET", "PUT"].includes(request.method)) return await updateEstimates(request, env, user);

      return errorJson("Rota não encontrada.", 404);
    } catch (error) {
      if (error instanceof SyntaxError) return errorJson("O corpo da solicitação precisa ser JSON válido.", 400);
      return errorJson("Não foi possível concluir a solicitação.", 500);
    }
  },
};
