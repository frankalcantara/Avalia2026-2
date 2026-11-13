import { distribuir, sha256 } from "../../lib/sorteio.mjs";

const DAY = 86400;
function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}
function json(value, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function cookie(request, name) {
  return (
    (request.headers.get("Cookie") || "")
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${name}=`))
      ?.slice(name.length + 1) || ""
  );
}
function setCookie(name, value, age, url) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${url.protocol === "https:" ? "; Secure" : ""}`;
}
function redirect(location, cookies = []) {
  const headers = new Headers({
    Location: location,
    "Cache-Control": "no-store",
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}
function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
function cleanName(value, max = 100) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    fail(400, `Informe um texto entre 1 e ${max} caracteres.`);
  return value.trim();
}
async function body(request) {
  if (!request.headers.get("Content-Type")?.includes("application/json"))
    fail(415, "Envie JSON.");
  const text = await request.text();
  if (text.length > 100000) fail(413, "Lista muito grande.");
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(400, "JSON inválido.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail(400, "Envie um objeto JSON.");
  return data;
}
async function currentUser(db, request) {
  const token = cookie(request, "sorteio_session");
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  return db
    .prepare(
      "SELECT u.user_id,u.username,u.avatar FROM sessions s JOIN discord_users u ON u.user_id=s.user_id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .bind(await sha256(token), Math.floor(Date.now() / 1000))
    .first();
}
function receipt(row) {
  return row
    ? {
        code: row.code,
        created_at: row.created_at,
        hash: row.hash,
        payload: JSON.parse(row.payload),
      }
    : null;
}
async function getRoom(db, id) {
  const room = await db
    .prepare(
      "SELECT r.*,u.username AS owner_name FROM rooms r JOIN discord_users u ON u.user_id=r.owner_id WHERE r.id=?",
    )
    .bind(id)
    .first();
  if (!room) fail(404, "Sala não encontrada.");
  return room;
}
async function participants(db, id) {
  const rows = await db
    .prepare(
      "SELECT id,name,user_id FROM participants WHERE room_id=? ORDER BY created_at,id",
    )
    .bind(id)
    .all();
  return rows.results;
}
async function discordAuth(context, url) {
  const { env, request } = context;
  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET)
    fail(
      503,
      "Configure o Client ID e o Client Secret do Discord na Cloudflare.",
    );
  if (url.pathname === "/api/auth/discord") {
    const state = randomToken();
    const returnTo = url.searchParams.get("returnTo") || "/";
    const safeReturn =
      returnTo.startsWith("/?") || returnTo === "/" ? returnTo : "/";
    await env.DB.prepare("DELETE FROM oauth_states WHERE expires_at<?")
      .bind(Math.floor(Date.now() / 1000))
      .run();
    await env.DB.prepare(
      "INSERT INTO oauth_states(state_hash,return_to,expires_at) VALUES(?,?,?)",
    )
      .bind(
        await sha256(state),
        safeReturn,
        Math.floor(Date.now() / 1000) + 600,
      )
      .run();
    const target = new URL("https://discord.com/oauth2/authorize");
    target.search = new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      redirect_uri: `${url.origin}/api/auth/discord/callback`,
      response_type: "code",
      scope: "identify",
      state,
    }).toString();
    return redirect(target.href, [setCookie("sorteio_oauth", state, 600, url)]);
  }
  const state = url.searchParams.get("state");
  if (!state || state !== cookie(request, "sorteio_oauth"))
    fail(400, "Login expirado. Entre com Discord novamente.");
  const saved = await env.DB.prepare(
    "DELETE FROM oauth_states WHERE state_hash=? AND expires_at>? RETURNING return_to",
  )
    .bind(await sha256(state), Math.floor(Date.now() / 1000))
    .first();
  if (!saved) fail(400, "Login expirado. Entre com Discord novamente.");
  if (url.searchParams.has("error"))
    return redirect("/?auth_error=cancelado", [
      setCookie("sorteio_oauth", "", 0, url),
    ]);
  const code = url.searchParams.get("code");
  if (!code) fail(400, "Código de autorização ausente.");
  const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
      redirect_uri: `${url.origin}/api/auth/discord/callback`,
    }),
  });
  if (!tokenResponse.ok) fail(502, "Discord recusou o login. Tente novamente.");
  const token = await tokenResponse.json();
  const profileResponse = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileResponse.ok)
    fail(502, "Não foi possível consultar o perfil Discord.");
  const profile = await profileResponse.json();
  if (!/^\d+$/.test(profile.id) || typeof profile.username !== "string")
    fail(502, "Perfil Discord inválido.");
  const avatar =
    profile.avatar && /^[a-zA-Z0-9_]+$/.test(profile.avatar)
      ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
      : "https://cdn.discordapp.com/embed/avatars/0.png";
  const sessionToken = randomToken();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO discord_users(user_id,username,avatar) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET username=excluded.username,avatar=excluded.avatar,updated_at=CURRENT_TIMESTAMP",
    ).bind(profile.id, profile.global_name || profile.username, avatar),
    env.DB.prepare("DELETE FROM sessions WHERE expires_at<?").bind(
      Math.floor(Date.now() / 1000),
    ),
    env.DB.prepare(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
    ).bind(
      await sha256(sessionToken),
      profile.id,
      Math.floor(Date.now() / 1000) + DAY,
    ),
  ]);
  return redirect(saved.return_to, [
    setCookie("sorteio_session", sessionToken, DAY, url),
    setCookie("sorteio_oauth", "", 0, url),
  ]);
}

export async function onRequest(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const db = env.DB;
    if (!db) fail(503, "Vincule o banco D1 como DB e aplique as migrações.");
    const method = request.method;
    if (method !== "GET" && request.headers.get("Origin") !== url.origin)
      fail(403, "Origem da requisição inválida.");
    if (
      method === "GET" &&
      ["/api/auth/discord", "/api/auth/discord/callback"].includes(url.pathname)
    )
      return await discordAuth(context, url);
    const user = await currentUser(db, request);
    if (url.pathname === "/api/me" && method === "GET") return json({ user });
    if (url.pathname === "/api/logout" && method === "POST") {
      const token = cookie(request, "sorteio_session");
      if (token)
        await db
          .prepare("DELETE FROM sessions WHERE token_hash=?")
          .bind(await sha256(token))
          .run();
      const response = json({ ok: true });
      response.headers.append(
        "Set-Cookie",
        setCookie("sorteio_session", "", 0, url),
      );
      return response;
    }
    const drawMatch = url.pathname.match(/^\/api\/draws\/([a-f0-9-]{36})$/);
    if (drawMatch && method === "GET") {
      const draw = receipt(
        await db
          .prepare("SELECT * FROM draws WHERE code=?")
          .bind(drawMatch[1])
          .first(),
      );
      if (!draw) fail(404, "Ata não encontrada.");
      return json({ draw });
    }
    if (url.pathname === "/api/rooms") {
      if (!user) fail(401, "Entre com Discord para continuar.");
      if (method === "GET") {
        const result = await db
          .prepare(
            "SELECT r.*,d.code AS draw_code FROM rooms r LEFT JOIN draws d ON d.room_id=r.id WHERE r.owner_id=? ORDER BY r.created_at DESC LIMIT 100",
          )
          .bind(user.user_id)
          .all();
        return json({ rooms: result.results });
      }
      if (method === "POST") {
        const data = await body(request);
        const title = cleanName(data.title, 120);
        if (!["equipes", "ordem"].includes(data.mode))
          fail(400, "Escolha equipes ou ordem.");
        if (
          !Number.isInteger(data.max_size) ||
          data.max_size < 1 ||
          data.max_size > 100
        )
          fail(400, "Tamanho de equipe deve estar entre 1 e 100.");
        if (!Array.isArray(data.participants) || data.participants.length > 500)
          fail(400, "Informe até 500 participantes.");
        const names = data.participants.map((name) => cleanName(name));
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await db.batch([
          db
            .prepare(
              "INSERT INTO rooms(id,owner_id,title,mode,max_size,created_at) VALUES(?,?,?,?,?,?)",
            )
            .bind(id, user.user_id, title, data.mode, data.max_size, createdAt),
          ...names.map((name) =>
            db
              .prepare(
                "INSERT INTO participants(id,room_id,name,created_at) VALUES(?,?,?,?)",
              )
              .bind(crypto.randomUUID(), id, name, createdAt),
          ),
        ]);
        return json({ room: await getRoom(db, id) }, 201);
      }
    }
    const roomMatch = url.pathname.match(
      /^\/api\/rooms\/([a-f0-9-]{36})(?:\/(join|participants|draw)(?:\/([a-f0-9-]{36}))?)?$/,
    );
    if (roomMatch) {
      const [, id, action, participantId] = roomMatch;
      const room = await getRoom(db, id);
      const existing = await db
        .prepare("SELECT * FROM draws WHERE room_id=?")
        .bind(id)
        .first();
      if (!action && method === "GET")
        return json({
          room,
          participants: await participants(db, id),
          draw: receipt(existing),
        });
      if (!user) fail(401, "Entre com Discord para continuar.");
      if (action === "join" && method === "POST") {
        if (existing) fail(409, "O sorteio já foi encerrado.");
        await db
          .prepare(
            "INSERT INTO participants(id,room_id,name,user_id,created_at) VALUES(?,?,?,?,?) ON CONFLICT(room_id,user_id) DO NOTHING",
          )
          .bind(
            crypto.randomUUID(),
            id,
            user.username,
            user.user_id,
            new Date().toISOString(),
          )
          .run();
        return json({ ok: true });
      }
      if (room.owner_id !== user.user_id)
        fail(403, "Somente o organizador pode fazer isso.");
      if (action === "draw" && method === "POST" && existing)
        return json({ draw: receipt(existing) });
      if (existing) fail(409, "O sorteio já foi encerrado.");
      if (action === "participants" && method === "POST" && !participantId) {
        const data = await body(request);
        const participant = {
          id: crypto.randomUUID(),
          name: cleanName(data.name),
        };
        await db
          .prepare(
            "INSERT INTO participants(id,room_id,name,created_at) VALUES(?,?,?,?)",
          )
          .bind(participant.id, id, participant.name, new Date().toISOString())
          .run();
        return json({ participant }, 201);
      }
      if (action === "participants" && method === "DELETE" && participantId) {
        await db
          .prepare("DELETE FROM participants WHERE id=? AND room_id=?")
          .bind(participantId, id)
          .run();
        return json({ ok: true });
      }
      if (action === "draw" && method === "POST") {
        const people = await participants(db, id);
        if (people.length < 2)
          fail(400, "Adicione pelo menos dois participantes.");
        const createdAt = new Date().toISOString();
        const payload = {
          version: 1,
          algorithm:
            "Fisher–Yates / crypto.getRandomValues / rejection sampling",
          room_id: id,
          title: room.title,
          mode: room.mode,
          max_size: room.max_size,
          organizer: { user_id: user.user_id, username: user.username },
          participants: people,
          result: distribuir(people, room.mode, room.max_size),
          created_at: createdAt,
        };
        const serialized = JSON.stringify(payload);
        const code = crypto.randomUUID();
        // The snapshot comparison prevents a concurrent join/remove from producing an incomplete receipt.
        await db
          .prepare(
            `INSERT INTO draws(code,room_id,payload,hash,created_at)
          SELECT ?,?,?,?,? WHERE
          (SELECT json_group_array(json_object('id',id,'name',name,'user_id',user_id)) FROM (SELECT id,name,user_id FROM participants WHERE room_id=? ORDER BY created_at,id))=?
          ON CONFLICT(room_id) DO NOTHING`,
          )
          .bind(
            code,
            id,
            serialized,
            await sha256(serialized),
            createdAt,
            id,
            JSON.stringify(people),
          )
          .run();
        const saved = await db
          .prepare("SELECT * FROM draws WHERE room_id=?")
          .bind(id)
          .first();
        if (!saved)
          fail(
            409,
            "A lista mudou durante o sorteio. Confira os participantes e tente novamente.",
          );
        return json({ draw: receipt(saved) });
      }
    }
    fail(404, "Rota não encontrada.");
  } catch (error) {
    if (error.status) return json({ error: error.message }, error.status);
    console.error("Falha na API do sorteador", error);
    if (/Sorteio encerrado|Limite de participantes/.test(error.message))
      return json(
        { error: "Sala encerrada ou limite de 500 participantes atingido." },
        409,
      );
    return json(
      {
        error:
          "Falha ao acessar o serviço. Confira a configuração e as migrações do D1.",
      },
      500,
    );
  }
}
