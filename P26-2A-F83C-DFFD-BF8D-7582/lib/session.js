/**
 * Utilitário de sessão assinada com HMAC-SHA256 usando Web Crypto API.
 * Compatível com Cloudflare Workers/Pages Functions e Node.js >= 18.
 */

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str) {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function getSessionSecret(env) {
  const secret = (env?.SESSION_SECRET || env?.DISCORD_CLIENT_SECRET || '').trim();
  return secret || null;
}

async function importHmacKey(secret, usages) {
  return crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usages
  );
}

export async function signSession(payload, secret, ttlSeconds = 86400) {
  if (!secret) {
    throw new Error('Segredo de sessão ausente.');
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const fullPayload = {
    user_id: String(payload.user_id),
    username: String(payload.username || ''),
    avatar: payload.avatar || null,
    iat: nowSeconds,
    exp: nowSeconds + ttlSeconds,
  };

  const payloadBytes = textEncoder.encode(JSON.stringify(fullPayload));
  const encodedPayload = toBase64Url(payloadBytes);

  const key = await importHmacKey(secret, ['sign']);
  const sigBuffer = await crypto.subtle.sign('HMAC', key, textEncoder.encode(encodedPayload));
  const encodedSig = toBase64Url(new Uint8Array(sigBuffer));

  return `${encodedPayload}.${encodedSig}`;
}

export async function verifySession(token, secret) {
  if (!token || !secret || typeof token !== 'string') {
    return null;
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, encodedSig] = parts;
  if (!encodedPayload || !encodedSig) {
    return null;
  }

  try {
    const key = await importHmacKey(secret, ['verify']);
    const sigBytes = fromBase64Url(encodedSig);
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      textEncoder.encode(encodedPayload)
    );
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(textDecoder.decode(fromBase64Url(encodedPayload)));
    if (!payload || !payload.user_id) {
      return null;
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === 'number' && payload.exp < nowSeconds) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;

  const prefix = `${name}=`;
  const cookies = cookieHeader.split(';');
  for (const raw of cookies) {
    const trimmed = raw.trim();
    if (trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length);
    }
  }
  return null;
}

export async function authenticateRequest(request, env) {
  const secret = getSessionSecret(env);
  if (!secret) return null;

  const token = getCookie(request, 'session');
  if (!token) return null;

  return verifySession(token, secret);
}

export function buildCookie(name, value, { maxAge = 86400, isHttps = false } = {}) {
  const parts = [
    `${name}=${value}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}
