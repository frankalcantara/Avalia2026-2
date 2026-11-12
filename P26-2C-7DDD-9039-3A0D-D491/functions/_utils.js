var SESSION_COOKIE = 'finance_session';
var STATE_COOKIE = 'oauth_state';
var SESSION_SECONDS = 60 * 60 * 24 * 7;

export function jsonResponse(data, status) {
  var headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8' });
  return new Response(JSON.stringify(data), { status: status || 200, headers: headers });
}

export function methodNotAllowed(allowed) {
  return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Allow': allowed
    }
  });
}

export function getCookie(request, name) {
  var cookieHeader = request.headers.get('Cookie') || '';
  var cookies = cookieHeader.split(';');
  for (var i = 0; i < cookies.length; i++) {
    var cookie = cookies[i].trim();
    if (cookie.indexOf(name + '=') === 0) {
      return cookie.slice(name.length + 1);
    }
  }
  return null;
}

function getSecret(env) {
  var secret = env.SESSION_SECRET;
  if (!secret || typeof secret !== 'string' || secret.length < 32) {
    throw new Error('SESSION_SECRET não configurado ou tem menos de 32 caracteres.');
  }
  return secret;
}

function encodeBytes(bytes) {
  var binary = '';
  for (var i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBytes(value) {
  var base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  var binary = atob(base64);
  var bytes = new Uint8Array(binary.length);
  for (var i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function getHmacKey(env) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret(env)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSignedToken(payload, env) {
  var encodedPayload = encodeBytes(new TextEncoder().encode(JSON.stringify(payload)));
  var key = await getHmacKey(env);
  var signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(encodedPayload));
  return encodedPayload + '.' + encodeBytes(new Uint8Array(signature));
}

async function verifySignedToken(token, env) {
  var parts = token.split('.');
  if (parts.length !== 2) {
    return null;
  }

  try {
    var key = await getHmacKey(env);
    var valid = await crypto.subtle.verify(
      'HMAC',
      key,
      decodeBytes(parts[1]),
      new TextEncoder().encode(parts[0])
    );
    if (!valid) {
      return null;
    }

    var payload = JSON.parse(new TextDecoder().decode(decodeBytes(parts[0])));
    if (!payload.user_id || typeof payload.user_id !== 'string' || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch (error) {
    console.error('Falha ao validar token assinado:', error);
    return null;
  }
}

export async function getSession(request, env) {
  var token = getCookie(request, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  return verifySignedToken(token, env);
}

export function createRandomState() {
  var bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeBytes(bytes);
}

export function sessionCookie(token) {
  return SESSION_COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=' + SESSION_SECONDS;
}

export function stateCookie(state) {
  return STATE_COOKIE + '=' + state + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600';
}

export function clearCookie(name) {
  return name + '=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export function getStateCookieName() {
  return STATE_COOKIE;
}

export function hasOAuthConfiguration(env) {
  return Boolean(
    env.DISCORD_CLIENT_ID &&
    env.DISCORD_CLIENT_SECRET &&
    typeof env.SESSION_SECRET === 'string' &&
    env.SESSION_SECRET.length >= 32
  );
}

export function hasDatabase(env) {
  return Boolean(env.DB && typeof env.DB.prepare === 'function');
}
