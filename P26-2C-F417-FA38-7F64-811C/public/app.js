const $ = (selector, root = document) => root.querySelector(selector);
const postsGrid = $("#posts-grid");
const notice = $("#notice");
const editorDialog = $("#editor-dialog");
const articleDialog = $("#article-dialog");
let currentUser = null;
let editingPostId = null;
let openedPostId = null;

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: { ...(options.body ? { "content-type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}`);
  return data;
}
function showNotice(message, type = "") {
  notice.textContent = message;
  notice.className = `notice ${type}`;
  notice.hidden = false;
  window.setTimeout(() => { notice.hidden = true; }, 5500);
}
function escapeText(value) { return String(value ?? ""); }
function avatarUrl(user) { return user?.avatar || ""; }
function avatarMarkup(user, className = "") {
  const img = document.createElement("img");
  img.className = className;
  img.alt = "";
  img.src = avatarUrl(user) || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23e5ecd9'/%3E%3Ctext x='20' y='25' text-anchor='middle' font-size='17' fill='%23647b50'%3E✳%3C/text%3E%3C/svg%3E";
  img.onerror = () => { img.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='20' fill='%23e5ecd9'/%3E%3C/svg%3E"; };
  return img;
}
function formatDate(date) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(date));
}
function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
async function loadMe() {
  try {
    const data = await api("/api/me");
    currentUser = data.user;
    renderAccount();
  } catch { currentUser = null; }
}
function renderAccount() {
  const area = $("#account-area");
  area.replaceChildren();
  if (!currentUser) {
    const link = make("a", "button button-dark", "Entrar com Discord");
    link.href = "/api/auth/discord";
    area.append(link);
    return;
  }
  const menu = make("div", "user-menu");
  menu.append(avatarMarkup(currentUser, "user-avatar"));
  const label = make("div");
  label.append(make("strong", "", currentUser.global_name || currentUser.username));
  label.append(make("small", "", "Conectado pelo Discord"));
  menu.append(label);
  const write = make("button", "button button-primary button-small", "＋ Artigo");
  write.type = "button";
  write.addEventListener("click", () => openEditor());
  const logout = make("button", "outline-button", "Sair");
  logout.type = "button";
  logout.addEventListener("click", logoutUser);
  area.append(menu, write, logout);
}
async function logoutUser() {
  await api("/api/auth/logout", { method: "POST" }).catch(() => {});
  currentUser = null;
  renderAccount();
  loadPosts();
  showNotice("Você saiu da sua conta.", "success");
}
async function loadPosts() {
  postsGrid.replaceChildren(make("div", "loading", "Carregando artigos..."));
  try {
    const data = await api("/api/posts");
    const posts = data.posts || [];
    $("#post-count").textContent = `${posts.length} ${posts.length === 1 ? "artigo" : "artigos"}`;
    postsGrid.replaceChildren();
    if (!posts.length) {
      postsGrid.append(make("div", "empty-state", "Ainda não há artigos publicados. Entre com Discord e compartilhe o primeiro conhecimento da turma."));
      return;
    }
    posts.forEach(post => postsGrid.append(createPostCard(post)));
  } catch (error) {
    postsGrid.replaceChildren(make("div", "empty-state", `Não foi possível carregar os artigos: ${error.message}`));
  }
}
function createPostCard(post) {
  const card = make("article", "post-card");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Abrir artigo ${post.title}`);
  card.addEventListener("click", () => openArticle(post.id));
  card.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openArticle(post.id); } });
  card.append(make("span", "post-tag", "ARTIGO TÉCNICO"));
  card.append(make("h3", "", post.title));
  card.append(make("p", "", post.excerpt || post.content.slice(0, 180)));
  const author = make("div", "post-author");
  author.append(avatarMarkup({ avatar: post.avatar }, ""));
  const authorText = make("div");
  authorText.append(make("strong", "", post.global_name || post.username));
  authorText.append(make("small", "", formatDate(post.created_at)));
  author.append(authorText);
  author.append(make("span", "post-stats", `♡ ${post.likes_count || 0}  ·  ${post.comments_count || 0} comentários`));
  card.append(author);
  return card;
}
function openEditor(post = null) {
  if (!currentUser) { location.href = "/api/auth/discord"; return; }
  editingPostId = post?.id || null;
  $("#editor-title").textContent = post ? "Editar artigo" : "Novo artigo";
  $("#post-title").value = post?.title || "";
  $("#post-content").value = post?.content || "";
  editorDialog.showModal();
}
$("#close-editor").addEventListener("click", () => editorDialog.close());
$("#editor-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $('button[type="submit"]', event.currentTarget);
  button.disabled = true;
  const body = { title: $("#post-title").value, content: $("#post-content").value };
  try {
    await api(editingPostId ? `/api/posts/${editingPostId}` : "/api/posts", {
      method: editingPostId ? "PATCH" : "POST", body: JSON.stringify(body)
    });
    editorDialog.close();
    showNotice(editingPostId ? "Artigo atualizado!" : "Artigo publicado!", "success");
    await loadPosts();
    if (openedPostId) await openArticle(editingPostId || openedPostId);
  } catch (error) { showNotice(error.message, "error"); }
  finally { button.disabled = false; }
});
$("#close-article").addEventListener("click", () => articleDialog.close());

async function openArticle(id) {
  openedPostId = id;
  try {
    const [{ post }, commentsData, likesData] = await Promise.all([
      api(`/api/posts/${id}`), api(`/api/posts/${id}/comments`), api(`/api/posts/${id}/likes`)
    ]);
    const root = $("#article-detail");
    root.replaceChildren();
    const title = make("h1", "article-title", post.title);
    const byline = make("div", "article-byline");
    byline.append(avatarMarkup({ avatar: post.avatar }, ""));
    byline.append(make("span", "", `${post.global_name || post.username} · ${formatDate(post.created_at)}`));
    root.append(title, byline, make("div", "article-body", post.content));
    const actions = make("div", "article-actions");
    const like = make("button", "outline-button", `♡ ${likesData.count} Curtir${likesData.liked ? " (curtido)" : ""}`);
    like.type = "button";
    like.addEventListener("click", async () => {
      try { const result = await api(`/api/posts/${id}/likes`, { method: "POST" }); like.textContent = `${result.liked ? "♥" : "♡"} ${result.count} ${result.liked ? "Curtido" : "Curtir"}`; }
      catch (error) { showNotice(error.message, "error"); }
    });
    actions.append(like);
    if (currentUser?.id === post.author_id) {
      const edit = make("button", "outline-button", "Editar");
      edit.addEventListener("click", () => { articleDialog.close(); openEditor(post); });
      const del = make("button", "outline-button", "Excluir");
      del.addEventListener("click", async () => {
        if (!confirm("Tem certeza que deseja excluir este artigo?")) return;
        try { await api(`/api/posts/${id}`, { method: "DELETE" }); articleDialog.close(); showNotice("Artigo excluído.", "success"); loadPosts(); }
        catch (error) { showNotice(error.message, "error"); }
      });
      actions.append(edit, del);
    }
    root.append(actions);
    const comments = make("section", "comments");
    comments.append(make("h3", "", `Comentários (${commentsData.comments.length})`));
    if (!commentsData.comments.length) comments.append(make("p", "", "Ainda não há comentários. Seja a primeira pessoa a comentar."));
    commentsData.comments.forEach(item => {
      const row = make("div", "comment");
      row.append(avatarMarkup({ avatar: item.avatar }, ""));
      const body = make("div");
      const head = make("div");
      head.append(make("strong", "", item.global_name || item.username));
      head.append(make("small", "", formatDate(item.created_at)));
      body.append(head, make("p", "", item.content));
      row.append(body);
      comments.append(row);
    });
    if (currentUser) {
      const form = make("form", "comment-form");
      const textarea = make("textarea");
      textarea.required = true; textarea.maxLength = 2000; textarea.placeholder = "Escreva um comentário...";
      const submit = make("button", "button button-primary", "Enviar");
      submit.type = "submit";
      form.append(textarea, submit);
      form.addEventListener("submit", async event => {
        event.preventDefault();
        submit.disabled = true;
        try { await api(`/api/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ content: textarea.value }) }); await openArticle(id); }
        catch (error) { showNotice(error.message, "error"); }
        finally { submit.disabled = false; }
      });
      comments.append(form);
    } else {
      const login = make("a", "text-link", "Entre com Discord para comentar");
      login.href = "/api/auth/discord";
      comments.append(login);
    }
    root.append(comments);
    articleDialog.showModal();
  } catch (error) { showNotice(error.message, "error"); }
}
(async function init() { await loadMe(); await loadPosts(); })();
