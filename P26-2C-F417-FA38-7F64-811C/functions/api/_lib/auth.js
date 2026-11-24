import { cookie, json } from "./http.js";

const encoder = new TextEncoder();

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
function fromBase64Url(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}
async function key(secret) {
  return crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
async function sign(value, secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify(value)));
  const signature = await crypto.subtle.sign("HMAC", await key(secret), encoder.encode(payload));
  return `${payload}.${toBase64Url(signature)}`;
}
async function verify(token, secret) {
  if (!token || !secret || !token.includes(".")) return null;
  const [payload, signature] = token.split(".");
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(secret), fromBase64Url(signature), encoder.encode(payload));
    if (!ok) return null;
    const data = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch { return null; }
}

export async function createSession(user, env) {
  const token = await sign({ sub: user.id, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }, env.SESSION_SECRET);
  return token;
}

export async function getUser(request, env) {
  const token = cookie(request, "ct_session");
  const session = await verify(token, env.SESSION_SECRET);
  if (!session?.sub) return null;
  return await env.DB.prepare(
    "SELECT id, username, global_name, avatar FROM users WHERE id = ?"
  ).bind(session.sub).first();
}

export async function requireUser(request, env) {
  const user = await getUser(request, env);
  return user || null;
}

export async function createOAuthState(env) {
  const state = crypto.randomUUID();
  const token = await sign({ state, exp: Date.now() + 10 * 60 * 1000 }, env.SESSION_SECRET);
  return { state, token };
}
export async function verifyOAuthState(token, env) {
  return await verify(token, env.SESSION_SECRET);
}

export function unauthorized() {
  return json({ error: "Faça login com o Discord para continuar." }, 401);
}
