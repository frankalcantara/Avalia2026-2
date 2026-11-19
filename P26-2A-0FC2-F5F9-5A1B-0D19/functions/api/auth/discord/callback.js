// GET /api/auth/discord/callback: confere state, troca code por token, lê o perfil,
// faz upsert do usuário e cria a sessão. Em erro redireciona para /?erro=<codigo>.
// O access_token do Discord é usado só aqui e nunca é guardado.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
import { methodNotAllowed, redirect } from "../../../_lib/http.js";
import { clearCookie, createSession, getCookie, STATE_COOKIE } from "../../../_lib/session.js";

// URL do avatar conforme o SPEC (com hash ou avatar padrão pelo snowflake).
export function avatarUrl(id, hash) {
  if (hash) return `https://cdn.discordapp.com/avatars/${id}/${hash}.png?size=128`;
  return `https://cdn.discordapp.com/embed/avatars/${(BigInt(id) >> 22n) % 6n}.png`;
}

// Redireciona para a home com o código de erro e limpa o cookie de state.
const fail = (code) => redirect(`/?erro=${encodeURIComponent(code)}`, [clearCookie(STATE_COOKIE)]);

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) return fail("oauth_not_configured");

    const url = new URL(request.url);
    if (url.searchParams.get("error")) return fail("acesso_negado");

    // 1) Anti-CSRF do OAuth: state da URL deve ser igual ao do cookie.
    const state = url.searchParams.get("state");
    const saved = getCookie(request, STATE_COOKIE);
    if (!state || !saved || state !== saved) return fail("state_invalido");

    const code = url.searchParams.get("code");
    if (!code) return fail("codigo_ausente");

    // 2) Troca do code por access_token (form-urlencoded).
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: url.origin + "/api/auth/discord/callback",
      }),
    });
    if (!tokenRes.ok) return fail("token_falhou");
    const { access_token } = await tokenRes.json();
    if (!access_token) return fail("token_falhou");

    // 3) Perfil do usuário (escopo identify).
    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!meRes.ok) return fail("perfil_falhou");
    const me = await meRes.json();
    if (!me || !/^\d{1,25}$/.test(String(me.id))) return fail("perfil_falhou");

    const userId = String(me.id);
    const username = String(me.global_name || me.username || "Usuário").slice(0, 100);

    // 4) Upsert do usuário (SQL parametrizado).
    await env.DB.prepare(
      `INSERT INTO users (user_id, username, avatar_url) VALUES (?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET username = excluded.username,
         avatar_url = excluded.avatar_url, updated_at = CURRENT_TIMESTAMP`
    ).bind(userId, username, avatarUrl(userId, me.avatar)).run();

    // 5) Cria sessão, remove state e volta para a home.
    const sessionCookie = await createSession(env, userId);
    return redirect("/", [sessionCookie, clearCookie(STATE_COOKIE)]);
  } catch (e) {
    console.error("Falha no callback OAuth:", e && e.message);
    return fail("erro_interno");
  }
}

export const onRequest = () => methodNotAllowed("GET");
