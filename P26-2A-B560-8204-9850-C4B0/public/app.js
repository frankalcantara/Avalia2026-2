/**
 * Caderno de Receitas — Projeto #28
 * Chave Única: P26-2A-B560-8204-9850-C4B0
 * Autor: Leonardo Mulhenhoff Borim
 *
 * Aplicação 100% Vanilla JS (ES Modules), sem frameworks.
 * Todas as rotas consumidas vêm das Cloudflare Pages Functions em `/api`
 * já implementadas no projeto — nenhum campo é inventado no cliente.
 *
 * Princípios de implementação:
 *  * NUNCA usar `innerHTML` com dados do usuário: apenas `createElement`,
 *    `textContent` e `replaceChildren`.
 *  * Debounce de 350 ms nos campos de texto para poupar a cota do plano
 *    gratuito da Cloudflare; filtros de `select` aplicam na hora.
 *  * `AbortController` cancela buscas antigas (evita corrida de respostas).
 *  * Escalonador de porções recalcula o DOM em tempo real, sem `fetch`.
 *
 * @module public/app
 */

import { escalarQuantidade, formatarQuantidade, fatorEscala } from "./receitas-math.js";

/* ------------------------------------------------------------------ *
 * Constantes
 * ------------------------------------------------------------------ */

/** Base da API serverless (mesma origem — cookie de sessão é enviado). */
const API_BASE = "/api";

/** Chave Única do projeto (também exibida no rodapé). */
const CHAVE_PROJETO = "P26-2A-B560-8204-9850-C4B0";

/** Atraso do debounce aplicado aos campos de texto (ms). */
const DEBOUNCE_MS = 350;

/** Tamanho da página de listagem (limite máximo do servidor é 50). */
const PAGINA_TAMANHO = 12;

/** Máximo de avisos simultâneos na região de toasts. */
const MAX_AVISOS = 3;

/** Valor sentinela do `<select>` de unidade para texto livre. */
const UNIDADE_OUTRO = "__outro";

/** Unidades de medida oferecidas no formulário (contrato: 1 a 24 chars). */
const UNIDADES = [
  "g",
  "kg",
  "ml",
  "l",
  "xícara",
  "colher de sopa",
  "colher de chá",
  "unidade",
  "pitada",
  "dente",
  "fatia",
  "cm",
];

/** Multiplicadores rápidos do escalonador. */
const FATORES_PRESET = [0.5, 1, 2, 3];

/** Limites espelhados de `functions/api/_lib/validate.js` (servidor é a verdade). */
const LIMITES = Object.freeze({
  titleMin: 3,
  titleMax: 120,
  descriptionMin: 10,
  descriptionMax: 600,
  prepMinutesMin: 1,
  prepMinutesMax: 1440,
  baseServingsMin: 1,
  baseServingsMax: 100,
  ingredientsMin: 1,
  ingredientsMax: 40,
  ingredientNameMin: 1,
  ingredientNameMax: 80,
  ingredientUnitMin: 1,
  ingredientUnitMax: 24,
  quantityMin: 0,
  quantityMax: 100000,
  stepsMin: 1,
  stepsMax: 30,
  stepMin: 3,
  stepMax: 500,
});

/** Dicas contextuais por aba. */
const DICAS_ABA = Object.freeze({
  all: "Explorando todas as receitas publicadas pela comunidade.",
  mine: "Somente as receitas publicadas por você.",
  favorites: "As receitas que você salvou no seu livro pessoal.",
});

/** Traduções amigáveis para os motivos de erro do OAuth2. */
const ERROS_LOGIN = Object.freeze({
  access_denied: "Você cancelou a autorização no Discord.",
  missing_code: "O Discord não devolveu o código de autorização. Tente novamente.",
  invalid_state: "A sessão de login expirou. Inicie o login novamente.",
  token_exchange_failed: "Não foi possível validar o login com o Discord. Tente novamente.",
  user_fetch_failed: "Não foi possível ler seu perfil do Discord. Tente novamente.",
  user_invalid: "O perfil retornado pelo Discord é inválido.",
  db_error: "Falha ao salvar seu perfil no banco. Tente novamente em instantes.",
  oauth_error: "O login com Discord falhou. Tente novamente.",
});

/** Mapeamento campo-da-API → id do input no formulário. */
const MAPA_CAMPOS = Object.freeze({
  title: "fieldTitle",
  description: "fieldDescription",
  prepMinutes: "fieldPrep",
  baseServings: "fieldServings",
});

/* ------------------------------------------------------------------ *
 * Estado local (única fonte de verdade da interface)
 * ------------------------------------------------------------------ */

const state = {
  user: null,
  scope: "all",
  q: "",
  ingredient: "",
  maxTime: "",
  items: [],
  total: 0,
  loading: false,
  error: null,
  detalhe: null,
  detalheId: null,
};

/* ------------------------------------------------------------------ *
 * Referências de DOM
 * ------------------------------------------------------------------ */

const el = {
  profileArea: document.getElementById("profileArea"),
  tabs: Array.from(document.querySelectorAll('[role="tab"]')),
  tabsHint: document.getElementById("tabsHint"),
  panelList: document.getElementById("panelList"),
  searchForm: document.getElementById("searchForm"),
  filterQuery: document.getElementById("filterQuery"),
  filterIngredient: document.getElementById("filterIngredient"),
  filterMaxTime: document.getElementById("filterMaxTime"),
  clearFilters: document.getElementById("clearFilters"),
  resultsCount: document.getElementById("resultsCount"),
  loadingBadge: document.getElementById("loadingBadge"),
  authGate: document.getElementById("authGate"),
  skeletonGrid: document.getElementById("skeletonGrid"),
  recipesGrid: document.getElementById("recipesGrid"),
  emptyState: document.getElementById("emptyState"),
  errorState: document.getElementById("errorState"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  newRecipeBtn: document.getElementById("newRecipeBtn"),
  recipeDialog: document.getElementById("recipeDialog"),
  detailMeta: document.getElementById("detailMeta"),
  detailTitle: document.getElementById("detailTitle"),
  detailLoading: document.getElementById("detailLoading"),
  detailError: document.getElementById("detailError"),
  detailErrorText: document.getElementById("detailErrorText"),
  detailRetry: document.getElementById("detailRetry"),
  detailContent: document.getElementById("detailContent"),
  detailDescription: document.getElementById("detailDescription"),
  detailAuthor: document.getElementById("detailAuthor"),
  detailFavoriteBtn: document.getElementById("detailFavoriteBtn"),
  detailDeleteBtn: document.getElementById("detailDeleteBtn"),
  detailIngredients: document.getElementById("detailIngredients"),
  detailSteps: document.getElementById("detailSteps"),
  scalerSummary: document.getElementById("scalerSummary"),
  scalerDec: document.getElementById("scalerDec"),
  scalerInc: document.getElementById("scalerInc"),
  scalerInput: document.getElementById("scalerInput"),
  scalerPresets: document.getElementById("scalerPresets"),
  scalerFactor: document.getElementById("scalerFactor"),
  createDialog: document.getElementById("createDialog"),
  createForm: document.getElementById("createForm"),
  fieldTitle: document.getElementById("fieldTitle"),
  fieldDescription: document.getElementById("fieldDescription"),
  fieldPrep: document.getElementById("fieldPrep"),
  fieldServings: document.getElementById("fieldServings"),
  ingredientRows: document.getElementById("ingredientRows"),
  addIngredientBtn: document.getElementById("addIngredientBtn"),
  stepRows: document.getElementById("stepRows"),
  addStepBtn: document.getElementById("addStepBtn"),
  createFormStatus: document.getElementById("createFormStatus"),
  createSubmit: document.getElementById("createSubmit"),
  toastRegion: document.getElementById("toastRegion"),
  footerStatus: document.getElementById("footerStatus"),
};

/* ------------------------------------------------------------------ *
 * Utilitários de DOM (seguros por construção: nunca innerHTML)
 * ------------------------------------------------------------------ */

/**
 * Cria um elemento e opcionalmente define classe, texto, atributos e filhos.
 *
 * @param {string} tag Nome da tag.
 * @param {{ className?: string, texto?: string, atributos?: Record<string, string|number>, dataset?: Record<string, string|number>, filhos?: Node[] }} [opcoes]
 * @returns {HTMLElement}
 */
function criar(tag, opcoes = {}) {
  const node = document.createElement(tag);

  if (opcoes.className) node.className = opcoes.className;
  if (opcoes.texto !== undefined && opcoes.texto !== null) node.textContent = String(opcoes.texto);

  if (opcoes.atributos) {
    for (const [chave, valor] of Object.entries(opcoes.atributos)) {
      if (valor === null || valor === undefined) continue;
      node.setAttribute(chave, String(valor));
    }
  }

  if (opcoes.dataset) {
    for (const [chave, valor] of Object.entries(opcoes.dataset)) {
      node.dataset[chave] = String(valor);
    }
  }

  if (Array.isArray(opcoes.filhos)) {
    for (const filho of opcoes.filhos) {
      if (filho) node.appendChild(filho);
    }
  }

  return node;
}

/** Remove todos os filhos de um nó sem usar innerHTML. */
function limpar(node) {
  node.replaceChildren();
}

/** Aplica debounce com cancelamento explícito. */
function debounce(fn, atraso = DEBOUNCE_MS) {
  let timer = null;

  const agendada = (...args) => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = null;
      fn(...args);
    }, atraso);
  };

  agendada.cancelar = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };

  return agendada;
}

/**
 * Iniciais de um nome para o avatar de fallback.
 *
 * @param {string} nome Nome do usuário.
 * @returns {string} Uma ou duas letras maiúsculas.
 */
function iniciaisDe(nome) {
  const partes = String(nome || "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (partes.length === 0) return "?";
  return partes.map((parte) => parte[0].toUpperCase()).join("");
}

/**
 * Cria o avatar (imagem do Discord ou iniciais de fallback).
 *
 * @param {{ username?: string, avatar?: string }} autor Autor da receita.
 * @param {"sm"|"md"} [tamanho] Tamanho visual.
 * @returns {HTMLElement}
 */
function criarAvatar(autor, tamanho = "sm") {
  const caixa = criar("span", { className: `avatar avatar--${tamanho}`, atributos: { "aria-hidden": "true" } });
  const url = typeof autor?.avatar === "string" ? autor.avatar : "";

  if (url.startsWith("https://cdn.discordapp.com/")) {
    const imagem = criar("img", {
      atributos: {
        src: url,
        alt: "",
        width: tamanho === "md" ? 42 : 32,
        height: tamanho === "md" ? 42 : 32,
        loading: "lazy",
        decoding: "async",
        referrerpolicy: "no-referrer",
      },
    });
    imagem.addEventListener(
      "error",
      () => {
        caixa.replaceChildren(criar("span", { className: "avatar__initials", texto: iniciaisDe(autor?.username) }));
      },
      { once: true },
    );
    caixa.appendChild(imagem);
  } else {
    caixa.appendChild(criar("span", { className: "avatar__initials", texto: iniciaisDe(autor?.username) }));
  }

  return caixa;
}

/**
 * Formata a data do D1 (`YYYY-MM-DD HH:MM:SS`, UTC) para pt-BR.
 *
 * @param {string} valor Data bruta.
 * @returns {string} Data curta ou string vazia.
 */
function formatarData(valor) {
  if (typeof valor !== "string" || valor.trim() === "") return "";
  const iso = valor.includes("T") ? valor : `${valor.replace(" ", "T")}Z`;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(data);
}

/**
 * Rótulo textual de um multiplicador (½×, 1×, 2×…).
 *
 * @param {number} fator Multiplicador.
 * @returns {string} Rótulo curto.
 */
function rotuloFator(fator) {
  return fator === 0.5 ? "½" : formatarQuantidade(fator);
}

/* ------------------------------------------------------------------ *
 * Avisos (toasts)
 * ------------------------------------------------------------------ */

/**
 * Exibe um aviso acessível (região `aria-live`).
 *
 * @param {string} mensagem Texto do aviso.
 * @param {"info"|"sucesso"|"erro"} [tipo] Tom visual.
 */
function mostrarToast(mensagem, tipo = "info") {
  const aviso = criar("div", { className: `toast toast--${tipo}` });
  aviso.appendChild(criar("span", { className: "toast__text", texto: mensagem }));

  const fechar = criar("button", {
    className: "toast__close",
    texto: "×",
    atributos: { type: "button", "aria-label": "Fechar aviso" },
  });
  fechar.addEventListener("click", () => aviso.remove());
  aviso.appendChild(fechar);

  el.toastRegion.appendChild(aviso);

  while (el.toastRegion.children.length > MAX_AVISOS) {
    el.toastRegion.firstElementChild?.remove();
  }

  window.setTimeout(() => aviso.remove(), 7000);
}

/* ------------------------------------------------------------------ *
 * Cliente HTTP
 * ------------------------------------------------------------------ */

/**
 * Requisição JSON com cookie de sessão, cancelamento e erros tipados.
 *
 * @param {string} caminho Caminho relativo (`/api/...`).
 * @param {RequestInit & { body?: unknown }} [opcoes] Opções do fetch.
 * @returns {Promise<any>} Corpo JSON da resposta.
 */
async function requisicaoApi(caminho, opcoes = {}) {
  const config = {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    ...opcoes,
  };

  if (config.body !== undefined && config.body !== null && typeof config.body === "object") {
    config.headers = { ...(opcoes.headers || {}), "Content-Type": "application/json" };
    config.body = JSON.stringify(opcoes.body);
  }

  const resposta = await fetch(caminho, config);
  const tipo = resposta.headers.get("content-type") || "";
  const dados = tipo.includes("application/json") ? await resposta.json().catch(() => null) : null;

  if (!resposta.ok) {
    const erro = new Error(dados?.error?.message || `Falha na requisição (HTTP ${resposta.status}).`);
    erro.name = "ApiError";
    erro.status = resposta.status;
    erro.codigo = dados?.error?.code || "";
    erro.detalhes = dados?.error?.details ?? dados?.details ?? null;
    erro.retryAfter = Number(resposta.headers.get("Retry-After")) || 0;
    throw erro;
  }

  return dados;
}

/**
 * Converte um erro (HTTP ou de rede) em mensagem clara para o usuário.
 *
 * @param {any} erro Erro capturado.
 * @returns {string} Mensagem em português.
 */
function mensagemDeErro(erro) {
  if (!erro) return "Ocorreu um erro inesperado.";

  if (erro.name === "TypeError") {
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  }
  if (erro.status === 400) return erro.message || "Dados inválidos. Revise os campos.";
  if (erro.status === 401) return "Sua sessão expirou. Entre novamente com o Discord.";
  if (erro.status === 403) return "Você não tem permissão para esta ação.";
  if (erro.status === 404) return "Receita não encontrada — ela pode ter sido removida.";
  if (erro.status === 429) {
    const espera = erro.retryAfter > 0 ? erro.retryAfter : 30;
    return `Limite de requisições atingido. Aguarde ${espera} segundo(s) e tente novamente.`;
  }
  if (typeof erro.status === "number" && erro.status >= 500) {
    return "O servidor não conseguiu concluir a operação. Tente novamente em instantes.";
  }
  return erro.message || "Não foi possível concluir a operação.";
}

/* ------------------------------------------------------------------ *
 * Sessão e perfil Discord
 * ------------------------------------------------------------------ */

/** Lê `/api/auth/me` e atualiza o estado + cabeçalho. */
async function carregarSessao() {
  try {
    const dados = await requisicaoApi(`${API_BASE}/auth/me`);
    state.user = dados && dados.user ? dados.user : null;
  } catch {
    // Sem sessão (ou API offline) o app segue no modo somente leitura.
    state.user = null;
  }

  renderizarPerfil();
  sincronizarAcoesAutenticadas();
}

/** Renderiza a área de perfil do cabeçalho conforme o estado da sessão. */
function renderizarPerfil() {
  if (!el.profileArea) return;

  if (!state.user) {
    const entrar = criar("a", {
      className: "btn btn--discord btn--sm",
      texto: "Entrar com Discord",
      atributos: { href: `${API_BASE}/auth/discord` },
    });
    el.profileArea.replaceChildren(entrar);
    return;
  }

  const usuario = state.user;
  const caixa = criar("div", { className: "profile__user" });
  const meta = criar("div", { className: "profile__meta" });

  const nome = criar("span", { className: "profile__name", texto: usuario.username || "Usuário Discord" });
  nome.setAttribute("title", usuario.username || "Usuário Discord");

  const identificador = String(usuario.userId || "");
  const idCurto = identificador.length > 6 ? identificador.slice(-6) : identificador;
  const id = criar("span", { className: "profile__id", texto: idCurto ? `ID ${idCurto}` : "Discord" });
  id.setAttribute("title", "Identificador do Discord (final)");

  meta.append(nome, id);

  const sair = criar("button", {
    className: "btn btn--ghost profile__logout",
    texto: "Sair",
    atributos: { type: "button" },
  });
  sair.addEventListener("click", () => encerrarSessao(sair));

  caixa.append(criarAvatar(usuario, "md"), meta, sair);
  el.profileArea.replaceChildren(caixa);
}

/** Mostra/esconde ações que dependem de login. */
function sincronizarAcoesAutenticadas() {
  el.newRecipeBtn.hidden = !state.user;
}

/**
 * Encerra a sessão (POST /api/auth/logout) e recarrega a listagem.
 *
 * @param {HTMLButtonElement} botao Botão acionado (feedback de carregamento).
 */
async function encerrarSessao(botao) {
  botao.disabled = true;
  botao.textContent = "Saindo…";

  try {
    await requisicaoApi(`${API_BASE}/auth/logout`, { method: "POST" });
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    state.user = null;
    renderizarPerfil();
    sincronizarAcoesAutenticadas();
    if (state.scope !== "all") {
      ativarAba("all");
    } else {
      carregarReceitas();
    }
    mostrarToast("Sessão encerrada.", "sucesso");
  }
}

/**
 * Consome `?login=ok|error` devolvido pelo callback do OAuth2 e limpa a URL.
 */
function processarRetornoLogin() {
  const url = new URL(window.location.href);
  const login = url.searchParams.get("login");
  if (!login) return;

  if (login === "ok") {
    mostrarToast("Login com Discord concluído. Bom apetite!", "sucesso");
  } else if (login === "error") {
    const motivo = url.searchParams.get("reason") || "";
    mostrarToast(ERROS_LOGIN[motivo] || "Não foi possível concluir o login com Discord.", "erro");
  }

  url.searchParams.delete("login");
  url.searchParams.delete("reason");
  const destino = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", destino);
}

/* ------------------------------------------------------------------ *
 * Abas
 * ------------------------------------------------------------------ */

/**
 * Ativa uma aba de escopo e recarrega a listagem.
 *
 * @param {"all"|"mine"|"favorites"} escopo Escopo desejado.
 */
function ativarAba(escopo) {
  state.scope = escopo;
  state.items = [];
  state.total = 0;
  state.error = null;

  el.tabs.forEach((aba) => {
    const ativa = aba.dataset.scope === escopo;
    aba.setAttribute("aria-selected", ativa ? "true" : "false");
    aba.tabIndex = ativa ? 0 : -1;
    if (ativa) el.panelList.setAttribute("aria-labelledby", aba.id);
  });

  el.tabsHint.textContent = DICAS_ABA[escopo] || DICAS_ABA.all;
  carregarReceitas();
}

/** Navegação por teclado das abas (padrão WAI-ARIA Tabs). */
function configurarAbas() {
  el.tabs.forEach((aba, indice) => {
    aba.addEventListener("click", () => ativarAba(aba.dataset.scope));

    aba.addEventListener("keydown", (evento) => {
      let destino = null;

      if (evento.key === "ArrowRight") destino = (indice + 1) % el.tabs.length;
      if (evento.key === "ArrowLeft") destino = (indice - 1 + el.tabs.length) % el.tabs.length;
      if (evento.key === "Home") destino = 0;
      if (evento.key === "End") destino = el.tabs.length - 1;
      if (destino === null) return;

      evento.preventDefault();
      const proxima = el.tabs[destino];
      proxima.focus();
      ativarAba(proxima.dataset.scope);
    });
  });
}

/* ------------------------------------------------------------------ *
 * Filtros (debounce de 350 ms)
 * ------------------------------------------------------------------ */

/** Lê os três filtros para o estado local. */
function lerFiltros() {
  state.q = el.filterQuery.value.trim();
  state.ingredient = el.filterIngredient.value.trim();
  state.maxTime = el.filterMaxTime.value;
}

/** Aplica os filtros imediatamente (sem debounce). */
function aplicarFiltros() {
  lerFiltros();
  carregarReceitas();
}

const aplicarFiltrosComDebounce = debounce(aplicarFiltros, DEBOUNCE_MS);

/** Liga os eventos da barra de busca. */
function configurarFiltros() {
  el.filterQuery.addEventListener("input", aplicarFiltrosComDebounce);
  el.filterIngredient.addEventListener("input", aplicarFiltrosComDebounce);

  el.filterMaxTime.addEventListener("change", () => {
    aplicarFiltrosComDebounce.cancelar();
    aplicarFiltros();
  });

  el.searchForm.addEventListener("submit", (evento) => {
    evento.preventDefault();
    aplicarFiltrosComDebounce.cancelar();
    aplicarFiltros();
  });

  el.clearFilters.addEventListener("click", () => {
    aplicarFiltrosComDebounce.cancelar();
    el.searchForm.reset();
    lerFiltros();
    el.filterQuery.focus();
    carregarReceitas();
  });
}

/* ------------------------------------------------------------------ *
 * Listagem de receitas
 * ------------------------------------------------------------------ */

/** Escopo atual exige sessão? */
function precisaLogin() {
  return (state.scope === "mine" || state.scope === "favorites") && !state.user;
}

/**
 * Monta a URL de listagem respeitando o contrato real da API.
 *
 * A aba "Meu livro" usa `/api/favorites` (rota dedicada) quando não há filtros
 * de texto/tempo; com filtros ativos usamos `/api/recipes?scope=favorites`,
 * que aceita `q`, `ingredient` e `maxTime` e devolve o mesmo shape.
 *
 * @param {boolean} anexar Se é uma página adicional.
 * @returns {string} Caminho com query string.
 */
function construirUrlListagem(anexar) {
  const params = new URLSearchParams();
  params.set("limit", String(PAGINA_TAMANHO));
  params.set("offset", String(anexar ? state.items.length : 0));

  const temFiltros = Boolean(state.q || state.ingredient || state.maxTime);

  if (state.scope === "favorites" && !temFiltros) {
    return `${API_BASE}/favorites?${params.toString()}`;
  }

  params.set("scope", state.scope);
  if (state.q) params.set("q", state.q);
  if (state.ingredient) params.set("ingredient", state.ingredient);
  if (state.maxTime) params.set("maxTime", state.maxTime);

  return `${API_BASE}/recipes?${params.toString()}`;
}

/** Abortador da busca em andamento (evita respostas fora de ordem). */
let abortadorAtual = null;

/**
 * Carrega receitas do servidor.
 *
 * @param {{ anexar?: boolean }} [opcoes] `anexar` concatena a próxima página.
 */
async function carregarReceitas({ anexar = false } = {}) {
  if (precisaLogin()) {
    if (abortadorAtual) {
      abortadorAtual.abort();
      abortadorAtual = null;
    }
    state.loading = false;
    definirCarregando(false);
    renderizarTudo();
    return;
  }

  if (abortadorAtual) abortadorAtual.abort();
  const controlador = new AbortController();
  abortadorAtual = controlador;

  state.loading = true;
  state.error = null;
  if (!anexar) state.items = [];
  definirCarregando(true);
  renderizarTudo();

  try {
    const dados = await requisicaoApi(construirUrlListagem(anexar), { signal: controlador.signal });
    const itens = Array.isArray(dados?.items) ? dados.items : [];
    state.total = Number(dados?.total) || 0;
    state.items = anexar ? [...state.items, ...itens] : itens;
  } catch (erro) {
    if (erro?.name === "AbortError" || controlador.signal.aborted) return;
    state.error = erro;
    if (erro?.status === 401) {
      state.user = null;
      renderizarPerfil();
      sincronizarAcoesAutenticadas();
    }
  } finally {
    if (abortadorAtual === controlador) {
      abortadorAtual = null;
      definirCarregando(false);
      renderizarTudo();
    }
  }
}

/**
 * Atualiza indicadores de carregamento (aria-busy + badge).
 *
 * @param {boolean} ativo Se há requisição em andamento.
 */
function definirCarregando(ativo) {
  state.loading = ativo;
  el.recipesGrid.setAttribute("aria-busy", ativo ? "true" : "false");
  el.loadingBadge.hidden = !ativo;
  el.loadMoreBtn.disabled = ativo;
}

/** Atualiza o contador de resultados (aria-live). */
function atualizarContador() {
  if (state.loading && state.items.length === 0) {
    el.resultsCount.textContent = "Buscando receitas…";
    return;
  }
  if (state.error) {
    el.resultsCount.textContent = "Não foi possível listar as receitas.";
    return;
  }
  if (state.total === 0) {
    el.resultsCount.textContent = "Nenhuma receita encontrada.";
    return;
  }

  const rotulo = state.total === 1 ? "1 receita encontrada" : `${state.total} receitas encontradas`;
  el.resultsCount.textContent =
    state.items.length < state.total ? `${rotulo} · exibindo ${state.items.length}` : rotulo;
}

/** Renderiza a grade de cards a partir de `state.items`. */
function renderizarLista() {
  const fragmento = document.createDocumentFragment();
  state.items.forEach((receita) => fragmento.appendChild(criarCardReceita(receita)));
  el.recipesGrid.replaceChildren(fragmento);
}

/**
 * Cria um card de receita (todo o texto via `textContent`).
 *
 * @param {any} receita DTO de `/api/recipes` ou `/api/favorites`.
 * @returns {HTMLElement}
 */
function criarCardReceita(receita) {
  const artigo = criar("article", { className: "recipe-card", dataset: { recipeId: receita.id } });

  const topo = criar("div", { className: "recipe-card__head" });
  topo.append(
    criar("h3", { className: "recipe-card__title", texto: receita.title }),
    criarBotaoFavorito(receita),
  );

  const badges = criar("ul", { className: "badges", atributos: { "aria-label": "Detalhes da receita" } });
  badges.append(
    criarBadge("⏱", `${receita.prepMinutes} min`),
    criarBadge("🍽", `${receita.baseServings} ${receita.baseServings === 1 ? "porção" : "porções"}`),
    criarBadge(
      "🥕",
      `${receita.ingredientCount} ${receita.ingredientCount === 1 ? "ingrediente" : "ingredientes"}`,
    ),
  );

  const rodape = criar("div", { className: "recipe-card__foot" });
  const autor = criar("div", { className: "author" });
  autor.append(
    criarAvatar(receita.author, "sm"),
    criar("span", { className: "author__name", texto: receita.author?.username || "Usuário Discord" }),
  );

  const abrir = criar("button", {
    className: "btn btn--primary btn--sm",
    texto: "Abrir",
    atributos: { type: "button", "aria-label": `Abrir a receita ${receita.title}` },
  });
  abrir.addEventListener("click", () => abrirDetalhe(receita.id));
  rodape.append(autor, abrir);

  artigo.append(topo, criar("p", { className: "recipe-card__desc", texto: receita.description }), badges, rodape);
  return artigo;
}

/**
 * Cria um item de badge com ícone decorativo.
 *
 * @param {string} icone Emoji/ícone decorativo.
 * @param {string} texto Texto do badge.
 * @returns {HTMLElement}
 */
function criarBadge(icone, texto) {
  const item = criar("li", { className: "badge" });
  item.append(
    criar("span", { className: "badge__icon", texto: icone, atributos: { "aria-hidden": "true" } }),
    criar("span", { texto }),
  );
  return item;
}

/**
 * Cria o botão de favorito (★/☆) com estado acessível.
 *
 * @param {{ id: number, title: string, isFavorite: boolean }} receita Receita.
 * @returns {HTMLButtonElement}
 */
function criarBotaoFavorito(receita) {
  const botao = criar("button", {
    className: "fav-btn",
    texto: receita.isFavorite ? "★" : "☆",
    atributos: {
      type: "button",
      "aria-pressed": receita.isFavorite ? "true" : "false",
      "aria-label": `Favoritar ${receita.title}`,
      title: "Alternar favorito",
    },
    dataset: { favId: receita.id },
  });

  botao.addEventListener("click", () => alternarFavorito(receita.id, botao));
  return botao;
}

/**
 * Alterna o favorito com atualização otimista e rollback em caso de erro.
 *
 * @param {number} id Id da receita.
 * @param {HTMLButtonElement} botao Botão acionado.
 */
async function alternarFavorito(id, botao) {
  if (!state.user) {
    mostrarToast("Entre com Discord para favoritar receitas.", "info");
    return;
  }

  const item = state.items.find((receita) => receita.id === id);
  const estadoAnterior = botao.getAttribute("aria-pressed") === "true";

  aplicarEstadoFavorito(botao, !estadoAnterior);
  if (item) item.isFavorite = !estadoAnterior;

  botao.disabled = true;
  try {
    const dados = await requisicaoApi(`${API_BASE}/recipes/${id}/favorite`, { method: "POST" });
    const agora = Boolean(dados?.isFavorite);
    aplicarEstadoFavorito(botao, agora);
    if (item) item.isFavorite = agora;
    sincronizarFavoritoNaLista(id, agora);
    if (state.scope === "favorites" && !agora) carregarReceitas();
  } catch (erro) {
    aplicarEstadoFavorito(botao, estadoAnterior);
    if (item) item.isFavorite = estadoAnterior;
    mostrarToast(mensagemDeErro(erro), "erro");
    if (erro?.status === 401) {
      state.user = null;
      renderizarPerfil();
      sincronizarAcoesAutenticadas();
    }
  } finally {
    botao.disabled = false;
  }
}

/**
 * Reflete o estado de favorito no botão.
 *
 * @param {HTMLButtonElement} botao Botão alvo.
 * @param {boolean} ativo Estado desejado.
 */
function aplicarEstadoFavorito(botao, ativo) {
  botao.textContent = ativo ? "★" : "☆";
  botao.setAttribute("aria-pressed", ativo ? "true" : "false");
}

/**
 * Mantém o card da grade sincronizado com o detalhe.
 *
 * @param {number} id Id da receita.
 * @param {boolean} ativo Estado de favorito.
 */
function sincronizarFavoritoNaLista(id, ativo) {
  const item = state.items.find((receita) => receita.id === id);
  if (item) item.isFavorite = ativo;

  const card = el.recipesGrid.querySelector(`[data-recipe-id="${id}"]`);
  const botao = card ? card.querySelector(".fav-btn") : null;
  if (botao) aplicarEstadoFavorito(botao, ativo);
}

/** Estado vazio contextual por aba/filtros. */
function renderizarEstadoVazio() {
  const temFiltros = Boolean(state.q || state.ingredient || state.maxTime);
  const titulo = criar("h2", { className: "state__title" });
  const texto = criar("p", { className: "state__text" });
  const acoes = criar("div", { className: "state__actions" });

  if (temFiltros) {
    titulo.textContent = "Nada combina com esses filtros";
    texto.textContent = "Tente outro prato, outro ingrediente ou aumente o tempo máximo de preparo.";
    const limpar = criar("button", { className: "btn btn--primary", texto: "Limpar filtros", atributos: { type: "button" } });
    limpar.addEventListener("click", () => el.clearFilters.click());
    acoes.appendChild(limpar);
  } else if (state.scope === "mine") {
    titulo.textContent = "Você ainda não publicou receitas";
    texto.textContent = "Use o botão “Nova receita” para registrar seu primeiro prato no Cloudflare D1.";
    const criarReceita = criar("button", { className: "btn btn--primary", texto: "Nova receita", atributos: { type: "button" } });
    criarReceita.addEventListener("click", abrirNovaReceita);
    acoes.appendChild(criarReceita);
  } else if (state.scope === "favorites") {
    titulo.textContent = "Seu livro está vazio";
    texto.textContent = "Toque na estrela de qualquer receita para guardá-la aqui.";
    const explorar = criar("button", { className: "btn btn--primary", texto: "Explorar receitas", atributos: { type: "button" } });
    explorar.addEventListener("click", () => ativarAba("all"));
    acoes.appendChild(explorar);
  } else {
    titulo.textContent = "Nenhuma receita publicada ainda";
    texto.textContent = "Seja o primeiro a compartilhar um prato no caderno.";
    if (state.user) {
      const criarReceita = criar("button", { className: "btn btn--primary", texto: "Nova receita", atributos: { type: "button" } });
      criarReceita.addEventListener("click", abrirNovaReceita);
      acoes.appendChild(criarReceita);
    }
  }

  el.emptyState.replaceChildren(titulo, texto, acoes);
}

/** Estado de erro da listagem com botão "Tentar novamente". */
function renderizarEstadoErro() {
  const titulo = criar("h2", { className: "state__title", texto: "Não foi possível carregar as receitas" });
  const texto = criar("p", { className: "state__text", texto: mensagemDeErro(state.error) });
  const tentar = criar("button", { className: "btn btn--primary", texto: "Tentar novamente", atributos: { type: "button" } });
  tentar.addEventListener("click", () => carregarReceitas());
  el.errorState.replaceChildren(titulo, texto, tentar);
}

/** Estado que pede login nas abas "Minhas receitas" e "Meu livro". */
function renderizarPortao() {
  const ehLivro = state.scope === "favorites";

  el.authGate.hidden = false;
  el.searchForm.hidden = true;
  el.recipesGrid.hidden = true;
  el.skeletonGrid.hidden = true;
  el.emptyState.hidden = true;
  el.errorState.hidden = true;
  el.loadMoreBtn.hidden = true;
  el.resultsCount.textContent = "Entre com Discord para continuar.";

  el.authGate.replaceChildren(
    criar("h2", {
      className: "state__title",
      texto: ehLivro ? "Entre para abrir o seu livro" : "Entre para ver as suas receitas",
    }),
    criar("p", {
      className: "state__text",
      texto: ehLivro
        ? "Seu livro de receitas favoritas fica atrelado à sua conta do Discord."
        : "As receitas publicadas por você ficam salvas no Cloudflare D1 e aparecem aqui.",
    }),
    criar("a", {
      className: "btn btn--discord",
      texto: "Entrar com Discord",
      atributos: { href: `${API_BASE}/auth/discord` },
    }),
  );
}

/** Orquestra todos os estados visuais da listagem. */
function renderizarTudo() {
  if (precisaLogin()) {
    renderizarPortao();
    return;
  }

  el.authGate.hidden = true;
  el.searchForm.hidden = false;
  el.recipesGrid.hidden = false;

  el.skeletonGrid.hidden = !(state.loading && state.items.length === 0);

  renderizarLista();
  atualizarContador();

  const temErro = Boolean(state.error);
  el.errorState.hidden = !temErro;
  if (temErro) renderizarEstadoErro();

  const listaVazia = !state.loading && !temErro && state.items.length === 0;
  el.emptyState.hidden = !listaVazia;
  if (listaVazia) renderizarEstadoVazio();

  el.loadMoreBtn.hidden = temErro || !(state.items.length > 0 && state.items.length < state.total);
}

/** Preenche a grade fantasma de carregamento (skeleton). */
function prepararEsqueletos() {
  const fragmento = document.createDocumentFragment();
  for (let indice = 0; indice < 6; indice += 1) {
    const card = criar("div", { className: "skeleton-card" });
    card.append(
      criar("div", { className: "skeleton skeleton--title" }),
      criar("div", { className: "skeleton skeleton--line" }),
      criar("div", { className: "skeleton skeleton--line skeleton--short" }),
      criar("div", { className: "skeleton skeleton--badges" }),
    );
    fragmento.appendChild(card);
  }
  el.skeletonGrid.replaceChildren(fragmento);
}

/* ------------------------------------------------------------------ *
 * Detalhe da receita + escalonador de porções
 * ------------------------------------------------------------------ */

/**
 * Abre o diálogo de detalhe e carrega a receita completa.
 *
 * @param {number} id Id da receita.
 */
async function abrirDetalhe(id) {
  state.detalhe = null;
  state.detalheId = id;

  el.detailLoading.hidden = false;
  el.detailContent.hidden = true;
  el.detailError.hidden = true;
  el.detailTitle.textContent = "Carregando receita…";
  el.detailMeta.textContent = "Receita";

  if (!el.recipeDialog.open) el.recipeDialog.showModal();

  try {
    const dados = await requisicaoApi(`${API_BASE}/recipes/${id}`);
    if (!dados || !dados.recipe) throw new Error("Receita não encontrada.");
    renderizarDetalhe(dados.recipe);
  } catch (erro) {
    el.detailLoading.hidden = true;
    el.detailError.hidden = false;
    el.detailErrorText.textContent = mensagemDeErro(erro);
    el.detailTitle.textContent = "Não foi possível abrir a receita";
  }
}

/**
 * Preenche o diálogo com a receita e inicializa o escalonador.
 *
 * @param {any} receita DTO de `/api/recipes/:id`.
 */
function renderizarDetalhe(receita) {
  state.detalhe = receita;

  el.detailTitle.textContent = receita.title;
  el.detailDescription.textContent = receita.description;
  el.detailMeta.textContent = [
    `${receita.prepMinutes} min de preparo`,
    `base ${receita.baseServings} ${receita.baseServings === 1 ? "porção" : "porções"}`,
    `${receita.ingredients.length} ${receita.ingredients.length === 1 ? "ingrediente" : "ingredientes"}`,
    `${receita.steps.length} ${receita.steps.length === 1 ? "passo" : "passos"}`,
  ].join(" · ");

  const autor = criar("div", { className: "author" });
  autor.append(
    criarAvatar(receita.author, "md"),
    criar("span", { className: "author__name", texto: receita.author?.username || "Usuário Discord" }),
  );
  const data = formatarData(receita.createdAt);
  if (data) autor.appendChild(criar("span", { className: "author__date", texto: `· ${data}` }));
  el.detailAuthor.replaceChildren(autor);

  atualizarBotaoFavoritoDetalhe(receita.isFavorite);
  el.detailDeleteBtn.hidden = !receita.isOwner;

  const ingredientes = document.createDocumentFragment();
  receita.ingredients.forEach((ingrediente) => {
    const item = criar("li", { className: "ingredient" });
    const quantidade = criar("span", {
      className: "ingredient__qty",
      texto: formatarQuantidade(ingrediente.quantity),
    });
    // Valor BASE preservado em data-* : o recálculo nunca parte do valor exibido.
    quantidade.dataset.baseQuantity = String(ingrediente.quantity);

    const medida = criar("span", { className: "ingredient__amount" });
    medida.append(quantidade, document.createTextNode(" "), criar("span", { className: "ingredient__unit", texto: ingrediente.unit }));

    item.append(medida, criar("span", { className: "ingredient__name", texto: ingrediente.name }));
    ingredientes.appendChild(item);
  });
  el.detailIngredients.replaceChildren(ingredientes);

  const passos = document.createDocumentFragment();
  receita.steps.forEach((passo) => {
    passos.appendChild(criar("li", { texto: passo.instruction }));
  });
  el.detailSteps.replaceChildren(passos);

  construirPresets(receita.baseServings);
  el.scalerInput.value = String(receita.baseServings);
  el.scalerInput.min = "0.5";
  el.scalerInput.max = String(Math.max(200, receita.baseServings * 4));
  agendarEscalonamento();

  el.detailLoading.hidden = true;
  el.detailError.hidden = true;
  el.detailContent.hidden = false;
}

/**
 * Reflete o favorito no botão do diálogo de detalhe.
 *
 * @param {boolean} ativo Estado de favorito.
 */
function atualizarBotaoFavoritoDetalhe(ativo) {
  el.detailFavoriteBtn.textContent = ativo ? "★ Salvo no meu livro" : "☆ Favoritar";
  el.detailFavoriteBtn.setAttribute("aria-pressed", ativo ? "true" : "false");
}

/** Alterna o favorito a partir do diálogo de detalhe. */
async function alternarFavoritoDetalhe() {
  const receita = state.detalhe;
  if (!receita) return;

  if (!state.user) {
    mostrarToast("Entre com Discord para favoritar receitas.", "info");
    return;
  }

  const anterior = Boolean(receita.isFavorite);
  atualizarBotaoFavoritoDetalhe(!anterior);
  el.detailFavoriteBtn.disabled = true;

  try {
    const dados = await requisicaoApi(`${API_BASE}/recipes/${receita.id}/favorite`, { method: "POST" });
    const agora = Boolean(dados?.isFavorite);
    receita.isFavorite = agora;
    atualizarBotaoFavoritoDetalhe(agora);
    sincronizarFavoritoNaLista(receita.id, agora);
    if (state.scope === "favorites" && !agora) carregarReceitas();
  } catch (erro) {
    receita.isFavorite = anterior;
    atualizarBotaoFavoritoDetalhe(anterior);
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    el.detailFavoriteBtn.disabled = false;
  }
}

/**
 * Exclui a receita aberta (somente quando `isOwner`).
 * O servidor revalida a autoria — o cliente apenas solicita.
 */
async function excluirReceitaAtual() {
  const receita = state.detalhe;
  if (!receita) return;

  const confirmado = window.confirm(`Excluir a receita “${receita.title}”? Esta ação não pode ser desfeita.`);
  if (!confirmado) return;

  el.detailDeleteBtn.disabled = true;
  try {
    await requisicaoApi(`${API_BASE}/recipes/${receita.id}`, { method: "DELETE" });
    state.detalhe = null;
    fecharDialogo(el.recipeDialog);
    state.items = state.items.filter((item) => item.id !== receita.id);
    state.total = Math.max(0, state.total - 1);
    renderizarTudo();
    mostrarToast("Receita excluída do caderno.", "sucesso");
  } catch (erro) {
    mostrarToast(mensagemDeErro(erro), "erro");
  } finally {
    el.detailDeleteBtn.disabled = false;
  }
}

/** Constrói os presets ½× / 1× / 2× / 3× a partir do rendimento base. */
function construirPresets(rendimentoBase) {
  const fragmento = document.createDocumentFragment();

  FATORES_PRESET.forEach((fator) => {
    const alvo = Math.max(0.5, Math.round(rendimentoBase * fator * 100) / 100);
    const botao = criar("button", {
      className: "chip",
      texto: `${rotuloFator(fator)}×`,
      atributos: { type: "button", "aria-pressed": "false", "aria-label": `Ajustar para ${rotuloFator(fator)} vezes o rendimento` },
      dataset: { alvo, fator },
    });

    botao.addEventListener("click", () => {
      el.scalerInput.value = String(alvo);
      agendarEscalonamento();
    });

    fragmento.appendChild(botao);
  });

  el.scalerPresets.replaceChildren(fragmento);
}

/** Identificador do frame de animação pendente (coalescência de renders). */
let frameEscalonador = 0;

/** Agenda um recálculo no próximo frame (evita múltiplos re-renders). */
function agendarEscalonamento() {
  if (frameEscalonador) return;
  frameEscalonador = window.requestAnimationFrame(() => {
    frameEscalonador = 0;
    aplicarEscalonamento();
  });
}

/**
 * Recalcula TODAS as quantidades exibidas usando os valores base em `data-*`.
 * Nenhuma requisição é feita e nenhum valor base é sobrescrito.
 */
function aplicarEscalonamento() {
  const receita = state.detalhe;
  if (!receita) return;

  const rendimentoBase = Number(receita.baseServings) || 1;
  const rendimentoAlvo = Number(el.scalerInput.value);

  if (!Number.isFinite(rendimentoAlvo) || rendimentoAlvo <= 0) return;

  const quantidades = el.detailIngredients.querySelectorAll("[data-base-quantity]");
  quantidades.forEach((node) => {
    const base = Number(node.dataset.baseQuantity);
    node.textContent = formatarQuantidade(escalarQuantidade(base, rendimentoBase, rendimentoAlvo));
  });

  el.scalerSummary.textContent = `Porções: ${formatarQuantidade(rendimentoAlvo)} (base ${formatarQuantidade(rendimentoBase)})`;
  el.scalerFactor.textContent = `×${formatarQuantidade(fatorEscala(rendimentoBase, rendimentoAlvo))}`;

  const fatorAtual = fatorEscala(rendimentoBase, rendimentoAlvo);
  Array.from(el.scalerPresets.children).forEach((botao) => {
    const pressed = Math.abs(Number(botao.dataset.fator) - fatorAtual) < 0.001;
    botao.setAttribute("aria-pressed", pressed ? "true" : "false");
  });
}

/**
 * Normaliza o alvo digitado (0,5 passo, faixa 0,5..max) e atualiza a exibição.
 *
 * @returns {number} Alvo normalizado.
 */
function normalizarAlvo() {
  const base = Number(state.detalhe?.baseServings) || 1;
  const maximo = Math.max(200, base * 4);

  let valor = Number(el.scalerInput.value);
  if (!Number.isFinite(valor) || valor <= 0) valor = base;

  valor = Math.min(maximo, Math.max(0.5, Math.round(valor * 2) / 2));
  el.scalerInput.value = String(valor);
  return valor;
}

/** Liga os controles do escalonador (sem fetch, 100% local). */
function configurarEscalonador() {
  el.scalerInput.addEventListener("input", agendarEscalonamento);
  el.scalerInput.addEventListener("change", () => {
    normalizarAlvo();
    agendarEscalonamento();
  });

  el.scalerDec.addEventListener("click", () => {
    normalizarAlvo();
    const atual = Number(el.scalerInput.value);
    el.scalerInput.value = String(Math.max(0.5, atual - 1));
    agendarEscalonamento();
  });

  el.scalerInc.addEventListener("click", () => {
    normalizarAlvo();
    const atual = Number(el.scalerInput.value);
    el.scalerInput.value = String(Math.min(Number(el.scalerInput.max) || 200, atual + 1));
    agendarEscalonamento();
  });
}

/* ------------------------------------------------------------------ *
 * Formulário de criação
 * ------------------------------------------------------------------ */

/** Contador para gerar ids únicos nas linhas dinâmicas. */
let contadorLinhas = 0;

/** Adiciona uma linha de ingrediente ao formulário. */
function criarLinhaIngrediente() {
  contadorLinhas += 1;
  const baseId = `ing-${contadorLinhas}`;

  const linha = criar("div", { className: "row row--ingredient", dataset: { linha: baseId } });

  const rotuloNome = criar("label", { className: "sr-only", texto: "Nome do ingrediente", atributos: { for: `${baseId}-name` } });
  const campoNome = criar("input", {
    className: "row__input row__name",
    atributos: {
      id: `${baseId}-name`,
      type: "text",
      maxlength: LIMITES.ingredientNameMax,
      placeholder: "Ingrediente (ex.: farinha)",
      autocomplete: "off",
      "aria-describedby": `${baseId}-err`,
    },
  });
  campoNome.dataset.campo = "name";

  const rotuloQtd = criar("label", { className: "sr-only", texto: "Quantidade", atributos: { for: `${baseId}-qty` } });
  const campoQtd = criar("input", {
    className: "row__input row__qty",
    atributos: {
      id: `${baseId}-qty`,
      type: "number",
      step: "any",
      min: LIMITES.quantityMin,
      max: LIMITES.quantityMax,
      inputmode: "decimal",
      placeholder: "Qtd.",
      "aria-describedby": `${baseId}-err`,
    },
  });
  campoQtd.dataset.campo = "quantity";

  const rotuloUnidade = criar("label", { className: "sr-only", texto: "Unidade de medida", atributos: { for: `${baseId}-unit` } });
  const selectUnidade = criar("select", {
    className: "row__select",
    atributos: { id: `${baseId}-unit`, "aria-describedby": `${baseId}-err` },
  });
  selectUnidade.dataset.campo = "unit";
  UNIDADES.forEach((unidade) => {
    selectUnidade.appendChild(criar("option", { texto: unidade, atributos: { value: unidade } }));
  });
  selectUnidade.appendChild(criar("option", { texto: "Outro…", atributos: { value: UNIDADE_OUTRO } }));

  const campoUnidadeLivre = criar("input", {
    className: "row__input row__custom-unit",
    atributos: {
      type: "text",
      maxlength: LIMITES.ingredientUnitMax,
      placeholder: "Unidade personalizada",
      "aria-label": "Unidade personalizada",
      "aria-describedby": `${baseId}-err`,
    },
  });
  campoUnidadeLivre.dataset.campo = "unitCustom";
  campoUnidadeLivre.hidden = true;
  campoUnidadeLivre.tabIndex = -1;

  selectUnidade.addEventListener("change", () => {
    const outro = selectUnidade.value === UNIDADE_OUTRO;
    campoUnidadeLivre.hidden = !outro;
    campoUnidadeLivre.tabIndex = outro ? 0 : -1;
    if (outro) campoUnidadeLivre.focus();
    else campoUnidadeLivre.value = "";
  });

  const remover = criar("button", {
    className: "icon-btn icon-btn--sm",
    texto: "×",
    atributos: { type: "button", "aria-label": "Remover ingrediente" },
  });
  remover.addEventListener("click", () => {
    linha.remove();
    if (el.ingredientRows.children.length === 0) criarLinhaIngrediente();
  });

  const erro = criar("p", { className: "row-error", atributos: { id: `${baseId}-err`, role: "alert" } });
  erro.hidden = true;

  linha.append(rotuloNome, campoNome, rotuloQtd, campoQtd, rotuloUnidade, selectUnidade, campoUnidadeLivre, remover, erro);
  el.ingredientRows.appendChild(linha);
}

/** Adiciona uma linha de passo e renumera as existentes. */
function criarLinhaPasso() {
  contadorLinhas += 1;
  const baseId = `pas-${contadorLinhas}`;

  const item = criar("li", { className: "row row--step", dataset: { linha: baseId } });
  const ordinal = criar("span", { className: "row__ordinal", texto: "1", atributos: { "aria-hidden": "true" } });
  const rotulo = criar("label", { className: "sr-only", texto: "Passo 1", atributos: { for: `${baseId}-text` } });
  const campo = criar("textarea", {
    className: "row__textarea",
    atributos: {
      id: `${baseId}-text`,
      rows: 2,
      maxlength: LIMITES.stepMax,
      placeholder: "Descreva o passo…",
      "aria-describedby": `${baseId}-err`,
    },
  });
  campo.dataset.campo = "instruction";

  const remover = criar("button", {
    className: "icon-btn icon-btn--sm",
    texto: "×",
    atributos: { type: "button", "aria-label": "Remover passo" },
  });
  remover.addEventListener("click", () => {
    item.remove();
    if (el.stepRows.children.length === 0) criarLinhaPasso();
    renumerarPassos();
  });

  const erro = criar("p", { className: "row-error", atributos: { id: `${baseId}-err`, role: "alert" } });
  erro.hidden = true;

  item.append(ordinal, rotulo, campo, remover, erro);
  el.stepRows.appendChild(item);
  renumerarPassos();
}

/** Recalcula a numeração visível dos passos. */
function renumerarPassos() {
  Array.from(el.stepRows.children).forEach((item, indice) => {
    const numero = indice + 1;
    const ordinal = item.querySelector(".row__ordinal");
    const rotulo = item.querySelector("label.sr-only");
    if (ordinal) ordinal.textContent = String(numero);
    if (rotulo) rotulo.textContent = `Passo ${numero}`;
  });
}

/** Exibe erro em uma linha dinâmica (ingrediente/passo). */
function definirErroLinha(linha, mensagem) {
  const destino = linha.querySelector(".row-error");
  if (!destino) return;
  destino.textContent = mensagem;
  destino.hidden = false;
}

/** Exibe erro de campo estático (`data-error-for`). */
function definirMensagemErro(chave, mensagem) {
  const destino = el.createForm.querySelector(`[data-error-for="${chave}"]`);
  if (!destino) return;
  destino.textContent = mensagem;
  destino.hidden = false;
}

/** Limpa todas as mensagens e marcações de erro do formulário. */
function limparErrosFormulario() {
  el.createForm.querySelectorAll("[data-error-for]").forEach((node) => {
    node.textContent = "";
    node.hidden = true;
  });
  el.createForm.querySelectorAll(".row-error").forEach((node) => {
    node.textContent = "";
    node.hidden = true;
  });
  el.createForm.querySelectorAll('[aria-invalid="true"]').forEach((node) => node.removeAttribute("aria-invalid"));
  el.createFormStatus.textContent = "";
}

/** Marca um campo estático como inválido. */
function marcarInvalido(idCampo) {
  const campo = document.getElementById(idCampo);
  if (campo) campo.setAttribute("aria-invalid", "true");
}

/**
 * Coleta e valida os ingredientes do formulário.
 *
 * @returns {{ ingredientes: Array<{ name: string, quantity: number, unit: string }>, valido: boolean }}
 */
function coletarIngredientes() {
  const linhas = Array.from(el.ingredientRows.querySelectorAll(".row--ingredient"));
  const ingredientes = [];
  let valido = true;

  if (linhas.length < LIMITES.ingredientsMin) {
    definirMensagemErro("ingredients", "Adicione pelo menos 1 ingrediente.");
    return { ingredientes, valido: false };
  }
  if (linhas.length > LIMITES.ingredientsMax) {
    definirMensagemErro("ingredients", `Use no máximo ${LIMITES.ingredientsMax} ingredientes.`);
    return { ingredientes, valido: false };
  }

  linhas.forEach((linha, indice) => {
    const campoNome = linha.querySelector('[data-campo="name"]');
    const campoQtd = linha.querySelector('[data-campo="quantity"]');
    const campoUnidade = linha.querySelector('[data-campo="unit"]');
    const campoUnidadeLivre = linha.querySelector('[data-campo="unitCustom"]');
    const problemas = [];

    const nome = campoNome.value.replace(/\s+/g, " ").trim();
    if (nome.length < LIMITES.ingredientNameMin || nome.length > LIMITES.ingredientNameMax) {
      problemas.push(`informe o nome (${LIMITES.ingredientNameMin} a ${LIMITES.ingredientNameMax} caracteres)`);
      campoNome.setAttribute("aria-invalid", "true");
    }

    const textoQtd = campoQtd.value.trim().replace(",", ".");
    const quantidade = Number(textoQtd);
    if (
      textoQtd === "" ||
      !Number.isFinite(quantidade) ||
      quantidade < LIMITES.quantityMin ||
      quantidade > LIMITES.quantityMax
    ) {
      problemas.push("quantidade entre 0 e 100000");
      campoQtd.setAttribute("aria-invalid", "true");
    }

    const usaOutro = campoUnidade.value === UNIDADE_OUTRO;
    const unidade = (usaOutro ? campoUnidadeLivre.value : campoUnidade.value).trim();
    if (unidade.length < LIMITES.ingredientUnitMin || unidade.length > LIMITES.ingredientUnitMax) {
      problemas.push(`unidade entre ${LIMITES.ingredientUnitMin} e ${LIMITES.ingredientUnitMax} caracteres`);
      (usaOutro ? campoUnidadeLivre : campoUnidade).setAttribute("aria-invalid", "true");
    }

    if (problemas.length > 0) {
      valido = false;
      definirErroLinha(linha, `Ingrediente ${indice + 1}: ${problemas.join("; ")}.`);
      return;
    }

    ingredientes.push({
      name: nome,
      quantity: Math.round(quantidade * 1000) / 1000,
      unit: unidade,
    });
  });

  return { ingredientes, valido };
}

/**
 * Coleta e valida os passos do formulário.
 *
 * @returns {{ passos: string[], valido: boolean }}
 */
function coletarPassos() {
  const linhas = Array.from(el.stepRows.querySelectorAll(".row--step"));
  const passos = [];
  let valido = true;

  if (linhas.length < LIMITES.stepsMin) {
    definirMensagemErro("steps", "Adicione pelo menos 1 passo.");
    return { passos, valido: false };
  }
  if (linhas.length > LIMITES.stepsMax) {
    definirMensagemErro("steps", `Use no máximo ${LIMITES.stepsMax} passos.`);
    return { passos, valido: false };
  }

  linhas.forEach((linha, indice) => {
    const campo = linha.querySelector('[data-campo="instruction"]');
    const texto = campo.value.replace(/\s+/g, " ").trim();

    if (texto.length < LIMITES.stepMin || texto.length > LIMITES.stepMax) {
      valido = false;
      campo.setAttribute("aria-invalid", "true");
      definirErroLinha(linha, `Passo ${indice + 1}: descreva entre ${LIMITES.stepMin} e ${LIMITES.stepMax} caracteres.`);
      return;
    }

    passos.push(texto);
  });

  return { passos, valido };
}

/**
 * Valida o formulário inteiro no cliente (espelho do servidor).
 *
 * @returns {null | { title: string, description: string, prepMinutes: number, baseServings: number, ingredients: any[], steps: string[] }}
 */
function validarFormulario() {
  let valido = true;

  const titulo = el.fieldTitle.value.replace(/\s+/g, " ").trim();
  if (titulo.length < LIMITES.titleMin || titulo.length > LIMITES.titleMax) {
    definirMensagemErro("fieldTitle", `Informe um título entre ${LIMITES.titleMin} e ${LIMITES.titleMax} caracteres.`);
    marcarInvalido("fieldTitle");
    valido = false;
  }

  const descricao = el.fieldDescription.value.replace(/\s+/g, " ").trim();
  if (descricao.length < LIMITES.descriptionMin || descricao.length > LIMITES.descriptionMax) {
    definirMensagemErro(
      "fieldDescription",
      `Descreva a receita entre ${LIMITES.descriptionMin} e ${LIMITES.descriptionMax} caracteres.`,
    );
    marcarInvalido("fieldDescription");
    valido = false;
  }

  const textoPrep = el.fieldPrep.value.trim();
  const prep = Number(textoPrep);
  if (textoPrep === "" || !Number.isInteger(prep) || prep < LIMITES.prepMinutesMin || prep > LIMITES.prepMinutesMax) {
    definirMensagemErro("fieldPrep", `Use minutos inteiros entre ${LIMITES.prepMinutesMin} e ${LIMITES.prepMinutesMax}.`);
    marcarInvalido("fieldPrep");
    valido = false;
  }

  const textoPorcoes = el.fieldServings.value.trim();
  const porcoes = Number(textoPorcoes);
  if (
    textoPorcoes === "" ||
    !Number.isInteger(porcoes) ||
    porcoes < LIMITES.baseServingsMin ||
    porcoes > LIMITES.baseServingsMax
  ) {
    definirMensagemErro(
      "fieldServings",
      `Informe porções inteiras entre ${LIMITES.baseServingsMin} e ${LIMITES.baseServingsMax}.`,
    );
    marcarInvalido("fieldServings");
    valido = false;
  }

  const { ingredientes, valido: ingredientesOk } = coletarIngredientes();
  const { passos, valido: passosOk } = coletarPassos();

  if (!ingredientesOk || !passosOk) valido = false;
  if (!valido) return null;

  return {
    title: titulo,
    description: descricao,
    prepMinutes: prep,
    baseServings: porcoes,
    ingredients: ingredientes,
    steps: passos,
  };
}

/**
 * Reproduz no formulário os erros de validação devolvidos pelo servidor.
 *
 * @param {Array<{ field: string, message: string }>} detalhes Lista de `error.details`.
 */
function aplicarErrosServidor(detalhes) {
  if (!Array.isArray(detalhes) || detalhes.length === 0) {
    el.createFormStatus.textContent = "Não foi possível publicar a receita. Revise os campos.";
    return;
  }

  let primeiroAlvo = null;

  detalhes.slice(0, 30).forEach((item) => {
    const campo = typeof item?.field === "string" ? item.field : "";
    const mensagem = typeof item?.message === "string" ? item.message : "Valor inválido.";

    if (!campo) {
      el.createFormStatus.textContent = mensagem;
      return;
    }
    if (campo === "body") {
      el.createFormStatus.textContent = mensagem;
      return;
    }
    if (campo === "ingredients" || campo === "steps") {
      definirMensagemErro(campo, mensagem);
      return;
    }

    const correspondencia = campo.match(/^(ingredients|steps)\[(\d+)\](?:\.(\w+))?$/);
    if (correspondencia) {
      const grupo = correspondencia[1];
      const indice = Number(correspondencia[2]);
      const subcampo = correspondencia[3];

      if (grupo === "ingredients") {
        const linha = el.ingredientRows.querySelectorAll(".row--ingredient")[indice];
        if (linha) {
          definirErroLinha(linha, mensagem);
          if (subcampo) {
            const alvo = linha.querySelector(`[data-campo="${subcampo}"]`);
            if (alvo) alvo.setAttribute("aria-invalid", "true");
          }
          if (!primeiroAlvo) primeiroAlvo = linha;
        }
      } else {
        const linha = el.stepRows.querySelectorAll(".row--step")[indice];
        if (linha) {
          definirErroLinha(linha, mensagem);
          const alvo = linha.querySelector('[data-campo="instruction"]');
          if (alvo) alvo.setAttribute("aria-invalid", "true");
          if (!primeiroAlvo) primeiroAlvo = linha;
        }
      }
      return;
    }

    const idCampo = MAPA_CAMPOS[campo];
    if (idCampo) {
      definirMensagemErro(idCampo, mensagem);
      const entrada = document.getElementById(idCampo);
      if (entrada) {
        entrada.setAttribute("aria-invalid", "true");
        if (!primeiroAlvo) primeiroAlvo = entrada;
      }
    } else {
      el.createFormStatus.textContent = mensagem;
    }
  });

  if (primeiroAlvo && typeof primeiroAlvo.focus === "function") primeiroAlvo.focus();
}

/** Prepara o formulário de criação (linhas iniciais + eventos). */
function prepararFormulario() {
  criarLinhaIngrediente();
  criarLinhaPasso();

  el.addIngredientBtn.addEventListener("click", () => {
    if (el.ingredientRows.children.length >= LIMITES.ingredientsMax) {
      mostrarToast(`Limite de ${LIMITES.ingredientsMax} ingredientes por receita.`, "info");
      return;
    }
    criarLinhaIngrediente();
    const linhas = el.ingredientRows.querySelectorAll(".row--ingredient");
    const ultima = linhas[linhas.length - 1];
    ultima?.querySelector('[data-campo="name"]')?.focus();
  });

  el.addStepBtn.addEventListener("click", () => {
    if (el.stepRows.children.length >= LIMITES.stepsMax) {
      mostrarToast(`Limite de ${LIMITES.stepsMax} passos por receita.`, "info");
      return;
    }
    criarLinhaPasso();
    const linhas = el.stepRows.querySelectorAll(".row--step");
    const ultima = linhas[linhas.length - 1];
    ultima?.querySelector('[data-campo="instruction"]')?.focus();
  });

  el.createForm.addEventListener("submit", enviarReceita);
}

/** Abre o diálogo de criação (exige sessão). */
function abrirNovaReceita() {
  if (!state.user) {
    mostrarToast("Entre com Discord para publicar uma receita.", "info");
    return;
  }

  limparErrosFormulario();
  if (el.ingredientRows.children.length === 0) criarLinhaIngrediente();
  if (el.stepRows.children.length === 0) criarLinhaPasso();

  if (!el.createDialog.open) el.createDialog.showModal();
  el.fieldTitle.focus();
}

/** Reseta o formulário após uma publicação bem-sucedida. */
function resetarFormulario() {
  el.createForm.reset();
  el.ingredientRows.replaceChildren();
  el.stepRows.replaceChildren();
  criarLinhaIngrediente();
  criarLinhaPasso();
  limparErrosFormulario();
}

/**
 * Envia a receita para `POST /api/recipes`.
 *
 * @param {SubmitEvent} evento Evento de submit.
 */
async function enviarReceita(evento) {
  evento.preventDefault();

  if (!state.user) {
    mostrarToast("Sua sessão expirou. Entre novamente com o Discord.", "erro");
    return;
  }

  limparErrosFormulario();
  const payload = validarFormulario();

  if (!payload) {
    el.createFormStatus.textContent = "Revise os campos destacados antes de publicar.";
    const primeiroInvalido = el.createForm.querySelector('[aria-invalid="true"]');
    if (primeiroInvalido) primeiroInvalido.focus();
    return;
  }

  el.createSubmit.disabled = true;
  el.createSubmit.textContent = "Publicando…";

  try {
    await requisicaoApi(`${API_BASE}/recipes`, { method: "POST", body: payload });
    fecharDialogo(el.createDialog);
    resetarFormulario();
    mostrarToast("Receita publicada no caderno!", "sucesso");
    if (state.scope === "all") {
      carregarReceitas();
    } else {
      ativarAba("all");
    }
  } catch (erro) {
    if (erro?.status === 400 && Array.isArray(erro.detalhes)) {
      aplicarErrosServidor(erro.detalhes);
      el.createFormStatus.textContent = "O servidor rejeitou alguns campos. Confira as mensagens.";
      mostrarToast("Validação do servidor: revise os campos.", "erro");
    } else {
      el.createFormStatus.textContent = mensagemDeErro(erro);
      mostrarToast(mensagemDeErro(erro), "erro");
    }

    if (erro?.status === 401) {
      state.user = null;
      renderizarPerfil();
      sincronizarAcoesAutenticadas();
    }
  } finally {
    el.createSubmit.disabled = false;
    el.createSubmit.textContent = "Publicar receita";
  }
}

/* ------------------------------------------------------------------ *
 * Diálogos (fechamento)
 * ------------------------------------------------------------------ */

/**
 * Fecha um `<dialog>` de forma segura.
 *
 * @param {HTMLDialogElement} dialogo Diálogo alvo.
 */
function fecharDialogo(dialogo) {
  if (dialogo && dialogo.open) dialogo.close();
}

/** Liga o fechamento por botão e por clique no backdrop (ESC é nativo). */
function configurarDialogos() {
  [el.recipeDialog, el.createDialog].forEach((dialogo) => {
    dialogo.addEventListener("click", (evento) => {
      if (evento.target === dialogo) dialogo.close();
    });

    dialogo.querySelectorAll("[data-close-dialog]").forEach((botao) => {
      botao.addEventListener("click", () => dialogo.close());
    });
  });

  el.recipeDialog.addEventListener("close", () => {
    state.detalhe = null;
  });

  el.detailRetry.addEventListener("click", () => {
    if (state.detalheId) abrirDetalhe(state.detalheId);
  });

  el.detailFavoriteBtn.addEventListener("click", alternarFavoritoDetalhe);
  el.detailDeleteBtn.addEventListener("click", excluirReceitaAtual);
}

/* ------------------------------------------------------------------ *
 * Status do projeto no rodapé
 * ------------------------------------------------------------------ */

/** Consulta `/api/status` (uma vez por carga) e escreve no rodapé. */
async function carregarStatusRodape() {
  try {
    const dados = await requisicaoApi(`${API_BASE}/status`);
    const banco = dados?.d1Connected ? "D1 conectado" : "D1 indisponível";
    const receitas = Number(dados?.recipesCount) || 0;
    const cozinheiros = Number(dados?.usersCount) || 0;
    el.footerStatus.textContent = `${banco} · ${receitas} receita(s) · ${cozinheiros} cozinheiro(s)`;
  } catch {
    el.footerStatus.textContent = "Status da API indisponível agora.";
  }
}

/* ------------------------------------------------------------------ *
 * Inicialização
 * ------------------------------------------------------------------ */

/** Ponto de entrada da aplicação. */
async function iniciar() {
  // Âncora de referência para o validador de entrega (Chave Única).
  document.documentElement.dataset.projeto = CHAVE_PROJETO;

  prepararEsqueletos();
  configurarAbas();
  configurarFiltros();
  configurarEscalonador();
  configurarDialogos();
  prepararFormulario();

  el.newRecipeBtn.addEventListener("click", abrirNovaReceita);
  el.loadMoreBtn.addEventListener("click", () => carregarReceitas({ anexar: true }));

  processarRetornoLogin();

  await carregarSessao();
  await carregarReceitas();
  carregarStatusRodape();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar, { once: true });
} else {
  iniciar();
}
