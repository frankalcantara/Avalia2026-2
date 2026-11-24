"use strict";

/* Dúvidas Técnicas: front-end em JavaScript puro.
   Regra de ouro: todo texto vindo do usuário entra no DOM por textContent e createElement, sem montar HTML como string. */

const LIMITES = { titulo: [5, 120], descricao: [10, 5000], resposta: [3, 5000] };
const ERROS_URL = {
  login_cancelado: "Você cancelou o login com o Discord. Quando quiser, é só tentar de novo.",
  estado_invalido: "Não foi possível confirmar o login (estado inválido). Tente entrar novamente.",
  falha_discord: "O Discord não respondeu como esperado. Tente entrar novamente em instantes.",
};

const raiz = document.getElementById("app");
const avisos = document.getElementById("avisos");
const conta = document.getElementById("conta");
const principal = document.getElementById("principal");

const estado = { usuario: null, filtro: "", q: "", pagina: 1 };
let tokenRota = 0; // descarta respostas de telas que já foram abandonadas

const fmtData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" });

/* ---------- utilidades DOM ---------- */

function h(tag, props, ...filhos) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "text") el.textContent = v;
    else if (v === true) el.setAttribute(k, "");
    else el.setAttribute(k, v);
  }
  for (const f of filhos.flat()) {
    if (f === null || f === undefined || f === false) continue;
    el.append(f instanceof Node ? f : document.createTextNode(String(f)));
  }
  return el;
}

function formatarData(iso) {
  if (!iso) return "";
  // D1 pode devolver "YYYY-MM-DD HH:MM:SS" (UTC, sem fuso); normaliza para ISO.
  let s = String(iso);
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) s = s.replace(" ", "T") + "Z";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(iso) : fmtData.format(d);
}

function avatar(autor, grande) {
  const nome = (autor && autor.username) || "?";
  const cls = "avatar" + (grande ? " avatar-g" : "");
  const ini = () => h("span", { class: cls + " avatar-ini", "aria-hidden": "true" }, nome.trim().charAt(0).toUpperCase() || "?");
  if (!autor || !autor.avatar_url) return ini();
  const img = h("img", { class: cls, src: autor.avatar_url, alt: "", width: 36, height: 36, loading: "lazy", referrerpolicy: "no-referrer" });
  img.addEventListener("error", () => img.replaceWith(ini()), { once: true });
  return img;
}

function autorInfo(autor) {
  return h("span", { class: "autor" }, avatar(autor), h("span", null, (autor && autor.username) || "Desconhecido"));
}

function selo(status) {
  return status === "resolved"
    ? h("span", { class: "selo selo-resolvido" }, "Resolvido")
    : h("span", { class: "selo selo-aberto" }, "Aberto");
}

function textoRespostas(n) {
  return n === 1 ? "1 resposta" : `${n || 0} respostas`;
}

/* ---------- renderizador seguro de texto técnico ---------- */

function renderTexto(texto) {
  const frag = document.createDocumentFragment();
  const partes = String(texto || "").replace(/\r\n?/g, "\n").split("```");
  partes.forEach((parte, i) => {
    if (i % 2 === 1) {
      // Bloco de código: descarta o rótulo de linguagem da primeira linha (ex.: ```js).
      let codigo = parte;
      const nl = codigo.indexOf("\n");
      if (nl !== -1 && /^[\w+#.-]*\s*$/.test(codigo.slice(0, nl))) codigo = codigo.slice(nl + 1);
      codigo = codigo.replace(/\n$/, "");
      frag.append(h("pre", null, h("code", null, codigo)));
      return;
    }
    parte.split(/\n\s*\n/).forEach((par) => {
      const p = par.trim();
      if (!p) return;
      const el = h("p");
      p.split("`").forEach((seg, j, arr) => {
        // Crase sem par (último segmento de índice par ímpar) volta a ser texto.
        const emCodigo = j % 2 === 1 && !(j === arr.length - 1);
        if (emCodigo) el.append(h("code", null, seg));
        else el.append(document.createTextNode(j % 2 === 1 ? "`" + seg : seg));
      });
      frag.append(el);
    });
  });
  return frag;
}

/* ---------- API ---------- */

async function api(caminho, opcoes) {
  const o = Object.assign({ credentials: "same-origin" }, opcoes || {});
  if (o.body !== undefined) {
    o.method = o.method || "POST";
    o.headers = Object.assign({ "Content-Type": "application/json" }, o.headers);
    o.body = JSON.stringify(o.body);
  }
  let res;
  try {
    res = await fetch(caminho, o);
  } catch (e) {
    throw Object.assign(new Error("Sem conexão com o servidor. Verifique sua internet."), { status: 0 });
  }
  let dados = null;
  try { dados = await res.json(); } catch (e) { /* corpo vazio ou não JSON */ }
  if (!res.ok) {
    throw Object.assign(new Error((dados && dados.error) || `Erro ${res.status} ao falar com o servidor.`), {
      status: res.status,
      field: dados && dados.field,
    });
  }
  return dados;
}

/* ---------- avisos e estados ---------- */

function mostrarAviso(msg, tipo) {
  const caixa = h("div", { class: "alerta alerta-" + (tipo || "erro"), role: "alert" },
    h("span", null, msg),
    h("button", { type: "button", onclick: () => caixa.remove() }, "Fechar"));
  avisos.replaceChildren(caixa);
}

function limparAvisos() { avisos.replaceChildren(); }

function carregando(txt) {
  return h("div", { class: "carregando", role: "status" }, h("span", { class: "spin", "aria-hidden": "true" }), h("span", null, txt || "Carregando..."));
}

function telaErro(msg, tentar) {
  return h("div", { class: "estado" },
    h("div", { role: "alert" }, h("strong", null, "Algo deu errado"), msg),
    tentar ? h("p", null, h("button", { type: "button", class: "btn btn-sec", onclick: tentar }, "Tentar novamente")) : null);
}

function conviteLogin(msg) {
  return h("div", { class: "convite" },
    h("p", null, msg),
    h("a", { class: "btn", href: "/api/auth/login" }, "Entrar com Discord"));
}

function trocarTela(...nos) {
  raiz.replaceChildren(...nos);
}

function focarPrincipal() {
  principal.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

/* ---------- cabeçalho / sessão ---------- */

function desenharConta() {
  const u = estado.usuario;
  if (!u) {
    conta.replaceChildren(h("a", { class: "btn btn-peq", href: "/api/auth/login" }, "Entrar com Discord"));
    return;
  }
  conta.replaceChildren(
    h("span", { class: "usuario" }, avatar(u, true), h("span", null, u.username)),
    h("button", { type: "button", class: "btn btn-sec btn-peq", onclick: sair }, "Sair"));
}

async function carregarUsuario() {
  try {
    const d = await api("/api/me");
    estado.usuario = (d && d.user) || null;
  } catch (e) {
    estado.usuario = null;
  }
  desenharConta();
}

async function sair() {
  try {
    await api("/api/auth/logout", { method: "POST", body: {} });
  } catch (e) {
    mostrarAviso(e.message);
    return;
  }
  estado.usuario = null;
  desenharConta();
  rotear();
}

/* ---------- tela: lista ---------- */

async function telaLista() {
  const meu = tokenRota;
  const botoes = [["", "Todos"], ["open", "Abertos"], ["resolved", "Resolvidos"]].map(([valor, rotulo]) =>
    h("button", {
      type: "button", class: "filtro", "aria-pressed": String(estado.filtro === valor),
      onclick: () => { estado.filtro = valor; estado.pagina = 1; telaLista(); },
    }, rotulo));

  const campoBusca = h("input", { type: "search", id: "busca", name: "q", value: estado.q, placeholder: "Buscar por título", autocomplete: "off", maxlength: "120" });
  const busca = h("form", { class: "busca", role: "search", onsubmit: (ev) => {
    ev.preventDefault();
    estado.q = campoBusca.value.trim();
    estado.pagina = 1;
    telaLista();
  } },
    h("label", { for: "busca", class: "so-leitor", style: "position:absolute;left:-9999px" }, "Buscar por título"),
    campoBusca,
    h("button", { type: "submit", class: "btn" }, "Buscar"));

  const area = h("div", { "aria-live": "polite" }, carregando("Carregando tópicos..."));
  trocarTela(
    h("div", { class: "cabeca-lista" },
      h("h1", null, "Tópicos"),
      h("a", { class: "btn", href: "#/novo" }, "Novo tópico")),
    h("div", { class: "barra" }, h("div", { class: "filtros", role: "group", "aria-label": "Filtrar por situação" }, botoes), busca),
    area);

  const params = new URLSearchParams();
  if (estado.filtro) params.set("status", estado.filtro);
  if (estado.q) params.set("q", estado.q);
  params.set("page", String(estado.pagina));

  try {
    const d = await api("/api/topics?" + params.toString());
    if (meu !== tokenRota) return;
    const topicos = d.topics || [];
    if (!topicos.length) {
      area.replaceChildren(h("div", { class: "estado" },
        h("strong", null, estado.q || estado.filtro ? "Nenhum tópico encontrado" : "Ainda não há dúvidas por aqui"),
        estado.q || estado.filtro ? "Tente outro filtro ou outra busca." : "Seja a primeira pessoa a perguntar."));
      return;
    }
    const tamanho = d.page_size || 20;
    const ultima = Math.max(1, Math.ceil((d.total || 0) / tamanho));
    const atual = d.page || estado.pagina;
    area.replaceChildren(
      h("ul", { class: "lista" }, topicos.map((t) =>
        h("li", { class: "card" + (t.status === "resolved" ? " resolvido" : "") },
          h("h2", null, h("a", { href: "#/t/" + encodeURIComponent(t.id) }, t.title)),
          h("div", { class: "meta" },
            selo(t.status),
            h("span", null, textoRespostas(t.answer_count)),
            autorInfo(t.author),
            h("time", { datetime: t.created_at }, formatarData(t.created_at)))))),
      h("nav", { class: "paginacao", "aria-label": "Paginação" },
        h("button", { type: "button", class: "btn btn-sec", disabled: atual <= 1, onclick: () => { estado.pagina = atual - 1; telaLista(); } }, "Anterior"),
        h("span", null, `Página ${atual} de ${ultima}`),
        h("button", { type: "button", class: "btn btn-sec", disabled: atual >= ultima, onclick: () => { estado.pagina = atual + 1; telaLista(); } }, "Próxima")));
  } catch (e) {
    if (meu !== tokenRota) return;
    area.replaceChildren(telaErro(e.message, telaLista));
  }
}

/* ---------- contador de caracteres ---------- */

function campoComContador({ id, rotulo, multilinha, limite, dica, rows }) {
  const [min, max] = limite;
  const ctrl = multilinha
    ? h("textarea", { id, name: id, rows: rows || 8, maxlength: String(max + 500), "aria-describedby": id + "-info" })
    : h("input", { id, name: id, type: "text", maxlength: String(max + 50), autocomplete: "off", "aria-describedby": id + "-info" });
  const cont = h("p", { class: "contador", id: id + "-info" });
  const erro = h("p", { class: "contador ruim", id: id + "-erro", style: "text-align:left" });
  const atualizar = () => {
    const n = Array.from(ctrl.value.trim()).length;
    const ok = n >= min && n <= max;
    cont.textContent = `${n} / ${max} caracteres (mínimo ${min})`;
    cont.classList.toggle("ruim", n > 0 && !ok);
  };
  ctrl.addEventListener("input", atualizar);
  atualizar();
  const el = h("div", { class: "campo" }, h("label", { for: id }, rotulo), ctrl, dica || null, cont, erro);
  return {
    el, ctrl,
    valor: () => ctrl.value.trim(),
    valido: () => { const n = Array.from(ctrl.value.trim()).length; return n >= min && n <= max; },
    erro: (msg) => {
      erro.textContent = msg || "";
      if (msg) { ctrl.setAttribute("aria-invalid", "true"); ctrl.setAttribute("aria-describedby", id + "-erro " + id + "-info"); }
      else { ctrl.removeAttribute("aria-invalid"); ctrl.setAttribute("aria-describedby", id + "-info"); }
    },
    limpar: () => { ctrl.value = ""; atualizar(); },
  };
}

function dicaCodigo() {
  return h("p", { class: "dica" }, "Dica: use ", h("code", null, "```"), " para abrir e fechar um bloco de código e ", h("code", null, "`crases`"), " para trechos curtos.");
}

/* ---------- tela: novo tópico ---------- */

function telaNovo() {
  if (!estado.usuario) {
    trocarTela(h("div", { class: "coluna" }, h("h1", null, "Novo tópico"), conviteLogin("Entre com sua conta do Discord para publicar uma dúvida.")));
    return;
  }
  const titulo = campoComContador({ id: "titulo", rotulo: "Título", multilinha: false, limite: LIMITES.titulo });
  const desc = campoComContador({ id: "descricao", rotulo: "Descrição", multilinha: true, limite: LIMITES.descricao, dica: dicaCodigo(), rows: 10 });
  const botao = h("button", { type: "submit", class: "btn" }, "Publicar dúvida");
  const form = h("form", { class: "coluna", novalidate: true, onsubmit: async (ev) => {
    ev.preventDefault();
    limparAvisos(); titulo.erro(""); desc.erro("");
    let falhou = false;
    if (!titulo.valido()) { titulo.erro(`O título deve ter de ${LIMITES.titulo[0]} a ${LIMITES.titulo[1]} caracteres.`); falhou = true; }
    if (!desc.valido()) { desc.erro(`A descrição deve ter de ${LIMITES.descricao[0]} a ${LIMITES.descricao[1]} caracteres.`); falhou = true; }
    if (falhou) { (titulo.valido() ? desc : titulo).ctrl.focus(); return; }
    botao.disabled = true;
    try {
      const d = await api("/api/topics", { body: { title: titulo.valor(), body: desc.valor() } });
      location.hash = "#/t/" + encodeURIComponent(d.topic.id);
    } catch (e) {
      botao.disabled = false;
      if (e.status === 401) { await carregarUsuario(); rotear(); return; }
      if (e.field === "title") titulo.erro(e.message);
      else if (e.field === "body") desc.erro(e.message);
      mostrarAviso(e.message);
    }
  } },
    h("h1", null, "Novo tópico"), titulo.el, desc.el,
    h("div", { class: "acoes" }, botao, h("a", { class: "btn btn-sec", href: "#/" }, "Cancelar")));
  trocarTela(form);
}

/* ---------- tela: detalhe ---------- */

async function telaDetalhe(id) {
  const meu = tokenRota;
  trocarTela(carregando("Carregando tópico..."));
  let d;
  try {
    d = await api("/api/topics/" + encodeURIComponent(id));
  } catch (e) {
    if (meu !== tokenRota) return;
    trocarTela(h("a", { class: "voltar", href: "#/" }, "← Voltar à lista"),
      e.status === 404
        ? h("div", { class: "estado" }, h("strong", null, "Tópico não encontrado"), "Ele pode ter sido removido ou o endereço está incorreto.")
        : telaErro(e.message, () => telaDetalhe(id)));
    return;
  }
  if (meu !== tokenRota) return;

  const t = d.topic;
  const v = d.viewer || {};
  const respostas = d.answers || [];

  async function aceitar(resp, botao) {
    limparAvisos();
    botao.disabled = true;
    try {
      await api(`/api/topics/${encodeURIComponent(t.id)}/accept`, { body: { answer_id: resp.id } });
      await telaDetalhe(id);
    } catch (e) {
      botao.disabled = false;
      mostrarAviso(e.message);
    }
  }

  function cartaoResposta(r) {
    const aceita = !!r.is_accepted;
    return h("article", { class: "resposta" + (aceita ? " aceita" : ""), "aria-label": aceita ? "Solução Aceita" : "Resposta" },
      h("div", { class: "resposta-cab" },
        h("div", { class: "meta" }, autorInfo(r.author), h("time", { datetime: r.created_at }, formatarData(r.created_at))),
        aceita ? h("span", { class: "selo selo-solucao" }, "Solução Aceita") : null),
      h("div", { class: "corpo" }, renderTexto(r.body)),
      v.can_accept && !aceita
        ? h("div", { class: "acoes" }, (() => {
            const b = h("button", { type: "button", class: "btn btn-sec btn-peq" }, "Marcar como solução");
            b.addEventListener("click", () => aceitar(r, b));
            return b;
          })())
        : null);
  }

  // Formulário de resposta ou mensagem explicativa.
  let blocoResposta;
  if (v.can_answer) {
    const campo = campoComContador({ id: "resposta", rotulo: "Sua resposta", multilinha: true, limite: LIMITES.resposta, dica: dicaCodigo(), rows: 7 });
    const botao = h("button", { type: "submit", class: "btn" }, "Enviar resposta");
    blocoResposta = h("form", { novalidate: true, onsubmit: async (ev) => {
      ev.preventDefault();
      limparAvisos(); campo.erro("");
      if (!campo.valido()) { campo.erro(`A resposta deve ter de ${LIMITES.resposta[0]} a ${LIMITES.resposta[1]} caracteres.`); campo.ctrl.focus(); return; }
      botao.disabled = true;
      try {
        await api(`/api/topics/${encodeURIComponent(t.id)}/answers`, { body: { body: campo.valor() } });
        await telaDetalhe(id);
      } catch (e) {
        botao.disabled = false;
        if (e.status === 422) campo.erro(e.message);
        mostrarAviso(e.message);
        if (e.status === 409 || e.status === 403) telaDetalhe(id);
      }
    } }, h("h2", null, "Sua resposta"), campo.el, botao);
  } else if (!v.logged_in) {
    blocoResposta = conviteLogin("Entre com o Discord para responder a este tópico.");
  } else if (v.is_author) {
    blocoResposta = h("p", { class: "dica" }, "Você é a pessoa autora deste tópico e não pode respondê-lo. " + (v.can_accept ? "Escolha abaixo a resposta que resolveu sua dúvida." : "Aguarde as respostas da comunidade."));
  } else if (t.status === "resolved") {
    blocoResposta = h("p", { class: "dica" }, "Este tópico já foi resolvido e não recebe novas respostas.");
  } else {
    blocoResposta = h("p", { class: "dica" }, "Você não pode responder a este tópico.");
  }

  const aceitas = respostas.filter((r) => r.is_accepted);
  const demais = respostas.filter((r) => !r.is_accepted);

  trocarTela(h("div", { class: "coluna" },
    h("a", { class: "voltar", href: "#/" }, "← Voltar à lista"),
    h("header", { class: "topico-cab" },
      h("h1", null, t.title),
      h("div", { class: "meta" }, selo(t.status), autorInfo(t.author),
        h("time", { datetime: t.created_at }, "Perguntado em " + formatarData(t.created_at)),
        t.resolved_at ? h("time", { datetime: t.resolved_at }, "Resolvido em " + formatarData(t.resolved_at)) : null)),
    h("section", { class: "pergunta", "aria-label": "Pergunta" }, h("div", { class: "corpo" }, renderTexto(t.body))),
    aceitas.map(cartaoResposta),
    h("h2", null, demais.length ? `${textoRespostas(demais.length)}${aceitas.length ? " adicionais" : ""}` : (aceitas.length ? "Outras respostas" : "Respostas")),
    demais.length
      ? demais.map(cartaoResposta)
      : (aceitas.length ? null : h("div", { class: "estado" }, h("strong", null, "Nenhuma resposta ainda"), "Seja a primeira pessoa a ajudar.")),
    blocoResposta));
}

/* ---------- rotas ---------- */

function rotear() {
  tokenRota++;
  limparAvisos();
  const hash = location.hash || "#/";
  let m;
  if (hash === "#/novo") telaNovo();
  else if ((m = hash.match(/^#\/t\/([^/?]+)$/))) telaDetalhe(decodeURIComponent(m[1]));
  else telaLista();
  focarPrincipal();
}

function tratarErroUrl() {
  const url = new URL(location.href);
  const cod = url.searchParams.get("erro");
  if (cod === null) return;
  url.searchParams.delete("erro");
  history.replaceState(null, "", url.pathname + (url.search || "") + url.hash);
  return ERROS_URL[cod] || "Não foi possível concluir o login. Tente novamente.";
}

async function iniciar() {
  const msgUrl = tratarErroUrl();
  window.addEventListener("hashchange", rotear);
  await carregarUsuario();
  rotear();
  if (msgUrl) mostrarAviso(msgUrl);
}

iniciar();
