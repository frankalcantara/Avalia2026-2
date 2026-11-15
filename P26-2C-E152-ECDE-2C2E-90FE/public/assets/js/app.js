import {
  createPageState,
  invalidatePageState,
  isCurrentPageRequest,
  isCurrentPageState,
  MAX_PAGE_OFFSET,
  resetPageState,
  uniquePageItems,
  updatePageState,
} from "./pagination.js";
import {
  canRemoveRecommendation,
  canSubmitRecommendation,
  canViewRecommendations,
} from "./recommendation-policy.js";

const PAGE_SIZE = 20;
const SEARCH_PAGE_SIZE = 10;
const PRESENCE_INTERVAL_MS = 30_000;
const genres = [
  "Pop",
  "Rock",
  "Hip-Hop",
  "Rap",
  "Funk",
  "Eletrônica",
  "Jazz",
  "Clássica",
  "Sertanejo",
  "MPB",
  "Reggae",
  "Outros",
];

const state = {
  user: null,
  roomId: null,
  room: null,
  roomViewToken: 0,
  roomRequestToken: 0,
  roomOffset: 0,
  roomHasMore: false,
  pagination: {
    participants: createPageState(),
    recommendations: createPageState(),
    history: createPageState(),
    historyRecommendationIds: new Set(),
    historyParticipationIds: new Set(),
  },
  presenceTimer: null,
  loading: false,
};

const elements = {
  notice: document.querySelector("#notice"),
  sessionMessage: document.querySelector("#session-message"),
  loginLink: document.querySelector("#login-link"),
  userMenu: document.querySelector("#user-menu"),
  userName: document.querySelector("#current-user-name"),
  userAvatar: document.querySelector("#current-user-avatar"),
  logoutButton: document.querySelector("#logout-button"),
  roomsStatus: document.querySelector("#rooms-status"),
  roomList: document.querySelector("#room-list"),
  moreRooms: document.querySelector("#more-rooms"),
  refreshRooms: document.querySelector("#refresh-rooms"),
  createRoomForm: document.querySelector("#create-room-form"),
  createRoomHint: document.querySelector("#create-room-hint"),
  roomName: document.querySelector("#room-name"),
  roomDescription: document.querySelector("#room-description"),
  roomCategory: document.querySelector("#room-category"),
  roomPlaceholder: document.querySelector("#room-placeholder"),
  roomDetail: document.querySelector("#room-detail"),
};

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.status, "INVALID_RESPONSE", "O servidor retornou uma resposta inválida.");
  }
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "Não foi possível concluir a solicitação.",
    );
  }
  return payload;
}

function showNotice(message, tone = "info") {
  elements.notice.textContent = message;
  elements.notice.dataset.tone = tone;
  elements.notice.hidden = false;
}

function clearNotice() {
  elements.notice.textContent = "";
  elements.notice.hidden = true;
  delete elements.notice.dataset.tone;
}

function errorMessage(error) {
  if (error instanceof ApiError) return error.message;
  return "Ocorreu um erro inesperado. Tente novamente.";
}

function reportError(error) {
  showNotice(errorMessage(error), "error");
}

function setBusy(form, busy) {
  for (const control of form.querySelectorAll("button, input, textarea, select")) {
    control.disabled = busy;
  }
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function safeImageUrl(value, permittedHost) {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== permittedHost || url.username || url.password) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function avatarFor(value) {
  const url = safeImageUrl(value, "cdn.discordapp.com");
  if (!url) return null;
  const image = makeElement("img", "avatar");
  image.src = url;
  image.alt = "";
  image.loading = "lazy";
  image.referrerPolicy = "no-referrer";
  image.addEventListener("error", () => image.remove(), { once: true });
  return image;
}

async function loadCurrentUser() {
  const payload = await api("/api/auth/me");
  state.user = payload.user;
  if (!state.user) {
    elements.sessionMessage.textContent = "Entre para participar";
    elements.loginLink.hidden = false;
    elements.userMenu.hidden = true;
  } else {
    elements.sessionMessage.textContent = "";
    elements.loginLink.hidden = true;
    elements.userMenu.hidden = false;
    elements.userName.textContent = state.user.displayName;
    const avatar = safeImageUrl(state.user.avatarUrl, "cdn.discordapp.com");
    elements.userAvatar.hidden = !avatar;
    if (avatar) elements.userAvatar.src = avatar;
    else elements.userAvatar.removeAttribute("src");
    elements.createRoomHint.textContent = "Sua sala pública começa com você como participante.";
  }
}

function roomCard(room) {
  const item = makeElement("li", "room-list-item");
  const button = makeElement("button", "room-card-button");
  button.type = "button";
  button.dataset.roomId = room.id;
  button.setAttribute("aria-current", String(state.roomId === room.id));

  const title = makeElement("span", "room-card-title", room.name);
  const meta = makeElement("span", "room-card-meta");
  meta.append(
    makeElement("span", "", room.category),
    makeElement("span", "", `${room.participantCount} pessoas`),
  );
  button.append(title, meta);
  button.addEventListener("click", () => openRoom(room.id));
  item.append(button);
  return item;
}

async function loadRooms({ append = false } = {}) {
  if (!append) {
    state.roomOffset = 0;
    elements.roomList.replaceChildren();
    elements.roomsStatus.textContent = "Carregando salas…";
  }
  try {
    const payload = await api(`/api/rooms?limit=${PAGE_SIZE}&offset=${state.roomOffset}`);
    for (const room of payload.rooms) elements.roomList.append(roomCard(room));
    state.roomHasMore = payload.pagination.hasMore;
    state.roomOffset = payload.pagination.nextOffset ?? 0;
    elements.moreRooms.hidden = !state.roomHasMore;
    elements.roomsStatus.textContent = payload.rooms.length || append
      ? ""
      : "Ainda não há salas abertas. Que tal começar uma?";
  } catch (error) {
    elements.roomsStatus.textContent = errorMessage(error);
  }
}

function displayDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function resetRoomPagination(viewToken) {
  resetPageState(state.pagination.participants, viewToken);
  resetPageState(state.pagination.recommendations, viewToken);
  resetPageState(state.pagination.history, viewToken);
  state.pagination.historyRecommendationIds = new Set();
  state.pagination.historyParticipationIds = new Set();
}

function setRoomView(room) {
  state.roomViewToken += 1;
  resetRoomPagination(state.roomViewToken);
  state.room = room;
  state.roomId = room.id;
  const roomUrl = new URL(location.href);
  roomUrl.searchParams.set("room", room.id);
  history.replaceState(null, "", roomUrl);
  elements.roomPlaceholder.hidden = true;
  elements.roomDetail.hidden = false;
  elements.roomDetail.replaceChildren();
  elements.roomList.querySelectorAll(".room-card-button").forEach((button) => {
    button.setAttribute("aria-current", String(button.dataset.roomId === room.id));
  });

  const card = makeElement("article", "detail-card");
  const header = makeElement("div", "room-detail-header");
  const titleBox = makeElement("div", "room-detail-title");
  const eyebrow = makeElement("p", "eyebrow", room.status === "active" ? "Sala ao vivo" : "Sala encerrada");
  const roomTitle = makeElement("h2", "", room.name);
  const description = makeElement("p", "", room.description || "Sem descrição.");
  titleBox.append(eyebrow, roomTitle, description);
  const actions = makeElement("div", "room-actions");
  const isOwner = state.user?.id === room.owner.id;
  if (room.status === "active" && !room.isParticipant && state.user) {
    actions.append(actionButton("Entrar na sala", "join-room", room.id));
  }
  if (room.status === "active" && room.isParticipant) {
    actions.append(actionButton("Sair", "leave-room", room.id, "button button-outline"));
  }
  if (room.status === "active" && isOwner) {
    actions.append(actionButton("Encerrar", "close-room", room.id, "button button-danger"));
  }
  actions.append(actionButton("Ver histórico", "show-history", room.id, "button button-outline"));
  header.append(titleBox, actions);

  const meta = makeElement("div", "room-meta-row");
  meta.append(
    makeElement("span", "", room.category),
    makeElement("span", "", `Criada ${displayDate(room.createdAt)}`),
    makeElement("span", "", `Por ${room.owner.displayName}`),
  );
  card.append(header, meta);

  const participants = makeElement("section", "subsection");
  participants.setAttribute("aria-labelledby", "participants-heading");
  const participantsHead = makeElement("div", "subsection-heading");
  participantsHead.append(
    makeElement("h3", "", "Pessoas na sala"),
    actionButton("Atualizar", "refresh-room", room.id, "button button-small button-outline"),
  );
  participantsHead.firstElementChild.id = "participants-heading";
  const participantList = makeElement("ul", "participant-list");
  participantList.id = "participant-list";
  participantList.tabIndex = -1;
  const participantsMore = actionButton(
    "Carregar mais participantes",
    "load-more-participants",
    room.id,
    "button button-outline pagination-control",
  );
  participantsMore.id = "participants-more";
  participantsMore.hidden = true;
  participantsMore.setAttribute("aria-controls", participantList.id);
  const participantsLimit = makePageLimitNotice("participants-limit");
  participants.append(participantsHead, participantList, participantsMore, participantsLimit);
  card.append(participants);

  if (canViewRecommendations(room)) {
    card.append(recommendationSection(room.id));
  }

  const historySection = makeElement("section", "subsection");
  historySection.id = "history-section";
  historySection.hidden = true;
  historySection.setAttribute("aria-labelledby", "history-heading");
  const historyHead = makeElement("div", "subsection-heading");
  historyHead.append(
    makeElement("h3", "", "Histórico da sala"),
    actionButton("Ocultar", "hide-history", room.id, "button button-small button-outline"),
  );
  historyHead.firstElementChild.id = "history-heading";
  const historyContent = createHistoryContent();
  historySection.append(historyHead, historyContent);
  card.append(historySection);
  elements.roomDetail.append(card);

  loadParticipants(room.id);
  if (room.status === "active") {
    loadRecommendations(room.id).catch(reportError);
  } else {
    loadHistory(room.id).catch(reportError);
    historySection.hidden = false;
  }
  startPresence(room);
}

function actionButton(label, action, roomId, className = "button") {
  const button = makeElement("button", className, label);
  button.type = "button";
  button.dataset.action = action;
  button.dataset.roomId = roomId;
  return button;
}

function recommendationSection(roomId) {
  const section = makeElement("section", "subsection");
  section.setAttribute("aria-labelledby", "recommendations-heading");
  const heading = makeElement("div", "subsection-heading");
  heading.append(
    makeElement("h3", "", "Recomendações"),
    makeElement("span", "muted", "As favoritas sobem no placar"),
  );
  heading.firstElementChild.id = "recommendations-heading";
  if (canSubmitRecommendation(state.room)) {
    const form = makeElement("form", "recommendation-form");
    form.id = "recommendation-form";
    form.dataset.roomId = roomId;
    form.append(
      labelledInput("Título", "recommendation-title", "title", { max: 200 }),
      labelledInput("Artista", "recommendation-artist", "artist", { max: 160 }),
      labelledInput("Link da música (YouTube, Spotify ou SoundCloud)", "recommendation-url", "url", { max: 2048 }),
      genreField(),
    );
    const submit = makeElement("button", "button");
    submit.type = "submit";
    submit.textContent = "Recomendar música";
    form.append(submit);
    section.append(heading, form);
  } else {
    section.append(heading);
  }

  const list = makeElement("ul", "recommendation-list");
  list.id = "recommendation-list";
  list.tabIndex = -1;
  const musicHeading = makeElement("div", "subsection-heading");
  musicHeading.append(makeElement("h3", "", "Placar musical"));
  const recommendationsMore = actionButton(
    "Carregar mais recomendações",
    "load-more-recommendations",
    roomId,
    "button button-outline pagination-control",
  );
  recommendationsMore.id = "recommendations-more";
  recommendationsMore.hidden = true;
  recommendationsMore.setAttribute("aria-controls", list.id);
  section.append(musicHeading, list, recommendationsMore, makePageLimitNotice("recommendations-limit"));
  return section;
}

function makePageLimitNotice(id) {
  const notice = makeElement("p", "muted pagination-limit", "Este conteúdo atingiu o limite máximo de paginação.");
  notice.id = id;
  notice.hidden = true;
  notice.setAttribute("role", "status");
  return notice;
}

function createHistoryContent() {
  const content = makeElement("div", "history-list");
  content.id = "history-content";
  content.tabIndex = -1;

  const recommendationsHeading = makeElement("h4");
  recommendationsHeading.id = "history-recommendations-heading";
  const recommendations = makeElement("ul", "history-items");
  recommendations.id = "history-recommendations-list";
  const participantsHeading = makeElement("h4");
  participantsHeading.id = "history-participations-heading";
  const participations = makeElement("ul", "history-items");
  participations.id = "history-participations-list";
  const more = actionButton(
    "Carregar mais histórico",
    "load-more-history",
    state.roomId,
    "button button-outline pagination-control",
  );
  more.id = "history-more";
  more.hidden = true;
  more.setAttribute("aria-controls", `${recommendations.id} ${participations.id}`);
  const limitNotice = makePageLimitNotice("history-limit");
  content.append(recommendationsHeading, recommendations, participantsHeading, participations, more, limitNotice);
  return content;
}

function labelledInput(labelText, id, name, { max } = {}) {
  const field = makeElement("div", "field");
  field.append(makeElement("label", "", labelText));
  const input = makeElement("input");
  input.id = id;
  input.name = name;
  input.type = name === "url" ? "url" : "text";
  input.required = true;
  input.maxLength = max;
  input.autocomplete = "off";
  field.firstElementChild.htmlFor = id;
  field.append(input);
  return field;
}

function genreField() {
  const field = makeElement("div", "field");
  const label = makeElement("label", "", "Gênero");
  label.htmlFor = "recommendation-genre";
  const select = makeElement("select");
  select.id = "recommendation-genre";
  select.name = "genre";
  select.required = true;
  const placeholder = makeElement("option", "", "Escolha um gênero");
  placeholder.value = "";
  placeholder.disabled = true;
  placeholder.selected = true;
  select.append(placeholder);
  for (const genre of genres) {
    const option = makeElement("option", "", genre);
    option.value = genre;
    select.append(option);
  }
  field.append(label, select);
  return field;
}

async function openRoom(roomId) {
  const requestToken = ++state.roomRequestToken;
  clearNotice();
  try {
    const { room } = await api(`/api/rooms/${encodeURIComponent(roomId)}`);
    if (requestToken !== state.roomRequestToken) return;
    setRoomView(room);
  } catch (error) {
    if (requestToken === state.roomRequestToken) reportError(error);
  }
}

function participantRow(participant) {
  const item = makeElement("li", "participant-row");
  item.dataset.participationId = participant.participationId;
  const avatar = avatarFor(participant.user.avatarUrl);
  if (avatar) item.append(avatar);
  item.append(makeElement("span", "participant-name", participant.user.displayName));
  const presence = makeElement("span", "presence", participant.presence === "online" ? "Online" : "Ausente");
  presence.dataset.presence = participant.presence;
  item.append(presence);
  return item;
}

function updateParticipantRow(item, participant) {
  const name = item.querySelector(".participant-name");
  if (name) name.textContent = participant.user.displayName;
  const presence = item.querySelector(".presence");
  if (presence) {
    presence.textContent = participant.presence === "online" ? "Online" : "Ausente";
    presence.dataset.presence = participant.presence;
  }
}

function updateLoadMoreButton(button, list, label, loading, hasMore) {
  if (!button) return;
  const shouldRestoreFocus = button.dataset.restoreFocus === "true"
    || (loading && document.activeElement === button);
  if (loading && shouldRestoreFocus) button.dataset.restoreFocus = "true";
  button.disabled = loading;
  button.textContent = loading ? "Carregando…" : label;
  button.hidden = !loading && !hasMore;
  if (!loading && shouldRestoreFocus) {
    delete button.dataset.restoreFocus;
    if (hasMore) button.focus();
    else list?.focus();
  }
}

async function loadParticipants(roomId, { append = false } = {}) {
  const page = state.pagination.participants;
  const list = document.querySelector("#participant-list");
  const more = document.querySelector("#participants-more");
  if (!list || state.roomId !== roomId || page.loading) return;
  const viewToken = state.roomViewToken;
  const requestId = page.requestId;
  const requestedOffset = append ? page.offset : 0;
  page.loading = true;
  list.setAttribute("aria-busy", "true");
  updateLoadMoreButton(more, list, "Carregar mais participantes", true, page.hasMore);
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/participants?limit=${PAGE_SIZE}&offset=${requestedOffset}`,
    );
    if (
      state.roomId !== roomId
      || !isCurrentPageRequest(page, viewToken, requestId)
      || !document.querySelector("#participant-list")
    ) return;
    const currentList = document.querySelector("#participant-list");
    if (!append) {
      resetPageState(page, viewToken);
      currentList.replaceChildren();
    }
    const participants = uniquePageItems(
      page.ids,
      payload.participants,
      (participant) => participant.participationId,
    );
    participants.forEach((participant) => currentList.append(participantRow(participant)));
    if (!append && payload.participants.length === 0) {
      currentList.append(makeElement("li", "muted", "Ainda não há participantes."));
    }
    updatePageState(page, payload.pagination, requestedOffset, payload.participants.length);
    const limitNotice = document.querySelector("#participants-limit");
    if (limitNotice) limitNotice.hidden = !page.limitReached;
  } catch (error) {
    if (state.roomId === roomId && isCurrentPageRequest(page, viewToken, requestId)) {
      showNotice(errorMessage(error), "error");
    }
  } finally {
    if (isCurrentPageRequest(page, viewToken, requestId)) {
      page.loading = false;
      const currentList = document.querySelector("#participant-list");
      currentList?.removeAttribute("aria-busy");
      updateLoadMoreButton(
        document.querySelector("#participants-more"),
        currentList,
        "Carregar mais participantes",
        false,
        page.hasMore,
      );
    }
  }
}

async function refreshParticipantPresence(roomId, viewToken) {
  const page = state.pagination.participants;
  if (
    state.roomId !== roomId
    || !isCurrentPageState(page, viewToken)
    || page.loading
  ) return;
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/participants?limit=${PAGE_SIZE}&offset=0`,
    );
    if (
      state.roomId !== roomId
      || !isCurrentPageState(page, viewToken)
    ) return;
    const list = document.querySelector("#participant-list");
    if (!list) return;
    if (payload.participants.length > 0 && page.ids.size === 0) {
      list.replaceChildren();
    }
    for (const participant of payload.participants) {
      const existing = Array.from(list.children)
        .find((item) => item.dataset.participationId === participant.participationId);
      if (existing) {
        updateParticipantRow(existing, participant);
      } else if (page.ids.size < PAGE_SIZE) {
        list.append(participantRow(participant));
        page.ids.add(participant.participationId);
      }
    }
    page.offset = Math.max(page.offset, page.ids.size);
    page.hasMore = page.hasMore || (
      page.offset <= MAX_PAGE_OFFSET
      && payload.pagination.hasMore
    );
    updateLoadMoreButton(
      document.querySelector("#participants-more"),
      list,
      "Carregar mais participantes",
      false,
      page.hasMore,
    );
  } catch (error) {
    if (state.roomId === roomId && isCurrentPageState(page, viewToken)) {
      showNotice(errorMessage(error), "error");
    }
  }
}

async function loadRecommendations(roomId, { append = false } = {}) {
  const page = state.pagination.recommendations;
  const list = document.querySelector("#recommendation-list");
  const more = document.querySelector("#recommendations-more");
  if (!list || state.roomId !== roomId || page.loading) return;
  const viewToken = state.roomViewToken;
  const requestId = page.requestId;
  const requestedOffset = append ? page.offset : 0;
  const query = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(requestedOffset),
  });
  if (append && page.rankingVersion) {
    query.set("rankingVersion", page.rankingVersion);
  }
  let refreshAfterRankingChange = false;
  page.loading = true;
  list.setAttribute("aria-busy", "true");
  updateLoadMoreButton(more, list, "Carregar mais recomendações", true, page.hasMore);
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/recommendations?${query}`,
    );
    if (
      state.roomId !== roomId
      || !isCurrentPageRequest(page, viewToken, requestId)
      || !document.querySelector("#recommendation-list")
    ) return;
    const currentList = document.querySelector("#recommendation-list");
    if (!append) {
      resetPageState(page, viewToken);
      currentList.replaceChildren();
    }
    const firstIndex = page.ids.size;
    const recommendations = uniquePageItems(
      page.ids,
      payload.recommendations,
      (recommendation) => recommendation.id,
    );
    recommendations.forEach((recommendation, index) => {
      currentList.append(recommendationCard(recommendation, firstIndex + index));
    });
    if (!append && payload.recommendations.length === 0) {
      currentList.append(makeElement("li", "muted", "Ninguém recomendou uma faixa ainda. Seja a primeira pessoa!"));
    }
    page.rankingVersion = payload.pagination.rankingVersion ?? null;
    updatePageState(page, payload.pagination, requestedOffset, payload.recommendations.length);
    const limitNotice = document.querySelector("#recommendations-limit");
    if (limitNotice) limitNotice.hidden = !page.limitReached;
  } catch (error) {
    if (state.roomId === roomId && isCurrentPageRequest(page, viewToken, requestId)) {
      if (append && error instanceof ApiError && error.code === "RANKING_CHANGED") {
        showNotice("A pontuação mudou; atualizando o placar.", "info");
        refreshAfterRankingChange = true;
      } else {
        showNotice(errorMessage(error), "error");
      }
    }
  } finally {
    if (isCurrentPageRequest(page, viewToken, requestId)) {
      page.loading = false;
      const currentList = document.querySelector("#recommendation-list");
      currentList?.removeAttribute("aria-busy");
      updateLoadMoreButton(
        document.querySelector("#recommendations-more"),
        currentList,
        "Carregar mais recomendações",
        false,
        page.hasMore,
      );
    }
  }
  if (
    refreshAfterRankingChange
    && state.roomId === roomId
    && isCurrentPageState(page, viewToken)
  ) {
    invalidatePageState(page);
    await loadRecommendations(roomId);
  }
}

function recommendationCard(recommendation, index) {
  const item = makeElement("li", `recommendation-item${index < 3 ? " top-ranked" : ""}`);
  const main = makeElement("div", "recommendation-main");
  const copy = makeElement("div", "recommendation-copy");
  const title = makeElement("h4", "", recommendation.title);
  const artist = makeElement("p", "", recommendation.artist);
  const genre = makeElement("p", "", recommendation.genre);
  const author = makeElement("p", "recommendation-author", `Por ${recommendation.author.displayName}`);
  copy.append(title, artist, genre, author);
  main.append(copy);
  item.append(main);

  const actions = makeElement("div", "recommendation-actions");
  const voteGroup = makeElement("div", "vote-buttons");
  for (const [value, label] of [[1, "↑ Gostei"], [-1, "↓ Não gostei"]]) {
    const button = makeElement("button", "vote-button", label);
    button.type = "button";
    button.dataset.action = "vote";
    button.dataset.recommendationId = recommendation.id;
    button.dataset.value = String(value);
    button.setAttribute("aria-pressed", String(recommendation.userVote === value));
    button.disabled = !state.user || !state.room?.isParticipant;
    voteGroup.append(button);
  }
  actions.append(voteGroup);
  actions.append(makeElement("span", "score", `Pontuação ${recommendation.score}`));
  if (recommendation.externalUrl && ["youtube", "spotify", "soundcloud"].includes(recommendation.provider)) {
    const providerNames = { youtube: "YouTube", spotify: "Spotify", soundcloud: "SoundCloud" };
    const link = makeElement("a", "provider-link", `Abrir no ${providerNames[recommendation.provider]} ↗`);
    link.href = recommendation.externalUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    actions.append(link);
  }
  if (canRemoveRecommendation(state.user, state.room, recommendation)) {
    const removeButton = makeElement("button", "button button-small button-danger", "Remover");
    removeButton.type = "button";
    removeButton.dataset.action = "remove-recommendation";
    removeButton.dataset.recommendationId = recommendation.id;
    removeButton.setAttribute("aria-label", `Remover recomendação ${recommendation.title}`);
    actions.append(removeButton);
  }
  item.append(actions);
  return item;
}

async function loadHistory(roomId, options = {}) {
  return loadHistoryPage(roomId, options);
}

async function loadHistoryPage(roomId, { append = false } = {}) {
  const page = state.pagination.history;
  const content = document.querySelector("#history-content");
  const more = document.querySelector("#history-more");
  if (!content || state.roomId !== roomId || page.loading) return;
  const viewToken = state.roomViewToken;
  const requestId = page.requestId;
  const requestedOffset = append ? page.offset : 0;
  page.loading = true;
  content.setAttribute("aria-busy", "true");
  updateLoadMoreButton(more, content, "Carregar mais histórico", true, page.hasMore);
  try {
    const payload = await api(
      `/api/rooms/${encodeURIComponent(roomId)}/history?limit=${PAGE_SIZE}&offset=${requestedOffset}`,
    );
    if (
      state.roomId !== roomId
      || !isCurrentPageRequest(page, viewToken, requestId)
      || !document.querySelector("#history-content")
    ) return;
    let currentContent = document.querySelector("#history-content");
    if (!append) {
      resetPageState(page, viewToken);
      state.pagination.historyRecommendationIds = new Set();
      state.pagination.historyParticipationIds = new Set();
      currentContent = createHistoryContent();
    }
    currentContent.querySelector("#history-recommendations-heading").textContent =
      `Recomendações (${payload.counts.recommendations})`;
    currentContent.querySelector("#history-participations-heading").textContent =
      `Participações (${payload.counts.participations})`;

    const recommendationsList = currentContent.querySelector("#history-recommendations-list");
    const recommendations = uniquePageItems(
      state.pagination.historyRecommendationIds,
      payload.recommendations,
      (recommendation) => recommendation.id,
    );
    for (const recommendation of recommendations) {
      const entry = makeElement("li", "history-item");
      entry.append(
        makeElement("strong", "", recommendation.title),
        makeElement("p", "", `${recommendation.artist} · ${recommendation.genre} · ${recommendation.status === "removed" ? "Removida" : "Ativa"}`),
        makeElement("p", "", `Por ${recommendation.author.displayName} · ${displayDate(recommendation.createdAt)}`),
      );
      recommendationsList.append(entry);
    }
    if (payload.counts.recommendations === 0 && recommendationsList.children.length === 0) {
      recommendationsList.append(makeElement("li", "muted", "Sem recomendações no histórico."));
    }

    const participationsList = currentContent.querySelector("#history-participations-list");
    const participations = uniquePageItems(
      state.pagination.historyParticipationIds,
      payload.participations,
      (participation) => participation.participationId,
    );
    for (const participation of participations) {
      const entry = makeElement("li", "history-item");
      const exit = participation.leftAt ? ` · saiu ${displayDate(participation.leftAt)}` : " · presença aberta";
      entry.append(
        makeElement("strong", "", participation.user.displayName),
        makeElement("p", "", `Entrou ${displayDate(participation.joinedAt)}${exit}`),
      );
      participationsList.append(entry);
    }
    if (payload.counts.participations === 0 && participationsList.children.length === 0) {
      participationsList.append(makeElement("li", "muted", "Sem participações no histórico."));
    }

    const nextOffsets = [
      payload.pagination.recommendations,
      payload.pagination.participations,
    ]
      .filter((pagination) => pagination.hasMore && Number.isInteger(pagination.nextOffset))
      .map((pagination) => pagination.nextOffset);
    const historyPagination = {
      hasMore: nextOffsets.length > 0,
      nextOffset: nextOffsets.length > 0 ? Math.max(...nextOffsets) : null,
    };
    updatePageState(
      page,
      historyPagination,
      requestedOffset,
      Math.max(payload.recommendations.length, payload.participations.length),
    );
    if (!append) {
      document.querySelector("#history-content").replaceWith(currentContent);
    }
    const limitNotice = document.querySelector("#history-limit");
    if (limitNotice) limitNotice.hidden = !page.limitReached;
  } catch (error) {
    if (state.roomId === roomId && isCurrentPageRequest(page, viewToken, requestId)) {
      showNotice(errorMessage(error), "error");
    }
  } finally {
    if (isCurrentPageRequest(page, viewToken, requestId)) {
      page.loading = false;
      const currentContent = document.querySelector("#history-content");
      currentContent?.removeAttribute("aria-busy");
      updateLoadMoreButton(
        document.querySelector("#history-more"),
        currentContent,
        "Carregar mais histórico",
        false,
        page.hasMore,
      );
    }
  }
}

function startPresence(room) {
  if (state.presenceTimer) clearInterval(state.presenceTimer);
  state.presenceTimer = null;
  if (room.status !== "active" || !room.isParticipant) return;
  const viewToken = state.roomViewToken;
  state.presenceTimer = setInterval(async () => {
    if (state.roomId !== room.id || state.roomViewToken !== viewToken) return;
    try {
      await api(`/api/rooms/${encodeURIComponent(room.id)}/presence`, { method: "POST" });
      await refreshParticipantPresence(room.id, viewToken);
    } catch (error) {
      if (state.roomId === room.id && state.roomViewToken === viewToken) {
        showNotice(errorMessage(error), "error");
      }
    }
  }, PRESENCE_INTERVAL_MS);
}


async function createRoom(event) {
  event.preventDefault();
  if (!state.user) {
    showNotice("Entre com o Discord para criar uma sala.", "error");
    return;
  }
  setBusy(elements.createRoomForm, true);
  try {
    const payload = await api("/api/rooms", {
      method: "POST",
      body: JSON.stringify({
        name: elements.roomName.value,
        description: elements.roomDescription.value,
        category: elements.roomCategory.value,
        visibility: "public",
      }),
    });
    elements.createRoomForm.reset();
    elements.roomCategory.value = "Estudo e programação";
    showNotice("Sala criada. Você já está participando.");
    await loadRooms();
    await openRoom(payload.room.id);
  } catch (error) {
    reportError(error);
  } finally {
    setBusy(elements.createRoomForm, false);
  }
}

async function submitRecommendation(form) {
  const formData = new FormData(form);
  const body = {
    title: String(formData.get("title") ?? ""),
    artist: String(formData.get("artist") ?? ""),
    genre: String(formData.get("genre") ?? ""),
    url: String(formData.get("url") ?? ""),
  };
  setBusy(form, true);
  try {
    await api(`/api/rooms/${encodeURIComponent(form.dataset.roomId)}/recommendations`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    form.reset();
    showNotice("Recomendação adicionada à sala.");
    await loadRecommendations(form.dataset.roomId);
  } catch (error) {
    reportError(error);
  } finally {
    setBusy(form, false);
  }
}

async function joinRoom(roomId) {
  await api(`/api/rooms/${encodeURIComponent(roomId)}/join`, { method: "POST" });
  showNotice("Você entrou na sala.");
  await loadRooms();
  await openRoom(roomId);
}

async function leaveRoom(roomId) {
  await api(`/api/rooms/${encodeURIComponent(roomId)}/leave`, { method: "POST" });
  showNotice("Você saiu da sala.");
  await loadRooms();
  await openRoom(roomId);
}

async function closeRoom(roomId) {
  if (!window.confirm("Encerrar esta sala? A ação é permanente.")) return;
  await api(`/api/rooms/${encodeURIComponent(roomId)}/close`, { method: "POST" });
  showNotice("Sala encerrada.");
  await loadRooms();
  await openRoom(roomId);
}

async function castVote(button) {
  const recommendationId = encodeURIComponent(button.dataset.recommendationId);
  const value = Number(button.dataset.value);
  const active = button.getAttribute("aria-pressed") === "true";
  if (active) {
    await api(`/api/recommendations/${recommendationId}/vote`, { method: "DELETE" });
  } else {
    await api(`/api/recommendations/${recommendationId}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
  }
  await loadRecommendations(state.roomId);
}

async function removeRecommendation(button) {
  if (!window.confirm("Remover esta recomendação? Ela continuará disponível no histórico.")) return;
  const recommendationId = encodeURIComponent(button.dataset.recommendationId);
  const roomId = state.roomId;
  const viewToken = state.roomViewToken;
  await api(`/api/recommendations/${recommendationId}`, { method: "DELETE" });
  if (state.roomId !== roomId || state.roomViewToken !== viewToken) return;
  showNotice("Recomendação removida. Ela permanece no histórico.");
  invalidatePageState(state.pagination.recommendations);
  invalidatePageState(state.pagination.history);
  await loadRecommendations(roomId);
  const historySection = document.querySelector("#history-section");
  if (historySection && !historySection.hidden) {
    await loadHistory(roomId);
  }
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  state.user = null;
  if (state.roomId) await openRoom(state.roomId);
  await loadCurrentUser();
  await loadRooms();
  showNotice("Você saiu da sua conta.");
}

elements.createRoomForm.addEventListener("submit", createRoom);
elements.refreshRooms.addEventListener("click", () => loadRooms());
elements.moreRooms.addEventListener("click", () => loadRooms({ append: true }));
elements.logoutButton.addEventListener("click", () => logout().catch(reportError));

elements.roomDetail.addEventListener("submit", (event) => {
  if (event.target.id === "recommendation-form") {
    event.preventDefault();
    submitRecommendation(event.target);
  }
});



elements.roomDetail.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  try {
    switch (button.dataset.action) {
      case "join-room":
        await joinRoom(button.dataset.roomId);
        break;
      case "leave-room":
        await leaveRoom(button.dataset.roomId);
        break;
      case "close-room":
        await closeRoom(button.dataset.roomId);
        break;
      case "refresh-room":
        await openRoom(button.dataset.roomId);
        break;
      case "show-history":
        document.querySelector("#history-section").hidden = false;
        await loadHistory(button.dataset.roomId);
        break;
      case "hide-history":
        document.querySelector("#history-section").hidden = true;
        break;
      case "load-more-participants":
        await loadParticipants(button.dataset.roomId, { append: true });
        break;
      case "load-more-recommendations":
        await loadRecommendations(button.dataset.roomId, { append: true });
        break;
      case "load-more-history":
        await loadHistory(button.dataset.roomId, { append: true });
        break;
      case "vote":
        await castVote(button);
        break;
      case "remove-recommendation":
        await removeRecommendation(button);
        break;
      default:
        break;
    }
  } catch (error) {
    reportError(error);
  }
});

async function initialize() {
  const params = new URLSearchParams(location.search);
  const authError = params.get("auth_error");
  if (authError) {
    const messages = {
      state: "Não foi possível validar o início do login. Tente novamente.",
      denied: "O login com Discord foi cancelado.",
      callback: "O retorno do Discord estava incompleto. Tente novamente.",
      oauth: "O Discord não concluiu o login. Tente novamente.",
      profile: "Não foi possível consultar seu perfil do Discord.",
      provider_unavailable: "O serviço de autenticação está temporariamente indisponível.",
    };
    showNotice(messages[authError] ?? "Não foi possível concluir o login.", "error");
    history.replaceState(null, "", location.pathname);
  }

  try {
    await loadCurrentUser();
  } catch (error) {
    elements.sessionMessage.textContent = errorMessage(error);
    showNotice(errorMessage(error), "error");
  }
  await loadRooms();

  const roomId = params.get("room");
  if (roomId && /^[A-Za-z0-9_-]{1,64}$/u.test(roomId)) {
    await openRoom(roomId);
  }
}

initialize().catch(reportError);
