const COLUMNS = [
  { id: "a_fazer", label: "A Fazer", listId: "list-todo", countId: "count-todo", emptyId: "empty-todo" },
  { id: "em_execucao", label: "Em Execução", listId: "list-doing", countId: "count-doing", emptyId: "empty-doing" },
  { id: "concluido", label: "Concluído", listId: "list-done", countId: "count-done", emptyId: "empty-done" },
];
const COLUMN_ORDER = new Map(COLUMNS.map((column, index) => [column.id, index]));
const PRIORITIES = ["baixa", "media", "alta"];
const ALLOWED_AVATAR_PATH = /^\/(?:avatars\/\d+\/[^/]+|embed\/avatars\/\d+)\.(?:png|gif|webp)$/;

const elements = {
  profile: document.getElementById("profile-view"),
  profileAvatar: document.getElementById("profile-avatar"),
  profileName: document.getElementById("profile-name"),
  logout: document.getElementById("logout-button"),
  loading: document.getElementById("session-loading"),
  sessionError: document.getElementById("session-error"),
  retrySession: document.getElementById("retry-session"),
  visitor: document.getElementById("visitor-view"),
  visitorMessage: document.getElementById("visitor-message"),
  board: document.getElementById("board-view"),
  notice: document.getElementById("notice"),
  createForm: document.getElementById("create-form"),
  createButton: document.getElementById("create-button"),
  newTitle: document.getElementById("new-title"),
  newDescription: document.getElementById("new-description"),
  newPriority: document.getElementById("new-priority"),
  boardLoading: document.getElementById("board-loading"),
  boardLoadError: document.getElementById("board-load-error"),
  boardLoadErrorText: document.getElementById("board-load-error-text"),
  retryCards: document.getElementById("retry-cards"),
  kanban: document.getElementById("kanban-board"),
};

let currentUser = null;
let cards = [];
let draggedCardId = null;
let editingCardId = null;
const pendingCardIds = new Set();

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function showNotice(message, type = "info") {
  elements.notice.textContent = message;
  elements.notice.className = `notice notice-${type}`;
  elements.notice.hidden = !message;
}

function hideNotice() {
  elements.notice.textContent = "";
  elements.notice.hidden = true;
}

function showVisitor(message = "") {
  currentUser = null;
  cards = [];
  hideNotice();
  elements.profile.hidden = true;
  elements.board.hidden = true;
  elements.loading.hidden = true;
  elements.sessionError.hidden = true;
  elements.visitor.hidden = false;
  elements.visitorMessage.textContent = message || "Entre com sua conta Discord para acessar seus cartões e continuar de onde parou.";
}

function showSessionError() {
  elements.loading.hidden = true;
  elements.visitor.hidden = true;
  elements.board.hidden = true;
  elements.profile.hidden = true;
  elements.sessionError.hidden = false;
}

function showAuthenticated(user) {
  currentUser = user;
  elements.visitor.hidden = true;
  elements.loading.hidden = true;
  elements.sessionError.hidden = true;
  elements.profile.hidden = false;
  elements.profileName.textContent = user.username;

  const avatarUrl = getDiscordAvatarUrl(user.avatar);
  elements.profileAvatar.hidden = !avatarUrl;
  if (avatarUrl) {
    elements.profileAvatar.src = avatarUrl;
  } else {
    elements.profileAvatar.removeAttribute("src");
  }
  elements.board.hidden = false;
}

function getDiscordAvatarUrl(value) {
  if (typeof value !== "string" || value.length > 500) return "";
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "cdn.discordapp.com" || !ALLOWED_AVATAR_PATH.test(url.pathname)) {
      return "";
    }
    return url.href;
  } catch (error) {
    return "";
  }
}

async function requestApi(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { credentials: "same-origin", ...options });
  } catch (error) {
    throw new ApiError(0, "Não foi possível conectar ao servidor.");
  }

  if (response.status === 401) {
    showVisitor("Sua sessão expirou. Entre novamente com o Discord para continuar.");
    throw new ApiError(401, "Sessão ausente ou expirada.");
  }
  return response;
}

function validateUser(user) {
  if (!user || typeof user.user_id !== "string" || typeof user.username !== "string" || !user.username) {
    throw new Error("Resposta de sessão inválida.");
  }
  return {
    user_id: user.user_id,
    username: user.username,
    avatar: typeof user.avatar === "string" ? user.avatar : "",
  };
}

function validateCard(card) {
  if (
    !card
    || !Number.isSafeInteger(card.id)
    || typeof card.titulo !== "string"
    || typeof card.descricao !== "string"
    || !PRIORITIES.includes(card.prioridade)
    || !COLUMN_ORDER.has(card.coluna)
    || typeof card.posicao !== "number"
    || !Number.isFinite(card.posicao)
  ) {
    throw new Error("Resposta de cartão inválida.");
  }
  return card;
}

function sortCards(items) {
  return [...items].sort((first, second) => {
    const columnDifference = COLUMN_ORDER.get(first.coluna) - COLUMN_ORDER.get(second.coluna);
    return columnDifference || first.posicao - second.posicao || first.id - second.id;
  });
}

function setCardsLoading(isLoading) {
  elements.boardLoading.hidden = !isLoading;
  elements.kanban.hidden = isLoading;
  elements.boardLoadError.hidden = true;
}

async function loadCards() {
  setCardsLoading(true);
  try {
    const response = await requestApi("/api/cartoes");
    if (!response.ok) throw new ApiError(response.status, "Não foi possível carregar os cartões.");
    const result = await response.json();
    if (!Array.isArray(result)) throw new Error("Resposta de cartões inválida.");
    cards = sortCards(result.map(validateCard));
    editingCardId = null;
    renderBoard();
    elements.boardLoading.hidden = true;
    elements.boardLoadError.hidden = true;
    elements.kanban.hidden = false;
    return true;
  } catch (error) {
    elements.boardLoading.hidden = true;
    if (error.status === 401) return false;
    elements.kanban.hidden = true;
    elements.boardLoadErrorText.textContent = "Não foi possível carregar os cartões. Tente novamente.";
    elements.boardLoadError.hidden = false;
    return false;
  }
}

async function restoreCardsAfterFailure(message) {
  const restored = await loadCards();
  if (currentUser) {
    showNotice(
      restored ? `${message} O quadro foi recarregado do servidor.` : `${message} Não foi possível recarregar o quadro; tente novamente.`,
      "error",
    );
  }
}

function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text;
  return element;
}

function makeButton(label, action, className, ariaLabel = label) {
  const button = makeElement("button", className, label);
  button.type = "button";
  button.dataset.action = action;
  button.setAttribute("aria-label", ariaLabel);
  return button;
}

function makePrioritySelect(card) {
  const select = document.createElement("select");
  select.className = `priority-select priority-${card.prioridade}`;
  select.dataset.action = "priority";
  select.setAttribute("aria-label", "Prioridade do cartão");
  for (const [value, label] of [["baixa", "Baixa"], ["media", "Média"], ["alta", "Alta"]]) {
    const option = makeElement("option", "", label);
    option.value = value;
    option.selected = card.prioridade === value;
    select.append(option);
  }
  return select;
}

function makeInputField(labelText, name, value, isTextArea = false) {
  const label = makeElement("label", "edit-field");
  const caption = makeElement("span", "", labelText);
  const input = isTextArea ? document.createElement("textarea") : document.createElement("input");
  input.name = name;
  input.value = value;
  if (isTextArea) {
    input.rows = 3;
    input.maxLength = 1000;
  } else {
    input.type = "text";
    input.maxLength = 120;
    input.required = true;
  }
  label.append(caption, input);
  return label;
}

function makeEditForm(card) {
  const form = makeElement("form", "card-edit-form");
  form.dataset.cardId = String(card.id);
  form.hidden = editingCardId !== card.id;
  form.append(
    makeInputField("Título", "titulo", card.titulo),
    makeInputField("Descrição", "descricao", card.descricao, true),
  );
  const actions = makeElement("div", "edit-actions");
  const save = makeButton("Salvar", "save-edit", "button button-dark button-small");
  save.type = "submit";
  const cancel = makeButton("Cancelar", "cancel-edit", "button button-quiet button-small");
  actions.append(save, cancel);
  form.append(actions);
  return form;
}

function makeCardElement(card) {
  const article = makeElement("article", "task-card");
  article.draggable = true;
  article.dataset.cardId = String(card.id);
  article.setAttribute("role", "listitem");
  article.setAttribute("aria-label", "Cartão arrastável; use os controles para mover entre colunas.");
  if (pendingCardIds.has(card.id)) {
    article.classList.add("task-card-pending");
    article.setAttribute("aria-busy", "true");
  }

  const top = makeElement("div", "task-card-top");
  const dragLabel = makeElement("span", "drag-label", "ARRASTE");
  dragLabel.setAttribute("aria-hidden", "true");
  top.append(dragLabel, makePrioritySelect(card));

  const title = makeElement("h4", "task-title", card.titulo);
  const description = makeElement("p", "task-description", card.descricao || "Sem descrição");

  const actions = makeElement("div", "task-actions");
  const columnIndex = COLUMN_ORDER.get(card.coluna);
  const previous = makeButton("←", "move-previous", "button button-icon", "Mover para a coluna anterior");
  previous.disabled = columnIndex === 0 || pendingCardIds.has(card.id);
  const next = makeButton("→", "move-next", "button button-icon", "Mover para a próxima coluna");
  next.disabled = columnIndex === COLUMNS.length - 1 || pendingCardIds.has(card.id);
  const edit = makeButton("Editar", "edit", "button button-quiet button-small");
  edit.disabled = pendingCardIds.has(card.id);
  const remove = makeButton("Excluir", "delete", "button button-danger button-small");
  remove.disabled = pendingCardIds.has(card.id);
  actions.append(previous, next, edit, remove);

  article.append(top, title, description, actions, makeEditForm(card));
  return article;
}

function renderBoard() {
  const orderedCards = sortCards(cards);
  for (const column of COLUMNS) {
    const list = document.getElementById(column.listId);
    const count = document.getElementById(column.countId);
    const empty = document.getElementById(column.emptyId);
    const columnCards = orderedCards.filter((card) => card.coluna === column.id);
    list.replaceChildren(...columnCards.map(makeCardElement));
    count.textContent = String(columnCards.length);
    empty.hidden = columnCards.length > 0;
  }
}

function insertionPosition(destinationCards, index) {
  if (destinationCards.length === 0) return 0;
  if (index <= 0) return destinationCards[0].posicao - 1;
  if (index >= destinationCards.length) return destinationCards[destinationCards.length - 1].posicao + 1;
  return (destinationCards[index - 1].posicao + destinationCards[index].posicao) / 2;
}

function getColumnCards(columnId, exceptId = null) {
  return sortCards(cards.filter((card) => card.coluna === columnId && card.id !== exceptId));
}

async function persistCardPatch(cardId, patch, successMessage, focusSelector = "") {
  if (pendingCardIds.has(cardId)) return false;
  const card = cards.find((item) => item.id === cardId);
  if (!card) return false;

  pendingCardIds.add(cardId);
  cards = cards.map((item) => item.id === cardId ? { ...item, ...patch } : item);
  renderBoard();

  try {
    const response = await requestApi(`/api/cartoes/${cardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!response.ok) throw new ApiError(response.status, "Não foi possível salvar o cartão.");
    const updatedCard = validateCard(await response.json());
    cards = sortCards(cards.map((item) => item.id === cardId ? updatedCard : item));
    renderBoard();
    showNotice(successMessage, "success");
    return true;
  } catch (error) {
    if (error.status !== 401) {
      await restoreCardsAfterFailure("A alteração não foi salva.");
    }
    return false;
  } finally {
    pendingCardIds.delete(cardId);
    if (currentUser) {
      renderBoard();
      if (focusSelector) {
        document.querySelector(`.task-card[data-card-id="${cardId}"] ${focusSelector}`)?.focus();
      }
    }
  }
}

async function moveCardToColumn(cardId, targetColumn, focusSelector = "") {
  const targetCards = getColumnCards(targetColumn, cardId);
  const position = insertionPosition(targetCards, targetCards.length);
  await persistCardPatch(cardId, { coluna: targetColumn, posicao: position }, "Cartão movido e salvo.", focusSelector);
}

function clearDragIndicators() {
  document.querySelectorAll(".card-list.drop-target").forEach((list) => list.classList.remove("drop-target"));
  document.querySelectorAll(".task-card.is-dragging").forEach((card) => card.classList.remove("is-dragging"));
}

function getDropList(target) {
  const cardList = target.closest(".card-list");
  if (cardList) return cardList;
  return target.closest(".kanban-column")?.querySelector(".card-list") || null;
}

function handleDragEnd() {
  draggedCardId = null;
  clearDragIndicators();
}

async function initialize() {
  elements.loading.hidden = false;
  elements.visitor.hidden = true;
  elements.sessionError.hidden = true;
  elements.board.hidden = true;
  elements.profile.hidden = true;
  hideNotice();

  let response;
  try {
    response = await fetch("/api/sessao", { credentials: "same-origin" });
  } catch (error) {
    showSessionError();
    return;
  }

  if (response.status === 401) {
    const errorCode = new URLSearchParams(window.location.search).get("auth_error");
    const friendlyErrors = {
      token_exchange_failed: "O Discord não concluiu o acesso. Tente entrar novamente.",
      fetch_user_failed: "Não foi possível carregar seu perfil do Discord. Tente novamente.",
      missing_code: "O acesso não foi concluído. Tente entrar novamente.",
      access_denied: "O acesso foi cancelado. Você pode tentar novamente quando quiser.",
    };
    showVisitor(errorCode ? (friendlyErrors[errorCode] || "Não foi possível concluir o acesso pelo Discord. Tente novamente.") : "");
    return;
  }
  if (!response.ok) {
    showSessionError();
    return;
  }

  try {
    const user = validateUser(await response.json());
    showAuthenticated(user);
    await loadCards();
  } catch (error) {
    showSessionError();
  }
}

elements.createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const titulo = elements.newTitle.value.trim();
  const descricao = elements.newDescription.value;
  const prioridade = elements.newPriority.value;
  if (!titulo || titulo.length > 120 || descricao.length > 1000 || !PRIORITIES.includes(prioridade)) {
    showNotice("Informe um título de até 120 caracteres e revise a descrição e prioridade.", "error");
    elements.newTitle.focus();
    return;
  }

  elements.createButton.disabled = true;
  elements.createButton.querySelector("span").textContent = "Salvando...";
  try {
    const response = await requestApi("/api/cartoes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo, descricao, prioridade }),
    });
    if (response.status !== 201) throw new ApiError(response.status, "Não foi possível criar o cartão.");
    cards = sortCards([...cards, validateCard(await response.json())]);
    renderBoard();
    elements.createForm.reset();
    elements.newPriority.value = "media";
    showNotice("Cartão criado e salvo.", "success");
    elements.newTitle.focus();
  } catch (error) {
    if (error.status !== 401) {
      await restoreCardsAfterFailure("O cartão não foi criado.");
    }
  } finally {
    elements.createButton.disabled = false;
    elements.createButton.querySelector("span").textContent = "Adicionar cartão";
  }
});

elements.board.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const cardElement = button.closest(".task-card");
  if (!cardElement) return;
  const cardId = Number(cardElement.dataset.cardId);
  const card = cards.find((item) => item.id === cardId);
  if (!card || pendingCardIds.has(cardId)) return;

  const action = button.dataset.action;
  if (action === "edit") {
    editingCardId = cardId;
    renderBoard();
    document.querySelector(`.card-edit-form[data-card-id="${cardId}"] input[name="titulo"]`)?.focus();
    return;
  }
  if (action === "cancel-edit") {
    editingCardId = null;
    renderBoard();
    return;
  }
  if (action === "move-previous" || action === "move-next") {
    const currentIndex = COLUMN_ORDER.get(card.coluna);
    const targetIndex = currentIndex + (action === "move-previous" ? -1 : 1);
    if (targetIndex >= 0 && targetIndex < COLUMNS.length) {
      const returnAction = action === "move-previous" ? "move-next" : "move-previous";
      await moveCardToColumn(cardId, COLUMNS[targetIndex].id, `[data-action="${returnAction}"]`);
    }
    return;
  }
  if (action === "delete") {
    button.disabled = true;
    try {
      const response = await requestApi(`/api/cartoes/${cardId}`, { method: "DELETE" });
      if (response.status !== 204) throw new ApiError(response.status, "Não foi possível excluir o cartão.");
      cards = cards.filter((item) => item.id !== cardId);
      renderBoard();
      showNotice("Cartão excluído.", "success");
    } catch (error) {
      if (error.status !== 401) {
        await restoreCardsAfterFailure("O cartão não foi excluído.");
      }
    }
  }
});

elements.board.addEventListener("submit", async (event) => {
  const form = event.target.closest(".card-edit-form");
  if (!form) return;
  event.preventDefault();
  const cardId = Number(form.dataset.cardId);
  const formData = new FormData(form);
  const titulo = String(formData.get("titulo") || "").trim();
  const descricao = String(formData.get("descricao") || "");
  if (!titulo || titulo.length > 120 || descricao.length > 1000) {
    showNotice("O título deve ter entre 1 e 120 caracteres; a descrição aceita até 1000.", "error");
    return;
  }
  editingCardId = null;
  await persistCardPatch(cardId, { titulo, descricao }, "Cartão atualizado e salvo.", '[data-action="edit"]');
});

elements.board.addEventListener("change", async (event) => {
  const select = event.target.closest("select[data-action='priority']");
  if (!select) return;
  const cardElement = select.closest(".task-card");
  const cardId = Number(cardElement?.dataset.cardId);
  if (!cardId || !PRIORITIES.includes(select.value)) return;
  await persistCardPatch(cardId, { prioridade: select.value }, "Prioridade atualizada e salva.", ".priority-select");
});

elements.board.addEventListener("dragstart", (event) => {
  const cardElement = event.target.closest(".task-card");
  if (!cardElement || event.target.closest("button, input, textarea, select, form")) {
    event.preventDefault();
    return;
  }
  const cardId = Number(cardElement.dataset.cardId);
  if (pendingCardIds.has(cardId)) {
    event.preventDefault();
    return;
  }
  draggedCardId = cardId;
  cardElement.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", String(cardId));
});

elements.board.addEventListener("dragover", (event) => {
  const list = getDropList(event.target);
  if (!list || draggedCardId === null) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  list.classList.add("drop-target");
});

elements.board.addEventListener("dragleave", (event) => {
  const list = getDropList(event.target);
  const column = list?.closest(".kanban-column");
  if (list && column && (!event.relatedTarget || !column.contains(event.relatedTarget))) {
    list.classList.remove("drop-target");
  }
});

elements.board.addEventListener("drop", async (event) => {
  const list = getDropList(event.target);
  if (!list) return;
  event.preventDefault();
  const cardId = Number(event.dataTransfer.getData("text/plain")) || draggedCardId;
  const card = cards.find((item) => item.id === cardId);
  const targetColumn = list.dataset.column;
  if (!card || !COLUMN_ORDER.has(targetColumn) || pendingCardIds.has(cardId)) {
    handleDragEnd();
    return;
  }

  const destinationCards = getColumnCards(targetColumn, cardId);
  const remainingElements = [...list.querySelectorAll(".task-card")].filter(
    (element) => Number(element.dataset.cardId) !== cardId,
  );
  const nextElement = remainingElements.find((element) => {
    const bounds = element.getBoundingClientRect();
    return event.clientY < bounds.top + bounds.height / 2;
  });
  const insertionIndex = nextElement ? remainingElements.indexOf(nextElement) : remainingElements.length;
  const posicao = insertionPosition(destinationCards, insertionIndex);
  handleDragEnd();

  if (card.coluna === targetColumn && card.posicao === posicao) return;
  await persistCardPatch(cardId, { coluna: targetColumn, posicao }, "Posição do cartão salva.");
});

document.addEventListener("dragend", handleDragEnd);

elements.logout.addEventListener("click", async () => {
  elements.logout.disabled = true;
  try {
    const response = await requestApi("/api/sessao", { method: "DELETE" });
    if (response.status !== 204) throw new ApiError(response.status, "Não foi possível encerrar a sessão.");
    showVisitor("Você saiu da sua conta. Entre com o Discord quando quiser voltar.");
    showNotice("Sessão encerrada.", "success");
  } catch (error) {
    if (error.status !== 401) showNotice("Não foi possível encerrar a sessão. Tente novamente.", "error");
  } finally {
    elements.logout.disabled = false;
  }
});

elements.retrySession.addEventListener("click", initialize);
elements.retryCards.addEventListener("click", async () => {
  await loadCards();
});

initialize();
