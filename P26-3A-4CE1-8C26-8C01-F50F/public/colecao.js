"use strict";

(() => {
  const $ = (id) => document.getElementById(id);
  const STATUS = Object.freeze({ para_ler: "Para Ler", lendo: "Lendo", concluido: "Concluído" });
  const collectionId = new URLSearchParams(window.location.search).get("id");
  let loading = false;

  function element(tag, className = "", text = "") {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== "") node.textContent = String(text);
    return node;
  }

  async function publicApi(path) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, {
        credentials: "same-origin", headers: { Accept: "application/json" }, signal: controller.signal,
      });
      let payload = null;
      try { payload = await response.json(); } catch { /* Trate também erros sem JSON. */ }
      if (!response.ok) {
        const error = new Error(payload?.error?.message || "Não foi possível carregar esta coleção.");
        error.status = response.status;
        throw error;
      }
      if (!payload || !Object.prototype.hasOwnProperty.call(payload, "data")) {
        throw new Error("O servidor enviou uma resposta inesperada. Tente novamente.");
      }
      return payload.data;
    } finally {
      clearTimeout(timeout);
    }
  }

  function renderLinks(bookmarks) {
    const fragment = document.createDocumentFragment();
    for (const bookmark of bookmarks) {
      const item = element("li");
      const article = element("article", "bookmark-card");
      const meta = element("div", "bookmark-meta");
      const knownStatus = Object.prototype.hasOwnProperty.call(STATUS, bookmark.status);
      meta.append(element("span", "status-pill status-" + (knownStatus ? bookmark.status : "unknown"), knownStatus ? STATUS[bookmark.status] : "Status indisponível"));
      const heading = element("h2", "bookmark-title");
      let url = null;
      try {
        const candidate = new URL(bookmark.url);
        if (candidate.protocol === "http:" || candidate.protocol === "https:") url = candidate;
      } catch { /* Não transforme URLs inválidas ou executáveis em links. */ }
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
      item.append(article);
      fragment.append(item);
    }
    $("publicBookmarkList").replaceChildren(fragment);
  }

  function showError(message, retry) {
    $("publicCollectionTitle").textContent = "Coleção indisponível";
    $("publicCollectionDescription").textContent = "Confira o endereço ou peça um novo link a quem compartilhou a coleção.";
    document.title = "Coleção indisponível — Bookmark Manager";
    $("publicFeedback").textContent = message;
    $("publicFeedback").classList.add("notice-error");
    $("publicFeedback").setAttribute("role", "alert");
    $("publicFeedback").setAttribute("aria-live", "assertive");
    $("publicFeedback").hidden = false;
    $("retryPublicButton").hidden = !retry;
  }

  async function loadCollection() {
    if (loading) return;
    if (!collectionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(collectionId)) {
      showError("Este link de coleção é inválido ou está incompleto.", false);
      return;
    }
    loading = true;
    $("retryPublicButton").disabled = true;
    $("retryPublicButton").hidden = true;
    $("publicBookmarkList").replaceChildren();
    $("publicBookmarkList").setAttribute("aria-busy", "true");
    $("publicEmpty").hidden = true;
    $("publicCount").hidden = true;
    $("publicFeedback").textContent = "Buscando os links desta coleção…";
    $("publicFeedback").classList.remove("sr-only");
    $("publicFeedback").classList.remove("notice-error");
    $("publicFeedback").setAttribute("role", "status");
    $("publicFeedback").setAttribute("aria-live", "polite");
    $("publicFeedback").hidden = false;
    try {
      const path = "/api/public/collections/" + encodeURIComponent(collectionId);
      const [collection, bookmarks] = await Promise.all([publicApi(path), publicApi(path + "/bookmarks")]);
      if (!collection || typeof collection.name !== "string" || !Array.isArray(bookmarks)) {
        throw new Error("O servidor enviou uma resposta inesperada. Tente novamente.");
      }
      $("publicCollectionTitle").textContent = collection.name;
      $("publicCollectionDescription").textContent = "Uma coleção de referências para explorar no seu ritmo.";
      document.title = collection.name + " — Bookmark Manager";
      renderLinks(bookmarks);
      $("publicCount").textContent = bookmarks.length + (bookmarks.length === 1 ? " link nesta coleção" : " links nesta coleção");
      $("publicCount").hidden = false;
      $("publicEmpty").hidden = bookmarks.length > 0;
      $("publicFeedback").textContent = "Coleção carregada. " + $("publicCount").textContent + ".";
      $("publicFeedback").classList.add("sr-only");
    } catch (error) {
      $("publicFeedback").classList.remove("sr-only");
      if ([401, 403, 404].includes(error.status)) {
        showError("Esta coleção não está disponível publicamente. Ela pode ser privada ou ter sido removida.", false);
      } else if (error.status === 429) {
        showError("Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.", true);
      } else {
        showError(error.status >= 500 ? "O serviço está temporariamente indisponível. Tente novamente em instantes."
          : error.name === "AbortError" ? "A conexão demorou mais que o esperado. Tente novamente."
          : error instanceof TypeError ? "Não foi possível conectar ao servidor. Confira sua conexão e tente novamente."
          : error.message, true);
      }
    } finally {
      loading = false;
      $("retryPublicButton").disabled = false;
      $("publicBookmarkList").setAttribute("aria-busy", "false");
    }
  }

  $("retryPublicButton").addEventListener("click", () => void loadCollection());
  void loadCollection();
})();
