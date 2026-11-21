const enc = new TextEncoder();
const dec = new TextDecoder();

const b64url = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const b64urlDecode = (str) =>
  Uint8Array.from(atob(str.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

const chave = (secret) =>
  crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);

export async function assinar(obj, secret) {
  const corpo = b64url(enc.encode(JSON.stringify(obj)));
  const sig = await crypto.subtle.sign('HMAC', await chave(secret), enc.encode(corpo));
  return `${corpo}.${b64url(sig)}`;
}

export async function verificar(token, secret) {
  if (!token || !secret) return null;
  const [corpo, sig] = token.split('.');
  if (!corpo || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await chave(secret), b64urlDecode(sig), enc.encode(corpo));
    if (!ok) return null;
    const obj = JSON.parse(dec.decode(b64urlDecode(corpo)));
    if (!obj.exp || Date.now() > obj.exp) return null;
    return obj;
  } catch {
    return null;
  }
}

export function lerCookie(request, nome) {
  const c = request.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|; )' + nome + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}

export async function usuarioLogado(request, env) {
  return verificar(lerCookie(request, 'sessao'), env.SESSION_SECRET);
}