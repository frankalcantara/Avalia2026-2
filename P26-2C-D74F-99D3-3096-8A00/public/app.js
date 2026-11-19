const $ = (s) => document.querySelector(s);
const LABEL = {
  perdi: "Perdi", encontrei: "Encontrei",
  eletronicos: "Eletrônicos", documentos: "Documentos", garrafas: "Garrafas", vestuario: "Vestuário",
  aberto: "Aberto", em_andamento: "Em andamento", encerrado: "Encerrado",
  pendente: "Pendente", aceita: "Aceita", recusada: "Recusada", encerrada: "Encerrada",
};
let me = null;

function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else n[k] = v;
  }
  for (const c of kids.flat()) if (c != null) n.append(c);
  return n;
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || (data.errors || []).join(" ") || "Erro " + res.status);
    err.list = data.errors;
    throw err;
  }
  return data;
}

function notice(msg, isError = false) {
  const n = $("#notice");
  n.textContent = msg;
  n.className = "notice" + (isError ? " error" : "");
  n.hidden = !msg;
}

function fmtDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/* ---------- autenticação ---------- */
function renderAuth() {
  const box = $("#auth");
  box.replaceChildren();
  if (me) {
    box.append(
      el("img", { src: me.avatar, alt: "" }),
      el("span", { textContent: me.username }),
      el("button", { class: "ghost", textContent: "Sair", onclick: logout })
    );
  } else {
    box.append(el("a", { class: "btn ghost", href: "/api/auth/discord", textContent: "Entrar com Discord" }));
  }
  $("#btn-claims").hidden = !me;
}

async function loadMe() {
  try { me = (await api("/api/me")).user; } catch { me = null; }
  renderAuth();
}

async function logout() {
  await api("/api/auth/logout", { method: "POST" });
  me = null;
  renderAuth();
  notice("Você saiu.");
}

/* ---------- listagem e filtros ---------- */
function filterParams() {
  const p = new URLSearchParams();
  for (const [id, key] of [["f-type", "type"], ["f-category", "category"], ["f-status", "status"],
                           ["f-q", "q"], ["f-local", "local"]]) {
    const v = $("#" + id).value.trim();
    if (v) p.set(key, v);
  }
  return p;
}

async function loadItems() {
  try {
    const { items } = await api("/api/items?" + filterParams());
    $("#count").textContent = items.length + (items.length === 1 ? " item" : " itens");
    $("#list").replaceChildren(...items.map(card));
    if (!items.length) $("#list").append(el("p", { class: "muted", textContent: "Nenhum item encontrado." }));
  } catch (e) { notice(e.message, true); }
}

function card(it) {
  return el("button", { class: "card", type: "button", onclick: () => openDetail(it.id) },
    el("span", { class: "badge " + it.type, textContent: LABEL[it.type] }),
    el("span", { class: "badge status " + it.status, textContent: LABEL[it.status] }),
    el("h3", { textContent: it.title }),
    el("div", { class: "muted", textContent: `${LABEL[it.category]} · ${it.location}` }),
    el("div", { class: "muted", textContent: fmtDate(it.event_date) })
  );
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ---------- detalhe e reivindicação ---------- */
async function openDetail(id) {
  const dlg = $("#dlg-detail");
  try {
    const { item } = await api("/api/items/" + id);
    const msg = el("textarea", { rows: 3, maxLength: 500, placeholder: "Conte por que o item é seu / como o encontrou" });
    const err = el("p", { class: "errors" });

    const kids = [
      el("h2", { textContent: item.title }),
      el("p", {}, el("span", { class: "badge " + item.type, textContent: LABEL[item.type] }),
                  el("span", { class: "badge status " + item.status, textContent: LABEL[item.status] })),
      el("p", { textContent: item.description }),
      el("p", { class: "muted", textContent: `${LABEL[item.category]} · ${item.location} · ${fmtDate(item.event_date)}` }),
      el("p", { class: "muted", textContent: "Cadastrado por " + item.owner_name }),
    ];

    if (item.status !== "encerrado") {
      if (!me) kids.push(el("a", { class: "btn", href: "/api/auth/discord", textContent: "Entre para reivindicar" }));
      else if (me.userId !== item.owner_id) {
        kids.push(el("label", { textContent: "Mensagem" }), msg, err,
          el("div", { class: "row" }, el("button", { textContent: "Reivindicar", onclick: async () => {
            try {
              await api(`/api/items/${id}/claims`, { method: "POST", body: { message: msg.value } });
              dlg.close();
              notice("Reivindicação enviada. Acompanhe em “Minhas reivindicações”.");
            } catch (e) { err.textContent = e.message; }
          } })));
      }
    }
    kids.push(el("div", { class: "row" }, el("button", { class: "ghost", textContent: "Fechar", onclick: () => dlg.close() })));
    dlg.replaceChildren(...kids);
    dlg.showModal();
  } catch (e) { notice(e.message, true); }
}

/* ---------- novo item ---------- */
function openNew() {
  if (!me) { notice("Entre com o Discord para cadastrar um item.", true); return; }
  const dlg = $("#dlg-new");
  const f = {
    type: el("select", {}, ...["perdi", "encontrei"].map((v) => el("option", { value: v, textContent: LABEL[v] }))),
    category: el("select", {}, ...["eletronicos", "documentos", "garrafas", "vestuario"].map((v) => el("option", { value: v, textContent: LABEL[v] }))),
    title: el("input", { maxLength: 80, required: true }),
    location: el("input", { maxLength: 120, required: true, placeholder: "Ex.: Bloco A, sala 12" }),
    event_date: el("input", { type: "date", required: true, max: new Date().toISOString().slice(0, 10) }),
    description: el("textarea", { rows: 4, maxLength: 1000, required: true }),
  };
  const errs = el("ul", { class: "errors" });
  const field = (label, input) => [el("label", { textContent: label }), input];

  const form = el("form", { onsubmit: async (e) => {
    e.preventDefault();
    errs.replaceChildren();
    const body = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.value]));
    try {
      await api("/api/items", { method: "POST", body });
      dlg.close();
      notice("Item cadastrado.");
      loadItems();
    } catch (er) {
      (er.list || [er.message]).forEach((m) => errs.append(el("li", { textContent: m })));
    }
  } },
    el("h2", { textContent: "Novo item" }),
    field("Tipo", f.type), field("Categoria", f.category), field("Título", f.title),
    field("Local exato", f.location), field("Data", f.event_date), field("Descrição detalhada", f.description),
    errs,
    el("div", { class: "row" },
      el("button", { type: "submit", textContent: "Salvar" }),
      el("button", { type: "button", class: "ghost", textContent: "Cancelar", onclick: () => dlg.close() }))
  );
  dlg.replaceChildren(form);
  dlg.showModal();
}

/* ---------- minhas reivindicações ---------- */
async function claimAction(id, action) {
  try {
    await api(`/api/claims/${id}/${action}`, { method: "POST" });
    await openClaims();
    loadItems();
  } catch (e) { notice(e.message, true); }
}

function claimBox(c, asOwner) {
  const kids = [
    el("strong", { textContent: c.item_title }),
    el("span", { class: "badge status", textContent: LABEL[c.status] }),
  ];
  if (c.message) kids.push(el("p", { textContent: "“" + c.message + "”" }));
  if (asOwner) kids.push(el("p", { class: "muted", textContent: "Contato de quem reivindica: " + c.claimant_contact }));
  if (c.status === "aceita" || c.status === "encerrada") {
    kids.push(el("p", { textContent: `Contatos no Discord → dono: ${c.owner_contact} | reivindicante: ${c.claimant_contact}` }));
  }
  const row = el("div", { class: "row" });
  if (asOwner && c.status === "pendente") {
    row.append(el("button", { class: "ok", textContent: "Aceitar", onclick: () => claimAction(c.id, "accept") }),
               el("button", { class: "danger", textContent: "Recusar", onclick: () => claimAction(c.id, "reject") }));
  }
  if (c.status === "aceita") {
    row.append(el("button", { textContent: "Marcar como devolvido (encerrar)", onclick: () => claimAction(c.id, "close") }));
  }
  if (row.children.length) kids.push(row);
  return el("div", { class: "claim" }, ...kids);
}

async function openClaims() {
  const dlg = $("#dlg-claims");
  try {
    const { mine, received } = await api("/api/claims");
    dlg.replaceChildren(
      el("h2", { textContent: "Minhas reivindicações" }),
      ...(mine.length ? mine.map((c) => claimBox(c, false)) : [el("p", { class: "muted", textContent: "Nenhuma." })]),
      el("h2", { textContent: "Recebidas nos meus itens" }),
      ...(received.length ? received.map((c) => claimBox(c, true)) : [el("p", { class: "muted", textContent: "Nenhuma." })]),
      el("div", { class: "row" }, el("button", { class: "ghost", textContent: "Fechar", onclick: () => dlg.close() }))
    );
    if (!dlg.open) dlg.showModal();
  } catch (e) { notice(e.message, true); }
}

/* ---------- inicialização ---------- */
const ERR = { invalid_state: "Falha de segurança no login. Tente de novo.", missing_code: "Login cancelado.",
  token_exchange_failed: "O Discord recusou o login.", exception: "Erro interno no login." };

async function init() {
  const q = new URLSearchParams(location.search);
  if (q.get("auth_error")) notice(ERR[q.get("auth_error")] || "Erro no login.", true);
  if (q.has("login") || q.has("auth_error")) history.replaceState(null, "", "/");

  await loadMe();

  const reload = debounce(loadItems, 250);
  ["f-q", "f-local"].forEach((id) => $("#" + id).addEventListener("input", reload));
  ["f-type", "f-category", "f-status"].forEach((id) => $("#" + id).addEventListener("change", loadItems));
  $("#btn-clear").addEventListener("click", () => {
    document.querySelectorAll(".filters select, .filters input").forEach((n) => (n.value = ""));
    loadItems();
  });
  $("#btn-new").addEventListener("click", openNew);
  $("#btn-claims").addEventListener("click", openClaims);

  loadItems();
}
init();