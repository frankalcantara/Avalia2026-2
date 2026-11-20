// Eventos RSVP — JavaScript puro (sem frameworks). Chave: P26-3A-DAD6-042E-642E-9A58
// Dados vindos da API são inseridos apenas com textContent/createElement.

"use strict";

const app = document.getElementById("app");
const userArea = document.getElementById("user-area");
const avisos = document.getElementById("avisos");

const state = {
  me: undefined, // undefined = carregando; null = sem sessão; objeto = logado
  scope: "upcoming", // "upcoming" | "mine"
  detail: null, // último { event, confirmed, waitlist } exibido
};

let renderToken = 0;
let lastAnnounceAt = 0;

// ---------------------------------------------------------------------------
// Utilidades de DOM
// ---------------------------------------------------------------------------

/** Cria um elemento. attrs: class, text, on<Evento>, demais viram atributos. */
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, "");
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function setView(...nodes) {
  app.replaceChildren(...nodes);
}

function focusHeading() {
  const h1 = app.querySelector("h1");
  if (h1) {
    h1.setAttribute("tabindex", "-1");
    h1.focus({ preventScroll: false });
  }
}

function loadingView(texto = "Carregando…") {
  return el("p", { class: "estado estado--carregando", text: texto });
}

function avatar(url, nome, extraClass = "") {
  return el("img", {
    class: `avatar ${extraClass}`.trim(),
    src: url || "https://cdn.discordapp.com/embed/avatars/0.png",
    alt: `Avatar de ${nome}`,
    width: 32,
    height: 32,
    loading: "lazy",
    decoding: "async",
    referrerpolicy: "no-referrer",
  });
}

function displayName(user) {
  if (!user) return "";
  return user.global_name || user.username || "Usuário";
}

// ---------------------------------------------------------------------------
// Avisos (região aria-live)
// ---------------------------------------------------------------------------

/** tipo: "sucesso" | "info" | "erro" | "alerta" */
function announce(texto, tipo = "info", extra = null) {
  const fechar = el("button", {
    type: "button",
    class: "aviso__fechar",
    "aria-label": "Fechar aviso",
    text: "×",
    onClick: () => box.remove(),
  });
  const box = el("div", { class: `aviso aviso--${tipo}` }, el("p", {}, texto, extra ? " " : null, extra), fechar);
  avisos.replaceChildren(box);
  lastAnnounceAt = Date.now();
}

function clearAnnouncements() {
  avisos.replaceChildren();
}

// ---------------------------------------------------------------------------
// Datas (sem bibliotecas e sem deslocamento de fuso)
// ---------------------------------------------------------------------------

const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];
const MESES = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const MESES_LONGOS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "AAAA-MM-DD" -> { y, m, d, weekday } calculado em UTC (sem fuso local). */
function parseISODate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { y, m, d, weekday };
}

/** "qui., 27 de nov. · 19:00" (ano exibido só se diferente do atual). */
function formatDateTime(date, time) {
  const p = parseISODate(date);
  if (!p) return [date, time].filter(Boolean).join(" · ");
  const anoAtual = Number(todayISO().slice(0, 4));
  const ano = p.y !== anoAtual ? ` de ${p.y}` : "";
  const base = `${DIAS[p.weekday]}, ${p.d} de ${MESES[p.m - 1]}${ano}`;
  return time ? `${base} · ${time}` : base;
}

/** "quinta-feira, 27 de novembro de 2026" para o detalhe. */
function formatLongDate(date) {
  const p = parseISODate(date);
  if (!p) return String(date || "");
  const dias = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  return `${dias[p.weekday]}, ${p.d} de ${MESES_LONGOS[p.m - 1]} de ${p.y}`;
}

/** Data de hoje (AAAA-MM-DD) no fuso local do navegador. */
function todayISO() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${mm}-${dd}`;
}

function isPast(event) {
  return typeof event.date === "string" && event.date < todayISO();
}

function ordinal(n) {
  return `${n}º`;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields || null;
  }
}

const MENSAGENS_ERRO = {
  unauthenticated: "Você precisa entrar com o Discord para continuar.",
  invalid_origin: "Requisição bloqueada por origem inválida. Recarregue a página.",
  forbidden: "Você não tem permissão para esta ação.",
  not_found: "Evento não encontrado.",
  already_registered: "Você já está inscrito neste evento.",
  event_closed: "Este evento já aconteceu; não aceita mais inscrições.",
  not_registered: "Você não está inscrito neste evento.",
  validation: "Revise os campos destacados.",
};

async function api(path, { method = "GET", body } = {}) {
  const init = {
    method,
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError(0, "network", "Falha de rede. Verifique sua conexão e tente novamente.");
  }

  let data = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
  }

  if (!response.ok) {
    const code = (data && data.error) || `http_${response.status}`;
    const message =
      (data && data.message) ||
      MENSAGENS_ERRO[code] ||
      `Erro inesperado do servidor (HTTP ${response.status}).`;
    throw new ApiError(response.status, code, message, data && data.fields);
  }
  return data;
}

// ---------------------------------------------------------------------------
// Sessão / cabeçalho
// ---------------------------------------------------------------------------

function loginHref() {
  const next = "/" + (location.hash || "#/");
  return `/api/auth/discord?next=${encodeURIComponent(next)}`;
}

function loginButton(texto = "Entrar com Discord") {
  return el("a", { class: "botao botao--discord", href: loginHref(), text: texto });
}

async function loadMe() {
  try {
    state.me = await api("/api/me");
  } catch (err) {
    state.me = null;
    if (err.status !== 401) {
      announce(`Não foi possível verificar sua sessão: ${err.message}`, "alerta");
    }
  }
  renderUserArea();
}

function renderUserArea() {
  if (state.me === undefined) {
    userArea.replaceChildren();
    return;
  }
  if (!state.me) {
    userArea.replaceChildren(loginButton());
    return;
  }
  const nome = displayName(state.me);
  userArea.replaceChildren(
    avatar(state.me.avatar_url, nome),
    el("span", { class: "usuario__nome", title: nome, text: nome }),
    el("button", { type: "button", class: "botao botao--secundario botao--pequeno", text: "Sair", onClick: logout })
  );
}

async function logout(e) {
  const btn = e.currentTarget;
  btn.disabled = true;
  try {
    await api("/api/auth/logout", { method: "POST" });
    state.me = null;
    renderUserArea();
    announce("Você saiu da sua conta.", "info");
    if (state.scope === "mine") state.scope = "upcoming";
    route();
  } catch (err) {
    btn.disabled = false;
    announce(err.message, "erro");
  }
}

/** Trata 401 em ações: zera sessão e oferece login. */
function handleUnauthenticated() {
  state.me = null;
  renderUserArea();
  announce("Sua sessão expirou ou você não entrou.", "alerta", loginButton());
}

// ---------------------------------------------------------------------------
// Componentes de evento
// ---------------------------------------------------------------------------

function statusBadges(event) {
  const selos = [];
  if (event.my_status === "confirmed") {
    selos.push(el("span", { class: "selo selo--confirmado", text: "Confirmado" }));
  } else if (event.my_status === "waitlist") {
    const pos = event.my_position ? ` #${event.my_position}` : "";
    selos.push(el("span", { class: "selo selo--fila", text: `Na fila${pos}` }));
  }
  if (isPast(event)) {
    selos.push(el("span", { class: "selo selo--neutro", text: "Encerrado" }));
  } else if (event.spots_left <= 0) {
    selos.push(el("span", { class: "selo selo--lotado", text: "Lotado" }));
  } else {
    selos.push(el("span", { class: "selo selo--vagas", text: `Vagas: ${event.spots_left}` }));
  }
  if (event.is_creator) {
    selos.push(el("span", { class: "selo selo--neutro", text: "Organizador" }));
  }
  return el("div", { class: "selos" }, selos);
}

function capacityBar(event) {
  const cap = Math.max(1, Number(event.capacity) || 1);
  const conf = Math.max(0, Number(event.confirmed_count) || 0);
  const pct = Math.min(100, Math.round((conf / cap) * 100));
  const nivel = conf >= cap ? "lotacao--cheio" : pct >= 80 ? "lotacao--quase" : "";
  const fill = el("div", { class: "lotacao__preenchido" });
  fill.style.width = `${pct}%`;

  const fila = event.waitlist_count > 0 ? `${event.waitlist_count} na fila` : "";
  return el(
    "div",
    { class: `lotacao ${nivel}`.trim() },
    el(
      "div",
      { class: "lotacao__texto" },
      el("span", { text: `${conf}/${cap} confirmados` }),
      fila ? el("span", { text: fila }) : null
    ),
    el(
      "div",
      {
        class: "lotacao__barra",
        role: "progressbar",
        "aria-label": "Lotação do evento",
        "aria-valuemin": 0,
        "aria-valuemax": cap,
        "aria-valuenow": Math.min(conf, cap),
        "aria-valuetext": `${conf} de ${cap} vagas ocupadas`,
      },
      fill
    )
  );
}

function eventCard(event) {
  const href = `#/evento/${encodeURIComponent(event.id)}`;
  return el(
    "li",
    {},
    el(
      "article",
      { class: "cartao" },
      el("time", { class: "cartao__data", datetime: `${event.date}T${event.time}`, text: formatDateTime(event.date, event.time) }),
      el("h2", { class: "cartao__titulo" }, el("a", { href, text: event.title })),
      el("p", { class: "cartao__local" }, el("span", { class: "visualmente-oculto", text: "Local: " }), event.location),
      el("div", { class: "cartao__rodape" }, capacityBar(event), statusBadges(event))
    )
  );
}

// ---------------------------------------------------------------------------
// Tela: lista (#/)
// ---------------------------------------------------------------------------

async function renderList(token) {
  if (state.scope === "mine" && !state.me) state.scope = "upcoming";
  const logado = Boolean(state.me);

  const filtro = logado
    ? el(
        "div",
        { class: "filtro", role: "group", "aria-label": "Filtrar eventos" },
        el("button", {
          type: "button",
          "aria-pressed": String(state.scope === "upcoming"),
          text: "Todos",
          onClick: () => changeScope("upcoming"),
        }),
        el("button", {
          type: "button",
          "aria-pressed": String(state.scope === "mine"),
          text: "Meus eventos",
          onClick: () => changeScope("mine"),
        })
      )
    : null;

  const titulo = state.scope === "mine" ? "Meus eventos" : "Próximos eventos";
  const cabecalho = el(
    "div",
    { class: "cabecalho-pagina" },
    el("h1", { text: titulo }),
    el("div", { class: "acoes" }, filtro, el("a", { class: "botao", href: "#/novo", text: "Criar evento" }))
  );
  const conteudo = el("section", { "aria-labelledby": "lista-titulo", "aria-busy": "true" }, loadingView("Carregando eventos…"));
  cabecalho.querySelector("h1").id = "lista-titulo";
  setView(cabecalho, conteudo);

  const query = state.scope === "mine" ? "?scope=mine" : "";
  try {
    const data = await api(`/api/events${query}`);
    if (token !== renderToken) return;
    const events = (data && Array.isArray(data.events)) ? data.events : [];
    conteudo.removeAttribute("aria-busy");
    if (events.length === 0) {
      const vazio = state.scope === "mine"
        ? "Você ainda não criou nem se inscreveu em nenhum evento."
        : "Nenhum evento programado. Que tal criar o primeiro?";
      conteudo.replaceChildren(el("p", { class: "estado", text: vazio }));
      return;
    }
    conteudo.replaceChildren(el("ul", { class: "lista-eventos" }, events.map(eventCard)));
  } catch (err) {
    if (token !== renderToken) return;
    conteudo.removeAttribute("aria-busy");
    if (err.status === 401) {
      state.scope = "upcoming";
      handleUnauthenticated();
      return;
    }
    conteudo.replaceChildren(
      el("p", { class: "estado estado--erro", text: `Não foi possível carregar os eventos. ${err.message}` }),
      el("p", {}, el("button", { type: "button", class: "botao botao--secundario", text: "Tentar novamente", onClick: route }))
    );
  }
}

function changeScope(scope) {
  if (state.scope === scope) return;
  state.scope = scope;
  route();
}

// ---------------------------------------------------------------------------
// Tela: login exigido
// ---------------------------------------------------------------------------

function loginRequiredView(titulo, texto) {
  return el(
    "section",
    { class: "painel cartao-login" },
    el("h1", { text: titulo }),
    el("p", { text: texto }),
    el("div", { class: "acoes" }, loginButton(), el("a", { class: "botao botao--secundario", href: "#/", text: "Ver eventos" }))
  );
}

// ---------------------------------------------------------------------------
// Tela: criar evento (#/novo)
// ---------------------------------------------------------------------------

const CAMPOS = ["title", "location", "date", "time", "capacity", "description"];

function field({ name, label, input, dica }) {
  const id = `campo-${name}`;
  const erroId = `${id}-erro`;
  const dicaId = dica ? `${id}-dica` : null;
  input.id = id;
  input.name = name;
  input.setAttribute("aria-describedby", [dicaId, erroId].filter(Boolean).join(" "));
  return el(
    "div",
    { class: "campo" },
    el("label", { for: id, text: label }),
    input,
    dica ? el("span", { class: "dica", id: dicaId, text: dica }) : null,
    el("p", { class: "campo__erro", id: erroId })
  );
}

function renderNew() {
  if (!state.me) {
    setView(loginRequiredView("Criar evento", "Entre com sua conta do Discord para criar um evento."));
    return;
  }

  const hoje = todayISO();
  const erroGeral = el("p", { class: "erro-geral", role: "alert" });
  const enviar = el("button", { type: "submit", class: "botao", text: "Publicar evento" });

  const form = el(
    "form",
    { class: "formulario" },
    erroGeral,
    field({
      name: "title",
      label: "Título",
      input: el("input", { type: "text", required: true, minlength: 3, maxlength: 120, autocomplete: "off" }),
      dica: "De 3 a 120 caracteres.",
    }),
    field({
      name: "location",
      label: "Local",
      input: el("input", { type: "text", required: true, minlength: 2, maxlength: 120, placeholder: "Ex.: Bloco B, sala 204" }),
    }),
    el(
      "div",
      { class: "linha" },
      field({ name: "date", label: "Data", input: el("input", { type: "date", required: true, min: hoje }) }),
      field({ name: "time", label: "Horário", input: el("input", { type: "time", required: true }) }),
      field({
        name: "capacity",
        label: "Capacidade máxima",
        input: el("input", { type: "number", required: true, min: 1, max: 10000, step: 1, inputmode: "numeric" }),
      })
    ),
    field({
      name: "description",
      label: "Descrição (opcional)",
      input: el("textarea", { maxlength: 2000, rows: 5 }),
      dica: "Até 2000 caracteres.",
    }),
    el("div", { class: "acoes" }, enviar, el("a", { class: "botao botao--secundario", href: "#/", text: "Cancelar" }))
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors(form, erroGeral);
    if (!form.reportValidity()) return;

    const fd = new FormData(form);
    const body = {
      title: String(fd.get("title") || "").trim(),
      location: String(fd.get("location") || "").trim(),
      date: String(fd.get("date") || ""),
      time: String(fd.get("time") || ""),
      capacity: Number(fd.get("capacity")),
    };
    const descricao = String(fd.get("description") || "").trim();
    if (descricao) body.description = descricao;

    enviar.disabled = true;
    enviar.textContent = "Publicando…";
    try {
      const data = await api("/api/events", { method: "POST", body });
      announce("Evento criado com sucesso.", "sucesso");
      location.hash = `#/evento/${encodeURIComponent(data.event.id)}`;
    } catch (err) {
      enviar.disabled = false;
      enviar.textContent = "Publicar evento";
      if (err.status === 401) {
        handleUnauthenticated();
        erroGeral.textContent = "Entre com o Discord para publicar o evento.";
        return;
      }
      if (err.status === 400 && err.fields) {
        showFieldErrors(form, erroGeral, err);
        return;
      }
      erroGeral.textContent = err.message;
    }
  });

  setView(el("h1", { text: "Criar evento" }), form);
}

function clearFieldErrors(form, erroGeral) {
  erroGeral.textContent = "";
  for (const nome of CAMPOS) {
    const input = form.elements.namedItem(nome);
    if (input) input.removeAttribute("aria-invalid");
    const erro = form.querySelector(`#campo-${nome}-erro`);
    if (erro) erro.textContent = "";
  }
}

function showFieldErrors(form, erroGeral, err) {
  let primeiro = null;
  const desconhecidos = [];
  for (const [nome, motivo] of Object.entries(err.fields)) {
    const input = CAMPOS.includes(nome) ? form.elements.namedItem(nome) : null;
    const erro = input ? form.querySelector(`#campo-${nome}-erro`) : null;
    if (input && erro) {
      input.setAttribute("aria-invalid", "true");
      erro.textContent = String(motivo);
      primeiro = primeiro || input;
    } else {
      desconhecidos.push(`${nome}: ${motivo}`);
    }
  }
  erroGeral.textContent = [err.message || MENSAGENS_ERRO.validation, ...desconhecidos].join(" ");
  if (primeiro) primeiro.focus();
}

// ---------------------------------------------------------------------------
// Tela: detalhe (#/evento/:id)
// ---------------------------------------------------------------------------

async function renderDetail(id, token, { silent = false } = {}) {
  if (!silent) setView(loadingView("Carregando evento…"));
  try {
    const data = await api(`/api/events/${encodeURIComponent(id)}`);
    if (token !== renderToken) return;
    state.detail = {
      event: data.event,
      confirmed: Array.isArray(data.confirmed) ? data.confirmed : [],
      waitlist: Array.isArray(data.waitlist) ? data.waitlist : [],
    };
    drawDetail();
  } catch (err) {
    if (token !== renderToken) return;
    const titulo = err.status === 404 ? "Evento não encontrado" : "Erro ao carregar o evento";
    const texto = err.status === 404 ? "Este evento não existe ou foi excluído pelo organizador." : err.message;
    setView(
      el("a", { class: "voltar", href: "#/", text: "← Voltar para eventos" }),
      el("section", { class: "estado estado--erro" }, el("h1", { text: titulo }), el("p", { text: texto })),
      err.status === 404 ? null : el("p", {}, el("button", { type: "button", class: "botao botao--secundario", text: "Tentar novamente", onClick: route }))
    );
  }
}

/** Desenha o detalhe a partir de state.detail (sem buscar na API). */
function drawDetail() {
  const { event, confirmed, waitlist } = state.detail;
  const criadorNome = event.creator ? displayName(event.creator) : "—";

  const info = el(
    "dl",
    { class: "info" },
    el("dt", { text: "Data" }),
    el("dd", {}, el("time", { datetime: event.date, text: formatLongDate(event.date) })),
    el("dt", { text: "Horário" }),
    el("dd", {}, el("time", { datetime: event.time, text: event.time })),
    el("dt", { text: "Local" }),
    el("dd", { text: event.location }),
    el("dt", { text: "Capacidade" }),
    el("dd", { text: `${event.capacity} ${event.capacity === 1 ? "vaga" : "vagas"}` }),
    el("dt", { text: "Organizador" }),
    el(
      "dd",
      {},
      el(
        "span",
        { class: "criador" },
        event.creator ? avatar(event.creator.avatar_url, criadorNome, "avatar--pequeno") : null,
        el("span", { text: criadorNome })
      )
    )
  );

  const principal = el(
    "article",
    { class: "painel detalhe__principal" },
    el("p", { class: "cartao__data", text: formatDateTime(event.date, event.time) }),
    el("h1", { text: event.title }),
    statusBadges(event),
    info,
    capacityBar(event),
    event.description ? el("div", { class: "descricao" }, el("h2", { class: "visualmente-oculto", text: "Descrição" }), el("p", { text: event.description })) : null,
    actionsPanel(event)
  );

  const listaConfirmados = confirmed.length
    ? el("ul", { class: "pessoas" }, confirmed.map((p) => personItem(p)))
    : el("p", { class: "nota", text: "Ninguém confirmou presença ainda." });

  const listaFila = waitlist.length
    ? el("ol", { class: "pessoas" }, waitlist.map((p, i) => personItem(p, p.position || i + 1)))
    : el("p", { class: "nota", text: "A fila de espera está vazia." });

  const painelConfirmados = el(
    "section",
    { class: "painel", "aria-labelledby": "titulo-confirmados" },
    el("h2", { id: "titulo-confirmados", text: `Confirmados (${event.confirmed_count}/${event.capacity})` }),
    listaConfirmados
  );
  const painelFila = el(
    "section",
    { class: "painel", "aria-labelledby": "titulo-fila" },
    el("h2", { id: "titulo-fila", text: `Fila de espera (${event.waitlist_count})` }),
    listaFila
  );

  setView(
    el("a", { class: "voltar", href: "#/", text: "← Voltar para eventos" }),
    el("div", { class: "detalhe" }, principal, painelConfirmados, painelFila)
  );
}

function personItem(person, position) {
  const nome = displayName(person);
  const souEu = state.me && person.user_id === state.me.user_id;
  return el(
    "li",
    { class: souEu ? "pessoa pessoa--eu" : "pessoa" },
    position ? el("span", { class: "pessoa__posicao", "aria-label": `Posição ${position}`, text: ordinal(position) }) : null,
    avatar(person.avatar_url, nome),
    el("span", { class: "pessoa__nome", title: nome, text: nome }),
    souEu ? el("span", { class: "pessoa__tag", text: "(você)" }) : null
  );
}

function actionsPanel(event) {
  const acoes = el("div", { class: "acoes" });
  const notas = [];
  const encerrado = isPast(event);

  if (!state.me) {
    if (!encerrado) {
      acoes.append(loginButton("Entrar com Discord para confirmar presença"));
    }
  } else if (event.my_status === "confirmed") {
    acoes.append(actionButton("Cancelar inscrição", "botao--perigo", () => cancelRsvp(event)));
    notas.push(el("p", { class: "nota", text: "Sua presença está confirmada." }));
  } else if (event.my_status === "waitlist") {
    acoes.append(actionButton("Sair da fila", "botao--perigo", () => cancelRsvp(event)));
    notas.push(el("p", { class: "nota nota--alerta", text: `Você é o ${ordinal(event.my_position || "?")} na fila de espera.` }));
  } else if (!encerrado) {
    if (event.spots_left > 0) {
      acoes.append(actionButton("Confirmar presença", "", () => doRsvp(event)));
    } else {
      acoes.append(actionButton("Entrar na fila de espera", "", () => doRsvp(event)));
      notas.push(el("p", { class: "nota nota--alerta", text: "Lotado — você entrará na fila de espera." }));
    }
  }

  if (encerrado) {
    notas.push(el("p", { class: "nota", text: "Este evento já aconteceu; inscrições encerradas." }));
  }

  acoes.append(el("button", { type: "button", class: "botao botao--secundario", text: "Copiar link do evento", onClick: () => copyLink(event) }));

  if (event.is_creator) {
    acoes.append(actionButton("Excluir evento", "botao--perigo", () => deleteEvent(event)));
  }

  return el("div", { class: "descricao" }, el("h2", { class: "visualmente-oculto", text: "Ações" }), acoes, notas);
}

function actionButton(texto, extraClass, handler) {
  const btn = el("button", { type: "button", class: `botao ${extraClass}`.trim(), text: texto });
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    btn.setAttribute("aria-busy", "true");
    try {
      await handler();
    } finally {
      if (btn.isConnected) {
        btn.disabled = false;
        btn.removeAttribute("aria-busy");
      }
    }
  });
  return btn;
}

async function doRsvp(event) {
  try {
    const data = await api(`/api/events/${encodeURIComponent(event.id)}/rsvp`, { method: "POST" });
    if (data.status === "waitlist") {
      announce(`Evento lotado: você é o ${ordinal(data.position || data.event.my_position || "?")} na fila de espera.`, "alerta");
    } else {
      announce("Presença confirmada! Até lá.", "sucesso");
    }
    await refreshAfterChange(data.event);
  } catch (err) {
    handleActionError(err, event);
  }
}

async function cancelRsvp(event) {
  const estavaNaFila = event.my_status === "waitlist";
  // Guarda a fila atual para descobrir o nome de quem for promovido.
  const filaAntes = state.detail ? state.detail.waitlist : [];
  try {
    const data = await api(`/api/events/${encodeURIComponent(event.id)}/rsvp`, { method: "DELETE" });
    let texto = estavaNaFila ? "Você saiu da fila de espera." : "Sua inscrição foi cancelada.";
    if (data.promoted_user_id) {
      const promovido = filaAntes.find((p) => p.user_id === data.promoted_user_id);
      const nome = promovido ? displayName(promovido) : "O primeiro da fila";
      texto += ` ${nome} foi promovido da fila.`;
    }
    announce(texto, "info");
    await refreshAfterChange(data.event);
  } catch (err) {
    handleActionError(err, event);
  }
}

/** Re-renderiza já com o event retornado e depois atualiza as listas. */
async function refreshAfterChange(updatedEvent) {
  if (updatedEvent && state.detail && state.detail.event.id === updatedEvent.id) {
    state.detail.event = updatedEvent;
    drawDetail();
  }
  const id = updatedEvent ? updatedEvent.id : state.detail && state.detail.event.id;
  if (id !== undefined && id !== null) await renderDetail(id, renderToken, { silent: true });
}

function handleActionError(err, event) {
  if (err.status === 401) {
    handleUnauthenticated();
    if (state.detail) drawDetail();
    return;
  }
  if (err.status === 404 && err.code === "not_found") {
    announce(err.message, "erro");
    location.hash = "#/";
    return;
  }
  announce(err.message, "erro");
  // 409 (já inscrito, encerrado, não inscrito): recarrega para mostrar o estado real.
  if (err.status === 409 || err.code === "not_registered") {
    renderDetail(event.id, renderToken, { silent: true });
  }
}

async function deleteEvent(event) {
  const ok = window.confirm(`Excluir o evento "${event.title}"? Esta ação não pode ser desfeita e remove todas as inscrições.`);
  if (!ok) return;
  try {
    await api(`/api/events/${encodeURIComponent(event.id)}`, { method: "DELETE" });
    announce("Evento excluído.", "sucesso");
    location.hash = "#/";
  } catch (err) {
    handleActionError(err, event);
  }
}

async function copyLink(event) {
  const url = `${location.origin}/#/evento/${encodeURIComponent(event.id)}`;
  try {
    if (!navigator.clipboard || !window.isSecureContext) throw new Error("indisponível");
    await navigator.clipboard.writeText(url);
    announce("Link do evento copiado para a área de transferência.", "sucesso");
  } catch {
    announce("Não foi possível copiar automaticamente. Copie o link:", "alerta", el("code", { text: url }));
  }
}

// ---------------------------------------------------------------------------
// Roteamento por hash
// ---------------------------------------------------------------------------

function parseRoute() {
  const raw = (location.hash || "#/").slice(1) || "/";
  const path = raw.split("?")[0];
  if (path === "/" || path === "") return { name: "list" };
  if (path === "/novo") return { name: "new" };
  const m = /^\/evento\/([^/]+)\/?$/.exec(path);
  if (m) return { name: "detail", id: decodeURIComponent(m[1]) };
  return { name: "notfound" };
}

function updateNav(routeName) {
  for (const link of document.querySelectorAll(".topo__nav a")) {
    const alvo = link.getAttribute("href") === "#/novo" ? "new" : "list";
    if (alvo === routeName) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
}

async function route() {
  const token = ++renderToken;
  const r = parseRoute();
  updateNav(r.name);
  renderUserArea(); // atualiza o ?next= do botão de login

  if (state.me === undefined) {
    setView(loadingView());
    await loadMe();
    if (token !== renderToken) return;
  }

  switch (r.name) {
    case "list":
      document.title = "Eventos RSVP";
      await renderList(token);
      break;
    case "new":
      document.title = "Criar evento · Eventos RSVP";
      renderNew();
      break;
    case "detail":
      document.title = "Evento · Eventos RSVP";
      await renderDetail(r.id, token);
      if (token === renderToken && state.detail && String(state.detail.event.id) === String(r.id)) {
        document.title = `${state.detail.event.title} · Eventos RSVP`;
      }
      break;
    default:
      document.title = "Página não encontrada · Eventos RSVP";
      setView(
        el("section", { class: "estado" }, el("h1", { text: "Página não encontrada" }), el("p", {}, el("a", { href: "#/", text: "Ir para a lista de eventos" })))
      );
  }
}

// ---------------------------------------------------------------------------
// Erro de login vindo do callback (?erro=<codigo>)
// ---------------------------------------------------------------------------

const ERROS_LOGIN = {
  access_denied: "Você cancelou a autorização no Discord.",
  invalid_state: "A tentativa de login expirou ou é inválida. Tente novamente.",
  state_mismatch: "A tentativa de login expirou ou é inválida. Tente novamente.",
  missing_code: "O Discord não retornou o código de autorização.",
  token_exchange: "Não foi possível validar o login com o Discord.",
  token_exchange_failed: "Não foi possível validar o login com o Discord.",
  user_fetch: "Não foi possível obter seu perfil no Discord.",
  user_fetch_failed: "Não foi possível obter seu perfil no Discord.",
  oauth_failed: "Falha no login com o Discord.",
  server_error: "Erro interno durante o login. Tente novamente mais tarde.",
};

function handleLoginError() {
  const params = new URLSearchParams(location.search);
  const codigo = params.get("erro");
  if (!codigo) return;
  const texto = ERROS_LOGIN[codigo] || "Não foi possível entrar com o Discord.";
  announce(`${texto} (código: ${codigo.slice(0, 60)})`, "erro");
  params.delete("erro");
  const qs = params.toString();
  history.replaceState(null, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
}

// ---------------------------------------------------------------------------
// Inicialização
// ---------------------------------------------------------------------------

function init() {
  // O link "Pular para o conteúdo" não pode alterar o hash (roteamento).
  const pular = document.querySelector(".pular");
  if (pular) {
    pular.addEventListener("click", (e) => {
      e.preventDefault();
      app.focus();
    });
  }

  window.addEventListener("hashchange", () => {
    // Avisos disparados logo antes de navegar (criar/excluir) sobrevivem à troca de tela.
    if (Date.now() - lastAnnounceAt > 1500) clearAnnouncements();
    route().then(focusHeading);
  });

  handleLoginError();
  route();
}

init();
