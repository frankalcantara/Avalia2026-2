const enc = new TextEncoder();

export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });

const b64u = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const deB64u = (s) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

const chave = (segredo) =>
  crypto.subtle.importKey("raw", enc.encode(segredo), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

// Sessão = payload em base64 + assinatura HMAC. O cliente não consegue forjar sem o SESSION_SECRET.
export async function assinar(payload, segredo) {
  const corpo = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await chave(segredo), enc.encode(corpo));
  return `${corpo}.${b64u(sig)}`;
}

export async function verificar(token, segredo) {
  if (!token || !segredo) return null;
  const [corpo, sig] = token.split(".");
  if (!corpo || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await chave(segredo), deB64u(sig), enc.encode(corpo));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(deB64u(corpo)));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

export function lerCookie(request, nome) {
  const m = (request.headers.get("cookie") || "").match(new RegExp(`(?:^|; )${nome}=([^;]*)`));
  return m ? m[1] : null;
}

// Defesa contra CSRF: mutações só são aceitas se a origem for o próprio site.
function origemOk(request) {
  if (request.method === "GET") return true;
  return request.headers.get("origin") === new URL(request.url).origin;
}

export async function autenticar(request, env) {
  if (!origemOk(request)) return { erro: json({ erro: "origem inválida" }, 403) };
  const p = await verificar(lerCookie(request, "sessao"), env.SESSION_SECRET);
  const u = p && (await env.DB.prepare("SELECT user_id AS id, username, avatar AS avatar_url FROM discord_users WHERE user_id = ?").bind(p.uid).first());
  if (!u) return { erro: json({ erro: "não autenticado" }, 401) };
  return { u };
}

export const ehMembro = (env, listaId, userId) =>
  env.DB.prepare("SELECT 1 AS ok FROM list_members WHERE list_id = ? AND user_id = ?").bind(listaId, userId).first();

export const idValido = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

export const textoValido = (v, max) => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
};
