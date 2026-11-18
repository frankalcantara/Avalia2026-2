import { readFile, writeFile } from 'node:fs/promises';

const migration = await readFile(new URL('../migrations/0001_acervo.sql', import.meta.url), 'utf8');
const statements = migration.trim().split(/;\s*(?:\n|$)/).filter(Boolean);
const moduleText = '// Gerado a partir de migrations/0001_acervo.sql por scripts/gerar-schema.mjs.\n'
  + 'export const schemaStatements = ' + JSON.stringify(statements, null, 2) + ';\n';
await writeFile(new URL('../lib/schema-statements.js', import.meta.url), moduleText);
