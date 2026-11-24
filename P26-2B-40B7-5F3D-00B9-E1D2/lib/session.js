// Utilitários de sessão: cookie assinado com HMAC-SHA256.
// O "lib" fica fora de /functions de propósito, para não virar uma rota.
const enc = new TextEncoder();

function toB64Url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Uint8Array.from(atob(str), (c) => c.charCodeAt(0));
}

function hmacKey(secret, usage) {
  return crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]
  );
}

// Cria "conteudo.assinatura". Sem o segredo, ninguém consegue forjar a assinatura.
export async function signSession(payload, secret) {
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret, "sign");
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

// Devolve o conteúdo só se: a assinatura confere, o token tem exatamente
// duas partes, o exp é um número ainda válido e existe um userId em texto.
export async function verifySession(token, secret) {
  try {
    const partes = String(token).split(".");
    if (partes.length !== 2) return null;
    const [body, sig] = partes;
    if (!body || !sig) return null;

    const key = await hmacKey(secret, "verify");
    const ok = await crypto.subtle.verify("HMAC", key, fromB64Url(sig), enc.encode(body));
    if (!ok) return null;

    const payload = JSON.parse(new TextDecoder().decode(fromB64Url(body)));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.userId !== "string" || !payload.userId) return null;
    return payload;
  } catch {
    return null;
  }
}

// Lê um cookie pelo nome exato, sem usar o nome dentro de uma expressão regular.
export function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const par of header.split(";")) {
    const i = par.indexOf("=");
    if (i === -1) continue;
    if (par.slice(0, i).trim() === name) return par.slice(i + 1).trim();
  }
  return null;
}