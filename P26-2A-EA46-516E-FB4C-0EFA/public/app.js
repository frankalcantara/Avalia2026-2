const $ = (s) => document.querySelector(s);
const MAX_AVALIACOES = 30;
let disciplinas = [];

function el(tag, attrs = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else e.setAttribute(k, v);
  }
  e.append(...filhos);
  return e;
}

async function api(url, opcoes = {}) {
  const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opcoes });
  const dados = r.status === 204 ? null : await r.json().catch(() => null);
  if (!r.ok) throw new Error((dados && dados.erro) || "Erro " + r.status);
  return dados;
}

const fmt = (n) => Number(n).toFixed(2).replace(".", ",");
const ehNum = (v) => typeof v === "number" && Number.isFinite(v);
const notaValida = (n) => n === null || (ehNum(n) && n >= 0 && n <= 10);

async function comBloqueio(botoes, fn) {
  botoes.forEach((b) => { b.disabled = true; });
  try { return await fn(); }
  finally { botoes.forEach((b) => { b.disabled = false; }); }
}

/* ---------- Cálculos (no navegador, instantâneos) ---------- */
function calcular(av) {
  const W = av.reduce((s, a) => s + a.peso, 0);
  const feitas = av.filter((a) => a.nota !== null);
  const S = feitas.reduce((s, a) => s + a.peso * a.nota, 0);
  const Wf = feitas.reduce((s, a) => s + a.peso, 0);
  return { W, S, Wf, Wr: W - Wf, faltam: av.length - feitas.length };
}

function linhaMeta(c, meta, rotulo) {
  if (!(c.Wr > 0)) return null;
  const x = (meta * c.W - c.S) / c.Wr;
  if (x <= 0) return el("div", { class: "ok" }, `${rotulo}: já garantido.`);
  if (x > 10) return el("div", { class: "ruim" }, `${rotulo}: impossível (precisaria de ${fmt(x)}).`);
  return el("div", {}, `${rotulo}: média mínima de ${fmt(x)} nas avaliações restantes.`);
}

function atualizarResumo(d, caixa) {
  caixa.replaceChildren();
  if (!d.avaliacoes.every((a) => ehNum(a.peso) && a.peso > 0 && notaValida(a.nota))) {
    caixa.append(el("div", { class: "ruim" }, "Há uma nota inválida. Use valores de 0 a 10."));
    return;
  }
  const c = calcular(d.avaliacoes);
  caixa.append(el("div", {}, c.Wf > 0 ? `Média parcial (avaliações feitas): ${fmt(c.S / c.Wf)}` : "Média parcial: nenhuma nota lançada ainda."));
  caixa.append(el("div", {}, `Pontos acumulados: ${fmt(c.S / c.W)} de 10`));
  if (c.faltam === 0) {
    const final = c.S / c.W;
    const situ = final >= d.media_aprovacao ? "Aprovado" : final >= d.media_exame ? "Exame final" : "Reprovado";
    caixa.append(el("div", { class: situ === "Aprovado" ? "ok" : "ruim" }, `Média final: ${fmt(final)} — ${situ}`));
    return;
  }
  const linhas = [
    linhaMeta(c, d.media_aprovacao, `Para aprovação direta (${d.media_aprovacao})`),
    linhaMeta(c, d.media_exame, `Para chegar ao exame (${d.media_exame})`),
  ];
  linhas.forEach((l) => { if (l) caixa.append(l); });
}

/* ---------- Lista de disciplinas ---------- */
function cartao(d) {
  const card = el("article", { class: "card" },
    el("h3", {}, d.nome),
    el("small", {}, `Aprovação direta: ${d.media_aprovacao} | Exame a partir de: ${d.media_exame}`));
  const resumo = el("div", { class: "resumo" });
  for (const a of d.avaliacoes) {
    const inp = el("input", { type: "number", min: "0", max: "10", step: "0.1", placeholder: "nota", "aria-label": `Nota de ${a.nome}` });
    if (a.nota !== null) inp.value = a.nota;
    inp.addEventListener("input", () => {
      a.nota = inp.value === "" ? null : Number(inp.value);
      atualizarResumo(d, resumo);
    });
    card.append(el("div", { class: "aval" }, el("span", {}, `${a.nome} (${a.tipo}, peso ${a.peso})`), inp));
  }
  card.append(resumo);
  atualizarResumo(d, resumo);

  const msg = el("p", { class: "msg", "aria-live": "polite" });
  const salvar = el("button", { type: "button" }, "Salvar notas");
  const excluir = el("button", { type: "button", class: "perigo" }, "Excluir");
  salvar.addEventListener("click", () => comBloqueio([salvar, excluir], async () => {
    try {
      await api(`/api/disciplinas?id=${d.id}`, { method: "PUT", body: JSON.stringify(d) });
      msg.className = "msg ok";
      msg.textContent = "Notas salvas!";
    } catch (e) {
      msg.className = "msg";
      msg.textContent = e.message;
    }
  }));
  excluir.addEventListener("click", async () => {
    if (!confirm(`Excluir ${d.nome}?`)) return;
    await comBloqueio([salvar, excluir], async () => {
      try { await api(`/api/disciplinas?id=${d.id}`, { method: "DELETE" }); await carregar(); }
      catch (e) { msg.className = "msg"; msg.textContent = e.message; }
    });
  });
  card.append(el("div", { class: "linha" }, salvar, excluir), msg);
  return card;
}

async function carregar() {
  disciplinas = await api("/api/disciplinas");
  const lista = $("#lista");
  lista.replaceChildren();
  if (!disciplinas.length) lista.append(el("p", {}, "Nenhuma disciplina cadastrada ainda."));
  disciplinas.forEach((d) => lista.append(cartao(d)));
}

/* ---------- Formulário de nova disciplina ---------- */
function linhaAvaliacao() {
  const tipo = el("select", { "data-c": "tipo", "aria-label": "Tipo da avaliação" },
    el("option", { value: "prova" }, "Prova"),
    el("option", { value: "trabalho" }, "Trabalho"),
    el("option", { value: "lista" }, "Lista"));
  const rm = el("button", { type: "button", class: "sec", "aria-label": "Remover avaliação" }, "X");
  const linha = el("div", { class: "aval-form" },
    el("input", { placeholder: "Nome (ex.: P1)", maxlength: "60", "data-c": "nome", "aria-label": "Nome da avaliação" }),
    tipo,
    el("input", { type: "number", min: "0.1", step: "0.1", placeholder: "Peso", "data-c": "peso", "aria-label": "Peso da avaliação" }),
    el("input", { type: "number", min: "0", max: "10", step: "0.1", placeholder: "Nota (opc.)", "data-c": "nota", "aria-label": "Nota da avaliação (opcional)" }),
    rm);
  rm.addEventListener("click", () => linha.remove());
  return linha;
}

async function salvarNova() {
  const msg = $("#f-msg");
  msg.textContent = "";
  const avaliacoes = [...document.querySelectorAll("#f-avals .aval-form")].map((l) => {
    const g = (c) => l.querySelector(`[data-c="${c}"]`).value;
    return { nome: g("nome"), tipo: g("tipo"), peso: Number(g("peso")), nota: g("nota") === "" ? null : Number(g("nota")) };
  });
  await comBloqueio([$("#btn-salvar"), $("#btn-add")], async () => {
    try {
      await api("/api/disciplinas", {
        method: "POST",
        body: JSON.stringify({
          nome: $("#f-nome").value,
          media_aprovacao: Number($("#f-aprov").value),
          media_exame: Number($("#f-exame").value),
          avaliacoes,
        }),
      });
      $("#f-nome").value = "";
      $("#f-avals").replaceChildren(linhaAvaliacao());
      await carregar();
    } catch (e) { msg.textContent = e.message; }
  });
}

/* ---------- Início ---------- */
async function iniciar() {
  const erro = new URLSearchParams(location.search).get("auth_error");
  if (erro) $("#aviso").textContent = "Falha no login: " + erro;
  try {
    const me = await api("/api/me");
    const sair = el("button", { type: "button", class: "sec" }, "Sair");
    sair.addEventListener("click", async () => { await api("/api/auth/logout", { method: "POST" }); location.href = "/"; });
    $("#perfil").append(el("img", { src: me.avatar, alt: `Avatar de ${me.nome}` }), el("span", {}, `${me.nome} (id ${me.id})`), sair);
    $("#tela-app").hidden = false;
    $("#f-avals").append(linhaAvaliacao());
    $("#btn-add").addEventListener("click", () => {
      if (document.querySelectorAll("#f-avals .aval-form").length >= MAX_AVALIACOES) {
        $("#f-msg").textContent = `Limite de ${MAX_AVALIACOES} avaliações por disciplina.`;
        return;
      }
      $("#f-avals").append(linhaAvaliacao());
    });
    $("#btn-salvar").addEventListener("click", salvarNova);
    await carregar();
  } catch {
    $("#tela-login").hidden = false;
  }
}
iniciar();
