import { scaleAmount, formatAmount } from "./scale.js";

const UNITS = ["g", "kg", "ml", "l", "xícara", "colher de sopa", "colher de chá", "unidade", "pitada"];
const $ = (sel) => document.querySelector(sel);
const state = { user: null, view: "all", currentId: null };

// Cria elementos sem innerHTML: todo texto entra como textContent (sem XSS).
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  n.append(...kids);
  return n;
}

async function api(path, opts = {}) {
  const res = await fetch(path, { credentials: "same-origin", headers: { "content-type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Algo deu errado. Tente de novo.");
  return data;
}

/* ---------- Sessão e navegação ---------- */
async function loadMe() {
  state.user = (await api("/api/me")).user;
  renderAuth();
  renderNav();
}

function renderAuth() {
  const box = $("#auth");
  box.replaceChildren();
  if (!state.user) {
    box.append(el("a", { class: "btn", href: "/api/auth/login" }, "Entrar com Discord"));
    return;
  }
  const { id, username, avatar } = state.user;
  if (avatar) box.append(el("img", { src: `https://cdn.discordapp.com/avatars/${id}/${avatar}.png?size=64`, alt: "" }));
  box.append(el("span", {}, username), el("button", { type: "button", onclick: logout }, "Sair"));
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  state.user = null; state.view = "all";
  renderAuth(); renderNav(); refresh();
}

function renderNav() {
  const items = [["all", "Receitas"]];
  if (state.user) items.push(["fav", "Meu livro"], ["new", "Nova receita"]);
  $("#nav").replaceChildren(...items.map(([v, label]) =>
    el("button", { type: "button", "aria-current": state.view === v ? "page" : "false", onclick: () => { state.view = v; renderNav(); refresh(); } }, label)));
}

function refresh() {
  if (state.view === "new") { $("#list").replaceChildren(); return renderForm(); }
  state.currentId = null;
  $("#panel").replaceChildren(el("p", { class: "empty" }, "Escolha uma receita na lista para ver os ingredientes e ajustar as porções."));
  loadList();
}

/* ---------- Lista e busca ---------- */
async function loadList() {
  const list = $("#list");
  try {
    let data;
    if (state.view === "fav") data = await api("/api/favorites");
    else {
      const p = new URLSearchParams();
      for (const [k, v] of new FormData($("#filters"))) if (String(v).trim()) p.set(k, String(v).trim());
      data = await api(`/api/recipes?${p}`);
    }
    if (!data.recipes.length) {
      list.replaceChildren(el("li", { class: "empty" }, state.view === "fav"
        ? "Seu livro está vazio. Abra uma receita e toque em Favoritar."
        : "Nenhuma receita encontrada. Ajuste a busca ou publique a primeira."));
      return;
    }
    list.replaceChildren(...data.recipes.map((r) => el("li", {},
      el("button", { type: "button", "aria-current": String(r.id === state.currentId), onclick: () => openRecipe(r.id) },
        el("span", { class: "t" }, r.title),
        el("span", { class: "m" }, `${r.prep_time_min} min, serve ${r.servings}, por ${r.author}`)))));
  } catch (e) {
    list.replaceChildren(el("li", { class: "empty" }, e.message));
  }
}

/* ---------- Receita com escalonador ---------- */
async function openRecipe(id) {
  state.currentId = id;
  try { renderRecipe((await api(`/api/recipes/${id}`)).recipe); }
  catch (e) { $("#panel").replaceChildren(el("p", { class: "msg" }, e.message)); }
  loadList();
}

function renderRecipe(r) {
  const qtyCells = r.ingredients.map(() => el("span", { class: "qty" }));
  const input = el("input", { type: "number", min: "1", max: "99", value: String(r.servings), "aria-label": "Porções desejadas" });

  // Recalcula todas as quantidades no DOM a cada mudança do rendimento.
  const update = () => {
    const want = Math.min(99, Math.max(1, parseInt(input.value, 10) || r.servings));
    r.ingredients.forEach((i, n) => { qtyCells[n].textContent = formatAmount(scaleAmount(i.amount, r.servings, want)); });
  };
  const step = (d) => { input.value = String(Math.min(99, Math.max(1, (parseInt(input.value, 10) || r.servings) + d))); update(); };
  input.addEventListener("input", update);
  update();

  const favBtn = el("button", { type: "button", class: "fav", "aria-pressed": String(!!r.is_fav) }, r.is_fav ? "Favoritada" : "Favoritar");
  favBtn.addEventListener("click", async () => {
    if (!state.user) return alert("Entre com o Discord para favoritar receitas.");
    try {
      const res = await api(`/api/favorites/${r.id}`, { method: r.is_fav ? "DELETE" : "PUT" });
      r.is_fav = res.is_fav;
      favBtn.setAttribute("aria-pressed", String(!!r.is_fav));
      favBtn.textContent = r.is_fav ? "Favoritada" : "Favoritar";
      if (state.view === "fav") loadList();
    } catch (e) { alert(e.message); }
  });

  $("#panel").replaceChildren(
    favBtn,
    el("h2", {}, r.title),
    el("p", { class: "meta" }, `${r.prep_time_min} minutos, receita original para ${r.servings} porções, por ${r.author}`),
    el("div", { class: "servings" },
      el("button", { type: "button", "aria-label": "Menos uma porção", onclick: () => step(-1) }, "−"),
      input,
      el("button", { type: "button", "aria-label": "Mais uma porção", onclick: () => step(1) }, "+"),
      el("span", {}, "porções")),
    el("ul", { class: "ings" }, ...r.ingredients.map((i, n) => el("li", {}, qtyCells[n], el("span", { class: "unit" }, i.unit), el("span", {}, i.name)))),
    el("h2", {}, "Modo de preparo"),
    el("ol", { class: "steps" }, ...r.steps.map((s) => el("li", {}, s))));
}

/* ---------- Nova receita ---------- */
function ingredientRow() {
  const row = el("div", { class: "row" },
    el("input", { name: "amount", type: "number", min: "0.01", step: "any", placeholder: "Qtd.", "aria-label": "Quantidade", required: "" }),
    el("select", { name: "unit", "aria-label": "Unidade" }, ...UNITS.map((u) => el("option", { value: u }, u))),
    el("input", { name: "iname", maxlength: "80", placeholder: "Ingrediente", "aria-label": "Nome do ingrediente", required: "" }),
    el("button", { type: "button", class: "btn", "aria-label": "Remover ingrediente", onclick: () => row.remove() }, "×"));
  return row;
}

function renderForm() {
  const ings = el("div", {}, ingredientRow());
  const msg = el("p", { class: "msg", role: "alert" });
  const form = el("form", { class: "form" },
    el("h2", {}, "Nova receita"),
    el("label", {}, "Nome do prato", el("input", { name: "title", minlength: "3", maxlength: "100", required: "" })),
    el("label", {}, "Tempo de preparo (minutos)", el("input", { name: "prep", type: "number", min: "1", max: "1440", required: "" })),
    el("label", {}, "Rende quantas porções", el("input", { name: "servings", type: "number", min: "1", max: "50", required: "" })),
    el("fieldset", {}, el("legend", {}, "Ingredientes"), ings,
      el("button", { type: "button", class: "btn", onclick: () => ings.append(ingredientRow()) }, "Adicionar ingrediente")),
    el("label", {}, "Modo de preparo (um passo por linha)", el("textarea", { name: "steps", rows: "6", required: "" })),
    el("button", { type: "submit", class: "btn primary" }, "Publicar receita"), msg);

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const f = new FormData(form);
    const body = {
      title: f.get("title"), prep_time_min: Number(f.get("prep")), servings: Number(f.get("servings")),
      ingredients: [...ings.children].map((row) => ({
        amount: Number(row.querySelector("[name=amount]").value),
        unit: row.querySelector("[name=unit]").value,
        name: row.querySelector("[name=iname]").value,
      })),
      steps: String(f.get("steps")).split("\n").map((s) => s.trim()).filter(Boolean),
    };
    try {
      const { id } = await api("/api/recipes", { method: "POST", body: JSON.stringify(body) });
      state.view = "all"; renderNav(); refresh(); openRecipe(id);
    } catch (e) { msg.textContent = e.message; }
  });
  $("#panel").replaceChildren(form);
}

$("#filters").addEventListener("submit", (ev) => { ev.preventDefault(); if (state.view !== "all") { state.view = "all"; renderNav(); } loadList(); });
loadMe().then(refresh).catch(() => { renderAuth(); refresh(); });
