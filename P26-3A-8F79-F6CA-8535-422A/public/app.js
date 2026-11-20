// Shared To-Do — P26-3A-8F79-F6CA-8535-422A. JavaScript puro; o servidor é a fonte da verdade.
"use strict";

const $ = (id) => document.getElementById(id);
const AVATAR_PADRAO = "https://cdn.discordapp.com/embed/avatars/0.png";
const PAPEL = { owner: "dono", member: "membro" };

let me = null;            // usuário logado
let listas = [];          // GET /api/lists
let atual = null;         // { list, members, tasks } da lista aberta
let pendentes = 0;        // requisições de alteração em andamento
let seqCarga = 0;         // descarta respostas de recarga antigas
const subAbertos = new Set(); // ids das tarefas com o form de subtarefa aberto
const editAbertos = new Set(); // ids das tarefas com o título em edição
let ultimaSinc = 0;       // Date.now() da última carga aplicada da lista aberta

// ---------- API ----------
class ApiErro extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}

async function api(method, path, body) {
  const opts = { method, credentials: "same-origin", headers: {} };
  if (body !== undefined) {
    opts.headers["Content-Type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch(path, opts);
  } catch {
    throw new ApiErro(0, "Sem conexão com o servidor.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiErro(res.status, data.error || `Erro ${res.status}`);
  return data;
}

// ---------- Avisos ----------
let avisoTimer;
function aviso(texto, erro = false) {
  const el = $("aviso");
  clearTimeout(avisoTimer);
  el.classList.toggle("erro", erro);
  el.textContent = texto;
  if (!erro) avisoTimer = setTimeout(() => { el.textContent = ""; }, 4000);
}

function tratarErro(e) {
  if (e.status === 401) return mostrarLogin();
  aviso(e.message || "Algo deu errado.", true);
}

// Desabilita os controles durante a requisição e trata erros.
async function executar(controles, fn) {
  controles.forEach((c) => { c.disabled = true; });
  pendentes++;
  try {
    await fn();
    return true;
  } catch (e) {
    tratarErro(e);
    return false;
  } finally {
    pendentes--;
    controles.forEach((c) => { c.disabled = false; });
  }
}

// ---------- Helpers de DOM ----------
function el(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k in n) n[k] = v;
    else n.setAttribute(k, v);
  }
  filhos.forEach((f) => f && n.append(f));
  return n;
}

function avatar(user, pequeno = false) {
  return el("img", {
    class: pequeno ? "avatar pq" : "avatar",
    src: user.avatarUrl || AVATAR_PADRAO,
    alt: `Avatar de ${user.username}`,
    width: pequeno ? 24 : 32,
    height: pequeno ? 24 : 32,
    loading: "lazy",
  });
}

function formControles(form) {
  return Array.from(form.elements);
}

// ---------- Telas ----------
function mostrarLogin() {
  me = null;
  atual = null;
  $("appView").hidden = true;
  $("profile").hidden = true;
  $("loginView").hidden = false;
}

function mostrarApp() {
  $("loginView").hidden = true;
  $("appView").hidden = false;
  $("profile").hidden = false;
  $("meAvatar").src = me.avatarUrl || AVATAR_PADRAO;
  $("meAvatar").alt = `Avatar de ${me.username}`;
  $("meName").textContent = me.username;
}

// ---------- Minhas listas ----------
async function carregarListas() {
  const data = await api("GET", "/api/lists");
  listas = data.lists;
  renderListas();
}

function renderListas() {
  const ul = $("listas");
  const idAberto = atual ? atual.list.id : null;
  ul.replaceChildren(...listas.map((l) => {
    const a = el("a", { href: `#/lista/${l.id}` },
      el("span", { class: "nome", text: l.name }),
      el("span", { class: "meta" },
        el("span", { class: "pill", text: PAPEL[l.role] || l.role }),
        ` · ${l.doneCount}/${l.taskCount} feitas · ${l.memberCount} ${l.memberCount === 1 ? "membro" : "membros"}`));
    if (l.id === idAberto) a.setAttribute("aria-current", "page");
    return el("li", {}, a);
  }));
  $("semListas").hidden = listas.length > 0;
}

// ---------- Lista aberta ----------
function idDaRota() {
  const m = location.hash.match(/^#\/lista\/(\d+)$/);
  return m ? Number(m[1]) : null;
}

// periodica = recarga automática; só ela compara com o estado anterior (mudanças de colegas).
async function carregarLista(id, periodica = false) {
  const seq = ++seqCarga;
  const data = await api("GET", `/api/lists/${id}`);
  if (seq !== seqCarga || idDaRota() !== id) return; // resposta velha
  // Uma ação local começou durante a recarga: a recarga da própria ação é que vale.
  if (periodica && pendentes > 0) return;
  const { marcar, n } = periodica && atual && atual.list.id === id
    ? mudancas(atual, data) : { marcar: new Set(), n: 0 };
  atual = data;
  ultimaSinc = Date.now();
  mostrarSinc();
  // Atualiza o progresso no painel sem outra requisição.
  const i = listas.findIndex((l) => l.id === data.list.id);
  if (i >= 0) listas[i] = data.list; else listas.push(data.list);
  renderListas();
  renderLista(marcar);
  if (n) aviso(n === 1 ? "1 alteração feita por colegas." : `${n} alterações feitas por colegas.`);
}

// Compara duas cargas da mesma lista: chaves "t<id>"/"m<id>" a destacar e total de alterações.
function mudancas(antes, depois) {
  const marcar = new Set();
  let n = 0;
  const tAntes = new Map(antes.tasks.map((t) => [t.id, t]));
  for (const t of depois.tasks) {
    const a = tAntes.get(t.id);
    if (!a || a.updatedAt !== t.updatedAt || a.done !== t.done || a.title !== t.title
      || a.assignee?.id !== t.assignee?.id) { marcar.add(`t${t.id}`); n++; }
    tAntes.delete(t.id);
  }
  n += tAntes.size; // tarefas removidas
  const mAntes = new Set(antes.members.map((m) => m.id));
  for (const m of depois.members) {
    if (!mAntes.delete(m.id)) { marcar.add(`m${m.id}`); n++; }
  }
  return { marcar, n: n + mAntes.size }; // + membros que saíram
}

function mostrarSinc() {
  if (!atual) return;
  const s = Math.max(0, Math.floor((Date.now() - ultimaSinc) / 1000));
  $("sinc").textContent = `Atualizado há ${s} s`;
}

function renderLista(marcar = new Set()) {
  const { list, members, tasks } = atual;
  // Preserva texto e foco dos inputs de subtarefa/edição e dos botões com id recriados.
  const ativo = document.activeElement;
  const focoId = ativo && ativo.id && $("listaConteudo").contains(ativo) ? ativo.id : null;
  const sel0 = focoId && ativo.type === "text" ? [ativo.selectionStart, ativo.selectionEnd] : null;
  const valores = {};
  $("tarefas").querySelectorAll("input[type=text]").forEach((i) => { valores[i.id] = i.value; });

  $("listaVazia").hidden = true;
  $("listaConteudo").hidden = false;
  $("listaNome").textContent = list.name;
  $("listaCodigo").textContent = list.shareCode;
  $("sairListaBtn").hidden = list.role === "owner";
  document.title = `${list.name} — Shared To-Do`;

  const feitas = tasks.filter((t) => t.done).length;
  $("listaProgressoTexto").textContent = `Progresso: ${feitas} de ${tasks.length} concluídas`;
  $("listaProgresso").max = Math.max(tasks.length, 1);
  $("listaProgresso").value = feitas;

  $("membros").replaceChildren(...members.map((m) => {
    const li = el("li", { class: marcar.has(`m${m.id}`) ? "mudou" : "" },
      avatar(m, true), el("span", { text: m.role === "owner" ? `${m.username} (dono)` : m.username }));
    if (list.role === "owner" && m.id !== me.id) li.append(botaoRemover(m));
    return li;
  }));

  // Select do formulário de nova tarefa: preserva a escolha atual.
  const sel = $("novaTarefaResp");
  const escolhido = sel.value;
  sel.replaceChildren(...opcoesResponsavel(members));
  if (members.some((m) => m.id === escolhido)) sel.value = escolhido;

  const filhos = new Map();
  tasks.filter((t) => t.parentId !== null).forEach((t) => {
    if (!filhos.has(t.parentId)) filhos.set(t.parentId, []);
    filhos.get(t.parentId).push(t);
  });
  const principais = tasks.filter((t) => t.parentId === null);
  $("tarefas").replaceChildren(...principais.map((t) => itemTarefa(t, filhos.get(t.id) || [], members, marcar)));
  $("semTarefas").hidden = principais.length > 0;

  $("tarefas").querySelectorAll("input[type=text]").forEach((i) => {
    if (i.id in valores) i.value = valores[i.id];
  });
  const novoFoco = focoId && $(focoId);
  if (novoFoco) {
    novoFoco.focus();
    if (sel0) novoFoco.setSelectionRange(sel0[0], sel0[1]);
  }
}

function opcoesResponsavel(members) {
  return [el("option", { value: "", text: "Sem responsável" }),
    ...members.map((m) => el("option", { value: m.id, text: m.username }))];
}

function botaoRemover(m) {
  const b = el("button", { type: "button", id: `remover-${m.id}`, class: "btn-ghost btn-perigo btn-mini", text: "Remover",
    "aria-label": `Remover ${m.username} da lista` });
  b.addEventListener("click", () => {
    if (!confirm(`Remover ${m.username} da lista? As tarefas atribuídas a essa pessoa ficarão sem responsável.`)) return;
    executar([b], async () => {
      try {
        await api("DELETE", `/api/lists/${atual.list.id}/members/${encodeURIComponent(m.id)}`);
      } catch (e) {
        // 404: o alvo já saiu; redesenha para o botão antigo sumir e mostra o erro do servidor.
        if (e.status === 404) await recarregar().catch(() => {});
        throw e;
      }
      await recarregar();
      $("listaNome").focus(); // o botão clicado sumiu; devolve o foco a um ponto estável
      aviso(`${m.username} foi removido(a) da lista.`);
    });
  });
  return b;
}

function itemTarefa(t, subs, members, marcar) {
  const li = el("li", { class: t.done ? "tarefa feita" : "tarefa" });

  const check = el("input", { type: "checkbox", id: `done-${t.id}`, checked: t.done });
  check.addEventListener("change", () => executar([check], async () => {
    await api("PATCH", `/api/tasks/${t.id}`, { done: check.checked });
    await recarregar();
  }).then((ok) => { if (!ok) check.checked = t.done; }));

  const resp = t.assignee
    ? el("span", { class: "resp" }, avatar(t.assignee, true), el("span", { text: t.assignee.username }))
    : el("span", { class: "resp", text: "sem responsável" });

  const selId = `resp-${t.id}`;
  const sel = el("select", { id: selId, class: "resp-select" }, ...opcoesResponsavel(members));
  sel.value = t.assignee ? t.assignee.id : "";
  sel.addEventListener("change", () => executar([sel], async () => {
    await api("PATCH", `/api/tasks/${t.id}`, { assigneeId: sel.value || null });
    await recarregar();
  }).then((ok) => { if (!ok) sel.value = t.assignee ? t.assignee.id : ""; }));

  const excluir = el("button", { type: "button", class: "btn-ghost btn-perigo", text: "Excluir" });
  excluir.setAttribute("aria-label", `Excluir tarefa ${t.title}`);
  excluir.addEventListener("click", () => {
    const aviso2 = subs.length ? " As subtarefas também serão excluídas." : "";
    if (!confirm(`Excluir "${t.title}"?${aviso2}`)) return;
    executar([excluir], async () => {
      await api("DELETE", `/api/tasks/${t.id}`);
      subAbertos.delete(t.id);
      await recarregar();
      aviso("Tarefa excluída.");
    });
  });

  const editando = editAbertos.has(t.id);
  const editar = el("button", { type: "button", id: `editar-${t.id}`, class: "btn-ghost", text: "Editar",
    "aria-label": `Editar título de ${t.title}` });
  editar.addEventListener("click", () => {
    editAbertos.add(t.id);
    renderLista();
    const input = $(`edit-${t.id}`);
    if (input) { input.focus(); input.select(); }
  });

  const acoes = el("div", { class: "acoes" });
  li.append(el("div", { class: marcar.has(`t${t.id}`) ? "tarefa-linha mudou" : "tarefa-linha" },
    editando ? formEditar(t)
      : el("label", { class: "check", htmlFor: check.id }, check, el("span", { text: t.title })),
    resp,
    el("label", { class: "sr-only", htmlFor: selId, text: `Responsável por ${t.title}` }),
    sel,
    acoes));

  if (t.parentId === null) {
    const abrir = el("button", { type: "button", class: "btn-ghost", text: "+ Subtarefa" });
    abrir.setAttribute("aria-expanded", String(subAbertos.has(t.id)));
    abrir.setAttribute("aria-label", `Adicionar subtarefa em ${t.title}`);
    acoes.append(abrir);
    if (!editando) acoes.append(editar);
    acoes.append(excluir);

    const form = formSubtarefa(t);
    form.hidden = !subAbertos.has(t.id);
    abrir.addEventListener("click", () => {
      const abrirAgora = form.hidden;
      form.hidden = !abrirAgora;
      abrir.setAttribute("aria-expanded", String(abrirAgora));
      if (abrirAgora) { subAbertos.add(t.id); form.querySelector("input").focus(); }
      else subAbertos.delete(t.id);
    });
    li.append(form);

    if (subs.length) {
      li.append(el("ul", { class: "subtarefas", "aria-label": `Subtarefas de ${t.title}` },
        ...subs.map((s) => itemTarefa(s, [], members, marcar))));
    }
  } else {
    if (!editando) acoes.append(editar);
    acoes.append(excluir);
  }
  return li;
}

// O input tem id fixo (edit-<id>): renderLista preserva texto e foco dele nas recargas.
function formEditar(t) {
  const inputId = `edit-${t.id}`;
  const input = el("input", { type: "text", id: inputId, maxLength: 200, required: true, value: t.title });
  const salvar = el("button", { type: "submit", class: "btn-primary", text: "Salvar",
    "aria-label": `Salvar título de ${t.title}` });
  const cancelar = el("button", { type: "button", class: "btn-ghost", text: "Cancelar",
    "aria-label": `Cancelar edição de ${t.title}` });
  const form = el("form", { class: "edit-form" },
    el("label", { class: "sr-only", htmlFor: inputId, text: `Novo título de ${t.title}` }), input, salvar, cancelar);
  const fechar = () => {
    editAbertos.delete(t.id);
    renderLista();
    const b = $(`editar-${t.id}`);
    if (b) b.focus();
  };
  cancelar.addEventListener("click", fechar);
  input.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape") { ev.preventDefault(); fechar(); }
  });
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const title = input.value.trim();
    if (!title) { aviso("O título não pode ficar vazio.", true); input.focus(); return; }
    if (title === t.title) return fechar();
    executar([input, salvar, cancelar], async () => {
      try {
        await api("PATCH", `/api/tasks/${t.id}`, { title });
      } catch (e) {
        // 404: um colega excluiu a tarefa; fecha a edição e redesenha.
        if (e.status === 404) { editAbertos.delete(t.id); await recarregar().catch(() => {}); }
        throw e;
      }
      editAbertos.delete(t.id);
      await recarregar();
    }).then((ok) => {
      const b = ok && $(`editar-${t.id}`);
      if (b) b.focus();
    });
  });
  return form;
}

function formSubtarefa(t) {
  const inputId = `sub-${t.id}`;
  const input = el("input", { type: "text", id: inputId, maxLength: 200, required: true, placeholder: "Título da subtarefa" });
  const btn = el("button", { type: "submit", class: "btn-primary", text: "Adicionar" });
  const form = el("form", { class: "sub-form" },
    el("label", { class: "sr-only", htmlFor: inputId, text: `Nova subtarefa de ${t.title}` }), input, btn);
  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const title = input.value.trim();
    if (!title) return;
    executar([input, btn], async () => {
      await api("POST", `/api/lists/${atual.list.id}/tasks`, { title, parentId: t.id });
      subAbertos.delete(t.id);
      input.value = "";
      await recarregar();
    });
  });
  return form;
}

async function recarregar(periodica = false) {
  const id = idDaRota();
  if (id !== null) await carregarLista(id, periodica);
}

// ---------- Rotas ----------
async function rota() {
  if (!me) return;
  const id = idDaRota();
  subAbertos.clear();
  editAbertos.clear();
  if (id === null) {
    atual = null;
    $("listaConteudo").hidden = true;
    $("listaVazia").hidden = false;
    document.title = "Shared To-Do — P26-3A-8F79-F6CA-8535-422A";
    renderListas();
    return;
  }
  try {
    await carregarLista(id);
    $("listaNome").focus();
  } catch (e) {
    tratarErro(e);
    if (e.status === 403 || e.status === 404) location.hash = "";
  }
}

// ---------- Formulários fixos ----------
$("novaListaForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const name = $("novaListaNome").value.trim();
  if (!name) return;
  executar(formControles(form), async () => {
    const { list } = await api("POST", "/api/lists", { name });
    form.reset();
    await carregarListas();
    location.hash = `#/lista/${list.id}`;
    aviso("Lista criada. Compartilhe o código com os colegas.");
  });
});

$("entrarForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const code = $("entrarCodigo").value.trim().toUpperCase();
  if (!code) return;
  executar(formControles(form), async () => {
    const { list } = await api("POST", "/api/lists/join", { code });
    form.reset();
    await carregarListas();
    location.hash = `#/lista/${list.id}`;
    aviso(`Você entrou em "${list.name}".`);
  });
});

$("novaTarefaForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  const form = ev.currentTarget;
  const title = $("novaTarefaTitulo").value.trim();
  if (!title || !atual) return;
  const body = { title };
  if ($("novaTarefaResp").value) body.assigneeId = $("novaTarefaResp").value;
  executar(formControles(form), async () => {
    await api("POST", `/api/lists/${atual.list.id}/tasks`, body);
    $("novaTarefaTitulo").value = "";
    await recarregar();
  }).then(() => $("novaTarefaTitulo").focus());
});

$("copiarBtn").addEventListener("click", async () => {
  const codigo = $("listaCodigo").textContent;
  try {
    await navigator.clipboard.writeText(codigo);
    aviso(`Código ${codigo} copiado.`);
  } catch {
    // Sem permissão de área de transferência: seleciona o texto para cópia manual.
    getSelection().selectAllChildren($("listaCodigo"));
    aviso("Não foi possível copiar automaticamente; o código está selecionado.", true);
  }
});

$("sairListaBtn").addEventListener("click", () => {
  if (!atual || !confirm(`Sair da lista "${atual.list.name}"? As tarefas atribuídas a você ficarão sem responsável.`)) return;
  const id = atual.list.id;
  executar([$("sairListaBtn")], async () => {
    try {
      await api("DELETE", `/api/lists/${id}/members/${encodeURIComponent(me.id)}`);
    } catch (e) {
      // 404: já tinha sido removido; volta ao painel do mesmo jeito e mostra o erro do servidor.
      if (e.status === 404) { location.hash = ""; await carregarListas().catch(() => {}); }
      throw e;
    }
    location.hash = "";
    await carregarListas();
    aviso("Você saiu da lista.");
  });
});

$("logoutBtn").addEventListener("click", () => executar([$("logoutBtn")], async () => {
  await api("POST", "/api/auth/logout");
  history.replaceState(null, "", "/");
  mostrarLogin();
}));

window.addEventListener("hashchange", rota);

// ---------- Atualização periódica ----------
setInterval(() => {
  if (!me || !atual || pendentes > 0 || document.visibilityState !== "visible") return;
  // Um select aberto seria fechado ao redesenhar; espera o usuário terminar.
  const ativo = document.activeElement;
  if (ativo && ativo.tagName === "SELECT" && $("listaConteudo").contains(ativo)) return;
  const id = idDaRota();
  recarregar(true).catch((e) => {
    if (e.status !== 403 && e.status !== 404) return tratarErro(e);
    if (idDaRota() !== id) return; // o usuário já saiu dessa lista por conta própria
    // Fui removido (ou a lista sumiu): volta ao painel.
    location.hash = "";
    aviso("Você não é mais membro desta lista.", true);
    carregarListas().catch(tratarErro);
  });
}, 5000);

setInterval(mostrarSinc, 1000);

// ---------- Início ----------
(async function iniciar() {
  const params = new URLSearchParams(location.search);
  const erroAuth = params.get("auth_error");
  if (erroAuth) {
    $("authError").textContent = `Não foi possível entrar com o Discord (${erroAuth}). Tente novamente.`;
    $("authError").hidden = false;
    history.replaceState(null, "", location.pathname + location.hash);
  }
  try {
    const data = await api("GET", "/api/me");
    me = data.user;
    mostrarApp();
    await carregarListas();
    await rota();
  } catch (e) {
    tratarErro(e);
    if (!me) mostrarLogin();
  }
})();
