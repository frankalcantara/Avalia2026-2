// Pontuação proporcional à velocidade (somente acertos pontuam).
import { MAX_POINTS, MIN_CORRECT_POINTS } from './config.js';

/**
 * @param {number} elapsedMs  tempo medido pelo servidor entre envio da pergunta e recebimento da resposta
 * @param {number} limitMs    limite oficial da pergunta
 * @returns {number} pontos entre MIN_CORRECT_POINTS e MAX_POINTS
 */
export function computePoints(elapsedMs, limitMs) {
  const e = Math.min(Math.max(elapsedMs, 0), limitMs);
  const remainingFraction = 1 - e / limitMs;
  return MIN_CORRECT_POINTS + Math.round((MAX_POINTS - MIN_CORRECT_POINTS) * remainingFraction);
}
