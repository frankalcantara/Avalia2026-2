"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const STATUS = Object.freeze({ para_ler: "Para Ler", lendo: "Lendo", concluido: "Concluído" });
  const state = {
    user: null, collections: [], bookmarks: [], collectionsLoaded: false,
    bookmarksLoaded: false, epoch: 0, collectionRequest: 0, bookmarkRequest: 0,
    savingBookmark: false, savingEdit: false, editingId: null, checkingSession: false,
  };

  class ApiError extends Error {
    constructor(message, status = 0, fields = {}, code = "") {
      super(message);
      this.status = status;
      this.fields = fields;
      this.code = code;
    }
  }

  // A sessão vem exclusivamente do servidor. IDs e permissões nunca são enviados como identidade.
  async function api(path, { method = "GET", body } = {}) {
    const epoch = state.epoch;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, {
        method, credentials: "same-origin", signal: controller.signal,
        headers: { Accept: "application/json", ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (epoch !== state.epoch) throw new ApiError("", 0, {}, "STALE");
      if (response.status === 204) return null;
      let payload = null;
      try { payload = await response.json(); } catch { /* Respostas de erro podem não ter JSON. */ }
      if (epoch !== state.epoch) throw new ApiError("", 0, {}, "STALE");
      if (!response.ok) {
        throw new ApiError(payload?.error?.message || "", response.status, payload?.error?.fields, payload?.error?.code);
      }
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
        throw new ApiError("O servidor enviou uma resposta inesperada. Tente novamente.", 502);
      }
      return payload.data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(error.name === "AbortError"
        ? "A conexão demorou mais que o esperado. Tente novamente."
        : "Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.");
    } finally {
      clearTimeout(timeout);
    }
  }

  function friendly(error) {
    if (error.status === 401) return "Sua sessão expirou. Entre com Discord novamente.";
    if (error.status === 403) return "Você não tem permissão para realizar esta ação.";
    if (error.status === 404) return "Este item não está mais disponível. Atualize a biblioteca.";
    if (error.status === 409) return "Esta coleção ainda contém links. Mova ou exclua os links antes de excluir a coleção.";
    if (error.status === 429) return "Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.";
    if (error.status >= 500) return "O serviço está temporariamente indisponível. Tente novamente em instantes.";
    return error.message || "Não foi possível concluir a ação. Confira os dados e tente novamente.";
  }

  function notice(message, error = false, target = $("globalMessage")) {
    target.textContent = message;
    target.hidden = !message;
    target.classList.toggle("notice-error", error);
    target.setAttribute("role", error ? "alert" : "status");
    target.setAttribute("aria-live", error ? "assertive" : "polite");
  }

  function clearErrors(form) {
    for (const input of form.querySelectorAll("input, select, textarea")) {
      input.removeAttribute("aria-invalid");
      input.setCustomValidity("");
    }
    for (const message of form.querySelectorAll("[data-field-error]")) {
      message.textContent = "";
      message.hidden = true;
    }
  }

  function showFieldErrors(form, fields) {
    if (!form || !fields || typeof fields !== "object") return;
    let first = null;
    for (const output of form.querySelectorAll("[data-field-error]")) {
      const value = fields[output.dataset.fieldError];
      const text = Array.isArray(value) ? value.filter((item) => typeof item === "string").join(" ") : value;
      if (typeof text !== "string" || !text) continue;
      output.textContent = text;
      output.hidden = false;
      const input = form.elements.namedItem(output.dataset.fieldError);
      if (input) {
        input.setAttribute("aria-invalid", "true");
        first ||= input;
      }
    }
    first?.focus();
  }

  function showGuest() {
    state.epoch += 1;
    state.user = null;
    state.collections = [];
    state.bookmarks = [];
    state.collectionsLoaded = false;
    state.bookmarksLoaded = false;
    state.editingId = null;
    for (const id of ["editDialog", "deleteDialog", "shareDialog"]) {
      if ($(id).open) $(id).close();
    }
    $("workspace").hidden = true;
    $("sessionProfile").hidden = true;
    $("sessionError").hidden = true;
    $("sessionLoading").hidden = true;
    $("welcomeScreen").hidden = false;
    $("guestHeader").hidden = false;
    $("profileUsername").textContent = "";
    $("profileUserId").textContent = "";
    $("avatarInitials").textContent = "";
    $("profileAvatar").hidden = true;
    $("profileAvatar").removeAttribute("src");
    $("collectionList").replaceChildren();
    $("bookmarkList").replaceChildren();
    $("collectionForm").reset();
    $("bookmarkForm").reset();
    $("editBookmarkForm").reset();
    $("filterForm").reset();
    for (const form of [$("collectionForm"), $("bookmarkForm"), $("editBookmarkForm")]) clearErrors(form);
    updateComposer();
  }

  function handleError(error, form = null, target = $("globalMessage")) {
    if (error.code === "STALE") return;
    if (error.status === 401) {
      showGuest();
      notice(friendly(error), true);
      return;
    }
    notice(friendly(error), true, target);
    showFieldErrors(form, error.fields);
  }

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = String(text);
    return node;
  }

  function button(text, className, action, label = text) {
    const node = element("button", className, text);
    node.type = "button";
    node.setAttribute("aria-label", label);
    node.addEventListener("click", () => action(node));
    return node;
  }

  function safeUrl(value) {
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch { return null; }
  }

  function updateComposer() {
    const available = state.collectionsLoaded && state.collections.length > 0;
    $("bookmarkFields").disabled = !available || state.savingBookmark;
    $("bookmarkCollectionHint").hidden = available;
    $("bookmarkCollectionHint").textContent = state.collectionsLoaded
      ? "Crie uma coleção para começar a salvar links."
      : "Carregue as coleções para adicionar links. Use “Atualizar biblioteca” se necessário.";
  }

  function fillCollections(select, placeholder) {
    const selected = select.value;
    const options = document.createDocumentFragment();
    const empty = element("option", "", placeholder);
    empty.value = "";
    options.append(empty);
    for (const collection of state.collections) {
      const option = element("option", "", collection.name);
      option.value = String(collection.id);
      options.append(option);
    }
    select.replaceChildren(options);
    if (state.collections.some((collection) => String(collection.id) === selected)) select.value = selected;
  }

  function focusCollection(id) {
    const item = Array.from($("collectionList").children).find((node) => node.dataset.id === String(id));
    (item?.querySelector(".visibility-toggle") || $("collectionName")).focus();
  }

  function focusBookmark(id) {
    const item = Array.from($("bookmarkList").children).find((node) => node.dataset.id === String(id));
    const target = item?.querySelector(".bookmark-title a") || $("bookmarksTitle");
    if (!target.hasAttribute("href")) target.setAttribute("tabindex", "-1");
    target.focus();
  }

  function renderCollections() {
    const fragment = document.createDocumentFragment();
    const selected = $("filterCollection").value;
    for (const collection of state.collections) {
      const id = String(collection.id);
      const isPublic = collection.is_public === true || collection.is_public === 1 || collection.is_public === "1";
      const item = element("li", "collection-item");
      item.dataset.id = id;
      const heading = element("div", "collection-item-heading");
      const name = button(collection.name, "collection-select", () => {
        $("filterCollection").value = id;
        renderCollections();
        $("filterCollection").focus();
        void loadBookmarks();
      }, "Filtrar links da coleção " + collection.name);
      name.setAttribute("aria-pressed", String(selected === id));
      heading.append(name, element("span", "visibility" + (isPublic ? " visibility-public" : ""), isPublic ? "Pública" : "Privada"));
      const actions = element("div", "collection-actions");
      actions.append(button(isPublic ? "Tornar privada" : "Tornar pública", "button button-quiet visibility-toggle", (trigger) => {
        void runAction(trigger, async () => {
          await api("/api/collections/" + encodeURIComponent(id), { method: "PATCH", body: { is_public: !isPublic } });
          await loadCollections();
          focusCollection(id);
        }, { success: isPublic ? "Coleção privada. O link público deixou de estar disponível." : "Coleção pública. Agora você pode copiar o link." });
      }, (isPublic ? "Tornar privada a coleção " : "Tornar pública a coleção ") + collection.name));
      if (isPublic) actions.append(button("Copiar link", "button button-quiet", (trigger) => {
        void runAction(trigger, async () => {
          const epoch = state.epoch;
          const url = new URL("/colecao.html", window.location.origin);
          url.searchParams.set("id", id);
          try {
            if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
            await navigator.clipboard.writeText(url.href);
            if (epoch !== state.epoch) return;
            notice("Link público copiado.");
          } catch {
            if (epoch !== state.epoch) return;
            $("shareUrl").value = url.href;
            $("shareDialog").showModal();
            $("shareUrl").focus();
            $("shareUrl").select();
          }
        }, { busy: "Copiando…" });
      }, "Copiar link público da coleção " + collection.name));
      actions.append(button("Excluir", "button button-danger-quiet", async (trigger) => {
        const confirmed = await confirmDelete("Excluir coleção?", "A coleção “" + collection.name + "” será excluída. Ela precisa estar sem links para continuar.");
        if (!confirmed || !state.user) return;
        void runAction(trigger, async () => {
          await api("/api/collections/" + encodeURIComponent(id), { method: "DELETE" });
          await loadCollections();
          await loadBookmarks();
          $("collectionName").focus();
        }, { success: "Coleção excluída.", busy: "Excluindo…" });
      }, "Excluir coleção " + collection.name));
      item.append(heading, actions);
      fragment.append(item);
    }
    $("collectionList").replaceChildren(fragment);
    $("collectionList").hidden = false;
    $("collectionCount").textContent = String(state.collections.length);
    $("noCollectionsHint").hidden = state.collections.length > 0;
    fillCollections($("filterCollection"), "Todas as coleções");
    fillCollections($("bookmarkCollection"), "Selecione uma coleção");
    fillCollections($("editCollection"), "Selecione uma coleção");
    $("filterCollection").disabled = false;
    updateComposer();
  }

  function renderBookmarks() {
    const fragment = document.createDocumentFragment();
    for (const bookmark of state.bookmarks) {
      const item = element("li");
      item.dataset.id = String(bookmark.id);
      const article = element("article", "bookmark-card");
      const meta = element("div", "bookmark-meta");
      const knownStatus = Object.prototype.hasOwnProperty.call(STATUS, bookmark.status);
      meta.append(element("span", "status-pill status-" + (knownStatus ? bookmark.status : "unknown"), knownStatus ? STATUS[bookmark.status] : "Status indisponível"));
      const collection = state.collections.find((entry) => String(entry.id) === String(bookmark.collection_id));
      meta.append(element("span", "collection-label", collection?.name || "Coleção"));
      const heading = element("h3", "bookmark-title");
      const url = safeUrl(bookmark.url);
      if (url) {
        const link = element("a", "", bookmark.title || bookmark.url);
        link.href = url.href;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        const arrow = element("span", "external-arrow", "↗");
        arrow.setAttribute("aria-hidden", "true");
        link.append(arrow, element("span", "sr-only", " (abre em nova aba)"));
        heading.append(link);
      } else {
        heading.textContent = bookmark.title || "Link indisponível";
      }
      article.append(meta, heading);
      if (bookmark.summary) article.append(element("p", "bookmark-summary", bookmark.summary));
      article.append(element("span", "bookmark-domain", url ? url.hostname : "URL indisponível: apenas HTTP ou HTTPS são permitidos."));
      const bottom = element("div", "bookmark-bottom");
      const controls = element("div", "status-controls");
      controls.setAttribute("role", "group");
      controls.setAttribute("aria-label", "Status de leitura de " + bookmark.title);
      for (const [value, label] of Object.entries(STATUS)) {
        const control = button(label, "status-button", (trigger) => {
          void runAction(trigger, async () => {
            await api("/api/bookmarks/" + encodeURIComponent(bookmark.id), { method: "PATCH", body: { status: value } });
            await loadBookmarks();
            focusBookmark(bookmark.id);
          }, { success: "Status atualizado para “" + label + "”." });
        }, "Marcar “" + bookmark.title + "” como " + label);
        control.disabled = bookmark.status === value;
        control.setAttribute("aria-pressed", String(bookmark.status === value));
        controls.append(control);
      }
      const actions = element("div", "bookmark-actions");
      const edit = button("Editar", "button button-quiet", () => openEditor(bookmark), "Editar link " + bookmark.title);
      edit.disabled = !state.collectionsLoaded || !state.collections.length;
      actions.append(edit, button("Excluir", "button button-danger-quiet", async (trigger) => {
        const confirmed = await confirmDelete("Excluir link?", "“" + bookmark.title + "” será removido da sua biblioteca. Esta ação não pode ser desfeita.");
        if (!confirmed || !state.user) return;
        void runAction(trigger, async () => {
          await api("/api/bookmarks/" + encodeURIComponent(bookmark.id), { method: "DELETE" });
          await loadBookmarks();
          focusBookmark(null);
        }, { success: "Link excluído.", busy: "Excluindo…" });
      }, "Excluir link " + bookmark.title));
      bottom.append(controls, actions);
      article.append(bottom);
      item.append(article);
      fragment.append(item);
    }
    $("bookmarkList").replaceChildren(fragment);
    $("bookmarkList").hidden = false;
    $("bookmarkCount").textContent = String(state.bookmarks.length);
    $("bookmarksEmpty").hidden = state.bookmarks.length > 0;
    const filtered = $("filterCollection").value || $("filterStatus").value;
    $("bookmarksEmptyTitle").textContent = filtered ? "Nenhum link com estes filtros" : "Sua biblioteca está começando";
    $("bookmarksEmptyDescription").textContent = filtered
      ? "Experimente outra coleção ou status, ou limpe os filtros."
      : state.collectionsLoaded && !state.collections.length
        ? "Crie sua primeira coleção e salve um link para começar."
        : "Salve seu primeiro link no formulário acima.";
  }

  async function loadCollections() {
    if (!state.user) return false;
    const epoch = state.epoch;
    const request = ++state.collectionRequest;
    state.collectionsLoaded = false;
    $("collectionFeedback").textContent = "Carregando coleções…";
    $("collectionList").hidden = true;
    $("noCollectionsHint").hidden = true;
    $("filterCollection").disabled = true;
    $("collectionCount").textContent = "—";
    updateComposer();
    try {
      const data = await api("/api/collections");
      if (request !== state.collectionRequest || epoch !== state.epoch) return false;
      if (!Array.isArray(data)) throw new ApiError("", 502);
      state.collections = data;
      state.collectionsLoaded = true;
      $("collectionFeedback").textContent = "";
      renderCollections();
      if (state.bookmarksLoaded) renderBookmarks();
      return true;
    } catch (error) {
      if (request !== state.collectionRequest || epoch !== state.epoch) return false;
      if (error.status === 401) handleError(error);
      else $("collectionFeedback").textContent = friendly(error) + " Use “Atualizar biblioteca” para tentar novamente.";
      return false;
    }
  }

  async function loadBookmarks() {
    if (!state.user) return false;
    const epoch = state.epoch;
    const request = ++state.bookmarkRequest;
    state.bookmarksLoaded = false;
    $("bookmarkFeedback").textContent = "Carregando links…";
    $("bookmarkList").hidden = true;
    $("bookmarksEmpty").hidden = true;
    $("bookmarkCount").textContent = "—";
    $("bookmarkList").setAttribute("aria-busy", "true");
    const query = new URLSearchParams();
    if ($("filterCollection").value) query.set("collection_id", $("filterCollection").value);
    if ($("filterStatus").value) query.set("status", $("filterStatus").value);
    try {
      const data = await api("/api/bookmarks" + (query.size ? "?" + query.toString() : ""));
      if (request !== state.bookmarkRequest || epoch !== state.epoch) return false;
      if (!Array.isArray(data)) throw new ApiError("", 502);
      state.bookmarks = data;
      state.bookmarksLoaded = true;
      renderBookmarks();
      $("bookmarkFeedback").textContent = data.length + (data.length === 1 ? " link nesta visualização." : " links nesta visualização.");
      return true;
    } catch (error) {
      if (request !== state.bookmarkRequest || epoch !== state.epoch) return false;
      if (error.status === 401) handleError(error);
      else $("bookmarkFeedback").textContent = friendly(error) + " Use “Atualizar biblioteca” para tentar novamente.";
      return false;
    } finally {
      if (request === state.bookmarkRequest) $("bookmarkList").setAttribute("aria-busy", "false");
    }
  }

  async function refreshLibrary() {
    // As coleções podem invalidar o filtro selecionado; reconcilie antes de buscar os links.
    await loadCollections();
    await loadBookmarks();
  }

  async function runAction(trigger, work, options = {}) {
    if (trigger.disabled) return;
    const epoch = state.epoch;
    const original = trigger.textContent;
    trigger.disabled = true;
    trigger.textContent = options.busy || "Salvando…";
    trigger.setAttribute("aria-busy", "true");
    if (options.lock) options.lock.disabled = true;
    notice("");
    if (options.form) clearErrors(options.form);
    if (options.target) notice("", false, options.target);
    try {
      await work();
      if (epoch === state.epoch && options.success) notice(options.success);
    } catch (error) {
      // Habilite os campos antes de mover o foco para um erro de validação.
      if (options.lock) options.lock.disabled = false;
      if (epoch === state.epoch) handleError(error, options.form, options.target);
    } finally {
      trigger.textContent = original;
      trigger.disabled = false;
      trigger.removeAttribute("aria-busy");
      if (options.lock) options.lock.disabled = false;
    }
  }

  function confirmDelete(title, description) {
    $("deleteDialogTitle").textContent = title;
    $("deleteDialogDescription").textContent = description;
    const dialog = $("deleteDialog");
    dialog.returnValue = "";
    return new Promise((resolve) => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
      dialog.showModal();
    });
  }

  function bookmarkPayload(form) {
    clearErrors(form);
    for (const name of ["url", "title"]) {
      const input = form.elements.namedItem(name);
      input.value = input.value.trim();
      if (!input.value) input.setCustomValidity(name === "title" ? "Informe um título para o link." : "Informe a URL do link.");
    }
    const urlInput = form.elements.namedItem("url");
    if (urlInput.value && !safeUrl(urlInput.value)) urlInput.setCustomValidity("Use uma URL completa que comece com http:// ou https://.");
    if (!form.reportValidity()) return null;
    const data = new FormData(form);
    return {
      url: data.get("url").trim(), title: data.get("title").trim(),
      summary: data.get("summary").trim(), collection_id: data.get("collection_id"), status: data.get("status"),
    };
  }

  function openEditor(bookmark) {
    if (!state.collectionsLoaded || !state.collections.length) return;
    const form = $("editBookmarkForm");
    clearErrors(form);
    notice("", false, $("editMessage"));
    state.editingId = bookmark.id;
    for (const name of ["url", "title", "summary", "collection_id", "status"]) {
      form.elements.namedItem(name).value = bookmark[name] ?? "";
    }
    $("editDialog").showModal();
    $("editTitle").focus();
  }

  function closeEditor() {
    if (!state.savingEdit) $("editDialog").close();
  }

  async function checkSession() {
    if (state.checkingSession) return;
    state.checkingSession = true;
    $("retrySessionButton").disabled = true;
    notice("");
    $("sessionLoading").hidden = false;
    $("sessionError").hidden = true;
    $("welcomeScreen").hidden = true;
    try {
      const user = await api("/api/auth/me");
      if (!user || !user.user_id || typeof user.username !== "string") throw new ApiError("", 502);
      state.epoch += 1;
      state.user = user;
      $("profileUsername").textContent = user.username;
      $("profileUserId").textContent = "user_id: " + user.user_id;
      $("avatarInitials").textContent = user.username.trim().split(/\s+/).slice(0, 2).map((word) => Array.from(word)[0] || "").join("").toLocaleUpperCase("pt-BR") || "?";
      // Preserve URLs completas da API e reconstrua somente hashes válidos.
      const avatar = typeof user.avatar === "string" && !/\s/.test(user.avatar) ? user.avatar : "";
      const avatarHash = /^(?:a_)?[a-f0-9]{32}$/;
      const customAvatar = /^https:\/\/cdn\.discordapp\.com\/avatars\/([0-9]{17,20})\/([^/?#]+)\.(?:png|gif|jpe?g|webp)(?:\?size=[0-9]+)?$/.exec(avatar);
      const defaultAvatar = /^https:\/\/cdn\.discordapp\.com\/embed\/avatars\/[0-5]\.png(?:\?size=[0-9]+)?$/.test(avatar);
      const userId = String(user.user_id);
      let avatarSrc = "";
      if (defaultAvatar || (customAvatar && customAvatar[1] === userId && avatarHash.test(customAvatar[2]))) {
        avatarSrc = avatar;
      } else if (avatarHash.test(avatar) && /^[0-9]{17,20}$/.test(userId)) {
        avatarSrc = "https://cdn.discordapp.com/avatars/" + userId + "/" + avatar + ".png";
      }
      const image = $("profileAvatar");
      image.hidden = true;
      image.onload = null;
      image.onerror = null;
      if (avatarSrc) {
        image.onload = () => { image.hidden = false; };
        image.onerror = () => { image.hidden = true; };
        image.src = avatarSrc;
      } else {
        image.removeAttribute("src");
      }
      $("sessionLoading").hidden = true;
      $("sessionProfile").hidden = false;
      $("guestHeader").hidden = true;
      $("workspace").hidden = false;
      await refreshLibrary();
    } catch (error) {
      $("sessionLoading").hidden = true;
      if (error.status === 401) showGuest();
      else {
        $("sessionError").hidden = false;
        $("sessionErrorMessage").textContent = friendly(error);
      }
    } finally {
      state.checkingSession = false;
      $("retrySessionButton").disabled = false;
    }
  }

  $("retrySessionButton").addEventListener("click", () => void checkSession());
  $("refreshButton").addEventListener("click", () => void runAction($("refreshButton"), refreshLibrary, { busy: "Atualizando…" }));
  $("logoutButton").addEventListener("click", () => void runAction($("logoutButton"), async () => {
    await api("/api/auth/logout", { method: "POST" });
    showGuest();
    notice("Você saiu da sua conta.");
    $("welcomeTitle").setAttribute("tabindex", "-1");
    $("welcomeTitle").focus();
  }, { busy: "Saindo…" }));

  $("collectionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = $("collectionName");
    clearErrors(form);
    input.value = input.value.trim();
    if (!input.value) input.setCustomValidity("Dê um nome à sua coleção.");
    if (!form.reportValidity()) return;
    const name = input.value;
    await runAction($("createCollectionButton"), async () => {
      await api("/api/collections", { method: "POST", body: { name, is_public: false } });
      form.reset();
      await loadCollections();
    }, { form, lock: input, success: "Coleção criada. Agora você pode adicionar links." });
    if (state.user && !input.value) input.focus();
  });

  $("bookmarkForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.savingBookmark || !state.collectionsLoaded || !state.collections.length) return;
    const form = event.currentTarget;
    const payload = bookmarkPayload(form);
    if (!payload) return;
    state.savingBookmark = true;
    await runAction(form.querySelector('button[type="submit"]'), async () => {
      await api("/api/bookmarks", { method: "POST", body: payload });
      form.reset();
      $("bookmarkCollection").value = payload.collection_id;
      await loadBookmarks();
    }, { form, lock: $("bookmarkFields"), success: "Link salvo na sua biblioteca." });
    state.savingBookmark = false;
    updateComposer();
    if (state.user && !form.elements.namedItem("url").value) $("bookmarkUrl").focus();
  });

  $("editBookmarkForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.savingEdit || !state.editingId) return;
    const form = event.currentTarget;
    const payload = bookmarkPayload(form);
    if (!payload) return;
    const id = state.editingId;
    state.savingEdit = true;
    $("closeEditButton").disabled = true;
    await runAction(form.querySelector('button[type="submit"]'), async () => {
      await api("/api/bookmarks/" + encodeURIComponent(id), { method: "PATCH", body: payload });
      $("editDialog").close();
      await loadBookmarks();
      focusBookmark(id);
    }, { form, lock: $("editFields"), target: $("editMessage"), success: "Link atualizado." });
    state.savingEdit = false;
    $("closeEditButton").disabled = false;
  });

  $("closeEditButton").addEventListener("click", closeEditor);
  $("cancelEditButton").addEventListener("click", closeEditor);
  $("editDialog").addEventListener("cancel", (event) => { if (state.savingEdit) event.preventDefault(); });
  $("editDialog").addEventListener("close", () => { state.editingId = null; });
  $("filterForm").addEventListener("submit", (event) => event.preventDefault());
  $("filterCollection").addEventListener("change", () => { renderCollections(); void loadBookmarks(); });
  $("filterStatus").addEventListener("change", () => void loadBookmarks());
  $("clearFiltersButton").addEventListener("click", () => {
    $("filterForm").reset();
    if (state.collectionsLoaded) renderCollections();
    void loadBookmarks();
  });
  for (const form of [$("collectionForm"), $("bookmarkForm"), $("editBookmarkForm")]) {
    form.addEventListener("input", () => clearErrors(form));
  }
  void checkSession();
})();
