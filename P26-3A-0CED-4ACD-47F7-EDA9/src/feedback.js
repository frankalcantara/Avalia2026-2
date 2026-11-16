// Cálculo do retorno de cada chute (com tratamento de letras repetidas)
export function letterFeedback(answer, guess) {
  const result = new Array(guess.length).fill("absent");
  const remaining = {};
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) result[i] = "correct";
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i++) {
    if (result[i] !== "correct" && remaining[guess[i]] > 0) {
      result[i] = "present";
      remaining[guess[i]]--;
    }
  }
  return result;
}

// Modo sombra: só as contagens por linha
export function countFeedback(answer, guess) {
  const letters = letterFeedback(answer, guess);
  return {
    exact: letters.filter((f) => f === "correct").length,
    misplaced: letters.filter((f) => f === "present").length,
  };
}

export function computeFeedback(kind, answer, guess) {
  return kind === "counts" ? countFeedback(answer, guess) : letterFeedback(answer, guess);
}

export function isWinningFeedback(kind, feedback, length = 5) {
  if (kind === "counts") return feedback.exact === length;
  return feedback.every((f) => f === "correct");
}
