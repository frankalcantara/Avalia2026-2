/*
 * Achados e Perdidos do Campus — Projeto #34 · Chave P26-2B-DEE2-E5F5-044F-D681
 * JavaScript puro (sem frameworks). Todo dado vindo da API entra no DOM via
 * createElement/textContent (nunca como HTML bruto).
 */
"use strict";

/* =====================================================================
 * Constantes e rótulos
 * ===================================================================== */
const TIPOS = {
  perdi: { rotulo: "Perdi", icone: "❓" },
  encontrei: { rotulo: "Encontrei", icone: "📦" },
};
const CATEGORIAS = {
  eletronicos: { rotulo: "Eletrônicos", icone: "💻" },
  documentos: { rotulo: "Documentos", icone: "🪪" },
  garrafas: { rotulo: "Garrafas", icone: "🥤" },
  vestuario: { rotulo: "Vestuário", icone: "👕" },
};
const STATUS_ITEM = {
  aberto: "Aberto",
  em_devolucao: "Em devolução",
  encerrado: "Encerrado",
};
const STATUS_REIV = {
  pendente: "Pendente",
  aceita: "Aceita",
  recusada: "Recusada",
  cancelada: "Cancelada",
  concluida: "Devolvido (concluída)",
};
const ERROS_AUTH = {
  cancelado: "Você cancelou o login com o Discord. Tente novamente quando quiser.",
  state_invalido: "A tentativa de login expirou ou é inválida. Clique em “Entrar com Discord” de novo.",
  parametros_ausentes: "O Discord não devolveu os dados esperados. Tente entrar novamente.",
  discord_erro: "O Discord recusou o login. Tente novamente em instantes.",
  discord_nao_configurado: "O login com Discord ainda não foi configurado neste site.",
  troca_token_falhou: "Não foi possível concluir o login com o Discord. Tente novamente.",
  perfil_falhou: "Não conseguimos ler seu perfil do Discord. Tente novamente.",
  perfil_invalido: "O perfil retornado pelo Discord é inválido. Tente novamente.",
};

/* Opções dos filtros (valor -> rótulo); "todos" sempre primeiro. */
const OPCOES_FILTRO = {
  tipo: [
    { valor: "todos", rotulo: "Todos" },
    { valor: "perdi", rotulo: "Perdi", classe: "chip-perdi" },
    { valor: "encontrei", rotulo: "Encontrei", classe: "chip-encontrei" },
  ],
  categoria: [
    { valor: "todas", rotulo: "Todas" },
    ...Object.entries(CATEGORIAS).map(([valor, c]) => ({ valor, rotulo: c.rotulo, icone: c.icone })),
  ],
  status: [
    { valor: "ativos", rotulo: "Não encerrados" },
    { valor: "aberto", rotulo: "Abertos" },
    { valor: "em_devolucao", rotulo: "Em devolução" },
    { valor: "encerrado", rotulo: "Encerrados" },
    { valor: "todos", rotulo: "Todos" },
  ],
};
const FILTROS_PADRAO = Object.freeze({ tipo: "todos", categoria: "todas", status: "ativos", q: "", meus: false });

/* =====================================================================
 * Estado único da aplicação
 * ===================================================================== */
const estado = {
  user: null,
  discordConfigurado: true,
  itens: [],
  carregandoItens: true,
  erroItens: null,
  filtros: { ...FILTROS_PADRAO },
  aba: "vitrine",
  reivindicacoes: null,
  carregandoReiv: false,
  erroReiv: null,
  itemReivindicando: null,
  ocupado: new Set(), // ações em andamento (evita clique duplo)
};

/* cache de cards (id -> elemento) e índice de busca (id -> texto normalizado) */
let cacheCards = new Map();
let indiceBusca = new Map();

const $ = (id) => document.getElementById(id);

/* =====================================================================
 * Utilitários
 * ===================================================================== */
function el(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "text") e.textContent = v;
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    e.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return e;
}

/** Normaliza para busca: minúsculas, sem acentos. */
function normalizar(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** "2026-11-05" -> "05/11/2026" (sem passar por Date para não sofrer com fuso). */
function formatarData(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso || "";
}

/** "2026-11-05 14:03:00" (UTC do SQLite) -> "05/11/2026 11:03" no horário local. */
function formatarDataHora(sqlUtc) {
  if (!sqlUtc) return "";
  const d = new Date(sqlUtc.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return formatarData(sqlUtc);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function dataLocalISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function plural(n, singular, pluralTxt) {
  return `${n} ${n === 1 ? singular : pluralTxt}`;
}

function avatar(url, classe = "avatar") {
  const img = el("img", { class: classe, alt: "", width: 36, height: 36, loading: "lazy", decoding: "async", referrerpolicy: "no-referrer" });
  img.src = url || "https://cdn.discordapp.com/embed/avatars/0.png";
  img.addEventListener("error", () => { img.style.visibility = "hidden"; }, { once: true });
  return img;
}

/** Ícone decorativo (oculto de leitores de tela). */
function icone(txt) {
  return el("span", { "aria-hidden": "true", text: txt });
}

/* =====================================================================
 * API
 * ===================================================================== */
class ErroApi extends Error {
  constructor(status, dados) {
    super((dados && dados.message) || `Erro ${status} ao falar com o servidor.`);
    this.status = status;
    this.codigo = dados && dados.error;
    this.details = dados && typeof dados.details === "object" ? dados.details : null;
  }
}

async function api(caminho, { method = "GET", body } = {}) {
  const opts = { method, credentials: "same-origin", headers: { Accept: "application/json" } };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(caminho, opts);
  } catch {
    throw new ErroApi(0, { message: "Sem conexão com o servidor. Verifique sua internet e tente novamente." });
  }
  let dados = null;
  try { dados = await res.json(); } catch { /* resposta sem JSON */ }
  if (!res.ok || (dados && dados.ok === false)) {
    const e = new ErroApi(res.status, dados);
    if (res.status === 401 && estado.user) {
      // sessão expirou: volta para o modo deslogado
      estado.user = null;
      renderUsuario();
    }
    throw e;
  }
  return dados || {};
}

/* =====================================================================
 * Toasts e confirmação
 * ===================================================================== */
function toast(mensagem, tipo = "info", tempo = 5000) {
  const caixa = $("toasts");
  const fechar = el("button", { type: "button", "aria-label": "Fechar mensagem", text: "×" });
  const t = el("div", { class: `toast toast-${tipo}`, role: tipo === "erro" ? "alert" : "status" }, el("p", { text: mensagem }), fechar);
  const remover = () => t.remove();
  fechar.addEventListener("click", remover);
  caixa.append(t);
  if (tempo) setTimeout(remover, tipo === "erro" ? tempo + 3000 : tempo);
  while (caixa.children.length > 4) caixa.firstElementChild.remove();
}

/** Diálogo de confirmação próprio (<dialog>, sem caixas nativas do navegador). Resolve true/false. */
function confirmar({ titulo, texto, botao = "Confirmar", perigo = false }) {
  const dlg = $("dlgConfirmar");
  $("dlgConfTitulo").textContent = titulo;
  $("dlgConfTexto").textContent = texto;
  const sim = $("dlgConfSim");
  sim.textContent = botao;
  sim.className = `btn ${perigo ? "btn-perigo" : "btn-primario"}`;
  dlg.returnValue = "";
  return new Promise((resolve) => {
    dlg.addEventListener("close", () => resolve(dlg.returnValue === "sim"), { once: true });
    dlg.showModal();
    $("dlgConfNao").focus();
  });
}

/** Executa uma ação de escrita com trava contra clique duplo. */
async function executar(chave, botao, fn) {
  if (estado.ocupado.has(chave)) return;
  estado.ocupado.add(chave);
  const textoOriginal = botao ? botao.textContent : "";
  if (botao) { botao.disabled = true; botao.textContent = "Aguarde…"; }
  try {
    await fn();
  } catch (e) {
    toast(e.message || "Algo deu errado.", "erro");
  } finally {
    estado.ocupado.delete(chave);
    if (botao && botao.isConnected) { botao.disabled = false; botao.textContent = textoOriginal; }
  }
}

/* =====================================================================
 * Cabeçalho / usuário
 * ===================================================================== */
function linkLogin(texto = "Entrar com Discord", classe = "btn btn-discord") {
  const a = el("a", { class: classe, href: "/api/auth/discord" }, icone("🎮"), " ", texto);
  if (!estado.discordConfigurado) {
    a.addEventListener("click", (ev) => {
      ev.preventDefault();
      toast("O login com Discord ainda não foi configurado neste site (DISCORD_CLIENT_ID/SECRET).", "erro");
    });
  }
  return a;
}

function renderUsuario() {
  const area = $("areaUsuario");
  area.replaceChildren();
  if (!estado.user) {
    area.append(linkLogin());
  } else {
    const u = estado.user;
    const img = avatar(u.avatar_url);
    img.alt = `Avatar de ${u.nome}`;
    const nome = el("span", { class: "usuario-nome" }, el("strong", { text: u.nome }), el("span", { text: `@${u.username}` }));
    const sair = el("button", { type: "button", class: "btn btn-secundario btn-pequeno", text: "Sair" });
    sair.addEventListener("click", () => sairDaConta(sair));
    area.append(el("div", { class: "usuario-perfil", title: `Conectado como @${u.username}` }, img, nome), sair);
  }
  $("filtroMeusWrap").hidden = !estado.user;
  if (!estado.user && estado.filtros.meus) {
    estado.filtros.meus = false;
    $("filtroMeus").checked = false;
  }
}

async function sairDaConta(botao) {
  await executar("logout", botao, async () => {
    await api("/api/auth/logout", { method: "POST", body: {} });
    estado.user = null;
    estado.reivindicacoes = null;
    renderUsuario();
    toast("Você saiu da sua conta.", "sucesso");
    await carregarItens();
    if (estado.aba === "reivindicacoes") renderReivindicacoes();
  });
}

function mostrarErroAuth() {
  const params = new URLSearchParams(location.search);
  const codigo = params.get("auth_error");
  if (codigo === null) return;
  const aviso = $("avisoAuth");
  const fechar = el("button", { type: "button", class: "btn btn-link btn-pequeno", text: "Fechar" });
  fechar.addEventListener("click", () => { aviso.hidden = true; });
  aviso.replaceChildren(
    el("p", {}, el("strong", { text: "Não foi possível entrar. " }), ERROS_AUTH[codigo] || "Ocorreu um erro no login com o Discord. Tente novamente."),
    fechar
  );
  aviso.hidden = false;
  params.delete("auth_error");
  const qs = params.toString();
  history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash);
}

/* =====================================================================
 * Vitrine: carregamento e filtros cruzados no cliente
 * ===================================================================== */
async function carregarItens() {
  estado.carregandoItens = true;
  estado.erroItens = null;
  renderItens();
  try {
    const dados = await api("/api/items");
    estado.itens = Array.isArray(dados.itens) ? dados.itens : [];
  } catch (e) {
    estado.erroItens = e.message;
  } finally {
    estado.carregandoItens = false;
    reconstruirCache();
    renderVitrine();
    renderContadorPendentes();
  }
}

function reconstruirCache() {
  cacheCards = new Map();
  indiceBusca = new Map();
  for (const item of estado.itens) {
    indiceBusca.set(item.id, normalizar([
      item.titulo, item.local, item.descricao, item.autor && item.autor.nome,
      CATEGORIAS[item.categoria] && CATEGORIAS[item.categoria].rotulo, TIPOS[item.tipo] && TIPOS[item.tipo].rotulo,
    ].join(" \u0001 ")));
  }
}

/** Testa um item contra os filtros, opcionalmente ignorando uma dimensão (para as contagens cruzadas). */
function passa(item, f, ignorar, termos) {
  if (ignorar !== "tipo" && f.tipo !== "todos" && item.tipo !== f.tipo) return false;
  if (ignorar !== "categoria" && f.categoria !== "todas" && item.categoria !== f.categoria) return false;
  if (ignorar !== "status") {
    if (f.status === "ativos" && item.status === "encerrado") return false;
    if (f.status !== "ativos" && f.status !== "todos" && item.status !== f.status) return false;
  }
  if (ignorar !== "meus" && f.meus && !item.eh_meu) return false;
  if (termos.length) {
    const txt = indiceBusca.get(item.id) || "";
    for (const t of termos) if (!txt.includes(t)) return false;
  }
  return true;
}

function termosBusca() {
  return normalizar(estado.filtros.q).split(/\s+/).filter(Boolean);
}

/** Calcula contagens de cada opção considerando os demais filtros ativos. */
function calcularContagens() {
  const f = estado.filtros;
  const termos = termosBusca();
  const c = {
    tipo: { todos: 0, perdi: 0, encontrei: 0 },
    categoria: { todas: 0, eletronicos: 0, documentos: 0, garrafas: 0, vestuario: 0 },
    status: { ativos: 0, aberto: 0, em_devolucao: 0, encerrado: 0, todos: 0 },
    meus: 0,
  };
  for (const item of estado.itens) {
    if (passa(item, f, "tipo", termos)) { c.tipo.todos++; c.tipo[item.tipo]++; }
    if (passa(item, f, "categoria", termos)) { c.categoria.todas++; c.categoria[item.categoria]++; }
    if (passa(item, f, "status", termos)) {
      c.status.todos++;
      c.status[item.status]++;
      if (item.status !== "encerrado") c.status.ativos++;
    }
    if (item.eh_meu && passa(item, f, "meus", termos)) c.meus++;
  }
  return c;
}

/** Monta os chips de filtro uma única vez (depois só os números mudam, preservando o foco). */
function montarFiltros() {
  for (const grupo of ["tipo", "categoria", "status"]) {
    const alvo = $(`filtro${grupo[0].toUpperCase()}${grupo.slice(1)}`);
    alvo.replaceChildren();
    for (const op of OPCOES_FILTRO[grupo]) {
      const id = `f-${grupo}-${op.valor}`;
      const input = el("input", { type: "radio", name: `filtro-${grupo}`, id, value: op.valor });
      input.checked = estado.filtros[grupo] === op.valor;
      input.addEventListener("change", () => {
        estado.filtros[grupo] = op.valor;
        renderVitrine();
      });
      const contagem = el("span", { class: "chip-contagem", id: `${id}-n`, text: "0" });
      const label = el("label", { for: id }, op.icone ? icone(op.icone) : null, el("span", { text: op.rotulo }), contagem);
      alvo.append(el("div", { class: `chip ${op.classe || ""}`.trim(), dataset: { grupo, valor: op.valor } }, input, label));
    }
  }
}

function renderFiltros(contagens) {
  for (const grupo of ["tipo", "categoria", "status"]) {
    for (const op of OPCOES_FILTRO[grupo]) {
      const id = `f-${grupo}-${op.valor}`;
      const n = contagens[grupo][op.valor] || 0;
      const nEl = $(`${id}-n`);
      if (nEl) {
        nEl.textContent = String(n);
        nEl.setAttribute("aria-label", plural(n, "item", "itens"));
      }
      const input = $(id);
      if (input) {
        input.checked = estado.filtros[grupo] === op.valor;
        input.closest(".chip").classList.toggle("vazio", n === 0);
      }
    }
  }
  const nMeus = $("contagemMeus");
  nMeus.textContent = String(contagens.meus);
  nMeus.setAttribute("aria-label", plural(contagens.meus, "item", "itens"));
  $("filtroMeus").checked = estado.filtros.meus;
  if ($("busca").value !== estado.filtros.q) $("busca").value = estado.filtros.q;

  const f = estado.filtros;
  const alterado = f.tipo !== FILTROS_PADRAO.tipo || f.categoria !== FILTROS_PADRAO.categoria ||
    f.status !== FILTROS_PADRAO.status || f.q.trim() !== "" || f.meus;
  $("btnLimparFiltros").hidden = !alterado;
}

function itensFiltrados() {
  const termos = termosBusca();
  return estado.itens.filter((item) => passa(item, estado.filtros, null, termos));
}

/** Render da vitrine: filtros + grade (sem request, a cada tecla). */
function renderVitrine() {
  renderFiltros(calcularContagens());
  renderItens();
}

function renderItens() {
  const lista = $("listaItens");
  const resultado = $("resultadoContagem");

  if (estado.carregandoItens) {
    lista.setAttribute("aria-busy", "true");
    if (!estado.itens.length) lista.replaceChildren(el("p", { class: "estado-carregando", text: "Carregando itens…" }));
    resultado.textContent = "Carregando…";
    return;
  }
  lista.setAttribute("aria-busy", "false");

  if (estado.erroItens) {
    const tentar = el("button", { type: "button", class: "btn btn-secundario", text: "Tentar novamente" });
    tentar.addEventListener("click", carregarItens);
    lista.replaceChildren(el("div", { class: "estado-vazio" },
      el("span", { class: "estado-icone", "aria-hidden": "true", text: "⚠️" }),
      el("strong", { text: "Não foi possível carregar os itens." }),
      el("p", { text: estado.erroItens }), tentar));
    resultado.textContent = "";
    return;
  }

  const visiveis = itensFiltrados();
  resultado.textContent = visiveis.length === 1 ? "1 item encontrado" : `${visiveis.length} itens encontrados`;

  if (!estado.itens.length) {
    const vazio = el("div", { class: "estado-vazio" },
      el("span", { class: "estado-icone", "aria-hidden": "true", text: "📭" }),
      el("strong", { text: "Ainda não há itens na vitrine." }),
      el("p", { text: "Seja a primeira pessoa a cadastrar um objeto perdido ou encontrado no campus." }));
    const btn = el("button", { type: "button", class: "btn btn-primario", text: "Cadastrar item" });
    btn.addEventListener("click", abrirCadastro);
    vazio.append(btn);
    lista.replaceChildren(vazio);
    return;
  }

  if (!visiveis.length) {
    const limpar = el("button", { type: "button", class: "btn btn-secundario", text: "Limpar filtros" });
    limpar.addEventListener("click", limparFiltros);
    lista.replaceChildren(el("div", { class: "estado-vazio" },
      el("span", { class: "estado-icone", "aria-hidden": "true", text: "🔍" }),
      el("strong", { text: "Nenhum item encontrado com esses filtros." }),
      el("p", { text: "Tente outra busca ou remova alguns filtros." }), limpar));
    return;
  }

  const frag = document.createDocumentFragment();
  for (const item of visiveis) {
    let card = cacheCards.get(item.id);
    if (!card) { card = criarCardItem(item); cacheCards.set(item.id, card); }
    frag.append(card);
  }
  lista.replaceChildren(frag);
}

function limparFiltros() {
  estado.filtros = { ...FILTROS_PADRAO };
  renderVitrine();
  $("busca").focus();
}

/* =====================================================================
 * Card de item
 * ===================================================================== */
function criarCardItem(item) {
  const tipo = TIPOS[item.tipo] || { rotulo: item.tipo, icone: "" };
  const cat = CATEGORIAS[item.categoria] || { rotulo: item.categoria, icone: "📁" };
  const tituloId = `item-${item.id}-titulo`;

  const etiquetas = el("div", { class: "card-etiquetas" },
    el("span", { class: `etiqueta etiqueta-${item.tipo}` }, icone(tipo.icone), tipo.rotulo),
    el("span", { class: "etiqueta etiqueta-categoria" }, icone(cat.icone), cat.rotulo),
    el("span", { class: `etiqueta etiqueta-${item.status}` }, STATUS_ITEM[item.status] || item.status),
    item.eh_meu ? el("span", { class: "etiqueta etiqueta-meu", text: "Meu item" }) : null
  );

  const meta = el("dl", { class: "card-meta" },
    el("div", {}, el("dt", {}, icone("📍"), " Local:"), el("dd", { text: item.local })),
    el("div", {}, el("dt", {}, icone("📅"), item.tipo === "perdi" ? " Perdido em:" : " Encontrado em:"),
      el("dd", {}, el("time", { datetime: item.data_ocorrencia, text: formatarData(item.data_ocorrencia) })))
  );

  const desc = el("p", { class: "card-descricao", text: item.descricao });
  let verMais = null;
  if (item.descricao && (item.descricao.length > 220 || item.descricao.split("\n").length > 5)) {
    verMais = el("button", { type: "button", class: "btn btn-link btn-pequeno", "aria-expanded": "false", text: "Ver descrição completa" });
    verMais.addEventListener("click", () => {
      const aberto = desc.classList.toggle("expandida");
      verMais.setAttribute("aria-expanded", String(aberto));
      verMais.textContent = aberto ? "Ver menos" : "Ver descrição completa";
    });
  }

  const autorImg = avatar(item.autor && item.autor.avatar_url, "avatar avatar-pequeno");
  const autor = el("div", { class: "card-autor" }, autorImg,
    el("span", {}, "Publicado por ", el("strong", { text: (item.autor && item.autor.nome) || "—" })));

  return el("article", {
    class: `card card-${item.tipo} ${item.status === "encerrado" ? "card-encerrado" : ""} ${item.eh_meu ? "card-meu" : ""}`.replace(/\s+/g, " ").trim(),
    "aria-labelledby": tituloId,
  },
    etiquetas,
    el("h2", { id: tituloId, text: item.titulo }),
    meta,
    desc,
    verMais,
    criarAcoesItem(item),
    autor
  );
}

function criarAcoesItem(item) {
  const acoes = el("div", { class: "card-acoes" });

  if (item.eh_meu) {
    const pend = Number(item.reivindicacoes_pendentes) || 0;
    if (pend > 0) {
      const ver = el("button", { type: "button", class: "card-nota-destaque" },
        icone("🔔"), plural(pend, "reivindicação pendente", "reivindicações pendentes"));
      ver.style.cursor = "pointer";
      ver.addEventListener("click", () => irPara("reivindicacoes"));
      acoes.append(ver);
    } else if (item.status === "aberto") {
      acoes.append(el("span", { class: "card-nota", text: "Nenhuma reivindicação pendente." }));
    } else if (item.status === "em_devolucao") {
      const ver = el("button", { type: "button", class: "btn btn-link btn-pequeno", text: "Ver devolução em andamento" });
      ver.addEventListener("click", () => irPara("reivindicacoes"));
      acoes.append(ver);
    }
    if (item.status !== "encerrado") {
      const btn = el("button", { type: "button", class: "btn btn-perigo btn-pequeno", text: "Encerrar caso" });
      btn.addEventListener("click", () => encerrarItem(item, btn));
      acoes.append(btn);
    }
    return acoes.childNodes.length ? acoes : null;
  }

  const minha = item.minha_reivindicacao;
  if (minha === "pendente" || minha === "aceita") {
    const nota = el("button", { type: "button", class: "card-nota-destaque" },
      icone(minha === "aceita" ? "🤝" : "⏳"),
      minha === "aceita" ? "Sua reivindicação foi aceita — combine a devolução" : "Você já reivindicou — aguardando resposta");
    nota.style.cursor = "pointer";
    nota.addEventListener("click", () => irPara("reivindicacoes"));
    acoes.append(nota);
    return acoes;
  }
  if (minha === "concluida") {
    acoes.append(el("span", { class: "card-nota", text: "✔ Devolução concluída com você." }));
    return acoes;
  }

  if (item.status === "aberto") {
    const texto = item.tipo === "encontrei" ? "É meu!" : "Eu encontrei";
    if (!estado.user) {
      const a = linkLogin(`${texto} (entrar com Discord)`, "btn btn-primario btn-pequeno");
      acoes.append(a);
    } else {
      const btn = el("button", { type: "button", class: "btn btn-primario btn-pequeno", text: texto });
      btn.addEventListener("click", () => abrirReivindicacao(item));
      acoes.append(btn);
    }
    if (minha === "recusada" || minha === "cancelada") {
      acoes.append(el("span", { class: "card-nota", text: `Sua reivindicação anterior foi ${minha}.` }));
    }
  } else if (item.status === "em_devolucao") {
    acoes.append(el("span", { class: "card-nota", text: "Devolução em andamento com outra pessoa." }));
  }
  return acoes.childNodes.length ? acoes : null;
}

async function encerrarItem(item, botao) {
  const pend = Number(item.reivindicacoes_pendentes) || 0;
  const ok = await confirmar({
    titulo: "Encerrar caso?",
    texto: `O item “${item.titulo}” deixará de aceitar reivindicações e sairá da vitrine padrão.` +
      (pend ? ` ${plural(pend, "reivindicação pendente será recusada", "reivindicações pendentes serão recusadas")}.` : "") +
      " Esta ação não pode ser desfeita.",
    botao: "Encerrar caso",
    perigo: true,
  });
  if (!ok) return;
  await executar(`item-${item.id}`, botao, async () => {
    await api(`/api/items/${item.id}`, { method: "PATCH", body: { acao: "encerrar" } });
    toast("Caso encerrado. Obrigado por usar a vitrine!", "sucesso");
    estado.reivindicacoes = null;
    await carregarItens();
  });
}

/* =====================================================================
 * Diálogos: utilitários comuns
 * ===================================================================== */
function ligarFechamento(dlg) {
  dlg.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-fechar]")) dlg.close();
    else if (ev.target === dlg) dlg.close(); // clique no fundo
  });
}

function atualizarContador(campo) {
  const cont = $(`cont-${campo.name}`);
  if (!cont) return;
  const n = campo.value.trim().length;
  const max = Number(cont.dataset.max);
  const min = Number(cont.dataset.min);
  cont.textContent = `${n}/${max}` + (n > 0 && n < min ? ` (mínimo ${min})` : "");
  cont.classList.toggle("fora", (n > 0 && n < min) || n > max);
}

function limparErros(form) {
  for (const p of form.querySelectorAll(".erro-campo")) p.textContent = "";
  for (const c of form.querySelectorAll("[aria-invalid]")) c.removeAttribute("aria-invalid");
  for (const g of form.querySelectorAll(".campo-grupo.invalido")) g.classList.remove("invalido");
  const geral = form.querySelector(".erro-geral");
  if (geral) { geral.hidden = true; geral.textContent = ""; }
}

function mostrarErros(form, erros) {
  let primeiro = null;
  for (const [nome, msg] of Object.entries(erros)) {
    const p = form.querySelector(`#erro-${CSS.escape(nome)}`);
    if (p) p.textContent = String(msg);
    const campos = form.querySelectorAll(`[name="${CSS.escape(nome)}"]`);
    for (const c of campos) c.setAttribute("aria-invalid", "true");
    if (nome === "tipo" && campos[0]) campos[0].closest(".campo-grupo").classList.add("invalido");
    if (!primeiro && campos[0]) primeiro = campos[0];
  }
  if (primeiro) primeiro.focus();
}

function mostrarErroGeral(form, msg) {
  const geral = form.querySelector(".erro-geral");
  if (geral) { geral.textContent = msg; geral.hidden = false; }
}

/* =====================================================================
 * Cadastro de item
 * ===================================================================== */
function abrirCadastro() {
  if (!estado.user) {
    if (!estado.discordConfigurado) {
      toast("Faça login para cadastrar itens. (O login com Discord ainda não foi configurado neste site.)", "erro");
      return;
    }
    toast("Faça login com o Discord para cadastrar um item. Redirecionando…");
    setTimeout(() => { location.href = "/api/auth/discord"; }, 900);
    return;
  }
  const form = $("formItem");
  const data = $("itemData");
  const hoje = new Date();
  data.max = dataLocalISO(hoje);
  const min = new Date(hoje);
  min.setFullYear(min.getFullYear() - 1);
  min.setDate(min.getDate() + 1);
  data.min = dataLocalISO(min);
  if (!data.value) data.value = data.max;
  limparErros(form);
  for (const c of form.querySelectorAll("[name=titulo],[name=local],[name=descricao]")) atualizarContador(c);
  $("dlgItem").showModal();
  const tipoMarcado = form.querySelector("[name=tipo]:checked");
  (tipoMarcado || $("tipoPerdi")).focus();
}

/** Espelha a validação do servidor (functions/api/items/index.js). */
function validarItemCliente(v) {
  const erros = {};
  if (!TIPOS[v.tipo]) erros.tipo = "Escolha “Perdi” ou “Encontrei”.";
  if (!CATEGORIAS[v.categoria]) erros.categoria = "Escolha uma categoria.";
  if (v.titulo.length < 3 || v.titulo.length > 80) erros.titulo = "O título deve ter entre 3 e 80 caracteres.";
  if (v.local.length < 3 || v.local.length > 120) erros.local = "Informe o local exato (3 a 120 caracteres).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.data_ocorrencia)) {
    erros.data_ocorrencia = "Informe a data.";
  } else {
    const max = $("itemData").max;
    const min = $("itemData").min;
    if (v.data_ocorrencia > max) erros.data_ocorrencia = "A data não pode estar no futuro.";
    else if (v.data_ocorrencia < min) erros.data_ocorrencia = "Use uma data dos últimos 12 meses.";
  }
  if (v.descricao.length < 10 || v.descricao.length > 1000) erros.descricao = "A descrição deve ter entre 10 e 1000 caracteres.";
  return erros;
}

async function salvarItem(ev) {
  ev.preventDefault();
  const form = $("formItem");
  limparErros(form);
  const fd = new FormData(form);
  const valores = {
    tipo: String(fd.get("tipo") || ""),
    categoria: String(fd.get("categoria") || ""),
    titulo: String(fd.get("titulo") || "").trim().replace(/\s+/g, " "),
    local: String(fd.get("local") || "").trim().replace(/\s+/g, " "),
    data_ocorrencia: String(fd.get("data_ocorrencia") || ""),
    descricao: String(fd.get("descricao") || "").trim(),
  };
  const erros = validarItemCliente(valores);
  if (Object.keys(erros).length) {
    mostrarErroGeral(form, "Confira os campos destacados.");
    mostrarErros(form, erros);
    return;
  }
  const botao = $("btnSalvarItem");
  if (estado.ocupado.has("novo-item")) return;
  estado.ocupado.add("novo-item");
  botao.disabled = true;
  botao.textContent = "Publicando…";
  try {
    await api("/api/items", { method: "POST", body: valores });
    $("dlgItem").close();
    form.reset();
    toast("Item publicado na vitrine!", "sucesso");
    // mostra o item recém-criado: limpa busca e garante que o status/tipo/categoria não o escondam
    estado.filtros = { ...FILTROS_PADRAO };
    await carregarItens();
  } catch (e) {
    mostrarErroGeral(form, e.message);
    if (e.details) mostrarErros(form, e.details);
    if (e.status === 401) toast("Sua sessão expirou. Entre novamente com o Discord.", "erro");
  } finally {
    estado.ocupado.delete("novo-item");
    botao.disabled = false;
    botao.textContent = "Publicar item";
  }
}

/* =====================================================================
 * Reivindicação
 * ===================================================================== */
function abrirReivindicacao(item) {
  estado.itemReivindicando = item;
  const form = $("formReivindicar");
  limparErros(form);
  const encontrei = item.tipo === "encontrei";
  $("dlgReivTitulo").textContent = encontrei ? "É meu! Reivindicar item" : "Eu encontrei este item";
  $("reivDica").textContent = encontrei
    ? "Descreva detalhes que comprovem que o objeto é seu (cor, marca, adesivos, conteúdo, onde e quando perdeu…). Entre 10 e 500 caracteres."
    : "Conte onde e quando você encontrou o objeto e onde ele está agora. Entre 10 e 500 caracteres.";
  $("reivMensagem").placeholder = encontrei
    ? "Ex.: É a minha garrafa! Tem um adesivo de gato na lateral e um amassado no fundo."
    : "Ex.: Encontrei no banco do corredor do Bloco C na terça à tarde; está comigo.";
  const cat = CATEGORIAS[item.categoria] || { rotulo: item.categoria, icone: "" };
  $("reivResumo").replaceChildren(
    el("strong", { text: item.titulo }),
    el("span", { text: `${TIPOS[item.tipo].rotulo} · ${cat.icone} ${cat.rotulo} · ${formatarData(item.data_ocorrencia)}` }),
    el("span", { text: `📍 ${item.local}` }),
    el("span", { text: `Publicado por ${(item.autor && item.autor.nome) || "—"}` })
  );
  atualizarContador($("reivMensagem"));
  $("dlgReivindicar").showModal();
  $("reivMensagem").focus();
}

async function enviarReivindicacao(ev) {
  ev.preventDefault();
  const form = $("formReivindicar");
  const item = estado.itemReivindicando;
  if (!item) return;
  limparErros(form);
  const mensagem = $("reivMensagem").value.trim();
  if (mensagem.length < 10 || mensagem.length > 500) {
    mostrarErros(form, { mensagem: "Escreva entre 10 e 500 caracteres." });
    return;
  }
  const botao = $("btnEnviarReiv");
  if (estado.ocupado.has("reiv")) return;
  estado.ocupado.add("reiv");
  botao.disabled = true;
  botao.textContent = "Enviando…";
  try {
    await api(`/api/items/${item.id}/claims`, { method: "POST", body: { mensagem } });
    $("dlgReivindicar").close();
    form.reset();
    toast("Reivindicação enviada! Acompanhe em “Minhas reivindicações”.", "sucesso");
    estado.reivindicacoes = null;
    await carregarItens();
  } catch (e) {
    mostrarErroGeral(form, e.message);
    if (e.details) mostrarErros(form, e.details);
    if (e.status === 409) carregarItens();
  } finally {
    estado.ocupado.delete("reiv");
    botao.disabled = false;
    botao.textContent = "Enviar reivindicação";
  }
}

/* =====================================================================
 * Minhas reivindicações
 * ===================================================================== */
async function carregarReivindicacoes() {
  if (!estado.user) { renderReivindicacoes(); return; }
  estado.carregandoReiv = true;
  estado.erroReiv = null;
  renderReivindicacoes();
  try {
    const dados = await api("/api/claims");
    estado.reivindicacoes = Array.isArray(dados.reivindicacoes) ? dados.reivindicacoes : [];
  } catch (e) {
    estado.erroReiv = e.message;
  } finally {
    estado.carregandoReiv = false;
    renderReivindicacoes();
    renderContadorPendentes();
  }
}

function renderContadorPendentes() {
  let n = 0;
  if (estado.reivindicacoes) {
    n = estado.reivindicacoes.filter((r) => r.meu_papel === "dono_do_anuncio" && r.status === "pendente").length;
  } else {
    n = estado.itens.filter((i) => i.eh_meu).reduce((s, i) => s + (Number(i.reivindicacoes_pendentes) || 0), 0);
  }
  const badge = $("contadorPendentes");
  badge.hidden = !estado.user || n === 0;
  badge.textContent = String(n);
  badge.setAttribute("aria-label", plural(n, "reivindicação recebida pendente", "reivindicações recebidas pendentes"));
}

function renderReivindicacoes() {
  const alvo = $("conteudoReivindicacoes");
  $("btnAtualizarReivindicacoes").hidden = !estado.user;

  if (!estado.user) {
    alvo.replaceChildren(el("div", { class: "estado-vazio" },
      el("span", { class: "estado-icone", "aria-hidden": "true", text: "🔐" }),
      el("strong", { text: "Entre com o Discord para ver suas reivindicações." }),
      el("p", { text: "As reivindicações guardam o contato do Discord das duas partes para combinar a devolução." }),
      linkLogin()));
    return;
  }
  if (estado.carregandoReiv && !estado.reivindicacoes) {
    alvo.setAttribute("aria-busy", "true");
    alvo.replaceChildren(el("p", { class: "estado-carregando", text: "Carregando reivindicações…" }));
    return;
  }
  alvo.setAttribute("aria-busy", "false");
  if (estado.erroReiv) {
    const tentar = el("button", { type: "button", class: "btn btn-secundario", text: "Tentar novamente" });
    tentar.addEventListener("click", carregarReivindicacoes);
    alvo.replaceChildren(el("div", { class: "estado-vazio" },
      el("span", { class: "estado-icone", "aria-hidden": "true", text: "⚠️" }),
      el("strong", { text: "Não foi possível carregar suas reivindicações." }),
      el("p", { text: estado.erroReiv }), tentar));
    return;
  }

  const todas = estado.reivindicacoes || [];
  const recebidas = todas.filter((r) => r.meu_papel === "dono_do_anuncio");
  const enviadas = todas.filter((r) => r.meu_papel !== "dono_do_anuncio");

  alvo.replaceChildren(
    blocoReivindicacoes("recebidas", "Recebidas",
      "Pessoas que responderam aos itens que você publicou. Aceite para liberar a devolução.",
      recebidas, "Ninguém reivindicou seus itens ainda."),
    blocoReivindicacoes("enviadas", "Enviadas",
      "Reivindicações que você abriu em itens de outras pessoas.",
      enviadas, "Você ainda não reivindicou nenhum item. Procure na vitrine e clique em “É meu!” ou “Eu encontrei”.")
  );
}

function blocoReivindicacoes(id, titulo, desc, lista, msgVazia) {
  const pend = lista.filter((r) => r.status === "pendente").length;
  const h = el("h2", { id: `reiv-${id}` }, titulo, " ",
    el("span", { class: "chip-contagem", "aria-label": plural(lista.length, "reivindicação", "reivindicações"), text: String(lista.length) }),
    pend ? el("span", { class: "etiqueta etiqueta-pendente", text: plural(pend, "pendente", "pendentes") }) : null);
  const corpo = lista.length
    ? el("div", { class: "lista-reiv" }, lista.map(criarCardReivindicacao))
    : el("p", { class: "estado-vazio", text: msgVazia });
  return el("section", { class: "reiv-bloco", "aria-labelledby": `reiv-${id}` }, h, el("p", { text: desc }), corpo);
}

function criarParte(papel, p, souEu) {
  const img = avatar(p.avatar_url, "avatar avatar-medio");
  const copiar = el("button", { type: "button", class: "parte-copiar", text: "copiar @", "aria-label": `Copiar o usuário do Discord @${p.discord}` });
  copiar.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(p.discord);
      toast(`@${p.discord} copiado. Procure esse usuário no Discord.`, "sucesso", 3000);
    } catch {
      toast(`Usuário do Discord: @${p.discord}`, "info");
    }
  });
  const perfil = el("a", { href: p.perfil_url, target: "_blank", rel: "noopener noreferrer" }, "Abrir perfil no Discord");
  perfil.append(el("span", { class: "visualmente-oculto", text: " (abre em nova aba)" }));
  return el("div", { class: "parte" }, img,
    el("div", { class: "parte-dados" },
      el("span", { class: "parte-papel", text: papel + (souEu ? " (você)" : "") }),
      el("span", { class: "parte-nome", text: p.nome }),
      el("span", { class: "parte-contato" }, el("code", { text: `@${p.discord}` }), copiar, perfil)));
}

function criarCardReivindicacao(r) {
  const souDono = r.meu_papel === "dono_do_anuncio";
  const item = r.item || {};
  const tipo = TIPOS[item.tipo] || { rotulo: item.tipo, icone: "" };
  const cat = CATEGORIAS[item.categoria] || { rotulo: item.categoria, icone: "📁" };
  const tituloId = `reiv-${r.id}-titulo`;

  // quem publicou "Encontrei" está com o objeto; em "Perdi" o reivindicante está com ele
  const papelDono = item.tipo === "encontrei" ? "Publicou (encontrou)" : "Publicou (perdeu)";
  const papelReiv = item.tipo === "encontrei" ? "Reivindicou (dono do objeto)" : "Reivindicou (encontrou)";

  const card = el("article", { class: `card card-${item.tipo}`, "aria-labelledby": tituloId },
    el("div", { class: "card-etiquetas" },
      el("span", { class: `etiqueta etiqueta-${r.status}` }, STATUS_REIV[r.status] || r.status),
      el("span", { class: `etiqueta etiqueta-${item.tipo}` }, icone(tipo.icone), tipo.rotulo),
      el("span", { class: "etiqueta etiqueta-categoria" }, icone(cat.icone), cat.rotulo),
      el("span", { class: `etiqueta etiqueta-${item.status}` }, "Item: ", STATUS_ITEM[item.status] || item.status)),
    el("h3", { id: tituloId, text: item.titulo }),
    el("p", { class: "reiv-item-info" }, icone("📍 "), item.local, " · ", icone("📅 "), formatarData(item.data_ocorrencia),
      " · aberta em ", formatarDataHora(r.created_at)),
    el("div", {},
      el("p", { class: "reiv-mensagem-rotulo", text: souDono ? "Mensagem recebida:" : "Sua mensagem:" }),
      el("blockquote", { class: "reiv-mensagem", text: r.mensagem })),
    el("div", { class: "partes" },
      criarParte(papelDono, r.dono, souDono),
      criarParte(papelReiv, r.reivindicante, !souDono))
  );

  const dica = dicaReivindicacao(r, souDono);
  if (dica) card.append(el("p", { class: "reiv-dica", text: dica }));

  const acoes = el("div", { class: "card-acoes" });
  if (souDono && r.status === "pendente") {
    if (item.status === "aberto") {
      acoes.append(botaoAcao(r, "aceitar", "Aceitar", "btn-sucesso"));
    }
    acoes.append(botaoAcao(r, "recusar", "Recusar", "btn-perigo"));
  }
  if (!souDono && (r.status === "pendente" || r.status === "aceita")) {
    acoes.append(botaoAcao(r, "cancelar", "Cancelar reivindicação", "btn-secundario"));
  }
  if (r.status === "aceita") {
    acoes.append(botaoAcao(r, "concluir", "Marcar como devolvido (encerrar)", "btn-primario"));
  }
  if (acoes.childNodes.length) card.append(acoes);
  return card;
}

function dicaReivindicacao(r, souDono) {
  const outro = souDono ? r.reivindicante : r.dono;
  switch (r.status) {
    case "pendente":
      if (souDono && r.item.status !== "aberto") return "Este item já está em devolução com outra pessoa; você ainda pode recusar esta reivindicação.";
      return souDono
        ? `Confira a mensagem. Se fizer sentido, aceite e chame @${outro.discord} no Discord para combinar a devolução.`
        : "Aguardando quem publicou o item aceitar ou recusar.";
    case "aceita":
      return `Reivindicação aceita! Chame @${outro.discord} no Discord, combine local e horário e, depois da entrega, marque como devolvido.`;
    case "concluida":
      return "Objeto devolvido e caso encerrado. 🎉";
    case "recusada":
      return souDono ? "Você recusou esta reivindicação." : "Quem publicou recusou esta reivindicação (ou o caso foi encerrado).";
    case "cancelada":
      return souDono ? "A pessoa cancelou esta reivindicação." : "Você cancelou esta reivindicação.";
    default:
      return "";
  }
}

const CONFIRMACOES = {
  aceitar: {
    titulo: "Aceitar reivindicação?",
    texto: (r) => `O item “${r.item.titulo}” ficará “Em devolução” e não aceitará novas reivindicações. Depois combine a entrega com @${r.reivindicante.discord} pelo Discord.`,
    botao: "Aceitar",
  },
  recusar: {
    titulo: "Recusar reivindicação?",
    texto: (r) => `A reivindicação de @${r.reivindicante.discord} sobre “${r.item.titulo}” será recusada. Esta ação não pode ser desfeita.`,
    botao: "Recusar",
    perigo: true,
  },
  cancelar: {
    titulo: "Cancelar sua reivindicação?",
    texto: (r) => `Sua reivindicação sobre “${r.item.titulo}” será cancelada` +
      (r.status === "aceita" ? " e o item voltará a ficar aberto para outras pessoas." : ".") + " Esta ação não pode ser desfeita.",
    botao: "Cancelar reivindicação",
    perigo: true,
  },
  concluir: {
    titulo: "Marcar como devolvido?",
    texto: (r) => `Confirme apenas se o objeto “${r.item.titulo}” já foi entregue. O caso será encerrado e outras reivindicações pendentes serão recusadas.`,
    botao: "Sim, foi devolvido",
  },
};

const SUCESSO_ACAO = {
  aceitar: "Reivindicação aceita. Agora combinem a devolução pelo Discord.",
  recusar: "Reivindicação recusada.",
  cancelar: "Reivindicação cancelada.",
  concluir: "Devolução registrada e caso encerrado. Obrigado!",
};

function botaoAcao(r, acao, texto, classe) {
  const btn = el("button", { type: "button", class: `btn btn-pequeno ${classe}`, text: texto });
  btn.addEventListener("click", async () => {
    const c = CONFIRMACOES[acao];
    const ok = await confirmar({ titulo: c.titulo, texto: c.texto(r), botao: c.botao, perigo: c.perigo });
    if (!ok) return;
    await executar(`reiv-${r.id}`, btn, async () => {
      try {
        await api(`/api/claims/${r.id}`, { method: "PATCH", body: { acao } });
        toast(SUCESSO_ACAO[acao], "sucesso");
      } finally {
        // recarrega mesmo em caso de conflito (409), pois o estado mudou no servidor
        await Promise.all([carregarReivindicacoes(), carregarItens()]);
      }
    });
  });
  return btn;
}

/* =====================================================================
 * Navegação entre abas
 * ===================================================================== */
function irPara(aba, { foco = true } = {}) {
  estado.aba = aba === "reivindicacoes" ? "reivindicacoes" : "vitrine";
  const hash = estado.aba === "reivindicacoes" ? "#reivindicacoes" : "";
  if (location.hash !== hash) history.replaceState(null, "", location.pathname + location.search + hash);
  renderAbas();
  if (estado.aba === "reivindicacoes") {
    if (estado.user && !estado.carregandoReiv) carregarReivindicacoes();
    else renderReivindicacoes();
  }
  if (foco) {
    const h = estado.aba === "reivindicacoes" ? $("tituloReivindicacoes") : $("tituloVitrine");
    h.setAttribute("tabindex", "-1");
    h.focus({ preventScroll: false });
  }
}

function renderAbas() {
  const vit = estado.aba === "vitrine";
  $("secVitrine").hidden = !vit;
  $("secReivindicacoes").hidden = vit;
  $(vit ? "abaVitrine" : "abaReivindicacoes").setAttribute("aria-current", "page");
  $(vit ? "abaReivindicacoes" : "abaVitrine").removeAttribute("aria-current");
}

/* =====================================================================
 * Render geral e inicialização
 * ===================================================================== */
function render() {
  renderUsuario();
  renderAbas();
  renderVitrine();
  renderContadorPendentes();
  if (estado.aba === "reivindicacoes") renderReivindicacoes();
}

function ligarEventos() {
  // filtros
  $("busca").addEventListener("input", (ev) => {
    estado.filtros.q = ev.target.value;
    renderVitrine();
  });
  $("formFiltros").addEventListener("submit", (ev) => ev.preventDefault());
  $("filtroMeus").addEventListener("change", (ev) => {
    estado.filtros.meus = ev.target.checked;
    renderVitrine();
  });
  $("btnLimparFiltros").addEventListener("click", limparFiltros);

  // abas
  for (const b of document.querySelectorAll(".aba")) {
    b.addEventListener("click", () => irPara(b.dataset.aba));
  }
  window.addEventListener("hashchange", () => irPara(location.hash === "#reivindicacoes" ? "reivindicacoes" : "vitrine", { foco: false }));
  $("btnAtualizarReivindicacoes").addEventListener("click", carregarReivindicacoes);

  // cadastro
  $("btnNovoItem").addEventListener("click", abrirCadastro);
  $("formItem").addEventListener("submit", salvarItem);
  $("formReivindicar").addEventListener("submit", enviarReivindicacao);
  for (const dlg of [$("dlgItem"), $("dlgReivindicar"), $("dlgConfirmar")]) ligarFechamento(dlg);
  $("dlgReivindicar").addEventListener("close", () => { estado.itemReivindicando = null; });

  // contadores de caracteres e limpeza de erro ao digitar
  for (const campo of document.querySelectorAll("#formItem .campo, #formItem [name=tipo], #reivMensagem")) {
    const evento = campo.tagName === "SELECT" || campo.type === "radio" || campo.type === "date" ? "change" : "input";
    campo.addEventListener(evento, () => {
      atualizarContador(campo);
      if (campo.getAttribute("aria-invalid") === "true") {
        for (const c of document.querySelectorAll(`[name="${campo.name}"]`)) c.removeAttribute("aria-invalid");
        const p = $(`erro-${campo.name}`);
        if (p) p.textContent = "";
        const grupo = campo.closest(".campo-grupo");
        if (grupo) grupo.classList.remove("invalido");
      }
    });
  }

  // atalho: "/" foca a busca
  document.addEventListener("keydown", (ev) => {
    if (ev.key === "/" && !ev.ctrlKey && !ev.metaKey && !ev.altKey &&
        !(ev.target instanceof HTMLInputElement || ev.target instanceof HTMLTextAreaElement || ev.target instanceof HTMLSelectElement) &&
        !document.querySelector("dialog[open]") && estado.aba === "vitrine") {
      ev.preventDefault();
      $("busca").focus();
    }
  });
}

async function iniciar() {
  mostrarErroAuth();
  montarFiltros();
  ligarEventos();
  estado.aba = location.hash === "#reivindicacoes" ? "reivindicacoes" : "vitrine";
  render();

  try {
    const me = await api("/api/me");
    estado.user = me.user || null;
    estado.discordConfigurado = me.discordConfigurado !== false;
  } catch (e) {
    toast(`Não foi possível verificar seu login: ${e.message}`, "erro");
  }
  renderUsuario();
  await carregarItens();
  if (estado.aba === "reivindicacoes") carregarReivindicacoes();
}

document.addEventListener("DOMContentLoaded", iniciar);
