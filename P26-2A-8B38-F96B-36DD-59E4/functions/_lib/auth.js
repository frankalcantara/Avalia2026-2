// Sessão assinada com HMAC-SHA256 (chave derivada do DISCORD_CLIENT_SECRET): o navegador não consegue forjar o cookie.
const enc = new TextEncoder();
const chave = (env) => crypto.subtle.importKey("raw", enc.encode(env.DISCORD_CLIENT_SECRET || ""), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const igual = (a, b) => a.length === b.length && [...a].reduce((x, c, i) => x | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const assinatura = async (env, p) => b64u(await crypto.subtle.sign("HMAC", await chave(env), enc.encode(p)));

export async function assinar(env, dados) {
  const p = btoa(encodeURIComponent(JSON.stringify({ ...dados, exp: Date.now() + 86400000 })));
  return p + "." + (await assinatura(env, p));
}

export async function sessao(request, env) {
  const m = (request.headers.get("Cookie") || "").match(/discord_session=([^;]+)/);
  if (!m || !env.DISCORD_CLIENT_SECRET) return null;
  const [p, sig] = m[1].split(".");
  if (!p || !sig || !igual(sig, await assinatura(env, p))) return null;
  try {
    const u = JSON.parse(decodeURIComponent(atob(p)));
    return u && u.userId && u.exp > Date.now() ? { userId: u.userId, username: u.username, avatar: u.avatar } : null;
  } catch { return null; }
}
