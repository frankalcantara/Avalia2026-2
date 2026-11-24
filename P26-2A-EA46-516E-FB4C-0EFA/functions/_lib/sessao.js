const enc = new TextEncoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const chave = (env) => crypto.subtle.importKey("raw", enc.encode(env.SESSION_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

export const cookie = (nome, valor, seg) => `${nome}=${valor}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=${seg}`;

export function lerCookie(request, nome) {
  const m = (request.headers.get("Cookie") || "").match(new RegExp("(?:^|;\\s*)" + nome + "=([^;]*)"));
  return m ? m[1] : null;
}

export async function criarSessao(env, user) {
  const dados = b64(enc.encode(JSON.stringify({ ...user, exp: Date.now() + 86400000 })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await chave(env), enc.encode(dados)));
  return dados + "." + b64(sig);
}

export async function lerSessao(request, env) {
  const v = lerCookie(request, "discord_session");
  if (!v || !env.SESSION_SECRET) return null;
  const [dados, sig] = v.split(".");
  if (!dados || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await chave(env), unb64(sig), enc.encode(dados));
    if (!ok) return null;
    const u = JSON.parse(new TextDecoder().decode(unb64(dados)));
    return u.exp > Date.now() ? u : null;
  } catch { return null; }
}
