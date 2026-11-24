/*
  Issue Tracker — Projeto #38 · Turma 2C
  Chave Única: P26-2C-7200-F0C5-B458-DA41
  JavaScript puro (ES module), sem frameworks.
  Regra de ouro anti-XSS: dado vindo da API entra no DOM SÓ via textContent/createElement (helper el()).
*/

// ---------------------------------------------------------------------------
// Constantes (espelham functions/_lib/rules.js; o servidor é quem decide)
// ---------------------------------------------------------------------------
const STATUS_ORDER = ["aberto", "em_analise", "aguardando", "resolvido"];
const SEVERITY_ORDER = ["baixa", "media", "alta", "critica"];
const DEFAULT_STATUSES = {
  aberto: "Aberto",
  em_analise: "Em Análise",
  aguardando: "Aguardando Peça/Correção",
  resolvido: "Resolvido",
};
const DEFAULT_SEVERITIES = { baixa: "Baixa", media: "Média", alta: "Alta", critica: "Crítica" };
const SEVERITY_HINTS = {
  baixa: "Incômodo pequeno; existe alternativa para continuar o trabalho.",
  media: "Atrapalha a atividade, mas dá para contornar por enquanto.",
  alta: "Impede uma atividade importante da aula ou do projeto.",
  critica: "Laboratório/projeto parado, perda de dados ou risco de segurança.",
};
const LIMITS = {
  title: [5, 120],
  location: [2, 80],
  description: [10, 4000],
  comment: [2, 2000],
  note: [0, 1000],
};
const CODE_RE = /^CH-[0-9A-HJKMNP-TV-Z]{6}$/;
const AVATAR_RE = /^https:\/\/cdn\.discordapp\.com\/[A-Za-z0-9_\-./?=&%]+$/;

const state = {
  me: null,
  user: null,
  statuses: { ...DEFAULT_STATUSES },
  severities: { ...DEFAULT_SEVERITIES },
  filters: { status: "", severity: "", q: "", mine: false },
  navSeq: 0,
  firstRoute: true,
  skipFocusSeq: -1,
  pendingFlash: null,
};

const $app = document.getElementById("app");
const $flash = document.getElementById("flash");
const $userArea = document.getElementById("user-area");

// ---------------------------------------------------------------------------
// Helpers de DOM
// ---------------------------------------------------------------------------
/** Cria um elemento. attrs: class, dataset, on<Evento>: fn, booleanos e atributos comuns. */
function el(tag, attrs, ...children) {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") {
        node.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value);
      } else if (key === "dataset") {
        Object.assign(node.dataset, value);
      } else if (/^on[A-Z]/.test(key) && typeof value === "function") {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === "style" || /^on/i.test(key)) {
        // estilos inline e handlers em atributo são proibidos pela CSP
        continue;
      } else if ((key === "href" || key === "src") && /^\s*(javascript|data|vbscript):/i.test(String(value))) {
        continue;
      } else if (value === true) {
        node.setAttribute(key, "");
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }
  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

const ICONS = {
  copy: "M9 9h10v10H9zM5 15V5h10",
  plus: "M12 5v14M5 12h14",
  back: "M15 18l-6-6 6-6",
  login: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  check: "M5 12l5 5 9-10",
  comment: "M4 5h16v11H9l-5 4z",
  pin: "M12 21s-6-5.4-6-10.2A6 6 0 0 1 18 10.8C18 15.6 12 21 12 21zM12 8.5v4",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0a9 9 0 1 1 18 0z",
  inbox: "M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5",
};

function icon(name, extraClass) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", extraClass ? `icon ${extraClass}` : "icon");
  const path = document.createElementNS(NS, "path");
  path.setAttribute("d", ICONS[name] || "");
  svg.append(path);
  return svg;
}

function avatar(url, name, size = "sm") {
  const initial = ([...String(name || "?").trim()][0] || "?").toUpperCase();
  const cls = `avatar avatar-${size}`;
  const fallback = () => el("span", { class: `${cls} avatar-fallback`, "aria-hidden": "true" }, initial);
  if (typeof url === "string" && AVATAR_RE.test(url)) {
    const px = size === "md" ? 32 : 24;
    const img = el("img", {
      class: cls,
      src: url,
      alt: "",
      width: px,
      height: px,
      loading: "lazy",
      decoding: "async",
      referrerpolicy: "no-referrer",
    });
    img.addEventListener("error", () => img.replaceWith(fallback()), { once: true });
    return img;
  }
  return fallback();
}

function statusLabel(key) {
  return state.statuses[key] || DEFAULT_STATUSES[key] || String(key || "—");
}

function severityLabel(key) {
  return state.severities[key] || DEFAULT_SEVERITIES[key] || String(key || "—");
}

function statusBadge(key) {
  const safe = STATUS_ORDER.includes(key) ? key : "desconhecido";
  return el("span", { class: `badge status status-${safe}` }, el("span", { class: "sr-only" }, "Estado: "), statusLabel(key));
}

function severityBadge(key) {
  const safe = SEVERITY_ORDER.includes(key) ? key : "desconhecida";
  return el("span", { class: `badge sev sev-${safe}` }, el("span", { class: "sr-only" }, "Severidade: "), severityLabel(key));
}

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function charCount(text) {
  return [...String(text || "")].length;
}

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function loadingEl(text = "Carregando…") {
  return el("p", { class: "loading", role: "status" }, el("span", { class: "spinner", "aria-hidden": "true" }), text);
}

function focusTitle() {
  // no carregamento inicial da página não roubamos o foco
  if (state.skipFocusSeq === state.navSeq) return;
  const h = document.getElementById("page-title");
  if (h) h.focus({ preventScroll: true });
}

// ---------------------------------------------------------------------------
// Datas
// ---------------------------------------------------------------------------
const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
const fullDate = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short" });
const TIME_UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

function parseDate(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

function relativeTime(d) {
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 45) return "agora mesmo";
  for (const [unit, seconds] of TIME_UNITS) {
    if (abs >= seconds || unit === "minute") return rtf.format(Math.round(diff / seconds), unit);
  }
  return "";
}

/** <time> com texto relativo ("há 5 minutos") e title com a data completa em pt-BR. */
function timeEl(iso, cls) {
  const d = parseDate(iso);
  if (!d) return el("span", { class: cls }, "—");
  return el(
    "time",
    { class: cls, datetime: d.toISOString(), title: fullDate.format(d), "data-rel": "1" },
    relativeTime(d)
  );
}

setInterval(() => {
  for (const t of document.querySelectorAll("time[data-rel]")) {
    const d = parseDate(t.getAttribute("datetime"));
    if (d) t.textContent = relativeTime(d);
  }
}, 60000);

// ---------------------------------------------------------------------------
// Mensagens (aria-live)
// ---------------------------------------------------------------------------
let flashTimer = null;

function clearFlash() {
  clearTimeout(flashTimer);
  $flash.replaceChildren();
}

function flash(message, type = "info") {
  clearTimeout(flashTimer);
  const box = el(
    "div",
    { class: `flash flash-${type}`, role: type === "error" ? "alert" : null },
    el("p", { class: "flash-text" }, message),
    el("button", { type: "button", class: "flash-close", "aria-label": "Fechar aviso", onClick: clearFlash }, "×")
  );
  $flash.replaceChildren(box);
  if (type === "success" || type === "info") flashTimer = setTimeout(clearFlash, 7000);
}

function queueFlash(message, type = "info") {
  state.pendingFlash = { message, type };
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------
class ApiError extends Error {
  constructor(status, message, errors) {
    super(message);
    this.status = status;
    this.errors = errors && typeof errors === "object" ? errors : null;
  }
}

class AuthRequired extends Error {}

function defaultError(status) {
  if (status === 403) return "Você não tem permissão para esta ação.";
  if (status === 404) return "Não encontrado.";
  if (status === 409) return "O chamado mudou enquanto você o via. Recarregue e tente de novo.";
  if (status === 429) return "Muitas solicitações em pouco tempo. Tente novamente mais tarde.";
  if (status >= 500) return "O servidor encontrou um erro. Tente novamente em instantes.";
  return "Não foi possível concluir a operação.";
}

async function api(path, { method = "GET", body } = {}) {
  const options = { method, credentials: "same-origin", headers: { Accept: "application/json" } };
  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, options);
  } catch {
    throw new ApiError(0, "Sem conexão com o servidor. Verifique sua internet e tente novamente.");
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401) {
    handleUnauthorized();
    throw new AuthRequired();
  }
  if (!res.ok || !data || data.ok === false) {
    const msg = data && typeof data.error === "string" && data.error ? data.error : defaultError(res.status);
    throw new ApiError(res.status, msg, data && data.errors);
  }
  return { status: res.status, data };
}

function handleUnauthorized() {
  const wasLogged = Boolean(state.user);
  state.user = null;
  state.navSeq++;
  renderUserArea();
  renderLogin();
  flash(
    wasLogged
      ? "Sua sessão expirou. Entre novamente com o Discord para continuar."
      : "Faça login com o Discord para continuar.",
    "warn"
  );
}

const AUTH_ERRORS = {
  access_denied: "Você cancelou a autorização no Discord. Quando quiser, é só tentar de novo.",
  invalid_state: "O login expirou ou foi iniciado em outra aba. Clique em “Entrar com Discord” novamente.",
  missing_code: "O Discord não devolveu o código de autorização. Tente entrar de novo.",
  oauth_not_configured: "O login com Discord ainda não foi configurado neste servidor.",
  d1_not_bound: "O banco de dados (D1) não está vinculado ao projeto. Avise quem cuida do deploy.",
  token_exchange_failed: "Não conseguimos confirmar sua conta com o Discord. Tente novamente em instantes.",
  fetch_user_failed: "Não conseguimos ler seu perfil do Discord. Tente novamente em instantes.",
  exception: "Ocorreu um erro inesperado durante o login. Tente novamente.",
};

// ---------------------------------------------------------------------------
// Cabeçalho (usuário logado)
// ---------------------------------------------------------------------------
function renderUserArea() {
  const u = state.user;
  if (!u) {
    $userArea.replaceChildren();
    return;
  }
  $userArea.replaceChildren(
    el(
      "div",
      { class: "user-chip" },
      avatar(u.avatar, u.username, "md"),
      el("span", { class: "user-name", title: u.username }, u.username),
      u.admin ? el("span", { class: "badge badge-tech", title: "Pode mover chamados entre todos os estados" }, "Técnico") : null
    ),
    el("button", { type: "button", class: "btn btn-ghost btn-sm", onClick: logout }, "Sair")
  );
}

async function logout(event) {
  const btn = event && event.currentTarget;
  if (btn) btn.disabled = true;
  try {
    await api("/api/auth/logout", { method: "POST", body: {} });
  } catch (err) {
    if (err instanceof AuthRequired) return;
    if (btn) btn.disabled = false;
    flash(err.message, "error");
    return;
  }
  state.user = null;
  state.filters = { status: "", severity: "", q: "", mine: false };
  renderUserArea();
  queueFlash("Você saiu da sua conta.", "info");
  if (location.hash && location.hash !== "#/") location.hash = "#/";
  else route();
}

// ---------------------------------------------------------------------------
// Tela 1 — Login
// ---------------------------------------------------------------------------
function renderLogin() {
  document.title = "Entrar · Chamados da Turma 2C";
  const me = state.me || {};
  const configured = me.discordConfigured !== false;

  const warnings = [];
  if (!configured) {
    warnings.push(
      el(
        "div",
        { class: "notice notice-warn", role: "note" },
        el(
          "p",
          null,
          el("strong", null, "Login indisponível: "),
          "o OAuth2 do Discord ainda não foi configurado. Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages."
        )
      )
    );
  }
  if (me.d1Bound === false) {
    warnings.push(
      el(
        "div",
        { class: "notice notice-warn", role: "note" },
        el(
          "p",
          null,
          el("strong", null, "Banco não vinculado: "),
          "adicione o binding D1 chamado DB em Settings → Functions → D1 database bindings."
        )
      )
    );
  }

  const loginBtn = configured
    ? el("a", { class: "btn btn-discord btn-lg", href: "/api/auth/discord" }, icon("login"), "Entrar com Discord")
    : el("button", { type: "button", class: "btn btn-discord btn-lg", disabled: true }, icon("login"), "Entrar com Discord");

  const preview = el(
    "div",
    { class: "hero-preview", "aria-label": "Exemplo de chamado", role: "img" },
    el(
      "div",
      { class: "hero-preview-head" },
      el("span", { class: "code-chip" }, "CH-7K2M9Q"),
      severityBadge("alta"),
      statusBadge("em_analise")
    ),
    el("p", { class: "hero-preview-title" }, "PC 12 do Laboratório 3 não liga"),
    stepperFor("em_analise", new Set(["aberto", "em_analise"]))
  );

  $app.replaceChildren(
    ...warnings,
    el(
      "section",
      { class: "card hero", "aria-labelledby": "page-title" },
      el(
        "div",
        { class: "hero-copy" },
        el("h1", { id: "page-title", tabindex: "-1" }, "Chamados técnicos da turma, do começo ao fim"),
        el(
          "p",
          { class: "hero-lead" },
          "Computador com defeito no laboratório? Bug no projeto da turma? Abra um chamado, acompanhe cada mudança numa linha do tempo e converse com os técnicos até a solução."
        ),
        el(
          "ul",
          { class: "hero-features" },
          el("li", null, icon("check"), el("span", null, "Cada chamado recebe um código único no formato CH-XXXXXX.")),
          el(
            "li",
            null,
            icon("check"),
            el("span", null, "Estados claros: Aberto → Em Análise → Aguardando Peça/Correção → Resolvido.")
          ),
          el("li", null, icon("check"), el("span", null, "Comentários técnicos registrados no histórico até o fechamento."))
        ),
        el(
          "div",
          { class: "hero-actions" },
          loginBtn,
          el("span", { class: "muted" }, "Usamos só seu nome e avatar do Discord.")
        )
      ),
      preview
    )
  );
  focusTitle();
}

// ---------------------------------------------------------------------------
// Barra de progresso dos 4 estados
// ---------------------------------------------------------------------------
function stepperFor(current, visited) {
  const curIdx = STATUS_ORDER.indexOf(current);
  const steps = STATUS_ORDER.map((key, i) => {
    let cls = "is-todo";
    let sr = "pendente";
    if (key === current) {
      cls = "is-current";
      sr = "estado atual";
    } else if (i < curIdx) {
      if (visited.has(key)) {
        cls = "is-done";
        sr = "concluído";
      } else {
        cls = "is-skipped";
        sr = "etapa não utilizada";
      }
    }
    const dotText = cls === "is-done" || (cls === "is-current" && key === "resolvido") ? "✓" : String(i + 1);
    return el(
      "li",
      { class: `step step-${key} ${cls}`, "aria-current": key === current ? "step" : null },
      el("span", { class: "step-dot", "aria-hidden": "true" }, dotText),
      el("span", { class: "step-label" }, breakAfterSlash(statusLabel(key))),
      el("span", { class: "sr-only" }, ` (${sr})`)
    );
  });
  return el("ol", { class: "stepper", "aria-label": "Progresso do chamado" }, steps);
}

/** "Peça/Correção" → permite quebra de linha logo após a barra (sem HTML). */
function breakAfterSlash(text) {
  const parts = String(text).split("/");
  return parts.flatMap((p, i) => (i < parts.length - 1 ? [`${p}/`, el("wbr")] : [p]));
}

// ---------------------------------------------------------------------------
// Tela 2 — Painel
// ---------------------------------------------------------------------------
function hasActiveFilters() {
  const f = state.filters;
  return Boolean(f.status || f.severity || f.q || f.mine);
}

function renderDashboard(seq) {
  document.title = "Painel · Chamados da Turma 2C";
  const f = state.filters;

  // --- filtros ---
  const statusSelect = el(
    "select",
    { id: "f-status", name: "status" },
    el("option", { value: "" }, "Todos os estados"),
    STATUS_ORDER.map((k) => el("option", { value: k, selected: f.status === k }, statusLabel(k)))
  );
  const severitySelect = el(
    "select",
    { id: "f-severity", name: "severity" },
    el("option", { value: "" }, "Todas as severidades"),
    SEVERITY_ORDER.map((k) => el("option", { value: k, selected: f.severity === k }, severityLabel(k)))
  );
  const searchInput = el("input", {
    type: "search",
    id: "f-q",
    name: "q",
    maxlength: 80,
    placeholder: "Título, local ou código (CH-…)",
    autocomplete: "off",
  });
  searchInput.value = f.q;
  const mineCheck = el("input", { type: "checkbox", id: "f-mine", name: "mine" });
  mineCheck.checked = f.mine;
  const clearBtn = el("button", { type: "button", class: "btn btn-ghost" }, "Limpar filtros");

  const filtersForm = el(
    "form",
    { class: "card filters", role: "search", "aria-label": "Filtrar chamados" },
    el("div", { class: "field" }, el("label", { for: "f-status" }, "Estado"), statusSelect),
    el("div", { class: "field" }, el("label", { for: "f-severity" }, "Severidade"), severitySelect),
    el("div", { class: "field" }, el("label", { for: "f-q" }, "Buscar"), searchInput),
    el(
      "div",
      { class: "filters-actions" },
      el("label", { class: "check", for: "f-mine" }, mineCheck, "Só meus chamados"),
      clearBtn
    )
  );

  // --- contadores ---
  const totalButtons = {};
  const totalCounts = {};
  const totalsWrap = el(
    "div",
    { class: "totals", role: "group", "aria-label": "Chamados por estado (clique para filtrar)" },
    STATUS_ORDER.map((k) => {
      totalCounts[k] = el("span", { class: "total-count" }, "–");
      totalButtons[k] = el(
        "button",
        {
          type: "button",
          class: `total-card total-${k}`,
          "aria-pressed": f.status === k ? "true" : "false",
          onClick: () => {
            state.filters.status = state.filters.status === k ? "" : k;
            statusSelect.value = state.filters.status;
            syncPressed();
            load();
          },
        },
        totalCounts[k],
        el("span", { class: "total-label" }, statusLabel(k))
      );
      return totalButtons[k];
    })
  );

  function syncPressed() {
    for (const k of STATUS_ORDER) {
      totalButtons[k].setAttribute("aria-pressed", state.filters.status === k ? "true" : "false");
    }
  }

  // --- lista ---
  const listSummary = el("p", { class: "list-summary", "aria-live": "polite" });
  const listBody = el("div", null, loadingEl("Carregando chamados…"));
  const listSection = el(
    "section",
    { class: "list-section", "aria-labelledby": "list-title", "aria-busy": "true" },
    el("div", { class: "list-head" }, el("h2", { id: "list-title" }, "Chamados"), listSummary),
    listBody
  );

  $app.replaceChildren(
    el(
      "div",
      { class: "page-head" },
      el(
        "div",
        { class: "page-head-text" },
        el("h1", { id: "page-title", tabindex: "-1" }, "Painel de chamados"),
        el("p", { class: "muted" }, "Problemas nos laboratórios e nos projetos da turma, em um só lugar.")
      ),
      el("a", { class: "btn btn-primary", href: "#/novo" }, icon("plus"), "Abrir chamado")
    ),
    totalsWrap,
    filtersForm,
    listSection
  );
  focusTitle();

  // --- eventos ---
  statusSelect.addEventListener("change", () => {
    state.filters.status = statusSelect.value;
    syncPressed();
    load();
  });
  severitySelect.addEventListener("change", () => {
    state.filters.severity = severitySelect.value;
    load();
  });
  mineCheck.addEventListener("change", () => {
    state.filters.mine = mineCheck.checked;
    load();
  });
  const searchLater = debounce(() => {
    const q = searchInput.value.trim();
    if (q === state.filters.q) return;
    state.filters.q = q;
    load();
  }, 350);
  searchInput.addEventListener("input", searchLater);
  filtersForm.addEventListener("submit", (e) => {
    e.preventDefault();
    state.filters.q = searchInput.value.trim();
    load();
  });
  function clearFilters() {
    state.filters = { status: "", severity: "", q: "", mine: false };
    statusSelect.value = "";
    severitySelect.value = "";
    searchInput.value = "";
    mineCheck.checked = false;
    syncPressed();
    load();
  }
  clearBtn.addEventListener("click", clearFilters);

  let reqId = 0;
  async function load() {
    const my = ++reqId;
    listSection.setAttribute("aria-busy", "true");
    listSection.classList.add("is-loading");
    const qs = new URLSearchParams();
    const cur = state.filters;
    if (cur.status) qs.set("status", cur.status);
    if (cur.severity) qs.set("severity", cur.severity);
    if (cur.q) qs.set("q", cur.q);
    if (cur.mine) qs.set("mine", "1");
    const query = qs.toString();
    try {
      const { data } = await api(`/api/tickets${query ? `?${query}` : ""}`);
      if (my !== reqId || seq !== state.navSeq) return;
      const totals = data.totals || {};
      for (const k of STATUS_ORDER) totalCounts[k].textContent = String(Number(totals[k]) || 0);
      const tickets = Array.isArray(data.tickets) ? data.tickets : [];
      listSummary.textContent =
        tickets.length >= 200
          ? "Mostrando os 200 chamados mais relevantes"
          : hasActiveFilters()
            ? `${plural(tickets.length, "chamado encontrado", "chamados encontrados")} com os filtros`
            : plural(tickets.length, "chamado", "chamados");
      listBody.replaceChildren(
        tickets.length ? el("ul", { class: "ticket-list" }, tickets.map(ticketCard)) : emptyState(clearFilters)
      );
    } catch (err) {
      if (err instanceof AuthRequired || my !== reqId || seq !== state.navSeq) return;
      listSummary.textContent = "";
      listBody.replaceChildren(errorBox(err.message, load));
    } finally {
      if (my === reqId) {
        listSection.setAttribute("aria-busy", "false");
        listSection.classList.remove("is-loading");
      }
    }
  }
  load();
}

function ticketCard(t) {
  const code = CODE_RE.test(String(t.code)) ? t.code : null;
  const sev = SEVERITY_ORDER.includes(t.severity) ? t.severity : "baixa";
  const comments = Number(t.comments) || 0;
  const isMine = state.user && String(t.author_id) === String(state.user.user_id);
  const inner = [
    el(
      "div",
      { class: "ticket-top" },
      el("span", { class: "code-chip" }, t.code || "—"),
      statusBadge(t.status),
      severityBadge(t.severity),
      isMine ? el("span", { class: "badge badge-author" }, "Meu") : null
    ),
    el("h3", { class: "ticket-title" }, t.title || "(sem título)"),
    el(
      "p",
      { class: "ticket-meta" },
      el("span", { class: "meta-item" }, icon("pin"), el("span", { class: "sr-only" }, "Local: "), t.location || "—"),
      el(
        "span",
        { class: "meta-item" },
        avatar(t.author_avatar, t.author_name, "sm"),
        el("span", { class: "sr-only" }, "Aberto por "),
        t.author_name || "Usuário"
      ),
      el("span", { class: "meta-item" }, icon("comment"), plural(comments, "comentário", "comentários")),
      el("span", { class: "meta-item" }, icon("clock"), "atualizado ", timeEl(t.updated_at || t.created_at))
    ),
  ];
  return el(
    "li",
    { class: t.status === "resolvido" ? "is-resolved" : null },
    code
      ? el("a", { class: `ticket-link edge-${sev}`, href: `#/chamado/${code}` }, inner)
      : el("div", { class: `ticket-link edge-${sev}` }, inner)
  );
}

function emptyState(clearFilters) {
  if (hasActiveFilters()) {
    return el(
      "div",
      { class: "card empty" },
      icon("inbox", "empty-art"),
      el("p", { class: "empty-title" }, "Nenhum chamado corresponde aos filtros."),
      el("p", null, "Tente outra busca ou remova algum filtro."),
      el("button", { type: "button", class: "btn btn-secondary", onClick: clearFilters }, "Limpar filtros")
    );
  }
  return el(
    "div",
    { class: "card empty" },
    icon("inbox", "empty-art"),
    el("p", { class: "empty-title" }, "Tudo tranquilo por aqui: nenhum chamado ainda."),
    el(
      "p",
      null,
      "Quando algo quebrar no laboratório ou aparecer um bug no projeto da turma, abra o primeiro chamado."
    ),
    el("a", { class: "btn btn-primary", href: "#/novo" }, icon("plus"), "Abrir chamado")
  );
}

function errorBox(message, retry) {
  return el(
    "div",
    { class: "notice notice-error", role: "alert" },
    el(
      "div",
      { class: "notice-body" },
      el("p", null, message),
      retry ? el("p", null, el("button", { type: "button", class: "btn btn-secondary btn-sm", onClick: retry }, "Tentar de novo")) : null
    )
  );
}

// ---------------------------------------------------------------------------
// Formulários: campos com erro por campo e contador
// ---------------------------------------------------------------------------
function makeField({ id, name, label, hint, control, limit }) {
  const errorEl = el("p", { class: "field-error", id: `${id}-error` });
  const hintEl = hint ? el("p", { class: "field-hint", id: `${id}-hint` }, hint) : null;
  const counter = limit ? el("span", { class: "counter", "aria-hidden": "true" }) : null;
  control.setAttribute("aria-describedby", [hintEl ? `${id}-hint` : "", `${id}-error`].filter(Boolean).join(" "));

  function updateCounter() {
    if (!counter) return;
    const n = charCount(control.value);
    counter.textContent = `${n}/${limit[1]}`;
    counter.classList.toggle("is-over", n > limit[1]);
  }
  if (counter) {
    control.addEventListener("input", updateCounter);
    updateCounter();
  }
  control.addEventListener("input", () => {
    if (control.getAttribute("aria-invalid") === "true") setError("");
  });

  function setError(msg) {
    errorEl.textContent = msg || "";
    if (msg) control.setAttribute("aria-invalid", "true");
    else control.removeAttribute("aria-invalid");
  }

  const wrap = el(
    "div",
    { class: "field" },
    el("label", { for: id }, label),
    hintEl,
    control,
    el("div", { class: "field-foot" }, errorEl, counter)
  );
  return { name, wrap, control, setError, updateCounter };
}

function lengthError(value, [min, max], label, { optional = false } = {}) {
  const n = charCount(value);
  if (!optional && n === 0) return `Preencha o campo “${label}”.`;
  if (n > 0 && n < min) return `${label} precisa ter pelo menos ${min} caracteres.`;
  if (n > max) return `${label} pode ter no máximo ${max} caracteres.`;
  return "";
}

// ---------------------------------------------------------------------------
// Tela 3 — Novo chamado
// ---------------------------------------------------------------------------
function renderNew(seq) {
  document.title = "Abrir chamado · Chamados da Turma 2C";

  const title = makeField({
    id: "n-title",
    name: "title",
    label: "Título",
    hint: "Resumo curto do problema.",
    limit: LIMITS.title,
    control: el("input", {
      type: "text",
      id: "n-title",
      name: "title",
      required: true,
      minlength: LIMITS.title[0],
      maxlength: LIMITS.title[1],
      autocomplete: "off",
      placeholder: "Ex.: PC 12 do Laboratório 3 não liga",
    }),
  });
  const place = makeField({
    id: "n-location",
    name: "location",
    label: "Laboratório / projeto afetado",
    hint: "Onde está o problema: laboratório e bancada, ou nome do projeto da turma.",
    limit: LIMITS.location,
    control: el("input", {
      type: "text",
      id: "n-location",
      name: "location",
      required: true,
      minlength: LIMITS.location[0],
      maxlength: LIMITS.location[1],
      autocomplete: "off",
      placeholder: "Ex.: Laboratório 3 — bancada 12",
    }),
  });
  const description = makeField({
    id: "n-description",
    name: "description",
    label: "Descrição",
    hint: "Conte o que acontece, desde quando e o que já tentou. Quebras de linha são mantidas.",
    limit: LIMITS.description,
    control: el("textarea", {
      id: "n-description",
      name: "description",
      required: true,
      minlength: LIMITS.description[0],
      maxlength: LIMITS.description[1],
      rows: 7,
    }),
  });

  // Severidade: grupo de rádios com descrição
  const sevError = el("p", { class: "field-error", id: "n-severity-error" });
  const sevFieldset = el(
    "fieldset",
    { class: "field", "aria-describedby": "n-severity-error" },
    el("legend", null, "Severidade"),
    el(
      "div",
      { class: "sev-options" },
      SEVERITY_ORDER.map((k) =>
        el(
          "label",
          { class: "sev-option", for: `n-sev-${k}` },
          el("input", { type: "radio", id: `n-sev-${k}`, name: "severity", value: k, required: true }),
          el("span", { class: "sev-option-text" }, el("span", null, severityBadge(k)), el("span", { class: "sev-option-desc" }, SEVERITY_HINTS[k]))
        )
      )
    ),
    sevError
  );
  const severity = {
    name: "severity",
    setError(msg) {
      sevError.textContent = msg || "";
      sevFieldset.classList.toggle("fieldset-invalid", Boolean(msg));
    },
    get value() {
      const checked = sevFieldset.querySelector("input[name='severity']:checked");
      return checked ? checked.value : "";
    },
    focus() {
      const first = sevFieldset.querySelector("input[name='severity']");
      if (first) first.focus();
    },
  };
  sevFieldset.addEventListener("change", () => severity.setError(""));

  const formError = el("div", { class: "form-error", role: "alert" });
  const submitBtn = el("button", { type: "submit", class: "btn btn-primary" }, "Abrir chamado");

  const form = el(
    "form",
    { class: "card new-form", novalidate: true, "aria-labelledby": "page-title" },
    title.wrap,
    place.wrap,
    sevFieldset,
    description.wrap,
    formError,
    el("div", { class: "form-actions" }, submitBtn, el("a", { class: "btn btn-ghost", href: "#/" }, "Cancelar"))
  );

  $app.replaceChildren(
    el("nav", { class: "breadcrumb", "aria-label": "Navegação" }, el("a", { href: "#/" }, icon("back"), "Voltar ao painel")),
    el(
      "div",
      { class: "page-head" },
      el(
        "div",
        { class: "page-head-text" },
        el("h1", { id: "page-title", tabindex: "-1" }, "Abrir chamado"),
        el("p", { class: "muted" }, "Descreva o problema. Você receberá um código CH-XXXXXX para acompanhar.")
      )
    ),
    form
  );
  focusTitle();

  const fields = { title, location: place, severity, description };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    formError.replaceChildren();
    const payload = {
      title: title.control.value.trim(),
      location: place.control.value.trim(),
      severity: severity.value,
      description: description.control.value.trim(),
    };
    const clientErrors = {
      title: lengthError(payload.title, LIMITS.title, "Título"),
      location: lengthError(payload.location, LIMITS.location, "Laboratório/projeto afetado"),
      severity: payload.severity ? "" : "Escolha a severidade.",
      description: lengthError(payload.description, LIMITS.description, "Descrição"),
    };
    if (showErrors(fields, clientErrors)) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Enviando…";
    try {
      const { data } = await api("/api/tickets", { method: "POST", body: payload });
      if (seq !== state.navSeq) return;
      const code = typeof data.code === "string" && CODE_RE.test(data.code) ? data.code : null;
      queueFlash(
        code ? `Chamado ${code} aberto com sucesso. Guarde o código para acompanhar.` : "Chamado aberto com sucesso.",
        "success"
      );
      goTo(code ? `#/chamado/${code}` : "#/");
    } catch (err) {
      if (err instanceof AuthRequired || seq !== state.navSeq) return;
      if (err.status === 422 && err.errors) showErrors(fields, err.errors);
      formError.replaceChildren(el("p", { class: "notice notice-error" }, err.message));
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Abrir chamado";
    }
  });
}

/** Mostra erros por campo; devolve true se houver algum (e foca o primeiro). */
function showErrors(fields, errors) {
  let first = null;
  for (const [name, f] of Object.entries(fields)) {
    const msg = errors && typeof errors[name] === "string" ? errors[name] : "";
    f.setError(msg);
    if (msg && !first) first = f;
  }
  if (first) {
    if (first.control) first.control.focus();
    else if (first.focus) first.focus();
  }
  return Boolean(first);
}

function goTo(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

// ---------------------------------------------------------------------------
// Tela 4 — Detalhe do chamado + linha do tempo
// ---------------------------------------------------------------------------
async function renderTicket(code, seq) {
  document.title = `${code} · Chamados da Turma 2C`;
  $app.replaceChildren(
    el("nav", { class: "breadcrumb", "aria-label": "Navegação" }, el("a", { href: "#/" }, icon("back"), "Voltar ao painel")),
    loadingEl(`Carregando chamado ${code}…`)
  );
  try {
    const { data } = await api(`/api/tickets/${encodeURIComponent(code)}`);
    if (seq !== state.navSeq) return;
    drawTicket(data.ticket, seq);
    focusTitle();
  } catch (err) {
    if (err instanceof AuthRequired || seq !== state.navSeq) return;
    if (err.status === 404) {
      renderNotFound(`O chamado ${code} não existe ou foi digitado errado.`);
      return;
    }
    $app.replaceChildren(
      el("nav", { class: "breadcrumb", "aria-label": "Navegação" }, el("a", { href: "#/" }, icon("back"), "Voltar ao painel")),
      errorBox(err.message, () => renderTicket(code, seq))
    );
  }
}

async function reloadTicket(code, seq) {
  try {
    const { data } = await api(`/api/tickets/${encodeURIComponent(code)}`);
    if (seq === state.navSeq) drawTicket(data.ticket, seq);
  } catch (err) {
    if (!(err instanceof AuthRequired) && seq === state.navSeq) flash(err.message, "error");
  }
}

function drawTicket(t, seq, { focusLast = false } = {}) {
  document.title = `${t.code} · ${t.title} · Chamados`;
  const events = Array.isArray(t.events) ? t.events : [];
  const perms = t.permissions || {};
  const visited = new Set(["aberto"]);
  for (const ev of events) if (ev.to_status) visited.add(ev.to_status);
  visited.add(t.status);

  // --- cabeçalho ---
  const copyBtn = el("button", { type: "button", class: "btn btn-secondary btn-sm" }, icon("copy"), "Copiar código");
  copyBtn.addEventListener("click", () => copyCode(t.code, copyBtn));

  const head = el(
    "header",
    { class: "ticket-head" },
    el("div", { class: "code-row" }, el("span", { class: "code-lg" }, t.code), copyBtn),
    el("h1", { id: "page-title", tabindex: "-1" }, t.title),
    el("div", { class: "badges" }, statusBadge(t.status), severityBadge(t.severity))
  );

  const progress = el(
    "section",
    { class: "card progress", "aria-label": "Progresso do chamado" },
    stepperFor(t.status, visited)
  );

  // --- descrição ---
  const descCard = el(
    "section",
    { class: "card", "aria-labelledby": "desc-title" },
    el("div", { class: "card-title" }, el("h2", { id: "desc-title" }, "Descrição")),
    el("p", { class: "description prewrap" }, t.description || "")
  );

  // --- linha do tempo ---
  const items = events.map((ev) => timelineItem(ev, t));
  const timelineCard = el(
    "section",
    { class: "card", "aria-labelledby": "tl-title" },
    el(
      "div",
      { class: "card-title" },
      el("h2", { id: "tl-title" }, "Linha do tempo"),
      el("span", { class: "count" }, plural(events.length, "evento", "eventos"))
    ),
    items.length
      ? el("ol", { class: "timeline" }, items)
      : el("p", { class: "muted" }, "Nenhum evento registrado ainda.")
  );

  // --- comentário ---
  const commentCard = buildCommentCard(t, seq);

  // --- lateral: detalhes + ações ---
  const details = el(
    "section",
    { class: "card", "aria-labelledby": "det-title" },
    el("div", { class: "card-title" }, el("h2", { id: "det-title" }, "Detalhes")),
    el(
      "dl",
      { class: "details" },
      detail("Código", el("span", { class: "mono" }, t.code)),
      detail("Laboratório / projeto", t.location),
      detail("Severidade", severityBadge(t.severity)),
      detail("Estado", statusBadge(t.status)),
      detail("Aberto por", [avatar(t.author_avatar, t.author_name, "sm"), el("span", null, t.author_name || "Usuário")]),
      detail("Aberto", timeEl(t.created_at)),
      detail("Última atualização", timeEl(t.updated_at)),
      t.resolved_at ? detail("Resolvido", timeEl(t.resolved_at)) : null
    )
  );

  const actions = buildStatusCard(t, perms, seq);

  $app.replaceChildren(
    el("nav", { class: "breadcrumb", "aria-label": "Navegação" }, el("a", { href: "#/" }, icon("back"), "Voltar ao painel")),
    head,
    progress,
    el(
      "div",
      { class: "ticket-grid" },
      el("div", { class: "ticket-main" }, descCard, timelineCard, commentCard),
      el("aside", { class: "ticket-side", "aria-label": "Detalhes e ações" }, details, actions)
    )
  );

  if (focusLast && items.length) {
    const last = items[items.length - 1];
    last.focus({ preventScroll: true });
    last.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function detail(label, value) {
  return el("div", null, el("dt", null, label), el("dd", null, value));
}

function timelineItem(ev, t) {
  const kind = ["criado", "status", "comentario"].includes(ev.kind) ? ev.kind : "outro";
  const to = STATUS_ORDER.includes(ev.to_status) ? ev.to_status : kind === "criado" ? "aberto" : null;
  const isAuthor = String(ev.author_id) === String(t.author_id);

  let action;
  let body = null;
  if (kind === "criado") {
    action = el("span", { class: "tl-action" }, "abriu o chamado");
  } else if (kind === "status") {
    action = ev.from_status
      ? el("span", { class: "tl-action" }, "mudou de", statusBadge(ev.from_status), "para", statusBadge(ev.to_status))
      : el("span", { class: "tl-action" }, "mudou o estado para", statusBadge(ev.to_status));
    if (ev.body) {
      body = el(
        "div",
        { class: "tl-note" },
        el("span", { class: "tl-note-label" }, "Observação"),
        el("p", { class: "prewrap" }, ev.body)
      );
    }
  } else if (kind === "comentario") {
    action = el("span", { class: "tl-action" }, "comentou");
    body = el("div", { class: "tl-bubble" }, el("p", { class: "prewrap" }, ev.body || ""));
  } else {
    action = el("span", { class: "tl-action" }, "registrou um evento");
    if (ev.body) body = el("p", { class: "prewrap" }, ev.body);
  }

  return el(
    "li",
    { class: ["tl-item", `tl-${kind}`, to && kind !== "comentario" ? `tl-to-${to}` : null], tabindex: "-1" },
    el("span", { class: "tl-marker", "aria-hidden": "true" }),
    el(
      "div",
      { class: "tl-content" },
      el(
        "div",
        { class: "tl-head" },
        avatar(ev.author_avatar, ev.author_name, "sm"),
        el("span", { class: "tl-name" }, ev.author_name || "Usuário"),
        isAuthor && kind !== "criado" ? el("span", { class: "badge badge-author" }, "Autor") : null,
        action,
        timeEl(ev.created_at, "tl-time")
      ),
      body
    )
  );
}

function buildCommentCard(t, seq) {
  if (!(t.permissions && t.permissions.canComment)) {
    const resolved = parseDate(t.resolved_at);
    return el(
      "section",
      { class: "card comment-card", "aria-labelledby": "cm-title" },
      el("h2", { id: "cm-title", class: "sr-only" }, "Comentários"),
      el(
        "div",
        { class: "notice notice-closed", role: "note" },
        icon("check"),
        el(
          "p",
          null,
          el("strong", null, "Chamado fechado. "),
          resolved
            ? `Este chamado foi resolvido em ${fullDate.format(resolved)} e não aceita novos comentários.`
            : "Este chamado foi resolvido e não aceita novos comentários."
        )
      )
    );
  }

  const comment = makeField({
    id: "c-body",
    name: "body",
    label: "Novo comentário técnico",
    hint: "Registre diagnósticos, testes feitos ou próximos passos. Quebras de linha são mantidas.",
    limit: LIMITS.comment,
    control: el("textarea", {
      id: "c-body",
      name: "body",
      required: true,
      minlength: LIMITS.comment[0],
      maxlength: LIMITS.comment[1],
      rows: 4,
    }),
  });
  const submitBtn = el("button", { type: "submit", class: "btn btn-primary" }, icon("comment"), "Comentar");
  const form = el(
    "form",
    { class: "card comment-card", novalidate: true, "aria-labelledby": "cm-title" },
    el("div", { class: "card-title" }, el("h2", { id: "cm-title" }, "Comentar")),
    comment.wrap,
    el("div", { class: "form-actions" }, submitBtn)
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = comment.control.value.trim();
    const msg = lengthError(text, LIMITS.comment, "Comentário");
    if (msg) {
      comment.setError(msg);
      comment.control.focus();
      return;
    }
    submitBtn.disabled = true;
    try {
      const { data } = await api(`/api/tickets/${encodeURIComponent(t.code)}/comments`, {
        method: "POST",
        body: { body: text },
      });
      if (seq !== state.navSeq) return;
      drawTicket(data.ticket, seq, { focusLast: true });
      flash("Comentário adicionado à linha do tempo.", "success");
    } catch (err) {
      if (err instanceof AuthRequired || seq !== state.navSeq) return;
      submitBtn.disabled = false;
      if (err.status === 422 && err.errors && err.errors.body) {
        comment.setError(err.errors.body);
        comment.control.focus();
      } else if (err.status === 409 || err.status === 404) {
        flash(err.message, "error");
        reloadTicket(t.code, seq);
      } else {
        flash(err.message, "error");
      }
    }
  });
  return form;
}

function buildStatusCard(t, perms, seq) {
  const card = el(
    "section",
    { class: "card", "aria-labelledby": "st-title" },
    el("div", { class: "card-title" }, el("h2", { id: "st-title" }, "Estado do chamado"))
  );

  if (t.status === "resolvido") {
    appendChildren(card, [
      el("p", { class: "side-note" }, "Resolvido é o estado final: o chamado está fechado e não aceita mais mudanças."),
    ]);
    return card;
  }

  const transitions = (Array.isArray(perms.transitions) ? perms.transitions : []).filter((k) => STATUS_ORDER.includes(k));
  if (!transitions.length) {
    appendChildren(card, [
      el(
        "p",
        { class: "side-note" },
        "Só técnicos podem mover este chamado entre os estados. O autor pode apenas marcá-lo como resolvido."
      ),
    ]);
    return card;
  }

  const note = makeField({
    id: "s-note",
    name: "note",
    label: "Observação (opcional)",
    hint: "Aparece na linha do tempo junto com a mudança.",
    limit: LIMITS.note,
    control: el("textarea", { id: "s-note", name: "note", maxlength: LIMITS.note[1], rows: 3 }),
  });

  const buttons = transitions.map((k) =>
    el(
      "button",
      { type: "button", class: k === "resolvido" ? "btn btn-success" : `btn btn-status to-${k}` },
      k === "resolvido" ? [icon("check"), `Marcar como ${statusLabel(k)}`] : `Mover para ${statusLabel(k)}`
    )
  );

  async function change(to) {
    const text = note.control.value.trim();
    const msg = lengthError(text, LIMITS.note, "Observação", { optional: true });
    if (msg) {
      note.setError(msg);
      note.control.focus();
      return;
    }
    if (
      to === "resolvido" &&
      !window.confirm("Marcar este chamado como Resolvido? Ele será fechado e não aceitará mais comentários nem mudanças.")
    ) {
      return;
    }
    for (const b of buttons) b.disabled = true;
    try {
      const body = text ? { status: to, note: text } : { status: to };
      const { data } = await api(`/api/tickets/${encodeURIComponent(t.code)}/status`, { method: "POST", body });
      if (seq !== state.navSeq) return;
      drawTicket(data.ticket, seq, { focusLast: true });
      flash(`Estado alterado para “${statusLabel(to)}”.`, "success");
    } catch (err) {
      if (err instanceof AuthRequired || seq !== state.navSeq) return;
      for (const b of buttons) b.disabled = false;
      if (err.status === 422 && err.errors && err.errors.note) {
        note.setError(err.errors.note);
        note.control.focus();
      } else if (err.status === 403 || err.status === 409 || err.status === 404) {
        flash(err.message, "error");
        reloadTicket(t.code, seq);
      } else {
        flash(err.message, "error");
      }
    }
  }
  transitions.forEach((k, i) => buttons[i].addEventListener("click", () => change(k)));

  const isAuthorOnly = !(state.user && state.user.admin);
  appendChildren(card, [
    el("p", { class: "side-note" }, "Atual: ", statusBadge(t.status)),
    isAuthorOnly
      ? el(
          "p",
          { class: "side-note" },
          "Como autor, você pode marcar o chamado como resolvido (por exemplo, se o problema sumiu). As demais mudanças são feitas pelos técnicos."
        )
      : null,
    note.wrap,
    el("div", { class: "status-actions", role: "group", "aria-label": "Mudar estado" }, buttons),
  ]);
  return card;
}

async function copyCode(code, btn) {
  let ok = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(code);
      ok = true;
    }
  } catch {
    ok = false;
  }
  if (!ok) {
    const helper = el("textarea", { class: "clipboard-helper", readonly: true, "aria-hidden": "true", tabindex: "-1" });
    helper.value = code;
    document.body.append(helper);
    helper.select();
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    helper.remove();
    btn.focus();
  }
  if (ok) {
    btn.replaceChildren(icon("check"), "Copiado!");
    flash(`Código ${code} copiado para a área de transferência.`, "success");
    setTimeout(() => btn.replaceChildren(icon("copy"), "Copiar código"), 2000);
  } else {
    flash(`Não foi possível copiar automaticamente. O código é ${code}.`, "warn");
  }
}

// ---------------------------------------------------------------------------
// Não encontrado
// ---------------------------------------------------------------------------
function renderNotFound(message = "A página que você procura não existe.") {
  document.title = "Não encontrado · Chamados da Turma 2C";
  $app.replaceChildren(
    el(
      "section",
      { class: "card empty" },
      icon("inbox", "empty-art"),
      el("h1", { id: "page-title", tabindex: "-1", class: "empty-title" }, "Não encontrado"),
      el("p", null, message),
      el("a", { class: "btn btn-primary", href: "#/" }, "Ir para o painel")
    )
  );
  focusTitle();
}

// ---------------------------------------------------------------------------
// Roteador por hash
// ---------------------------------------------------------------------------
function parseRoute() {
  const raw = location.hash.replace(/^#/, "") || "/";
  if (raw === "/" || raw === "") return { name: "dashboard" };
  if (raw === "/novo" || raw === "/novo/") return { name: "new" };
  const m = /^\/chamado\/([^/?#]+)\/?$/.exec(raw);
  if (m) {
    let code = "";
    try {
      code = decodeURIComponent(m[1]).trim().toUpperCase();
    } catch {
      code = "";
    }
    return CODE_RE.test(code) ? { name: "ticket", code } : { name: "notfound", message: "Código de chamado inválido. O formato é CH-XXXXXX." };
  }
  return { name: "notfound" };
}

function route() {
  const seq = ++state.navSeq;
  state.skipFocusSeq = state.firstRoute ? seq : -1;
  clearFlash();
  if (state.pendingFlash) {
    flash(state.pendingFlash.message, state.pendingFlash.type);
    state.pendingFlash = null;
  }
  if (!state.firstRoute) window.scrollTo(0, 0);

  if (!state.user) {
    renderLogin();
  } else {
    const r = parseRoute();
    if (r.name === "dashboard") renderDashboard(seq);
    else if (r.name === "new") renderNew(seq);
    else if (r.name === "ticket") renderTicket(r.code, seq);
    else renderNotFound(r.message);
  }
  state.firstRoute = false;
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------
function consumeAuthError() {
  const params = new URLSearchParams(location.search);
  if (!params.has("auth_error")) return;
  const reason = params.get("auth_error") || "";
  params.delete("auth_error");
  const rest = params.toString();
  history.replaceState(null, "", `${location.pathname}${rest ? `?${rest}` : ""}${location.hash}`);
  queueFlash(
    Object.hasOwn(AUTH_ERRORS, reason)
      ? AUTH_ERRORS[reason]
      : "Não foi possível concluir o login com o Discord. Tente novamente.",
    "error"
  );
}

let listening = false;

async function boot() {
  consumeAuthError();
  $app.replaceChildren(loadingEl("Carregando…"));
  let data;
  try {
    ({ data } = await api("/api/me"));
  } catch (err) {
    if (err instanceof AuthRequired) return;
    $app.replaceChildren(
      errorBox(`Não foi possível falar com o servidor. ${err.message}`, () => boot())
    );
    return;
  }
  state.me = data;
  state.user = data.user && typeof data.user === "object" ? data.user : null;
  if (data.statuses && typeof data.statuses === "object") state.statuses = { ...DEFAULT_STATUSES, ...data.statuses };
  if (data.severities && typeof data.severities === "object") state.severities = { ...DEFAULT_SEVERITIES, ...data.severities };
  renderUserArea();
  if (!listening) {
    window.addEventListener("hashchange", route);
    listening = true;
  }
  route();
}

boot();
