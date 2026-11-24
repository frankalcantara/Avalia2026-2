// Gera db/seed.sql a partir de db/questions.mjs.  Uso: npm run seed:gen
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { categories, questions } from '../db/questions.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => `'${String(s).replace(/'/g, "''")}'`;
const TIME_LIMIT_MS = 15000;

const lines = ['-- GERADO por scripts/gen-seed.mjs — não edite à mão. Chave: P26-2B-4459-132C-62BC-7492', ''];

for (const c of categories) {
  lines.push(
    `INSERT INTO categories (id, name, description) VALUES (${esc(c.id)}, ${esc(c.name)}, ${esc(c.description)}) ` +
      'ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description;',
  );
}
lines.push('');

const counters = {};
for (const q of questions) {
  if (!categories.some((c) => c.id === q.c)) throw new Error(`categoria desconhecida: ${q.c}`);
  if (q.bad.length !== 3) throw new Error(`pergunta precisa de 3 alternativas incorretas: ${q.t}`);
  const n = (counters[q.c] = (counters[q.c] ?? 0) + 1);
  const id = `${q.c}-${String(n).padStart(2, '0')}`;
  const pos = (n * 3 + 1) % 4; // posição determinística (varia entre perguntas) da correta no banco
  const options = q.bad.slice();
  options.splice(pos, 0, q.ok);
  if (new Set(options).size !== 4) throw new Error(`alternativas repetidas: ${q.t}`);
  lines.push(
    'INSERT INTO questions (id, category_id, text, options, correct_index, time_limit_ms) VALUES ' +
      `(${esc(id)}, ${esc(q.c)}, ${esc(q.t)}, ${esc(JSON.stringify(options))}, ${pos}, ${TIME_LIMIT_MS}) ` +
      'ON CONFLICT(id) DO UPDATE SET category_id = excluded.category_id, text = excluded.text, ' +
      'options = excluded.options, correct_index = excluded.correct_index, time_limit_ms = excluded.time_limit_ms;',
  );
}

mkdirSync(join(root, 'db'), { recursive: true });
writeFileSync(join(root, 'db', 'seed.sql'), lines.join('\n') + '\n');
console.log(`db/seed.sql gerado: ${categories.length} categorias, ${questions.length} questões`);
