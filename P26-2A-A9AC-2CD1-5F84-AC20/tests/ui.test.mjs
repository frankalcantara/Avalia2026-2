import fs from 'node:fs';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
// Teste da interface com DOM simulado (Agente 3). Uso: node tests/ui.test.mjs
class N {
  constructor(tag = 'div') { this.tag = tag; this.children = []; this.attrs = {}; this.style = {}; this.listeners = {}; this._t = ''; this.hidden = false; this.value = ''; this.className = ''; this.checked = false; this.disabled = false; this.src = ''; }
  set textContent(v) { this._t = String(v); this.children = []; if (this.tag === 'select' || this.tag === 'option') {} }
  get textContent() { return this._t + this.children.map((c) => c.textContent).join(''); }
  append(...n) { this.children.push(...n); if (this.tag === 'select' && this.children.length === 1) this.value = n[0].value; }
  replaceChildren(...n) { this.children = []; this._t = ''; if (this.tag === 'select') this.value = ''; if (n.length) this.append(...n); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  setAttribute(k, v) { this.attrs[k] = v; }
  scrollIntoView() {} focus() {}
  async fire(t, ev = {}) { for (const f of this.listeners[t] || []) await f({ preventDefault() {}, ...ev }); }
}
const ids = ['uid','list-note','login','login-error','app','avatar','username','logout','net','income','expense','tx-form','form-title','amount','date','category','description','form-error','save','cancel','chart-total','chart','f-month','f-category','f-clear','empty','table-wrap','rows','toast'];
const els = Object.fromEntries(ids.map((i) => [i, new N(i.includes('category') ? 'select' : 'div')]));
els['tx-form'].reset = () => { radios[0].checked = true; radios[1].checked = false; ['amount','date','description'].forEach((k) => els[k].value = ''); els['f-month'].value = els['f-month'].value; };
const radios = [Object.assign(new N('input'), { value: 'despesa', checked: true }), Object.assign(new N('input'), { value: 'receita' })];
radios.forEach((r) => { const orig = r.checked; });
globalThis.document = {
  getElementById: (i) => els[i],
  createElement: (t) => new N(t),
  querySelector: (q) => q.includes(':checked') ? radios.find((r) => r.checked) : radios.find((r) => q.includes(`[value="${r.value}"]`)),
  querySelectorAll: () => radios,
};
// rádios exclusivos
radios.forEach((r) => Object.defineProperty(r, 'checked', { get() { return this._c ?? false; }, set(v) { if (v) radios.forEach((o) => { o._c = false; }); this._c = v; } }));
radios[0].checked = true;
globalThis.location = { search: '?erro=negado', pathname: '/' };
globalThis.history = { replaceState() {} };
globalThis.confirm = () => true;

let db = [], nextId = 1, loggedIn = true, calls = [];
globalThis.fetch = async (url, init = {}) => {
  const method = init.method || 'GET'; calls.push(method + ' ' + url);
  const R = (d, s = 200) => new Response(JSON.stringify(d), { status: s });
  if (url === '/api/me') return loggedIn ? R({ user: { id: '1', username: 'Gabriel', avatar_url: 'http://a/x.png' }, categories: { receita: ['Salário', 'Outros'], despesa: ['Alimentação', 'Lazer', 'Outros'] } }) : R({ error: 'x' }, 401);
  if (url.startsWith('/api/transactions') && method === 'GET') {
    const q = new URLSearchParams(url.split('?')[1]); let items = db;
    if (q.get('month')) items = items.filter((t) => t.date.startsWith(q.get('month')));
    if (q.get('category')) items = items.filter((t) => t.category === q.get('category'));
    const inc = db.filter((t) => t.type === 'receita').reduce((a, t) => a + t.amount_cents, 0), exp = db.filter((t) => t.type === 'despesa').reduce((a, t) => a + t.amount_cents, 0);
    const g = {}; for (const t of items) if (t.type === 'despesa') g[t.category] = (g[t.category] || 0) + t.amount_cents;
    const byCategory = Object.entries(g).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
    return R({ items, truncated: false, byCategory, balance: { income: inc, expense: exp, net: inc - exp } });
  }
  if (method === 'POST' && url === '/api/transactions') { const b = JSON.parse(init.body); db.push({ id: nextId++, ...b, amount_cents: Math.round(parseFloat(b.amount.replace(/\./g, '').replace(',', '.')) * 100) }); return R({ id: 1 }, 201); }
  if (method === 'PUT') { const b = JSON.parse(init.body); const t = db.find((x) => x.id === +url.split('/').pop()); Object.assign(t, b, { amount_cents: Math.round(parseFloat(b.amount.replace(/\./g, '').replace(',', '.')) * 100) }); return R({}); }
  if (method === 'DELETE') { db = db.filter((x) => x.id !== +url.split('/').pop()); return R({ ok: true }); }
  if (url === '/api/auth/logout') return R({ ok: true });
};
const wait = () => new Promise((r) => setTimeout(r, 20));
const src = fs.readFileSync(fileURLToPath(new URL('../public/app.js', import.meta.url)), 'utf8').replace("'use strict';", '');
(0, eval)(src);
await wait();

assert.equal(els.app.hidden, false); assert.equal(els.login.hidden, true);
assert.equal(els.username.textContent, 'Gabriel'); assert.equal(els.uid.textContent, 'ID 1'); assert.equal(els['list-note'].hidden, true);
assert.equal(els.empty.hidden, false); assert.equal(els['table-wrap'].hidden, true);
assert.equal(els['f-category'].children.length, 5); // todas + união sem duplicar "Outros"
assert.equal(els.category.value, 'Alimentação'); assert.ok(els.date.value.match(/^\d{4}-\d{2}-\d{2}$/));

const submit = () => els['tx-form'].fire('submit');
// inválido
els.amount.value = 'abc'; await submit();
assert.equal(els['form-error'].hidden, false); assert.ok(!calls.some((c) => c.startsWith('POST')));
// despesas
els.amount.value = '30,00'; els.description.value = 'Mercado'; await submit(); await wait();
els.amount.value = '10'; els.category.value = 'Lazer'; els.date.value = '2026-10-02'; await submit(); await wait();
assert.equal(els.rows.children.length, 2);
assert.equal(els['form-error'].hidden, true); assert.equal(els.amount.value, '');
// receita: troca categorias
radios[1].checked = true; await Promise.all(document.querySelectorAll().map((r) => r.fire('change')));
assert.deepEqual(els.category.children.map((c) => c.value), ['Salário', 'Outros']);
els.amount.value = '1.000,00'; await submit(); await wait();
assert.equal(els.rows.children.length, 3);
assert.match(els.net.textContent, /960,00/); assert.equal(els.net.className, '');
// gráfico: só despesas, 75% / 25%
assert.equal(els.chart.children.length, 2);
const pct = els.chart.children.map((row) => row.children[1].children[0].style.width);
assert.deepEqual(pct, ['75.0%', '25.0%']);
assert.match(els['chart-total'].textContent, /40,00/);
// filtros
els['f-category'].value = 'Lazer'; await els['f-category'].fire('change'); await wait();
assert.equal(els.rows.children.length, 1); assert.match(els.net.textContent, /960,00/);
await els['f-clear'].fire('click'); await wait(); assert.equal(els.rows.children.length, 3);
els['f-month'].value = '2026-10'; await els['f-month'].fire('change'); await wait(); assert.equal(els.rows.children.length, 1);
await els['f-clear'].fire('click'); await wait();
// editar
const editBtn = els.rows.children[2].children[4].children[0];
await editBtn.fire('click');
assert.equal(els['form-title'].textContent, 'Editar transação'); assert.equal(els.cancel.hidden, false);
assert.equal(els.amount.value, '1.000,00'); assert.equal(els.category.value, 'Salário');
els.amount.value = '1200,50'; await submit(); await wait();
assert.match(els.income.textContent, /1\.200,50/); assert.equal(els['form-title'].textContent, 'Nova transação');
// cancelar edição
await els.rows.children[0].children[4].children[0].fire('click'); await els.cancel.fire('click');
assert.equal(els['save'].textContent, 'Adicionar'); assert.equal(els.cancel.hidden, true);
// excluir
await els.rows.children[0].children[4].children[1].fire('click'); await wait();
assert.equal(els.rows.children.length, 2);
// valor reformatado ao sair do campo
els.amount.value = '10500'; await els.amount.fire('blur'); assert.equal(els.amount.value, '10.500,00');
els.amount.value = 'abc'; await els.amount.fire('blur'); assert.equal(els.amount.value, 'abc');
// mês inválido não consulta o servidor
const antes = calls.length; els['f-month'].value = '2026-1'; await els['f-month'].fire('change'); await wait();
assert.equal(calls.length, antes); assert.match(els.toast.textContent, /AAAA-MM/); els['f-month'].value = '';
// logout
await els.logout.fire('click'); assert.equal(els.login.hidden, false); assert.equal(els.app.hidden, true);
console.log('UI OK');
