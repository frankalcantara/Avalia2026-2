/**
 * Sessão assinada (HMAC-SHA256) e proteção CSRF do fluxo Discord OAuth2.
 *
 * Este arquivo NÃO exporta nenhum handler `onRequest*`, portanto o roteador
 * de Pages Functions não cria nenhuma rota para ele. Ele é apenas importado
 * pelos handlers de autenticação e pelas rotas que exigem sessão.
 *
 * Formato do cookie "discord_session":
 *   payloadBase64Url.assinaturaBase64Url
 *
 * - payloadBase64Url: JSON { userId, username, avatar, iat, exp } em base64url.
 * - assinaturaBase64Url: HMAC-SHA256 (crypto.subtle) do TEXTO payloadBase64Url,
 *   usando env.SESSION_SECRET. O segredo nunca é escrito no código.
 *
 * Qualquer payload ou assinatura adulterada é rejeitada em `lerSessao`, que
 * retorna null (as rotas então respondem 401).
 */

export const COOKIE_SESSAO = "discord_session";
export const COOKIE_ESTADO = "discord_oauth_state";

export const SESSAO_DURACAO_SEGUNDOS = 7 * 24 * 60 * 60; // 7 dias
export const ESTADO_DURACAO_SEGUNDOS = 600; // 10 minutos

const ALGORITMO = { name: "HMAC", hash: "SHA-256" };

/* -------------------------------------------------------------------------- */
/* Base64url                                                                   */
/* -------------------------------------------------------------------------- */

function base64UrlDeBytes(bytes) {
  let binario = "";
  for (const byte of bytes) {
    binario += String.fromCharCode(byte);
  }
  return btoa(binario)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function bytesDeBase64Url(texto) {
  if (typeof texto !== "string" || !/^[A-Za-z0-9_-]+$/.test(texto)) {
    return null;
  }

  const base64 = texto.replace(/-/g, "+").replace(/_/g, "/");
  const preenchimento =
    base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));

  try {
    const binario = atob(base64 + preenchimento);
    const bytes = new Uint8Array(binario.length);
    for (let indice = 0; indice < binario.length; indice += 1) {
      bytes[indice] = binario.charCodeAt(indice);
    }
    return bytes;
  } catch {
    return null;
  }
}

function base64UrlDeTexto(texto) {
  return base64UrlDeBytes(new TextEncoder().encode(texto));
}

/* -------------------------------------------------------------------------- */
/* Segredo e chave                                                             */
/* -------------------------------------------------------------------------- */

function obterSegredo(env) {
  const segredo =
    env && typeof env.SESSION_SECRET === "string"
      ? env.SESSION_SECRET.trim()
      : "";
  return segredo || null;
}

function importarChave(segredo) {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    ALGORITMO,
    false,
    ["sign", "verify"]
  );
}

/** Comparação em tempo constante para valores de tamanho fixo (state). */
function compararTempoConstante(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;

  let diferenca = 0;
  for (let indice = 0; indice < a.length; indice += 1) {
    diferenca |= a.charCodeAt(indice) ^ b.charCodeAt(indice);
  }
  return diferenca === 0;
}

/* -------------------------------------------------------------------------- */
/* Cookies                                                                     */
/* -------------------------------------------------------------------------- */

function montarCookie(nome, valor, maxAge) {
  return `${nome}=${valor}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

/** Cookie de sessão assinada (7 dias). */
export function cookieSessao(valor) {
  return montarCookie(COOKIE_SESSAO, valor, SESSAO_DURACAO_SEGUNDOS);
}

/** Apaga o cookie de sessão mantendo exatamente os mesmos atributos. */
export function limparCookieSessao() {
  return montarCookie(COOKIE_SESSAO, "", 0);
}

/** Cookie curto com o `state` do OAuth (10 minutos). */
export function cookieEstado(valor) {
  return montarCookie(COOKIE_ESTADO, valor, ESTADO_DURACAO_SEGUNDOS);
}

/** Apaga o cookie de `state` mantendo exatamente os mesmos atributos. */
export function limparCookieEstado() {
  return montarCookie(COOKIE_ESTADO, "", 0);
}

/** Lê um cookie pelo nome, sem depender de expressão regular. */
export function lerCookie(request, nome) {
  const cabecalho =
    request && request.headers ? request.headers.get("Cookie") || "" : "";

  for (const parte of cabecalho.split(";")) {
    const indice = parte.indexOf("=");
    if (indice === -1) continue;

    if (parte.slice(0, indice).trim() === nome) {
      return parte.slice(indice + 1).trim();
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* Sessão                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Cria o valor assinado da sessão.
 * Lança erro claro quando env.SESSION_SECRET não está configurado.
 */
export async function criarSessao(env, usuario) {
  const segredo = obterSegredo(env);
  if (!segredo) {
    throw new Error(
      "SESSION_SECRET não configurado: defina a variável de ambiente SESSION_SECRET para assinar a sessão."
    );
  }

  if (!usuario || typeof usuario !== "object") {
    throw new Error("Dados de usuário inválidos para criar a sessão.");
  }

  const agora = Math.floor(Date.now() / 1000);
  const payload = {
    userId: String(usuario.userId ?? "").trim(),
    username: typeof usuario.username === "string" ? usuario.username : "",
    avatar: typeof usuario.avatar === "string" ? usuario.avatar : "",
    iat: agora,
    exp: agora + SESSAO_DURACAO_SEGUNDOS,
  };

  if (!payload.userId) {
    throw new Error("userId ausente: não é possível criar a sessão.");
  }

  const payloadBase64Url = base64UrlDeTexto(JSON.stringify(payload));
  const chave = await importarChave(segredo);
  const assinatura = await crypto.subtle.sign(
    ALGORITMO,
    chave,
    new TextEncoder().encode(payloadBase64Url)
  );

  return `${payloadBase64Url}.${base64UrlDeBytes(new Uint8Array(assinatura))}`;
}

/**
 * Valida o cookie de sessão e retorna { userId, username, avatar } ou null.
 * Falha de forma segura (null) se o segredo não existir, se a assinatura for
 * inválida/adulterada ou se a sessão estiver expirada.
 */
export async function lerSessao(request, env) {
  const segredo = obterSegredo(env);
  if (!segredo) return null;

  const valor = lerCookie(request, COOKIE_SESSAO);
  if (!valor) return null;

  const partes = valor.split(".");
  if (partes.length !== 2) return null;

  const [payloadBase64Url, assinaturaBase64Url] = partes;
  const dadosPayload = bytesDeBase64Url(payloadBase64Url);
  const assinatura = bytesDeBase64Url(assinaturaBase64Url);
  if (!dadosPayload || !assinatura) return null;

  let valida = false;
  try {
    const chave = await importarChave(segredo);
    valida = await crypto.subtle.verify(
      ALGORITMO,
      chave,
      assinatura,
      new TextEncoder().encode(payloadBase64Url)
    );
  } catch {
    return null;
  }

  if (!valida) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(dadosPayload));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object") return null;

  const exp = payload.exp;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;

  const userIdBruto = payload.userId ?? payload.user_id;
  if (typeof userIdBruto !== "string") return null;

  const userId = userIdBruto.trim();
  if (!userId || userId.length > 128) return null;

  return {
    userId,
    username: typeof payload.username === "string" ? payload.username : "",
    avatar: typeof payload.avatar === "string" ? payload.avatar : "",
  };
}

/* -------------------------------------------------------------------------- */
/* State (CSRF do OAuth)                                                       */
/* -------------------------------------------------------------------------- */

/** Gera um `state` imprevisível (256 bits) em base64url. */
export function criarValorEstado() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlDeBytes(bytes);
}

/**
 * Confere se o `state` recebido no callback é exatamente o valor guardado no
 * cookie curto. Retorna false quando o cookie não existe ou não confere.
 */
export function estadoValido(request, recebido) {
  const esperado = lerCookie(request, COOKIE_ESTADO);
  if (!esperado) return false;
  return compararTempoConstante(esperado, recebido);
}
