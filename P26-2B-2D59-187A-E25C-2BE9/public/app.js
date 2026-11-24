const state = {
  user: null,
  items: [],
  movements: [],
  filter: "all",
  loadingItems: true,
  loadingMovements: true,
};

const elements = {
  authLoading: document.getElementById("authLoading"),
  authPanel: document.getElementById("authPanel"),
  authMessage: document.getElementById("authMessage"),
  loginTab: document.getElementById("loginTab"),
  registerTab: document.getElementById("registerTab"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  submitLogin: document.getElementById("submitLogin"),
  submitRegister: document.getElementById("submitRegister"),
  profileArea: document.getElementById("profileArea"),
  profileAvatar: document.getElementById("profileAvatar"),
  avatarFallback: document.getElementById("avatarFallback"),
  profileName: document.getElementById("profileName"),
  profileId: document.getElementById("profileId"),
  logoutButton: document.getElementById("logoutButton"),
  appContent: document.getElementById("appContent"),
  pageMessage: document.getElementById("pageMessage"),
  searchInput: document.getElementById("searchInput"),
  allItemsButton: document.getElementById("allItemsButton"),
  criticalItemsButton: document.getElementById("criticalItemsButton"),
  criticalCount: document.getElementById("criticalCount"),
  itemCount: document.getElementById("itemCount"),
  itemsState: document.getElementById("itemsState"),
  itemsList: document.getElementById("itemsList"),
  historyState: document.getElementById("historyState"),
  historyList: document.getElementById("historyList"),
  movementForm: document.getElementById("movementForm"),
  itemSelect: document.getElementById("itemSelect"),
  quantityInput: document.getElementById("quantityInput"),
  unitHint: document.getElementById("unitHint"),
  movementMessage: document.getElementById("movementMessage"),
  submitMovement: document.getElementById("submitMovement"),
  itemCreateForm: document.getElementById("itemCreateForm"),
  itemCreateMessage: document.getElementById("itemCreateMessage"),
  submitItemCreate: document.getElementById("submitItemCreate"),
};

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    const message = payload && typeof payload === "object"
      ? payload.error || payload.message
      : null;
    const error = new Error(typeof message === "string" ? message : `Não foi possível concluir a solicitação (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setAuthMessage(message, kind = "error") {
  elements.authMessage.textContent = message || "";
  elements.authMessage.classList.toggle("is-success", kind === "success");
}

function setPageMessage(message, kind = "error") {
  elements.pageMessage.textContent = message || "";
  elements.pageMessage.classList.toggle("is-success", kind === "success");
  elements.pageMessage.hidden = !message;
}

function showSignedOut(message = "") {
  state.user = null;
  elements.authLoading.hidden = true;
  elements.profileArea.hidden = true;
  elements.appContent.hidden = true;
  elements.authPanel.hidden = false;
  setAuthMessage(message);
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  elements.loginTab.classList.toggle("is-active", isLogin);
  elements.registerTab.classList.toggle("is-active", !isLogin);
  elements.loginTab.setAttribute("aria-selected", String(isLogin));
  elements.registerTab.setAttribute("aria-selected", String(!isLogin));
  elements.loginForm.hidden = !isLogin;
  elements.registerForm.hidden = isLogin;
  setAuthMessage("");
}

function renderProfile(user) {
  const username = typeof user.username === "string" ? user.username : "Usuário";
  elements.profileName.textContent = username;
  elements.profileId.textContent = user.id !== undefined && user.id !== null ? `Conta · ${user.id}` : "";
  elements.avatarFallback.textContent = username.trim().charAt(0).toLocaleUpperCase("pt-BR") || "?";
  elements.profileAvatar.hidden = true;
  elements.avatarFallback.hidden = false;
  if (typeof user.avatar === "string" && user.avatar.trim()) {
    elements.profileAvatar.src = user.avatar;
    elements.profileAvatar.alt = `Avatar de ${username}`;
  } else {
    elements.profileAvatar.removeAttribute("src");
  }
}

async function enterApp() {
  elements.authLoading.hidden = false;
  elements.authPanel.hidden = true;
  try {
    const data = await requestJson("/api/auth/me");
    if (!data || data.authenticated !== true || !data.user) {
      showSignedOut();
      return;
    }
    state.user = data.user;
    elements.authLoading.hidden = true;
    elements.profileArea.hidden = false;
    elements.appContent.hidden = false;
    renderProfile(data.user);
    setPageMessage("");
    await refreshData();
  } catch (error) {
    if (error.status === 401) {
      showSignedOut();
    } else {
      showSignedOut(`Não foi possível verificar seu acesso. ${error.message}`);
    }
  }
}

function isCritical(item) {
  return Number(item.quantity) <= Number(item.min_quantity);
}

function renderItems() {
  const criticalItems = state.items.filter(isCritical);
  elements.criticalCount.textContent = String(criticalItems.length);
  elements.itemCount.textContent = `${state.items.length} ${state.items.length === 1 ? "item" : "itens"}`;
  const query = elements.searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const visibleItems = state.items.filter((item) => {
    if (state.filter === "critical" && !isCritical(item)) return false;
    const searchable = [
      item.name, item.category, item.description, item.responsible_agent,
      item.id !== undefined ? String(item.id) : ""
    ].filter(Boolean).join(" ").toLocaleLowerCase("pt-BR");
    return searchable.includes(query);
  });
  elements.itemsList.replaceChildren();
  elements.itemsList.hidden = visibleItems.length === 0;
  elements.itemsState.hidden = visibleItems.length > 0;
  if (visibleItems.length === 0) {
    const message = state.items.length === 0
      ? "Nenhum material cadastrado no estoque."
      : state.filter === "critical" && !query
        ? "Nenhum material em estoque crítico."
        : "Nenhum material corresponde à busca.";
    elements.itemsState.classList.remove("is-error");
    elements.itemsState.replaceChildren(makeElement("span", "empty-state", message));
    return;
  }
  visibleItems.forEach((item) => {
    const critical = isCritical(item);
    const row = makeElement("li", `item-row${critical ? " is-critical" : ""}`);
    const main = makeElement("div", "item-main");
    const icon = makeElement("span", "item-icon", "◈");
    icon.setAttribute("aria-hidden", "true");
    const copy = makeElement("span", "item-copy");
    copy.append(makeElement("span", "item-name", item.name));
    const meta = [item.category, item.description].filter(Boolean).join(" · ");
    copy.append(makeElement("span", "item-meta", meta || "Material do laboratório"));
    if (item.id !== undefined && item.id !== null) {
      copy.append(makeElement("span", "item-code", `Código ${item.id}`));
    }
    if (item.responsible_agent) {
      copy.append(makeElement("span", "item-agent", `Responsável: ${item.responsible_agent}`));
    }
    if (critical) {
      copy.append(makeElement("span", "stock-status", `Estoque crítico · mínimo ${item.min_quantity} ${item.unit || "un."}`));
    }
    main.append(icon, copy);
    const quantity = makeElement("span", "item-quantity");
    quantity.append(makeElement("span", "quantity-value", String(item.quantity)));
    quantity.append(makeElement("span", "quantity-unit", item.unit || "unidades"));
    row.append(main, quantity);
    elements.itemsList.append(row);
  });
}

function renderItemOptions() {
  const previousValue = elements.itemSelect.value;
  elements.itemSelect.replaceChildren();
  const placeholder = makeElement("option", "", state.items.length ? "Selecione um material" : "Nenhum material disponível");
  placeholder.value = "";
  elements.itemSelect.append(placeholder);
  state.items.forEach((item) => {
    const option = makeElement("option", "", `${item.id !== undefined ? `#${item.id} · ` : ""}${item.name} · ${item.quantity} ${item.unit || "un."}`);
    option.value = String(item.id);
    elements.itemSelect.append(option);
  });
  const previousStillExists = state.items.some((item) => String(item.id) === previousValue);
  elements.itemSelect.value = previousStillExists ? previousValue : "";
  elements.itemSelect.disabled = state.items.length === 0 || state.loadingItems;
  elements.submitMovement.disabled = elements.itemSelect.disabled;
  updateUnitHint();
}

function updateUnitHint() {
  const selectedItem = state.items.find((item) => String(item.id) === elements.itemSelect.value);
  elements.unitHint.textContent = selectedItem && selectedItem.unit ? selectedItem.unit : "unidades";
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function renderMovements() {
  elements.historyList.replaceChildren();
  elements.historyList.hidden = state.movements.length === 0;
  elements.historyState.hidden = state.movements.length > 0;
  if (state.movements.length === 0) {
    elements.historyState.classList.remove("is-error");
    elements.historyState.replaceChildren(makeElement("span", "empty-state", "Nenhuma movimentação registrada ainda."));
    return;
  }
  state.movements.forEach((movement) => {
    const isReturn = movement.type === "return";
    const row = makeElement("li", "history-row");
    const main = makeElement("div", "history-main");
    const symbol = makeElement("span", `history-symbol${isReturn ? " is-return" : ""}`, isReturn ? "↙" : "↗");
    symbol.setAttribute("aria-hidden", "true");
    const copy = makeElement("span", "history-copy");
    const item = movement.item_name || state.items.find((entry) => String(entry.id) === String(movement.item_id))?.name || "Material";
    const code = movement.item_id !== undefined && movement.item_id !== null
      ? ` · código ${movement.item_id}`
      : "";
    copy.append(makeElement("span", "history-title", `${isReturn ? "Devolução" : "Retirada"} · ${item}${code}`));
    copy.append(makeElement("span", "history-detail", `${movement.quantity} ${Number(movement.quantity) === 1 ? "unidade" : "unidades"} · por ${movement.username || movement.responsible_agent || "Usuário"}`));
    main.append(symbol, copy);
    const time = makeElement("time", "history-time", formatDate(movement.created_at));
    const parsedDate = new Date(movement.created_at);
    if (!Number.isNaN(parsedDate.getTime())) time.dateTime = parsedDate.toISOString();
    row.append(main, time);
    elements.historyList.append(row);
  });
}

function setListLoading(listState, list, message) {
  list.hidden = true;
  listState.hidden = false;
  listState.classList.remove("is-error");
  listState.replaceChildren(makeElement("span", "spinner"));
  listState.firstElementChild.setAttribute("aria-hidden", "true");
  listState.append(makeElement("span", "", message));
}

function setListError(listState, list, message) {
  list.hidden = true;
  listState.hidden = false;
  listState.classList.add("is-error");
  listState.replaceChildren(makeElement("span", "empty-state", message));
}

async function refreshData() {
  state.loadingItems = true;
  state.loadingMovements = true;
  setListLoading(elements.itemsState, elements.itemsList, "Carregando materiais…");
  setListLoading(elements.historyState, elements.historyList, "Carregando histórico…");
  renderItemOptions();
  const [itemsResult, movementsResult] = await Promise.allSettled([
    requestJson("/api/items"),
    requestJson("/api/movements"),
  ]);
  if ([itemsResult, movementsResult].some((result) => result.status === "rejected" && result.reason.status === 401)) {
    showSignedOut("Sua sessão expirou. Entre novamente.");
    return false;
  }
  let hasError = false;
  state.loadingItems = false;
  if (itemsResult.status === "fulfilled" && itemsResult.value && Array.isArray(itemsResult.value.items)) {
    state.items = itemsResult.value.items;
    renderItems();
    renderItemOptions();
  } else {
    hasError = true;
    state.items = [];
    elements.itemCount.textContent = "— itens";
    renderItemOptions();
    setListError(elements.itemsState, elements.itemsList, itemsResult.status === "rejected" ? itemsResult.reason.message : "Não foi possível carregar o estoque.");
  }
  state.loadingMovements = false;
  if (movementsResult.status === "fulfilled" && movementsResult.value && Array.isArray(movementsResult.value.movements)) {
    state.movements = movementsResult.value.movements;
    renderMovements();
  } else {
    hasError = true;
    state.movements = [];
    setListError(elements.historyState, elements.historyList, movementsResult.status === "rejected" ? movementsResult.reason.message : "Não foi possível carregar o histórico.");
  }
  if (hasError) setPageMessage("Alguns dados não puderam ser atualizados.");
  return !hasError;
}

elements.loginTab.addEventListener("click", () => switchAuthTab("login"));
elements.registerTab.addEventListener("click", () => switchAuthTab("register"));

elements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  if (!email || !password) {
    setAuthMessage("Informe email e senha.");
    return;
  }
  elements.submitLogin.disabled = true;
  setAuthMessage("");
  try {
    await requestJson("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    await enterApp();
  } catch (error) {
    setAuthMessage(error.message || "Não foi possível entrar.");
  } finally {
    elements.submitLogin.disabled = false;
  }
});

elements.registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("registerEmail").value.trim();
  const username = document.getElementById("registerUsername").value.trim();
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("registerConfirmPassword").value;
  if (!email || !username || !password || !confirmPassword) {
    setAuthMessage("Preencha todos os campos do cadastro.");
    return;
  }
  if (password !== confirmPassword) {
    setAuthMessage("A confirmação da senha não corresponde.");
    return;
  }
  elements.submitRegister.disabled = true;
  setAuthMessage("");
  try {
    await requestJson("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, username, password }),
    });
    await enterApp();
  } catch (error) {
    setAuthMessage(error.message || "Não foi possível criar a conta.");
  } finally {
    elements.submitRegister.disabled = false;
  }
});

elements.allItemsButton.addEventListener("click", () => {
  state.filter = "all";
  elements.allItemsButton.classList.add("is-active");
  elements.criticalItemsButton.classList.remove("is-active");
  elements.allItemsButton.setAttribute("aria-pressed", "true");
  elements.criticalItemsButton.setAttribute("aria-pressed", "false");
  renderItems();
});

elements.criticalItemsButton.addEventListener("click", () => {
  state.filter = "critical";
  elements.criticalItemsButton.classList.add("is-active");
  elements.allItemsButton.classList.remove("is-active");
  elements.criticalItemsButton.setAttribute("aria-pressed", "true");
  elements.allItemsButton.setAttribute("aria-pressed", "false");
  renderItems();
});

elements.searchInput.addEventListener("input", renderItems);
elements.itemSelect.addEventListener("change", updateUnitHint);

elements.movementForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const selectedItem = state.items.find((item) => String(item.id) === elements.itemSelect.value);
  const quantity = Number(elements.quantityInput.value);
  const type = new FormData(elements.movementForm).get("type");
  if (!selectedItem || !Number.isInteger(quantity) || quantity <= 0) {
    elements.movementMessage.textContent = "Selecione um material e informe uma quantidade inteira maior que zero.";
    elements.movementMessage.classList.remove("is-success");
    return;
  }
  elements.submitMovement.disabled = true;
  elements.movementMessage.textContent = "";
  try {
    await requestJson("/api/movements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: selectedItem.id, type, quantity }),
    });
    elements.quantityInput.value = "";
    elements.movementMessage.textContent = "Movimentação registrada.";
    elements.movementMessage.classList.add("is-success");
    await refreshData();
  } catch (error) {
    elements.movementMessage.textContent = error.message || "Não foi possível registrar a movimentação.";
  } finally {
    elements.submitMovement.disabled = elements.itemSelect.disabled;
  }
});

elements.itemCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(elements.itemCreateForm);
  const quantity = Number(data.get("quantity"));
  const minQuantity = Number(data.get("min_quantity"));
  const payload = {
    name: String(data.get("name")).trim(),
    category: String(data.get("category")).trim(),
    description: String(data.get("description")).trim(),
    unit: String(data.get("unit")).trim(),
    quantity,
    min_quantity: minQuantity,
    responsible_agent: String(data.get("responsible_agent")).trim(),
  };
  if (!payload.name || !payload.category || !payload.unit || !payload.responsible_agent ||
      !Number.isInteger(quantity) || quantity < 0 ||
      !Number.isInteger(minQuantity) || minQuantity < 0) {
    elements.itemCreateMessage.textContent = "Preencha os campos obrigatórios e use quantidades inteiras não negativas.";
    elements.itemCreateMessage.classList.remove("is-success");
    return;
  }
  elements.submitItemCreate.disabled = true;
  elements.itemCreateMessage.textContent = "";
  try {
    await requestJson("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    elements.itemCreateForm.reset();
    elements.itemCreateMessage.textContent = "Item cadastrado com sucesso.";
    elements.itemCreateMessage.classList.add("is-success");
    await refreshData();
  } catch (error) {
    elements.itemCreateMessage.textContent = error.message || "Não foi possível cadastrar o item.";
    elements.itemCreateMessage.classList.remove("is-success");
  } finally {
    elements.submitItemCreate.disabled = false;
  }
});

elements.logoutButton.addEventListener("click", async () => {
  elements.logoutButton.disabled = true;
  setPageMessage("");
  try {
    await requestJson("/api/auth/logout", { method: "POST" });
    showSignedOut();
  } catch (error) {
    setPageMessage(error.message || "Não foi possível encerrar sua sessão.");
  } finally {
    elements.logoutButton.disabled = false;
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const target = event.target;
    const isTyping = target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
    if (!isTyping && !elements.appContent.hidden) {
      event.preventDefault();
      elements.searchInput.focus();
    }
  }
});

enterApp();
