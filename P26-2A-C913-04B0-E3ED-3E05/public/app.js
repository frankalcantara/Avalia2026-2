import { API, request } from "./modules/api.js";
import {
  $, handleExpiredSession, renderCategories, renderCategoryLoadError,
  renderProfile, resetToSignedOutView, setMessage,
} from "./modules/ui.js";
import {
  markAnswer, renderQuestion, renderResults, setAnswersDisabled, stopTimer,
} from "./modules/quiz-view.js";

const state = {
  attemptId: null,
  categoryName: "",
  correct: 0,
  answered: 0,
  score: 0,
  question: null,
  timerId: null,
  answerLocked: false,
};

async function loadCategories() {
  try {
    const { categories = [] } = await request(API.categories);
    renderCategories(categories);
  } catch (error) {
    renderCategoryLoadError(error);
    if (error.status === 401) handleExpiredSession();
  }
}

function displayQuestion(question) {
  state.question = question;
  state.answerLocked = false;
  state.timerId = renderQuestion(
    question,
    state.categoryName,
    (optionId, button) => submitAnswer(optionId, button),
    () => submitAnswer("", null, true),
  );
}

function clearQuestionTimer() {
  stopTimer(state.timerId);
  state.timerId = null;
}

async function submitAnswer(optionId, selectedButton, timedOut = false) {
  if (state.answerLocked || !state.question || !state.attemptId) return;

  state.answerLocked = true;
  clearQuestionTimer();
  setAnswersDisabled(true);
  $("answerFeedback").textContent = timedOut
    ? "Tempo encerrado. Vamos à próxima."
    : "Conferindo resposta…";

  try {
    const result = await request(API.answer, {
      method: "POST",
      body: JSON.stringify({
        attemptId: state.attemptId,
        questionId: state.question.id,
        optionId,
      }),
    });

    state.score = Number(result.score ?? state.score + (result.points || 0));
    state.answered += 1;
    if (result.correct) state.correct += 1;

    markAnswer(selectedButton, result.correct, result.correctOptionId);
    $("answerFeedback").textContent = getAnswerFeedback(result, timedOut);
    window.setTimeout(loadNextQuestion, 1050);
  } catch (error) {
    if (error.status === 401) {
      handleExpiredSession();
      return;
    }

    $("answerFeedback").textContent =
      "Não foi possível registrar. Tente novamente.";
    state.answerLocked = false;
    setAnswersDisabled(false);
  }
}

function getAnswerFeedback(result, timedOut) {
  if (result.timedOut || timedOut) return "O tempo acabou. A resposta não pontuou.";
  if (result.correct) return `Boa! +${result.points || 0} pontos.`;
  return "Ainda não — a resposta certa está marcada.";
}

async function loadNextQuestion() {
  try {
    const result = await request(API.next, {
      method: "POST",
      body: JSON.stringify({ attemptId: state.attemptId }),
    });

    if (result.complete) {
      finishQuiz(result);
      return;
    }

    displayQuestion(result.question);
  } catch (error) {
    if (error.status === 401) {
      handleExpiredSession();
      return;
    }

    $("answerFeedback").textContent =
      "Não foi possível carregar a próxima questão. Atualize para tentar de novo.";
  }
}

function finishQuiz(result) {
  clearQuestionTimer();
  renderResults({
    score: result.score ?? state.score,
    correct: state.correct,
    answered: result.answered ?? state.answered,
    total: result.total ?? 0,
  });
}

function resetQuizState() {
  state.attemptId = null;
  state.categoryName = "";
  state.correct = 0;
  state.answered = 0;
  state.score = 0;
  state.question = null;
  state.answerLocked = false;
  clearQuestionTimer();
}

async function startQuiz() {
  const categorySelect = $("categorySelect");
  const categoryId = categorySelect.value;
  if (!categoryId) return;

  $("startBtn").disabled = true;
  setMessage("Preparando sua sessão…");
  resetQuizState();
  state.categoryName = categorySelect.selectedOptions[0].textContent.split(" · ")[0];

  try {
    const result = await request(API.start, {
      method: "POST",
      body: JSON.stringify({ categoryId }),
    });

    state.attemptId = result.attemptId;
    displayQuestion(result.question);
  } catch (error) {
    if (error.status === 401) {
      handleExpiredSession();
      return;
    }

    setMessage(error.message, true);
    $("startBtn").disabled = false;
  }
}

async function logout() {
  clearQuestionTimer();

  try {
    await request(API.logout, { method: "POST", body: JSON.stringify({}) });
  } catch {
    // Atualiza a interface mesmo se a sessão não puder ser apagada pelo servidor.
  }

  resetQuizState();
  resetToSignedOutView("Você saiu da sua conta.");
}

async function initializeApp() {
  const params = new URLSearchParams(location.search);
  if (params.has("auth_error")) {
    setMessage("O login não foi concluído. Tente novamente.", true);
  }

  try {
    const { user } = await request(API.session);
    renderProfile(user);

    if (user) {
      setMessage("Carregando matérias…");
      await loadCategories();
    } else {
      $("categorySelect").replaceChildren(
        new Option("Entre com o Discord para continuar", ""),
      );
    }
  } catch {
    setMessage("Não foi possível verificar sua sessão.", true);
  }

  if (params.has("login") || params.has("auth_error")) {
    history.replaceState({}, "", location.pathname);
  }
}

$("startBtn").addEventListener("click", startQuiz);
$("againBtn").addEventListener("click", () => {
  $("resultPanel").classList.add("hidden");
  $("setupPanel").classList.remove("hidden");
  $("categorySelect").focus();
});
$("logoutBtn").addEventListener("click", logout);

initializeApp();
