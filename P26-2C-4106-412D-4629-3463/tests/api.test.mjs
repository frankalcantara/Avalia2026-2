// Teste de integração das Functions contra um D1 simulado sobre node:sqlite (usa o schema real de migrations/).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* Node sem node:sqlite (< 22.5): o teste é pulado */ }
import { sha256Hex } from '../functions/_lib/util.js';
import * as disciplinas from '../functions/api/disciplinas.js';
import * as inscricao from '../functions/api/inscricoes/[codigo].js';
import * as avisos from '../functions/api/avisos/index.js';
import * as aviso from '../functions/api/avisos/[id].js';
import * as estado from '../functions/api/avisos/[id]/estado.js';

function criarD1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(readFileSync(new URL('../migrations/0001_init.sql', import.meta.url), 'utf8'));
  const stmt = (sql, params = []) => ({
    bind: (...p) => stmt(sql, p),
    first: async () => db.prepare(sql).get(...params) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...params) }),
    run: async () => {
      const r = db.prepare(sql).run(...params);
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
  });
  return { db, prepare: (sql) => stmt(sql), batch: async (lista) => { for (const s of lista) await s.run(); } };
}

const ORIGEM = 'https://mural.test';
async function novoUsuario(env, id, nome) {
  const agora = Math.floor(Date.now() / 1000);
  env.DB.db.prepare('INSERT INTO users VALUES (?1,?2,?3,NULL,?4,?4)').run(id, nome.toLowerCase(), nome, agora);
  const token = `tok-${id}`;
  env.DB.db.prepare('INSERT INTO sessions VALUES (?1,?2,?3,?4)').run(await sha256Hex(token), id, agora, agora + 3600);
  return token;
}
function req(metodo, caminho, token, corpo, { origem = ORIGEM } = {}) {
  const headers = {};
  if (token) headers.cookie = `__Host-session=${token}`;
  if (corpo !== undefined) headers['content-type'] = 'application/json';
  if (metodo !== 'GET') headers.origin = origem;
  return new Request(ORIGEM + caminho, { method: metodo, headers, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
}
const chamar = async (fn, env, request, params = {}) => {
  const r = await fn({ request, env, params });
  return { status: r.status, dados: await r.json() };
};

test('fluxo completo: disciplinas, inscrição, avisos, autoria e estado individual', { skip: !DatabaseSync && 'node:sqlite indisponível nesta versão do Node' }, async () => {
  const env = { DB: criarD1() };
  const ana = await novoUsuario(env, '111', 'Ana');
  const beto = await novoUsuario(env, '222', 'Beto');

  // sem login
  assert.equal((await chamar(avisos.onRequestGet, env, req('GET', '/api/avisos'))).status, 401);

  // criar disciplina (quem cria já segue) e duplicata
  assert.equal((await chamar(disciplinas.onRequestPost, env, req('POST', '/api/disciplinas', ana, { codigo: 'bd1', nome: 'Banco de Dados' }))).status, 201);
  assert.equal((await chamar(disciplinas.onRequestPost, env, req('POST', '/api/disciplinas', beto, { codigo: 'BD1', nome: 'Outro nome' }))).status, 409);

  // Beto ainda não segue: feed vazio; depois segue
  assert.equal((await chamar(avisos.onRequestGet, env, req('GET', '/api/avisos', beto))).dados.avisos.length, 0);
  assert.equal((await chamar(inscricao.onRequestPut, env, req('PUT', '/api/inscricoes/BD1', beto), { codigo: 'BD1' })).status, 200);
  assert.equal((await chamar(inscricao.onRequestPut, env, req('PUT', '/api/inscricoes/NAO', beto), { codigo: 'NAO' })).status, 404);

  // Ana publica, tentando forjar autoria
  const pub = await chamar(avisos.onRequestPost, env, req('POST', '/api/avisos', ana,
    { disciplina: 'BD1', tipo: 'lembrete', titulo: 'Entrega 1', corpo: 'Modelo ER', prazo: '2026-12-10', autor_id: '222', autor_nome: 'Falso' }));
  assert.equal(pub.status, 201);
  const id = String(pub.dados.id);
  const linha = env.DB.db.prepare('SELECT autor_id, autor_nome FROM avisos WHERE id = ?').get(Number(id));
  assert.deepEqual({ ...linha }, { autor_id: '111', autor_nome: 'Ana' });

  // validação no servidor
  assert.equal((await chamar(avisos.onRequestPost, env, req('POST', '/api/avisos', ana, { disciplina: 'BD1', tipo: 'link', titulo: 'Ruim', url: 'javascript:x' }))).status, 400);

  // CSRF: origem diferente é barrada
  assert.equal((await chamar(avisos.onRequestPost, env, req('POST', '/api/avisos', ana, { disciplina: 'BD1', tipo: 'aviso', titulo: 'Oi', corpo: 'x' }, { origem: 'https://evil.test' }))).status, 403);

  // Beto vê, mas não edita nem remove
  assert.equal((await chamar(avisos.onRequestGet, env, req('GET', '/api/avisos', beto))).dados.avisos.length, 1);
  const editar = { disciplina: 'BD1', tipo: 'aviso', titulo: 'Sequestrado', corpo: 'x' };
  assert.equal((await chamar(aviso.onRequestPatch, env, req('PATCH', `/api/avisos/${id}`, beto, editar), { id })).status, 403);
  assert.equal((await chamar(aviso.onRequestDelete, env, req('DELETE', `/api/avisos/${id}`, beto), { id })).status, 403);

  // estado individual: Beto marca lido e fixa; Ana não é afetada
  assert.equal((await chamar(estado.onRequestPut, env, req('PUT', `/api/avisos/${id}/estado`, beto, { lido: true, fixado: true }), { id })).status, 200);
  const vBeto = (await chamar(avisos.onRequestGet, env, req('GET', '/api/avisos', beto))).dados.avisos[0];
  const vAna = (await chamar(avisos.onRequestGet, env, req('GET', '/api/avisos', ana))).dados.avisos[0];
  assert.deepEqual([vBeto.lido, vBeto.fixado, vAna.lido, vAna.fixado], [true, true, false, false]);

  // Ana edita e remove
  const ok = await chamar(aviso.onRequestPatch, env, req('PATCH', `/api/avisos/${id}`, ana, { disciplina: 'BD1', tipo: 'lembrete', titulo: 'Entrega 1 (nova data)', corpo: 'Modelo ER', prazo: '2026-12-12' }), { id });
  assert.equal(ok.status, 200);
  assert.equal((await chamar(avisos.onRequestGet, env, req('GET', '/api/avisos?disciplina=BD1', ana))).dados.avisos[0].titulo, 'Entrega 1 (nova data)');
  assert.equal((await chamar(aviso.onRequestDelete, env, req('DELETE', `/api/avisos/${id}`, ana), { id })).status, 200);
  assert.equal((await chamar(avisos.onRequestGet, env, req('GET', '/api/avisos', ana))).dados.avisos.length, 0);
  assert.equal(env.DB.db.prepare('SELECT COUNT(*) AS n FROM estado_aviso').get().n, 0);
});
