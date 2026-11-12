const API = {
  session: "/api/auth/session",
  logout: "/api/auth/logout",
  categories: "/api/quiz/categories",
  start: "/api/quiz/start",
  answer: "/api/quiz/answer",
  next: "/api/quiz/next",
};

const state = { attemptId: null, question: null, timer: null, seconds: 20, locked: false, score: 0, correct: 0, answered: 0 };
const $ = (id) => document.getElementById(id);

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || data.error || "Não foi possível concluir a solicitação.");
    error.status = response.status;
    throw error;
  }
  return data;
}

function setMessage(text, isError = false) {
  const el = $("setupMessage");
  el.textContent = text;
  el.classList.toggle("error", isError);
}

function renderProfile(user) {
  const login = $("discordLoginLink");
  const profile = $("profileArea");
  if (!user) {
    login.classList.remove("hidden");
    profile.classList.add("hidden");
    return;
  }
  login.classList.add("hidden");
  profile.classList.remove("hidden");
  $("profileAvatar").src = user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";
  $("discordUserText").textContent = user.username;
  $("discordUserText").title = `Discord · ${user.userId}`;
}

function handleExpiredSession() {
  renderProfile(null);
  $("categorySelect").disabled = true;
  $("startBtn").disabled = true;
  $("quizPanel").classList.add("hidden");
  $("setupPanel").classList.remove("hidden");
  setMessage("Sua sessão expirou. Entre novamente com o Discord para continuar.", true);
}

async function loadCategories() {
  const select = $("categorySelect");
  try {
    const { categories = [] } = await request(API.categories);
    select.replaceChildren(new Option("Selecione uma matéria", ""));
    categories.forEach((category) => {
      const option = new Option(`${category.name} · ${category.questionCount} questões`, category.id);
      select.add(option);
    });
    select.disabled = categories.length === 0;
    $("startBtn").disabled = categories.length === 0;
    if (!categories.length) setMessage("Ainda não há matérias disponíveis.");
    else setMessage("Escolha um tema para começar.");
  } catch (error) {
    if (error.status === 401) {
      select.replaceChildren(new Option("Entre com o Discord para continuar", ""));
      setMessage("Entre com sua conta Discord para carregar as matérias.");
    } else {
      select.replaceChildren(new Option("Não foi possível carregar as matérias", ""));
      setMessage("A API não respondeu. Atualize a página para tentar novamente.", true);
    }
    select.disabled = true;
    $("startBtn").disabled = true;
  }
}

function showQuestion(question) {
  state.question = question;
  state.locked = false;
  state.seconds = Number(question.timeLimitSeconds) || 20;
  $("setupPanel").classList.add("hidden");
  $("resultPanel").classList.add("hidden");
  $("quizPanel").classList.remove("hidden");
  $("questionCategory").textContent = $("categorySelect").selectedOptions[0]?.textContent.split(" · ")[0] || "Revisão";
  $("questionCount").textContent = `Questão ${question.position} de ${question.total}`;
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
    button.addEventListener("click", () => submitAnswer(option.id, button));
    $("answers").append(button);
  });
  $("questionText").focus({ preventScroll: true });
  startTimer();
}

function startTimer() {
  clearInterval(state.timer);
  const limit = state.seconds;
  const update = () => {
    const remaining = Math.max(0, state.seconds);
    $("timerNumber").textContent = `${remaining}s`;
    $("timerTrack").setAttribute("aria-valuemax", String(limit));
    $("timerTrack").setAttribute("aria-valuenow", String(remaining));
    $("timerBar").style.transform = `scaleX(${remaining / limit})`;
    $("timerTrack").classList.toggle("urgent", remaining <= 5);
    if (remaining === 0) {
      clearInterval(state.timer);
      submitAnswer("", null, true);
    }
    state.seconds -= 1;
  };
  update();
  state.timer = setInterval(update, 1000);
}

async function submitAnswer(optionId, selectedButton, timedOut = false) {
  if (state.locked || !state.question) return;
  state.locked = true;
  clearInterval(state.timer);
  document.querySelectorAll(".answer-option").forEach((button) => { button.disabled = true; });
  selectedButton?.classList.add("selected");
  $("answerFeedback").textContent = timedOut ? "Tempo encerrado. Vamos à próxima." : "Conferindo resposta…";
  try {
    const result = await request(API.answer, {
      method: "POST",
      body: JSON.stringify({ attemptId: state.attemptId, questionId: state.question.id, optionId }),
    });
    state.score = Number(result.score ?? state.score + (result.points || 0));
    state.answered += 1;
    if (result.correct) state.correct += 1;
    if (selectedButton) selectedButton.classList.add(result.correct ? "is-correct" : "is-wrong");
    if (!result.correct && result.correctOptionId) {
      const correct = [...document.querySelectorAll(".answer-option")].find((button) => button.dataset.optionId === result.correctOptionId);
      correct?.classList.add("is-correct");
    }
    const message = result.timedOut || timedOut ? "O tempo acabou. A resposta não pontuou." : result.correct ? `Boa! +${result.points || 0} pontos.` : "Ainda não — a resposta certa está marcada.";
    $("answerFeedback").textContent = message;
    window.setTimeout(loadNext, 1050);
  } catch (error) {
    if (error.status === 401) {
      handleExpiredSession();
      return;
    }
    $("answerFeedback").textContent = "Não foi possível registrar. Tente novamente.";
    state.locked = false;
    document.querySelectorAll(".answer-option").forEach((button) => { button.disabled = false; });
  }
}

async function loadNext() {
  try {
    const data = await request(API.next, { method: "POST", body: JSON.stringify({ attemptId: state.attemptId }) });
    if (data.complete) showResults(data);
    else showQuestion(data.question);
  } catch (error) {
    if (error.status === 401) {
      handleExpiredSession();
      return;
    }
    $("answerFeedback").textContent = "Não foi possível carregar a próxima questão. Atualize para tentar de novo.";
  }
}

function showResults(result = {}) {
  clearInterval(state.timer);
  $("quizPanel").classList.add("hidden");
  $("resultPanel").classList.remove("hidden");
  const score = Number(result.score ?? state.score);
  const answered = Number(result.answered ?? state.answered);
  $("scoreValue").textContent = score.toLocaleString("pt-BR");
  $("correctValue").textContent = `${state.correct}/${answered || result.total || 0}`;
  $("resultCopy").textContent = answered ? `Você concluiu ${answered} questões. Cada rodada é mais uma chance de fixar o conteúdo.` : "Sessão concluída. Volte sempre que quiser revisar.";
}

$("startBtn").addEventListener("click", async () => {
  const categoryId = $("categorySelect").value;
  if (!categoryId) return;
  $("startBtn").disabled = true;
  setMessage("Preparando sua sessão…");
  state.score = 0;
  state.correct = 0;
  state.answered = 0;
  try {
    const data = await request(API.start, { method: "POST", body: JSON.stringify({ categoryId }) });
    state.attemptId = data.attemptId;
    showQuestion(data.question);
  } catch (error) {
    if (error.status === 401) handleExpiredSession();
    else setMessage(error.message, true);
    $("startBtn").disabled = false;
  }
});

$("againBtn").addEventListener("click", () => {
  $("resultPanel").classList.add("hidden");
  $("setupPanel").classList.remove("hidden");
  $("categorySelect").focus();
});

$("logoutBtn").addEventListener("click", async () => {
  try {
    await request(API.logout, { method: "POST", body: JSON.stringify({}) });
  } catch {
    // Clear the local view even if the network request fails; the server cookie expires independently.
  }
  {
    state.attemptId = null;
    renderProfile(null);
    $("quizPanel").classList.add("hidden");
    $("resultPanel").classList.add("hidden");
    $("setupPanel").classList.remove("hidden");
    $("categorySelect").replaceChildren(new Option("Entre com o Discord para continuar", ""));
    $("categorySelect").disabled = true;
    $("startBtn").disabled = true;
    setMessage("Você saiu da sua conta.");
  }
});

async function init() {
  const params = new URLSearchParams(location.search);
  if (params.has("auth_error")) setMessage("O login não foi concluído. Tente novamente.", true);
  try {
    const { user } = await request(API.session);
    renderProfile(user);
    if (user) {
      $("setupMessage").textContent = "Carregando matérias…";
      await loadCategories();
    } else {
      $("categorySelect").replaceChildren(new Option("Entre com o Discord para continuar", ""));
    }
  } catch {
    setMessage("Não foi possível verificar sua sessão.", true);
  }
  if (params.has("login") || params.has("auth_error")) history.replaceState({}, "", location.pathname);
}

init();
