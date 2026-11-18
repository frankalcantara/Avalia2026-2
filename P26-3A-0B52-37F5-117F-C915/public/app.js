"use strict";

const byId = id => document.getElementById(id);
const kinds = { livro: "Livro", artigo: "Artigo científico", palestra: "Palestra" };
const form = byId("entry");
let user = null;
let scope = "public";
let quotes = [];
let viewState = "loading";
let activeLoad = 0;
let sessionKnown = false;

function element(tag, value, className) {
  const node = document.createElement(tag);
  if (value !== undefined) node.textContent = value;
  if (className) node.className = className;
  return node;
}

async function api(path, options) {
  const response = await fetch(path, options);
  let result;
  try { result = await response.json(); }
  catch { throw new Error("O servidor retornou uma resposta inesperada. Tente novamente."); }
  if (!response.ok) throw new Error(result.message || "Não foi possível concluir a solicitação.");
  return result;
}

function makeCard(quote, showNote = false) {
  const card = element("article", undefined, "card");
  const heading = element("h3", [kinds[quote.kind], quote.theme].filter(Boolean).join(" · "), "meta");
  const citation = element("blockquote", quote.text);
  const author = element("strong", quote.author);
  const reference = element("p");
  reference.append(author, document.createTextNode(" · "), element("cite", quote.source));
  if (quote.page) {
    const prefix = quote.kind === "palestra" ? " · " : " · p. ";
    reference.append(document.createTextNode(prefix + quote.page));
  }
  card.append(heading, citation, reference);
  const attribution = quote.username ? " · " + quote.username : "";
  card.append(element("p", (quote.visibility === "private" ? "Privada" : "Pública") + attribution, "byline"));
  if (quote.note) {
    const details = element("details");
    details.open = showNote;
    details.append(element("summary", "Nota de leitura"), element("p", quote.note, "reflection"));
    card.append(details);
  }
  return card;
}

function emptyPanel(message, action) {
  const panel = element("div", undefined, "empty");
  panel.append(element("p", message));
  if (action) panel.append(action);
  return panel;
}

function actionButton(label, callback) {
  const button = element("button", label, "secondary");
  button.type = "button";
  button.addEventListener("click", callback);
  return button;
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

function renderFeed() {
  const cards = byId("cards");
  const status = byId("status");
  cards.replaceChildren();
  if (viewState === "loading") {
    status.textContent = "Carregando citações…";
    return;
  }
  if (viewState === "error") {
    status.textContent = "Acervo indisponível.";
    cards.append(emptyPanel("Não foi possível carregar as citações.", actionButton("Tentar novamente", loadFeed)));
    return;
  }
  if (viewState === "signedOut") {
    status.textContent = "";
    const login = element("a", "Entrar com Discord", "login");
    login.href = "/api/auth/discord";
    cards.append(emptyPanel("Entre para ler suas citações públicas e privadas.", login));
    return;
  }
  const query = normalize(byId("search").value);
  const matches = quotes.filter(quote => normalize(quote.author).includes(query) || normalize(quote.theme).includes(query));
  status.textContent = matches.length === 1 ? "1 citação" : matches.length + " citações";
  if (matches.length) {
    cards.append(...matches.map(quote => makeCard(quote)));
  } else if (query) {
    cards.append(emptyPanel("Nenhuma citação corresponde à sua busca.", actionButton("Limpar busca", () => {
      byId("search").value = "";
      byId("search").focus();
      renderFeed();
    })));
  } else {
    cards.append(emptyPanel(scope === "mine" ? "Seu acervo começa com o primeiro trecho." : "A turma ainda não compartilhou citações.", actionButton("Registrar citação", compose)));
  }
}

async function loadFeed() {
  const version = ++activeLoad;
  quotes = [];
  viewState = "loading";
  renderFeed();
  if (scope === "mine" && sessionKnown && !user) {
    viewState = "signedOut";
  } else {
    try {
      const result = await api("/api/quotes?scope=" + scope);
      if (version !== activeLoad) return;
      quotes = result.quotes;
      viewState = "ready";
    } catch {
      if (version !== activeLoad) return;
      viewState = "error";
    }
  }
  renderFeed();
}

function chooseScope(next) {
  scope = next;
  byId("search").value = "";
  for (const id of ["public", "mine"]) byId(id).setAttribute("aria-pressed", String(id === scope));
  return loadFeed();
}

function compose() {
  if (!user) {
    location.assign("/api/auth/discord");
    return;
  }
  byId("form-error").textContent = "";
  byId("editor").showModal();
}

function updatePage() {
  const needed = form.elements.kind.value !== "palestra";
  form.elements.page.required = needed;
  byId("page-label").querySelector("span").textContent = needed ? "Página" : "Página ou tempo (opcional)";
}

form.elements.kind.addEventListener("change", updatePage);
byId("compose").addEventListener("click", compose);
byId("public").addEventListener("click", () => chooseScope("public"));
byId("mine").addEventListener("click", () => chooseScope("mine"));
byId("search").addEventListener("input", renderFeed);
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = form.querySelector("[type=submit]");
  submit.disabled = true;
  byId("form-error").textContent = "";
  try {
    await api("/api/quotes", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(Object.fromEntries(new FormData(form)))});
    form.reset();
    updatePage();
    byId("editor").close();
    await chooseScope("mine");
    if (viewState === "ready") byId("status").textContent = "Citação salva. " + byId("status").textContent;
    byId("acervo").scrollIntoView();
  } catch (error) {
    byId("form-error").textContent = error.message;
  } finally { submit.disabled = false; }
});

byId("random").addEventListener("click", async () => {
  const target = byId("detail-body");
  byId("random").disabled = true;
  target.textContent = "Sorteando…";
  byId("detail").showModal();
  try {
    const {quote} = await api("/api/random");
    target.replaceChildren(quote ? makeCard(quote, true) : emptyPanel("O sorteio fica disponível quando a turma compartilha sua primeira citação."));
  } catch (error) { target.textContent = error.message; }
  finally { byId("random").disabled = false; }
});

byId("logout").addEventListener("click", async () => {
  byId("logout").disabled = true;
  try {
    await api("/api/auth/logout", {method:"POST"});
    location.replace("/");
  } catch (error) {
    byId("status").textContent = error.message;
    byId("logout").disabled = false;
  }
});

async function loadSession() {
  const {user: current} = await api("/api/me");
  user = current;
  sessionKnown = true;
  byId("login").hidden = Boolean(user);
  byId("logout").hidden = !user;
  byId("username").textContent = user?.username || "";
  if (user?.avatar && user.avatar.startsWith("https://cdn.discordapp.com/")) {
    byId("avatar").src = user.avatar;
    byId("avatar").hidden = false;
  }
  if (scope === "mine") await loadFeed();
}
const authError = new URL(location.href).searchParams.get("auth_error");
if (authError) {
  const messages = {
    access_denied: "O login com Discord foi cancelado. Você pode continuar lendo o acervo da turma.",
    invalid_state: "A autorização expirou. Entre com Discord novamente.",
    auth_not_configured: "O login com Discord ainda precisa ser configurado.",
    database_unavailable: "O banco de dados está indisponível. Tente entrar novamente mais tarde."
  };
  const notice = byId("auth-notice");
  notice.textContent = Object.hasOwn(messages, authError) ? messages[authError] : "Não foi possível concluir o login com Discord. Tente novamente.";
  notice.hidden = false;
}
loadFeed();
loadSession().catch(() => { byId("username").textContent = "Sessão indisponível"; });
