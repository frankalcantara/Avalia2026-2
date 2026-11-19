// GET /api/auth/discord/callback — valida state, troca code, faz upsert do usuário e cria sessão.
import { redirect } from "../../../_lib/http.js";
import { parseCookies, clearCookie } from "../../../_lib/cookies.js";
import { createSession } from "../../../_lib/session.js";

// Redireciona para a home com o código de erro e limpa o cookie de state.
const fail = (origin, code) =>
  redirect(`${origin}/?auth_error=${encodeURIComponent(code)}`, [clearCookie("oauth_state")]);

// Comparação de strings em tempo constante.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// URL do avatar (ou avatar padrão do Discord).
function avatarUrl(user) {
  if (user.avatar) {
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
  }
  let idx = 0;
  try {
    idx = Number((BigInt(user.id) >> 22n) % 6n);
  } catch {}
  return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = url.origin;

  // 1) state da query precisa bater com o cookie
  const state = url.searchParams.get("state");
  const expected = parseCookies(request).oauth_state;
  if (!state || !expected || !safeEqual(state, expected)) return fail(origin, "invalid_state");

  // 2) usuário negou ou faltou code
  if (url.searchParams.get("error")) return fail(origin, "access_denied");
  const code = url.searchParams.get("code");
  if (!code) return fail(origin, "missing_code");

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return fail(origin, "oauth_not_configured");

  try {
    // 3) troca do code por access token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: origin + "/api/auth/discord/callback",
      }),
    });
    if (!tokenRes.ok) return fail(origin, "token_exchange_failed");
    const { access_token } = await tokenRes.json();
    if (!access_token) return fail(origin, "token_exchange_failed");

    // 4) perfil do usuário
    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) return fail(origin, "fetch_user_failed");
    const du = await meRes.json();
    if (!du || !/^\d{1,25}$/.test(String(du.id))) return fail(origin, "fetch_user_failed");

    const userId = String(du.id);
    const username = String(du.global_name || du.username || "Usuário").slice(0, 80);
    const initial = Number.parseInt(env.INITIAL_BALANCE ?? "5000", 10);
    const balance = Number.isInteger(initial) && initial >= 0 ? initial : 5000;

    // 5) upsert: saldo inicial só na criação; nome/avatar a cada login
    await env.DB.prepare(
      `INSERT INTO users (user_id, username, avatar, balance) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP`
    ).bind(userId, username, avatarUrl(du), balance).run();

    // 6) sessão e redirecionamento
    const sidCookie = await createSession(env, userId);
    return redirect(`${origin}/?login=success`, [sidCookie, clearCookie("oauth_state")]);
  } catch (err) {
    console.error("Falha no callback do Discord:", err);
    return fail(origin, "exception");
  }
}
