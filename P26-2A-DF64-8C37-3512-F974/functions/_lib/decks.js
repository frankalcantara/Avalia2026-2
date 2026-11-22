// Carrega um baralho garantindo que ele pertence ao estudante logado.
import { HttpError, parseId } from './http.js';

export async function loadDeck(db, userId, rawId) {
  const id = parseId(rawId);
  if (!id) throw new HttpError(400, 'Identificador de baralho inválido.', 'invalid_id');
  const deck = await db
    .prepare('SELECT id, name, description, created_at, updated_at FROM decks WHERE id = ? AND user_id = ?')
    .bind(id, userId)
    .first();
  if (!deck) throw new HttpError(404, 'Baralho não encontrado.', 'deck_not_found');
  return deck;
}

/** URL de retorno do OAuth2 do Discord (precisa estar cadastrada no Developer Portal). */
export function redirectUri(request, env) {
  return env.DISCORD_REDIRECT_URI || `${new URL(request.url).origin}/api/auth/discord/callback`;
}
