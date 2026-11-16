/**
 * semestre.js — Visão geral do semestre (placar do semestre + tabela de classificação) e onboarding.
 */
import { resumoSemestre, TIPOS, TIPO_LABEL } from "../calc.js";
import { el, fmt, fmt2, icone, ICONES, medidor, ilustracao } from "./dom.js";
import { siglaSituacao, proximoPasso, plural, textoSituacao, TOM_SITUACAO } from "./situacao.js";

/** Fórmula sugerida para quem está começando (soma 100). */
export const MODELO_PADRAO = [
  { nome: "Prova 1", tipo: "prova", peso: 35 },
  { nome: "Prova 2", tipo: "prova", peso: 35 },
  { nome: "Trabalho", tipo: "trabalho", peso: 20 },
  { nome: "Listas de exercícios", tipo: "lista", peso: 10 },
];

/** Barra horizontal de distribuição dos pesos por tipo + legenda. */
export function barraDistribuicao(avaliacoes) {
  const total = avaliacoes.reduce((s, a) => s + a.peso, 0) || 1;
  const porTipo = {};
  for (const a of avaliacoes) porTipo[a.tipo] = (porTipo[a.tipo] || 0) + a.peso;
  const tipos = TIPOS.filter((t) => porTipo[t] > 0);
  return [
    el("div", { class: "distribuicao", role: "img", "aria-label": tipos.map((t) => `${TIPO_LABEL[t]} ${fmt((porTipo[t] / total) * 100, 1)}%`).join(", ") },
      tipos.map((t) => el("span", { class: `seg-tipo-${t}`, style: `width:${(porTipo[t] / total) * 100}%` }))),
    el("div", { class: "distribuicao-legenda", "aria-hidden": "true" },
      tipos.map((t) => el("span", {}, el("span", { class: `ponto ponto-tipo-${t}` }), ` ${TIPO_LABEL[t]} ${fmt((porTipo[t] / total) * 100, 1)}%`))),
  ];
}

/** Tela vazia: pré-temporada — passos e um modelo de fórmula pronto para usar. */
export function renderOnboarding(area, { usuario, aoUsarModelo, aoComecarVazio }) {
  const primeiroNome = (usuario?.username || "").split(/[\s._-]/)[0];
  area.replaceChildren(
    el("section", { class: "boas-vindas", "aria-labelledby": "titulo-pagina" },
      el("div", { class: "boas-vindas-texto" },
        el("p", { class: "sobretitulo" }, "Pré-temporada"),
        el("h1", { id: "titulo-pagina", tabindex: "-1" }, primeiroNome ? `${primeiroNome}, vamos montar sua grade` : "Vamos montar sua grade"),
        el("p", { class: "texto-2" }, "Três passos e o placar de cada disciplina passa a mostrar quanto falta para você passar. O cálculo é refeito a cada nota digitada.")
      ),
      el("div", { class: "boas-vindas-arte" }, ilustracao("tpl-ilustracao-vazio")),
      el("ol", { class: "passos" },
        el("li", {}, el("strong", {}, "Cadastre a disciplina"), el("span", {}, "com a fórmula da média: provas, trabalhos e listas, cada um com seu peso.")),
        el("li", {}, el("strong", {}, "Lance as notas"), el("span", {}, "conforme saírem. Elas são salvas automaticamente.")),
        el("li", {}, el("strong", {}, "Acompanhe o placar"), el("span", {}, "com a nota mínima para aprovação direta, para ir ao exame e no exame. Teste cenários com “E se…?”."))
      )
    ),
    el("section", { class: "folha modelo", "aria-labelledby": "titulo-modelo" },
      el("div", { class: "folha-cabecalho" },
        el("h2", { id: "titulo-modelo", class: "titulo-secao" }, "Modelo de fórmula sugerido"),
        el("span", { class: "contagem" }, "Soma 100")),
      el("p", { class: "texto-2" }, "Um formato comum em Engenharia de Software. Você pode ajustar nomes e pesos antes de salvar."),
      el("table", { class: "tabela-modelo" },
        el("caption", { class: "sr-only" }, "Avaliações do modelo sugerido"),
        el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "Avaliação"), el("th", { scope: "col" }, "Tipo"), el("th", { scope: "col", class: "num" }, "Peso"))),
        el("tbody", {}, MODELO_PADRAO.map((a) => el("tr", {},
          el("td", {}, el("span", { class: "lider" }, a.nome)),
          el("td", {}, el("span", { class: `tipo tipo-${a.tipo}` }, a.tipo)),
          el("td", { class: "num" }, `${fmt(a.peso)}%`))))
      ),
      barraDistribuicao(MODELO_PADRAO),
      el("p", { class: "texto-2 pequeno" }, "Regras padrão: nota máxima 10, aprovação direta com média ≥ 7, exame com média ≥ 4 e média pós-exame ≥ 5."),
      el("div", { class: "botoes" },
        el("button", { type: "button", class: "btn btn-primario", onclick: aoUsarModelo }, icone(ICONES.mais), "Usar este modelo"),
        el("button", { type: "button", class: "btn btn-secundario", onclick: aoComecarVazio }, "Começar em branco")
      )
    )
  );
}

const SITUACOES_KPI = [
  ["aprovados", "Aprovados", "APR", "ok"],
  ["emAndamento", "Em andamento", "AND", "info"],
  ["emExame", "Em exame", "EXA", "alerta"],
  ["reprovados", "Reprovados", "REP", "perigo"],
  ["semFormula", "Sem fórmula", "S/F", "neutro"],
];

/** Placar do semestre: média geral, peso avaliado e contagem por situação, num painel escuro. */
function placarSemestre(s, semestre) {
  const temMedia = s.mediaGeral !== null && s.mediaGeral !== undefined;
  const pct = s.percentualAvaliado ?? 0;
  const itens = SITUACOES_KPI.filter(([k]) => k !== "semFormula" || s[k] > 0);
  const total = s.total || 1;
  return el("dl", { class: "kpis placar-semestre", "aria-label": `Resumo do semestre ${semestre}` },
    el("div", { class: "kpi kpi-media" },
      el("dt", {}, "Média geral"),
      el("dd", {}, el("span", { class: "kpi-valor" }, temMedia ? fmt2(s.mediaGeral) : "—"),
        el("span", { class: "kpi-dica" }, "média das médias, escala 0–10"))),
    el("div", { class: "kpi kpi-peso" },
      el("dt", {}, "Peso avaliado"),
      el("dd", {}, el("span", { class: "kpi-valor" }, `${fmt(pct, 0)}%`),
        medidor(pct, 10, "medidor-kpi"),
        el("span", { class: "kpi-dica" }, "do peso das avaliações já tem nota"))),
    el("div", { class: "kpi kpi-situacoes" },
      el("dt", {}, `Situação · ${plural(s.total, "disciplina", "disciplinas")}`),
      el("dd", {},
        el("ul", { class: "legenda-situacoes" },
          itens.map(([k, r, sigla, tom]) => el("li", { class: `leg-${tom}` },
            el("span", { class: "leg-numero" }, String(s[k])),
            el("span", { class: `sigla sigla-${tom}`, "aria-hidden": "true" }, sigla),
            el("span", { class: "leg-rotulo" }, r)))),
        el("span", { class: "barra-empilhada", role: "img", "aria-label": itens.map(([k, r]) => `${r}: ${s[k]}`).join(", ") },
          itens.filter(([k]) => s[k] > 0).map(([k, , , tom]) => el("span", { class: `seg-${tom}`, style: `width:${(s[k] / total) * 100}%` })))
      )
    )
  );
}

/**
 * Ordem da classificação (só na exibição): do maior risco para o menor;
 * empate pelo nome, como na lista lateral. Não altera a ordem guardada no estado.
 */
const RISCO = { reprovado: 0, exame: 1, exame_inevitavel: 1, em_andamento: 2, sem_formula: 3, aprovado: 4 };
const porRisco = (lista) => [...lista].sort((a, b) =>
  (RISCO[a.resumo.situacao] ?? 3) - (RISCO[b.resumo.situacao] ?? 3) || a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }));

/** Uma linha da tabela de classificação do semestre (link para a disciplina). */
function linhaClassificacao(d, aoAbrir) {
  const r = d.resumo;
  const media = r.mediaFinal ?? r.mediaParcial;
  const tom = TOM_SITUACAO[r.situacao] || "neutro";
  const max = Number(d.nota_maxima);
  const rotuloMedia = r.mediaFinal !== null ? "média final" : media === null ? "sem notas" : "média parcial";
  return el("li", {},
    el("a", { class: `linha-disciplina tom-${tom}`, href: `#/disciplina/${d.id}`, onclick: (e) => { e.preventDefault(); aoAbrir(d.id); } },
      el("span", { class: "ld-status" }, siglaSituacao(r.situacao), el("span", { class: "sr-only" }, `${textoSituacao(r.situacao)}: `)),
      el("span", { class: "ld-nome" },
        el("span", { class: "ld-titulo" }, d.nome),
        el("span", { class: "ld-dica" }, proximoPasso(r, d))),
      el("span", { class: "ld-media" },
        el("span", { class: "ld-media-valor" }, media === null ? "—" : fmt2(media),
          media !== null && max !== 10 ? el("small", { class: "escala-sufixo" }, `/${fmt(max)}`) : null),
        el("span", { class: "ld-rotulo" }, rotuloMedia)),
      el("span", { class: "ld-avaliado" },
        el("span", { class: "ld-pct" }, `${fmt(r.percentualAvaliado, 0)}%`),
        medidor(r.percentualAvaliado, 10, "medidor-linha"),
        el("span", { class: "ld-rotulo" }, "avaliado")),
      el("span", { class: "ld-seta", "aria-hidden": "true" }, icone(ICONES.setaDireita, 18))
    )
  );
}

/**
 * Painel "Visão geral do semestre".
 * @param {HTMLElement} area
 * @param {object} o  { disciplinas (todas), semestre, usuario, aoTrocarSemestre, aoAbrir, aoNova }
 */
export function renderVisaoGeral(area, { disciplinas, semestre, usuario, aoTrocarSemestre, aoAbrir, aoNova }) {
  const semestres = [...new Set(disciplinas.map((d) => d.semestre))];
  const doSemestre = disciplinas.filter((d) => d.semestre === semestre);
  const s = resumoSemestre(doSemestre);
  const primeiroNome = (usuario?.username || "").split(/[\s._-]/)[0];

  let seletor = null;
  if (semestres.length > 1) {
    const select = el("select", { id: "seletor-semestre", class: "seletor", onchange: (e) => aoTrocarSemestre(e.target.value) },
      semestres.map((x) => el("option", { value: x, selected: x === semestre }, x)));
    seletor = el("label", { class: "campo-inline", for: "seletor-semestre" }, el("span", {}, "Semestre"), select);
  }

  area.replaceChildren(
    el("section", { class: "cabecalho-pagina", "aria-labelledby": "titulo-pagina" },
      el("div", { class: "cabecalho-texto" },
        el("p", { class: "sobretitulo" }, `Temporada ${semestre}`),
        el("h1", { id: "titulo-pagina", tabindex: "-1" }, "Visão geral do semestre"),
        el("p", { class: "texto-2" }, `${primeiroNome ? `Olá, ${primeiroNome}. ` : ""}${plural(s.total, "disciplina cadastrada", "disciplinas cadastradas")}. Abra uma disciplina para lançar notas.`)
      ),
      seletor ? el("div", { class: "visao-acoes" }, seletor) : null
    ),
    placarSemestre(s, semestre),
    el("section", { class: "secao", "aria-labelledby": "titulo-lista-semestre" },
      el("div", { class: "secao-cabecalho" },
        el("h2", { id: "titulo-lista-semestre", class: "titulo-secao" }, "Classificação por risco"),
        el("span", { class: "contagem" }, plural(doSemestre.length, "disciplina", "disciplinas"))),
      doSemestre.length
        ? [
          el("div", { class: "classificacao-cabecalho", "aria-hidden": "true" },
            el("span", {}, "Sit."), el("span", {}, "Disciplina · próximo passo"), el("span", {}, "Média"), el("span", {}, "Avaliado"), el("span", {})),
          el("ul", { class: "classificacao" }, porRisco(doSemestre).map((d) => linhaClassificacao(d, aoAbrir))),
          el("p", { class: "legenda legenda-siglas", "aria-hidden": "true" }, "Do maior risco para o menor: ",
            el("span", { class: "sigla sigla-perigo" }, "REP"), " reprovado ",
            el("span", { class: "sigla sigla-alerta" }, "EXA"), " exame ",
            el("span", { class: "sigla sigla-info" }, "AND"), " em andamento ",
            el("span", { class: "sigla sigla-ok" }, "APR"), " aprovado"),
        ]
        : el("p", { class: "texto-2" }, "Nenhuma disciplina neste semestre.")
    )
  );
}

