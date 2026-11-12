
const CHAVE_PROJETO = "P26-3A-AB80-1165-A8DC-0585";

const API = {
  session: "/api/auth/session",
  members: "/api/members",
  kudos: "/api/kudos"
};

const BADGES = {
  bug: {
    emoji: "🐛",
    title: "Resolveu um Bug Crítico"
  },
  explanation: {
    emoji: "💡",
    title: "Ótima Explicação"
  },
  teamwork: {
    emoji: "🤝",
    title: "Ajuda no Projeto"
  }
};

let currentUser = null;
let currentFilter = "all";

const $ = (id) => document.getElementById(id);

async function requestJSON(url, options = {}) {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      data.error || data.message || "Erro na comunicação com o servidor."
    );
  }

  return data;
}

function showStatus(message, isError = false) {
  const element = $("statusMessage");
  if (!element) return;

  element.textContent = message;
  element.style.color = isError ? "#ff8585" : "#48d6a2";
}

function updateHeader() {
  const label = $("discordUserText");
  const login = $("discordLoginLink");

  if (!label || !login) return;

  if (currentUser) {
    label.textContent = "Olá, " + currentUser.username;
    login.textContent = "Conectado ao Discord";
    login.removeAttribute("href");
    login.setAttribute("aria-disabled", "true");
  } else {
    label.textContent = "Não autenticado";
    login.textContent = "Entrar com Discord";
    login.href = "/api/auth/discord";
    login.removeAttribute("aria-disabled");
  }
}

async function loadSession() {
  try {
    const data = await requestJSON(API.session);
    currentUser = data.user || null;
  } catch {
    currentUser = null;
  }

  updateHeader();
}

async function loadMembers() {
  const select = $("recipientId");
  if (!select) return;

  select.replaceChildren();

  const placeholder = new Option(
    "Selecione um colega",
    ""
  );
  select.add(placeholder);

  try {
    const data = await requestJSON(API.members);
    const members = Array.isArray(data.members)
      ? data.members
      : [];

    members.forEach((member) => {
      if (
        currentUser &&
        String(member.userId) === String(currentUser.userId)
      ) {
        return;
      }

      select.add(
        new Option(member.username, member.userId)
      );
    });
  } catch {
    select.options[0].textContent =
      "Não foi possível carregar os colegas";
  }
}

function createCard(kudo) {
  const card = document.createElement("article");
  card.className = "recognition-card";

  const badge = BADGES[kudo.badge] || {
    emoji: "🏅",
    title: "Reconhecimento"
  };

  const badgeTitle = document.createElement("h3");
  badgeTitle.textContent =
    badge.emoji + " " + badge.title;

  const recipient = document.createElement("strong");
  recipient.textContent =
    "Para: " + (kudo.recipientUsername || "Colega");

  const message = document.createElement("p");
  message.textContent = kudo.message || "";

  const sender = document.createElement("small");
  sender.textContent =
    "Enviado por " + (kudo.senderUsername || "Desenvolvedor");

  card.append(badgeTitle, recipient, message, sender);

  return card;
}

async function loadKudos() {
  const grid = $("recognitionGrid");
  if (!grid) return;

  grid.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "empty-state";
  loading.textContent = "Carregando reconhecimentos...";
  grid.append(loading);

  try {
    const params = new URLSearchParams();

    if (currentFilter !== "all") {
      if (!currentUser) {
        throw new Error(
          "Entre com Discord para visualizar seus reconhecimentos."
        );
      }

      params.set("filter", currentFilter);
    }

    const query = params.toString();
    const url = API.kudos + (query ? "?" + query : "");

    const data = await requestJSON(url);
    const kudos = Array.isArray(data.kudos)
      ? data.kudos
      : [];

    grid.replaceChildren();

    if (kudos.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-state";
      empty.textContent =
        "Ainda não há reconhecimentos neste filtro.";
      grid.append(empty);
    } else {
      kudos.forEach((kudo) => {
        grid.append(createCard(kudo));
      });
    }

    if (currentFilter === "all") {
      $("totalRecognitions").textContent = kudos.length;

      const recipients = new Set(
        kudos.map((item) => item.recipientId)
          .filter(Boolean)
      );

      $("totalMembers").textContent = recipients.size;
    }
  } catch (error) {
    grid.replaceChildren();

    const notice = document.createElement("p");
    notice.className = "empty-state";
    notice.textContent = error.message;
    grid.append(notice);
  }
}

function setupFilters() {
  const buttons = document.querySelectorAll(
    ".filter-btn"
  );

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      currentFilter = button.dataset.filter;

      buttons.forEach((item) => {
        item.classList.toggle(
          "active",
          item === button
        );
      });

      loadKudos();
    });
  });
}

function setupForm() {
  const form = $("recognitionForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!currentUser) {
      showStatus(
        "Entre com Discord antes de enviar um reconhecimento.",
        true
      );
      return;
    }

    const recipientId = $("recipientId").value;
    const badge = form.querySelector(
      'input[name="badge"]:checked'
    )?.value;

    const message = $("message").value.trim();

    if (!recipientId || !badge || message.length < 5) {
      showStatus(
        "Preencha o colega, o selo e a mensagem.",
        true
      );
      return;
    }

    if (String(recipientId) === String(currentUser.userId)) {
      showStatus(
        "Você não pode enviar reconhecimento para si mesmo.",
        true
      );
      return;
    }

    const button = $("sendBtn");
    button.disabled = true;

    showStatus("Publicando reconhecimento...");

    try {
      await requestJSON(API.kudos, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          recipientId,
          badge,
          message
        })
      });

      form.reset();
      showStatus("Reconhecimento publicado com sucesso!");

      await loadKudos();
    } catch (error) {
      showStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
}

async function init() {
  setupFilters();
  setupForm();

  await loadSession();
  await Promise.all([
    loadMembers(),
    loadKudos()
  ]);
}

document.addEventListener("DOMContentLoaded", init);
