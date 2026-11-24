import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQuote, likePattern, LIMITS } from '../functions/_lib/validate.js';

const valid = { text: 'Conhece-te a ti mesmo.', author: 'Sócrates', work: 'Apologia', page: '21' };

test('aceita citação válida e normaliza espaços', () => {
  const r = validateQuote({ ...valid, text: '  oi  ', is_public: true });
  assert.equal(r.ok, true);
  assert.equal(r.value.text, 'oi');
  assert.equal(r.value.is_public, 1);
});

test('citação é privada por padrão', () => {
  assert.equal(validateQuote(valid).value.is_public, 0);
});

test('campos obrigatórios ausentes geram erro', () => {
  const r = validateQuote({});
  assert.equal(r.ok, false);
  for (const f of ['text', 'author', 'work', 'page']) assert.ok(r.errors[f], f);
});

test('rejeita só espaços e limites excedidos', () => {
  assert.equal(validateQuote({ ...valid, author: '   ' }).ok, false);
  assert.equal(validateQuote({ ...valid, text: 'a'.repeat(LIMITS.text + 1) }).ok, false);
  assert.equal(validateQuote({ ...valid, theme: 'a'.repeat(LIMITS.theme + 1) }).ok, false);
});

test('rejeita tipos inesperados', () => {
  assert.equal(validateQuote({ ...valid, is_public: 'sim' }).ok, false);
  assert.equal(validateQuote({ ...valid, notes: 123 }).ok, false);
  assert.equal(validateQuote(null).ok, false);
});

test('página numérica é convertida em texto', () => {
  assert.equal(validateQuote({ ...valid, page: 42 }).value.page, '42');
});

test('likePattern escapa curingas', () => {
  assert.equal(likePattern('50%_a'), '%50\\%\\_a%');
});
