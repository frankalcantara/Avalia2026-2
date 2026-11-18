import { failure } from './auth.js';

export const selectQuotes = `SELECT q.id, q.text, q.author, q.source, q.kind, q.page,
  q.theme, q.note, q.visibility, q.created_at, u.username, u.avatar
  FROM quotes q JOIN discord_users u ON u.user_id = q.user_id`;

export function unavailable() {
  return failure(503, 'database_unavailable', 'O acervo está indisponível. Tente novamente em instantes.');
}

const limits = { text: 3000, author: 160, source: 240, page: 40, theme: 100, note: 2000 };
const allowed = new Set([...Object.keys(limits), 'kind', 'visibility']);

export function validateQuote(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.has(key))) return null;
  if (!['livro', 'artigo', 'palestra'].includes(input.kind) ||
      !['public', 'private'].includes(input.visibility)) return null;

  const quote = { kind: input.kind, visibility: input.visibility };
  for (const [field, maxLength] of Object.entries(limits)) {
    const optional = field === 'note' || (field === 'page' && input.kind === 'palestra');
    let value = input[field];
    if (optional && value === undefined) value = '';
    if (field === 'page' && Number.isSafeInteger(value) && value > 0) value = String(value);
    if (typeof value !== 'string') return null;
    value = value.trim();
    if (value.length > maxLength || value.includes('\0') || (!optional && !value)) return null;
    quote[field] = value;
  }
  return quote;
}
