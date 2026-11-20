import { api } from "./js/api.js";
import { avatarImage, byId, element, emptyState, setMessage } from "./js/dom.js";
import { renderMarkdown } from "./js/markdown.js";
import { excerpt, formatDate, readingTime, splitTags } from "./js/text.js";

const PAGE_SIZE = 10;
const DRAFT_KEY = "entrelinhas:rascunho";

const state = {
  user: null,
  articles: [],
  rooms: [],
  tags: [],
  author: null,
  roomId: null,
  tag: null,
  query: "",
  cursor: null,
  hasMore: false,
  loading: false,
  editingId: null,
  adminRoomId: null,
};

let draftTimer = null;

const SIGNED_IN_CONTROLS = [
  "logoutButton", "profileChip", "myArticlesButton", "newArticleButton", "newRoomButton", "aboutWriteButton",
];

function updateAuthUI() {
  const signedIn = Boolean(state.user);
  for (const id of SIGNED_IN_CONTROLS) byId(id).hidden = !signedIn;
  byId("loginLink").hidden = signedIn;
  if (!state.user) return;
  const chip = byId("profileChip");
  const name = element("span", { className: "profile-name", text: `Olá, ${state.user.username}` });
  chip.replaceChildren(avatarImage(state.user.avatar, "avatar profile-avatar"), name);
  chip.title = state.user.username;
}

function updateURL() {
  const url = new URL(location.href);
  for (const key of ["author", "room", "tag", "q"]) url.searchParams.delete(key);
  if (state.author) url.searchParams.set("author", state.author.user_id);
  if (state.roomId) url.searchParams.set("room", state.roomId);
  if (state.tag) url.searchParams.set("tag", state.tag);
  if (state.query) url.searchParams.set("q", state.query);
  history.replaceState({}, "", url);
}

async function loadAuth() {
  state.user = (await api("/api/auth/me")).user;
  updateAuthUI();
}

async function loadRooms() {
  state.rooms = (await api("/api/rooms")).rooms;
  renderRooms();
  renderRoomOptions();
  renderOwnerOptions();
}

async function loadTags() {
  try {
    state.tags = (await api("/api/tags")).tags;
  } catch {
    state.tags = [];
  }
  renderTags();
}

function roomBadge(visibility) {
  return visibility === "private" ? "◆" : "#";
}

function focusInvite(value, message) {
  byId("roomInvite").value = value;
  setMessage(byId("roomMessage"), message);
  byId("roomInvite").focus();
}

function openRoom(room) {
  if (room.visibility === "private" && !room.is_member) {
    focusInvite(
      room.room_code || "",
      room.room_code
        ? "Sala privada: o código já está preenchido, clique em “Entrar com o código” (o dono pode exigir aprovação)."
        : "Sala privada: peça o código da sala para o dono.",
    );
    return;
  }
  state.roomId = String(room.id);
  state.author = null;
  updateURL();
  renderRooms();
  loadArticles();
}

function requestJoin(room) {
  if (room.visibility === "private") {
    focusInvite(
      room.room_code || "",
      room.room_code
        ? "Sala privada: o código já está preenchido, clique em “Entrar com o código” (o dono pode exigir aprovação)."
        : "Sala privada: peça o código da sala para o dono.",
    );
    return;
  }
  joinRoom(room.id);
}

// O dono vê o código hash da própria sala privada para compartilhar no lugar do id.
function roomCodeRow(room) {
  const copy = element("button", {
    className: "room-code-copy",
    text: "Copiar",
    attrs: { type: "button", title: "Copiar o código da sala", "aria-label": `Copiar o código da sala ${room.name}` },
  });
  copy.addEventListener("click", async () => {
    if (!navigator.clipboard) {
      byId("roomInvite").value = room.room_code;
      byId("roomInvite").focus();
      return;
    }
    try {
      await navigator.clipboard.writeText(room.room_code);
      copy.textContent = "Copiado";
    } catch {
      byId("roomInvite").value = room.room_code;
      byId("roomInvite").focus();
    }
  });
  return element("p", { className: "room-code" }, [
    element("span", { className: "room-code-label", text: "Código" }),
    element("code", { text: room.room_code }),
    copy,
  ]);
}

function renderRooms() {
  const container = byId("roomList");
  container.replaceChildren();
  if (!state.rooms.length) {
    container.append(element("p", { className: "muted", text: "Ainda não há salas. Crie a primeira!" }));
    return;
  }

  for (const room of state.rooms) {
    const name = element("button", {
      className: "room-name",
      attrs: { type: "button" },
      on: { click: () => openRoom(room) },
    });
    name.append(
      element("span", { className: "room-symbol", text: roomBadge(room.visibility), attrs: { "aria-hidden": "true" } }),
      element("span", { text: room.name }),
    );

    const controls = element("span", { className: "room-controls" });
    if (room.pending_count > 0) {
      controls.append(element("span", {
        className: "room-badge",
        text: `${room.pending_count} pedido${room.pending_count > 1 ? "s" : ""}`,
        attrs: { title: "Pedidos de entrada esperando a sua aprovação" },
      }));
    }
    controls.append(element("span", { className: "room-count", text: `${room.member_count} membros` }));

    if (state.user && !room.is_member) {
      controls.append(element("button", {
        className: "room-join",
        text: room.visibility === "public" ? "Entrar" : "Entrar com código",
        attrs: { type: "button" },
        on: { click: () => requestJoin(room) },
      }));
    }

    if (state.user && room.is_member && room.owner_id !== state.user.userId) {
      controls.append(element("button", {
        className: "room-join",
        text: "Sair",
        attrs: { type: "button", title: `Deixar a sala ${room.name}`, "aria-label": `Sair da sala ${room.name}` },
        on: { click: () => leaveRoom(room) },
      }));
    }

    if (state.user && room.owner_id === state.user.userId && room.visibility === "private") {
      controls.append(element("button", {
        className: "room-join",
        text: room.pending_count ? `Gerenciar (${room.pending_count})` : "Gerenciar",
        attrs: { type: "button", title: "Aprovar pedidos e remover membros desta sala" },
        on: { click: () => openRoomAdmin(room) },
      }));
    }

    const selected = String(state.roomId) === String(room.id);
    const item = element("div", { className: `room-item${selected ? " selected" : ""}` }, [name, controls]);
    if (state.user && room.owner_id === state.user.userId && room.visibility === "private" && room.room_code) {
      item.append(roomCodeRow(room));
    }
    container.append(item);
  }
}

function renderTags() {
  const container = byId("tagList");
  container.replaceChildren();
  if (!state.tags.length) {
    container.append(element("p", { className: "muted", text: "Nenhuma etiqueta ainda." }));
    return;
  }
  for (const item of state.tags) {
    container.append(element("button", {
      className: `tag-chip${state.tag === item.tag ? " selected" : ""}`,
      text: `#${item.tag} ${item.total}`,
      attrs: {
        type: "button",
        "aria-pressed": String(state.tag === item.tag),
        title: `Ver artigos com a etiqueta ${item.tag}`,
      },
      on: { click: () => toggleTag(item.tag) },
    }));
  }
}

function toggleTag(tag) {
  state.tag = state.tag === tag ? null : tag;
  state.author = null;
  state.roomId = null;
  updateURL();
  renderRooms();
  renderTags();
  loadArticles();
}

function updatePolicyHint() {
  byId("roomPolicyHint").textContent = byId("roomPolicy").value === "approval"
    ? "Quem tiver o ID só envia um pedido: entra apenas quem você aprovar na lista abaixo."
    : "Quem tiver o ID entra direto, sem passar por você.";
}

async function openRoomAdmin(room) {
  state.adminRoomId = String(room.id);
  byId("roomAdmin").hidden = false;
  byId("roomAdminName").textContent = `${room.name} · ${room.member_count} membros`;
  byId("roomPolicy").value = room.join_policy || "open_link";
  updatePolicyHint();
  setMessage(byId("roomAdminMessage"), "");
  await Promise.all([loadJoinRequests(room.id), loadRoomMembers(room.id), refreshOwnerOptions(room.id)]);
  // Foco no título: quem usa teclado/leitor de tela sabe que o painel abriu.
  byId("roomAdminHeading").focus();
  byId("roomAdmin").scrollIntoView({ behavior: "smooth", block: "start" });
}

function userRow(person, action) {
  return element("div", { className: "room-member" }, [
    element("span", { className: "member-name" }, [
      avatarImage(person.avatar),
      element("span", { text: person.username }),
    ]),
    action,
  ]);
}

async function loadRoomMembers(roomId) {
  const container = byId("roomMembers");
  container.replaceChildren(element("p", { className: "muted", text: "Carregando membros..." }));
  try {
    const { members, blocked = [], ownerId } = await api(`/api/rooms/${roomId}/members`);
    container.replaceChildren();

    if (!members.length) {
      container.append(element("p", { className: "muted", text: "Ninguém na sala ainda." }));
    }
    for (const member of members) {
      const isOwner = member.user_id === ownerId;
      container.append(userRow(member, isOwner
        ? element("span", {
          className: "room-count",
          text: "dono",
          attrs: { title: "O dono da sala não pode ser removido" },
        })
        : element("button", {
          className: "button button-small",
          text: "Remover",
          attrs: {
            type: "button",
            title: `Tira o acesso de ${member.username} e bloqueia a volta até você liberar`,
            "aria-label": `Remover ${member.username} da sala`,
          },
          on: { click: () => removeMember(roomId, member.user_id, member.username) },
        })));
    }

    if (!blocked.length) return;
    container.append(element("p", { className: "eyebrow admin-eyebrow", text: "SEM ACESSO (REMOVIDOS)" }));
    for (const person of blocked) {
      container.append(userRow(person, element("button", {
        className: "button button-small",
        text: "Permitir de novo",
        attrs: {
          type: "button",
          title: `Libera ${person.username} a pedir entrada novamente`,
          "aria-label": `Permitir que ${person.username} peça entrada novamente`,
        },
        on: { click: () => allowMember(roomId, person.user_id, person.username) },
      })));
    }
  } catch (error) {
    container.replaceChildren(element("p", { className: "form-message", text: error.message }));
  }
}

async function allowMember(roomId, userId, username) {
  try {
    await api(`/api/rooms/${roomId}/blocks?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    setMessage(byId("roomAdminMessage"), `${username} pode pedir entrada de novo.`, true);
    await loadRoomMembers(roomId);
  } catch (error) {
    setMessage(byId("roomAdminMessage"), error.message);
  }
}

async function removeMember(roomId, userId, username) {
  if (!window.confirm(`Remover ${username} da sala? A pessoa perde o acesso aos artigos e só volta se você liberar.`)) return;
  try {
    await api(`/api/rooms/${roomId}/members?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    setMessage(
      byId("roomAdminMessage"),
      `${username} foi removido e não pode pedir entrada até você liberar.`,
      true,
    );
    await Promise.all([loadRoomMembers(roomId), loadRooms()]);
  } catch (error) {
    setMessage(byId("roomAdminMessage"), error.message);
  }
}

async function loadJoinRequests(roomId) {
  const container = byId("joinRequests");
  container.replaceChildren(element("p", { className: "muted", text: "Carregando pedidos..." }));
  try {
    const { requests } = await api(`/api/rooms/${roomId}/requests`);
    container.replaceChildren();
    if (!requests.length) {
      container.append(element("p", { className: "muted", text: "Nenhum pedido pendente." }));
      return;
    }
    for (const request of requests) {
      container.append(element("div", { className: "join-request" }, [
        element("span", { text: request.username }),
        element("span", { className: "request-actions" }, [
          element("button", {
            className: "button button-small button-primary",
            text: "Aprovar",
            attrs: {
              type: "button",
              title: `Dá acesso à sala para ${request.username}`,
              "aria-label": `Aprovar pedido de ${request.username}`,
            },
            on: { click: () => decideJoinRequest(roomId, request.user_id, "approve") },
          }),
          element("button", {
            className: "button button-small",
            text: "Recusar",
            attrs: {
              type: "button",
              title: `Recusa o pedido de ${request.username} e mantém a pessoa fora`,
              "aria-label": `Recusar pedido de ${request.username}`,
            },
            on: { click: () => decideJoinRequest(roomId, request.user_id, "reject") },
          }),
        ]),
      ]));
    }
  } catch (error) {
    container.replaceChildren(element("p", { className: "form-message", text: error.message }));
  }
}

async function decideJoinRequest(roomId, userId, action) {
  try {
    await api(`/api/rooms/${roomId}/requests`, { method: "POST", body: JSON.stringify({ userId, action }) });
    setMessage(byId("roomAdminMessage"), action === "approve" ? "Pedido aprovado." : "Pedido recusado.", true);
    await Promise.all([loadJoinRequests(roomId), loadRoomMembers(roomId), loadRooms()]);
  } catch (error) {
    setMessage(byId("roomAdminMessage"), error.message);
  }
}

async function leaveRoom(room) {
  if (!window.confirm(`Sair da sala "${room.name}"? Você pode pedir entrada de novo depois.`)) return;
  try {
    await api(`/api/rooms/${room.id}/leave`, { method: "POST", body: "{}" });
    if (String(state.roomId) === String(room.id)) {
      state.roomId = null;
      updateURL();
      await loadArticles();
    }
    await loadRooms();
    setMessage(byId("roomMessage"), `Você saiu da sala ${room.name}.`, true);
  } catch (error) {
    setMessage(byId("roomMessage"), error.message);
  }
}

async function deleteRoom(roomId) {
  if (!window.confirm("Excluir esta sala? Os artigos continuam publicados na página pública do blog.")) return;
  try {
    await api(`/api/rooms/${roomId}`, { method: "DELETE" });
    byId("roomAdmin").hidden = true;
    state.adminRoomId = null;
    if (String(state.roomId) === String(roomId)) state.roomId = null;
    updateURL();
    await Promise.all([loadRooms(), loadArticles()]);
    setMessage(byId("roomMessage"), "Sala excluída. Os artigos foram para a página pública.", true);
  } catch (error) {
    setMessage(byId("roomAdminMessage"), error.message);
  }
}

async function transferRoom(roomId) {
  const select = byId("newOwnerSelect");
  const ownerId = select.value;
  if (!ownerId) {
    setMessage(byId("roomAdminMessage"), "Escolha um membro para receber a sala.");
    return;
  }
  if (!window.confirm(`Transferir a sala para ${select.selectedOptions[0].textContent}? Você deixa de ser dono.`)) return;
  try {
    await api(`/api/rooms/${roomId}`, { method: "PATCH", body: JSON.stringify({ ownerId }) });
    byId("roomAdmin").hidden = true;
    state.adminRoomId = null;
    await loadRooms();
    setMessage(byId("roomMessage"), "Sala transferida.", true);
  } catch (error) {
    setMessage(byId("roomAdminMessage"), error.message);
  }
}

function renderOwnerOptions() {
  const select = byId("newOwnerSelect");
  const room = state.rooms.find((item) => String(item.id) === String(state.adminRoomId));
  const previous = select.value;
  select.replaceChildren(new Option("Escolha um membro…", ""));
  if (!room || !state.adminRoomId) return;
  for (const member of room.memberList || []) {
    if (member.user_id === room.owner_id) continue;
    select.add(new Option(member.username, member.user_id));
  }
  if ([...select.options].some((option) => option.value === previous)) select.value = previous;
}

async function refreshOwnerOptions(roomId) {
  try {
    const { members, ownerId } = await api(`/api/rooms/${roomId}/members`);
    const room = state.rooms.find((item) => String(item.id) === String(roomId));
    if (!room) return;
    room.owner_id = ownerId;
    room.memberList = members;
    renderOwnerOptions();
  } catch {
    /* o painel continua utilizável sem a transferência */
  }
}

function renderRoomOptions() {
  const select = byId("articleRoom");
  const selected = select.value;
  select.replaceChildren(new Option("Página pública do blog", ""));
  for (const room of state.rooms.filter((item) => item.is_member || item.visibility === "public")) {
    const suffix = room.visibility === "private" ? "privada" : "pública";
    select.add(new Option(`${room.name} · ${suffix}`, room.id));
  }
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function emptyFeedMessage() {
  if (state.query) return `Nenhum artigo encontrado para "${state.query}".`;
  if (state.tag) return `Nenhum artigo com a etiqueta #${state.tag}.`;
  if (state.author) return "Este autor ainda não publicou artigos visíveis para você.";
  if (state.roomId) return "Esta sala ainda não tem artigos.";
  return "Ainda não há artigos. Seja a primeira pessoa a publicar!";
}

function feedHeading() {
  if (state.query) return `Busca: ${state.query}`;
  if (state.tag) return `#${state.tag}`;
  if (state.author) return `Artigos de ${state.author.username}`;
  if (state.roomId) {
    return state.rooms.find((room) => String(room.id) === String(state.roomId))?.name || "Artigos da sala";
  }
  return "Artigos recentes";
}

function syncLikeButton(button, article) {
  const liked = Boolean(article.liked);
  const total = Number(article.like_count) || 0;
  button.className = `action-button${liked ? " liked" : ""}`;
  button.textContent = `${liked ? "♥" : "♡"} ${total}`;
  button.setAttribute("aria-pressed", String(liked));
  button.setAttribute("aria-label", `${liked ? "Remover curtida" : "Curtir artigo"} (${total} curtidas)`);
}

function articleCard(article) {
  const author = element("button", {
    className: "author-button",
    attrs: { type: "button" },
    on: { click: () => showAuthor(article.author_id) },
  });
  author.append(avatarImage(article.author_avatar), element("span", { text: article.author_name }));

  const meta = element("div", { className: "article-meta" });
  meta.append(
    author,
    element("span", { className: "meta-dot", text: "·" }),
    element("time", { text: formatDate(article.created_at), attrs: { datetime: article.created_at || "" } }),
    element("span", { className: "meta-dot", text: "·" }),
    element("span", { text: `${readingTime(article.body)} min` }),
  );
  if (article.room_name) {
    const isPrivate = article.room_visibility === "private";
    meta.append(element("span", {
      className: `room-tag${isPrivate ? " private" : ""}`,
      text: `${roomBadge(article.room_visibility)} ${article.room_name}`,
    }));
  }

  const tags = splitTags(article.tags);
  const tagRow = tags.length
    ? element("div", { className: "card-tags" }, tags.map((tag) => element("button", {
      className: "tag-chip",
      text: `#${tag}`,
      attrs: { type: "button", "aria-label": `Filtrar por ${tag}` },
      on: { click: () => toggleTag(tag) },
    })))
    : null;

  const like = element("button", {
    className: "action-button",
    attrs: { type: "button", "data-action": "like", "data-id": String(article.id) },
  });
  syncLikeButton(like, article);

  const actions = element("div", { className: "article-actions" }, [
    like,
    element("a", {
      className: "action-button",
      text: `◷ ${article.comment_count || 0} comentários`,
      attrs: { href: `/artigo/${article.slug}#comments`, "data-action": "comments", "data-id": String(article.id) },
    }),
  ]);

  if (state.user?.userId === article.author_id) {
    actions.append(
      element("button", {
        className: "action-button owner-action",
        text: "Editar",
        attrs: { type: "button" },
        on: { click: () => openEditor(article) },
      }),
      element("button", {
        className: "action-button owner-action",
        text: "Excluir",
        attrs: { type: "button" },
        on: { click: () => deleteArticle(article.id) },
      }),
    );
  }

  const card = element("article", { className: "article-card" }, [
    meta,
    element("a", {
      className: "article-title",
      text: article.title,
      attrs: { href: `/artigo/${article.slug}` },
    }),
    element("p", { className: "article-excerpt", text: excerpt(article.body) }),
  ]);
  if (tagRow) card.append(tagRow);
  card.append(actions);
  return card;
}

function renderArticles() {
  const list = byId("articleList");
  list.replaceChildren();
  if (!state.articles.length) {
    list.append(emptyState(emptyFeedMessage()));
    return;
  }
  for (const article of state.articles) list.append(articleCard(article));
}

function updateFeedChrome() {
  byId("feedHeading").textContent = feedHeading();
  byId("feedEyebrow").textContent = state.query
    ? "RESULTADO DA BUSCA"
    : state.tag
      ? "ARTIGOS POR ASSUNTO"
      : state.author
        ? "PÁGINA DO AUTOR"
        : state.roomId
          ? "CONVERSA EM GRUPO"
          : "DA COMUNIDADE";
  const filtering = Boolean(state.author || state.roomId || state.tag || state.query);
  byId("clearFilterButton").hidden = !filtering;
  byId("loadMoreButton").hidden = !state.hasMore;
  byId("feedStatus").textContent = state.loading
    ? "Carregando..."
    : state.articles.length
      ? `${state.articles.length} artigo${state.articles.length > 1 ? "s" : ""}${state.hasMore ? ", há mais" : ""}`
      : "";
}

async function loadArticles({ append = false } = {}) {
  const list = byId("articleList");
  state.loading = true;
  if (!append) {
    state.cursor = null;
    list.replaceChildren(emptyState("Carregando artigos..."));
  }
  updateFeedChrome();

  const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
  if (state.author) params.set("author", state.author.user_id);
  if (state.roomId) params.set("room", state.roomId);
  if (state.tag) params.set("tag", state.tag);
  if (state.query) params.set("q", state.query);
  if (append && state.cursor) params.set("cursor", String(state.cursor));

  try {
    const result = await api(`/api/articles?${params}`);
    state.articles = append ? [...state.articles, ...result.articles] : result.articles;
    state.cursor = result.nextCursor;
    state.hasMore = Boolean(result.hasMore);
    renderArticles();
  } catch (error) {
    list.replaceChildren(emptyState(`Não foi possível carregar os artigos: ${error.message}`));
  } finally {
    state.loading = false;
    updateFeedChrome();
  }
}

async function showAuthor(authorId) {
  try {
    state.author = (await api(`/api/authors/${encodeURIComponent(authorId)}`)).author;
    state.roomId = null;
    state.tag = null;
    state.query = "";
    byId("searchInput").value = "";
    updateURL();
    renderTags();
    await loadArticles();
    byId("feedHeading").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    window.alert(error.message);
  }
}

function setPreviewMode(previewing) {
  byId("markdownPreview").innerHTML = renderMarkdown(byId("articleBody").value);
  byId("markdownPreview").hidden = !previewing;
  byId("articleBody").hidden = previewing;
  byId("previewButton").textContent = previewing ? "Voltar ao texto" : "Pré-visualizar";
  byId("previewButton").setAttribute("aria-pressed", String(previewing));
}

function readDraft() {
  try {
    return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null");
  } catch {
    return null;
  }
}

function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
  byId("draftNote").textContent = "";
}

function saveDraft() {
  if (state.editingId) return;
  const draft = {
    title: byId("articleTitle").value,
    body: byId("articleBody").value,
    roomId: byId("articleRoom").value,
    tags: byId("articleTags").value,
    savedAt: Date.now(),
  };
  if (!draft.title.trim() && !draft.body.trim()) {
    clearDraft();
    return;
  }
  localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  const hora = new Date(draft.savedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  byId("draftNote").textContent = `Rascunho salvo neste navegador às ${hora}.`;
}

function scheduleDraft() {
  if (state.editingId) return;
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraft, 700);
}

function openEditor(article = null) {
  if (!state.user) {
    location.href = "/api/auth/discord";
    return;
  }
  state.editingId = article?.id || null;
  byId("editorHeading").textContent = article ? "Editar artigo" : "Escrever artigo";
  byId("publishButton").textContent = article ? "Salvar alterações" : "Publicar artigo";
  byId("historyButton").hidden = !article;
  byId("historyPanel").hidden = true;

  const draft = article ? null : readDraft();
  byId("articleTitle").value = article?.title || draft?.title || "";
  byId("articleBody").value = article?.body || draft?.body || "";
  byId("articleRoom").value = article?.room_id || draft?.roomId || "";
  byId("articleTags").value = article ? splitTags(article.tags).join(", ") : draft?.tags || "";
  byId("draftNote").textContent = draft
    ? "Rascunho recuperado deste navegador. Publique ou edite à vontade."
    : "";

  setPreviewMode(false);
  byId("editorPanel").hidden = false;
  setMessage(byId("articleMessage"), "");
  byId("editorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  byId("articleTitle").focus({ preventScroll: true });
}

async function deleteArticle(id) {
  if (!window.confirm("Excluir este artigo e todos os comentários associados?")) return;
  try {
    await api(`/api/articles/${id}`, { method: "DELETE" });
    await Promise.all([loadArticles(), loadTags()]);
  } catch (error) {
    window.alert(error.message);
  }
}

async function toggleLike(articleId) {
  try {
    const { liked, count } = await api(`/api/articles/${articleId}/like`, { method: "POST" });
    const article = state.articles.find((item) => String(item.id) === String(articleId));
    if (article) {
      article.liked = liked ? 1 : 0;
      article.like_count = count;
    }
    const button = byId("articleList").querySelector(`[data-action="like"][data-id="${articleId}"]`);
    if (button && article) syncLikeButton(button, article);
  } catch (error) {
    if (error.status === 401) location.href = "/api/auth/discord";
    else window.alert(error.message);
  }
}

async function openHistory() {
  const panel = byId("historyPanel");
  if (!panel.hidden) {
    panel.hidden = true;
    return;
  }
  const container = byId("historyList");
  container.replaceChildren(element("p", { className: "muted", text: "Carregando histórico..." }));
  panel.hidden = false;
  try {
    const { revisions } = await api(`/api/articles/${state.editingId}/revisions`);
    container.replaceChildren();
    if (!revisions.length) {
      container.append(element("p", { className: "muted", text: "Nenhuma versão anterior: este artigo nunca foi editado." }));
      return;
    }
    for (const revision of revisions) {
      container.append(element("div", { className: "history-item" }, [
        element("div", {}, [
          element("strong", { text: revision.title }),
          element("p", { className: "hint", text: `${formatDate(revision.created_at)} · ${revision.edited_by_name || "autor"}` }),
        ]),
        element("button", {
          className: "button button-small",
          text: "Restaurar",
          attrs: { type: "button", title: "Traz este texto de volta para o editor (salve para confirmar)" },
          on: {
            click: () => {
              byId("articleTitle").value = revision.title;
              byId("articleBody").value = revision.body;
              setPreviewMode(false);
              setMessage(byId("articleMessage"), "Versão carregada. Clique em salvar para confirmar.", true);
              byId("articleTitle").scrollIntoView({ behavior: "smooth", block: "center" });
            },
          },
        }),
      ]));
    }
  } catch (error) {
    container.replaceChildren(element("p", { className: "form-message", text: error.message }));
  }
}

async function joinRoom(idOrCode) {
  try {
    const result = await api(`/api/rooms/${encodeURIComponent(idOrCode)}/join`, { method: "POST", body: "{}" });
    setMessage(
      byId("roomMessage"),
      result.pending ? "Pedido enviado. O dono da sala precisa aprovar." : "Você entrou na sala.",
      true,
    );
    byId("roomInvite").value = "";
    await loadRooms();
  } catch (error) {
    setMessage(byId("roomMessage"), error.message);
  }
}

function bindEvents() {
  byId("newArticleButton").addEventListener("click", () => openEditor());
  byId("aboutWriteButton").addEventListener("click", () => openEditor());
  byId("closeEditorButton").addEventListener("click", () => { byId("editorPanel").hidden = true; });

  byId("previewButton").addEventListener("click", () => setPreviewMode(byId("markdownPreview").hidden));
  byId("articleBody").addEventListener("input", () => {
    if (!byId("markdownPreview").hidden) setPreviewMode(true);
    scheduleDraft();
  });
  for (const id of ["articleTitle", "articleTags", "articleRoom"]) {
    byId(id).addEventListener("input", scheduleDraft);
    byId(id).addEventListener("change", scheduleDraft);
  }

  byId("historyButton").addEventListener("click", openHistory);

  byId("articleForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = byId("publishButton");
    submit.disabled = true;
    setMessage(byId("articleMessage"), state.editingId ? "Salvando alterações..." : "Publicando artigo...", true);
    try {
      const payload = JSON.stringify({
        title: byId("articleTitle").value,
        body: byId("articleBody").value,
        roomId: byId("articleRoom").value,
        tags: byId("articleTags").value,
      });
      if (state.editingId) await api(`/api/articles/${state.editingId}`, { method: "PUT", body: payload });
      else await api("/api/articles", { method: "POST", body: payload });

      byId("articleForm").reset();
      byId("editorPanel").hidden = true;
      state.editingId = null;
      clearDraft();
      await Promise.all([loadArticles(), loadTags()]);
    } catch (error) {
      setMessage(byId("articleMessage"), error.message);
    } finally {
      submit.disabled = false;
    }
  });

  byId("articleList").addEventListener("click", (event) => {
    const button = event.target.closest('[data-action="like"]');
    if (button) toggleLike(button.dataset.id);
  });

  byId("searchForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const term = byId("searchInput").value.trim();
    state.query = term.length >= 2 ? term : "";
    if (term && term.length < 2) setMessage(byId("feedStatus"), "Digite pelo menos 2 caracteres para buscar.");
    updateURL();
    loadArticles();
  });

  byId("loadMoreButton").addEventListener("click", () => loadArticles({ append: true }));

  byId("newRoomButton").addEventListener("click", () => {
    const form = byId("roomCreateForm");
    form.hidden = !form.hidden;
    if (!form.hidden) byId("roomName").focus();
  });

  byId("roomCreateForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const submit = event.submitter;
    if (submit) submit.disabled = true;
    try {
      const visibility = byId("roomVisibility").value;
      const result = await api("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          name: byId("roomName").value,
          description: byId("roomDescription").value,
          visibility: byId("roomVisibility").value,
        }),
      });
      byId("roomCreateForm").reset();
      byId("roomCreateForm").hidden = true;
      if (visibility === "private" && result.code) {
        const box = byId("inviteResult");
        box.hidden = false;
        box.replaceChildren(
          document.createTextNode("Sala privada criada. Guarde e compartilhe só este código:"),
          element("code", { text: result.code }),
        );
        byId("roomInvite").value = result.code;
      }
      await loadRooms();
      setMessage(byId("roomMessage"), "Sala criada com sucesso.", true);
    } catch (error) {
      setMessage(byId("roomMessage"), error.message);
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  byId("joinRoomForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = byId("roomInvite").value.trim().toLowerCase();
    // Sala pública usa o número; sala privada usa o código hash (24 hex, ou 36 em salas antigas).
    if (!/^\d+$/.test(value) && !/^[a-f0-9]{18,64}$/.test(value)) {
      setMessage(byId("roomMessage"), "Informe o código da sala privada ou o número de uma sala pública.");
      return;
    }
    await joinRoom(value);
  });

  byId("clearFilterButton").addEventListener("click", () => {
    state.author = null;
    state.roomId = null;
    state.tag = null;
    state.query = "";
    byId("searchInput").value = "";
    updateURL();
    renderRooms();
    renderTags();
    loadArticles();
  });

  byId("myArticlesButton").addEventListener("click", () => {
    if (state.user) showAuthor(state.user.userId);
  });

  byId("logoutButton").addEventListener("click", async () => {
    try {
      await api("/api/auth/logout", { method: "POST", body: "{}" });
      location.href = "/";
    } catch (error) {
      window.alert(`Não foi possível sair: ${error.message}`);
    }
  });

  byId("closeRoomAdminButton").addEventListener("click", () => {
    byId("roomAdmin").hidden = true;
    state.adminRoomId = null;
  });

  byId("roomPolicy").addEventListener("change", async () => {
    if (!state.adminRoomId) return;
    const joinPolicy = byId("roomPolicy").value;
    try {
      await api(`/api/rooms/${state.adminRoomId}`, { method: "PATCH", body: JSON.stringify({ joinPolicy }) });
      setMessage(
        byId("roomAdminMessage"),
        joinPolicy === "approval" ? "Agora entra só quem você aprovar." : "Agora entra quem tiver o convite.",
        true,
      );
      updatePolicyHint();
      await loadRooms();
    } catch (error) {
      const room = state.rooms.find((item) => String(item.id) === String(state.adminRoomId));
      if (room) byId("roomPolicy").value = room.join_policy || "open_link";
      updatePolicyHint();
      setMessage(byId("roomAdminMessage"), error.message);
    }
  });

  byId("transferRoomButton").addEventListener("click", () => {
    if (state.adminRoomId) transferRoom(state.adminRoomId);
  });

  byId("deleteRoomButton").addEventListener("click", () => {
    if (state.adminRoomId) deleteRoom(state.adminRoomId);
  });
}

async function initialize() {
  const params = new URLSearchParams(location.search);
  state.roomId = params.get("room");
  state.tag = params.get("tag");
  state.query = params.get("q") || "";
  const authorId = params.get("author");
  byId("searchInput").value = state.query;

  try {
    await loadAuth();
    await Promise.all([loadRooms(), loadTags()]);
    if (authorId) state.author = (await api(`/api/authors/${encodeURIComponent(authorId)}`)).author;
    await loadArticles();

    // "Editar artigo" na página do artigo manda o autor para cá com ?editar=<id>.
    const editId = params.get("editar");
    if (editId && state.user) {
      const { article } = await api(`/api/articles/${encodeURIComponent(editId)}`);
      if (String(article.author_id) === String(state.user.userId)) {
        openEditor(article);
        const url = new URL(location.href);
        url.searchParams.delete("editar");
        history.replaceState({}, "", url);
      } else {
        setMessage(byId("feedStatus"), "Você só pode editar os seus próprios artigos.");
      }
    }
  } catch (error) {
    byId("articleList").textContent = `Não foi possível iniciar o blog: ${error.message}`;
  }
}

bindEvents();
initialize();
