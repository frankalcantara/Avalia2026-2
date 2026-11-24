// Notas acadêmicas: plain JavaScript, direct DOM manipulation, no frameworks.
// Depends on renderMarkdown() from /markdown.js.
(function () {
  "use strict";

  const SAMPLE = [
    "# Resumo de Redes",
    "",
    "Escreva em **Markdown** e veja o resultado ao lado.",
    "",
    "## Camadas",
    "",
    "1. Física",
    "2. Enlace",
    "3. Rede",
    "",
    "- Teste a conectividade com `ping`",
    "- Capture pacotes com *Wireshark*",
    "",
    "```",
    "ping -n 4 example.com",
    "```",
    "",
  ].join("\n");

  const AUTH_ERRORS = {
    access_denied: "Você cancelou a autorização no Discord.",
    invalid_state: "A verificação de segurança falhou. Tente entrar de novo.",
    token_exchange_failed: "O Discord recusou o login. Tente novamente.",
    fetch_user_failed: "Não foi possível ler seu perfil do Discord.",
    missing_database: "O banco de dados não está configurado.",
    exception: "Algo deu errado durante o login. Tente novamente.",
  };

  const TAG_RE = /^[\p{L}\p{N}_-]{1,30}$/u;
  const MAX_TAGS = 10;

  const $ = (id) => document.getElementById(id);
  const el = {
    session: $("session"),
    guestBox: $("guestBox"),
    tools: $("libraryTools"),
    newBtn: $("newBtn"),
    search: $("searchInput"),
    tagFilter: $("tagFilter"),
    noteList: $("noteList"),
    title: $("titleInput"),
    draftTags: $("draftTags"),
    tagInput: $("tagInput"),
    editor: $("editor"),
    preview: $("preview"),
    saveBtn: $("saveBtn"),
    deleteBtn: $("deleteBtn"),
    status: $("status"),
  };

  const state = {
    user: null,
    notes: [],
    tags: [],
    activeTag: "",
    query: "",
    currentId: null,
    draftTags: [],
    dirty: false,
  };

  // ---------- helpers ----------

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "same-origin",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      /* empty body */
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || "Erro " + res.status + ".");
      err.status = res.status;
      throw err;
    }
    return data;
  }

  function setStatus(message, kind) {
    el.status.textContent = message || "";
    el.status.dataset.kind = kind || "";
  }

  function formatDate(sqlUtc) {
    const date = new Date(String(sqlUtc).replace(" ", "T") + "Z");
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function make(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function confirmDiscard() {
    return !state.dirty || window.confirm("Há alterações não salvas. Descartar e continuar?");
  }

  function markDirty() {
    state.dirty = true;
  }

  // ---------- rendering ----------

  function renderPreview() {
    el.preview.innerHTML = renderMarkdown(el.editor.value);
  }

  function renderSession() {
    el.session.replaceChildren();
    if (state.user) {
      const img = make("img");
      img.src = state.user.avatar;
      img.alt = "";
      img.width = 32;
      img.height = 32;
      const name = make("span", "name", state.user.username);
      const out = make("button", "btn", "Sair");
      out.type = "button";
      out.addEventListener("click", logout);
      el.session.append(img, name, out);
    } else {
      const link = make("a", "btn primary", "Entrar com Discord");
      link.href = "/api/auth/discord";
      el.session.append(link);
    }
  }

  function renderAuthState() {
    const logged = Boolean(state.user);
    el.guestBox.hidden = logged;
    el.tools.hidden = !logged;
    el.saveBtn.disabled = !logged;
    el.saveBtn.title = logged ? "" : "Entre com o Discord para salvar.";
    el.deleteBtn.disabled = !logged || !state.currentId;
    renderSession();
  }

  function renderTagFilter() {
    el.tagFilter.replaceChildren();
    const all = make("button", "chip", "Todas");
    all.type = "button";
    all.setAttribute("aria-pressed", String(state.activeTag === ""));
    all.addEventListener("click", () => setActiveTag(""));
    el.tagFilter.append(all);
    for (const tag of state.tags) {
      const chip = make("button", "chip");
      chip.type = "button";
      chip.append("#" + tag.name + " ", make("span", "count", String(tag.total)));
      chip.setAttribute("aria-pressed", String(state.activeTag === tag.name));
      chip.addEventListener("click", () => setActiveTag(state.activeTag === tag.name ? "" : tag.name));
      el.tagFilter.append(chip);
    }
  }

  function renderNoteList() {
    el.noteList.replaceChildren();
    if (state.notes.length === 0) {
      const filtering = state.query || state.activeTag;
      const li = make("li");
      li.append(
        make(
          "p",
          "empty",
          filtering
            ? "Nenhuma nota encontrada com esses filtros."
            : "Você ainda não tem notas. Escreva ao lado e use Salvar nota."
        )
      );
      el.noteList.append(li);
      return;
    }
    for (const note of state.notes) {
      const li = make("li");
      const btn = make("button", "note-item");
      btn.type = "button";
      if (note.id === state.currentId) btn.setAttribute("aria-current", "true");
      btn.append(make("strong", "", note.title));
      if (note.snippet) btn.append(make("span", "snippet", note.snippet.replace(/\s+/g, " ")));
      if (note.tags.length) btn.append(make("span", "note-tags", note.tags.map((t) => "#" + t).join(" ")));
      btn.append(make("span", "when", formatDate(note.updated_at)));
      btn.addEventListener("click", () => openNote(note.id));
      li.append(btn);
      el.noteList.append(li);
    }
  }

  function renderDraftTags() {
    el.draftTags.replaceChildren();
    for (const name of state.draftTags) {
      const li = make("li", "chip");
      li.append("#" + name);
      const remove = make("button", "remove", "×");
      remove.type = "button";
      remove.setAttribute("aria-label", "Remover tag " + name);
      remove.addEventListener("click", () => {
        state.draftTags = state.draftTags.filter((t) => t !== name);
        markDirty();
        renderDraftTags();
      });
      li.append(remove);
      el.draftTags.append(li);
    }
  }

  // ---------- data ----------

  async function loadNotes() {
    if (!state.user) return;
    const params = new URLSearchParams();
    if (state.query) params.set("q", state.query);
    if (state.activeTag) params.set("tag", state.activeTag);
    state.notes = await api("/api/notes?" + params.toString());
    renderNoteList();
  }

  async function loadTags() {
    if (!state.user) return;
    state.tags = await api("/api/tags");
    if (state.activeTag && !state.tags.some((t) => t.name === state.activeTag)) state.activeTag = "";
    renderTagFilter();
  }

  async function refreshAll() {
    await loadTags();
    await loadNotes();
  }

  function handleError(err) {
    if (err.status === 401) {
      state.user = null;
      renderAuthState();
      setStatus("Sua sessão expirou. Entre com o Discord novamente.", "error");
    } else {
      setStatus(err.message, "error");
    }
  }

  // ---------- editor actions ----------

  function resetEditor(withSample) {
    state.currentId = null;
    state.draftTags = [];
    state.dirty = false;
    el.title.value = "";
    el.editor.value = withSample ? SAMPLE : "";
    el.tagInput.value = "";
    renderDraftTags();
    renderPreview();
    renderAuthState();
    renderNoteList();
    setStatus("");
  }

  async function openNote(id) {
    if (id === state.currentId || !confirmDiscard()) return;
    try {
      const note = await api("/api/notes/" + id);
      state.currentId = note.id;
      state.draftTags = note.tags;
      state.dirty = false;
      el.title.value = note.title;
      el.editor.value = note.content;
      renderDraftTags();
      renderPreview();
      renderAuthState();
      renderNoteList();
      setStatus("");
    } catch (err) {
      handleError(err);
    }
  }

  function addTagsFromInput() {
    const pieces = el.tagInput.value.split(/[,\s]+/).map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean);
    el.tagInput.value = "";
    for (const name of pieces) {
      if (!TAG_RE.test(name)) {
        setStatus("Tags aceitam letras, números, hífen e sublinhado (até 30 caracteres).", "error");
        continue;
      }
      if (state.draftTags.includes(name)) continue;
      if (state.draftTags.length >= MAX_TAGS) {
        setStatus("Use no máximo " + MAX_TAGS + " tags por nota.", "error");
        break;
      }
      state.draftTags.push(name);
      markDirty();
    }
    renderDraftTags();
  }

  async function save() {
    if (!state.user) return;
    addTagsFromInput();
    const title = el.title.value.trim();
    if (!title) {
      setStatus("Informe um título para salvar.", "error");
      el.title.focus();
      return;
    }
    const payload = JSON.stringify({ title, content: el.editor.value, tags: state.draftTags });
    el.saveBtn.disabled = true;
    try {
      if (state.currentId) {
        await api("/api/notes/" + state.currentId, { method: "PUT", body: payload });
      } else {
        const created = await api("/api/notes", { method: "POST", body: payload });
        state.currentId = created.id;
      }
      state.dirty = false;
      await refreshAll();
      renderAuthState();
      setStatus("Nota salva.", "ok");
    } catch (err) {
      handleError(err);
    } finally {
      el.saveBtn.disabled = !state.user;
    }
  }

  async function remove() {
    if (!state.user || !state.currentId) return;
    if (!window.confirm("Excluir esta nota? Essa ação não pode ser desfeita.")) return;
    try {
      await api("/api/notes/" + state.currentId, { method: "DELETE" });
      resetEditor(false);
      await refreshAll();
      setStatus("Nota excluída.", "ok");
    } catch (err) {
      handleError(err);
    }
  }

  async function logout() {
    if (!confirmDiscard()) return;
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch (_) {
      /* the cookie may already be gone */
    }
    state.user = null;
    state.notes = [];
    state.tags = [];
    state.activeTag = "";
    state.query = "";
    el.search.value = "";
    resetEditor(true);
    setStatus("Você saiu.", "ok");
  }

  async function setActiveTag(name) {
    state.activeTag = name;
    renderTagFilter();
    try {
      await loadNotes();
    } catch (err) {
      handleError(err);
    }
  }

  // ---------- events ----------

  let searchTimer = null;
  el.search.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      state.query = el.search.value.trim();
      try {
        await loadNotes();
      } catch (err) {
        handleError(err);
      }
    }, 250);
  });

  el.editor.addEventListener("input", () => {
    renderPreview();
    markDirty();
  });
  el.title.addEventListener("input", markDirty);

  el.tagInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTagsFromInput();
    } else if (event.key === "Backspace" && el.tagInput.value === "" && state.draftTags.length) {
      state.draftTags.pop();
      markDirty();
      renderDraftTags();
    }
  });
  el.tagInput.addEventListener("blur", () => {
    if (el.tagInput.value.trim()) addTagsFromInput();
  });

  el.saveBtn.addEventListener("click", save);
  el.deleteBtn.addEventListener("click", remove);
  el.newBtn.addEventListener("click", () => {
    if (confirmDiscard()) resetEditor(false);
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (state.dirty && state.user) {
      event.preventDefault();
      event.returnValue = "";
    }
  });

  // ---------- start ----------

  async function init() {
    resetEditor(true);

    const params = new URLSearchParams(window.location.search);
    const authError = params.get("auth_error");
    if (authError || params.has("login")) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    try {
      const me = await api("/api/me");
      state.user = me.user;
    } catch (_) {
      state.user = null;
    }
    renderAuthState();

    if (authError) {
      setStatus(AUTH_ERRORS[authError] || "Não foi possível entrar com o Discord.", "error");
    }
    if (state.user) {
      try {
        await refreshAll();
        el.editor.value = "";
        renderPreview();
        if (!authError) setStatus("Olá, " + state.user.username + ".", "ok");
      } catch (err) {
        handleError(err);
      }
    }
  }

  init();
})();
