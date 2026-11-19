/* Bazar Pixel — frontend em JavaScript puro (sem frameworks, sem build).
 * Projeto #35 · Chave Única P26-2C-DA71-C3BA-A1AC-470B
 *
 * Organização:
 *   - um único objeto `state`;
 *   - eventos alteram `state` e chamam `render()`;
 *   - todo texto vindo da API ou do usuário entra no DOM via textContent
 *     e document.createElement (nenhuma injeção de HTML como string).
 * Rotas consumidas: ver docs/CONTRATO-API.md.
 */
"use strict";

const CHAVE_PROJETO = "P26-2C-DA71-C3BA-A1AC-470B";
const CART_PREFIX = "bazarpixel:cart:";
const MAX_CART_LINES = 50; // limite do contrato: 1..50 itens
const MAX_QTY = 99;        // limite do contrato: quantity 1..99

/* ------------------------------------------------------------------ */
/* Estado                                                              */
/* ------------------------------------------------------------------ */
const state = {
  authChecked: false,
  user: null,                 // { user_id, username, avatar, balance, created_at }
  products: [],
  categories: [],
  priceRange: { min: 0, max: 0 },
  productsStatus: "loading",  // loading | ready | error
  productsError: "",
  filters: { q: "", category: "", min: null, max: null, sort: "name", inStock: false },
  cart: new Map(),            // productId(number) -> quantity(number)
  checkingOut: false,
  orders: [],
  ordersStatus: "idle",       // idle | loading | ready | error
  ordersError: "",
  tab: "loja",                // loja | pedidos
  receipt: null,              // { order, status } exibido no <dialog>
  notice: null,               // { kind: info|ok|error, text }
};

/* ------------------------------------------------------------------ */
/* Utilidades                                                          */
/* ------------------------------------------------------------------ */
const $ = (id) => document.getElementById(id);
const nf = new Intl.NumberFormat("pt-BR");
const fmtCr = (n) => nf.format(Number(n) || 0) + " cr";
const dtf = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Aceita ISO, "YYYY-MM-DD HH:MM:SS" (SQLite, assumido UTC) ou epoch. */
function fmtDate(value) {
  if (value === null || value === undefined || value === "") return "—";
  let d;
  if (typeof value === "number") {
    d = new Date(value < 1e12 ? value * 1000 : value);
  } else {
    const s = String(value);
    const sqlite = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;
    d = new Date(sqlite.test(s) ? s.replace(" ", "T") + "Z" : s);
  }
  return Number.isNaN(d.getTime()) ? String(value) : dtf.format(d);
}

/** Cria um elemento com classe e texto (sempre via textContent). */
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = String(text);
  return node;
}

function normalize(s) {
  return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** fetch JSON que nunca lança: devolve { status, data, networkError }. */
async function api(path, options = {}) {
  const opts = { credentials: "same-origin", headers: { Accept: "application/json" }, ...options };
  if (opts.body !== undefined && typeof opts.body !== "string") {
    opts.headers = { ...opts.headers, "Content-Type": "application/json" };
    opts.body = JSON.stringify(opts.body);
  }
  try {
    const res = await fetch(path, opts);
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { status: res.status, data, networkError: false };
  } catch {
    return { status: 0, data: null, networkError: true };
  }
}

function serverMessage(r, fallback) {
  if (r.networkError) return "Não foi possível falar com o servidor. Verifique sua conexão e tente de novo.";
  if (r.data && typeof r.data.message === "string" && r.data.message) return r.data.message;
  return fallback + (r.status ? ` (HTTP ${r.status})` : "");
}

function setNotice(kind, text) {
  state.notice = text ? { kind, text } : null;
  renderNotice();
}

/* ------------------------------------------------------------------ */
/* Carrinho: Map + localStorage por usuário                            */
/* ------------------------------------------------------------------ */
function cartKey() {
  return state.user ? CART_PREFIX + state.user.user_id : null;
}

function loadCart() {
  state.cart = new Map();
  const key = cartKey();
  if (!key) return;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      const id = Number(entry && entry[0]);
      const qty = Number(entry && entry[1]);
      if (Number.isInteger(id) && id > 0 && Number.isInteger(qty) && qty > 0) {
        state.cart.set(id, Math.min(qty, MAX_QTY));
      }
    }
  } catch {
    /* localStorage indisponível ou corrompido: começa vazio */
  }
}

function saveCart() {
  const key = cartKey();
  if (!key) return;
  try {
    if (state.cart.size === 0) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify([...state.cart.entries()]));
  } catch {
    /* modo privado / cota cheia: carrinho segue só em memória */
  }
}

function productById(id) {
  return state.products.find((p) => p.id === id) || null;
}

function maxQtyFor(product) {
  return product ? Math.min(Number(product.stock) || 0, MAX_QTY) : 0;
}

function addToCart(id) {
  if (!state.user) {
    setNotice("info", "Entre com Discord para adicionar itens ao carrinho.");
    return;
  }
  const p = productById(id);
  if (!p) return;
  const current = state.cart.get(id) || 0;
  const limit = maxQtyFor(p);
  if (current >= limit) {
    setNotice("info", `Limite de estoque atingido para “${p.name}” (${limit} un.).`);
    return;
  }
  if (!state.cart.has(id) && state.cart.size >= MAX_CART_LINES) {
    setNotice("error", `O carrinho aceita no máximo ${MAX_CART_LINES} produtos diferentes.`);
    return;
  }
  state.cart.set(id, current + 1);
  saveCart();
  render();
}

function setQty(id, qty) {
  const p = productById(id);
  const limit = p ? maxQtyFor(p) : MAX_QTY;
  const next = Math.min(Math.max(0, qty), limit);
  if (next <= 0) state.cart.delete(id);
  else state.cart.set(id, next);
  saveCart();
  render();
}

function cartLines() {
  return [...state.cart.entries()].map(([id, qty]) => {
    const product = productById(id);
    return { id, qty, product, subtotal: product ? product.price * qty : 0 };
  });
}

function cartTotal() {
  return cartLines().reduce((sum, l) => sum + l.subtotal, 0);
}

function cartUnits() {
  let n = 0;
  for (const q of state.cart.values()) n += q;
  return n;
}

/* ------------------------------------------------------------------ */
/* Filtros (aplicados localmente sobre state.products)                 */
/* ------------------------------------------------------------------ */
function priceFilterError() {
  const { min, max } = state.filters;
  if (min !== null && max !== null && min > max) return "O preço mínimo não pode ser maior que o máximo.";
  return "";
}

function filteredProducts() {
  const f = state.filters;
  const q = normalize(f.q.trim());
  const priceOk = !priceFilterError();
  const list = state.products.filter((p) => {
    if (f.category && p.category !== f.category) return false;
    if (f.inStock && !(p.stock > 0)) return false;
    if (priceOk && f.min !== null && p.price < f.min) return false;
    if (priceOk && f.max !== null && p.price > f.max) return false;
    if (q && !normalize(p.name + " " + p.description + " " + (p.sku || "")).includes(q)) return false;
    return true;
  });
  const byName = (a, b) => a.name.localeCompare(b.name, "pt-BR");
  const sorters = {
    name: byName,
    price_asc: (a, b) => a.price - b.price || byName(a, b),
    price_desc: (a, b) => b.price - a.price || byName(a, b),
    stock_desc: (a, b) => b.stock - a.stock || byName(a, b),
  };
  return list.sort(sorters[f.sort] || byName);
}

function parsePriceInput(value) {
  const s = String(value).trim();
  if (s === "") return null;
  const n = Math.floor(Number(s));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */
function render() {
  renderHeader();
  renderTabs();
  renderFilters();
  renderCatalog();
  renderCart();
  renderOrders();
}

function renderNotice() {
  const box = $("notice");
  if (!state.notice) { box.hidden = true; return; }
  box.dataset.kind = state.notice.kind;
  $("noticeText").textContent = state.notice.text;
  box.hidden = false;
}

function renderHeader() {
  const u = state.user;
  $("loginLink").hidden = !state.authChecked || !!u;
  $("profile").hidden = !u;
  if (!u) return;

  $("profileName").textContent = u.username || "Usuário";
  $("profileId").textContent = u.user_id;
  const bal = $("profileBalance");
  const text = fmtCr(u.balance);
  if (bal.textContent !== text) {
    bal.textContent = text;
    bal.classList.remove("bump");
    void bal.offsetWidth; // reinicia a animação
    bal.classList.add("bump");
  }

  const avatar = $("profileAvatar");
  const src = typeof u.avatar === "string" && /^https:\/\//.test(u.avatar) ? u.avatar : "";
  if (avatar.dataset.src !== src) {
    avatar.dataset.src = src;
    avatar.replaceChildren();
    const initial = el("span", "", (u.username || "?").trim().charAt(0).toUpperCase() || "?");
    if (src) {
      const img = document.createElement("img");
      img.alt = "";
      img.width = 40;
      img.height = 40;
      img.referrerPolicy = "no-referrer";
      img.src = src;
      img.addEventListener("error", () => avatar.replaceChildren(initial), { once: true });
      avatar.append(img);
    } else {
      avatar.append(initial);
    }
  }
}

function renderTabs() {
  const loja = state.tab === "loja";
  $("tab-loja").setAttribute("aria-selected", String(loja));
  $("tab-pedidos").setAttribute("aria-selected", String(!loja));
  $("tab-loja").tabIndex = loja ? 0 : -1;
  $("tab-pedidos").tabIndex = loja ? -1 : 0;
  $("panel-loja").hidden = !loja;
  $("panel-pedidos").hidden = loja;
  $("cartJump").hidden = !loja;
  $("cartJumpCount").textContent = String(cartUnits());
}

function renderFilters() {
  const f = state.filters;
  const range = state.priceRange;

  // Categorias (só reconstrói se mudaram)
  const sel = $("fCategory");
  const sig = state.categories.join("|");
  if (sel.dataset.sig !== sig) {
    sel.dataset.sig = sig;
    sel.replaceChildren(new Option("Todas", ""));
    for (const c of state.categories) sel.append(new Option(c, c));
  }
  if (sel.value !== f.category) sel.value = f.category;

  if ($("fSearch").value !== f.q) $("fSearch").value = f.q;
  if ($("fSort").value !== f.sort) $("fSort").value = f.sort;
  $("fInStock").checked = f.inStock;

  // Inputs numéricos: só sobrescreve se o valor numérico divergir (não atrapalha a digitação)
  for (const [id, key] of [["fMin", "min"], ["fMax", "max"]]) {
    const input = $(id);
    if (parsePriceInput(input.value) !== f[key]) input.value = f[key] === null ? "" : String(f[key]);
    input.min = String(range.min);
    input.max = String(range.max);
    input.placeholder = key === "min" ? nf.format(range.min) : nf.format(range.max);
  }

  // Sliders duplos
  const span = range.max - range.min;
  const step = span > 0 && span % 10 === 0 ? 10 : 1;
  for (const [id, key, fallback] of [["fMinRange", "min", range.min], ["fMaxRange", "max", range.max]]) {
    const r = $(id);
    r.min = String(range.min);
    r.max = String(range.max);
    r.step = String(step);
    r.disabled = span <= 0;
    const v = f[key] === null ? fallback : Math.min(Math.max(f[key], range.min), range.max);
    r.value = String(v);
    r.setAttribute("aria-valuetext", fmtCr(v));
  }
  $("priceHint").textContent = span > 0 ? `(${fmtCr(range.min)} – ${fmtCr(range.max)})` : "";

  const err = priceFilterError();
  $("filterError").hidden = !err;
  $("filterError").textContent = err;
  $("fMin").setAttribute("aria-invalid", String(!!err));
  $("fMax").setAttribute("aria-invalid", String(!!err));
}

function renderCatalog() {
  const grid = $("productGrid");
  const count = $("resultCount");
  const empty = $("emptyCatalog");

  if (state.productsStatus === "loading") {
    grid.setAttribute("aria-busy", "true");
    count.textContent = "Carregando produtos…";
    empty.hidden = true;
    if (!grid.dataset.skeleton) {
      grid.dataset.skeleton = "1";
      const frag = document.createDocumentFragment();
      for (let i = 0; i < 6; i++) {
        const li = el("li", "card skeleton");
        li.setAttribute("aria-hidden", "true");
        li.append(el("div", "card-art"));
        const body = el("div", "card-body");
        body.append(el("div", "bar"), el("div", "bar"));
        li.append(body);
        frag.append(li);
      }
      grid.replaceChildren(frag);
    }
    return;
  }

  grid.setAttribute("aria-busy", "false");
  delete grid.dataset.skeleton;

  if (state.productsStatus === "error") {
    grid.replaceChildren();
    count.textContent = "Catálogo indisponível";
    empty.hidden = false;
    empty.textContent = state.productsError;
    return;
  }

  const list = filteredProducts();
  const total = state.products.length;
  count.textContent = list.length === total
    ? `${list.length} ${list.length === 1 ? "produto" : "produtos"}`
    : `${list.length} de ${total} produtos`;
  empty.hidden = list.length > 0;
  empty.textContent = "Nenhum produto corresponde aos filtros. Tente limpar os filtros.";

  const frag = document.createDocumentFragment();
  for (const p of list) frag.append(productCard(p));
  grid.replaceChildren(frag);
}

function productCard(p) {
  const soldOut = !(p.stock > 0);
  const inCart = state.cart.get(p.id) || 0;
  const li = el("li");
  const card = el("article", "card" + (soldOut ? " soldout" : ""));
  card.setAttribute("aria-labelledby", "p-title-" + p.id);

  const art = el("div", "card-art");
  const icon = el("span", "", p.icon || "📦");
  icon.setAttribute("aria-hidden", "true");
  art.append(icon, el("span", "card-cat", p.category));
  if (p.sku) art.append(el("span", "card-sku", p.sku));
  card.append(art);
  if (soldOut) card.append(el("span", "soldout-tag", "Esgotado"));

  const body = el("div", "card-body");
  const title = el("h3", "card-title", p.name);
  title.id = "p-title-" + p.id;
  body.append(title, el("p", "card-desc", p.description));
  card.append(body);

  const foot = el("div", "card-foot");
  const row = el("div", "price-row");
  row.append(el("span", "price", fmtCr(p.price)));
  const stock = el("span", "stock" + (!soldOut && p.stock <= 5 ? " low" : ""),
    soldOut ? "Sem estoque" : `${nf.format(p.stock)} em estoque`);
  row.append(stock);
  foot.append(row);

  const btn = el("button", "btn btn-primary btn-block");
  btn.type = "button";
  const atLimit = inCart >= maxQtyFor(p);
  if (soldOut) {
    btn.textContent = "Esgotado";
    btn.disabled = true;
  } else if (!state.user) {
    btn.textContent = "Entre para comprar";
    btn.disabled = !state.authChecked;
    btn.className = "btn btn-ghost btn-block";
    btn.addEventListener("click", () => { window.location.href = "/api/auth/discord"; });
  } else {
    btn.textContent = atLimit ? "Limite do estoque" : "Adicionar ao carrinho";
    btn.disabled = atLimit;
    btn.setAttribute("aria-label", `Adicionar ${p.name} ao carrinho`);
    btn.addEventListener("click", () => addToCart(p.id));
  }
  foot.append(btn);
  if (inCart > 0) foot.append(el("span", "in-cart-note", `${inCart} no carrinho`));
  card.append(foot);

  li.append(card);
  return li;
}

function renderCart() {
  const logged = !!state.user;
  const lines = logged ? cartLines() : [];
  const units = logged ? cartUnits() : 0;

  $("cartCount").textContent = String(units);
  $("cartLocked").hidden = logged || !state.authChecked;
  $("cartEmpty").hidden = !logged || lines.length > 0;
  $("cartSummary").hidden = !logged || lines.length === 0;
  $("clearCartBtn").hidden = !logged || lines.length === 0;
  $("clearCartBtn").disabled = state.checkingOut;

  const list = $("cartList");
  const frag = document.createDocumentFragment();
  let stockProblem = false;
  for (const line of lines) {
    const li = el("li", "cart-item");
    const p = line.product;
    const icon = el("span", "ci-icon", p ? p.icon || "📦" : "❔");
    icon.setAttribute("aria-hidden", "true");
    li.append(icon);

    const name = el("span", "ci-name", p ? p.name : `Produto #${line.id}`);
    li.append(name);
    li.append(el("span", "ci-meta", p ? `${fmtCr(p.price)} / un.` : "indisponível no catálogo"));

    const controls = el("div", "ci-controls");
    const qty = el("div", "qty");
    qty.setAttribute("role", "group");
    qty.setAttribute("aria-label", `Quantidade de ${p ? p.name : "produto"}`);
    const minus = el("button", "", "−");
    minus.type = "button";
    minus.setAttribute("aria-label", "Diminuir quantidade");
    minus.disabled = state.checkingOut;
    minus.addEventListener("click", () => setQty(line.id, line.qty - 1));
    const out = el("output", "", line.qty);
    out.setAttribute("aria-live", "polite");
    const plus = el("button", "", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", "Aumentar quantidade");
    plus.disabled = state.checkingOut || !p || line.qty >= maxQtyFor(p);
    plus.addEventListener("click", () => setQty(line.id, line.qty + 1));
    qty.append(minus, out, plus);

    const remove = el("button", "ci-remove", "Remover");
    remove.type = "button";
    remove.disabled = state.checkingOut;
    remove.setAttribute("aria-label", `Remover ${p ? p.name : "produto"} do carrinho`);
    remove.addEventListener("click", () => setQty(line.id, 0));

    controls.append(qty, remove, el("span", "ci-subtotal", fmtCr(line.subtotal)));
    li.append(controls);

    if (!p) {
      li.append(el("span", "ci-warn", "Este produto não está mais no catálogo; remova-o."));
      stockProblem = true;
    } else if (line.qty > p.stock) {
      li.append(el("span", "ci-warn",
        p.stock > 0 ? `Só restam ${p.stock} un. — ajuste a quantidade.` : "Esgotado — remova este item."));
      stockProblem = true;
    }
    frag.append(li);
  }
  list.replaceChildren(frag);

  // Resumo
  const total = cartTotal();
  const balance = logged ? Number(state.user.balance) || 0 : 0;
  const remaining = balance - total;
  $("cartTotal").textContent = fmtCr(total);
  $("cartBalance").textContent = logged ? fmtCr(balance) : "—";
  $("cartRemaining").textContent = (remaining < 0 ? "−" : "") + fmtCr(Math.abs(remaining));
  const over = logged && lines.length > 0 && remaining < 0;
  $("remainingRow").classList.toggle("over", over);

  const warnings = [];
  if (over) warnings.push(`Faltam ${fmtCr(-remaining)}: o total ultrapassa seu saldo.`);
  if (stockProblem) warnings.push("Há itens acima do estoque disponível.");
  $("cartWarning").hidden = warnings.length === 0;
  $("cartWarning").textContent = warnings.join(" ");

  const btn = $("checkoutBtn");
  btn.disabled = !logged || lines.length === 0 || state.checkingOut;
  btn.classList.toggle("loading", state.checkingOut);
  btn.setAttribute("aria-busy", String(state.checkingOut));
  btn.textContent = state.checkingOut ? "Processando…" : (logged ? "Finalizar compra" : "Entre para finalizar");
}

function renderOrders() {
  const msg = $("ordersMsg");
  const list = $("orderList");
  $("reloadOrders").disabled = !state.user || state.ordersStatus === "loading";

  if (!state.user) {
    msg.textContent = state.authChecked ? "Entre com Discord para ver seus pedidos." : "Verificando sessão…";
    list.replaceChildren();
    return;
  }
  if (state.ordersStatus === "loading") { msg.textContent = "Carregando pedidos…"; return; }
  if (state.ordersStatus === "error") { msg.textContent = state.ordersError; list.replaceChildren(); return; }
  if (state.ordersStatus === "idle") { msg.textContent = ""; return; }

  msg.textContent = state.orders.length
    ? `${state.orders.length} ${state.orders.length === 1 ? "pedido" : "pedidos"} (mais recentes primeiro).`
    : "Você ainda não fez nenhum pedido. Que tal visitar a loja?";

  const frag = document.createDocumentFragment();
  for (const o of state.orders) {
    const li = el("li");
    const btn = el("button", "order-card");
    btn.type = "button";
    const left = el("div");
    left.append(el("div", "oc-date", fmtDate(o.created_at)), el("div", "oc-id", "Pedido " + o.id));
    const items = Array.isArray(o.items) ? o.items : [];
    const count = Number(o.item_count) || items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const totalBox = el("div", "oc-total", fmtCr(o.total));
    const summary = items.map((i) => `${i.quantity}× ${i.product_name}`).join(", ");
    btn.append(left, totalBox,
      el("div", "oc-items", `${count} ${count === 1 ? "item" : "itens"}${summary ? " — " + summary : ""}`),
      el("span", "oc-cta", "Ver recibo →"));
    btn.setAttribute("aria-label", `Pedido de ${fmtDate(o.created_at)}, total ${fmtCr(o.total)}. Abrir recibo.`);
    btn.addEventListener("click", () => openOrder(o.id, btn));
    li.append(btn);
    frag.append(li);
  }
  list.replaceChildren(frag);
}

function renderReceipt() {
  const r = state.receipt;
  if (!r) return;
  const o = r.order;
  $("receiptStatus").hidden = !r.status;
  $("receiptStatus").textContent = r.status || "";
  $("rId").textContent = o.id;
  $("rDate").textContent = fmtDate(o.created_at);
  $("rUser").textContent = state.user ? `${state.user.username} (${state.user.user_id})` : "—";

  const frag = document.createDocumentFragment();
  for (const it of Array.isArray(o.items) ? o.items : []) {
    const tr = el("tr");
    tr.append(
      el("td", "", it.product_name),
      el("td", "num", nf.format(it.quantity)),
      el("td", "num", fmtCr(it.unit_price)),
      el("td", "num", fmtCr(it.subtotal ?? it.unit_price * it.quantity)),
    );
    frag.append(tr);
  }
  $("rItems").replaceChildren(frag);
  $("rTotal").textContent = fmtCr(o.total);
  $("rBefore").textContent = fmtCr(o.balance_before);
  $("rAfter").textContent = fmtCr(o.balance_after);
}

/* ------------------------------------------------------------------ */
/* Recibo (<dialog>)                                                   */
/* ------------------------------------------------------------------ */
let receiptReturnFocus = null;

function showReceipt(order, status, returnFocus) {
  state.receipt = { order, status };
  renderReceipt();
  receiptReturnFocus = returnFocus || document.activeElement;
  const dlg = $("receiptDialog");
  if (typeof dlg.showModal === "function") {
    if (!dlg.open) dlg.showModal();
  } else {
    dlg.setAttribute("open", "");
  }
  $("closeReceipt").focus();
}

function closeReceipt() {
  const dlg = $("receiptDialog");
  if (dlg.open) {
    if (typeof dlg.close === "function") dlg.close();
    else dlg.removeAttribute("open");
  }
}

/* ------------------------------------------------------------------ */
/* Ações com a API                                                     */
/* ------------------------------------------------------------------ */
async function loadMe() {
  const r = await api("/api/me");
  state.authChecked = true;
  if (r.status === 200 && r.data && r.data.user) {
    state.user = r.data.user;
    loadCart();
  } else {
    state.user = null;
    state.cart = new Map();
    if (r.networkError) setNotice("error", "Não foi possível verificar sua sessão: servidor indisponível.");
  }
}

async function loadProducts() {
  const r = await api("/api/products");
  if (r.status === 200 && r.data && Array.isArray(r.data.products)) {
    state.products = r.data.products.map((p) => ({
      ...p,
      id: Number(p.id),
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
    }));
    state.categories = Array.isArray(r.data.categories)
      ? r.data.categories
      : [...new Set(state.products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const pr = r.data.priceRange;
    if (pr && Number.isFinite(Number(pr.min)) && Number.isFinite(Number(pr.max))) {
      state.priceRange = { min: Number(pr.min), max: Number(pr.max) };
    } else {
      const prices = state.products.map((p) => p.price);
      state.priceRange = prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : { min: 0, max: 0 };
    }
    state.productsStatus = "ready";
    state.productsError = "";
  } else {
    state.productsStatus = "error";
    state.productsError = serverMessage(r, "Não foi possível carregar o catálogo.");
  }
}

async function refreshBalance() {
  const r = await api("/api/me");
  if (r.status === 200 && r.data && r.data.user) state.user = r.data.user;
}

function handleUnauthorized(message) {
  // Sessão expirou: mantém o carrinho salvo no localStorage para o próximo login.
  state.user = null;
  state.cart = new Map();
  state.orders = [];
  state.ordersStatus = "idle";
  setNotice("error", message || "Sua sessão expirou. Entre com Discord novamente — seu carrinho ficou salvo.");
}

async function checkout() {
  if (!state.user || state.cart.size === 0 || state.checkingOut) return;
  const items = [...state.cart.entries()].map(([productId, quantity]) => ({ productId, quantity }));

  state.checkingOut = true;
  setNotice(null);
  render();

  const r = await api("/api/checkout", { method: "POST", body: { items } });
  state.checkingOut = false;

  if (r.status === 201 && r.data && r.data.order) {
    const order = r.data.order;
    if (Number.isFinite(Number(r.data.balance))) state.user.balance = Number(r.data.balance);
    else if (Number.isFinite(Number(order.balance_after))) state.user.balance = Number(order.balance_after);
    state.cart.clear();
    saveCart();
    if (state.ordersStatus === "ready") {
      state.orders = [order, ...state.orders.filter((o) => o.id !== order.id)];
    }
    await loadProducts();
    render();
    setNotice("ok", `Compra concluída! ${fmtCr(order.total)} debitados. Novo saldo: ${fmtCr(state.user.balance)}.`);
    showReceipt(order, "Compra aprovada pelo servidor.", $("checkoutBtn"));
    return;
  }

  if (r.status === 401) {
    handleUnauthorized(serverMessage(r, "Sessão inválida.") + " Entre novamente — seu carrinho ficou salvo.");
    render();
    return;
  }

  let text = serverMessage(r, "Não foi possível finalizar a compra.");
  const err = r.data && r.data.error;
  if (err === "insufficient_stock" && Array.isArray(r.data.details) && r.data.details.length) {
    const parts = r.data.details.map((d) => `${d.name}: pediu ${d.requested}, disponível ${d.available}`);
    text += " — " + parts.join("; ") + ".";
  }
  if (err === "insufficient_balance" && Number.isFinite(Number(r.data.total)) && Number.isFinite(Number(r.data.balance))) {
    text += ` (total ${fmtCr(r.data.total)}, saldo ${fmtCr(r.data.balance)})`;
    state.user.balance = Number(r.data.balance);
  }
  // Estoque ou saldo podem ter mudado no servidor: atualiza sem mexer no carrinho.
  if (r.status === 409 || r.status === 404) {
    await Promise.all([loadProducts(), refreshBalance()]);
  }
  render();
  setNotice("error", text);
}

async function loadOrders() {
  if (!state.user) return;
  state.ordersStatus = "loading";
  renderOrders();
  const r = await api("/api/orders");
  if (r.status === 200 && r.data && Array.isArray(r.data.orders)) {
    state.orders = r.data.orders;
    state.ordersStatus = "ready";
  } else if (r.status === 401) {
    handleUnauthorized();
  } else {
    state.ordersStatus = "error";
    state.ordersError = serverMessage(r, "Não foi possível carregar seus pedidos.");
  }
  render();
}

async function openOrder(id, trigger) {
  const r = await api("/api/orders/" + encodeURIComponent(id));
  if (r.status === 200 && r.data && r.data.order) {
    showReceipt(r.data.order, "", trigger);
    return;
  }
  if (r.status === 401) { handleUnauthorized(); render(); return; }
  const cached = state.orders.find((o) => o.id === id);
  if (r.networkError && cached) {
    setNotice("info", "Servidor indisponível: exibindo o recibo salvo na lista.");
    showReceipt(cached, "", trigger);
    return;
  }
  setNotice("error", serverMessage(r, "Não foi possível abrir o recibo."));
}

async function logout() {
  $("logoutBtn").disabled = true;
  const r = await api("/api/auth/logout", { method: "POST" });
  $("logoutBtn").disabled = false;
  if (r.status === 200 || r.status === 401) {
    state.user = null;
    state.cart = new Map(); // o carrinho salvo fica no localStorage do usuário
    state.orders = [];
    state.ordersStatus = "idle";
    setNotice("info", "Você saiu da sua conta.");
    render();
  } else {
    setNotice("error", serverMessage(r, "Não foi possível sair."));
  }
}

/* ------------------------------------------------------------------ */
/* Abas                                                                */
/* ------------------------------------------------------------------ */
function setTab(tab, { focus = false } = {}) {
  state.tab = tab;
  try { history.replaceState(null, "", tab === "pedidos" ? "#pedidos" : location.pathname + location.search); } catch { /* ignore */ }
  render();
  if (focus) $(tab === "loja" ? "tab-loja" : "tab-pedidos").focus();
  if (tab === "pedidos" && state.user && state.ordersStatus !== "loading") loadOrders();
}

/* ------------------------------------------------------------------ */
/* Mensagens do login (?login=success / ?auth_error=...)               */
/* ------------------------------------------------------------------ */
const AUTH_ERRORS = {
  invalid_state: "A verificação de segurança do login falhou (state inválido ou expirado). Tente entrar de novo.",
  access_denied: "Você cancelou a autorização no Discord.",
  missing_code: "O Discord não devolveu o código de autorização. Tente de novo.",
  oauth_not_configured: "O login com Discord ainda não está configurado no servidor.",
  token_exchange_failed: "Não foi possível validar o login com o Discord. Tente novamente.",
  fetch_user_failed: "Não foi possível ler seu perfil do Discord. Tente novamente.",
  oauth_failed: "O login com o Discord falhou. Tente novamente.",
};

function consumeAuthParams() {
  const params = new URLSearchParams(location.search);
  const err = params.get("auth_error");
  const ok = params.get("login");
  if (!err && !ok) return;
  if (err) {
    setNotice("error", AUTH_ERRORS[err] || `Não foi possível entrar com o Discord (código: ${err}).`);
  } else if (ok === "success") {
    setNotice("ok", "Login realizado com sucesso! Boas compras.");
  }
  params.delete("auth_error");
  params.delete("login");
  const qs = params.toString();
  try {
    history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
  } catch { /* ignore */ }
}

/* ------------------------------------------------------------------ */
/* Ligações de eventos                                                 */
/* ------------------------------------------------------------------ */
function bindEvents() {
  $("noticeClose").addEventListener("click", () => setNotice(null));

  // Filtros
  $("fSearch").addEventListener("input", (e) => { state.filters.q = e.target.value; renderCatalog(); });
  $("fCategory").addEventListener("change", (e) => { state.filters.category = e.target.value; render(); });
  $("fSort").addEventListener("change", (e) => { state.filters.sort = e.target.value; render(); });
  $("fInStock").addEventListener("change", (e) => { state.filters.inStock = e.target.checked; render(); });
  $("fMin").addEventListener("input", (e) => { state.filters.min = parsePriceInput(e.target.value); render(); });
  $("fMax").addEventListener("input", (e) => { state.filters.max = parsePriceInput(e.target.value); render(); });

  $("fMinRange").addEventListener("input", (e) => {
    const range = state.priceRange;
    const upper = state.filters.max === null ? range.max : state.filters.max;
    const v = Math.min(Number(e.target.value), upper);
    state.filters.min = v <= range.min ? null : v;
    render();
  });
  $("fMaxRange").addEventListener("input", (e) => {
    const range = state.priceRange;
    const lower = state.filters.min === null ? range.min : state.filters.min;
    const v = Math.max(Number(e.target.value), lower);
    state.filters.max = v >= range.max ? null : v;
    render();
  });

  $("filters").addEventListener("submit", (e) => e.preventDefault());
  $("clearFilters").addEventListener("click", (e) => {
    e.preventDefault();
    state.filters = { q: "", category: "", min: null, max: null, sort: "name", inStock: false };
    render();
    $("fSearch").focus();
  });

  // Carrinho / checkout
  $("checkoutBtn").addEventListener("click", checkout);
  $("clearCartBtn").addEventListener("click", () => {
    state.cart.clear();
    saveCart();
    render();
  });
  $("cartJump").addEventListener("click", (e) => {
    e.preventDefault();
    if (state.tab !== "loja") setTab("loja");
    const cart = $("carrinho");
    cart.scrollIntoView({ behavior: "smooth", block: "start" });
    cart.focus({ preventScroll: true });
  });

  // Conta
  $("logoutBtn").addEventListener("click", logout);

  // Abas (com navegação por setas)
  $("tab-loja").addEventListener("click", () => setTab("loja"));
  $("tab-pedidos").addEventListener("click", () => setTab("pedidos"));
  for (const id of ["tab-loja", "tab-pedidos"]) {
    $(id).addEventListener("keydown", (e) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        const next = e.key === "Home" ? "loja" : e.key === "End" ? "pedidos" : (state.tab === "loja" ? "pedidos" : "loja");
        setTab(next, { focus: true });
      }
    });
  }
  $("reloadOrders").addEventListener("click", loadOrders);

  // Recibo
  const dlg = $("receiptDialog");
  $("closeReceipt").addEventListener("click", closeReceipt);
  $("printReceipt").addEventListener("click", () => window.print());
  dlg.addEventListener("click", (e) => { if (e.target === dlg) closeReceipt(); }); // clique no backdrop
  dlg.addEventListener("close", () => {
    state.receipt = null;
    if (receiptReturnFocus && document.contains(receiptReturnFocus)) receiptReturnFocus.focus();
    receiptReturnFocus = null;
  });

  // Outra aba alterou o carrinho deste usuário
  window.addEventListener("storage", (e) => {
    if (e.key && e.key === cartKey()) { loadCart(); render(); }
  });
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */
async function init() {
  document.documentElement.dataset.chave = CHAVE_PROJETO;
  bindEvents();
  consumeAuthParams();
  if (location.hash === "#pedidos") state.tab = "pedidos";
  render();
  await Promise.all([loadMe(), loadProducts()]);
  render();
  if (state.tab === "pedidos" && state.user) loadOrders();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();
