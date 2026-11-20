const ATTRIBUTES = [
  { key: "forca", label: "Força" },
  { key: "destreza", label: "Destreza" },
  { key: "constituicao", label: "Constituição" },
  { key: "inteligencia", label: "Inteligência" },
  { key: "sabedoria", label: "Sabedoria" },
  { key: "carisma", label: "Carisma" },
];
const DICE = ["d4", "d6", "d8", "d10", "d12", "d20"];
const AUTH_ERRORS = {
  invalid_state: "Não foi possível confirmar o login. Tente entrar novamente.",
  oauth_denied: "O acesso pelo Discord foi cancelado.",
  missing_code: "O Discord não retornou o código de acesso. Tente novamente.",
  missing_credentials: "O login com Discord não está configurado no momento.",
  token_exchange_failed: "Não foi possível concluir o login com o Discord.",
  fetch_user_failed: "Não foi possível carregar seu perfil do Discord.",
  invalid_profile: "O Discord retornou um perfil inválido.",
  database_unavailable: "O serviço de login está temporariamente indisponível.",
  exception: "Ocorreu um erro ao entrar com o Discord. Tente novamente.",
};

const elements = {
  loading: document.getElementById("loadingView"),
  login: document.getElementById("loginView"),
  loginFooter: document.getElementById("loginFooter"),
  loginError: document.getElementById("loginError"),
  app: document.getElementById("appView"),
  profileAvatar: document.getElementById("profileAvatar"),
  profileName: document.getElementById("profileName"),
  logout: document.getElementById("logoutButton"),
  appNotice: document.getElementById("appNotice"),
  form: document.getElementById("characterForm"),
  formTitle: document.getElementById("formTitle"),
  formEyebrow: document.getElementById("formEyebrow"),
  formMessage: document.getElementById("formMessage"),
  saveButton: document.getElementById("saveCharacterButton"),
  cancelEdit: document.getElementById("cancelEditButton"),
  attributeInputs: document.getElementById("attributeInputs"),
  characterList: document.getElementById("characterList"),
  characterCount: document.getElementById("characterCount"),
  rollLogBody: document.getElementById("rollLogBody"),
  rollLogEmpty: document.getElementById("rollLogEmpty"),
  rollLogError: document.getElementById("rollLogError"),
};

let editingId = null;
let sessionExpired = false;
let characters = [];

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function createElement(tagName, className, text) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function showLogin(message = "") {
  elements.loading.hidden = true;
  elements.app.hidden = true;
  elements.login.hidden = false;
  elements.loginFooter.hidden = false;
  elements.loginError.textContent = message;
  elements.loginError.hidden = !message;
}

function showApplication(user) {
  elements.loading.hidden = true;
  elements.login.hidden = true;
  elements.loginFooter.hidden = true;
  elements.app.hidden = false;
  elements.profileName.textContent = user.username;

  if (typeof user.avatar === "string" && user.avatar) {
    try {
      const avatarUrl = new URL(user.avatar);
      if (avatarUrl.protocol === "https:" || avatarUrl.protocol === "http:") {
        elements.profileAvatar.src = avatarUrl.href;
        elements.profileAvatar.alt = `Avatar de ${user.username}`;
        elements.profileAvatar.hidden = false;
      }
    } catch {
      elements.profileAvatar.hidden = true;
    }
  } else {
    elements.profileAvatar.hidden = true;
  }
}

function formatApiError(error) {
  if (!(error instanceof ApiError)) {
    return "Não foi possível conectar ao serviço. Verifique sua conexão e tente novamente.";
  }
  if (error.status === 401) return "Sua sessão expirou. Entre novamente.";
  if (error.status === 409) return "Esta ficha já tem rolagens registradas e não pode ser excluída";

  const message = error.message || "";
  if (error.status === 400) {
    if (message.includes("valid JSON") || message.includes("JSON object")) {
      return "Não foi possível ler os dados enviados. Confira o formulário e tente novamente.";
    }
    if (message.startsWith("Unexpected field:")) {
      return "Há um campo não permitido nos dados da ficha. Revise as informações.";
    }
    const textFields = [
      ["name", "Nome"],
      ["class", "Classe"],
      ["race", "Raça"],
    ];
    for (const [field, label] of textFields) {
      if (message.startsWith(`${field} must be a non-empty string`)) {
        return `Preencha o campo ${label.toLocaleLowerCase("pt-BR")}.`;
      }
      if (message.startsWith(`${field} must be at most`)) {
        const limit = message.match(/\d+/)?.[0];
        return `${label} deve ter no máximo ${limit} caracteres.`;
      }
    }
    if (message.startsWith("level must")) return "O nível deve ser um número inteiro entre 1 e 20.";
    const attribute = ATTRIBUTES.find(({ key }) => message.startsWith(`${key} must`));
    if (attribute) return `${attribute.label} deve ser um número inteiro entre 1 e 30.`;
    if (message.startsWith("characterId")) return "Selecione uma ficha válida para fazer a rolagem.";
    if (message.startsWith("attribute")) return "Selecione um atributo válido para a rolagem.";
    if (message.startsWith("die")) return "Selecione um dado válido para a rolagem.";
    return "Confira os campos: há informações inválidas ou faltando.";
  }

  if (error.status === 404) return "Esta ficha não foi encontrada ou não está mais disponível.";
  return "Ocorreu um erro ao processar sua solicitação. Tente novamente.";
}

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
  });
  const responseText = await response.text();
  let data = null;

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      data = null;
    }
  }

  if (response.status === 401) {
    expireSession();
    throw new ApiError("unauthorized", 401);
  }
  if (!response.ok) {
    throw new ApiError(
      typeof data?.error === "string" ? data.error : `HTTP ${response.status}`,
      response.status
    );
  }
  return data;
}

function expireSession() {
  if (sessionExpired) return;
  sessionExpired = true;
  showLogin("Sua sessão expirou. Entre novamente para continuar.");
}

function setFormMessage(message) {
  elements.formMessage.textContent = message;
}

function setAppNotice(message) {
  elements.appNotice.textContent = message;
  elements.appNotice.hidden = !message;
}

function formatModifier(value) {
  return value >= 0 ? `+${value}` : String(value);
}

function updateModifierPreview(input) {
  const preview = input.closest(".attribute-field")?.querySelector(".modifier-preview");
  if (!preview) return;
  const value = input.valueAsNumber;
  preview.textContent = Number.isFinite(value) && value >= 1 && value <= 30
    ? formatModifier(Math.floor((value - 10) / 2))
    : "—";
}

function buildAttributeInputs() {
  for (const attribute of ATTRIBUTES) {
    const field = createElement("label", "attribute-field");
    const label = createElement("span", "", attribute.label);
    const control = createElement("span", "attribute-control");
    const input = createElement("input");
    input.type = "number";
    input.name = attribute.key;
    input.min = "1";
    input.max = "30";
    input.step = "1";
    input.value = "10";
    input.required = true;
    input.setAttribute("aria-label", attribute.label);
    const modifier = createElement("span", "modifier-preview", "+0");
    modifier.setAttribute("aria-label", "Modificador calculado");
    input.addEventListener("input", () => updateModifierPreview(input));
    control.append(input, modifier);
    field.append(label, control);
    elements.attributeInputs.append(field);
  }
}

function resetForm() {
  editingId = null;
  elements.form.reset();
  for (const input of elements.attributeInputs.querySelectorAll("input")) {
    input.value = "10";
    updateModifierPreview(input);
  }
  elements.formTitle.textContent = "Crie seu personagem";
  elements.formEyebrow.textContent = "NOVA FICHA";
  elements.saveButton.replaceChildren(document.createTextNode("Criar ficha "));
  elements.saveButton.append(createElement("span", "", "↗"));
  elements.cancelEdit.hidden = true;
  setFormMessage("");
}

function beginEdit(character) {
  editingId = character.id;
  elements.form.elements.namedItem("name").value = character.name;
  elements.form.elements.namedItem("class").value = character.class;
  elements.form.elements.namedItem("race").value = character.race;
  elements.form.elements.namedItem("level").value = character.level;
  for (const attribute of ATTRIBUTES) {
    const input = elements.form.elements.namedItem(attribute.key);
    input.value = character[attribute.key];
    updateModifierPreview(input);
  }
  elements.formTitle.textContent = `Editando ${character.name}`;
  elements.formEyebrow.textContent = "EDITAR FICHA";
  elements.saveButton.replaceChildren(document.createTextNode("Salvar alterações "));
  elements.saveButton.append(createElement("span", "", "↗"));
  elements.cancelEdit.hidden = false;
  setFormMessage("");
  elements.form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function readCharacterForm() {
  const formData = new FormData(elements.form);
  const value = {
    name: String(formData.get("name") || "").trim(),
    class: String(formData.get("class") || "").trim(),
    race: String(formData.get("race") || "").trim(),
    level: Number(formData.get("level")),
  };
  for (const attribute of ATTRIBUTES) {
    value[attribute.key] = Number(formData.get(attribute.key));
  }
  return value;
}

function renderCharacters() {
  elements.characterList.replaceChildren();
  elements.characterCount.textContent = `${characters.length} ${characters.length === 1 ? "ficha" : "fichas"}`;

  if (characters.length === 0) {
    elements.characterList.append(
      createElement("p", "empty-state panel", "Sua primeira aventura começa com uma ficha. Crie seu personagem acima.")
    );
    return;
  }

  for (const character of characters) {
    elements.characterList.append(createCharacterCard(character));
  }
}

function createCharacterCard(character) {
  const card = createElement("article", "character-card panel");
  const heading = createElement("div", "character-card-heading");
  const identity = createElement("div", "character-identity");
  const title = createElement("h3", "", character.name);
  const subtitle = createElement("p", "character-subtitle", `${character.race} · ${character.class}`);
  const level = createElement("span", "level-badge", `NÍVEL ${character.level}`);
  identity.append(title, subtitle);

  const actions = createElement("div", "character-actions");
  const editButton = createElement("button", "button button-quiet", "Editar");
  editButton.type = "button";
  editButton.addEventListener("click", () => beginEdit(character));
  const deleteButton = createElement("button", "button button-danger", "Excluir");
  deleteButton.type = "button";
  deleteButton.addEventListener("click", () => deleteCharacter(character));
  actions.append(editButton, deleteButton);
  heading.append(identity, level, actions);

  const stats = createElement("div", "character-attributes");
  for (const attribute of ATTRIBUTES) {
    const stat = createElement("div", "character-stat");
    stat.append(
      createElement("span", "", attribute.label),
      createElement("strong", "", String(character[attribute.key]))
    );
    stats.append(stat);
  }

  const roller = createElement("div", "roller");
  roller.append(createElement("span", "roller-label", "TESTE DE ATRIBUTO"));
  const dieSelect = createElement("select", "die-select");
  dieSelect.setAttribute("aria-label", `Dado para ${character.name}`);
  for (const die of DICE) {
    const option = createElement("option", "", die);
    option.value = die;
    dieSelect.append(option);
  }

  for (const attribute of ATTRIBUTES) {
    const button = createElement("button", "button button-roll", attribute.label);
    button.type = "button";
    button.addEventListener("click", () => rollAttribute(character, attribute, dieSelect.value, button, resultMessage));
    roller.append(button);
  }
  roller.prepend(dieSelect);

  const resultMessage = createElement("p", "roll-result");
  resultMessage.hidden = true;
  card.append(heading, stats, roller, resultMessage);
  return card;
}

function getRollResponseMessage(roll) {
  const attribute = ATTRIBUTES.find((item) => item.key === roll.attribute);
  return `${roll.die}: ${roll.result} · ${attribute?.label || roll.attribute} ${formatModifier(roll.modifier)} · Total ${roll.total}`;
}

async function rollAttribute(character, attribute, die, button, resultMessage) {
  button.disabled = true;
  resultMessage.textContent = "Enviando rolagem...";
  resultMessage.hidden = false;

  try {
    const roll = await requestJson("/api/rolls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: Number(character.id),
        attribute: attribute.key,
        die,
      }),
    });
    resultMessage.textContent = getRollResponseMessage(roll);
    await loadRollLog();
  } catch (error) {
    if (error.status !== 401) resultMessage.textContent = formatApiError(error);
  } finally {
    button.disabled = false;
  }
}

async function loadCharacters() {
  try {
    const result = await requestJson("/api/characters");
    if (!Array.isArray(result)) throw new Error("Resposta inválida ao carregar fichas.");
    characters = result;
    renderCharacters();
  } catch (error) {
    if (error.status !== 401) setAppNotice(formatApiError(error));
  }
}

function formatDateTime(value) {
  if (typeof value !== "string") return "—";
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function renderRollLog(rolls) {
  elements.rollLogBody.replaceChildren();
  elements.rollLogEmpty.hidden = rolls.length > 0;

  for (const roll of rolls) {
    const row = document.createElement("tr");
    const attribute = ATTRIBUTES.find((item) => item.key === roll.attribute);
    const values = [
      formatDateTime(roll.created_at),
      roll.username,
      roll.character_name,
      attribute?.label || roll.attribute,
      roll.die,
      String(roll.result),
      formatModifier(roll.modifier),
    ];

    for (const value of values) {
      row.append(createElement("td", "", value == null ? "—" : String(value)));
    }
    const totalCell = createElement("td");
    totalCell.append(createElement("span", "total-value", String(roll.total)));
    row.append(totalCell);
    elements.rollLogBody.append(row);
  }
}

async function loadRollLog() {
  try {
    const rolls = await requestJson("/api/rolls");
    if (!Array.isArray(rolls)) throw new Error("Resposta inválida ao carregar rolagens.");
    renderRollLog(rolls);
    elements.rollLogError.textContent = "";
  } catch (error) {
    if (error.status !== 401) elements.rollLogError.textContent = formatApiError(error);
  }
}

async function deleteCharacter(character) {
  if (!window.confirm(`Excluir a ficha de ${character.name}?`)) return;
  setAppNotice("");

  try {
    await requestJson(`/api/characters/${encodeURIComponent(String(character.id))}`, {
      method: "DELETE",
    });
    if (editingId === character.id) resetForm();
    await loadCharacters();
  } catch (error) {
    if (error.status !== 401) setAppNotice(formatApiError(error));
  }
}

async function saveCharacter(event) {
  event.preventDefault();
  setFormMessage("");
  if (!elements.form.reportValidity()) return;

  const isEditing = editingId !== null;
  const endpoint = isEditing
    ? `/api/characters/${encodeURIComponent(String(editingId))}`
    : "/api/characters";
  elements.saveButton.disabled = true;

  try {
    await requestJson(endpoint, {
      method: isEditing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(readCharacterForm()),
    });
    resetForm();
    setAppNotice("");
    await loadCharacters();
  } catch (error) {
    if (error.status !== 401) setFormMessage(formatApiError(error));
  } finally {
    elements.saveButton.disabled = false;
  }
}

async function logout() {
  elements.logout.disabled = true;
  setAppNotice("");
  try {
    const response = await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "same-origin",
    });
    if (!response.ok) throw new ApiError("logout_failed", response.status);
    window.location.reload();
  } catch (error) {
    setAppNotice(formatApiError(error));
    elements.logout.disabled = false;
  }
}

async function start() {
  buildAttributeInputs();
  elements.form.addEventListener("submit", saveCharacter);
  elements.cancelEdit.addEventListener("click", resetForm);
  elements.logout.addEventListener("click", logout);

  const searchParams = new URLSearchParams(window.location.search);
  const authError = searchParams.get("auth_error");
  let loginError = searchParams.has("auth_error")
    ? AUTH_ERRORS[authError] || "Não foi possível entrar com o Discord. Tente novamente."
    : "";

  try {
    const user = await requestJson("/api/me");
    if (
      !user ||
      typeof user.user_id !== "string" ||
      typeof user.username !== "string" ||
      !user.username
    ) {
      throw new Error("Perfil inválido.");
    }

    showApplication(user);
    await Promise.all([loadCharacters(), loadRollLog()]);
    window.setInterval(loadRollLog, 10_000);
  } catch (error) {
    if (error.status === 401) {
      showLogin(loginError);
      return;
    }
    if (!loginError) loginError = "Não foi possível verificar sua sessão. Tente entrar com o Discord.";
    showLogin(loginError);
  }
}

start();
