const accountLabel = document.getElementById("accountLabel");
const loginLink = document.getElementById("loginLink");
const askLoginLink = document.getElementById("askLoginLink");
const logoutButton = document.getElementById("logoutButton");
const questionForm = document.getElementById("questionForm");
const questionsList = document.getElementById("questionsList");
const statusFilter = document.getElementById("statusFilter");
const message = document.getElementById("message");
const connectionStatus = document.getElementById("connectionStatus");

let currentUser = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error?.message || `A solicitação falhou (${response.status}).`);
  }
  return data;
}

function showMessage(text, kind = "") {
  message.textContent = text;
  message.className = kind ? `message ${kind}` : "message";
}

function addText(parent, tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function formatDate(value) {
  const date = new Date(`${value}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR");
}

function updateAccount(user) {
  currentUser = user;
  const authenticated = Boolean(user);
  accountLabel.textContent = user ? `Olá, ${user.username}` : "Acesso somente com Discord";
  loginLink.hidden = authenticated;
  askLoginLink.hidden = authenticated;
  logoutButton.hidden = !authenticated;
  questionForm.hidden = !authenticated;
}

function createQuestionCard(question) {
  const card = document.createElement("article");
  card.className = "question-card";
  card.dataset.questionId = String(question.id);

  const cardHeader = document.createElement("div");
  cardHeader.className = "question-header";
  const heading = addText(cardHeader, "h3", "question-title", question.title);
  const badge = addText(
    cardHeader,
    "span",
    `badge ${question.status === "resolved" ? "badge-resolved" : "badge-open"}`,
    question.status === "resolved" ? "Resolvida" : "Aberta",
  );
  badge.setAttribute("aria-label", `Pergunta ${badge.textContent.toLowerCase()}`);
  card.appendChild(cardHeader);

  addText(card, "p", "question-preview", question.content);
  const meta = addText(
    card,
    "p",
    "question-meta",
    `Por ${question.author.username} · ${formatDate(question.createdAt)} · ${question.answerCount} resposta(s)`,
  );

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "text-button";
  toggleButton.textContent = "Ver respostas";
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.setAttribute("aria-controls", `answers-${question.id}`);
  card.appendChild(toggleButton);

  const answerArea = document.createElement("div");
  answerArea.className = "answer-area";
  answerArea.id = `answers-${question.id}`;
  answerArea.hidden = true;
  card.appendChild(answerArea);

  toggleButton.addEventListener("click", async () => {
    if (!answerArea.hidden) {
      answerArea.hidden = true;
      toggleButton.setAttribute("aria-expanded", "false");
      toggleButton.textContent = "Ver respostas";
      return;
    }

    toggleButton.disabled = true;
    try {
      await loadQuestionDetails(question.id, answerArea);
      answerArea.hidden = false;
      toggleButton.setAttribute("aria-expanded", "true");
      toggleButton.textContent = "Ocultar respostas";
    } catch (error) {
      showMessage(error.message, "message-error");
    } finally {
      toggleButton.disabled = false;
    }
  });

  return card;
}

function renderAnswer(answer, question, container) {
  const article = document.createElement("article");
  article.className = answer.accepted ? "answer accepted-answer" : "answer";
  if (answer.accepted) {
    addText(article, "span", "accepted-label", "Solução aceita");
  }
  addText(article, "p", "answer-content", answer.content);
  addText(
    article,
    "p",
    "question-meta",
    `Por ${answer.author.username} · ${formatDate(answer.createdAt)}`,
  );

  if (
    currentUser &&
    currentUser.userId === question.author.userId &&
    question.status === "open"
  ) {
    const acceptButton = document.createElement("button");
    acceptButton.type = "button";
    acceptButton.className = "button button-small button-primary";
    acceptButton.textContent = "Marcar como solução";
    acceptButton.addEventListener("click", async () => {
      acceptButton.disabled = true;
      try {
        await api(`/api/questions/${question.id}/accepted-answer`, {
          method: "PUT",
          body: JSON.stringify({ answerId: answer.id }),
        });
        showMessage("Solução aceita. A pergunta foi marcada como resolvida.", "message-success");
        await loadQuestions();
      } catch (error) {
        showMessage(error.message, "message-error");
      } finally {
        acceptButton.disabled = false;
      }
    });
    article.appendChild(acceptButton);
  }

  container.appendChild(article);
}

async function loadQuestionDetails(questionId, container) {
  const question = await api(`/api/questions/${questionId}`);
  container.replaceChildren();

  const answersHeading = addText(
    container,
    "h4",
    "answers-heading",
    `Respostas (${question.answers.length})`,
  );
  answersHeading.id = `answers-heading-${questionId}`;

  if (question.answers.length) {
    question.answers.forEach((answer) => renderAnswer(answer, question, container));
  } else {
    addText(container, "p", "muted", "Ainda não há respostas. Seja a primeira pessoa a ajudar.");
  }

  if (question.status === "open" && currentUser) {
    const form = document.createElement("form");
    form.className = "answer-form";
    const label = addText(form, "label", "", "Sua resposta");
    const textarea = document.createElement("textarea");
    textarea.rows = 4;
    textarea.maxLength = 15000;
    textarea.required = true;
    textarea.placeholder = "Explique como resolver a dúvida.";
    label.htmlFor = `answer-${questionId}`;
    textarea.id = label.htmlFor;
    form.appendChild(textarea);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "button button-primary";
    submit.textContent = "Enviar resposta";
    form.appendChild(submit);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      submit.disabled = true;
      try {
        await api(`/api/questions/${questionId}/answers`, {
          method: "POST",
          body: JSON.stringify({ content: textarea.value }),
        });
        showMessage("Sua resposta foi publicada.", "message-success");
        await loadQuestions();
        await loadQuestionDetails(questionId, container);
      } catch (error) {
        showMessage(error.message, "message-error");
      } finally {
        submit.disabled = false;
      }
    });
    container.appendChild(form);
  } else if (question.status === "open") {
    addText(container, "p", "muted", "Entre com Discord para responder a esta pergunta.");
  }
}

async function loadQuestions() {
  questionsList.replaceChildren();
  addText(questionsList, "p", "empty-state", "Carregando perguntas…");

  const filter = statusFilter.value;
  const query = filter ? `?status=${encodeURIComponent(filter)}` : "";
  try {
    const data = await api(`/api/questions${query}`);
    questionsList.replaceChildren();
    if (!data.items.length) {
      addText(questionsList, "p", "empty-state", "Nenhuma pergunta encontrada. Você pode iniciar a conversa.");
      return;
    }
    data.items.forEach((question) => questionsList.appendChild(createQuestionCard(question)));
  } catch (error) {
    questionsList.replaceChildren();
    addText(questionsList, "p", "empty-state", error.message);
  }
}

async function initialize() {
  const authError = new URLSearchParams(location.search).get("auth_error");
  if (authError) {
    showMessage("Não foi possível concluir o login Discord. Verifique a configuração OAuth e tente novamente.", "message-error");
    history.replaceState(null, "", location.pathname);
  }

  try {
    const [session, status] = await Promise.all([
      api("/api/auth/session"),
      api("/api/status"),
    ]);
    updateAccount(session.user);
    connectionStatus.textContent = status.d1Connected
      ? "API e banco D1 conectados."
      : status.d1BindingConfigured
        ? "Binding D1 presente, mas o banco não respondeu. Verifique a migration e o runtime local."
        : "API disponível; configure o binding D1 para habilitar a persistência.";
    connectionStatus.className = status.d1Connected
      ? "connection-status connection-ok"
      : "connection-status connection-warning";
  } catch {
    updateAccount(null);
    connectionStatus.textContent = "Não foi possível conectar ao backend. Inicie o servidor local ou tente novamente.";
    connectionStatus.className = "connection-status connection-warning";
  }

  await loadQuestions();
}

questionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submit = questionForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  try {
    await api("/api/questions", {
      method: "POST",
      body: JSON.stringify({
        title: document.getElementById("questionTitle").value,
        content: document.getElementById("questionContent").value,
      }),
    });
    questionForm.reset();
    showMessage("Sua pergunta foi publicada.", "message-success");
    await loadQuestions();
  } catch (error) {
    showMessage(error.message, "message-error");
  } finally {
    submit.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  logoutButton.disabled = true;
  try {
    await api("/api/auth/logout", { method: "POST" });
    updateAccount(null);
    showMessage("Você saiu da sua conta.");
    await loadQuestions();
  } catch (error) {
    showMessage(error.message, "message-error");
  } finally {
    logoutButton.disabled = false;
  }
});

statusFilter.addEventListener("change", loadQuestions);
initialize();
