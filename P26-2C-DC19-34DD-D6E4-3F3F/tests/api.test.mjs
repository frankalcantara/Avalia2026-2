import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { criarEnv, addUsuario, addSessao, addTopico, addResposta, req, BASE } from "./helpers/d1-shim.mjs";

import * as me from "../functions/api/me.js";
import * as login from "../functions/api/auth/login.js";
import * as callback from "../functions/api/auth/callback.js";
import * as logout from "../functions/api/auth/logout.js";
import * as topics from "../functions/api/topics/index.js";
import * as detalhe from "../functions/api/topics/[id]/index.js";
import * as answers from "../functions/api/topics/[id]/answers.js";
import * as accept from "../functions/api/topics/[id]/accept.js";

const fetchOriginal = globalThis.fetch;
let env, autor, outro, sAutor, sOutro;

const postTopico = (cookie, body, o = {}) => topics.onRequestPost({ request: req("/api/topics", { method: "POST", cookie, body, ...o }), env });
const postResp = (id, cookie, body, o = {}) => answers.onRequestPost({ request: req(`/api/topics/${id}/answers`, { method: "POST", cookie, body, ...o }), env, params: { id: String(id) } });
const postAccept = (id, cookie, body, o = {}) => accept.onRequestPost({ request: req(`/api/topics/${id}/accept`, { method: "POST", cookie, body, ...o }), env, params: { id: String(id) } });
const getDet = (id, cookie) => detalhe.onRequestGet({ request: req(`/api/topics/${id}`, { cookie }), env, params: { id: String(id) } });
const listar = (qs = "") => topics.onRequestGet({ request: req("/api/topics" + qs), env });
const linhas = (sql, ...a) => env.DB.raw.prepare(sql).all(...a);

beforeEach(() => {
  env = criarEnv();
  addUsuario(env, "100", "Autor");
  addUsuario(env, "200", "Outro");
  sAutor = addSessao(env, "100");
  sOutro = addSessao(env, "200");
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

describe("1. sem sessão", () => {
  test("criar tópico, responder e aceitar devolvem 401", async () => {
    const t = addTopico(env, "100");
    const a = addResposta(env, t, "200");
    assert.equal((await postTopico(undefined, { title: "Titulo ok", body: "Corpo ok ok ok" })).status, 401);
    assert.equal((await postResp(t, undefined, { body: "resposta" })).status, 401);
    assert.equal((await postAccept(t, undefined, { answer_id: a })).status, 401);
    assert.equal(linhas("SELECT * FROM topics WHERE status='resolved'").length, 0);
  });
  test("cookie com token inexistente ou malformado = não logado", async () => {
    assert.equal((await postTopico("sid=abc", { title: "Titulo ok", body: "Corpo ok ok ok" })).status, 401);
    assert.equal((await postTopico("sid=" + "0".repeat(64), { title: "Titulo ok", body: "Corpo ok ok ok" })).status, 401);
  });
});

describe("sessão e /api/me", () => {
  test("sessão expirada é tratada como não logado", async () => {
    const exp = addSessao(env, "100", { expiraEm: Date.now() - 1000 });
    assert.equal((await postTopico(exp.cookie, { title: "Titulo ok", body: "Corpo ok ok ok" })).status, 401);
    const r = await me.onRequestGet({ request: req("/api/me", { cookie: exp.cookie }), env });
    assert.deepEqual(await r.json(), { user: null });
  });
  test("/api/me sem sessão: user null", async () => {
    const r = await me.onRequestGet({ request: req("/api/me"), env });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { user: null });
  });
  test("/api/me com sessão: id, username, avatar_url", async () => {
    const r = await me.onRequestGet({ request: req("/api/me", { cookie: sAutor.cookie }), env });
    assert.deepEqual(await r.json(), { user: { id: "100", username: "Autor", avatar_url: "https://x/a.png" } });
  });
});

describe("2. validação e CSRF", () => {
  const ok = { title: "Titulo valido", body: "Corpo do topico valido" };
  test("título curto/longo e corpo curto/longo: 422 com field", async () => {
    let r = await postTopico(sAutor.cookie, { ...ok, title: "abcd" });
    assert.equal(r.status, 422); assert.equal((await r.json()).field, "title");
    r = await postTopico(sAutor.cookie, { ...ok, title: "a".repeat(121) });
    assert.equal(r.status, 422);
    r = await postTopico(sAutor.cookie, { ...ok, body: "123456789" });
    assert.equal(r.status, 422); assert.equal((await r.json()).field, "body");
    r = await postTopico(sAutor.cookie, { ...ok, body: "a".repeat(5001) });
    assert.equal(r.status, 422);
    r = await postTopico(sAutor.cookie, { ...ok, title: "     a     " });
    assert.equal(r.status, 422, "trim antes de validar");
    r = await postTopico(sAutor.cookie, { ...ok, title: 12345 });
    assert.equal(r.status, 422);
    assert.equal(linhas("SELECT * FROM topics").length, 0);
  });
  test("limites exatos aceitos (5 e 120 no título)", async () => {
    assert.equal((await postTopico(sAutor.cookie, { title: "abcde", body: "1234567890" })).status, 201);
    assert.equal((await postTopico(sAutor.cookie, { title: "a".repeat(120), body: "a".repeat(5000) })).status, 201);
  });
  test("resposta curta/longa: 422", async () => {
    const t = addTopico(env, "100");
    assert.equal((await postResp(t, sOutro.cookie, { body: "ab" })).status, 422);
    assert.equal((await postResp(t, sOutro.cookie, { body: "a".repeat(5001) })).status, 422);
    assert.equal((await postResp(t, sOutro.cookie, { body: "abc" })).status, 201);
  });
  test("JSON inválido: 400; corpo não objeto: 400", async () => {
    assert.equal((await postTopico(sAutor.cookie, undefined, { raw: "{nao json" })).status, 400);
    assert.equal((await postTopico(sAutor.cookie, undefined, { raw: "[1]" })).status, 400);
    assert.equal((await postTopico(sAutor.cookie, undefined, { raw: "null" })).status, 400);
  });
  test("Content-Type errado ou ausente: 403", async () => {
    assert.equal((await postTopico(sAutor.cookie, ok, { ct: "text/plain" })).status, 403);
    assert.equal((await postTopico(sAutor.cookie, ok, { ct: null })).status, 403);
    assert.equal((await postTopico(sAutor.cookie, ok, { ct: "application/json; charset=utf-8" })).status, 201);
  });
  test("Origin de outro host ou ausente: 403 em todos os POST de dados", async () => {
    const t = addTopico(env, "100"); const a = addResposta(env, t, "200");
    for (const origin of ["https://evil.test", null, "lixo"]) {
      assert.equal((await postTopico(sAutor.cookie, ok, { origin })).status, 403);
      assert.equal((await postResp(t, sOutro.cookie, { body: "resposta" }, { origin })).status, 403);
      assert.equal((await postAccept(t, sAutor.cookie, { answer_id: a }, { origin })).status, 403);
    }
    assert.equal(linhas("SELECT * FROM topics").length, 1);
    assert.equal(linhas("SELECT * FROM answers").length, 1);
    assert.equal(linhas("SELECT * FROM topics WHERE status='resolved'").length, 0);
  });
  test("logout: Origin de outro host 403; ausente permitido", async () => {
    const mk = (o) => logout.onRequestPost({ request: req("/api/auth/logout", { method: "POST", cookie: sAutor.cookie, origin: o }), env });
    assert.equal((await mk("https://evil.test")).status, 403);
    assert.equal(linhas("SELECT * FROM sessions WHERE user_id='100'").length, 1);
    assert.equal((await mk(null)).status, 200);
  });
  test("ordem: id inválido 404 antes de JSON inválido 400; JSON inválido antes de 404 de tópico", async () => {
    const mk = (id) => answers.onRequestPost({ request: req("/api/x", { method: "POST", cookie: sOutro.cookie, raw: "{x" }), env, params: { id } });
    assert.equal((await mk("abc")).status, 404);
    assert.equal((await mk("9999")).status, 400);
  });
  test("topico inexistente: 404 em detalhe, resposta e accept", async () => {
    assert.equal((await getDet(999)).status, 404);
    assert.equal((await postResp(999, sOutro.cookie, { body: "resposta" })).status, 404);
    assert.equal((await postAccept(999, sOutro.cookie, { answer_id: 1 })).status, 404);
  });
});

describe("3. regras de resposta", () => {
  test("autor não responde o próprio tópico (403)", async () => {
    const t = addTopico(env, "100");
    const r = await postResp(t, sAutor.cookie, { body: "minha resposta" });
    assert.equal(r.status, 403);
    assert.equal(linhas("SELECT * FROM answers").length, 0);
  });
  test("tópico resolvido não recebe resposta (409)", async () => {
    const t = addTopico(env, "100"); const a = addResposta(env, t, "200");
    await postAccept(t, sAutor.cookie, { answer_id: a });
    const r = await postResp(t, sOutro.cookie, { body: "outra resposta" });
    assert.equal(r.status, 409);
    assert.equal(linhas("SELECT * FROM answers").length, 1);
  });
  test("resposta válida: 201 com id e author_id da sessão (não do corpo)", async () => {
    const t = addTopico(env, "100");
    const r = await postResp(t, sOutro.cookie, { body: "resposta boa", author_id: "100", user_id: "100" });
    assert.equal(r.status, 201);
    const { answer } = await r.json();
    assert.equal(linhas("SELECT author_id FROM answers WHERE id=?", answer.id)[0].author_id, "200");
  });
});

describe("4. aceitar solução", () => {
  test("não autor: 403 e nada muda", async () => {
    const t = addTopico(env, "100"); const a = addResposta(env, t, "200");
    const r = await postAccept(t, sOutro.cookie, { answer_id: a });
    assert.equal(r.status, 403);
    const row = linhas("SELECT status, accepted_answer_id, resolved_at FROM topics WHERE id=?", t)[0];
    assert.deepEqual({ ...row }, { status: "open", accepted_answer_id: null, resolved_at: null });
  });
  test("autor: 200, resolved, accepted_answer_id e resolved_at", async () => {
    const t = addTopico(env, "100"); addResposta(env, t, "200"); const a2 = addResposta(env, t, "200", "segunda");
    const r = await postAccept(t, sAutor.cookie, { answer_id: a2 });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true, topic: { id: t, status: "resolved", accepted_answer_id: a2 } });
    const row = linhas("SELECT * FROM topics WHERE id=?", t)[0];
    assert.equal(row.status, "resolved");
    assert.equal(row.accepted_answer_id, a2);
    assert.ok(row.resolved_at && !Number.isNaN(Date.parse(row.resolved_at)));
  });
  test("aceitar a mesma resposta de novo: 200", async () => {
    const t = addTopico(env, "100"); const a = addResposta(env, t, "200");
    assert.equal((await postAccept(t, sAutor.cookie, { answer_id: a })).status, 200);
    assert.equal((await postAccept(t, sAutor.cookie, { answer_id: a })).status, 200);
  });
  test("permissão não depende do corpo (user_id/author_id forjados são ignorados)", async () => {
    const t = addTopico(env, "100"); const a = addResposta(env, t, "200");
    const r = await postAccept(t, sOutro.cookie, { answer_id: a, user_id: "100", author_id: "100" });
    assert.equal(r.status, 403);
  });
});

describe("5. answer_id inválido", () => {
  test("de outro tópico, inexistente, string, negativo, float: 422 sem alteração", async () => {
    const t = addTopico(env, "100"); addResposta(env, t, "200");
    const t2 = addTopico(env, "200", "Outro topico", "Corpo outro topico"); const aOutro = addResposta(env, t2, "100");
    for (const v of [aOutro, 99999, "5", -1, 0, 1.5, null, undefined, true]) {
      const r = await postAccept(t, sAutor.cookie, { answer_id: v });
      assert.equal(r.status, 422, `answer_id=${JSON.stringify(v)}`);
    }
    const row = linhas("SELECT status, accepted_answer_id FROM topics WHERE id=?", t)[0];
    assert.deepEqual({ ...row }, { status: "open", accepted_answer_id: null });
  });
});

describe("6. trocar resposta aceita", () => {
  test("mantém uma única aceita", async () => {
    const t = addTopico(env, "100"); const a1 = addResposta(env, t, "200"); const a2 = addResposta(env, t, "200", "segunda");
    await postAccept(t, sAutor.cookie, { answer_id: a1 });
    assert.equal((await postAccept(t, sAutor.cookie, { answer_id: a2 })).status, 200);
    assert.equal(linhas("SELECT accepted_answer_id FROM topics WHERE id=?", t)[0].accepted_answer_id, a2);
    const d = await (await getDet(t, sAutor.cookie)).json();
    assert.equal(d.answers.filter((a) => a.is_accepted).length, 1);
    assert.equal(d.answers[0].id, a2);
  });
});

describe("7. detalhe do tópico", () => {
  test("aceita primeiro; viewer correto para autor, outro e anônimo", async () => {
    const t = addTopico(env, "100");
    const a1 = addResposta(env, t, "200", "primeira"); addResposta(env, t, "200", "segunda"); const a3 = addResposta(env, t, "200", "terceira");
    // antes de aceitar
    let d = await (await getDet(t, sAutor.cookie)).json();
    assert.deepEqual(d.answers.map((a) => a.id), [a1, a1 + 1, a3]);
    assert.deepEqual(d.viewer, { logged_in: true, is_author: true, can_answer: false, can_accept: true });
    await postAccept(t, sAutor.cookie, { answer_id: a3 });
    d = await (await getDet(t, sAutor.cookie)).json();
    assert.deepEqual(d.answers.map((a) => a.id), [a3, a1, a1 + 1]);
    assert.equal(d.answers[0].is_accepted, true);
    assert.equal(d.topic.status, "resolved");
    assert.equal(d.topic.accepted_answer_id, a3);
    assert.ok(d.topic.resolved_at);
    assert.deepEqual(d.viewer, { logged_in: true, is_author: true, can_answer: false, can_accept: true });
    const o = await (await getDet(t, sOutro.cookie)).json();
    assert.deepEqual(o.viewer, { logged_in: true, is_author: false, can_answer: false, can_accept: false });
    const an = await (await getDet(t)).json();
    assert.deepEqual(an.viewer, { logged_in: false, is_author: false, can_answer: false, can_accept: false });
  });
  test("tópico aberto: outro usuário can_answer true; autor sem respostas can_accept false", async () => {
    const t = addTopico(env, "100");
    const o = await (await getDet(t, sOutro.cookie)).json();
    assert.deepEqual(o.viewer, { logged_in: true, is_author: false, can_answer: true, can_accept: false });
    const a = await (await getDet(t, sAutor.cookie)).json();
    assert.equal(a.viewer.can_accept, false);
    const an = await (await getDet(t)).json();
    assert.equal(an.viewer.can_answer, false);
    assert.equal(an.topic.accepted_answer_id, null);
    assert.equal(an.topic.resolved_at, null);
  });
});

describe("8. OAuth", () => {
  const callbackReq = (qs, cookie) => callback.onRequestGet({ request: req("/api/auth/callback" + qs, { cookie }), env });
  const mockDiscord = (perfil, calls = []) => {
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url) === "https://discord.com/api/oauth2/token") return new Response(JSON.stringify({ access_token: "tok123" }), { status: 200 });
      if (String(url) === "https://discord.com/api/users/@me") return new Response(JSON.stringify(perfil), { status: 200 });
      return new Response("nope", { status: 404 });
    };
    return calls;
  };

  test("login: 302 para o Discord com parâmetros e cookie oauth_state", async () => {
    const r = await login.onRequestGet({ request: req("/api/auth/login"), env });
    assert.equal(r.status, 302);
    const loc = new URL(r.headers.get("Location"));
    assert.equal(loc.origin + loc.pathname, "https://discord.com/oauth2/authorize");
    assert.equal(loc.searchParams.get("client_id"), "cid");
    assert.equal(loc.searchParams.get("response_type"), "code");
    assert.equal(loc.searchParams.get("scope"), "identify");
    assert.equal(loc.searchParams.get("prompt"), "none");
    assert.equal(loc.searchParams.get("redirect_uri"), BASE + "/api/auth/callback");
    const sc = r.headers.get("Set-Cookie");
    assert.match(sc, /^oauth_state=/);
    assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Lax/); assert.match(sc, /Path=\/api\/auth/); assert.match(sc, /Max-Age=600/);
    assert.equal(sc.match(/^oauth_state=([^;]+)/)[1], loc.searchParams.get("state"));
  });
  test("state inválido, ausente ou sem cookie: erro=estado_invalido, sem chamar o Discord", async () => {
    globalThis.fetch = async () => { throw new Error("não deveria chamar"); };
    for (const [qs, ck] of [["?code=x&state=a", "oauth_state=b"], ["?code=x", "oauth_state=b"], ["?code=x&state=a", undefined]]) {
      const r = await callbackReq(qs, ck);
      assert.equal(r.status, 302);
      assert.equal(r.headers.get("Location"), "/?erro=estado_invalido");
    }
    assert.equal(linhas("SELECT * FROM users WHERE id NOT IN ('100','200')").length, 0);
  });
  test("error=access_denied: erro=login_cancelado", async () => {
    const r = await callbackReq("?error=access_denied&state=a", "oauth_state=a");
    assert.equal(r.headers.get("Location"), "/?erro=login_cancelado");
  });
  test("falha do Discord: erro=falha_discord e nenhuma sessão criada", async () => {
    globalThis.fetch = async () => new Response("{}", { status: 500 });
    const r = await callbackReq("?code=x&state=a", "oauth_state=a");
    assert.equal(r.headers.get("Location"), "/?erro=falha_discord");
    assert.equal(linhas("SELECT * FROM sessions").length, 2);
  });
  test("fluxo feliz: grava user_id, username, avatar_url e cria sessão válida", async () => {
    const calls = mockDiscord({ id: "123456789012345678", username: "joao", global_name: "João Silva", avatar: "abc123" });
    const r = await callbackReq("?code=CODE&state=st", "oauth_state=st");
    assert.equal(r.status, 302);
    assert.equal(r.headers.get("Location"), "/");
    const u = linhas("SELECT * FROM users WHERE id=?", "123456789012345678")[0];
    assert.equal(u.username, "João Silva");
    assert.equal(u.avatar_url, "https://cdn.discordapp.com/avatars/123456789012345678/abc123.png?size=128");
    // troca de token: form-urlencoded com code e redirect_uri
    const tk = calls.find((c) => c.url.endsWith("/oauth2/token"));
    assert.equal(tk.init.method, "POST");
    const corpo = new URLSearchParams(tk.init.body);
    assert.equal(corpo.get("code"), "CODE"); assert.equal(corpo.get("grant_type"), "authorization_code");
    assert.equal(corpo.get("redirect_uri"), BASE + "/api/auth/callback");
    const pf = calls.find((c) => c.url.endsWith("/users/@me"));
    assert.equal(pf.init.headers.Authorization, "Bearer tok123");
    // cookies
    const cookies = r.headers.getSetCookie();
    const sid = cookies.find((c) => c.startsWith("sid="));
    assert.ok(sid);
    assert.match(sid, /HttpOnly/); assert.match(sid, /SameSite=Lax/); assert.match(sid, /Path=\//); assert.match(sid, /Secure/); assert.match(sid, /Max-Age=604800/);
    assert.match(sid.match(/^sid=([^;]+)/)[1], /^[0-9a-f]{64}$/);
    const limpa = cookies.find((c) => c.startsWith("oauth_state="));
    assert.match(limpa, /Max-Age=0/);
    // sessão guarda só o hash e autentica
    const token = sid.match(/^sid=([^;]+)/)[1];
    assert.equal(linhas("SELECT * FROM sessions WHERE token_hash=?", token).length, 0);
    const m = await (await me.onRequestGet({ request: req("/api/me", { cookie: "sid=" + token }), env })).json();
    assert.deepEqual(m.user, { id: "123456789012345678", username: "João Silva", avatar_url: u.avatar_url });
  });
  test("sem global_name usa username; reentrada atualiza o usuário (upsert)", async () => {
    mockDiscord({ id: "300", username: "maria", avatar: "h1" });
    await callbackReq("?code=c&state=s", "oauth_state=s");
    assert.equal(linhas("SELECT username FROM users WHERE id='300'")[0].username, "maria");
    mockDiscord({ id: "300", username: "maria2", global_name: "Maria", avatar: "h2" });
    await callbackReq("?code=c&state=s", "oauth_state=s");
    const us = linhas("SELECT * FROM users WHERE id='300'");
    assert.equal(us.length, 1); assert.equal(us[0].username, "Maria"); assert.match(us[0].avatar_url, /h2\.png/);
  });
  test("avatar padrão quando o Discord não envia avatar", async () => {
    const id = "123456789012345678";
    mockDiscord({ id, username: "semfoto", avatar: null });
    await callbackReq("?code=c&state=s", "oauth_state=s");
    const idx = (BigInt(id) >> 22n) % 6n;
    assert.equal(linhas("SELECT avatar_url FROM users WHERE id=?", id)[0].avatar_url, `https://cdn.discordapp.com/embed/avatars/${idx}.png`);
  });
  test("perfil com id não numérico é rejeitado", async () => {
    mockDiscord({ id: "abc", username: "x" });
    const r = await callbackReq("?code=c&state=s", "oauth_state=s");
    assert.equal(r.headers.get("Location"), "/?erro=falha_discord");
  });
  test("cookie sid em HTTP não tem Secure", async () => {
    mockDiscord({ id: "400", username: "x" });
    const rq = new Request("http://localhost:8788/api/auth/callback?code=c&state=s", { headers: { Cookie: "oauth_state=s" } });
    const r = await callback.onRequestGet({ request: rq, env });
    const sid = r.headers.getSetCookie().find((c) => c.startsWith("sid="));
    assert.doesNotMatch(sid, /Secure/);
  });
  test("DISCORD_REDIRECT_URI sobrescreve o padrão", async () => {
    env.DISCORD_REDIRECT_URI = "https://prod.example/api/auth/callback";
    const r = await login.onRequestGet({ request: req("/api/auth/login"), env });
    assert.equal(new URL(r.headers.get("Location")).searchParams.get("redirect_uri"), "https://prod.example/api/auth/callback");
  });
  test("logout invalida a sessão e limpa o cookie; sem sessão também 200", async () => {
    const mk = (cookie) => logout.onRequestPost({ request: req("/api/auth/logout", { method: "POST", cookie }), env });
    const r = await mk(sAutor.cookie);
    assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
    const sc = r.headers.get("Set-Cookie");
    assert.match(sc, /^sid=;/); assert.match(sc, /Max-Age=0/); assert.match(sc, /HttpOnly/); assert.match(sc, /SameSite=Lax/);
    assert.equal(linhas("SELECT * FROM sessions WHERE token_hash=?", sAutor.hash).length, 0);
    assert.equal((await postTopico(sAutor.cookie, { title: "Titulo ok", body: "Corpo ok ok ok" })).status, 401);
    assert.equal((await mk(undefined)).status, 200);
  });
});

describe("cookies", () => {
  test("sid emitido tem HttpOnly e SameSite=Lax (via callback)", async () => {
    globalThis.fetch = async (u) => String(u).includes("token")
      ? new Response(JSON.stringify({ access_token: "t" })) : new Response(JSON.stringify({ id: "500", username: "u" }));
    const r = await callback.onRequestGet({ request: req("/api/auth/callback?code=c&state=s", { cookie: "oauth_state=s" }), env });
    const sid = r.headers.getSetCookie().find((c) => c.startsWith("sid="));
    assert.match(sid, /; HttpOnly/); assert.match(sid, /; SameSite=Lax/);
  });
});

describe("9. injeção SQL", () => {
  test("título com DROP TABLE é gravado como texto", async () => {
    const titulo = "'; DROP TABLE topics; --";
    const r = await postTopico(sAutor.cookie, { title: titulo, body: "corpo com ' OR 1=1 --" });
    assert.equal(r.status, 201);
    const row = linhas("SELECT title, body FROM topics")[0];
    assert.equal(row.title, titulo);
    assert.equal(row.body, "corpo com ' OR 1=1 --");
    assert.equal(linhas("SELECT name FROM sqlite_master WHERE name='topics'").length, 1);
  });
  test("busca com aspas/injeção não quebra nem vaza", async () => {
    addTopico(env, "100", "Titulo normal");
    const r = await listar("?q=" + encodeURIComponent("' OR '1'='1"));
    assert.equal(r.status, 200);
    assert.equal((await r.json()).total, 0);
    const r2 = await listar("?status=" + encodeURIComponent("open' OR 1=1 --"));
    assert.equal(r2.status, 422);
  });
});

describe("10. busca e listagem", () => {
  test("% e _ não viram curinga", async () => {
    addTopico(env, "100", "Aumento de 100% hoje");
    addTopico(env, "100", "Aumento de 100 hoje");
    addTopico(env, "100", "snake_case vs camel");
    addTopico(env, "100", "snakeXcase outro");
    addTopico(env, "100", "barra \\ invertida");
    const t = async (q) => (await (await listar("?q=" + encodeURIComponent(q))).json()).topics.map((x) => x.title);
    assert.deepEqual(await t("100%"), ["Aumento de 100% hoje"]);
    assert.deepEqual(await t("snake_case"), ["snake_case vs camel"]);
    assert.equal((await t("%")).length, 1);
    assert.equal((await t("_")).length, 1);
    assert.deepEqual(await t("\\"), ["barra \\ invertida"]);
    assert.equal((await t("AUMENTO")).length, 2, "LIKE case-insensitive para ASCII");
  });
  test("formato, ordem (recentes primeiro), answer_count, filtro de status", async () => {
    const t1 = addTopico(env, "100", "Primeiro topico"); const t2 = addTopico(env, "200", "Segundo topico");
    addResposta(env, t1, "200"); addResposta(env, t1, "200", "outra");
    await postAccept(t1, sAutor.cookie, { answer_id: 1 });
    const d = await (await listar()).json();
    assert.equal(d.page, 1); assert.equal(d.page_size, 20); assert.equal(d.total, 2);
    assert.deepEqual(d.topics.map((t) => t.id), [t2, t1]);
    assert.equal(d.topics[1].answer_count, 2);
    assert.deepEqual(d.topics[0].author, { id: "200", username: "Outro", avatar_url: "https://x/a.png" });
    assert.deepEqual(Object.keys(d.topics[0]).sort(), ["answer_count", "author", "created_at", "id", "status", "title"]);
    assert.deepEqual((await (await listar("?status=resolved")).json()).topics.map((t) => t.id), [t1]);
    assert.deepEqual((await (await listar("?status=open")).json()).topics.map((t) => t.id), [t2]);
  });
  test("paginação de 20 e page/status inválidos: 422", async () => {
    for (let i = 0; i < 25; i++) addTopico(env, "100", "Topico numero " + i);
    const p1 = await (await listar("?page=1")).json(); const p2 = await (await listar("?page=2")).json();
    assert.equal(p1.topics.length, 20); assert.equal(p2.topics.length, 5); assert.equal(p2.total, 25);
    assert.equal((await (await listar("?page=3")).json()).topics.length, 0);
    for (const q of ["?page=0", "?page=-1", "?page=abc", "?page=1.5", "?status=foo"]) {
      assert.equal((await listar(q)).status, 422, q);
    }
  });
  test("listagem é pública e não exige sessão", async () => {
    assert.equal((await listar()).status, 200);
  });
});

describe("varredura estática do front-end", () => {
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  const html = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  test("public/app.js não contém innerHTML, outerHTML nem insertAdjacentHTML", () => {
    for (const termo of ["innerHTML", "outerHTML", "insertAdjacentHTML"]) {
      const linhasComTermo = app.split("\n").map((l, i) => [i + 1, l]).filter(([, l]) => l.includes(termo)).map(([n]) => n);
      assert.deepEqual(linhasComTermo, [], `"${termo}" encontrado em public/app.js nas linhas ${linhasComTermo.join(", ")}`);
    }
  });
  test("public/index.html contém a chave de auditoria no rodapé", () => {
    assert.ok(html.includes("Chave: P26-2C-DC19-34DD-D6E4-3F3F"));
    assert.match(html, /<footer[\s\S]*Chave: P26-2C-DC19-34DD-D6E4-3F3F[\s\S]*<\/footer>/);
  });
  test("front-end não usa CDN nem scripts externos", () => {
    assert.doesNotMatch(html, /<(script|link)[^>]+(https?:)?\/\//i);
  });
});
