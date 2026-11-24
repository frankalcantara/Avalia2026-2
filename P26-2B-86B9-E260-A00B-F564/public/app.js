const CHAVE_PROJETO = "P26-2B-86B9-E260-A00B-F564";

const state = {
  user: null,
  polls: [],
};

const ERROR_MESSAGES = {
  unauthorized: "Faça login com o Discord para continuar.",
  not_configured:
    "Discord OAuth2 não configurado. Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET no Cloudflare Pages.",
  invalid_state: "Sessão de login expirada. Tente entrar novamente.",
  token_exchange_failed: "Falha ao validar o login no Discord.",
  fetch_user_failed: "Não foi possível obter seu perfil do Discord.",
  missing_code: "Autorização do Discord não concluída.",
  exception: "Erro inesperado durante o login.",
  d1_unavailable: "Banco Cloudflare D1 não vinculado. Configure o binding DB.",
  title_invalid: "O título deve ter entre 3 e 120 caracteres.",
  deadline_invalid: "Prazo de encerramento inválido.",
  deadline_past: "O prazo de encerramento deve ser uma data futura.",
  options_required: "Envie as opções da enquete.",
  options_minimum: "Informe ao menos 2 opções.",
  options_maximum: "Informe no máximo 10 opções.",
  options_duplicated: "As opções não podem se repetir.",
  poll_not_found: "Enquete não encontrada.",
  option_not_found: "Opção inválida para esta enquete.",
  poll_closed: "Esta enquete já foi encerrada.",
  already_voted: "Você já votou nesta enquete.",
  invalid_payload: "Dados de voto inválidos.",
  vote_failed: "Não foi possível registrar o voto.",
  persist_failed: "Não foi possível salvar a enquete.",
  invalid_json: "Requisição inválida.",
};

const authArea = document.getElementById("authArea");
const pollsContainer = document.getElementById("pollsContainer");
const pollForm = document.getElementById("pollForm");
const pollTitle = document.getElementById("pollTitle");
const pollDescription = document.getElementById("pollDescription");
const pollDeadline = document.getElementById("pollDeadline");
const optionRows = document.getElementById("optionRows");
const submitPollBtn = document.getElementById("submitPollBtn");
const formMessage = document.getElementById("formMessage");
const createHint = document.getElementById("createHint");
const addOptionBtn = document.getElementById("addOptionBtn");
const refreshBtn = document.getElementById("refreshBtn");
const toast = document.getElementById("toast");

let toastTimer = null;

function errorMessage(code) {
  return ERROR_MESSAGES[code] || "Ocorreu um erro. Tente novamente.";
}

function showToast(message, duration = 4200) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

function formatDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatPercent(value) {
  const number = Number(value) || 0;
  return (Number.isInteger(number) ? String(number) : number.toFixed(1).replace(".", ",")) + "%";
}

function setDeadlineMin() {
  const threshold = new Date(Date.now() + 5 * 60 * 1000);
  const local = new Date(threshold.getTime() - threshold.getTimezoneOffset() * 60000);
  pollDeadline.min = local.toISOString().slice(0, 16);
}

function createOptionRow(value = "") {
  const row = document.createElement("div");
  row.className = "option-row";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "option-input";
  input.maxLength = 80;
  input.placeholder = "Opção de escolha";
  input.value = value;

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "btn btn-danger";
  remove.textContent = "Remover";
  remove.addEventListener("click", () => {
    if (optionRows.querySelectorAll(".option-row").length <= 2) {
      showToast("Mantenha pelo menos 2 opções.");
      return;
    }
    row.remove();
  });

  row.append(input, remove);
  return row;
}

function resetOptionRows() {
  optionRows.innerHTML = "";
  optionRows.append(createOptionRow(""), createOptionRow(""));
}

function renderAuth() {
  authArea.innerHTML = "";

  if (state.user) {
    const profile = document.createElement("div");
    profile.className = "profile";

    const avatar = document.createElement("img");
    avatar.className = "avatar";
    avatar.width = 36;
    avatar.height = 36;
    avatar.alt = "Avatar de " + state.user.username;
    avatar.src = state.user.avatar || "https://cdn.discordapp.com/embed/avatars/0.png";

    const info = document.createElement("div");
    info.className = "profile-info";
    const name = document.createElement("strong");
    name.textContent = state.user.username;
    const id = document.createElement("span");
    id.textContent = "ID " + state.user.userId;
    info.append(name, id);

    const logout = document.createElement("button");
    logout.type = "button";
    logout.className = "btn btn-ghost";
    logout.textContent = "Sair";
    logout.addEventListener("click", logoutUser);

    profile.append(avatar, info, logout);
    authArea.appendChild(profile);
  } else {
    const login = document.createElement("a");
    login.className = "btn btn-discord";
    login.href = "/api/auth/discord";
    login.textContent = "Entrar com Discord";
    authArea.appendChild(login);
  }

  submitPollBtn.disabled = !state.user;
  createHint.textContent = state.user
    ? "A enquete será validada e persistida nas Cloudflare Functions + D1."
    : "Entre com o Discord para publicar uma enquete.";
}

function renderPoll(poll) {
  const article = document.createElement("article");
  article.className = "poll";

  const header = document.createElement("div");
  header.className = "poll-head";

  const titleWrap = document.createElement("div");
  const title = document.createElement("h3");
  title.className = "poll-title";
  title.textContent = poll.title;

  const meta = document.createElement("p");
  meta.className = "poll-meta";
  meta.textContent =
    "Criada por " + poll.ownerName + " · Encerra em " + formatDate(poll.closesAt);
  titleWrap.append(title, meta);

  const status = document.createElement("span");
  status.className = "status " + (poll.closed ? "status-closed" : "status-open");
  status.textContent = poll.closed ? "Encerrada" : "Aberta";

  header.append(titleWrap, status);
  article.appendChild(header);

  if (poll.description) {
    const description = document.createElement("p");
    description.className = "poll-desc";
    description.textContent = poll.description;
    article.appendChild(description);
  }

  const results = document.createElement("div");
  results.className = "results";

  const canVote = Boolean(state.user) && !poll.closed && !poll.userVoteOptionId;

  poll.options.forEach((option) => {
    const row = document.createElement("div");
    row.className = "result-row" + (poll.userVoteOptionId === option.id ? " chosen" : "");

    const head = document.createElement("div");
    head.className = "result-head";

    const label = document.createElement("span");
    label.className = "result-label";
    label.textContent = option.label;

    const value = document.createElement("span");
    value.className = "result-value";
    value.textContent =
      option.votes + (option.votes === 1 ? " voto" : " votos") + " · " + formatPercent(option.percentage);

    head.append(label, value);

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = Math.max(0, Math.min(100, Number(option.percentage) || 0)) + "%";
    track.appendChild(fill);

    row.append(head, track);

    if (canVote) {
      const voteBtn = document.createElement("button");
      voteBtn.type = "button";
      voteBtn.className = "btn btn-vote";
      voteBtn.textContent = "Votar nesta opção";
      voteBtn.addEventListener("click", () => castVote(poll.id, option.id));
      row.appendChild(voteBtn);
    }

    results.appendChild(row);
  });

  article.appendChild(results);

  const footer = document.createElement("div");
  footer.className = "poll-footer";

  const total = document.createElement("span");
  total.className = "poll-total";
  total.textContent =
    poll.totalVotes + (poll.totalVotes === 1 ? " voto no total" : " votos no total");
  footer.appendChild(total);

  if (poll.userVoteOptionId) {
    const chosen = document.createElement("span");
    chosen.className = "poll-chosen";
    chosen.textContent = "Seu voto foi registrado.";
    footer.appendChild(chosen);
  } else if (!state.user) {
    const login = document.createElement("a");
    login.className = "poll-login";
    login.href = "/api/auth/discord";
    login.textContent = "Entre para votar";
    footer.appendChild(login);
  } else if (poll.closed) {
    const closed = document.createElement("span");
    closed.className = "poll-chosen";
    closed.textContent = "Votação encerrada.";
    footer.appendChild(closed);
  }

  article.appendChild(footer);
  return article;
}

function renderPolls() {
  pollsContainer.innerHTML = "";

  if (!state.polls.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Nenhuma enquete publicada ainda. Crie a primeira após entrar com o Discord.";
    pollsContainer.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  state.polls.forEach((poll) => fragment.appendChild(renderPoll(poll)));
  pollsContainer.appendChild(fragment);
}

function replacePoll(updatedPoll) {
  if (!updatedPoll) return;
  const index = state.polls.findIndex((poll) => poll.id === updatedPoll.id);
  if (index === -1) state.polls.unshift(updatedPoll);
  else state.polls[index] = updatedPoll;
  renderPolls();
}

async function loadSession() {
  try {
    const response = await fetch("/api/me", { headers: { Accept: "application/json" } });
    const data = await response.json();
    state.user = data && data.authenticated ? data.user : null;
  } catch {
    state.user = null;
  }
  renderAuth();
}

async function loadPolls() {
  try {
    const response = await fetch("/api/polls", { headers: { Accept: "application/json" } });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || "load_failed");
    state.polls = Array.isArray(data.polls) ? data.polls : [];
    renderPolls();
  } catch {
    pollsContainer.innerHTML = "";
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent =
      "Não foi possível carregar as enquetes. Verifique se o deploy na Cloudflare está ativo e se o binding DB (D1) foi configurado.";
    pollsContainer.appendChild(empty);
  }
}

async function castVote(pollId, optionId) {
  try {
    const response = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ pollId, optionId }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.ok) {
      replacePoll(data.poll);
      showToast("Voto registrado com sucesso.");
      return;
    }

    if (data.poll) replacePoll(data.poll);
    showToast(errorMessage(data.error));
  } catch {
    showToast("Falha de rede ao registrar o voto.");
  }
}

async function logoutUser() {
  try {
    await fetch("/api/auth/logout", { method: "POST" });
  } catch {
    // ignora falha de rede no logout
  }
  state.user = null;
  renderAuth();
  await loadPolls();
  showToast("Sessão encerrada.");
}

addOptionBtn.addEventListener("click", () => {
  if (optionRows.querySelectorAll(".option-row").length >= 10) {
    showToast("Limite de 10 opções por enquete.");
    return;
  }
  optionRows.appendChild(createOptionRow(""));
});

refreshBtn.addEventListener("click", loadPolls);

pollForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  formMessage.textContent = "";

  if (!state.user) {
    showToast("Entre com o Discord para criar enquetes.");
    return;
  }

  const title = pollTitle.value.trim();
  const description = pollDescription.value.trim();
  const deadlineValue = pollDeadline.value;
  const options = Array.from(optionRows.querySelectorAll(".option-input"))
    .map((input) => input.value.trim())
    .filter(Boolean);

  if (title.length < 3) {
    formMessage.textContent = "Informe um título com ao menos 3 caracteres.";
    return;
  }

  if (!deadlineValue) {
    formMessage.textContent = "Informe o prazo de encerramento.";
    return;
  }

  const closesAt = new Date(deadlineValue);
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() <= Date.now()) {
    formMessage.textContent = "O prazo deve ser uma data futura.";
    return;
  }

  if (options.length < 2) {
    formMessage.textContent = "Informe ao menos 2 opções distintas.";
    return;
  }

  if (new Set(options.map((option) => option.toLowerCase())).size !== options.length) {
    formMessage.textContent = "As opções não podem se repetir.";
    return;
  }

  submitPollBtn.disabled = true;
  formMessage.textContent = "Publicando...";

  try {
    const response = await fetch("/api/polls", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        title,
        description,
        closesAt: closesAt.toISOString(),
        options,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (response.ok && data.ok) {
      pollForm.reset();
      resetOptionRows();
      setDeadlineMin();
      formMessage.textContent = "";
      if (data.poll) {
        state.polls.unshift(data.poll);
        renderPolls();
      } else {
        await loadPolls();
      }
      showToast("Enquete publicada.");
    } else {
      formMessage.textContent = errorMessage(data.error);
    }
  } catch {
    formMessage.textContent = "Falha de rede ao publicar a enquete.";
  } finally {
    submitPollBtn.disabled = !state.user;
  }
});

async function init() {
  resetOptionRows();
  setDeadlineMin();

  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");
  const loginStatus = params.get("login");

  if (authError) showToast(errorMessage(authError), 6500);
  if (loginStatus === "success") showToast("Login com Discord concluído.");
  if (authError || loginStatus) {
    window.history.replaceState({}, "", window.location.pathname);
  }

  await loadSession();
  await loadPolls();

  setInterval(() => {
    if (!document.hidden) loadPolls();
  }, 60000);
}

init();
