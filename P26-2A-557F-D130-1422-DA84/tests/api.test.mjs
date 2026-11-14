// Teste da API sem rede: usa node:sqlite (Node 22+) como D1 simulado.
// Uso: node --no-warnings tests/api.test.mjs
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { assinar } from "../lib/util.js";
import * as me from "../functions/api/me.js";
import * as listas from "../functions/api/lists/index.js";
import * as join from "../functions/api/lists/join.js";
import * as lista from "../functions/api/lists/[id].js";
import * as tarefasLista from "../functions/api/lists/[id]/tasks.js";
import * as tarefa from "../functions/api/tasks/[id].js";
import * as loginDiscord from "../functions/api/auth/discord.js";
import * as callback from "../functions/api/auth/discord/callback.js";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for (const m of ["0001_init.sql", "0002_shared_todo.sql"]) sqlite.exec(readFileSync(new URL("../migrations/" + m, import.meta.url), "utf8"));
// Mini-shim do D1 sobre node:sqlite
const stmt = (sql, vals = []) => ({
  bind: (...v) => stmt(sql, v),
  first: async () => sqlite.prepare(sql).get(...vals) ?? null,
  all: async () => ({ results: sqlite.prepare(sql).all(...vals) }),
  run: async () => { const r = sqlite.prepare(sql).run(...vals); return { meta: { last_row_id: Number(r.lastInsertRowid) } }; },
  _exec: () => sqlite.prepare(sql).run(...vals),
});
const DB = { prepare: (s) => stmt(s), batch: async (a) => a.map((s) => s._exec()) };
const env = { DB, SESSION_SECRET: "segredo-de-teste-bem-longo-0123456789abcdef" };
const O = "https://x.pages.dev";
for (const [id, n] of [["111", "Ana"], ["222", "Beto"], ["333", "Carla"]])
  sqlite.prepare("INSERT INTO discord_users (user_id,username,avatar) VALUES (?,?,?)").run(id, n, "https://a/" + id);
const tok = async (uid, exp) => assinar({ uid, exp: exp ?? Math.floor(Date.now() / 1000) + 600 }, env.SESSION_SECRET);
const req = async (metodo, caminho, uid, corpo, extra = {}) => new Request(O + caminho, {
  method: metodo,
  headers: { ...(uid ? { cookie: `sessao=${await tok(uid)}` } : {}), origin: O, "content-type": "application/json", ...extra },
  body: corpo ? JSON.stringify(corpo) : undefined,
});
let falhas = 0;
const esp = (nome, got, want) => { const ok = got === want; if (!ok) falhas++; console.log(ok ? "OK  " : "FALHA", nome, ok ? "" : `(obtido ${got}, esperado ${want})`); };

esp("sem login /api/me", (await me.onRequestGet({ request: await req("GET", "/api/me"), env })).status, 401);
esp("sessão forjada", (await me.onRequestGet({ request: new Request(O + "/api/me", { headers: { cookie: "sessao=abc.def" } }), env })).status, 401);
esp("sessão expirada", (await me.onRequestGet({ request: new Request(O + "/api/me", { headers: { cookie: `sessao=${await tok("111", 1)}` } }), env })).status, 401);
esp("login válido", (await me.onRequestGet({ request: await req("GET", "/api/me", "111"), env })).status, 200);

let r = await listas.onRequestPost({ request: await req("POST", "/api/lists", "111", { nome: "TCC" }), env });
esp("criar lista", r.status, 201);
const id = (await r.json()).id;
esp("nome vazio", (await listas.onRequestPost({ request: await req("POST", "/api/lists", "111", { nome: "  " }), env })).status, 400);
esp("CSRF: origem errada", (await listas.onRequestPost({ request: await req("POST", "/api/lists", "111", { nome: "x" }, { origin: "https://evil.com" }), env })).status, 403);
esp("não-membro lê lista → 404", (await lista.onRequestGet({ request: await req("GET", `/api/lists/${id}`, "222"), env, params: { id } })).status, 404);

const code = sqlite.prepare("SELECT code FROM lists WHERE id=?").get(id).code;
esp("código errado", (await join.onRequestPost({ request: await req("POST", "/api/lists/join", "222", { codigo: "ZZZZZZZZ" }), env })).status, 404);
esp("código fora do formato", (await join.onRequestPost({ request: await req("POST", "/api/lists/join", "222", { codigo: "abc" }), env })).status, 400);
esp("entrar com código (minúsculo)", (await join.onRequestPost({ request: await req("POST", "/api/lists/join", "222", { codigo: code.toLowerCase() }), env })).status, 200);
esp("entrar de novo (idempotente)", (await join.onRequestPost({ request: await req("POST", "/api/lists/join", "222", { codigo: code }), env })).status, 200);
esp("membro lê lista", (await lista.onRequestGet({ request: await req("GET", `/api/lists/${id}`, "222"), env, params: { id } })).status, 200);

r = await tarefasLista.onRequestPost({ request: await req("POST", `/api/lists/${id}/tasks`, "111", { titulo: "Escrever intro", assignee_id: "222" }), env, params: { id } });
esp("criar tarefa com responsável membro", r.status, 201);
const t1 = (await r.json()).id;
esp("responsável não-membro", (await tarefasLista.onRequestPost({ request: await req("POST", `/api/lists/${id}/tasks`, "111", { titulo: "x", assignee_id: "333" }), env, params: { id } })).status, 400);
r = await tarefasLista.onRequestPost({ request: await req("POST", `/api/lists/${id}/tasks`, "222", { titulo: "Subtarefa", parent_id: t1 }), env, params: { id } });
esp("criar subtarefa", r.status, 201);
const s1 = (await r.json()).id;
esp("sub de subtarefa recusada", (await tarefasLista.onRequestPost({ request: await req("POST", `/api/lists/${id}/tasks`, "111", { titulo: "x", parent_id: s1 }), env, params: { id } })).status, 400);
esp("não-membro cria tarefa", (await tarefasLista.onRequestPost({ request: await req("POST", `/api/lists/${id}/tasks`, "333", { titulo: "x" }), env, params: { id } })).status, 404);

esp("done não booleano", (await tarefa.onRequestPatch({ request: await req("PATCH", `/api/tasks/${t1}`, "222", { done: "false" }), env, params: { id: String(t1) } })).status, 400);
esp("done inválido não altera tarefa", sqlite.prepare("SELECT done FROM tasks WHERE id=?").get(t1).done, 0);
esp("concluir tarefa", (await tarefa.onRequestPatch({ request: await req("PATCH", `/api/tasks/${t1}`, "222", { done: true }), env, params: { id: String(t1) } })).status, 200);
esp("membro edita título", (await tarefa.onRequestPatch({ request: await req("PATCH", `/api/tasks/${t1}`, "222", { title: "Introdução revisada" }), env, params: { id: String(t1) } })).status, 200);
esp("não-membro altera tarefa", (await tarefa.onRequestPatch({ request: await req("PATCH", `/api/tasks/${t1}`, "333", { done: false }), env, params: { id: String(t1) } })).status, 404);
esp("atribuir a não-membro", (await tarefa.onRequestPatch({ request: await req("PATCH", `/api/tasks/${t1}`, "111", { assignee_id: "333" }), env, params: { id: String(t1) } })).status, 400);
esp("limpar responsável", (await tarefa.onRequestPatch({ request: await req("PATCH", `/api/tasks/${t1}`, "111", { assignee_id: null }), env, params: { id: String(t1) } })).status, 200);
esp("SQL injection no título é só texto", (await tarefasLista.onRequestPost({ request: await req("POST", `/api/lists/${id}/tasks`, "111", { titulo: "x'); DROP TABLE tasks;--" }), env, params: { id } })).status, 201);
esp("tabela tasks segue viva", sqlite.prepare("SELECT COUNT(*) c FROM tasks").get().c, 3);

const dados = await (await lista.onRequestGet({ request: await req("GET", `/api/lists/${id}`, "111"), env, params: { id } })).json();
esp("membros na lista", dados.membros.length, 2);
esp("done persistiu", dados.tarefas.find((t) => t.id === t1).done, 1);

esp("membro comum não exclui tarefa", (await tarefa.onRequestDelete({ request: await req("DELETE", `/api/tasks/${t1}`, "222"), env, params: { id: String(t1) } })).status, 403);
esp("excluir tarefa (com subtarefa)", (await tarefa.onRequestDelete({ request: await req("DELETE", `/api/tasks/${t1}`, "111"), env, params: { id: String(t1) } })).status, 200);
esp("subtarefa removida junto", sqlite.prepare("SELECT COUNT(*) c FROM tasks WHERE id=?").get(s1).c, 0);
esp("não-dono exclui lista", (await lista.onRequestDelete({ request: await req("DELETE", `/api/lists/${id}`, "222"), env, params: { id } })).status, 403);
esp("dono exclui lista", (await lista.onRequestDelete({ request: await req("DELETE", `/api/lists/${id}`, "111"), env, params: { id } })).status, 200);

// --- fluxo OAuth (sem rede)
const semCfg = await loginDiscord.onRequestGet({ request: new Request(O + "/api/auth/discord"), env: {} });
esp("login sem DISCORD_CLIENT_ID → 500", semCfg.status, 500);
const lg = await loginDiscord.onRequestGet({ request: new Request(O + "/api/auth/discord"), env: { DISCORD_CLIENT_ID: "123" } });
esp("login redireciona ao Discord", lg.headers.get("location").startsWith("https://discord.com/oauth2/authorize?"), true);
esp("login envia redirect_uri oficial", lg.headers.get("location").includes(encodeURIComponent(O + "/api/auth/discord/callback")), true);
esp("login grava cookie de state", /oauth_state=[\w-]+/.test(lg.headers.get("set-cookie")), true);
const cb = await callback.onRequestGet({ request: new Request(O + "/api/auth/discord/callback?code=abc&state=falso", { headers: { cookie: "oauth_state=outro" } }), env });
esp("callback com state errado volta ao login", cb.headers.get("location").includes("auth_error=estado_invalido"), true);
console.log(falhas ? `\n${falhas} FALHAS` : "\nTodos os testes passaram");
process.exit(falhas ? 1 : 0);
