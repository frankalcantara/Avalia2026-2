// PUT    /api/cards/:id — edita frente/verso (opcionalmente reinicia o progresso).
// DELETE /api/cards/:id — exclui o cartão.
import { HttpError, json, nowIso, parseId, readJson } from '../../_lib/http.js';
import { validateCardInput } from '../../_lib/validate.js';
import { todayFor } from '../../_lib/dates.js';
import { DEFAULT_EASE } from '../../_lib/sm2.js';

const CARD_COLS = `id, deck_id, front, back, ease_factor, interval_days, repetitions,
                   due_date, last_reviewed_at, created_at, updated_at`;

async function loadCard(db, userId, rawId) {
  const id = parseId(rawId);
  if (!id) throw new HttpError(400, 'Identificador de cartão inválido.', 'invalid_id');
  const card = await db.prepare('SELECT id, deck_id FROM cards WHERE id = ? AND user_id = ?').bind(id, userId).first();
  if (!card) throw new HttpError(404, 'Cartão não encontrado.', 'card_not_found');
  return card;
}

export async function onRequestPut({ request, env, params, data }) {
  const db = env.DB;
  const card = await loadCard(db, data.user.id, params.id);
  const body = await readJson(request);
  const { front, back } = validateCardInput(body);
  const now = nowIso();

  const stmt =
    body.reset_progress === true
      ? db
          .prepare(
            `UPDATE cards SET front = ?, back = ?, ease_factor = ?, interval_days = 0, repetitions = 0,
                    due_date = ?, last_reviewed_at = NULL, updated_at = ?
              WHERE id = ? AND user_id = ? RETURNING ${CARD_COLS}`
          )
          .bind(front, back, DEFAULT_EASE, todayFor(data), now, card.id, data.user.id)
      : db
          .prepare(`UPDATE cards SET front = ?, back = ?, updated_at = ? WHERE id = ? AND user_id = ? RETURNING ${CARD_COLS}`)
          .bind(front, back, now, card.id, data.user.id);

  return json({ card: await stmt.first() });
}

export async function onRequestDelete({ env, params, data }) {
  const db = env.DB;
  const card = await loadCard(db, data.user.id, params.id);
  // O histórico em reviews é preservado (card_id vira NULL), mantendo a cota diária e a sequência.
  await db.prepare('DELETE FROM cards WHERE id = ? AND user_id = ?').bind(card.id, data.user.id).run();
  return json({ ok: true });
}
