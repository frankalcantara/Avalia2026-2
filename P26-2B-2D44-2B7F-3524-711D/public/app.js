/**
 * Front-end Vanilla JS — ServiceDesk Pro (Projeto #38)
 * Rastreador de Solicitações e Chamados Internos
 * Chave: P26-2B-2D44-2B7F-3524-711D
 */

const state = {
  sessionUser: null,
  discordOAuthConfigured: false,
  localUser: null,
};

const els = {
  themeToggle: document.getElementById("btn-theme-toggle"),
  dbBadge: document.getElementById("db-status-badge"),
  authArea: document.getElementById("auth-area"),
  localBanner: document.getElementById("local-session-bar"),
  localInput: document.getElementById("local-username-input"),
  btnSaveLocalUser: document.getElementById("btn-save-local-user"),
  slaPercent: document.getElementById("sla-percent"),
  slaFill: document.getElementById("sla-fill"),
  slaTrack: document.getElementById("sla-track"),
  slaCaption: document.getElementById("sla-caption"),
  kpiTotal: document.getElementById("kpi-total"),
  kpiAbertos: document.getElementById("kpi-abertos"),
  kpiAndamento: document.getElementById("kpi-andamento"),
  kpiConcluidos: document.getElementById("kpi-concluidos"),
  kpiUrgentes: document.getElementById("kpi-urgentes"),
  form: document.getElementById("chamado-form"),
  titulo: document.getElementById("titulo"),
  categoria: document.getElementById("categoria"),
  prioridade: document.getElementById("prioridade"),
  descricao: document.getElementById("descricao"),
  descCount: document.getElementById("desc-count"),
  feedback: document.getElementById("form-feedback"),
  btnSubmit: document.getElementById("btn-submit-chamado"),
  filtroBusca: document.getElementById("filtro-busca"),
  filtroStatus: document.getElementById("filtro-status"),
  filtroPrioridade: document.getElementById("filtro-prioridade"),
  chamadosList: document.getElementById("chamados-list"),
};

function initTheme() {
  const saved = localStorage.getItem("sd_theme");
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  if (isDark) {
    document.documentElement.removeAttribute("data-theme");
    localStorage.setItem("sd_theme", "light");
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("sd_theme", "dark");
  }
}

function loadSavedLocalUser() {
  try {
    const raw = localStorage.getItem("sd_local_operator");
    if (raw) {
      state.localUser = JSON.parse(raw);
    }
  } catch {}
}

function saveLocalUser(username) {
  const clean = String(username || "").trim().slice(0, 40);
  if (!clean) return;
  state.localUser = {
    id: `local_${clean.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
    username: clean,
  };
  localStorage.setItem("sd_local_operator", JSON.stringify(state.localUser));
  renderAuthArea();
}

function showFeedback(message, type = "success") {
  els.feedback.textContent = message;
  els.feedback.className = `feedback-box feedback-${type}`;
  els.feedback.classList.remove("hidden");
  setTimeout(() => {
    els.feedback.classList.add("hidden");
  }, 5000);
}

function formatDate(isoStr) {
  if (!isoStr) return "";
  try {
    const normalized = isoStr.includes("T") ? isoStr : `${isoStr.replace(" ", "T")}Z`;
    const date = new Date(normalized);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

function updateResolutionBar(total, concluidos) {
  const pct = total > 0 ? Math.round((concluidos / total) * 100) : 0;
  els.slaPercent.textContent = `${pct}%`;
  els.slaFill.style.width = `${pct}%`;
  els.slaTrack.setAttribute("aria-valuenow", String(pct));
  els.slaCaption.textContent = `${concluidos} de ${total} chamados concluídos`;
}

function renderAuthArea() {
  els.authArea.innerHTML = "";

  const activeUser = state.sessionUser || state.localUser;

  if (activeUser) {
    const chip = document.createElement("div");
    chip.className = "user-chip";

    if (activeUser.avatar && activeUser.id && !String(activeUser.id).startsWith("local_")) {
      const img = document.createElement("img");
      img.className = "user-avatar";
      img.src = `https://cdn.discordapp.com/avatars/${activeUser.id}/${activeUser.avatar}.png?size=64`;
      img.alt = activeUser.username;
      chip.appendChild(img);
    } else {
      const fallback = document.createElement("span");
      fallback.className = "user-avatar";
      fallback.textContent = (activeUser.username || "U").slice(0, 2).toUpperCase();
      chip.appendChild(fallback);
    }

    const nameSpan = document.createElement("span");
    nameSpan.className = "user-name";
    nameSpan.textContent = activeUser.username;
    chip.appendChild(nameSpan);

    els.authArea.appendChild(chip);
  }

  if (state.discordOAuthConfigured || !state.sessionUser) {
    const loginBtn = document.createElement("a");
    loginBtn.href = "/api/auth/discord";
    loginBtn.className = "btn btn-discord";
    loginBtn.textContent = state.sessionUser ? "Trocar Conta Discord" : "Entrar com Discord";
    els.authArea.appendChild(loginBtn);
  }

  if (!state.discordOAuthConfigured && !state.sessionUser) {
    els.localBanner.classList.remove("hidden");
    if (state.localUser && els.localInput) {
      els.localInput.value = state.localUser.username;
    }
  } else {
    els.localBanner.classList.add("hidden");
  }
}

async function checkSystemStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();

    if (data.d1Connected) {
      els.dbBadge.textContent = "D1 Conectado • Online";
      els.dbBadge.className = "status-pill status-online";
    } else {
      els.dbBadge.textContent = "D1 Desconectado";
      els.dbBadge.className = "status-pill status-offline";
    }

    state.sessionUser = data.sessionUser || null;
    state.discordOAuthConfigured = Boolean(data.discordOAuthConfigured);
    renderAuthArea();
  } catch {
    els.dbBadge.textContent = "Falha na API";
    els.dbBadge.className = "status-pill status-offline";
    renderAuthArea();
  }
}

function renderChamados(chamados) {
  els.chamadosList.innerHTML = "";

  if (!chamados || chamados.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Nenhum chamado encontrado com os filtros atuais. Registre uma solicitação ao lado.";
    els.chamadosList.appendChild(empty);
    return;
  }

  chamados.forEach((item) => {
    const card = document.createElement("article");
    card.className = `ticket-card prio-border-${item.prioridade}`;

    // Topo do Card
    const top = document.createElement("div");
    top.className = "ticket-top";

    const idTitle = document.createElement("div");
    idTitle.className = "ticket-id-title";

    const code = document.createElement("span");
    code.className = "ticket-code";
    code.textContent = `#${String(item.id).padStart(4, "0")}`;

    const title = document.createElement("h3");
    title.className = "ticket-title";
    title.textContent = item.titulo;

    idTitle.appendChild(code);
    idTitle.appendChild(title);

    const badges = document.createElement("div");
    badges.className = "badges-group";

    const badgeCat = document.createElement("span");
    badgeCat.className = "badge badge-cat";
    badgeCat.textContent = item.categoria;

    const badgePrio = document.createElement("span");
    badgePrio.className = `badge badge-prio-${item.prioridade}`;
    badgePrio.textContent = item.prioridade;

    const statusSlug = item.status.replace(/\s+/g, "-");
    const badgeStatus = document.createElement("span");
    badgeStatus.className = `badge badge-status-${statusSlug}`;
    badgeStatus.textContent = item.status;

    badges.appendChild(badgeCat);
    badges.appendChild(badgePrio);
    badges.appendChild(badgeStatus);

    top.appendChild(idTitle);
    top.appendChild(badges);

    // Descrição
    const desc = document.createElement("p");
    desc.className = "ticket-desc";
    desc.textContent = item.descricao;

    // Rodapé do Card
    const footer = document.createElement("div");
    footer.className = "ticket-footer";

    const author = document.createElement("div");
    author.className = "ticket-author";

    if (item.avatar && item.user_id && !String(item.user_id).startsWith("local_")) {
      const img = document.createElement("img");
      img.src = `https://cdn.discordapp.com/avatars/${item.user_id}/${item.avatar}.png?size=64`;
      img.alt = item.username;
      author.appendChild(img);
    } else {
      const avatarFallback = document.createElement("span");
      avatarFallback.className = "author-fallback";
      avatarFallback.textContent = (item.username || "U").slice(0, 2).toUpperCase();
      author.appendChild(avatarFallback);
    }

    const metaText = document.createElement("span");
    metaText.textContent = `Aberto por ${item.username} • ${formatDate(item.created_at)}`;
    author.appendChild(metaText);

    const actions = document.createElement("div");
    actions.className = "ticket-actions";

    const statusSelect = document.createElement("select");
    statusSelect.className = "status-select-inline";
    statusSelect.setAttribute("aria-label", `Alterar status do chamado #${item.id}`);

    ["Aberto", "Em Andamento", "Concluído"].forEach((st) => {
      const opt = document.createElement("option");
      opt.value = st;
      opt.textContent = st;
      if (st === item.status) opt.selected = true;
      statusSelect.appendChild(opt);
    });

    statusSelect.addEventListener("change", () => {
      updateChamadoStatus(item.id, statusSelect.value);
    });

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className = "btn-delete";
    btnDel.textContent = "Excluir";
    btnDel.addEventListener("click", () => {
      deleteChamado(item.id);
    });

    actions.appendChild(statusSelect);
    actions.appendChild(btnDel);

    footer.appendChild(author);
    footer.appendChild(actions);

    card.appendChild(top);
    card.appendChild(desc);
    card.appendChild(footer);

    els.chamadosList.appendChild(card);
  });
}

async function loadChamados() {
  const params = new URLSearchParams();
  if (els.filtroStatus.value) params.set("status", els.filtroStatus.value);
  if (els.filtroPrioridade.value) params.set("prioridade", els.filtroPrioridade.value);
  if (els.filtroBusca.value.trim()) params.set("q", els.filtroBusca.value.trim());

  try {
    const res = await fetch(`/api/chamados?${params.toString()}`);
    const data = await res.json();

    if (!data.ok) {
      els.chamadosList.innerHTML = `<div class="empty-state">${data.error || "Erro ao carregar chamados."}</div>`;
      return;
    }

    els.kpiTotal.textContent = data.metricas.total;
    els.kpiAbertos.textContent = data.metricas.abertos;
    els.kpiAndamento.textContent = data.metricas.emAndamento;
    els.kpiConcluidos.textContent = data.metricas.concluidos;
    els.kpiUrgentes.textContent = data.metricas.urgentes;

    updateResolutionBar(data.metricas.total, data.metricas.concluidos);
    renderChamados(data.chamados);
  } catch {
    els.chamadosList.innerHTML = `<div class="empty-state">Não foi possível conectar à API de chamados.</div>`;
  }
}

async function handleCreateChamado(event) {
  event.preventDefault();

  const payload = {
    titulo: els.titulo.value.trim(),
    categoria: els.categoria.value,
    prioridade: els.prioridade.value,
    descricao: els.descricao.value.trim(),
    localUser: state.localUser,
  };

  if (payload.titulo.length < 4) {
    showFeedback("Informe um título com pelo menos 4 caracteres.", "error");
    return;
  }

  if (payload.descricao.length < 10) {
    showFeedback("Descreva a solicitação com pelo menos 10 caracteres.", "error");
    return;
  }

  els.btnSubmit.disabled = true;
  els.btnSubmit.textContent = "Registrando...";

  try {
    const res = await fetch("/api/chamados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) {
      showFeedback(data.error || "Não foi possível registrar o chamado.", "error");
      return;
    }

    els.form.reset();
    els.descCount.textContent = "0";
    showFeedback(data.message || "Chamado registrado com sucesso!", "success");
    await loadChamados();
  } catch {
    showFeedback("Erro de comunicação ao enviar o chamado.", "error");
  } finally {
    els.btnSubmit.disabled = false;
    els.btnSubmit.textContent = "Registrar Chamado";
  }
}

async function updateChamadoStatus(id, novoStatus) {
  try {
    const res = await fetch("/api/chamados", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: novoStatus }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showFeedback(data.error || "Falha ao atualizar status.", "error");
    }
    await loadChamados();
  } catch {
    showFeedback("Erro ao atualizar status do chamado.", "error");
  }
}

async function deleteChamado(id) {
  try {
    const res = await fetch(`/api/chamados?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      showFeedback(data.error || "Falha ao excluir chamado.", "error");
      return;
    }
    await loadChamados();
  } catch {
    showFeedback("Erro ao excluir chamado.", "error");
  }
}

// Eventos
els.themeToggle.addEventListener("click", toggleTheme);

els.descricao.addEventListener("input", () => {
  els.descCount.textContent = String(els.descricao.value.length);
});

els.form.addEventListener("submit", handleCreateChamado);

els.btnSaveLocalUser.addEventListener("click", () => {
  saveLocalUser(els.localInput.value);
});

els.filtroStatus.addEventListener("change", loadChamados);
els.filtroPrioridade.addEventListener("change", loadChamados);

let searchTimer = null;
els.filtroBusca.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadChamados, 250);
});

// Inicialização
initTheme();
loadSavedLocalUser();
checkSystemStatus().then(loadChamados);
