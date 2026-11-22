// GET /api/study?deck=<id> — fila de estudos de hoje (de um baralho ou de todos).
import { HttpError, json, parseId } from '../_lib/http.js';
import { todayFor } from '../_lib/dates.js';
import { NEW_CARDS_PER_DAY, buildQueue } from '../_lib/queue.js';
import { loadDeck } from '../_lib/decks.js';

export async function onRequestGet({ request, env, data }) {
  const url = new URL(request.url);
  const raw = url.searchParams.get('deck');
  let deck = null;
  if (raw && raw !== 'all') {
    if (!parseId(raw)) throw new HttpError(400, 'Parâmetro "deck" inválido.', 'invalid_id');
    deck = await loadDeck(env.DB, data.user.id, raw);
  }
  const today = todayFor(data);
  const { queue, counts } = await buildQueue(env.DB, data.user.id, today, deck ? deck.id : null);
  return json({
    today,
    deck: deck ? { id: deck.id, name: deck.name } : null,
    new_per_day: NEW_CARDS_PER_DAY,
    counts,
    queue,
  });
}
