"use strict";

const app = document.getElementById("app");
let usuario = null, atual = null, timer = null;

// Cria elementos sem innerHTML: textos entram como nós de texto (evita XSS).
function el(tag, attrs = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (k === "class") n.className = v;
    else if (k in n) n[k] = v;
    else n.setAttribute(k, v);
  }
  n.append(...filhos.flat(Infinity).filter((f) => f != null));
  return n;
}

async function api(caminho, metodo = "GET", corpo) {
  const r = await fetch(caminho, {
    method: metodo,
    headers: corpo ? { "content-type": "application/json" } : {},
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401) { usuario = null; telaLogin(); throw new Error("sessao-expirada"); }
  if (!r.ok) throw new Error(d.erro || "Erro inesperado.");
  return d;
}
const falha = (e) => { if (e.message !== "sessao-expirada") alert(e.message); };

const ERROS_LOGIN = {
  access_denied: "Você cancelou o login no Discord.",
  estado_invalido: "A sessão de login expirou. Tente entrar de novo.",
  troca_de_token_falhou: "O Discord recusou o login. Confira o Redirect cadastrado no aplicativo.",
  perfil_indisponivel: "Não foi possível ler seu perfil do Discord.",
};

function telaLogin() {
  clearInterval(timer);
  const motivo = new URLSearchParams(location.search).get("auth_error");
  app.replaceChildren(el("section", { class: "card" },
    el("h1", {}, "Shared To-Do"),
    el("p", {}, "Crie listas de tarefas e compartilhe o código de acesso com os colegas da turma."),
    motivo ? el("p", { role: "alert", class: "erro" }, ERROS_LOGIN[motivo] || "Não foi possível entrar. Tente de novo.") : null,
    el("a", { class: "btn discord", href: "/api/auth/discord" }, "Entrar com Discord")));
}

function cabecalho(voltar) {
  return el("div", { class: "topo" },
    voltar ? el("button", { class: "sec", onclick: telaHome }, "← Minhas listas") : el("strong", {}, "Shared To-Do"),
    el("div", { class: "usuario" },
      el("img", { class: "avatar", src: usuario.avatar_url, alt: "" }),
      el("span", {}, usuario.username),
      el("button", { class: "sec", onclick: async () => { await api("/api/auth/logout", "POST").catch(() => {}); location.reload(); } }, "Sair")));
}

async function telaHome() {
  atual = null; clearInterval(timer);
  try {
    const listas = await api("/api/lists");
    const nome = el("input", { placeholder: "Nome da nova lista", "aria-label": "Nome da nova lista", maxLength: 80 });
    const codigo = el("input", { placeholder: "Código de acesso", "aria-label": "Código de acesso", maxLength: 16 });
    app.replaceChildren(
      cabecalho(false),
      el("section", { class: "card" }, el("h2", {}, "Criar lista"),
        el("div", { class: "row" }, nome,
          el("button", { onclick: () => api("/api/lists", "POST", { nome: nome.value }).then((r) => abrir(r.id)).catch(falha) }, "Criar lista"))),
      el("section", { class: "card" }, el("h2", {}, "Entrar numa lista"),
        el("div", { class: "row" }, codigo,
          el("button", { onclick: () => api("/api/lists/join", "POST", { codigo: codigo.value }).then((r) => abrir(r.id)).catch(falha) }, "Entrar"))),
      el("section", { class: "card" }, el("h2", {}, "Minhas listas"),
        listas.length
          ? listas.map((l) => el("div", {
              class: "tarefa lista-item",
              role: "button",
              tabindex: 0,
              onclick: () => abrir(l.id),
              onkeydown: (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  abrir(l.id);
                }
              },
            },
              el("span", {}, l.name), el("small", {}, `${l.feitas}/${l.total} concluídas`)))
          : el("p", { class: "vazio" }, "Você ainda não participa de nenhuma lista. Crie uma ou entre com um código.")));
  } catch (e) { falha(e); }
}

async function abrir(id) {
  atual = id; clearInterval(timer);
  await recarregar();
  // Sincroniza com os colegas a cada 8 s, sem atrapalhar quem está digitando.
  timer = setInterval(() => {
    if (!["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) recarregar();
  }, 8000);
}

async function recarregar() {
  if (!atual) return;
  try { desenhar(await api(`/api/lists/${atual}`)); } catch (e) { falha(e); }
}

function desenhar({ lista, membros, tarefas }) {
  const porId = new Map(membros.map((m) => [m.id, m]));
  const raizes = tarefas.filter((t) => !t.parent_id);
  const filhas = (id) => tarefas.filter((t) => t.parent_id === id);
  // Toda interação: envia ao servidor e relê o estado dele.
  const agir = (p) => p.then(recarregar).catch(falha);

  const linha = (t, sub) => {
    const resp = porId.get(t.assignee_id);
    const seletor = el("select", {
      "aria-label": `Responsável por ${t.title}`,
      onchange: (e) => agir(api(`/api/tasks/${t.id}`, "PATCH", { assignee_id: e.target.value || null })),
    },
      el("option", { value: "" }, "sem responsável"),
      membros.map((m) => el("option", { value: m.id, selected: m.id === t.assignee_id }, m.username)));
    return el("div", { class: `tarefa${t.done ? " feita" : ""}${sub ? " sub" : ""}` },
      el("input", { type: "checkbox", checked: !!t.done, "aria-label": `${t.done ? "Reabrir" : "Concluir"} ${t.title}`,
        onchange: (e) => agir(api(`/api/tasks/${t.id}`, "PATCH", { done: e.target.checked })) }),
      el("span", { class: "titulo" }, t.title),
      resp ? el("img", { class: "avatar", src: resp.avatar_url, alt: resp.username, title: resp.username }) : null,
      seletor,
      el("button", { class: "perigo", "aria-label": `Excluir tarefa: ${t.title}`,
        onclick: () => confirm("Excluir esta tarefa?") && agir(api(`/api/tasks/${t.id}`, "DELETE")) }, "✕"));
  };

  const novaTarefa = el("input", { placeholder: "Nova tarefa", "aria-label": "Nova tarefa", maxLength: 200 });
  const blocoSub = (pai) => {
    const campo = el("input", { placeholder: "Nova subtarefa", "aria-label": "Nova subtarefa", maxLength: 200 });
    return el("div", { class: "row sub" }, campo,
      el("button", { class: "sec",
        onclick: () => agir(api(`/api/lists/${atual}/tasks`, "POST", { titulo: campo.value, parent_id: pai.id })) }, "Adicionar subtarefa"));
  };

  app.replaceChildren(
    cabecalho(true),
    el("section", { class: "card" },
      el("h2", {}, lista.name),
      el("p", {}, "Código de acesso: ", el("span", { class: "codigo" }, lista.code), " ",
        el("button", { class: "sec", onclick: () => navigator.clipboard?.writeText(lista.code) }, "Copiar")),
      el("div", { class: "row" }, membros.map((m) => el("img", { class: "avatar", src: m.avatar_url, alt: m.username, title: m.username }))),
      lista.owner_id === usuario.id
        ? el("p", {}, el("button", { class: "perigo",
            onclick: () => confirm("Excluir a lista inteira?") && api(`/api/lists/${atual}`, "DELETE").then(telaHome).catch(falha) }, "Excluir lista"))
        : null),
    el("section", { class: "card" },
      el("div", { class: "row" }, novaTarefa,
        el("button", { onclick: () => agir(api(`/api/lists/${atual}/tasks`, "POST", { titulo: novaTarefa.value })) }, "Adicionar tarefa")),
      raizes.length
        ? raizes.map((t) => [linha(t, false), filhas(t.id).map((s) => linha(s, true)), blocoSub(t)])
        : el("p", { class: "vazio" }, "Nenhuma tarefa ainda. Adicione a primeira acima.")));
}

(async () => {
  try { usuario = await api("/api/me"); await telaHome(); } catch { /* api() já mostrou o login */ if (!usuario) telaLogin(); }
})();
