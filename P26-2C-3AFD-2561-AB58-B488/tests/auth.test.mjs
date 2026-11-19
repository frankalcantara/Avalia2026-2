import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, readSessionToken, parseCookies } from '../functions/_lib/auth.js';

const SECRET = 'segredo-de-teste';

test('token válido é aceito', async () => {
  const t = await createSessionToken(SECRET, '123');
  assert.equal((await readSessionToken(SECRET, t)).uid, '123');
});

test('segredo diferente invalida o token', async () => {
  const t = await createSessionToken(SECRET, '123');
  assert.equal(await readSessionToken('outro', t), null);
});

test('token adulterado é rejeitado', async () => {
  const t = await createSessionToken(SECRET, '123');
  const [p, s] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ uid: '999', exp: 9999999999 })).toString('base64url');
  assert.equal(await readSessionToken(SECRET, `${forged}.${s}`), null);
  assert.equal(await readSessionToken(SECRET, `${p}.xxxx`), null);
});

test('token expirado é rejeitado', async () => {
  const t = await createSessionToken(SECRET, '123', Date.now() - 8 * 24 * 3600 * 1000);
  assert.equal(await readSessionToken(SECRET, t), null);
});

test('lixo não quebra o parser', async () => {
  assert.equal(await readSessionToken(SECRET, undefined), null);
  assert.equal(await readSessionToken(SECRET, 'abc'), null);
  assert.deepEqual(parseCookies('a=1; b=2'), { a: '1', b: '2' });
});
