const state = {
  user: null,
  items: [],
  criticalItems: [],
  transactions: [],
  activeTab: "inventory",
};

const elements = {
  login: document.querySelector("#login-view"),
  dashboard: document.querySelector("#dashboard-view"),
  userMenu: document.querySelector("#user-menu"),
  userAvatar: document.querySelector("#user-avatar"),
  userName: document.querySelector("#user-name"),
  notice: document.querySelector("#notice"),
  grid: document.querySelector("#inventory-grid"),
  empty: document.querySelector("#empty-state"),
  search: document.querySelector("#search-input"),
  activity: document.querySelector("#activity-body"),
  activityEmpty: document.querySelector("#activity-empty"),
  dialog: document.querySelector("#movement-dialog"),
  form: document.querySelector("#movement-form"),
  itemSelect: document.querySelector("#item-select"),
  formError: document.querySelector("#form-error"),
  submitMovement: document.querySelector("#submit-movement"),
};

const categoryIcons = {
  "placas de desenvolvimento": "▦",
  sensores: "⌁",
  ferramentas: "⌘",
  acessórios: "⠿",
};

function showNotice(message, isSuccess = false) {
  elements.notice.textContent = message;
  elements.notice.classList.toggle("success", isSuccess);
  elements.notice.hidden = false;
}

async function requestJson(url, options = {}, { allowUnauthenticated = false } = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) {
      showLogin();
      if (allowUnauthenticated) return null;
      const message = "Sua sessão expirou. Entre novamente com o Discord.";
      showNoticeOnLogin(message);
      throw new Error(message);
    }
    throw new Error(data.error || "Não foi possível concluir a solicitação.");
  }
  return data;
}

function showLogin() {
  state.user = null;
  state.items = [];
  state.criticalItems = [];
  state.transactions = [];
  state.activeTab = "inventory";
  elements.search.value = "";
  if (elements.dialog.open) elements.dialog.close();
  elements.login.hidden = false;
  elements.dashboard.hidden = true;
  elements.userMenu.hidden = true;

  const url = new URL(window.location.href);
  if (url.searchParams.has("auth")) {
    showNoticeOnLogin("Não foi possível autenticar com o Discord. Tente novamente.");
    url.searchParams.delete("auth");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

function showNoticeOnLogin(message) {
  let notice = document.querySelector("#login-notice");
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "login-notice";
    notice.className = "notice";
    notice.setAttribute("role", "alert");
    document.querySelector(".login-copy").append(notice);
  }
  notice.textContent = message;
}

function showDashboard(user) {
  state.user = user;
  elements.login.hidden = true;
  elements.dashboard.hidden = false;
  elements.userMenu.hidden = false;
  const username = String(user.username || "Usuário");
  elements.userName.textContent = username;
  elements.userAvatar.textContent = Array.from(username.trim())[0]?.toLocaleUpperCase("pt-BR") || "?";
  if (user.avatar_url) {
    const avatar = document.createElement("img");
    avatar.src = user.avatar_url;
    avatar.alt = "";
    avatar.addEventListener("error", () => avatar.remove(), { once: true });
    elements.userAvatar.replaceChildren(avatar);
  } else {
    elements.userAvatar.replaceChildren();
  }
}

function isCritical(item) {
  return item.quantidade_atual <= item.limite_minimo;
}

function createItemCard(item) {
  const card = document.createElement("article");
  card.className = `item-card${isCritical(item) ? " is-critical" : ""}`;

  const top = document.createElement("div");
  top.className = "item-top";
  const identity = document.createElement("div");
  identity.className = "item-identity";
  const icon = document.createElement("span");
  icon.className = `item-icon category-${item.categoria.toLocaleLowerCase("pt-BR")}`;
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = categoryIcons[item.categoria.toLocaleLowerCase("pt-BR")] || "▧";
  const details = document.createElement("div");
  const name = document.createElement("h3");
  name.className = "item-name";
  name.textContent = item.nome;
  const category = document.createElement("span");
  category.className = "item-category";
  category.textContent = item.categoria;
  details.append(name, category);
  identity.append(icon, details);

  const badge = document.createElement("span");
  badge.className = `stock-badge${isCritical(item) ? " critical" : ""}`;
  badge.textContent = isCritical(item) ? "Reposição" : "Disponível";
  top.append(identity, badge);

  const bottom = document.createElement("div");
  bottom.className = "item-bottom";
  const quantity = document.createElement("strong");
  quantity.className = "item-quantity";
  quantity.append(document.createTextNode(String(item.quantidade_atual)));
  const unit = document.createElement("small");
  unit.textContent = item.unidade;
  quantity.append(unit);
  const minimum = document.createElement("span");
  minimum.className = "item-minimum";
  minimum.textContent = `Mínimo: ${item.limite_minimo}`;
  bottom.append(quantity, minimum);
  card.append(top, bottom);
  return card;
}

function renderInventory() {
  const source = state.activeTab === "critical" ? state.criticalItems : state.items;
  const query = elements.search.value.trim().toLocaleLowerCase("pt-BR");
  const filtered = source.filter((item) =>
    `${item.nome || ""} ${item.categoria || ""}`.toLocaleLowerCase("pt-BR").includes(query),
  );
  elements.grid.replaceChildren(...filtered.map(createItemCard));
  elements.empty.hidden = filtered.length !== 0;

  document.querySelector("#list-title").textContent =
    state.activeTab === "critical" ? "Itens para reposição" : "Materiais";
  document.querySelector("#list-description").textContent =
    state.activeTab === "critical"
      ? "Itens com saldo igual ou abaixo do limite mínimo."
      : "Visão completa dos componentes cadastrados.";

  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.tab === state.activeTab;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  document.querySelector("#inventory-panel").setAttribute(
    "aria-labelledby",
    state.activeTab === "critical" ? "critical-tab" : "inventory-tab",
  );

  document.querySelector("#summary-items").textContent = String(state.items.length);
  document.querySelector("#summary-units").textContent = String(
    state.items.reduce((total, item) => total + item.quantidade_atual, 0),
  );
  document.querySelector("#summary-critical").textContent = String(state.criticalItems.length);
  document.querySelector("#all-count").textContent = String(state.items.length);
  document.querySelector("#critical-count").textContent = String(state.criticalItems.length);
}

function formatDate(value) {
  const timestamp = String(value || "");
  const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(timestamp) ? timestamp : `${timestamp}Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderActivity() {
  elements.activity.replaceChildren(
    ...state.transactions.map((transaction) => {
      const row = document.createElement("tr");
      const name = document.createElement("td");
      name.textContent = transaction.item_nome;
      const typeCell = document.createElement("td");
      const type = document.createElement("span");
      type.className = `movement-tag ${transaction.tipo_movimento}`;
      type.textContent = transaction.tipo_movimento === "retirada" ? "Retirada" : "Devolução";
      typeCell.append(type);
      const quantity = document.createElement("td");
      quantity.className =
        transaction.tipo_movimento === "retirada" ? "quantity-negative" : "quantity-positive";
      quantity.textContent = `${transaction.tipo_movimento === "retirada" ? "−" : "+"}${transaction.quantidade_movimentada}`;
      const user = document.createElement("td");
      user.textContent = transaction.username_discord;
      const date = document.createElement("td");
      date.textContent = formatDate(transaction.timestamp);
      row.append(name, typeCell, quantity, user, date);
      return row;
    }),
  );
  elements.activityEmpty.hidden = state.transactions.length !== 0;
}

async function refreshDashboard() {
  const [inventory, critical, activity] = await Promise.all([
    requestJson("/api/inventory"),
    requestJson("/api/inventory/critical"),
    requestJson("/api/transactions"),
  ]);
  if (!Array.isArray(inventory.items) || !Array.isArray(critical.items) || !Array.isArray(activity.transactions)) {
    throw new Error("O servidor retornou dados de estoque inválidos.");
  }
  state.items = inventory.items;
  state.criticalItems = critical.items;
  state.transactions = activity.transactions;
  renderInventory();
  renderActivity();
}

function populateItemSelect() {
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = state.items.length ? "Selecione um material" : "Nenhum material cadastrado";
  placeholder.disabled = true;
  placeholder.selected = true;
  elements.itemSelect.replaceChildren(
    placeholder,
    ...state.items.map((item) => {
      const option = document.createElement("option");
      option.value = String(item.id);
      option.textContent = `${item.nome} — ${item.quantidade_atual} ${item.unidade}`;
      return option;
    }),
  );
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    state.activeTab = tab.dataset.tab;
    renderInventory();
  });
  tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const tabs = Array.from(document.querySelectorAll(".tab"));
    const currentIndex = tabs.indexOf(tab);
    const direction = event.key === "ArrowRight" ? 1 : -1;
    const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
    nextTab.focus();
    nextTab.click();
  });
});

elements.search.addEventListener("input", renderInventory);
document.querySelector("#movement-button").addEventListener("click", () => {
  if (!state.items.length) {
    showNotice("Não há materiais cadastrados para movimentar.");
    return;
  }
  populateItemSelect();
  elements.form.reset();
  elements.itemSelect.selectedIndex = 0;
  elements.formError.hidden = true;
  elements.dialog.showModal();
});
document.querySelector("#close-dialog").addEventListener("click", () => elements.dialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => elements.dialog.close());
document.querySelector("#logout-button").addEventListener("click", async () => {
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
    showLogin();
  } catch (error) {
    showNotice(error.message);
  }
});

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  elements.formError.hidden = true;
  elements.submitMovement.disabled = true;
  const formData = new FormData(elements.form);
  const body = {
    item_id: Number(formData.get("item_id")),
    type: formData.get("type"),
    quantity: Number(formData.get("quantity")),
  };
  try {
    await requestJson("/api/transactions", {
      method: "POST",
      body: JSON.stringify(body),
    });
    elements.dialog.close();
    elements.form.reset();
    showNotice("Movimentação registrada e estoque atualizado.", true);
    try {
      await refreshDashboard();
    } catch (error) {
      showNotice(`Movimentação registrada, mas não foi possível atualizar o painel: ${error.message}`);
    }
  } catch (error) {
    if (elements.dashboard.hidden) {
      showNoticeOnLogin(error.message);
    } else {
      elements.formError.textContent = error.message;
      elements.formError.hidden = false;
    }
  } finally {
    elements.submitMovement.disabled = false;
  }
});

async function initialize() {
  try {
    const response = await requestJson("/api/auth/me", {}, { allowUnauthenticated: true });
    if (!response) return;
    if (!response.user || !response.user.username) {
      throw new Error("O servidor retornou um usuário inválido.");
    }
    showDashboard(response.user);
    await refreshDashboard();
  } catch (error) {
    if (elements.login.hidden) showNotice(error.message);
    else showNoticeOnLogin(error.message);
  }
}

initialize();
