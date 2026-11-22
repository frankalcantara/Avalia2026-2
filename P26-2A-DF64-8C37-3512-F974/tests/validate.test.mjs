// Testes das regras de validação de entrada e utilitários HTTP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, validateDeckInput, validateCardInput, validateCardBatch, LIMITS } from '../functions/_lib/validate.js';
import { HttpError, parseId, parseCookies, serializeCookie } from '../functions/_lib/http.js';
import { safeEqual, sha256Hex, randomToken, avatarUrl } from '../functions/_lib/session.js';

test('cleanText remove controle e espaços, mantém quebras de linha', () => {
  assert.equal(cleanText('  oi\u0000 mundo \r\n linha2 '), 'oi mundo \n linha2');
  assert.equal(cleanText(42), '');
});

test('baralho: nome obrigatório e limites', () => {
  assert.deepEqual(validateDeckInput({ name: ' Inglês ', description: ' verbos ' }), { name: 'Inglês', description: 'verbos' });
  assert.throws(() => validateDeckInput({ name: '   ' }), HttpError);
  assert.throws(() => validateDeckInput({ name: 'x'.repeat(LIMITS.DECK_NAME_MAX + 1) }), HttpError);
  assert.throws(() => validateDeckInput({ name: 'ok', description: 'x'.repeat(LIMITS.DECK_DESC_MAX + 1) }), HttpError);
});

test('cartão: frente e verso obrigatórios', () => {
  assert.deepEqual(validateCardInput({ front: 'dog', back: 'cachorro' }), { front: 'dog', back: 'cachorro' });
  assert.throws(() => validateCardInput({ front: 'dog', back: '' }), HttpError);
  assert.throws(() => validateCardInput({ front: { x: 1 }, back: 'y' }), HttpError);
  assert.throws(() => validateCardInput({ front: 'a'.repeat(LIMITS.CARD_TEXT_MAX + 1), back: 'b' }), HttpError);
});

test('importação em lote', () => {
  assert.equal(validateCardBatch({ cards: [{ front: 'a', back: 'b' }, { front: 'c', back: 'd' }] }).length, 2);
  assert.equal(validateCardBatch({ front: 'a', back: 'b' }).length, 1);
  assert.throws(() => validateCardBatch({ cards: [] }), HttpError);
  const many = Array.from({ length: LIMITS.CARDS_PER_REQUEST + 1 }, () => ({ front: 'a', back: 'b' }));
  assert.throws(() => validateCardBatch({ cards: many }), HttpError);
  assert.throws(() => validateCardBatch({ cards: [{ front: 'a', back: 'b' }, { front: '', back: 'x' }] }), /Cartão 2/);
});

test('parseId aceita apenas inteiros positivos', () => {
  assert.equal(parseId('12'), 12);
  assert.equal(parseId(7), 7);
  for (const bad of ['0', '-1', '1.5', 'abc', '1 OR 1=1', '', null, undefined, '9999999999999']) {
    assert.equal(parseId(bad), null, String(bad));
  }
});

test('cookies', () => {
  const req = new Request('https://x.dev', { headers: { cookie: 'sid=abc%3D; oauth_state=xyz' } });
  assert.deepEqual(parseCookies(req), { sid: 'abc=', oauth_state: 'xyz' });
  const c = serializeCookie('sid', 'tok', { maxAge: 60 });
  assert.match(c, /HttpOnly/);
  assert.match(c, /Secure/);
  assert.match(c, /SameSite=Lax/);
  assert.match(c, /Max-Age=60/);
});

test('sessão: token aleatório, hash e comparação', async () => {
  const a = randomToken(32);
  const b = randomToken(32);
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/);
  assert.equal((await sha256Hex('abc')).length, 64);
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.ok(safeEqual('abc', 'abc'));
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'ab'), false);
});

test('avatar do Discord (personalizado, animado e padrão)', () => {
  assert.equal(avatarUrl({ id: '80351110224678912', avatar: '8342729096ea3675442027381ff50dfe' }),
    'https://cdn.discordapp.com/avatars/80351110224678912/8342729096ea3675442027381ff50dfe.png?size=128');
  assert.match(avatarUrl({ id: '1', avatar: 'a_8342729096ea3675442027381ff50dfe' }), /\.gif\?size=128$/);
  assert.match(avatarUrl({ id: '80351110224678912', avatar: null }), /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png$/);
});
