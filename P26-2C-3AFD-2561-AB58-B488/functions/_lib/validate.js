// Validação das regras de negócio. Roda no servidor (Cloudflare Functions)
// e é importada pelos testes em Node, por isso não depende de APIs da Cloudflare.

export const LIMITS = { text: 2000, author: 200, work: 300, page: 30, theme: 80, notes: 2000 };

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

export function validateQuote(input) {
  const errors = {};
  const body = input && typeof input === 'object' ? input : {};

  const text = clean(body.text);
  const author = clean(body.author);
  const work = clean(body.work);
  const page = clean(typeof body.page === 'number' ? String(body.page) : body.page);
  const theme = clean(body.theme) || '';
  const notes = clean(body.notes) || '';

  for (const [field, value] of [['text', text], ['author', author], ['work', work], ['page', page]]) {
    if (typeof value !== 'string' || value.length === 0) errors[field] = 'Campo obrigatório.';
  }
  for (const [field, value] of [['text', text], ['author', author], ['work', work], ['page', page], ['theme', theme], ['notes', notes]]) {
    if (typeof value === 'string' && value.length > LIMITS[field]) {
      errors[field] = `Máximo de ${LIMITS[field]} caracteres.`;
    }
  }
  if (body.theme != null && typeof body.theme !== 'string') errors.theme = 'Tema inválido.';
  if (body.notes != null && typeof body.notes !== 'string') errors.notes = 'Anotação inválida.';
  if (body.is_public != null && typeof body.is_public !== 'boolean') errors.is_public = 'Valor inválido.';

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { text, author, work, page, theme, notes, is_public: body.is_public === true ? 1 : 0 } };
}

// Escapa curingas do LIKE para a busca não ser manipulada pelo usuário.
export function likePattern(q) {
  const s = String(q ?? '').trim().slice(0, 100).replace(/[\\%_]/g, (c) => '\\' + c);
  return `%${s}%`;
}
