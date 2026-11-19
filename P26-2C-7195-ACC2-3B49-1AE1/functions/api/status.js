import { json } from '../../lib/http.js';

const PROJECT_KEY = 'P26-2C-7195-ACC2-3B49-1AE1';

// GET /api/status — verificação de saúde (público): confirma que as Functions e o D1 respondem.
export async function onRequestGet({ env }) {
  let db = 'ok';
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
  } catch {
    db = 'erro';
  }
  return json({ status: db === 'ok' ? 'ok' : 'degradado', projeto: 'Rastreador de Hábitos', chave: PROJECT_KEY, db });
}
