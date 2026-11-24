import { schemaStatements } from './schema-statements.js';

// Todas as instruções são idempotentes. D1 garante atomicidade do batch.
export async function withSchema(db, query) {
  try {
    return await query();
  } catch (error) {
    const missing = /no such table:\s*(?:main\.)?(?:quotes|discord_users)\b/i;
    if (!missing.test(error?.message) && !missing.test(error?.cause?.message)) throw error;
    const results = await db.batch(schemaStatements.map(sql => db.prepare(sql)));
    if (results.some(result => result.success === false)) throw new Error('Falha ao criar tabelas do acervo.');
    return query();
  }
}
