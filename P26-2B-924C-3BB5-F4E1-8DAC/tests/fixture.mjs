import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

export const student = { id: '100000000000000001', username: 'estudante', global_name: 'Estudante' };
export const visitor = { id: '100000000000000002', username: 'visitante', global_name: 'Visitante' };
const people = new Map([['student', student], ['visitor', visitor]]);
const testSecret = 'segredo-de-teste-sem-credencial-externa';

export const sampleResume = {
  profile: {
    name: 'Ana Silva',
    headline: 'Desenvolvedora web',
    email: 'ana@example.com',
    location: 'Curitiba, PR',
    summary: 'Projetos acadêmicos com dados abertos.',
  },
  education: [{
    course: 'Engenharia de Software',
    institution: 'Instituição de Exemplo',
    start: '2024-02',
    end: '2027-12',
    description: 'Desenvolvimento web e bancos de dados.',
  }],
  projects: [{
    name: 'Mapa do Campus',
    description: 'Mapa de espaços de estudo.',
    url: 'https://example.com/projeto',
  }],
  skills: ['JavaScript', 'SQL'],
  links: [{ label: 'Repositório do campus', url: 'https://github.com/example/mapa' }],
  theme: 'modern',
  colors: { accent: '#2e576a', background: '#ffffff', text: '#1a222b' },
  published: false,
};

function runResult(result) {
  return {
    success: true,
    results: [],
    meta: {
      changes: Number(result.changes),
      last_row_id: Number(result.lastInsertRowid),
    },
  };
}

function statementFor(database, sql, bindings = []) {
  return {
    bind: (...values) => statementFor(database, sql, values),
    first: async (column) => {
      const row = database.prepare(sql).get(...bindings);
      return row ? (column === undefined ? { ...row } : row[column]) : null;
    },
    all: async () => ({
      success: true,
      results: database.prepare(sql).all(...bindings).map((row) => ({ ...row })),
    }),
    run: async () => runResult(database.prepare(sql).run(...bindings)),
  };
}

export function createEnv() {
  const database = new DatabaseSync(':memory:');
  const directory = new URL('../migrations/', import.meta.url);
  for (const filename of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    database.exec(readFileSync(new URL(filename, directory), 'utf8'));
  }
  const DB = {
    prepare: (sql) => statementFor(database, sql),
    batch: async (statements) => {
      database.exec('BEGIN');
      try {
        const results = [];
        for (const statement of statements) {
          results.push(await statement.run());
        }
        database.exec('COMMIT');
        return results;
      } catch (error) {
        database.exec('ROLLBACK');
        throw error;
      }
    },
  };
  return {
    database,
    env: { DB, DISCORD_CLIENT_ID: '123456789', DISCORD_CLIENT_SECRET: testSecret },
  };
}

export function mockDiscord(origin) {
  const upstreamFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== 'https://discord.com') {
      return upstreamFetch(input, init);
    }
    const request = new Request(input, init);
    assert.equal(request.redirect, 'manual', 'Requisições OAuth2 com credenciais devem rejeitar redirecionamentos sem segui-los.');
    if (url.pathname === '/api/oauth2/token') {
      assert.equal(request.method, 'POST');
      const fields = await request.formData();
      assert.equal(fields.get('client_id'), '123456789');
      assert.equal(fields.get('client_secret'), testSecret);
      assert.equal(fields.get('grant_type'), 'authorization_code');
      assert.equal(fields.get('redirect_uri'), origin + '/api/auth/discord/callback');
      const code = fields.get('code');
      if (code === 'client-rejected') return Response.json({ error: 'invalid_client' }, { status: 401 });
      if (code === 'token-unavailable') {
        return Response.json({ error: 'upstream_failure', error_description: 'Detalhe bruto de teste' }, { status: 502 });
      }
      return people.has(code) || code === 'profile-unavailable'
        ? Response.json({ access_token: code, token_type: 'Bearer' })
        : Response.json({ error: 'invalid_grant' }, { status: 400 });
    }
    if (url.pathname === '/api/users/@me' || url.pathname === '/api/v10/users/@me') {
      const code = request.headers.get('Authorization')?.replace(/^Bearer /, '');
      const user = people.get(code);
      return user ? Response.json({ ...user, avatar: null }) : new Response(null, { status: 401 });
    }
    throw new Error('Chamada inesperada ao Discord de teste: ' + url.pathname);
  };
  return () => { globalThis.fetch = upstreamFetch; };
}

const paths = new Map([
  ['/api/session', 'session.js'],
  ['/api/resume', 'resume.js'],
  ['/api/public-resume', 'public-resume.js'],
  ['/api/auth/logout', 'auth/logout.js'],
  ['/api/auth/discord', 'auth/discord.js'],
  ['/api/auth/discord/callback', 'auth/discord/callback.js'],
  ['/api/status', 'status.js'],
]);

export async function callFunction(request, env) {
  const path = paths.get(new URL(request.url).pathname);
  if (!path) return new Response(null, { status: 404 });
  const { onRequest } = await import(new URL('../functions/api/' + path, import.meta.url));
  return onRequest({ request, env, params: {}, data: {} });
}
