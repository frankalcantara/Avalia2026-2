import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BADGES } from '../functions/_lib/badges.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const KEY = 'P26-2A-1287-4690-B0AE-03F3';

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

test('sem innerHTML/outerHTML/insertAdjacentHTML/document.write/eval no frontend e backend', () => {
  const files = [...walk(join(root, 'public')), ...walk(join(root, 'functions'))].filter((f) => /\.(js|html)$/.test(f));
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.doesNotMatch(src, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function\(/, f);
  }
});

test('sem frameworks (CDN/imports/package.json)', () => {
  const html = read('public/index.html');
  const js = read('public/js/app.js');
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(html + js, /react|vue|angular|svelte|jquery|alpine|htmx/i);
  assert.doesNotMatch(js, /^\s*import\s/m);
  if (existsSync(join(root, 'package.json'))) {
    const p = JSON.parse(read('package.json'));
    const deps = Object.keys({ ...p.dependencies, ...p.devDependencies });
    assert.deepEqual(deps.filter((d) => /react|vue|angular|svelte|jquery|preact|solid/.test(d)), []);
  }
});

test('chave no rodapé do index.html e no README', () => {
  const html = read('public/index.html');
  const footer = html.match(/<footer[\s\S]*?<\/footer>/);
  assert.ok(footer, 'rodapé ausente');
  assert.ok(footer[0].includes(KEY));
  assert.ok(read('README.md').includes(KEY));
});

test('LICENSE MIT', () => {
  const l = read('LICENSE');
  assert.match(l, /^MIT License/);
  assert.match(l, /Permission is hereby granted, free of charge/);
});

test('chamadas fetch de app.js casam com a API real', () => {
  const js = read('public/js/app.js');
  const paths = [...js.matchAll(/api\(\s*'(\/api\/[^'?]*)/g)].map((m) => m[1]);
  const expected = ['/api/kudos', '/api/auth/logout', '/api/me', '/api/users', '/api/badges'];
  for (const p of expected) {
    assert.ok(paths.includes(p), `app.js não chama ${p}`);
    assert.ok(existsSync(join(root, 'functions', p.replace(/^\/api/, 'api') + '.js')), `handler ausente para ${p}`);
  }
  for (const p of paths) assert.ok(expected.includes(p), `rota desconhecida ${p}`);
  assert.match(js, /method: 'POST'[^)]*body: \{ to_user_id: to, badge: badge, message: message \}/);
  assert.match(js, /'\/api\/auth\/logout', \{ method: 'POST' \}/);
  assert.match(read('public/index.html'), /href="\/api\/auth\/login"/);
  // query params usados na listagem
  for (const q of ['filter', 'limit', 'user', 'before']) assert.ok(js.includes(`'${q}'`) || js.includes(`${q}:`), q);
  // campos lidos da resposta existem no contrato
  for (const f of ['badge_emoji', 'badge_label', 'message', 'created_at', 'from', 'to']) assert.ok(js.includes(f), f);
});

test('selos do backend = 6 e ids únicos', () => {
  assert.equal(BADGES.length, 6);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, 6);
});
