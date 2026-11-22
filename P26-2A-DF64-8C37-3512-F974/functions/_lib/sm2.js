// Algoritmo simplificado de repetição espaçada inspirado no SuperMemo SM-2.
//
// Mapeamento dos botões de autoavaliação para a "qualidade" q do SM-2:
//   Difícil -> q = 3   (lembrou com muito esforço)
//   Bom     -> q = 4   (lembrou com alguma hesitação)
//   Fácil   -> q = 5   (lembrou sem esforço)
//
// Fator de facilidade (EF), fórmula original do SM-2:
//   EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),  com EF' >= 1.3
//   => Difícil: -0.14 · Bom: 0 · Fácil: +0.10
//
// Intervalo em dias até a próxima aparição:
//   1ª revisão (repetições = 0): Difícil 1 · Bom 1 · Fácil 4
//   2ª revisão (repetições = 1): Difícil 3 · Bom 6 · Fácil 8
//   demais:   Difícil I * 1.2 · Bom I * EF' · Fácil I * EF' * 1.3
//   (sempre pelo menos I + 1 e no máximo 3650 dias)
//
// Este módulo é puro (sem I/O), então roda tanto na Cloudflare Function
// quanto nos testes automatizados com `node --test`.

export const RATINGS = Object.freeze({ hard: 3, good: 4, easy: 5 });
export const DEFAULT_EASE = 2.5;
export const MIN_EASE = 1.3;
export const HARD_FACTOR = 1.2;
export const EASY_BONUS = 1.3;
export const MAX_INTERVAL = 3650;

export function isValidRating(rating) {
  return typeof rating === 'string' && Object.prototype.hasOwnProperty.call(RATINGS, rating);
}

export function nextEase(ease, quality) {
  const base = Number.isFinite(ease) ? ease : DEFAULT_EASE;
  const d = 5 - quality;
  const updated = base + (0.1 - d * (0.08 + d * 0.02));
  return Math.max(MIN_EASE, Math.round(updated * 100) / 100);
}

/**
 * Calcula o novo estado de um cartão após uma avaliação.
 * @param {{ease_factor?: number, interval_days?: number, repetitions?: number}} card
 * @param {'hard'|'good'|'easy'} rating
 * @returns {{ease_factor: number, interval_days: number, repetitions: number, quality: number}}
 */
export function schedule(card, rating) {
  if (!isValidRating(rating)) {
    throw new RangeError(`Avaliação inválida: ${rating}`);
  }
  const quality = RATINGS[rating];
  const ease = Number(card?.ease_factor);
  const repetitions = Math.max(0, Math.floor(Number(card?.repetitions) || 0));
  const previous = Math.max(0, Math.floor(Number(card?.interval_days) || 0));
  const newEase = nextEase(ease, quality);

  let interval;
  if (repetitions === 0) {
    interval = rating === 'easy' ? 4 : 1;
  } else if (repetitions === 1) {
    interval = rating === 'hard' ? 3 : rating === 'good' ? 6 : 8;
  } else {
    const base = Math.max(previous, 1);
    const factor =
      rating === 'hard' ? HARD_FACTOR : rating === 'good' ? newEase : newEase * EASY_BONUS;
    interval = Math.max(base + 1, Math.round(base * factor));
  }

  return {
    ease_factor: newEase,
    interval_days: Math.min(interval, MAX_INTERVAL),
    repetitions: repetitions + 1,
    quality,
  };
}

/** Intervalos previstos para cada botão (exibidos na interface). */
export function preview(card) {
  return {
    hard: schedule(card, 'hard').interval_days,
    good: schedule(card, 'good').interval_days,
    easy: schedule(card, 'easy').interval_days,
  };
}
