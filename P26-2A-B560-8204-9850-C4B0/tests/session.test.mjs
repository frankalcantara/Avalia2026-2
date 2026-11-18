/**
 * Sessão stateless HMAC-SHA256 — `functions/api/_lib/session.js`.
 *
 * Cobre: round-trip, expiração, adulteração (payload/assinatura), segredo
 * fraco/ausente, payloads malformados e o contrato dos cookies.
 *
 * @module tests/session.test
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  SESSION_COOKIE,
  SESSION_SECRET_MIN_LENGTH,
  SESSION_TTL_SECONDS,
  createOAuthState,
  createSession,
  getSessionUser,
  isValidSessionSecret,
  parseCookies,
  serializeCookie,
  timingSafeEqualString,
  verifySession,
} from "../functions/api/_lib/session.js";

import { makeEnv, makeRequest, TEST_SESSION_SECRET } from "./helpers/env.mjs";
import { sessionPayload, signToken, toBase64Url } from "./helpers/token.mjs";

/**
 * Troca o caractere de uma posição por outro válido em base64url.
 *
 * @param {string} value String original.
 * @param {number} index Posição.
 * @returns {string} String com 1 caractere alterado.
 */
function mutateChar(value, index) {
  const current = value[index];
  const replacement = current === "A" ? "B" : "A";
  return value.slice(0, index) + replacement + value.slice(index + 1);
}

test("verifySession aceita o token emitido por createSession (round-trip do payload)", async () => {
  const user = { userId: "100000000000000001", username: "leo", avatar: "https://cdn.discordapp.com/a.png" };
  const token = await createSession(user, TEST_SESSION_SECRET);

  assert.equal(token.split(".").length, 2, "token deve ter payload.assinatura");

  const payload = await verifySession(token, TEST_SESSION_SECRET);
  assert.ok(payload, "token válido deve ser aceito");
  assert.equal(payload.uid, user.userId);
  assert.equal(payload.name, user.username);
  assert.equal(payload.avatar, user.avatar);
  assert.equal(payload.exp - payload.iat, SESSION_TTL_SECONDS);
});

test("verifySession rejeita token expirado (iat/exp no passado)", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signToken(
    TEST_SESSION_SECRET,
    sessionPayload({ iat: now - SESSION_TTL_SECONDS - 100, exp: now - 100 }),
  );

  assert.equal(await verifySession(token, TEST_SESSION_SECRET), null);
});

test("verifySession rejeita token com validade maior que o TTL permitido", async () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signToken(TEST_SESSION_SECRET, sessionPayload({ iat: now, exp: now + SESSION_TTL_SECONDS + 120 }));

  assert.equal(await verifySession(token, TEST_SESSION_SECRET), null);
});

test("verifySession rejeita token com 1 byte adulterado na assinatura", async () => {
  const token = await createSession({ userId: "100000000000000001", username: "leo", avatar: "" }, TEST_SESSION_SECRET);
  const [segment, signature] = token.split(".");
  const tampered = `${segment}.${mutateChar(signature, 3)}`;

  assert.equal(await verifySession(tampered, TEST_SESSION_SECRET), null);
});

test("verifySession rejeita token com payload adulterado e assinatura original", async () => {
  const token = await createSession({ userId: "100000000000000001", username: "leo", avatar: "" }, TEST_SESSION_SECRET);
  const [, signature] = token.split(".");
  const forgedSegment = toBase64Url(JSON.stringify(sessionPayload({ uid: "999999999999999999" })));

  assert.equal(await verifySession(`${forgedSegment}.${signature}`, TEST_SESSION_SECRET), null);
});

test("verifySession rejeita token assinado com outro segredo", async () => {
  const token = signToken("outro-segredo-de-32-caracteres-ou-mais!!", sessionPayload());

  assert.equal(await verifySession(token, TEST_SESSION_SECRET), null);
});

test("segredo curto desativa a criação e a verificação da sessão", async () => {
  await assert.rejects(
    () => createSession({ userId: "100000000000000001", username: "leo", avatar: "" }, "curto"),
    /session_secret_missing/,
  );

  const token = signToken("a".repeat(SESSION_SECRET_MIN_LENGTH), sessionPayload());
  assert.equal(await verifySession(token, "a".repeat(SESSION_SECRET_MIN_LENGTH - 1)), null);
  assert.equal(isValidSessionSecret(undefined), false);
  assert.equal(isValidSessionSecret("a".repeat(SESSION_SECRET_MIN_LENGTH)), true);
});

test("verifySession rejeita payload que não é JSON válido", async () => {
  const token = signToken(TEST_SESSION_SECRET, Buffer.from([0xff, 0xfe, 0xfd, 0x00]));

  assert.equal(await verifySession(token, TEST_SESSION_SECRET), null);
});

test("verifySession rejeita token com base64url inválido ou formato quebrado", async () => {
  assert.equal(await verifySession("não-base64.assinatura", TEST_SESSION_SECRET), null, "caracteres fora do alfabeto");
  assert.equal(await verifySession("aaa", TEST_SESSION_SECRET), null, "sem separador");
  assert.equal(await verifySession("a.b.c", TEST_SESSION_SECRET), null, "3 segmentos");
  assert.equal(await verifySession("", TEST_SESSION_SECRET), null, "vazio");
  assert.equal(await verifySession(null, TEST_SESSION_SECRET), null, "não-string");
  assert.equal(await verifySession(`${"a".repeat(2049)}.b`, TEST_SESSION_SECRET), null, "acima do tamanho máximo");
});

test("verifySession rejeita payload sem exp, com uid vazio ou campos de tipo errado", async () => {
  const now = Math.floor(Date.now() / 1000);

  const semExp = signToken(TEST_SESSION_SECRET, { uid: "1", name: "leo", avatar: "", iat: now });
  assert.equal(await verifySession(semExp, TEST_SESSION_SECRET), null);

  const uidVazio = signToken(TEST_SESSION_SECRET, sessionPayload({ uid: "" }));
  assert.equal(await verifySession(uidVazio, TEST_SESSION_SECRET), null);

  const uidNumerico = signToken(TEST_SESSION_SECRET, { ...sessionPayload(), uid: 123 });
  assert.equal(await verifySession(uidNumerico, TEST_SESSION_SECRET), null);

  const nomeLongo = signToken(TEST_SESSION_SECRET, sessionPayload({ name: "n".repeat(129) }));
  assert.equal(await verifySession(nomeLongo, TEST_SESSION_SECRET), null);

  const avatarLongo = signToken(TEST_SESSION_SECRET, sessionPayload({ avatar: "a".repeat(513) }));
  assert.equal(await verifySession(avatarLongo, TEST_SESSION_SECRET), null);

  const naoObjeto = signToken(TEST_SESSION_SECRET, Buffer.from("null", "utf8"));
  assert.equal(await verifySession(naoObjeto, TEST_SESSION_SECRET), null);
});

test("getSessionUser resolve o usuário a partir do cookie e ignora cookie ausente/inválido", async () => {
  const env = makeEnv();
  const token = await createSession({ userId: "100000000000000001", username: "leo", avatar: "av.png" }, env.SESSION_SECRET);

  const withCookie = makeRequest("/api/auth/me", { cookies: `${SESSION_COOKIE}=${token}` });
  const user = await getSessionUser(withCookie, env);
  assert.deepEqual(user, { userId: "100000000000000001", username: "leo", avatar: "av.png" });

  const semCookie = makeRequest("/api/auth/me");
  assert.equal(await getSessionUser(semCookie, env), null);

  const adulterado = makeRequest("/api/auth/me", { cookies: `${SESSION_COOKIE}=${token}x` });
  assert.equal(await getSessionUser(adulterado, env), null);

  const semSegredo = makeRequest("/api/auth/me", { cookies: `${SESSION_COOKIE}=${token}` });
  assert.equal(await getSessionUser(semSegredo, { SESSION_SECRET: "curto" }), null);
});

test("parseCookies lê múltiplos cookies e preserva valores URL-encoded", () => {
  const cookies = parseCookies("receitas_session=abc.def; oauth_state=xyz%2B1; vazio=");
  assert.equal(cookies.receitas_session, "abc.def");
  assert.equal(cookies.oauth_state, "xyz+1");
  assert.equal(cookies.vazio, "");
  assert.deepEqual(parseCookies(null), {});
  assert.deepEqual(parseCookies("semvalor"), {});
});

test("serializeCookie aplica hardening (HttpOnly, Secure, SameSite, Path e Max-Age)", () => {
  const cookie = serializeCookie("receitas_session", "abc", { maxAge: 60 });
  assert.match(cookie, /^receitas_session=abc;/);
  assert.match(cookie, /Path=\//);
  assert.match(cookie, /Max-Age=60/);
  assert.match(cookie, /SameSite=Lax/);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);

  assert.match(serializeCookie("x", "", { maxAge: 0 }), /Max-Age=0/);
  assert.match(serializeCookie("x", "v", { maxAge: -5 }), /Max-Age=0/);
});

test("timingSafeEqualString compara sem aceitar tipos/length divergentes", () => {
  assert.equal(timingSafeEqualString("abc", "abc"), true);
  assert.equal(timingSafeEqualString("abc", "abd"), false);
  assert.equal(timingSafeEqualString("abc", "abcd"), false);
  assert.equal(timingSafeEqualString("", ""), true);
  assert.equal(timingSafeEqualString(null, null), false);
  assert.equal(timingSafeEqualString(1, 1), false);
});

test("createOAuthState gera 64 caracteres hexadecimais distintos", () => {
  const first = createOAuthState();
  const second = createOAuthState();

  assert.match(first, /^[0-9a-f]{64}$/);
  assert.match(second, /^[0-9a-f]{64}$/);
  assert.notEqual(first, second);
});
