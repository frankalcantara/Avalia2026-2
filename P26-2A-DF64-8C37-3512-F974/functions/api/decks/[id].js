// GET    /api/decks/:id — dados do baralho.
// PUT    /api/decks/:id — renomeia / altera descrição.
// DELETE /api/decks/:id — exclui o baralho e seus cartões (o histórico de avaliações é preservado).
import { json, nowIso, readJson } from '../../_lib/http.js';
import { validateDeckInput } from '../../_lib/validate.js';
import { loadDeck } from '../../_lib/decks.js';

export async function onRequestGet({ env, params, data }) {
  return json({ deck: await loadDeck(env.DB, data.user.id, params.id) });
}

export async function onRequestPut({ request, env, params, data }) {
  const deck = await loadDeck(env.DB, data.user.id, params.id);
  const { name, description } = validateDeckInput(await readJson(request));
  const updated = await env.DB.prepare(
    `UPDATE decks SET name = ?, description = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
      RETURNING id, name, description, created_at, updated_at`
  )
    .bind(name, description, nowIso(), deck.id, data.user.id)
    .first();
  return json({ deck: updated });
}

export async function onRequestDelete({ env, params, data }) {
  const deck = await loadDeck(env.DB, data.user.id, params.id);
  const db = env.DB;
  // Cartões são apagados; o histórico de avaliações fica (deck_id/card_id viram NULL),
  // preservando a sequência de dias estudados.
  await db.batch([
    db.prepare('DELETE FROM cards WHERE deck_id = ? AND user_id = ?').bind(deck.id, data.user.id),
    db.prepare('DELETE FROM decks WHERE id = ? AND user_id = ?').bind(deck.id, data.user.id),
  ]);
  return json({ ok: true });
}
