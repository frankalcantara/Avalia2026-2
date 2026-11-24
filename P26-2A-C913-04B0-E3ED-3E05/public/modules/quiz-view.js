import { $ } from "./ui.js";

export function renderQuestion(question, categoryName, onAnswer, onTimeout) {
  $("setupPanel").classList.add("hidden");
  $("resultPanel").classList.add("hidden");
  $("quizPanel").classList.remove("hidden");
  $("questionCategory").textContent = categoryName || "Revisão";
  $("questionCount").textContent =
    `Questão ${question.position} de ${question.total}`;
  $("questionText").textContent = question.prompt;
  $("answerFeedback").textContent = "";
  $("answers").replaceChildren();

  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "answer-option";
    button.dataset.optionId = option.id;

    const key = document.createElement("span");
    key.className = "answer-key";
    key.textContent = String.fromCharCode(65 + index);

    const text = document.createElement("span");
    text.className = "answer-text";
    text.textContent = option.text;

    const arrow = document.createElement("span");
    arrow.className = "answer-arrow";
    arrow.setAttribute("aria-hidden", "true");
    arrow.textContent = "↗";

    button.append(key, text, arrow);
    button.addEventListener("click", () => onAnswer(option.id, button));
    $("answers").append(button);
  });

  $("questionText").focus({ preventScroll: true });
  return startTimer(question.timeLimitSeconds, onTimeout);
}

export function stopTimer(timerId) {
  window.clearInterval(timerId);
}

export function setAnswersDisabled(disabled) {
  document.querySelectorAll(".answer-option").forEach((button) => {
    button.disabled = disabled;
  });
}

export function markAnswer(selectedButton, isCorrect, correctOptionId) {
  if (selectedButton) {
    selectedButton.classList.add("selected");
    selectedButton.classList.add(isCorrect ? "is-correct" : "is-wrong");
  }

  if (isCorrect || !correctOptionId) return;

  const correctButton = [...document.querySelectorAll(".answer-option")].find(
    (button) => button.dataset.optionId === correctOptionId,
  );
  correctButton?.classList.add("is-correct");
}

export function renderResults({ score, correct, answered, total }) {
  $("quizPanel").classList.add("hidden");
  $("resultPanel").classList.remove("hidden");
  $("scoreValue").textContent = Number(score).toLocaleString("pt-BR");
  $("correctValue").textContent = `${correct}/${answered || total || 0}`;
  $("resultCopy").textContent = answered
    ? `Você concluiu ${answered} questões. Cada rodada é mais uma chance de fixar o conteúdo.`
    : "Sessão concluída. Volte sempre que quiser revisar.";
}

function startTimer(timeLimitSeconds, onTimeout) {
  const limit = Math.max(1, Number(timeLimitSeconds) || 20);
  let remaining = limit;

  const updateDisplay = () => {
    $("timerNumber").textContent = `${remaining}s`;
    $("timerTrack").setAttribute("aria-valuemax", String(limit));
    $("timerTrack").setAttribute("aria-valuenow", String(remaining));
    $("timerBar").style.transform = `scaleX(${remaining / limit})`;
    $("timerTrack").classList.toggle("urgent", remaining <= 5);
  };

  updateDisplay();
  const timerId = window.setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    updateDisplay();

    if (remaining === 0) {
      stopTimer(timerId);
      onTimeout();
    }
  }, 1000);

  return timerId;
}
