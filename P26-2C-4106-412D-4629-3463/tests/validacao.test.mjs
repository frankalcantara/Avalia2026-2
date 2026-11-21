import test from 'node:test';
import assert from 'node:assert/strict';
import { validarCodigo, validarDisciplina, validarAviso, validarEstado, validarId, dataValida } from '../functions/_lib/validacao.js';

test('código de disciplina é normalizado e validado', () => {
  assert.deepEqual(validarCodigo(' eng-soft '), { ok: true, valor: 'ENG-SOFT' });
  for (const ruim of ['', 'a', '-ABC', 'AB CD', 'AB;DROP', 'X'.repeat(21), null, 42]) {
    assert.equal(validarCodigo(ruim).ok, false, `deveria rejeitar ${JSON.stringify(ruim)}`);
  }
});

test('disciplina exige código e nome', () => {
  assert.equal(validarDisciplina({ codigo: 'BD1', nome: 'Banco de Dados' }).ok, true);
  assert.equal(validarDisciplina({ codigo: 'BD1', nome: 'ab' }).ok, false);
  assert.equal(validarDisciplina(null).ok, false);
});

test('aviso: campos por tipo', () => {
  const base = { disciplina: 'bd1', titulo: 'Prova adiada' };
  assert.equal(validarAviso({ ...base, tipo: 'aviso', corpo: 'Sexta-feira' }).ok, true);
  assert.equal(validarAviso({ ...base, tipo: 'aviso', corpo: '' }).ok, false);
  assert.equal(validarAviso({ ...base, tipo: 'link', url: 'https://exemplo.com/x' }).ok, true);
  assert.equal(validarAviso({ ...base, tipo: 'link', url: 'javascript:alert(1)' }).ok, false);
  assert.equal(validarAviso({ ...base, tipo: 'link', url: '' }).ok, false);
  assert.equal(validarAviso({ ...base, tipo: 'lembrete', corpo: 'Trabalho 2', prazo: '2026-12-05' }).ok, true);
  assert.equal(validarAviso({ ...base, tipo: 'lembrete', corpo: 'Trabalho 2', prazo: '2026-02-31' }).ok, false);
  assert.equal(validarAviso({ ...base, tipo: 'lembrete', corpo: 'x', prazo: '' }).ok, false);
  assert.equal(validarAviso({ ...base, tipo: 'outro', corpo: 'x' }).ok, false);
  assert.equal(validarAviso({ ...base, titulo: 'ab', tipo: 'aviso', corpo: 'x' }).ok, false);
  assert.equal(validarAviso({ ...base, tipo: 'aviso', corpo: 'x'.repeat(2001) }).ok, false);
});

test('aviso ignora campos de autoria enviados pelo cliente', () => {
  const r = validarAviso({ disciplina: 'BD1', titulo: 'Olá', tipo: 'aviso', corpo: 'x', autor_id: '999', autor_nome: 'Falso' });
  assert.equal(r.ok, true);
  assert.equal('autor_id' in r.valor, false);
  assert.equal('autor_nome' in r.valor, false);
});

test('estado individual aceita só booleanos', () => {
  assert.equal(validarEstado({ lido: true }).ok, true);
  assert.equal(validarEstado({ fixado: false, lido: true }).ok, true);
  assert.equal(validarEstado({ lido: 'sim' }).ok, false);
  assert.equal(validarEstado({}).ok, false);
});

test('id e data', () => {
  assert.equal(validarId('12').ok, true);
  for (const ruim of ['0', '-1', '1.5', 'abc', '']) assert.equal(validarId(ruim).ok, false);
  assert.equal(dataValida('2024-02-29'), true);
  assert.equal(dataValida('2026-02-29'), false);
});
