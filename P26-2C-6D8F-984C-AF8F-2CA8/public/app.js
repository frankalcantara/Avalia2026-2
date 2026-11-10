import { calcular, validarDisciplina, TIPOS } from "./js/calculo.js";

const $ = (s) => document.querySelector(s);
const state = { user: null, disciplinas: [], selId: null, editId: null };

const SITUACAO = { aprovado: "Aprovado", em_andamento: "Em andamento", exame: "Exame", reprovado: "Reprovado" };
const ROTULO_TIPO = { prova: "Prova", trabalho: "Trabalho", lista: "Lista" };
const PRESETS = {
  "2 provas + trabalho": [["P1", "prova", 4], ["P2", "prova", 4], ["Trabalho", "trabalho", 2]],
  "3 provas": [["P1", "prova", 1], ["P2", "prova", 1], ["P3", "prova", 1]],
  "Provas + listas": [["P1", "prova", 3], ["P2", "prova", 3], ["Lista 1", "lista", 1], ["Lista 2", "lista", 1], ["Lista 3", "lista", 1], ["Lista 4", "lista", 1]],
};
const ERROS = { nao_autenticado: "Sua sessão expirou. Entre novamente." };

/* ---------- utilidades ---------- */

/** Cria elemento; filhos string viram nós de texto (nunca HTML). */
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k in n && !k.includes("-")) n[k] = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  n.append(...kids.flat().filter((c) => c != null && c !== false));
  return n;
}

const fmt = (n) => (n == null || Number.isNaN(n) ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 }));
const numTxt = (s) => String(s ?? "").trim().replace(",", ".");
const pct = (r) => (r.pesoTotal ? Math.round((r.pesoLancado / r.pesoTotal) * 100) : 0);
const pilula = (s) => el("span", { className: `pill pill-${s}` }, SITUACAO[s] ?? s);

function norm(d) {
  return {
    ...d,
    avaliacoes: (d.avaliacoes || []).map((a) => ({
      nome: a.nome, tipo: a.tipo, peso: Number(a.peso), nota: a.nota == null || a.nota === "" ? null : Number(a.nota),
    })),
  };
}
const payload = (d) => ({
  nome: d.nome, notaMax: d.notaMax, mediaAprovacao: d.mediaAprovacao, mediaExame: d.mediaExame, mediaFinal: d.mediaFinal,
  avaliacoes: d.avaliacoes.map(({ nome, tipo, peso, nota }) => ({ nome, tipo, peso, nota })),
});

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      keepalive: method !== "GET",
      headers: body ? { "content-type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw Object.assign(new Error("Sem conexão com o servidor."), { status: 0 });
  }
  let data = {};
  try { data = await res.json(); } catch { /* corpo não-JSON */ }
  if (!res.ok) {
    const msg = ERROS[data.erro] || data.erro ||
      ({ 404: "Não encontrado.", 409: "Limite de 20 disciplinas atingido." }[res.status] ?? `Erro ${res.status}.`);
    if (res.status === 401 && path !== "/api/me") mostrarDeslogado(ERROS.nao_autenticado);
    throw Object.assign(new Error(msg), { status: res.status });
  }
  return data;
}

/* ---------- sessão ---------- */

function avatarUrl(u) {
  const id = encodeURIComponent(u.userId);
  if (u.avatar) return `https://cdn.discordapp.com/avatars/${id}/${encodeURIComponent(u.avatar)}.png?size=64`;
  let i = 0;
  try { i = Number((BigInt(u.userId) >> 22n) % 6n); } catch { /* id não numérico */ }
  return `https://cdn.discordapp.com/embed/avatars/${i}.png`;
}

function mostrarDeslogado(msg = "") {
  state.user = null; state.disciplinas = []; state.selId = null;
  $("#usuario").hidden = true;
  $("#painel").hidden = true;
  $("#boasVindas").hidden = false;
  const aviso = $("#avisoLogin");
  aviso.textContent = msg;
  aviso.hidden = !msg;
  if ($("#editor").open) $("#editor").close();
}

function mostrarLogado() {
  const u = state.user;
  $("#avatar").src = avatarUrl(u);
  $("#usuarioNome").textContent = u.username;
  $("#usuarioId").textContent = u.userId;
  $("#usuario").hidden = false;
  $("#boasVindas").hidden = true;
  $("#painel").hidden = false;
}

async function carregar() {
  const aviso = $("#avisoLista");
  try {
    const { disciplinas } = await api("GET", "/api/disciplinas");
    state.disciplinas = (disciplinas || []).map(norm);
    aviso.hidden = true;
  } catch (e) {
    if (e.status === 401) return;
    aviso.textContent = `Não foi possível carregar as disciplinas: ${e.message}`;
    aviso.hidden = false;
  }
  if (!state.disciplinas.some((d) => d.id === state.selId)) state.selId = state.disciplinas[0]?.id ?? null;
  renderTudo();
}

/* ---------- lista ---------- */

function renderLista() {
  const ds = state.disciplinas;
  $("#contador").textContent = ds.length ? `${ds.length}/20` : "";
  $("#listaVazia").hidden = ds.length > 0;
  $("#btnNova").disabled = ds.length >= 20;
  $("#listaDisciplinas").replaceChildren(...ds.map((d) => {
    const r = calcular(d);
    const p = pct(r);
    return el("li", {},
      el("button", {
        type: "button", className: "card-disc", "aria-current": d.id === state.selId ? "true" : null,
        onclick: () => selecionar(d.id),
      },
      el("span", { className: "card-topo" }, el("span", { className: "card-nome" }, d.nome), pilula(r.situacao)),
      el("span", { className: "card-media" }, "Média parcial ", el("strong", {}, fmt(r.mediaParcial))),
      el("progress", { max: 100, value: p, "aria-label": `Peso lançado: ${p}%` }),
      el("span", { className: "card-peso" }, `${p}% do peso lançado`)));
  }));
}

function selecionar(id) {
  salvarAgora();
  state.selId = id;
  renderTudo();
  if (matchMedia("(max-width: 899px)").matches) $("#detalhe").scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------- detalhe / lançamento ---------- */

function renderDetalhe() {
  const box = $("#detalheConteudo");
  const d = state.disciplinas.find((x) => x.id === state.selId);
  if (!d) {
    setSalvamento("", "");
    box.replaceChildren(el("div", { className: "placeholder" },
      el("h2", { id: "tituloDetalhe" }, "Lançamento de notas"),
      el("p", {}, "Selecione ou crie uma disciplina para lançar notas e simular a média.")));
    return;
  }
  const linhas = d.avaliacoes.map((a, i) => {
    const id = `nota-${i}`;
    return el("li", { className: "linha-nota" },
      el("label", { htmlFor: id },
        el("span", { className: "nota-nome" }, a.nome),
        el("span", { className: "nota-meta" }, `${ROTULO_TIPO[a.tipo] ?? a.tipo} · peso ${fmt(a.peso)}`)),
      el("input", {
        id, type: "text", inputMode: "decimal", autocomplete: "off", className: "input-nota",
        value: a.nota ?? "", placeholder: "—", "aria-describedby": "dicaNotas",
        oninput: (ev) => onNota(d, i, ev.target),
      }));
  });
  box.replaceChildren(
    el("div", { className: "detalhe-topo" },
      el("div", {},
        el("h2", { id: "tituloDetalhe" }, d.nome),
        el("p", { className: "regras-txt" },
          `Nota máx. ${fmt(d.notaMax)} · Aprovação ≥ ${fmt(d.mediaAprovacao)} · Exame ≥ ${fmt(d.mediaExame)} · Final ≥ ${fmt(d.mediaFinal)}`)),
      el("button", { type: "button", className: "btn btn-secundario", onclick: () => abrirEditor(d) }, "Editar fórmula")),
    el("div", { className: "detalhe-grade" },
      el("form", { className: "notas", noValidate: true, onsubmit: (e) => e.preventDefault() },
        el("h3", {}, "Notas"),
        el("p", { className: "dica", id: "dicaNotas" }, `De 0 a ${fmt(d.notaMax)}. Deixe em branco o que ainda não foi feito.`),
        el("ol", { className: "linhas-nota" }, linhas)),
      el("aside", { className: "resumo", id: "resumo", "aria-live": "polite", "aria-label": "Resumo da média" })));
  renderResumo(d);
}

function onNota(d, i, input) {
  const txt = numTxt(input.value);
  let nota = null;
  if (txt !== "") {
    nota = Number(txt);
    if (!Number.isFinite(nota) || nota < 0 || nota > d.notaMax) {
      input.setAttribute("aria-invalid", "true");
      setSalvamento("erro", `“${d.avaliacoes[i].nome}”: a nota deve estar entre 0 e ${fmt(d.notaMax)}.`);
      return;
    }
  }
  input.removeAttribute("aria-invalid");
  d.avaliacoes[i].nota = nota;
  renderResumo(d);
  renderLista();
  agendarSalvar(d);
}

function linhaMeta(tom, texto) {
  return el("li", { className: `meta meta-${tom}` }, texto);
}

function metas(d, r) {
  if (!r.pesoTotal) return [linhaMeta("info", "Cadastre avaliações para simular.")];
  if (r.pesoLancado === r.pesoTotal) {
    const m = fmt(r.mediaGarantida);
    if (r.situacao === "aprovado") return [linhaMeta("ok", `Todas as notas lançadas: aprovado com média ${m}.`)];
    if (r.situacao === "reprovado") return [linhaMeta("erro", `Todas as notas lançadas: média ${m}, abaixo do mínimo de ${fmt(d.mediaExame)} para exame.`)];
    if (r.notaNoExame > d.notaMax) {
      return [linhaMeta("erro", `Exame: nem com ${fmt(d.notaMax)} a média final chega a ${fmt(d.mediaFinal)} (seria preciso ${fmt(r.notaNoExame)}).`)];
    }
    return [linhaMeta("alerta", `Você está de exame com média ${m}. Precisa de ${fmt(r.notaNoExame)} no exame para média final ${fmt(d.mediaFinal)}.`)];
  }
  const ap = r.aprovacao, ex = r.exame;
  return [
    ap.situacao === "garantida"
      ? linhaMeta("ok", "Aprovação direta já garantida — mesmo com 0 no restante.")
      : ap.situacao === "impossivel"
        ? linhaMeta("erro", `Aprovação direta impossível: seria preciso ${fmt(ap.necessaria)} em cada avaliação restante (máx. ${fmt(d.notaMax)}).`)
        : linhaMeta("info", `Você precisa de ${fmt(ap.necessaria)} em cada avaliação restante para aprovação direta (média ${fmt(d.mediaAprovacao)}).`),
    ex.situacao === "garantida"
      ? linhaMeta("ok", "Direito ao exame já garantido.")
      : ex.situacao === "impossivel"
        ? linhaMeta("erro", `Impossível alcançar o exame: seria preciso ${fmt(ex.necessaria)} em cada restante. Reprovação.`)
        : linhaMeta("alerta", `${fmt(ex.necessaria)} em cada avaliação restante para garantir o exame (média ${fmt(d.mediaExame)}).`),
  ];
}

function renderResumo(d) {
  const box = $("#resumo");
  if (!box) return;
  const r = calcular(d);
  const p = pct(r);
  box.replaceChildren(
    el("div", { className: "resumo-topo" },
      el("div", {},
        el("span", { className: "rotulo" }, "Média parcial"),
        el("span", { className: "media-grande" }, fmt(r.mediaParcial))),
      pilula(r.situacao)),
    el("dl", { className: "metricas" },
      el("div", {}, el("dt", {}, "Média garantida"), el("dd", {}, fmt(r.mediaGarantida))),
      el("div", {}, el("dt", {}, "Média máxima"), el("dd", {}, fmt(r.mediaMaxima))),
      el("div", {}, el("dt", {}, "Peso lançado"), el("dd", {}, `${fmt(r.pesoLancado)} / ${fmt(r.pesoTotal)}`))),
    el("progress", { max: 100, value: p, "aria-label": `Peso lançado: ${p}%` }),
    el("ul", { className: "metas" }, metas(d, r)));
}

/* ---------- persistência das notas (debounce 600 ms, fila serial) ---------- */

let pendente = null;
let fila = Promise.resolve();

function setSalvamento(estado, texto) {
  const s = $("#salvamento");
  s.dataset.estado = estado;
  s.textContent = texto;
}

function agendarSalvar(d) {
  if (pendente && pendente.d !== d) salvarAgora();
  clearTimeout(pendente?.t);
  setSalvamento("pendente", "Alterações não salvas…");
  pendente = { d, t: setTimeout(salvarAgora, 600) };
}

function salvarAgora() {
  if (!pendente) return fila;
  const { d, t } = pendente;
  clearTimeout(t);
  pendente = null;
  const v = validarDisciplina(payload(d));
  if (!v.ok) { setSalvamento("erro", v.erro); return fila; }
  setSalvamento("salvando", "Salvando…");
  fila = fila.then(async () => {
    try {
      const { disciplina } = await api("PUT", `/api/disciplinas/${d.id}`, v.valor);
      if (disciplina?.updatedAt) d.updatedAt = disciplina.updatedAt;
      if (!pendente) setSalvamento("salvo", "Salvo ✓");
    } catch (e) {
      setSalvamento("erro", `Erro ao salvar: ${e.message}`);
    }
  });
  return fila;
}

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") salvarAgora(); });

/* ---------- editor ---------- */

const editor = $("#editor");

function linhaAval(a = {}) {
  const li = el("li", { className: "linha-aval" });
  const campo = (rotulo, input) => el("label", { className: "campo" }, el("span", {}, rotulo), input);
  li.append(
    campo("Nome", el("input", { name: "nome", value: a.nome ?? "", maxLength: 60, autocomplete: "off", placeholder: "Ex.: P1" })),
    campo("Tipo", el("select", { name: "tipo" },
      TIPOS.map((t) => el("option", { value: t, selected: t === (a.tipo ?? "prova") }, ROTULO_TIPO[t])))),
    campo("Peso", el("input", { name: "peso", inputMode: "decimal", value: a.peso ?? 1, autocomplete: "off" })),
    campo("Nota", el("input", { name: "nota", inputMode: "decimal", value: a.nota ?? "", placeholder: "—", autocomplete: "off" })),
    el("button", {
      type: "button", className: "btn-icone", "aria-label": "Remover avaliação",
      onclick: () => { li.remove(); atualizarAddAval(); },
    }, "×"));
  return li;
}

function atualizarAddAval() {
  $("#btnAddAval").disabled = $("#linhasAval").children.length >= 30;
}

function setLinhas(avs) {
  $("#linhasAval").replaceChildren(...avs.map(linhaAval));
  atualizarAddAval();
}

function abrirEditor(d = null) {
  salvarAgora();
  state.editId = d?.id ?? null;
  $("#tituloEditor").textContent = d ? "Editar disciplina" : "Nova disciplina";
  $("#edNome").value = d?.nome ?? "";
  $("#edNotaMax").value = d?.notaMax ?? 10;
  $("#edAprov").value = d?.mediaAprovacao ?? 7;
  $("#edExame").value = d?.mediaExame ?? 4;
  $("#edFinal").value = d?.mediaFinal ?? 5;
  $("#presets").hidden = !!d;
  $("#btnExcluir").hidden = !d;
  setLinhas(d ? d.avaliacoes : [{ nome: "P1", tipo: "prova", peso: 1 }]);
  $("#erroEditor").textContent = "";
  editor.showModal();
  $("#edNome").focus();
}

function lerEditor() {
  return {
    nome: $("#edNome").value,
    notaMax: numTxt($("#edNotaMax").value),
    mediaAprovacao: numTxt($("#edAprov").value),
    mediaExame: numTxt($("#edExame").value),
    mediaFinal: numTxt($("#edFinal").value),
    avaliacoes: [...$("#linhasAval").children].map((li) => ({
      nome: li.querySelector("[name=nome]").value,
      tipo: li.querySelector("[name=tipo]").value,
      peso: numTxt(li.querySelector("[name=peso]").value),
      nota: numTxt(li.querySelector("[name=nota]").value),
    })),
  };
}

$(".presets-botoes").append(...Object.entries(PRESETS).map(([nome, avs]) =>
  el("button", {
    type: "button", className: "btn btn-chip",
    onclick: () => setLinhas(avs.map(([n, tipo, peso]) => ({ nome: n, tipo, peso }))),
  }, nome)));

$("#btnAddAval").addEventListener("click", () => {
  const n = $("#linhasAval").children.length + 1;
  const li = linhaAval({ nome: `Avaliação ${n}` });
  $("#linhasAval").append(li);
  atualizarAddAval();
  li.querySelector("input").select();
});

$("#formEditor").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const erro = $("#erroEditor");
  const v = validarDisciplina(lerEditor());
  if (!v.ok) { erro.textContent = v.erro; return; }
  erro.textContent = "";
  const btn = $("#btnSalvar");
  btn.disabled = true;
  btn.textContent = "Salvando…";
  try {
    const { disciplina } = state.editId == null
      ? await api("POST", "/api/disciplinas", v.valor)
      : await api("PUT", `/api/disciplinas/${state.editId}`, v.valor);
    const d = norm(disciplina);
    const i = state.disciplinas.findIndex((x) => x.id === d.id);
    if (i >= 0) state.disciplinas[i] = d; else state.disciplinas.push(d);
    state.selId = d.id;
    editor.close();
    setSalvamento("salvo", "Salvo ✓");
    renderTudo();
  } catch (e) {
    erro.textContent = e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = "Salvar";
  }
});

$("#btnExcluir").addEventListener("click", async () => {
  const d = state.disciplinas.find((x) => x.id === state.editId);
  if (!d || !confirm(`Excluir “${d.nome}” e todas as suas notas? Essa ação não pode ser desfeita.`)) return;
  try {
    await api("DELETE", `/api/disciplinas/${d.id}`);
    state.disciplinas = state.disciplinas.filter((x) => x.id !== d.id);
    state.selId = state.disciplinas[0]?.id ?? null;
    editor.close();
    renderTudo();
  } catch (e) {
    $("#erroEditor").textContent = e.message;
  }
});

$("#btnCancelar").addEventListener("click", () => editor.close());
$("#btnFecharEditor").addEventListener("click", () => editor.close());
$("#btnNova").addEventListener("click", () => abrirEditor());

$("#btnSair").addEventListener("click", async () => {
  await salvarAgora();
  try { await api("POST", "/api/auth/logout"); } catch { /* sessão já encerrada */ }
  mostrarDeslogado();
});

function renderTudo() {
  renderLista();
  renderDetalhe();
}

/* ---------- início ---------- */

async function iniciar() {
  const authErr = new URLSearchParams(location.search).get("auth_error");
  if (authErr) history.replaceState(null, "", location.pathname);
  try {
    const { user } = await api("GET", "/api/me");
    state.user = user;
    mostrarLogado();
    await carregar();
  } catch (e) {
    mostrarDeslogado(
      authErr ? `Não foi possível entrar com o Discord (${authErr}). Tente novamente.`
        : e.status === 401 ? ""
          : "Servidor indisponível no momento. Tente novamente em instantes.");
  }
}

iniciar();
