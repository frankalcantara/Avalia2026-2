import { failure, getSession, json, sameOrigin } from '../../lib/auth.js';
import { withSchema } from '../../lib/schema.js';
import { selectQuotes, unavailable, validateQuote } from '../../lib/quotes.js';

export async function onRequestGet({ request, env }) {
  const scope = new URL(request.url).searchParams.get('scope') ?? 'public';
  if (scope !== 'public' && scope !== 'mine') return failure(400, 'invalid_scope', 'Escolha um acervo válido.');
  const user = scope === 'mine' ? await getSession(request, env) : null;
  if (scope === 'mine' && !user) return failure(401, 'unauthenticated', 'Entre com Discord para abrir seu acervo.');
  try {
    const { results, success } = await withSchema(env.DB, () => {
      const statement = user
        ? env.DB.prepare(selectQuotes + ' WHERE q.user_id = ? ORDER BY q.id DESC').bind(user.user_id)
        : env.DB.prepare(selectQuotes + " WHERE q.visibility = 'public' ORDER BY q.id DESC");
      return statement.all();
    });
    if (success === false) return unavailable();
    return json({ quotes: results });
  } catch {
    return unavailable();
  }
}

export async function onRequestPost({ request, env }) {
  const user = await getSession(request, env);
  if (!user) return failure(401, 'unauthenticated', 'Entre com Discord para salvar uma citação.');
  if (!sameOrigin(request)) return failure(403, 'invalid_origin', 'Origem não autorizada.');
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return failure(415, 'invalid_content_type', 'Envie a citação em JSON.');
  }
  const tooLarge = () => failure(413, 'payload_too_large', 'Citação muito longa.');
  const maxBytes = 65536;
  if (Number(request.headers.get('Content-Length')) > maxBytes) return tooLarge();
  let quote;
  try {
    const reader = request.body?.getReader();
    if (!reader) return failure(400, 'invalid_json', 'Envie os dados da citação.');
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let raw = '';
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        return tooLarge();
      }
      raw += decoder.decode(value, { stream: true });
    }
    quote = validateQuote(JSON.parse(raw + decoder.decode()));
  } catch {
    return failure(400, 'invalid_json', 'Não foi possível ler os dados da citação.');
  }
  if (!quote) return failure(400, 'invalid_quote', 'Confira o trecho, a autoria, a obra, a página, o tema e a visibilidade.');
  try {
    const saved = await withSchema(env.DB, () => env.DB.prepare(
      `INSERT INTO quotes (user_id, text, author, source, kind, page, theme, note, visibility)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id, created_at`
    ).bind(user.user_id, quote.text, quote.author, quote.source, quote.kind, quote.page,
      quote.theme, quote.note, quote.visibility).first());
    if (!saved) return unavailable();
    return json({ quote: { ...quote, ...saved, username: user.username, avatar: user.avatar } }, 201);
  } catch {
    return unavailable();
  }
}
