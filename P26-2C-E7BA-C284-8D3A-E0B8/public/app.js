const $ = (id) => document.getElementById(id);
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
const state = { me: null, book: null, readers: [], chapter: 1 };

const MENSAGENS = {
  invalid_state: "O login não pôde ser confirmado. Tente entrar de novo.",
  access_denied: "Você cancelou o login no Discord.",
  token_exchange_failed: "O Discord recusou o login. Tente de novo.",
  db_error: "Não foi possível salvar seu perfil. Tente de novo em instantes.",
  not_authenticated: "Sua sessão expirou. Entre com o Discord de novo.",
  not_subscribed: "Inscreva-se no livro para continuar.",
  already_subscribed: "Você já está inscrito neste livro.",
  spoiler_blocked: "Esse capítulo ainda está à frente do seu progresso.",
  chapter_out_of_range: "Esse capítulo não existe neste livro.",
  chapter_jump_not_allowed: "Avance um capítulo por vez, conforme for terminando a leitura.",
  invalid_chapter: "Informe um número de capítulo válido.",
  empty_content: "Escreva uma mensagem antes de publicar.",
  content_too_long: "A mensagem passa de 2000 caracteres.",
};

function notice(text, ok = false) {
  const el = $("notice");
  el.textContent = text;
  el.className = "notice" + (ok ? " ok" : "");
  el.hidden = !text;
}

function erro(data) {
  return MENSAGENS[data.error] || "Algo deu errado. Tente de novo.";
}

async function api(path, body) {
  const options = body === undefined ? {} : {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
  const res = await fetch(path, options);
  let data = {};
  try { data = await res.json(); } catch { /* resposta sem corpo */ }
  return { ok: res.ok, status: res.status, data };
}

function safeAvatar(url) {
  return typeof url === "string" && url.startsWith("https://cdn.discordapp.com/") ? url : DEFAULT_AVATAR;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function avatar(url, className, alt) {
  const img = el("img", className);
  img.src = safeAvatar(url);
  img.alt = alt || "";
  return img;
}

function formatDate(s) {
  if (!s) return "";
  const d = new Date(s.replace(" ", "T") + "Z");
  return isNaN(d) ? s : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function renderHeader() {
  const area = $("userArea");
  area.replaceChildren();
  if (!state.me) return;
  const box = el("div", "user");
  box.append(avatar(state.me.user.avatar, "", ""), el("span", "", state.me.user.username));
  const out = el("button", "btn-ghost", "Sair");
  out.type = "button";
  out.addEventListener("click", async () => {
    await api("/api/auth/logout", {});
    location.href = "/";
  });
  box.append(out);
  area.append(box);
}

function renderBook() {
  const { book, subscribed, currentChapter } = state.me;
  $("bookTitle").textContent = book.title;
  const box = $("bookActions");
  box.replaceChildren();

  if (!subscribed) {
    const btn = el("button", "btn", "Entrar na leitura");
    btn.type = "button";
    btn.addEventListener("click", async () => {
      const r = await api("/api/book/join", {});
      if (!r.ok) return notice(erro(r.data));
      notice("Inscrição feita. Bom começo de leitura!", true);
      await load();
    });
    box.append(el("p", "", "Você ainda não está neste livro."), btn);
    return;
  }

  const row = el("div", "progress-row");
  row.append(el("span", "", "Você está no capítulo " + currentChapter + " de " + book.totalChapters + "."));
  const mover = (alvo) => async () => {
    const r = await api("/api/progress/update", { chapter: alvo });
    if (!r.ok) return notice(erro(r.data));
    notice("Progresso atualizado para o capítulo " + r.data.chapter + ".", true);
    state.chapter = r.data.chapter;
    await load();
  };
  if (currentChapter < book.totalChapters) {
    const next = el("button", "btn", "Terminei o capítulo " + currentChapter + " — ir para o " + (currentChapter + 1));
    next.type = "button";
    next.addEventListener("click", mover(currentChapter + 1));
    row.append(next);
  } else {
    row.append(el("span", "label", "Você chegou ao último capítulo."));
  }
  if (currentChapter > 1) {
    const back = el("button", "btn-ghost", "Voltar um capítulo");
    back.type = "button";
    back.addEventListener("click", mover(currentChapter - 1));
    row.append(back);
  }
  box.append(row);
}

async function renderTrack() {
  const box = $("track");
  const r = await api("/api/progress/track");
  if (!r.ok) {
    box.replaceChildren(el("p", "empty", erro(r.data)));
    return;
  }
  const total = r.data.book.totalChapters;
  const rail = el("div", "rail");
  const lanes = {};
  r.data.readers.forEach((reader) => {
    const lane = lanes[reader.currentChapter] || 0;
    lanes[reader.currentChapter] = lane + 1;
    const img = avatar(reader.avatar, "runner" + (reader.isMe ? " me" : ""), reader.username);
    img.title = reader.username + " — capítulo " + reader.currentChapter;
    img.style.left = (reader.currentChapter / total) * 100 + "%";
    img.style.setProperty("--lane", String(lane));
    rail.append(img);
  });
  const ends = el("div", "ends");
  ends.append(el("span", "", "Início"), el("span", "", "Capítulo " + total));
  const legend = el("p", "legend", r.data.readers.length + " leitor(es) na rodada. Borda azul: você.");
  box.replaceChildren(rail, ends, legend);
}

function renderTabs() {
  const { totalChapters } = state.me.book;
  const current = state.me.currentChapter || 0;
  const tabs = $("tabs");
  tabs.replaceChildren();
  for (let n = 1; n <= totalChapters; n++) {
    const tab = el("button", "tab", n > current ? "🔒 " + n : String(n));
    tab.type = "button";
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-selected", String(n === state.chapter));
    tab.disabled = n > current;
    tab.addEventListener("click", () => { state.chapter = n; renderForum(); });
    tabs.append(tab);
  }
}

async function renderForum() {
  renderTabs();
  const list = $("posts");
  const form = $("postForm");
  if (!state.me.subscribed) {
    list.replaceChildren(el("li", "empty", "Inscreva-se no livro para ver e escrever no fórum."));
    form.hidden = true;
    return;
  }
  const r = await api("/api/forum/list?chapter=" + state.chapter);
  list.replaceChildren();
  if (!r.ok) {
    list.append(el("li", "empty", erro(r.data)));
    form.hidden = true;
    return;
  }
  if (r.data.posts.length === 0) {
    list.append(el("li", "empty", "Ninguém escreveu neste capítulo ainda. Comece a conversa."));
  }
  r.data.posts.forEach((p) => {
    const item = el("li", "post");
    const body = el("div");
    const head = el("div");
    head.append(el("b", "", p.username), el("small", "", formatDate(p.created_at)));
    body.append(head, el("p", "", p.content));
    item.append(avatar(p.avatar, "", p.username), body);
    list.append(item);
  });
  $("postChapter").textContent = String(state.chapter);
  form.hidden = false;
}

$("postForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = $("postText");
  const r = await api("/api/forum/post", { chapter: state.chapter, content: text.value });
  if (!r.ok) return notice(erro(r.data));
  text.value = "";
  notice("Mensagem publicada.", true);
  renderForum();
});

async function load() {
  const me = await api("/api/me");
  if (!me.ok) {
    state.me = null;
    $("viewApp").hidden = true;
    $("viewGuest").hidden = false;
    renderHeader();
    return;
  }
  state.me = me.data;
  if (!state.me.book) {
    $("viewGuest").hidden = true;
    $("viewApp").hidden = true;
    notice("Ainda não há livro ativo nesta rodada.");
    return renderHeader();
  }
  if (!state.me.subscribed) state.chapter = 1;
  else if (state.chapter > state.me.currentChapter || !state.chapter) state.chapter = state.me.currentChapter;
  $("viewGuest").hidden = true;
  $("viewApp").hidden = false;
  renderHeader();
  renderBook();
  await Promise.all([renderTrack(), renderForum()]);
}

const authError = new URLSearchParams(location.search).get("auth_error");
if (authError) {
  notice(MENSAGENS[authError] || "O login não foi concluído. Tente de novo.");
  history.replaceState(null, "", "/");
}
load();