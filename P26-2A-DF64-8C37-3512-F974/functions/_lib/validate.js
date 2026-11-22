// Regras de validação de entrada (o servidor nunca confia apenas no cliente).
import { HttpError } from './http.js';

export const LIMITS = Object.freeze({
  DECK_NAME_MAX: 80,
  DECK_DESC_MAX: 300,
  CARD_TEXT_MAX: 1000,
  DECKS_PER_USER: 100,
  CARDS_PER_DECK: 2000,
  CARDS_PER_REQUEST: 200,
});

/** Normaliza texto: remove caracteres de controle (exceto \n e \t) e espaços nas pontas. */
export function cleanText(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

export function validateDeckInput(body) {
  const name = cleanText(body?.name);
  const description = cleanText(body?.description ?? '');
  if (name.length < 1) throw new HttpError(422, 'Dê um nome ao baralho.', 'invalid_name');
  if (name.length > LIMITS.DECK_NAME_MAX) {
    throw new HttpError(422, `O nome pode ter no máximo ${LIMITS.DECK_NAME_MAX} caracteres.`, 'invalid_name');
  }
  if (description.length > LIMITS.DECK_DESC_MAX) {
    throw new HttpError(422, `A descrição pode ter no máximo ${LIMITS.DECK_DESC_MAX} caracteres.`, 'invalid_description');
  }
  return { name, description };
}

export function validateCardInput(body) {
  const front = cleanText(body?.front);
  const back = cleanText(body?.back);
  if (front.length < 1 || back.length < 1) {
    throw new HttpError(422, 'Preencha a frente e o verso do cartão.', 'invalid_card');
  }
  if (front.length > LIMITS.CARD_TEXT_MAX || back.length > LIMITS.CARD_TEXT_MAX) {
    throw new HttpError(422, `Cada lado pode ter no máximo ${LIMITS.CARD_TEXT_MAX} caracteres.`, 'invalid_card');
  }
  return { front, back };
}

/** Aceita {front, back} ou {cards: [{front, back}, ...]}. */
export function validateCardBatch(body) {
  const list = Array.isArray(body?.cards) ? body.cards : [body];
  if (list.length === 0) throw new HttpError(422, 'Nenhum cartão enviado.', 'invalid_card');
  if (list.length > LIMITS.CARDS_PER_REQUEST) {
    throw new HttpError(422, `Envie no máximo ${LIMITS.CARDS_PER_REQUEST} cartões por vez.`, 'too_many_cards');
  }
  return list.map((item, i) => {
    try {
      return validateCardInput(item);
    } catch (err) {
      if (list.length > 1 && err instanceof HttpError) {
        throw new HttpError(err.status, `Cartão ${i + 1}: ${err.message}`, err.code);
      }
      throw err;
    }
  });
}
