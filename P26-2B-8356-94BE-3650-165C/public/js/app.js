/**
 * app.js — Interface em JavaScript puro (Vanilla JS, manipulação direta do DOM).
 * As médias são recalculadas no cliente a cada tecla; as notas são salvas no D1 em segundo plano.
 * Módulos de apoio em ./ui/ (DOM seguro, API, diálogos, menu da conta, visão geral do semestre).
 */
import { resumoDisciplina, simular, floor2, TIPOS, TIPO_LABEL } from "./calc.js";
import { $, $$, el, fmt, fmt2, lerNumero, toast, anunciar, icone, ICONES, medidor, telaEstreita, movimentoReduzido } from "./ui/dom.js";
import { api, definirAoExpirar } from "./ui/api.js";
import { abrirDialogo, confirmar } from "./ui/dialogos.js";
import { preencherConta, iniciarMenuConta } from "./ui/conta.js";
import { renderVisaoGeral, renderOnboarding, MODELO_PADRAO } from "./ui/semestre.js";
import { textoSituacao, seloSituacao, siglaSituacao, TOM_SITUACAO, noRestante } from "./ui/situacao.js";

const TITULO_APP = "Simulador de Médias";

// ---------- Estado ----------
const estado = {
  usuario: null,
  disciplinas: [],
  carregado: false,
  selecionadaId: null, // null = visão geral do semestre
  semestreVisao: null,
  simulacao: null, // { disciplinaId, notas: { [avaliacaoId]: number|null } } — nunca é salvo
  pendentes: new Map(), // avaliacaoId -> { timer, enviar }
};

const disciplinaAtual = () => estado.disciplinas.find((d) => d.id === estado.selecionadaId) || null;
const notaTexto = (n) => (n === null || n === undefined ? "" : String(n).replace(".", ","));
const temNota = (a) => a.nota !== null && a.nota !== undefined;
/** Nota no campo com duas casas, como no resto do boletim ("6,50"); vazio continua vazio. */
const notaExibida = (n) => (n === null || n === undefined ? "" : Number(n).toFixed(2).replace(".", ","));
/** Sufixo pequeno da escala quando não é 0–10 ("/100"), para não misturar 55,20 com 5,52. */
const sufixoEscala = (max) => (Number(max) !== 10 ? el("small", { class: "escala-sufixo" }, `/${fmt(max)}`) : null);

function semestreAtual() {
  const d = new Date();
  return `${d.getFullYear()}.${d.getMonth() < 6 ? 1 : 2}`;
}

let timerAnuncio;
function anunciarDepois(msg) {
  clearTimeout(timerAnuncio);
  timerAnuncio = setTimeout(() => anunciar(msg), 700);
}

// ---------- Telas ----------
const TELAS = ["tela-carregando", "tela-erro", "tela-login", "tela-app"];

function mostrarTela(id) {
  for (const t of TELAS) $(`#${t}`).hidden = t !== id;
  $("#perfil").hidden = id !== "tela-app";
  $("#pular").hidden = id !== "tela-app";
}

function limparEstado() {
  for (const p of estado.pendentes.values()) clearTimeout(p.timer);
  estado.pendentes.clear();
  Object.assign(estado, { usuario: null, disciplinas: [], carregado: false, selecionadaId: null, semestreVisao: null, simulacao: null });
  $("#lista-disciplinas").replaceChildren();
  $("#detalhe").replaceChildren();
}

function mostrarLogin(aviso, tipo = "erro") {
  limparEstado();
  mostrarTela("tela-login");
  if (location.hash) history.replaceState(null, "", location.pathname);
  document.title = `Entrar · ${TITULO_APP}`;
  const p = $("#login-aviso");
  p.hidden = !aviso;
  p.className = `aviso aviso-${tipo}`;
  p.textContent = aviso || "";
  if (aviso) $("#login-titulo").focus();
}

function mostrarErro(msg, tentar) {
  mostrarTela("tela-erro");
  document.title = `Erro · ${TITULO_APP}`;
  $("#erro-mensagem").textContent = msg;
  $("#btn-tentar").onclick = tentar;
  $("#erro-titulo").focus();
}

// ---------- Rotas (#/visao-geral e #/disciplina/:id) ----------
function lerRota() {
  const m = /^#\/disciplina\/(\d+)$/.exec(location.hash);
  return m ? Number(m[1]) : null;
}

function irPara(id) {
  const alvo = id === null ? "#/visao-geral" : `#/disciplina/${id}`;
  if (location.hash === alvo) aplicarRota(true);
  else location.hash = alvo; // dispara hashchange -> aplicarRota(true)
}

function aplicarRota(focar) {
  if (!estado.carregado) return;
  let id = lerRota();
  if (id !== null && !estado.disciplinas.some((d) => d.id === id)) {
    id = null;
    history.replaceState(null, "", "#/visao-geral");
  }
  if (estado.simulacao && estado.simulacao.disciplinaId !== id) {
    estado.simulacao = null;
    toast("Simulação descartada.");
  }
  estado.selecionadaId = id;
  const d = disciplinaAtual();
  if (d) estado.semestreVisao = d.semestre;
  marcarItemAtual();
  renderDetalhe();
  if (focar) focarTitulo();
}

window.addEventListener("hashchange", () => {
  if (location.hash.startsWith("#/")) aplicarRota(true);
});

function focarTitulo() {
  const titulo = $("#titulo-pagina");
  if (!titulo) return;
  titulo.focus({ preventScroll: true });
  const topo = $("#detalhe").getBoundingClientRect().top;
  if (topo < 0 || topo > window.innerHeight * 0.5 || telaEstreita()) {
    $("#detalhe").scrollIntoView({ block: "start", behavior: movimentoReduzido() ? "auto" : "smooth" });
  }
}

// ---------- Lista lateral ----------
function renderLista() {
  const nav = $("#lista-disciplinas");
  const filhos = [
    el("a", { class: "item-disciplina item-visao", href: "#/visao-geral", dataset: { id: "visao" } },
      el("span", { class: "item-nome" }, icone(ICONES.grade, 16), estado.disciplinas.length ? "Visão geral" : "Primeiros passos")),
  ];
  if (!estado.disciplinas.length) {
    filhos.push(el("p", { class: "vazio-lista" }, "Nenhuma disciplina ainda."));
  }
  const semestres = [...new Set(estado.disciplinas.map((d) => d.semestre))];
  semestres.forEach((s, i) => {
    const idGrupo = `grupo-semestre-${i}`; // id seguro: o texto do semestre pode ter espaços
    filhos.push(
      el("h3", { class: "grupo-semestre", id: idGrupo }, `Semestre ${s}`),
      el("ul", { class: "lista-itens", "aria-labelledby": idGrupo },
        estado.disciplinas.filter((d) => d.semestre === s).map((d) => el("li", {}, itemLista(d))))
    );
  });
  nav.replaceChildren(...filhos);
  marcarItemAtual();
}

function itemLista(d) {
  const r = d.resumo;
  const media = r.mediaFinal ?? r.mediaParcial;
  return el("a", { class: `item-disciplina tom-${TOM_SITUACAO[r.situacao] || "neutro"}`, href: `#/disciplina/${d.id}`, dataset: { id: d.id },
      "aria-current": d.id === estado.selecionadaId ? "page" : null },
    siglaSituacao(r.situacao),
    el("span", { class: "item-nome" }, d.nome),
    el("span", { class: "item-media" },
      media === null ? "—" : fmt2(media),
      media === null ? null : sufixoEscala(d.nota_maxima),
      el("span", { class: "sr-only" }, `, ${textoSituacao(r.situacao)}`)
    )
  );
}

function marcarItemAtual() {
  for (const a of $$("#lista-disciplinas .item-disciplina")) {
    const atual = a.dataset.id === "visao" ? estado.selecionadaId === null : Number(a.dataset.id) === estado.selecionadaId;
    if (atual) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  }
}

function atualizarItemLista(d) {
  const antigo = $(`.item-disciplina[data-id="${d.id}"]`);
  if (antigo) antigo.replaceWith(itemLista(d));
}

// ---------- Carregamento ----------
function renderEsqueleto() {
  const linha = () => el("div", { class: "esqueleto esqueleto-linha", "aria-hidden": "true" });
  $("#lista-disciplinas").replaceChildren(linha(), linha(), linha(), linha());
  const det = $("#detalhe");
  det.setAttribute("aria-busy", "true");
  det.replaceChildren(
    el("p", { class: "sr-only", role: "status" }, "Carregando suas disciplinas…"),
    el("div", { class: "esqueleto-cabecalho", "aria-hidden": "true" },
      el("div", { class: "esqueleto esqueleto-sobre" }), el("div", { class: "esqueleto esqueleto-titulo" })),
    el("div", { class: "esqueleto-placar", "aria-hidden": "true" },
      el("span", { class: "painel-carregando" }, el("i"), el("i"), el("i"), el("i")),
      el("span", { class: "esqueleto-placar-texto" }, "Atualizando o placar")),
    el("div", { class: "esqueleto-tabela", "aria-hidden": "true" },
      [1, 2, 3, 4].map(() => el("div", { class: "esqueleto esqueleto-linha-tabela" })))
  );
}

function renderErroCarregamento(msg) {
  $("#lista-disciplinas").replaceChildren(el("p", { class: "vazio-lista" }, "Lista indisponível."));
  const det = $("#detalhe");
  det.removeAttribute("aria-busy");
  const botao = el("button", { type: "button", class: "btn btn-primario", onclick: carregarDisciplinas },
    icone(ICONES.recarregar, 18), "Tentar novamente");
  det.replaceChildren(
    el("section", { class: "ficha-estado estado-erro", role: "alert" },
      el("p", { class: "ficha-rotulo" }, "Falha de conexão"),
      el("h1", { id: "titulo-pagina", tabindex: "-1" }, "Não foi possível carregar suas disciplinas"),
      el("p", {}, msg),
      botao
    )
  );
  document.title = `Erro · ${TITULO_APP}`;
  botao.focus();
}

async function carregarDisciplinas() {
  estado.carregado = false;
  renderEsqueleto();
  try {
    const r = await api("/api/disciplinas");
    estado.disciplinas = r.disciplinas;
    for (const d of estado.disciplinas) d.resumo = resumoDisciplina(d); // mesma regra do servidor
    ordenar();
    estado.carregado = true;
    $("#detalhe").removeAttribute("aria-busy");
    renderLista();
    aplicarRota(false);
  } catch (e) {
    if (e.status !== 401) renderErroCarregamento(e.message);
  }
}

// ---------- Painel principal ----------
function renderDetalhe() {
  const area = $("#detalhe");
  const d = disciplinaAtual();
  const sim = d && estado.simulacao?.disciplinaId === d.id ? estado.simulacao : null;
  area.classList.toggle("modo-simulacao", Boolean(sim));

  if (!d) {
    if (!estado.disciplinas.length) {
      renderOnboarding(area, {
        usuario: estado.usuario,
        aoUsarModelo: () => abrirEditor(null, MODELO_PADRAO),
        aoComecarVazio: () => abrirEditor(null, [{ nome: "", tipo: "prova", peso: undefined }]),
      });
      document.title = `Primeiros passos · ${TITULO_APP}`;
      return;
    }
    const semestres = new Set(estado.disciplinas.map((x) => x.semestre));
    if (!semestres.has(estado.semestreVisao)) estado.semestreVisao = estado.disciplinas[0].semestre;
    renderVisaoGeral(area, {
      disciplinas: estado.disciplinas,
      semestre: estado.semestreVisao,
      usuario: estado.usuario,
      aoTrocarSemestre: (s) => {
        estado.semestreVisao = s;
        renderDetalhe();
        $("#seletor-semestre")?.focus();
      },
      aoAbrir: (id) => irPara(id),
      aoNova: () => abrirEditor(null),
    });
    document.title = `Visão geral ${estado.semestreVisao} · ${TITULO_APP}`;
    return;
  }

  const resumo = sim ? simular(d, sim.notas) : d.resumo;
  area.replaceChildren(...[
    el("p", { class: "so-impressao cabecalho-boletim" },
      el("strong", {}, "Boletim da disciplina"),
      ` · ${estado.usuario?.username ?? ""} (ID Discord ${estado.usuario?.user_id ?? ""}) · emitido em `,
      el("span", { class: "data-emissao" }, new Date().toLocaleString("pt-BR"))),
    cartaoTopo(d, sim),
    sim ? faixaSimulacao(d) : null,
    el("div", { id: "area-resumo", class: "area-resumo" }),
    el("div", { class: "grade-detalhe" },
      tabelaNotas(d, sim),
      el("div", { id: "area-tipos", class: "folha folha-tipos" }))
  ].filter(Boolean));
  atualizarResumo(d, resumo);
  document.title = `${sim ? "Simulação · " : ""}${d.nome} · ${TITULO_APP}`;
}

function cartaoTopo(d, sim) {
  const semRestantes = d.resumo.restantes === 0;
  const imprimir = () => window.print();
  return el("div", { class: "cabecalho-pagina cabecalho-disciplina" },
    el("div", { class: "detalhe-topo" },
      el("nav", { class: "trilha", "aria-label": "Trilha de navegação" },
        el("a", { class: "voltar", href: "#/visao-geral" }, icone(ICONES.setaEsquerda, 16), "Visão geral"),
        el("span", { class: "trilha-sep", "aria-hidden": "true" }, "/"),
        el("span", { class: "trilha-atual" }, `Semestre ${d.semestre}`)),
      el("div", { class: "titulo-linha" },
        el("h1", { id: "titulo-pagina", tabindex: "-1" }, d.nome),
        el("span", { id: "selo-pagina", class: "selo-pagina" })),
      el("div", { class: "detalhe-barra" },
        el("ul", { class: "regras", "aria-label": "Regras da disciplina" },
          regra("Nota máx.", fmt(d.nota_maxima)),
          regra("Aprovação direta", `≥ ${fmt(d.media_aprovacao)}`, "regra-ok"),
          regra("Exame", `≥ ${fmt(d.media_minima_exame)}`, "regra-alerta"),
          regra("Pós-exame", `≥ ${fmt(d.media_final_exame)}`)
        ),
      el("div", { class: "acoes" },
        el("button", {
          id: "btn-simular", type: "button",
          class: `btn btn-pequeno ${sim ? "btn-simulacao-ativo" : "btn-simulacao"}`,
          "aria-pressed": sim ? "true" : "false",
          disabled: semRestantes && !sim,
          title: semRestantes ? "Todas as avaliações já têm nota" : "Testar notas hipotéticas sem salvar",
          onclick: () => (sim ? sairSimulacao() : entrarSimulacao(d)),
        }, icone(ICONES.frasco, 16), "E se…?"),
        sim ? null : el("button", { type: "button", class: "btn btn-secundario btn-pequeno", onclick: () => abrirEditor(d) },
          icone(ICONES.lapis, 16), "Editar fórmula"),
        el("button", { type: "button", class: "btn btn-secundario btn-pequeno acao-sec", onclick: imprimir },
          icone(ICONES.impressora, 16), "Imprimir"),
        sim ? null : el("button", { type: "button", class: "btn btn-perigo btn-pequeno acao-sec", onclick: () => excluir(d) },
          icone(ICONES.lixeira, 16), "Excluir"),
        // No celular, Imprimir e Excluir ficam num menu "⋯" (mesmo padrão de teclado do menu da conta).
        menuMais([
          ["Imprimir boletim", ICONES.impressora, imprimir],
          sim ? null : ["Excluir disciplina", ICONES.lixeira, () => excluir(d), true],
        ].filter(Boolean))
      ))
    )
  );
}

/** Uma célula da ficha de regras: rótulo pequeno em caixa alta + valor. */
function regra(rotulo, valor, classe = "") {
  return el("li", { class: `regra ${classe}`.trim() },
    el("span", { class: "regra-rotulo" }, rotulo), " ", el("strong", { class: "regra-valor" }, valor));
}

/** Menu "Mais ações" (disclosure): botão com aria-expanded + lista; setas, Home/End, Esc e clique fora fecham. */
function menuMais(itens) {
  const botao = el("button", { type: "button", class: "btn btn-secundario btn-pequeno btn-mais",
    "aria-expanded": "false", "aria-controls": "menu-mais", "aria-label": "Mais ações" }, icone(ICONES.reticencias, 18));
  const lista = el("ul", { id: "menu-mais", class: "menu-conta menu-mais menu-itens", hidden: true });
  const botoes = () => $$("button", lista);
  const foraDoMenu = (e) => { if (!lista.contains(e.target) && !botao.contains(e.target)) fechar(false); };
  function abrir(primeiro = true) {
    lista.hidden = false;
    botao.setAttribute("aria-expanded", "true");
    document.addEventListener("pointerdown", foraDoMenu);
    (primeiro ? botoes()[0] : botoes().at(-1))?.focus();
  }
  function fechar(devolverFoco = true) {
    if (lista.hidden) return;
    lista.hidden = true;
    botao.setAttribute("aria-expanded", "false");
    document.removeEventListener("pointerdown", foraDoMenu);
    if (devolverFoco) botao.focus();
  }
  for (const [rotulo, ic, acao, perigo] of itens) {
    lista.append(el("li", {}, el("button", { type: "button", class: `menu-item${perigo ? " menu-item-perigo" : ""}`,
      onclick: () => { fechar(); acao(); } }, icone(ic, 18), rotulo)));
  }
  botao.addEventListener("click", () => (lista.hidden ? abrir() : fechar()));
  botao.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); abrir(true); }
    if (e.key === "ArrowUp") { e.preventDefault(); abrir(false); }
  });
  lista.addEventListener("keydown", (e) => {
    const l = botoes();
    const i = l.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); fechar(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); l[(i + 1) % l.length].focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); l[(i - 1 + l.length) % l.length].focus(); }
    else if (e.key === "Home") { e.preventDefault(); l[0].focus(); }
    else if (e.key === "End") { e.preventDefault(); l.at(-1).focus(); }
  });
  lista.addEventListener("focusout", (e) => {
    if (e.relatedTarget && !lista.contains(e.relatedTarget) && e.relatedTarget !== botao) fechar(false);
  });
  return el("div", { class: "mais-acoes" }, botao, lista);
}

// ---------- Modo simulação ("E se…?") ----------
function faixaSimulacao(d) {
  return el("section", { class: "faixa-simulacao", "aria-labelledby": "titulo-simulacao" },
    el("span", { class: "fs-fita", "aria-hidden": "true" }, "Simulação"),
    el("div", { class: "fs-texto" },
      el("h2", { id: "titulo-simulacao" }, "Simulação — não salvo"),
      el("p", {}, "Digite notas hipotéticas nas avaliações sem nota. Nada é enviado ao servidor; suas notas reais continuam como estão.")
    ),
    el("div", { class: "fs-acoes" },
      el("button", { id: "btn-preencher", type: "button", class: "btn btn-secundario btn-pequeno", onclick: () => preencherMinima(d) }, "Preencher com a mínima"),
      el("button", { id: "btn-limpar-sim", type: "button", class: "btn btn-secundario btn-pequeno", onclick: () => limparSimulacao() }, "Limpar"),
      el("button", { type: "button", class: "btn btn-pequeno btn-sair-sim", onclick: () => sairSimulacao() }, icone(ICONES.fechar, 16), "Sair e descartar")
    )
  );
}

/** Mantém o botão "E se…?" coerente com as notas enquanto o aluno digita (sem redesenhar a tela). */
function atualizarBotaoSimular(d) {
  const b = $("#btn-simular");
  if (!b || estado.simulacao) return;
  const semRestantes = d.resumo.restantes === 0;
  b.disabled = semRestantes;
  b.title = semRestantes ? "Todas as avaliações já têm nota" : "Testar notas hipotéticas sem salvar";
}

function entrarSimulacao(d) {
  if (d.resumo.restantes === 0) return;
  estado.simulacao = { disciplinaId: d.id, notas: {} };
  renderDetalhe();
  anunciar("Modo simulação ativado. As notas digitadas não serão salvas.");
  $("#detalhe .entrada-nota")?.focus();
}

function sairSimulacao() {
  estado.simulacao = null;
  renderDetalhe();
  anunciar("Simulação encerrada. As notas hipotéticas foram descartadas.");
  const b = $("#btn-simular");
  (b && !b.disabled ? b : $("#titulo-pagina"))?.focus();
}

function limparSimulacao() {
  if (!estado.simulacao) return;
  estado.simulacao.notas = {};
  renderDetalhe();
  $("#detalhe .entrada-nota")?.focus();
}

function preencherMinima(d) {
  const r = d.resumo.aprovacao;
  if (!r || r.status === "garantido") {
    toast("A aprovação direta já está garantida — qualquer nota serve.");
    return;
  }
  const nota = r.status === "possivel" ? r.nota : Number(d.nota_maxima);
  if (r.status === "impossivel") toast("Aprovação direta é impossível; simulando nota máxima no que falta.");
  const notas = {};
  for (const a of d.avaliacoes) if (!temNota(a)) notas[a.id] = nota;
  estado.simulacao.notas = notas;
  renderDetalhe();
  $("#btn-preencher")?.focus();
}

function aoDigitarSimulada(d, a, input, status) {
  const v = lerNumero(input.value);
  const valido = v === null || (Number.isFinite(v) && v >= 0 && v <= d.nota_maxima);
  input.classList.toggle("invalida", !valido);
  input.setAttribute("aria-invalid", valido ? "false" : "true");
  if (!valido) {
    status.textContent = `0 a ${fmt(d.nota_maxima)}`;
    status.classList.add("erro-salvar");
    return;
  }
  status.classList.remove("erro-salvar");
  const notas = estado.simulacao.notas;
  if (v === null) delete notas[a.id];
  else notas[a.id] = Math.round(v * 100) / 100;
  status.textContent = v === null ? "" : "simulada";
  atualizarResumo(d, simular(d, notas));
}

// ---------- Tabela de notas ----------
function tabelaNotas(d, sim) {
  const tbody = el("tbody");
  const pesoTotal = d.avaliacoes.reduce((s, a) => s + Number(a.peso), 0) || 1;
  for (const a of d.avaliacoes) {
    const status = el("span", { class: "estado-salvo", "aria-live": sim ? null : "polite" });
    let celulaNota;
    if (sim && temNota(a)) {
      celulaNota = el("span", { class: "nota-fixa", title: "Nota lançada (não muda na simulação)" }, fmt2(a.nota));
      status.textContent = "lançada";
    } else {
      const input = el("input", {
        class: `entrada-nota${sim ? " simulada" : ""}`,
        type: "text",
        inputmode: "decimal",
        autocomplete: "off",
        value: sim ? notaExibida(sim.notas[a.id]) : notaExibida(a.nota),
        "aria-label": sim ? `Nota hipotética de ${a.nome}` : `Nota de ${a.nome}`,
        dataset: { avaliacao: a.id },
      });
      if (sim) {
        if (sim.notas[a.id] !== undefined) status.textContent = "simulada";
        input.addEventListener("input", () => aoDigitarSimulada(d, a, input, status));
      } else {
        input.addEventListener("input", () => aoDigitarNota(d, a, input, status));
        input.addEventListener("blur", () => salvarAgora(a, input));
      }
      // Só a exibição: ao sair do campo, "6,5" vira "6,50" (o valor salvo/simulado não muda; não dispara "input").
      input.addEventListener("blur", () => {
        const v = lerNumero(input.value);
        if (v !== null && Number.isFinite(v) && !input.classList.contains("invalida")) input.value = notaExibida(v);
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const todos = $$("#detalhe .entrada-nota");
          (todos[todos.indexOf(input) + 1] || input).focus();
        }
      });
      celulaNota = input;
    }
    // Linha de boletim: "PROVA  Prova 1 ............ [nota]" — o pontilhado leva o olho do nome à nota.
    tbody.append(el("tr", {},
      el("th", { scope: "row", class: "col-nome" },
        el("span", { class: "lider" },
          el("span", { class: `tipo tipo-${a.tipo}` }, a.tipo),
          el("span", { class: "lider-texto" }, a.nome))),
      el("td", { class: "num col-nota" }, celulaNota),
      // Um número só: a participação na média (igual ao peso quando os pesos somam 100).
      el("td", { class: "num col-peso", title: `peso ${fmt(a.peso)}` }, `${fmt((a.peso / pesoTotal) * 100, 1)}%`),
      el("td", { class: "col-status" }, status)
    ));
  }
  return el("section", { class: "folha folha-notas", "aria-labelledby": "titulo-notas" },
    el("div", { class: "folha-cabecalho" },
      el("h2", { id: "titulo-notas", class: "titulo-secao" }, sim ? "Boletim · simulação" : "Boletim de notas"),
      el("span", { id: "contagem-notas", class: "contagem" })),
    el("div", { class: "rolagem-tabela" },
      el("table", { class: "tabela-notas" },
        el("caption", { class: "sr-only" }, `Avaliações de ${d.nome}`),
        el("thead", {}, el("tr", {},
          el("th", { scope: "col" }, "Avaliação"),
          el("th", { scope: "col", class: "num" }, "Nota"),
          el("th", { scope: "col", class: "num col-peso" }, "Peso"),
          el("th", { scope: "col", class: "col-status" }, el("span", { class: "sr-only" }, "Situação do salvamento"))
        )),
        tbody
      )
    ),
    el("p", { class: "legenda" }, el("span", {}, sim
      ? "As notas lançadas ficam fixas. Nos campos vazios aparece a nota mínima que ainda falta para a aprovação direta."
      : "Deixe em branco o que ainda não foi feito. Nos campos vazios aparece a nota mínima para aprovação direta. Use vírgula ou ponto: 7,5. Enter vai para a próxima nota."))
  );
}

function aoDigitarNota(d, a, input, status) {
  const v = lerNumero(input.value);
  const valido = v === null || (Number.isFinite(v) && v >= 0 && v <= d.nota_maxima);
  input.classList.toggle("invalida", !valido);
  input.setAttribute("aria-invalid", valido ? "false" : "true");
  if (!valido) {
    status.textContent = `0 a ${fmt(d.nota_maxima)}`;
    status.classList.add("erro-salvar");
    const p = estado.pendentes.get(a.id);
    if (p) { clearTimeout(p.timer); estado.pendentes.delete(a.id); }
    return;
  }
  a.nota = v === null ? null : Math.round(v * 100) / 100;
  d.resumo = resumoDisciplina(d); // cálculo instantâneo no cliente
  atualizarResumo(d, d.resumo);
  atualizarItemLista(d);
  atualizarBotaoSimular(d);

  status.classList.remove("erro-salvar");
  status.removeAttribute("title");
  status.textContent = "…";
  const anterior = estado.pendentes.get(a.id);
  if (anterior) clearTimeout(anterior.timer);
  const enviar = () => enviarNota(d, a, status);
  estado.pendentes.set(a.id, { timer: setTimeout(enviar, 700), enviar });
}

function salvarAgora(a, input) {
  const p = estado.pendentes.get(a.id);
  if (!p || input.classList.contains("invalida")) return;
  clearTimeout(p.timer);
  p.enviar();
}

async function enviarNota(d, a, status) {
  estado.pendentes.delete(a.id);
  const nota = a.nota;
  status.textContent = "salvando…";
  try {
    const r = await api(`/api/avaliacoes/${a.id}`, { method: "PATCH", body: { nota } });
    if (a.nota === nota) status.textContent = "✓ salvo";
    // Confere o cálculo do servidor (mesma regra); mantém o que o usuário digitou depois.
    const servidor = r.disciplina.avaliacoes.find((x) => x.id === a.id);
    if (servidor && servidor.nota !== nota && a.nota === nota) a.nota = servidor.nota;
    setTimeout(() => { if (status.textContent === "✓ salvo") status.textContent = ""; }, 2000);
  } catch (e) {
    status.textContent = "erro";
    status.classList.add("erro-salvar");
    status.title = e.message;
    if (e.status !== 401) toast(`Não foi possível salvar a nota: ${e.message}`, "erro");
  }
}

async function salvarPendentes() {
  const lista = [...estado.pendentes.values()];
  lista.forEach((p) => clearTimeout(p.timer));
  await Promise.allSettled(lista.map((p) => p.enviar()));
}

// ---------- Resumo (faixa, métricas e metas) ----------
function classeMeta(r, notaMax) {
  if (!r) return "";
  if (r.status === "possivel" && r.nota > notaMax * 0.85) return "dificil";
  return r.status;
}

function valorMeta(r) {
  if (!r) return "—";
  if (r.status === "garantido") return "✓";
  if (r.status === "impossivel") return "✗";
  return fmt2(r.nota);
}

function textoFaixa(d, r) {
  const max = d.nota_maxima;
  const nasRestantes = noRestante(r.restantes);
  switch (r.situacao) {
    case "aprovado":
      return ["ok", "checkCirculo", r.mediaFinal !== null ? "Aprovação direta!" : "Aprovação direta garantida",
        r.mediaFinal !== null
          ? `Média final ${fmt2(r.mediaFinal)} — mínimo para aprovação direta: ${fmt(d.media_aprovacao)}.`
          : `Mesmo tirando zero ${nasRestantes}, sua média fica em pelo menos ${fmt2(r.pontosGarantidos)}.`];
    case "em_andamento":
      return ["info", "alvo", `Precisa de ${fmt2(r.aprovacao.nota)} de média no que falta`,
        `Tirando pelo menos ${fmt2(r.aprovacao.nota)} ${nasRestantes} você passa direto, sem exame. ` +
        (r.evitarReprovacao.status === "garantido"
          ? "Reprovação direta já está descartada."
          : `Abaixo de ${fmt2(r.evitarReprovacao.nota)} você reprova sem direito a exame.`)];
    case "exame_inevitavel":
      return ["alerta", "alerta", "Aprovação direta não é mais possível",
        `Mesmo tirando ${fmt(max)} em tudo, a média máxima é ${fmt2(r.mediaMaxima)}. ` +
        (r.evitarReprovacao.status === "garantido"
          ? "O exame final já está garantido."
          : `Tire pelo menos ${fmt2(r.evitarReprovacao.nota)} ${nasRestantes} para ter direito ao exame.`)];
    case "exame":
      return ["alerta", "livro", "Exame final",
        r.exame.status === "impossivel"
          ? `Média ${fmt2(r.mediaFinal)}: seria preciso ${fmt2(r.exame.nota)} no exame, acima da nota máxima.`
          : `Média ${fmt2(r.mediaFinal)}. Você precisa de ${fmt2(r.exame.nota)} no exame para chegar a ${fmt(d.media_final_exame)}.`];
    case "reprovado":
      return ["perigo", "xCirculo", "Reprovação direta",
        r.mediaFinal !== null
          ? `Média final ${fmt2(r.mediaFinal)}, abaixo de ${fmt(d.media_minima_exame)} (mínimo para exame).`
          : `Mesmo com ${fmt(max)} no que falta, a média máxima é ${fmt2(r.mediaMaxima)}.`];
    default:
      return ["info", "info", "Sem avaliações", "Edite a fórmula para cadastrar avaliações."];
  }
}

const ROTULO_META = { garantido: "Garantido", possivel: "Alcançável", dificil: "Exige esforço", impossivel: "Inalcançável" };
const pctEscala = (v, max) => Math.max(0, Math.min(100, (Number(v) / Number(max)) * 100));

/**
 * O que o placar mostra em cada situação.
 * - duelo AGORA → META na mesma escala (no exame: média pós-exame com o exame zerado → média pós-exame exigida);
 * - herói: ou o número que o aluno PRECISA TIRAR (o maior da tela), ou um carimbo quando não há nota a perseguir;
 * - fato: uma frase curta que não repete o número do herói.
 */
function jogoDoPlacar(d, r) {
  const max = d.nota_maxima;
  const restantes = r.restantes === 1 ? "1 avaliação restante" : `${r.restantes} avaliações restantes`;
  const parcial = r.mediaFinal ?? r.mediaParcial;
  const base = { agora: parcial, agoraRotulo: r.mediaFinal !== null ? "média final" : parcial === null ? "sem notas ainda" : "média parcial" };
  const numero = (valor, rotulo, leg) => ({ tipo: "numero", valor: fmt2(valor), rotulo, leg });
  const carimbo = (texto, tom, rotulo, leg) => ({ tipo: "carimbo", texto, tom, rotulo, leg });
  switch (r.situacao) {
    case "aprovado":
      return { ...base, meta: d.media_aprovacao, metaRotulo: "aprovação direta",
        heroi: r.mediaFinal !== null
          ? carimbo("Aprovado", "ok", "Resultado", "aprovação direta, sem exame")
          : carimbo("Garantido", "ok", "Precisa tirar", `nada: mesmo zerando ${r.restantes === 1 ? "a avaliação restante" : `as ${restantes}`}, a aprovação direta está garantida`),
        fato: r.mediaFinal !== null
          ? `Média final ${fmt2(r.mediaFinal)}; o mínimo para aprovação direta era ${fmt(d.media_aprovacao)}.`
          : `Mesmo zerando o que falta, a média final fica em pelo menos ${fmt2(r.pontosGarantidos)}.` };
    case "em_andamento":
      return { ...base, meta: d.media_aprovacao, metaRotulo: "aprovação direta",
        heroi: numero(r.aprovacao.nota, "Precisa tirar", `média mínima no que falta (${restantes}) para passar direto`),
        fato: r.evitarReprovacao.status === "garantido"
          ? "Reprovação direta já está descartada: no pior caso, exame."
          : `Abaixo de ${fmt2(r.evitarReprovacao.nota)} de média no que falta, reprovação direta sem exame.` };
    case "exame_inevitavel":
      return { ...base, meta: d.media_minima_exame, metaRotulo: "ir ao exame",
        heroi: r.evitarReprovacao.status === "garantido"
          ? carimbo("Exame", "alerta", "Situação", "exame final garantido; aprovação direta fora de alcance")
          : numero(r.evitarReprovacao.nota, "Precisa tirar", `média mínima no que falta (${restantes}) para ter direito ao exame`),
        fato: `Aprovação direta fora de alcance: mesmo com ${fmt(max)} em tudo, a média máxima é ${fmt2(r.mediaMaxima)}.` };
    case "exame": {
      // Mesma escala dos dois lados: (média + exame) ÷ 2. "Agora" é esse valor com o exame zerado.
      const semExame = floor2(r.mediaFinal / 2);
      return { agora: semExame, agoraRotulo: "pós-exame com o exame zerado", meta: d.media_final_exame, metaRotulo: "média pós-exame",
        heroi: r.exame.status === "impossivel"
          ? carimbo("Sem chance", "perigo", "No exame", `seria preciso ${fmt2(r.exame.nota)}, acima da nota máxima (${fmt(max)})`)
          : numero(r.exame.nota, "Precisa tirar no exame", `para (média ${fmt2(r.mediaFinal)} + exame) ÷ 2 chegar a ${fmt(d.media_final_exame)}`),
        fato: `Média final ${fmt2(r.mediaFinal)}: abaixo de ${fmt(d.media_aprovacao)}, vai para o exame final.` };
    }
    case "reprovado":
      return { ...base, meta: d.media_minima_exame, metaRotulo: "ir ao exame",
        heroi: carimbo(r.mediaFinal !== null ? "Reprovação" : "Sem chance", "perigo", "Situação",
          r.mediaFinal !== null ? `média final abaixo de ${fmt(d.media_minima_exame)} (mínimo para exame)` : "nenhuma nota no que falta leva ao exame"),
        fato: r.mediaFinal !== null
          ? `Média final ${fmt2(r.mediaFinal)}.`
          : `Mesmo com ${fmt(max)} no que falta, a média máxima é ${fmt2(r.mediaMaxima)}.` };
    default:
      return { ...base, meta: null, metaRotulo: "sem fórmula",
        heroi: carimbo("Sem fórmula", "neutro", "Situação", "cadastre as avaliações na fórmula"),
        fato: "Edite a fórmula para cadastrar avaliações." };
  }
}

// Últimos números mostrados no placar, para "virar a placa" só do que mudou.
const ultimoPlacar = new Map();

function numeroPlacar(chave, valor, classe = "") {
  const mudou = ultimoPlacar.has(chave) && ultimoPlacar.get(chave) !== valor;
  ultimoPlacar.set(chave, valor);
  return el("span", { class: `placar-num ${classe}${mudou && !movimentoReduzido() ? " virou" : ""}`.trim() }, valor);
}

/** Painel principal: AGORA → META e, em destaque máximo, PRECISA TIRAR (ou um carimbo). */
function placar(d, r, sim) {
  const tom = TOM_SITUACAO[r.situacao] || "neutro";
  const jogo = jogoDoPlacar(d, r);
  const max = d.nota_maxima;
  const chave = `${d.id}:${sim ? "s" : "r"}`;
  const acima = jogo.agora !== null && jogo.meta !== null && jogo.agora >= jogo.meta;
  const h = jogo.heroi;
  return el("section", { class: `placar placar-${tom}`, "aria-labelledby": "titulo-placar" },
    el("header", { class: "placar-cabeca" },
      el("h2", { id: "titulo-placar", class: "placar-titulo" }, sim ? "Placar simulado" : "Placar"),
      el("span", { class: "placar-escala" }, `Escala 0–${fmt(max)}`),
      el("span", { class: "placar-avaliado" },
        el("span", {}, `Avaliado ${fmt(r.percentualAvaliado, 0)}%`),
        medidor(r.percentualAvaliado, 10, "medidor-placar"))),
    el("div", { class: "placar-grade" },
      el("div", { class: "placar-duelo" },
        el("div", { class: "placar-celula placar-agora" },
          el("span", { class: "placar-rot" }, "Agora"),
          numeroPlacar(`${chave}:agora`, jogo.agora === null ? "—" : fmt2(jogo.agora)),
          el("span", { class: "placar-leg" }, jogo.agoraRotulo)),
        acima
          ? el("div", { class: "placar-seta placar-seta-ok" },
            el("span", { class: "placar-ok-marca", "aria-hidden": "true" }, "✓"),
            el("span", { class: "placar-ok-texto" }, r.restantes === 0 ? "meta batida" : "acima da meta, por enquanto"))
          : el("div", { class: "placar-seta", "aria-hidden": "true" }),
        el("div", { class: "placar-celula placar-meta" },
          el("span", { class: "placar-rot" }, "Meta"),
          numeroPlacar(`${chave}:meta`, jogo.meta === null ? "—" : fmt2(jogo.meta)),
          el("span", { class: "placar-leg" }, jogo.metaRotulo))),
      el("div", { class: `placar-celula placar-falta${h.tipo === "carimbo" ? " placar-falta-carimbo" : ""}` },
        el("span", { class: "placar-rot" }, h.rotulo),
        h.tipo === "numero"
          ? numeroPlacar(`${chave}:falta`, h.valor, "placar-num-falta")
          : el("span", { class: `selo selo-${h.tom} placar-carimbo` }, h.texto),
        el("span", { class: "placar-leg" }, h.leg))
    ),
    el("p", { class: "placar-rodape" }, jogo.fato)
  );
}

function atualizarResumo(d, r) {
  const area = $("#area-resumo");
  if (!area) return;
  const sim = estado.simulacao?.disciplinaId === d.id;
  const max = d.nota_maxima;
  const [, , titulo, texto] = textoFaixa(d, r);

  const metricas = el("div", { class: "metricas" },
    metrica("Média parcial", r.mediaParcial === null ? "—" : fmt2(r.mediaParcial), "só das avaliações já feitas"),
    metrica("Pontos garantidos", fmt2(r.pontosGarantidos), "na média final, se zerar o resto"),
    metrica("Máximo possível", fmt2(r.mediaMaxima), `tirando ${fmt(max)} no que falta`),
    metrica("Peso avaliado", `${fmt(r.percentualAvaliado, 0)}%`,
      r.restantes === 0 ? "todas as avaliações com nota" : r.restantes === 1 ? "1 avaliação sem nota" : `${r.restantes} avaliações sem nota`)
  );

  // Em exame, o número que importa vem primeiro e as metas já perdidas ficam em tom neutro.
  const emExame = r.situacao === "exame" || r.situacao === "exame_inevitavel";
  const classeOrdem = (m) => classeMeta(m, max) + (emExame && m?.status === "impossivel" ? " encerrada" : "");
  const metaAprov = meta("Aprovação direta", "sem exame", r.aprovacao, classeOrdem(r.aprovacao),
    descricaoMeta(r.aprovacao, r, d.media_aprovacao), max);
  const metaEvitar = meta("Evitar reprovação", "ir ao exame", r.evitarReprovacao, classeOrdem(r.evitarReprovacao),
    descricaoMeta(r.evitarReprovacao, r, d.media_minima_exame), max);
  const metaExame = r.exame && meta("Exame final", "nota no exame", r.exame, classeMeta(r.exame, max),
    `(média ${fmt2(r.mediaFinal)} + exame) ÷ 2 ≥ ${fmt(d.media_final_exame)}`, max);
  const metas = el("section", { class: "metas-bloco", "aria-labelledby": "titulo-metas" },
    el("h2", { id: "titulo-metas", class: "titulo-secao" }, "Notas mínimas no que falta"),
    el("div", { class: "metas" },
      metaExame ? [metaExame, metaEvitar, metaAprov] : emExame ? [metaEvitar, metaAprov] : [metaAprov, metaEvitar]));

  area.replaceChildren(...[
    placar(d, r, sim),
    el("section", { class: "folha painel-media", "aria-labelledby": "titulo-painel-media" },
      el("div", { class: "folha-cabecalho" },
        el("h2", { id: "titulo-painel-media", class: "titulo-secao" }, "Onde sua média pode terminar"),
        el("span", { class: "contagem" }, `Escala 0–${fmt(max)}`)),
      regua(d, r),
      metricas
    ),
    r.restantes > 0 || r.exame ? metas : null,
  ].filter(Boolean));
  anunciarDepois(`${sim ? "Simulação: " : ""}${titulo}. ${texto}`);

  // Carimbo de situação ao lado do título e contagem de notas (acompanham a digitação)
  const seloPagina = $("#selo-pagina");
  if (seloPagina) {
    seloPagina.replaceChildren(seloSituacao(r.situacao));
    seloPagina.classList.toggle("selo-simulado", sim);
    seloPagina.title = sim ? "Situação simulada" : "";
  }
  const contagem = $("#contagem-notas");
  if (contagem) contagem.textContent = `${d.avaliacoes.length - r.restantes}/${d.avaliacoes.length} com nota`;

  // Placeholders nos campos vazios = nota mínima para aprovação direta
  const ph = r.aprovacao?.status === "possivel" ? `mín. ${fmt2(r.aprovacao.nota)}`
    : r.aprovacao?.status === "garantido" ? "garantido" : "—";
  for (const input of $$("#detalhe .entrada-nota")) input.placeholder = ph;

  renderTipos(d, r);
}

/**
 * Régua 0–máx em faixas REPROVADO | EXAME | APROVADO, com "▲ você está aqui" (média atual)
 * e "▲ máximo possível"; a linha abaixo das faixas é o intervalo em que a média final ainda pode cair.
 */
function regua(d, r) {
  const max = d.nota_maxima;
  const ex = pctEscala(d.media_minima_exame, max);
  const ap = pctEscala(d.media_aprovacao, max);
  const ini = pctEscala(r.pontosGarantidos, max);
  const fim = pctEscala(r.mediaMaxima, max);
  const atual = r.mediaFinal ?? r.mediaParcial;
  const concluida = r.restantes === 0;
  const descricao = concluida
    ? `Média final ${fmt2(r.mediaFinal)}.`
    : `A média final vai ficar entre ${fmt2(r.pontosGarantidos)} e ${fmt2(r.mediaMaxima)}.`;
  return el("div", { class: "regua-bloco",
      style: `--ex:${ex}%;--ap:${ap}%;--ini:${ini}%;--fim:${fim}%;--atual:${atual === null ? 0 : pctEscala(atual, max)}%` },
    el("p", { class: "regua-titulo" }, descricao),
    el("div", { class: "regua-escala", "aria-hidden": "true" },
      el("span", { class: "re-zero" }, "0"),
      el("span", { class: "re-exame" }, fmt(d.media_minima_exame)),
      el("span", { class: "re-aprov" }, fmt(d.media_aprovacao)),
      el("span", { class: "re-max" }, fmt(max))),
    el("div", { class: "regua", role: "img",
      "aria-label": `${descricao} Reprovação abaixo de ${fmt(d.media_minima_exame)}; exame de ${fmt(d.media_minima_exame)} até abaixo de ${fmt(d.media_aprovacao)}; aprovação direta a partir de ${fmt(d.media_aprovacao)}.` },
      el("span", { class: "rz rz-perigo" }, el("span", { class: "rz-rot" }, "Reprovado")),
      el("span", { class: "rz rz-alerta" }, el("span", { class: "rz-rot" }, "Exame")),
      el("span", { class: "rz rz-ok" }, el("span", { class: "rz-rot" }, "Aprovado")),
      // Hachura = trecho da régua que a média final já não alcança (abaixo do garantido, acima do máximo).
      concluida ? null : [el("span", { class: "rf rf-esq" }), el("span", { class: "rf rf-dir" })]),
    el("div", { class: "regua-marcas", "aria-hidden": "true" },
      atual === null ? null : el("div", { class: "rm rm-atual" },
        el("span", { class: "rm-txt" }, concluida ? `Média final ${fmt2(atual)}` : `No ritmo atual · ${fmt2(atual)}`)),
      concluida ? null : el("div", { class: "rm rm-max" },
        el("span", { class: "rm-txt" }, `Máximo possível · ${fmt2(r.mediaMaxima)}`))),
    concluida ? null : el("p", { class: "regua-legenda", "aria-hidden": "true" },
      el("span", { class: "leg-hachura" }), "trecho que a sua média final já não alcança")
  );
}

function descricaoMeta(m, r, alvo) {
  if (!m) return "";
  const nasRestantes = noRestante(r.restantes);
  if (r.restantes === 0) {
    return m.status === "garantido" ? `Média final ≥ ${fmt(alvo)}` : `Média final abaixo de ${fmt(alvo)}`;
  }
  if (m.status === "garantido") return `Já garantido: média ≥ ${fmt(alvo)} mesmo zerando o resto.`;
  if (m.status === "impossivel") return `Inalcançável: exigiria ${fmt2(m.nota)} ${r.restantes === 1 ? "na avaliação restante" : `em cada uma das ${r.restantes} avaliações restantes`}.`;
  return `Média mínima ${nasRestantes} para fechar com ${fmt(alvo)}.`;
}

function metrica(rotulo, valor, dica) {
  return el("div", { class: "metrica" },
    el("div", { class: "metrica-rotulo" }, rotulo),
    el("div", { class: "metrica-valor" }, valor),
    el("div", { class: "metrica-dica" }, dica)
  );
}

function meta(titulo, subtitulo, m, classe, texto, max) {
  const numerico = m && m.status !== "garantido" && m.status !== "impossivel";
  return el("div", { class: `meta ${classe}` },
    el("div", { class: "meta-topo" },
      el("div", { class: "meta-titulo" }, titulo, el("span", { class: "meta-sub" }, ` · ${subtitulo}`)),
      numerico ? el("span", { class: "meta-tag" }, ROTULO_META[classe.split(" ")[0]] || "") : null),
    el("div", { class: "meta-valor" },
      numerico ? el("span", {}, valorMeta(m)) : el("span", { class: "meta-valor-texto" }, ROTULO_META[m?.status] || "—"),
      numerico ? el("span", { class: "meta-escala" }, `/ ${fmt(max)}`) : null),
    el("p", { class: "meta-texto" }, texto)
  );
}

function renderTipos(d, r) {
  const area = $("#area-tipos");
  if (!area) return;
  const linhas = TIPOS.filter((t) => r.porTipo[t]?.qtd > 0).map((t) => {
    const pt = r.porTipo[t];
    const pct = pt.media === null ? 0 : (pt.media / d.nota_maxima) * 100;
    return el("div", { class: "tipo-linha" },
      el("div", { class: "tipo-linha-topo" },
        el("span", { class: `tipo tipo-${t}` }, TIPO_LABEL[t]),
        el("span", { class: "tipo-peso" }, `${fmt(pt.percentual, 0)}% da média`),
        el("span", { class: "num tipo-media" }, pt.media === null ? "—" : fmt2(pt.media))),
      el("div", { class: "barra", role: "img", "aria-label": `${TIPO_LABEL[t]}: média ${pt.media === null ? "sem notas" : fmt2(pt.media)}` },
        el("span", { class: `seg-tipo-${t}`, style: `width:${pct}%` }))
    );
  });
  area.replaceChildren(
    el("div", { class: "folha-cabecalho" }, el("h2", { class: "titulo-secao" }, "Desempenho por tipo")),
    el("div", { class: "tipos" }, linhas));
}

// ---------- Excluir disciplina ----------
async function excluir(d) {
  const ok = await confirmar({
    titulo: "Excluir disciplina",
    mensagem: [`Excluir “${d.nome}” e todas as notas dela? Essa ação não pode ser desfeita.`],
    rotulo: "Excluir disciplina",
    acao: () => api(`/api/disciplinas/${d.id}`, { method: "DELETE" }),
  });
  if (!ok) return;
  estado.disciplinas = estado.disciplinas.filter((x) => x.id !== d.id);
  renderLista();
  irPara(null);
  toast("Disciplina excluída.", "ok");
}

// ---------- Editor de disciplina (fórmula) ----------
const editor = $("#editor");
const form = $("#form-disciplina");
let editando = null;

function abrirEditor(d, modelo = MODELO_PADRAO) {
  editando = d;
  $("#editor-titulo").textContent = d ? `Editar ${d.nome}` : "Nova disciplina";
  form.nome.value = d?.nome ?? "";
  form.semestre.value = d?.semestre ?? (estado.semestreVisao || estado.disciplinas[0]?.semestre || semestreAtual());
  for (const c of ["nota_maxima", "media_aprovacao", "media_minima_exame", "media_final_exame"]) {
    form[c].value = d ? notaTexto(d[c]) : form[c].defaultValue;
  }
  const lista = $("#editor-avaliacoes");
  lista.replaceChildren();
  for (const a of d ? d.avaliacoes : modelo) lista.append(linhaAvaliacao(a));
  $("#editor-erro").hidden = true;
  atualizarDistribuicao();
  abrirDialogo(editor, form.nome);
}

function linhaAvaliacao(a = {}) {
  const sel = el("select", { "aria-label": "Tipo", name: "tipo" },
    TIPOS.map((t) => el("option", { value: t, selected: a.tipo === t }, t[0].toUpperCase() + t.slice(1))));
  return el("div", { class: "linha-avaliacao", dataset: { id: a.id ?? "" } },
    el("input", { class: "nome-av", name: "nome-av", value: a.nome ?? "", maxlength: "60", placeholder: "Nome", "aria-label": "Nome da avaliação", autocomplete: "off" }),
    sel,
    el("input", { name: "peso", inputmode: "decimal", value: a.peso !== undefined ? notaTexto(a.peso) : "", placeholder: "Peso", "aria-label": "Peso", autocomplete: "off" }),
    el("span", { class: "percentual" }, "—"),
    el("button", { type: "button", class: "btn-remover", "aria-label": "Remover avaliação", title: "Remover",
      onclick: (e) => {
        const linha = e.currentTarget.closest(".linha-avaliacao");
        const vizinha = linha.nextElementSibling || linha.previousElementSibling;
        linha.remove();
        atualizarDistribuicao();
        ($(".btn-remover", vizinha || document.createElement("div")) || $("[data-add]")).focus();
      } }, icone(ICONES.lixeira, 16))
  );
}

function lerLinhas() {
  return $$("#editor-avaliacoes .linha-avaliacao").map((linha) => ({
    linha,
    id: linha.dataset.id ? Number(linha.dataset.id) : null,
    nome: $('[name="nome-av"]', linha).value.trim(),
    tipo: $('[name="tipo"]', linha).value,
    peso: lerNumero($('[name="peso"]', linha).value),
  }));
}

function atualizarDistribuicao() {
  const linhas = lerLinhas();
  const total = linhas.reduce((s, l) => s + (Number.isFinite(l.peso) && l.peso > 0 ? l.peso : 0), 0);
  const porTipo = {};
  for (const l of linhas) {
    const p = Number.isFinite(l.peso) && l.peso > 0 ? l.peso : 0;
    porTipo[l.tipo] = (porTipo[l.tipo] || 0) + p;
    $(".percentual", l.linha).textContent = total > 0 && p > 0 ? `${fmt((p / total) * 100, 1)}%` : "—";
  }
  const barra = $("#editor-distribuicao");
  barra.replaceChildren(...TIPOS.filter((t) => porTipo[t] > 0).map((t) =>
    el("span", { class: `seg-tipo-${t}`, style: `width:${(porTipo[t] / total) * 100}%`, title: TIPO_LABEL[t] })));
  let legenda = barra.nextElementSibling;
  if (!legenda?.classList.contains("distribuicao-legenda")) {
    legenda = el("div", { class: "distribuicao-legenda" });
    barra.after(legenda);
  }
  legenda.replaceChildren(...TIPOS.filter((t) => porTipo[t] > 0).map((t) =>
    el("span", {}, el("span", { class: `ponto ponto-tipo-${t}` }),
      ` ${TIPO_LABEL[t]} ${fmt((porTipo[t] / total) * 100, 1)}%`)));
}

function erroEditor(msg) {
  const p = $("#editor-erro");
  p.textContent = msg;
  p.hidden = false;
  p.scrollIntoView({ block: "nearest" });
}

function coletarFormulario() {
  const num = (campo, rotulo) => {
    const v = lerNumero(form[campo].value);
    if (v === null || !Number.isFinite(v)) throw new Error(`Preencha "${rotulo}" com um número.`);
    return v;
  };
  const dados = {
    nome: form.nome.value.trim(),
    semestre: form.semestre.value.trim(),
    nota_maxima: num("nota_maxima", "Nota máxima"),
    media_aprovacao: num("media_aprovacao", "Aprovação direta"),
    media_minima_exame: num("media_minima_exame", "Vai para exame"),
    media_final_exame: num("media_final_exame", "Média final pós-exame"),
  };
  if (dados.nome.length < 2) throw new Error("Informe o nome da disciplina.");
  if (dados.semestre.length < 4) throw new Error("Informe o semestre (ex.: 2026.2).");
  if (dados.media_aprovacao > dados.nota_maxima) throw new Error("A média de aprovação não pode passar da nota máxima.");
  if (dados.media_minima_exame > dados.media_aprovacao) throw new Error("A média para exame deve ser menor ou igual à de aprovação direta.");

  const linhas = lerLinhas();
  if (!linhas.length) throw new Error("Adicione pelo menos uma avaliação.");
  const notasAntigas = new Map((editando?.avaliacoes || []).map((a) => [a.id, a.nota]));
  dados.avaliacoes = linhas.map((l, i) => {
    if (!l.nome) throw new Error(`Dê um nome à avaliação ${i + 1}.`);
    if (!Number.isFinite(l.peso) || l.peso <= 0 || l.peso > 100) throw new Error(`O peso de "${l.nome}" deve ser maior que 0 e no máximo 100.`);
    const nota = l.id ? notasAntigas.get(l.id) ?? null : null;
    if (nota !== null && nota > dados.nota_maxima) throw new Error(`A nota já lançada em "${l.nome}" (${fmt(nota)}) passa da nova nota máxima.`);
    return { id: l.id, nome: l.nome, tipo: l.tipo, peso: l.peso, nota };
  });
  return dados;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  let dados;
  try {
    dados = coletarFormulario();
  } catch (err) {
    erroEditor(err.message);
    return;
  }
  const botao = $("#btn-salvar-disciplina");
  botao.disabled = true;
  botao.textContent = "Salvando…";
  try {
    const r = editando
      ? await api(`/api/disciplinas/${editando.id}`, { method: "PUT", body: dados })
      : await api("/api/disciplinas", { method: "POST", body: dados });
    const nova = r.disciplina;
    nova.resumo = resumoDisciplina(nova);
    const i = estado.disciplinas.findIndex((x) => x.id === nova.id);
    if (i >= 0) estado.disciplinas[i] = nova;
    else estado.disciplinas.push(nova);
    ordenar();
    editor.close();
    renderLista();
    irPara(nova.id);
    toast(editando ? "Fórmula atualizada." : "Disciplina cadastrada.", "ok");
  } catch (err) {
    erroEditor(err.message);
  } finally {
    botao.disabled = false;
    botao.textContent = "Salvar";
  }
});

$("#editor-avaliacoes").addEventListener("input", atualizarDistribuicao);
$("#editor-avaliacoes").addEventListener("change", atualizarDistribuicao);
for (const b of $$("[data-add]")) {
  b.addEventListener("click", () => {
    const tipo = b.dataset.add;
    const n = lerLinhas().filter((l) => l.tipo === tipo).length + 1;
    const nomes = { prova: `Prova ${n}`, trabalho: `Trabalho ${n}`, lista: `Lista ${n}` };
    const linha = linhaAvaliacao({ nome: nomes[tipo], tipo, peso: 10 });
    $("#editor-avaliacoes").append(linha);
    atualizarDistribuicao();
    $('[name="nome-av"]', linha).select();
  });
}
for (const b of $$("[data-fechar]")) b.addEventListener("click", () => editor.close());

function ordenar() {
  estado.disciplinas.sort((a, b) =>
    b.semestre.localeCompare(a.semestre) || a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));
}

// ---------- Inicialização ----------
const ERROS_LOGIN = {
  access_denied: "Você cancelou a autorização no Discord.",
  state_invalido: "A verificação de segurança do login falhou. Tente novamente.",
  servidor_nao_configurado: "O servidor ainda não está configurado para login com Discord.",
};

async function iniciar() {
  mostrarTela("tela-carregando");
  document.title = TITULO_APP;
  const params = new URLSearchParams(location.search);
  const erroLogin = params.get("erro_login");
  if (erroLogin) history.replaceState(null, "", location.pathname + location.hash);

  let me;
  try {
    me = await api("/api/me", { ignorar401: true });
  } catch (e) {
    mostrarErro(`Não foi possível conectar ao servidor: ${e.message}`, iniciar);
    return;
  }
  if (!me.usuario) {
    mostrarLogin(erroLogin ? ERROS_LOGIN[erroLogin] || `Falha no login (${erroLogin}).`
      : me.loginDisponivel ? null : "Login com Discord ainda não configurado no servidor.");
    return;
  }
  estado.usuario = me.usuario;
  preencherConta(me.usuario);
  mostrarTela("tela-app");
  await carregarDisciplinas();
}

definirAoExpirar((msg) => mostrarLogin(msg));

iniciarMenuConta({
  aoSair: async () => {
    await salvarPendentes();
    try { await api("/api/auth/logout", { method: "POST", ignorar401: true }); } catch {}
    mostrarLogin("Você saiu da sua conta.", "ok");
  },
  aoContaExcluida: () => mostrarLogin("Sua conta e todos os seus dados foram excluídos.", "ok"),
});

$("#btn-nova").addEventListener("click", () => abrirEditor(null));
$("#pular").addEventListener("click", (e) => {
  e.preventDefault();
  const alvo = $("#titulo-pagina") || $("#detalhe");
  alvo.focus({ preventScroll: true });
  alvo.scrollIntoView({ block: "start" });
});
window.addEventListener("beforeunload", (e) => {
  if (estado.pendentes.size) e.preventDefault();
});
// O boletim impresso leva a data/hora do momento da impressão.
window.addEventListener("beforeprint", () => {
  for (const s of $$(".data-emissao")) s.textContent = new Date().toLocaleString("pt-BR");
});

iniciar();
