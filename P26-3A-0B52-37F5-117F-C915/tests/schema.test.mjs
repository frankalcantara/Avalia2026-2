import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { withSchema } from '../lib/schema.js';
import { schemaStatements } from '../lib/schema-statements.js';
import { onRequestGet as feed } from '../functions/api/quotes.js';

test('o esquema usado na inicialização corresponde à migração publicada', async () => {
  const migration = await readFile(new URL('../migrations/0001_acervo.sql', import.meta.url), 'utf8');
  assert.equal(schemaStatements.join(';').replace(/\s/g, '') + ';', migration.replace(/\s/g, ''));
});

test('o primeiro acesso cria o acervo, preserva usuários do Projeto 0 e permite a migração via Wrangler depois', async () => {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(schemaStatements[0]);
    sqlite.exec("INSERT INTO discord_users (user_id,username) VALUES ('42','Bruno')");
    let initializations = 0;
    const db = {
      prepare(sql) {
        return {
          all() { return { success: true, results: sqlite.prepare(sql).all() }; },
          run() { sqlite.exec(sql); return { success: true }; },
        };
      },
      batch(statements) {
        initializations++;
        return statements.map(statement => statement.run());
      },
    };
    const context = { request: new Request('https://local.test/api/quotes'), env: { DB: db } };
    for (let i = 0; i < 2; i++) {
      const response = await feed(context);
      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), { quotes: [] });
    }
    assert.equal(initializations, 1);
    sqlite.exec(await readFile(new URL('../migrations/0001_acervo.sql', import.meta.url), 'utf8'));
    assert.equal(sqlite.prepare('SELECT username FROM discord_users').get().username, 'Bruno');
  } finally {
    sqlite.close();
  }
});

test('uma falha de disponibilidade não é tratada como tabela ausente', async () => {
  let runs = 0;
  await assert.rejects(withSchema({}, () => { runs++; throw new Error('D1 offline'); }), /D1 offline/);
  assert.equal(runs, 1);
});
