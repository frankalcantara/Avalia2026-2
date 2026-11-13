(() => {
  "use strict";

  const state = {
    user: null,
    courses: [],
    subscriptions: new Set(),
    posts: [],
    editingId: null,
  };
  const byId = (id) => document.getElementById(id);
  const elements = {
    accountStatus: byId("accountStatus"),
    loginLink: byId("loginLink"),
    loginPanel: byId("loginPanel"),
    appLayout: byId("appLayout"),
    profile: byId("profile"),
    logoutButton: byId("logoutButton"),
    profileName: byId("profileName"),
    profileAvatar: byId("profileAvatar"),
    courseCount: byId("courseCount"),
    coursePicker: byId("coursePicker"),
    courseFilter: byId("courseFilter"),
    postCourse: byId("postCourse"),
    subscriptionForm: byId("subscriptionForm"),
    subscriptionList: byId("subscriptionList"),
    subscriptionMessage: byId("subscriptionMessage"),
    postForm: byId("postForm"),
    postType: byId("postType"),
    postTitle: byId("postTitle"),
    postBody: byId("postBody"),
    postLink: byId("postLink"),
    postMessage: byId("postMessage"),
    submitPost: byId("submitPost"),
    cancelEdit: byId("cancelEdit"),
    formHeading: byId("formHeading"),
    feedList: byId("feedList"),
    globalMessage: byId("globalMessage"),
  };

  const field = (object, ...keys) => {
    for (const key of keys) {
      if (object && object[key] !== undefined && object[key] !== null) return object[key];
    }
    return "";
  };
  const courseCode = (course) => String(field(course, "code", "courseCode", "course_code"));
  const courseTitle = (course) => String(field(course, "title", "name") || courseCode(course));
  const postId = (post) => String(field(post, "id", "postId", "post_id"));
  const postCourseCode = (post) => String(field(post, "courseCode", "course_code"));
  const isTruthy = (value) => value === true || value === 1 || value === "1";
  const text = (tag, className, value) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = value == null ? "" : String(value);
    return node;
  };
  const arrayFrom = (payload, key) => {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== "object") return [];
    if (Array.isArray(payload[key])) return payload[key];
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
  };

  async function api(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const response = await fetch(path, { ...options, headers, credentials: "same-origin" });
    let payload = null;
    const responseText = await response.text();
    if (responseText) {
      try { payload = JSON.parse(responseText); } catch { payload = { message: responseText }; }
    }
    if (!response.ok) {
      const message = payload && (payload.message || payload.error);
      const error = new Error(message ? String(message) : `Não foi possível concluir a solicitação (${response.status}).`);
      error.status = response.status;
      throw error;
    }
    return payload;
  }

  function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.toggle("message-error", isError);
  }

  function normalizeUser(payload) {
    if (!payload || typeof payload !== "object") return null;
    const candidate = payload.user || payload.sessionUser || payload;
    const id = field(candidate, "userId", "user_id", "id");
    if (!id) return null;
    return {
      id: String(id),
      name: String(field(candidate, "username", "globalName", "global_name", "name") || "Estudante"),
      avatar: String(field(candidate, "avatar", "avatarUrl", "avatar_url") || ""),
    };
  }

  function normalizeCourseList() {
    return state.courses.filter((course) => courseCode(course));
  }

  function renderProfile() {
    elements.profileName.textContent = state.user.name;
    elements.profile.hidden = false;
    if (state.user.avatar && isSafeHttpUrl(state.user.avatar)) {
      elements.profileAvatar.src = state.user.avatar;
      elements.profileAvatar.alt = `Avatar de ${state.user.name}`;
      elements.profileAvatar.hidden = false;
    }
  }

  function option(label, value) {
    const item = document.createElement("option");
    item.value = value;
    item.textContent = label;
    return item;
  }

  function renderCourses() {
    const subscribedCourses = normalizeCourseList().filter((course) => state.subscriptions.has(courseCode(course)));
    const previousFilter = elements.courseFilter.value;
    elements.courseCount.textContent = String(subscribedCourses.length);

    elements.coursePicker.replaceChildren(option("Selecione uma disciplina", ""));
    normalizeCourseList().filter((course) => !state.subscriptions.has(courseCode(course))).forEach((course) => {
      elements.coursePicker.appendChild(option(`${courseCode(course)} — ${courseTitle(course)}`, courseCode(course)));
    });
    elements.coursePicker.disabled = elements.coursePicker.options.length < 2;
    elements.subscriptionForm.querySelector("button[type='submit']").disabled = elements.coursePicker.disabled;

    elements.courseFilter.replaceChildren(option("Todas as disciplinas", ""));
    subscribedCourses.forEach((course) => {
      elements.courseFilter.appendChild(option(`${courseCode(course)} — ${courseTitle(course)}`, courseCode(course)));
    });
    elements.courseFilter.disabled = subscribedCourses.length === 0;
    if (subscribedCourses.some((course) => courseCode(course) === previousFilter)) {
      elements.courseFilter.value = previousFilter;
    }

    elements.postCourse.replaceChildren();
    if (subscribedCourses.length === 0) {
      elements.postCourse.appendChild(option("Inscreva-se em uma disciplina", ""));
    } else {
      subscribedCourses.forEach((course) => {
        elements.postCourse.appendChild(option(`${courseCode(course)} — ${courseTitle(course)}`, courseCode(course)));
      });
    }
    elements.postCourse.disabled = subscribedCourses.length === 0;
    elements.submitPost.disabled = subscribedCourses.length === 0;

    elements.subscriptionList.replaceChildren();
    if (!subscribedCourses.length) {
      elements.subscriptionList.appendChild(text("li", "inline-message", "Você ainda não acompanha nenhuma disciplina."));
      return;
    }
    subscribedCourses.forEach((course) => {
      const item = text("li", "subscription-item", "");
      const label = text("span", "course-label", "");
      label.append(text("strong", "", courseCode(course)), text("span", "", courseTitle(course)));
      const remove = text("button", "remove-subscription", "×");
      remove.type = "button";
      remove.dataset.removeCourse = courseCode(course);
      remove.setAttribute("aria-label", `Deixar de acompanhar ${courseCode(course)} — ${courseTitle(course)}`);
      item.append(label, remove);
      elements.subscriptionList.appendChild(item);
    });
  }

  function isSafeHttpUrl(value) {
    try {
      const url = new URL(value, window.location.origin);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }

  function normalizeType(post) {
    const supplied = String(field(post, "type", "kind", "category")).toLowerCase();
    if (["aviso", "lembrete", "link"].includes(supplied)) return supplied;
    const title = String(field(post, "title"));
    const match = title.match(/^\[(aviso|lembrete|link)\]\s*/i);
    return match ? match[1].toLowerCase() : "aviso";
  }

  function visibleTitle(post) {
    return String(field(post, "title")).replace(/^\[(aviso|lembrete|link)\]\s*/i, "");
  }

  function courseName(code) {
    const found = state.courses.find((course) => courseCode(course) === code);
    return found ? courseTitle(found) : code;
  }

  function dateLabel(post) {
    const raw = field(post, "createdAt", "created_at", "updatedAt", "updated_at");
    if (!raw) return "";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return String(raw);
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
  }

  function addAction(buttons, label, action, active, accessibleLabel) {
    const button = text("button", `action-button${active ? " active" : ""}`, label);
    button.type = "button";
    button.dataset.action = action;
    if (accessibleLabel) button.setAttribute("aria-label", accessibleLabel);
    button.setAttribute("aria-pressed", active ? "true" : "false");
    buttons.appendChild(button);
    return button;
  }

  function renderPost(post) {
    const id = postId(post);
    const code = postCourseCode(post);
    const pinned = isTruthy(field(post, "isPinned", "is_pinned", "pinned"));
    const read = isTruthy(field(post, "isRead", "is_read", "read"));
    const type = normalizeType(post);
    const card = text("article", `post-card${pinned ? " is-pinned" : ""}`, "");
    card.dataset.postId = id;
    const meta = text("div", "post-meta", "");
    const course = text("span", "post-course", `${code} · ${courseName(code)}`);
    const tools = text("div", "post-tools", "");
    const badge = text("span", `type-badge${type === "aviso" ? "" : ` ${type}`}`, type === "link" ? "Link útil" : type[0].toUpperCase() + type.slice(1));
    const date = text("time", "post-date", dateLabel(post));
    const rawDate = field(post, "createdAt", "created_at");
    if (rawDate) date.dateTime = String(rawDate);
    tools.append(badge, date);
    meta.append(course, tools);

    const heading = text("h3", "", visibleTitle(post) || "Sem título");
    const content = text("p", "post-body", field(post, "body"));
    card.append(meta, heading, content);

    const linkValue = String(field(post, "link", "url") || "").trim();
    if (linkValue && isSafeHttpUrl(linkValue)) {
      const link = text("a", "post-link", linkValue);
      link.href = linkValue;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.append(document.createTextNode(" ↗"));
      card.appendChild(link);
    }

    const footer = text("div", "post-footer", "");
    const authorName = String(field(post, "authorName", "author_name", "username") || "Estudante");
    footer.appendChild(text("span", "post-author", `Por ${authorName}`));
    const actions = text("div", "post-actions", "");
    const ownPost = String(field(post, "authorId", "author_id", "userId", "user_id")) === state.user.id;
    addAction(actions, pinned ? "★ Fixado" : "☆ Fixar", pinned ? "unpin" : "pin", pinned, pinned ? "Desafixar aviso" : "Fixar aviso");
    addAction(actions, read ? "✓ Lido" : "Marcar lido", read ? "unread" : "read", read, read ? "Marcar como não lido" : "Marcar como lido");
    if (ownPost) {
      addAction(actions, "Editar", "edit", false, "Editar aviso");
      addAction(actions, "Excluir", "delete", false, "Excluir aviso");
    }
    footer.appendChild(actions);
    card.appendChild(footer);
    return card;
  }

  function renderFeed(message) {
    elements.feedList.replaceChildren();
    elements.feedList.setAttribute("aria-busy", "false");
    if (message) {
      const empty = text("div", "empty-state", "");
      empty.append(text("span", "empty-icon", "!"), text("p", "", message));
      elements.feedList.appendChild(empty);
      return;
    }
    if (!state.subscriptions.size) {
      const empty = text("div", "empty-state", "");
      empty.append(text("span", "empty-icon", "＋"), text("p", "", "Escolha uma disciplina para começar a acompanhar o mural."));
      elements.feedList.appendChild(empty);
      return;
    }
    const filter = elements.courseFilter.value;
    const posts = state.posts.filter((post) => {
      const code = postCourseCode(post);
      return state.subscriptions.has(code) && (!filter || code === filter);
    }).sort((a, b) => {
      const aPinned = isTruthy(field(a, "isPinned", "is_pinned"));
      const bPinned = isTruthy(field(b, "isPinned", "is_pinned"));
      if (aPinned !== bPinned) return aPinned ? -1 : 1;
      return new Date(field(b, "createdAt", "created_at") || 0) - new Date(field(a, "createdAt", "created_at") || 0);
    });
    if (!posts.length) {
      const empty = text("div", "empty-state", "");
      empty.append(text("span", "empty-icon", "✳"), text("p", "", filter
        ? "Ainda não há avisos nesta disciplina."
        : "Ainda não há avisos nas suas disciplinas. Que tal publicar o primeiro?"));
      elements.feedList.appendChild(empty);
      return;
    }
    posts.forEach((post) => elements.feedList.appendChild(renderPost(post)));
  }

  async function loadPosts() {
    elements.feedList.setAttribute("aria-busy", "true");
    elements.feedList.replaceChildren();
    const loading = text("div", "empty-state", "");
    loading.append(text("span", "loader", ""), text("p", "", "Carregando avisos…"));
    elements.feedList.appendChild(loading);
    try {
      const payload = await api("/api/posts");
      state.posts = arrayFrom(payload, "posts");
      renderFeed();
    } catch (error) {
      renderFeed(error.message || "Não foi possível carregar os avisos. Tente novamente.");
    }
  }

  async function loadWorkspace() {
    const [coursesResult, subscriptionsResult] = await Promise.allSettled([
      api("/api/courses"),
      api("/api/subscriptions"),
    ]);
    if (coursesResult.status === "fulfilled") {
      state.courses = arrayFrom(coursesResult.value, "courses");
    } else {
      showMessage(elements.globalMessage, `Não foi possível carregar as disciplinas: ${coursesResult.reason.message}`, true);
    }
    if (subscriptionsResult.status === "fulfilled") {
      const subscriptions = arrayFrom(subscriptionsResult.value, "subscriptions");
      state.subscriptions = new Set(subscriptions.map((item) => String(typeof item === "string" ? item : field(item, "courseCode", "course_code", "code"))).filter(Boolean));
    } else {
      showMessage(elements.globalMessage, `Não foi possível carregar suas inscrições: ${subscriptionsResult.reason.message}`, true);
    }
    renderCourses();
    await loadPosts();
  }

  function resetPostForm() {
    state.editingId = null;
    elements.postForm.reset();
    elements.formHeading.textContent = "Compartilhe com sua turma";
    elements.submitPost.textContent = "Publicar aviso";
    elements.cancelEdit.hidden = true;
    showMessage(elements.postMessage, "");
    const subscribed = state.courses.find((course) => state.subscriptions.has(courseCode(course)));
    elements.postCourse.value = subscribed ? courseCode(subscribed) : "";
  }

  function editPost(post) {
    state.editingId = postId(post);
    elements.postCourse.value = postCourseCode(post);
    elements.postType.value = normalizeType(post);
    elements.postTitle.value = visibleTitle(post);
    elements.postBody.value = String(field(post, "body"));
    elements.postLink.value = String(field(post, "link", "url") || "");
    elements.formHeading.textContent = "Editar aviso";
    elements.submitPost.textContent = "Salvar alterações";
    elements.cancelEdit.hidden = false;
    showMessage(elements.postMessage, "Editando seu aviso.");
    elements.postForm.scrollIntoView({ behavior: "smooth", block: "center" });
    elements.postTitle.focus();
  }

  async function submitSubscription(event) {
    event.preventDefault();
    const code = elements.coursePicker.value;
    if (!code) return;
    const button = elements.subscriptionForm.querySelector("button[type='submit']");
    button.disabled = true;
    showMessage(elements.subscriptionMessage, "Adicionando disciplina…");
    try {
      await api("/api/subscriptions", { method: "POST", body: JSON.stringify({ course_code: code }) });
      state.subscriptions.add(code);
      renderCourses();
      showMessage(elements.subscriptionMessage, `${code} adicionada ao seu mural.`);
      await loadPosts();
    } catch (error) {
      showMessage(elements.subscriptionMessage, error.message || "Não foi possível adicionar a disciplina.", true);
    } finally {
      button.disabled = elements.coursePicker.disabled;
    }
  }

  async function removeSubscription(code, button) {
    button.disabled = true;
    showMessage(elements.subscriptionMessage, "Atualizando suas disciplinas…");
    try {
      await api("/api/subscriptions", { method: "DELETE", body: JSON.stringify({ course_code: code }) });
      state.subscriptions.delete(code);
      if (elements.courseFilter.value === code) elements.courseFilter.value = "";
      renderCourses();
      renderFeed();
      showMessage(elements.subscriptionMessage, `${code} removida do seu mural.`);
    } catch (error) {
      button.disabled = false;
      showMessage(elements.subscriptionMessage, error.message || "Não foi possível remover a disciplina.", true);
    }
  }

  function encodeTitle(title, type) {
    return `[${type}] ${title.trim()}`;
  }

  async function submitPost(event) {
    event.preventDefault();
    const code = elements.postCourse.value;
    const title = elements.postTitle.value.trim();
    const body = elements.postBody.value.trim();
    const link = elements.postLink.value.trim();
    if (!code || !state.subscriptions.has(code)) {
      showMessage(elements.postMessage, "Escolha uma disciplina em que você esteja inscrito.", true);
      return;
    }
    if (!title || !body) {
      showMessage(elements.postMessage, "Preencha o título e a mensagem.", true);
      return;
    }
    if (title.length > 110 || body.length > 3000) {
      showMessage(elements.postMessage, "O título pode ter até 110 caracteres e a mensagem até 3.000.", true);
      return;
    }
    if (link && (!isSafeHttpUrl(link) || !/^https?:\/\//i.test(link))) {
      showMessage(elements.postMessage, "Informe um link válido começando com http:// ou https://.", true);
      return;
    }

    elements.submitPost.disabled = true;
    elements.submitPost.textContent = state.editingId ? "Salvando…" : "Publicando…";
    showMessage(elements.postMessage, "");
    const payload = {
      course_code: code,
      title: encodeTitle(title, elements.postType.value),
      body,
      link: link || null,
    };
    try {
      if (state.editingId) {
        const editableFields = { title: payload.title, body: payload.body, link: payload.link };
        await api(`/api/posts/${encodeURIComponent(state.editingId)}`, { method: "PATCH", body: JSON.stringify(editableFields) });
      } else {
        await api("/api/posts", { method: "POST", body: JSON.stringify(payload) });
      }
      resetPostForm();
      showMessage(elements.postMessage, "Aviso salvo com sucesso.");
      await loadPosts();
    } catch (error) {
      showMessage(elements.postMessage, error.message || "Não foi possível salvar o aviso.", true);
    } finally {
      elements.submitPost.textContent = state.editingId ? "Salvar alterações" : "Publicar aviso";
      elements.submitPost.disabled = state.subscriptions.size === 0;
    }
  }

  async function changePostState(post, action, button) {
    const id = postId(post);
    const pinned = isTruthy(field(post, "isPinned", "is_pinned"));
    const read = isTruthy(field(post, "isRead", "is_read"));
    const next = {
      is_pinned: action === "pin" ? true : action === "unpin" ? false : pinned,
      is_read: action === "read" ? true : action === "unread" ? false : read,
    };
    button.disabled = true;
    try {
      const updated = await api(`/api/posts/${encodeURIComponent(id)}/state`, {
        method: "PATCH",
        body: JSON.stringify(next),
      });
      const returned = updated && (updated.post || updated.state || updated);
      post.isPinned = field(returned, "isPinned", "is_pinned") === "" ? next.isPinned : isTruthy(field(returned, "isPinned", "is_pinned"));
      post.isRead = field(returned, "isRead", "is_read") === "" ? next.isRead : isTruthy(field(returned, "isRead", "is_read"));
      renderFeed();
    } catch (error) {
      button.disabled = false;
      showMessage(elements.globalMessage, error.message || "Não foi possível atualizar o estado do aviso.", true);
    }
  }

  async function deletePost(post, button) {
    if (!window.confirm("Excluir este aviso? Esta ação não pode ser desfeita.")) return;
    button.disabled = true;
    try {
      await api(`/api/posts/${encodeURIComponent(postId(post))}`, { method: "DELETE" });
      state.posts = state.posts.filter((item) => postId(item) !== postId(post));
      if (state.editingId === postId(post)) resetPostForm();
      renderFeed();
      showMessage(elements.globalMessage, "Aviso excluído.");
    } catch (error) {
      button.disabled = false;
      showMessage(elements.globalMessage, error.message || "Não foi possível excluir o aviso.", true);
    }
  }

  async function handleFeedAction(event) {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest("[data-post-id]");
    const post = state.posts.find((item) => postId(item) === card?.dataset.postId);
    if (!post) return;
    const action = button.dataset.action;
    if (action === "edit") {
      const authorId = String(field(post, "authorId", "author_id", "userId", "user_id"));
      if (authorId === state.user.id) editPost(post);
    } else if (action === "delete") {
      const authorId = String(field(post, "authorId", "author_id", "userId", "user_id"));
      if (authorId === state.user.id) await deletePost(post, button);
    } else {
      await changePostState(post, action, button);
    }
  }

  async function initialize() {
    try {
      const me = await api("/api/auth/me");
      state.user = normalizeUser(me);
    } catch (error) {
      if (error.status !== 401 && error.status !== 403) {
        showMessage(elements.globalMessage, `Não foi possível verificar sua sessão: ${error.message}`, true);
      }
    }
    if (!state.user) {
      elements.accountStatus.textContent = "Acesso para estudantes";
      elements.loginLink.hidden = false;
      elements.loginPanel.hidden = false;
      elements.appLayout.hidden = true;
      return;
    }
    elements.accountStatus.textContent = "";
    elements.loginLink.hidden = true;
    elements.loginPanel.hidden = true;
    elements.appLayout.hidden = false;
    renderProfile();
    await loadWorkspace();
  }

  elements.logoutButton.addEventListener("click", async () => {
    elements.logoutButton.disabled = true;
    try {
      await api("/api/auth/logout", { method: "POST" });
      window.location.reload();
    } catch (error) {
      elements.logoutButton.disabled = false;
      showMessage(elements.globalMessage, error.message || "Não foi possível encerrar a sessão.", true);
    }
  });
  elements.subscriptionForm.addEventListener("submit", submitSubscription);
  elements.subscriptionList.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-remove-course]");
    if (button) removeSubscription(button.dataset.removeCourse, button);
  });
  elements.courseFilter.addEventListener("change", () => renderFeed());
  elements.postForm.addEventListener("submit", submitPost);
  elements.cancelEdit.addEventListener("click", resetPostForm);
  elements.feedList.addEventListener("click", handleFeedAction);
  initialize();
})();
