/* Gerenciador de Horas Complementares — Vanilla JS (sem frameworks).
 * Toda regra de negócio (teto por categoria, validações) é aplicada no servidor;
 * este arquivo apenas apresenta os dados e envia as requisições. */
const CHAVE_PROJETO = "P26-3A-3337-3158-1523-6DA7";
const CATEGORIES = ["ensino", "pesquisa", "extensao"];
const CATEGORY_LABELS = { ensino: "Ensino", pesquisa: "Pesquisa", extensao: "Extensão" };
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
const AUTH_ERRORS = {
  access_denied: "Login cancelado no Discord.",
  oauth_error: "O Discord retornou um erro durante a autorização.",
  invalid_state: "Sessão de login inválida ou expirada. Tente entrar novamente.",
  token_exchange_failed: "O Discord recusou a troca do código de autorização.",
  fetch_user_failed: "Não foi possível ler o perfil do Discord.",
  invalid_user: "Perfil do Discord inválido.",
  missing_code: "O Discord não retornou o código de autorização.",
  exception: "Erro inesperado durante o login.",
};

const state = { user: null, discordConfigured: false, cap: 60, required: 180 };

const $ = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function el(tag, { className, text, attrs } = {}, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) if (c) node.appendChild(c);
  return node;
}

function setStatus(id, message, ok = true) {
  const node = $(id);
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("error", !ok);
}

async function api(path, options) {
  const res = await fetch(path, { credentials: "same-origin", ...options });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

/* ---------- Cabeçalho (perfil Discord: user_id, nome e avatar) ---------- */

function renderHeader() {
  const link = $("discordLoginLink");
  const text = $("discordUserText");
  const avatar = $("discordAvatar");
  const logout = $("logoutLink");

  if (state.user) {
    text.textContent = `${state.user.username} (${state.user.userId})`;
    avatar.src = state.user.avatar || DEFAULT_AVATAR;
    avatar.hidden = false;
    logout.hidden = false;
    link.removeAttribute("href");
  } else {
    avatar.hidden = true;
    logout.hidden = true;
    if (state.discordConfigured) {
      text.textContent = "Entrar com Discord";
      link.setAttribute("href", "/api/auth/discord");
    } else {
      text.textContent = "Login Discord indisponível";
      link.removeAttribute("href");
    }
  }
}

/* ---------- Painel de progresso ---------- */

function progressRow({ label, value, max, fillClass, hint, done }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const fill = el("div", { className: "progress-fill " + fillClass });
  fill.style.width = pct + "%";
  const track = el(
    "div",
    {
      className: "progress-track",
      attrs: {
        role: "progressbar",
        "aria-label": label,
        "aria-valuemin": "0",
        "aria-valuemax": String(max),
        "aria-valuenow": String(value),
        "aria-valuetext": `${fmt(value)} de ${fmt(max)} horas`,
      },
    },
    fill
  );
  return el(
    "div",
    { className: "progress-row" },
    el(
      "div",
      { className: "progress-label" },
      el("span", { text: label }),
      el("span", { text: `${fmt(value)} / ${fmt(max)} h` })
    ),
    track,
    el("div", { className: "progress-hint" + (done ? " done" : ""), text: hint })
  );
}

function renderProgress(summary) {
  const container = $("progressContainer");
  const totalEl = $("totalProgress");
  container.replaceChildren();
  totalEl.replaceChildren();
  if (!summary) return;

  state.cap = summary.capPerCategory;
  state.required = summary.required;

  for (const cat of CATEGORIES) {
    const value = Number(summary.totals[cat] || 0);
    const remaining = Number(summary.remaining[cat] ?? Math.max(0, state.cap - value));
    container.appendChild(
      progressRow({
        label: CATEGORY_LABELS[cat],
        value,
        max: state.cap,
        fillClass: "fill-" + cat,
        done: remaining <= 0,
        hint:
          remaining <= 0
            ? "Eixo integralizado ✓ (teto atingido)."
            : `Faltam ${fmt(remaining)} h para integralizar este eixo (teto de ${fmt(state.cap)} h).`,
      })
    );
  }

  const left = Number(summary.remainingTotal ?? Math.max(0, state.required - summary.total));
  const pct = state.required > 0 ? Math.min(100, (summary.total / state.required) * 100) : 0;
  totalEl.appendChild(
    progressRow({
      label: "Total validado",
      value: Number(summary.total),
      max: state.required,
      fillClass: "fill-total",
      done: left <= 0,
      hint:
        left <= 0
          ? "Exigência curricular integralizada ✓"
          : `Faltam ${fmt(left)} h para integralizar a exigência curricular (${pct.toFixed(1).replace(".", ",")}% concluído).`,
    })
  );
}

/* ---------- Lista de atividades ---------- */

function safeHref(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

function renderActivities(items) {
  const list = $("recordsList");
  list.replaceChildren();
  if (!items.length) {
    list.appendChild(el("li", {}, el("span", { className: "empty", text: "Nenhuma atividade registrada ainda." })));
    return;
  }
  for (const item of items) {
    const main = el("div", { className: "item-main" });
    main.appendChild(
      el("span", { className: "badge badge-" + item.category, text: CATEGORY_LABELS[item.category] || item.category })
    );
    main.appendChild(el("span", { text: ` ${item.title} — ${fmt(item.hours)} h ` }));
    const href = safeHref(item.certificate_url);
    if (href) {
      main.appendChild(
        el("a", { text: "certificado", attrs: { href, target: "_blank", rel: "noopener noreferrer" } })
      );
    }
    main.appendChild(el("span", { className: "meta", text: `Registrado em ${item.created_at} (UTC)` }));

    const remove = el("button", {
      className: "btn-danger",
      text: "Remover",
      attrs: { type: "button", "aria-label": `Remover atividade ${item.title}` },
    });
    remove.addEventListener("click", () => removeActivity(item.id));
    list.appendChild(el("li", {}, main, remove));
  }
}

/* ---------- Dados ---------- */

async function loadStatus() {
  const { data } = await api("/api/status");
  state.discordConfigured = Boolean(data && data.discordOAuthConfigured);
  state.user = (data && data.sessionUser) || null;
  if (data && data.capPerCategory) state.cap = data.capPerCategory;
  if (data && data.requiredHours) state.required = data.requiredHours;
}

async function refreshData() {
  if (!state.user) return;
  const [summary, activities] = await Promise.all([api("/api/summary"), api("/api/activities")]);
  if (summary.status === 401 || activities.status === 401) {
    state.user = null;
    applyAuthUI();
    return;
  }
  renderProgress(summary.ok ? summary.data : null);
  renderActivities(activities.ok && Array.isArray(activities.data.activities) ? activities.data.activities : []);
}

function applyAuthUI() {
  const logged = Boolean(state.user);
  $("dashboardCard").hidden = !logged;
  $("formCard").hidden = !logged;
  $("listCard").hidden = !logged;
  renderHeader();
  if (logged) {
    setStatus("authMessage", "Sessão ativa. Registre suas atividades e acompanhe o progresso abaixo.");
  } else if (state.discordConfigured) {
    setStatus("authMessage", "Entre com o Discord para registrar e acompanhar suas horas complementares.");
  } else {
    setStatus("authMessage", "Login via Discord ainda não configurado neste ambiente.", false);
  }
}

/* ---------- Ações ---------- */

async function submitActivity(event) {
  event.preventDefault();
  if (!state.user) {
    setStatus("statusMessage", "Faça login com o Discord antes de registrar.", false);
    return;
  }
  const category = $("categoryInput").value;
  const title = $("titleInput").value.trim();
  const hours = $("hoursInput").value.trim();
  const certificateUrl = $("certInput").value.trim();

  if (!title) return setStatus("statusMessage", "Informe o título da atividade.", false);
  if (!hours || !(Number(hours) > 0)) return setStatus("statusMessage", "Informe uma carga horária positiva.", false);
  if (!/^\d+([.,]\d{1,2})?$/.test(hours)) return setStatus("statusMessage", "Use no máximo 2 casas decimais na carga horária.", false);
  if (!certificateUrl) return setStatus("statusMessage", "Informe o link do certificado.", false);

  const button = $("sendBtn");
  button.disabled = true;
  setStatus("statusMessage", "Enviando para a Cloudflare Function…");
  try {
    const { ok, data } = await api("/api/activities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, title, hours: hours.replace(",", "."), certificateUrl }),
    });
    if (ok) {
      $("activityForm").reset();
      setStatus("statusMessage", (data && data.message) || "Atividade registrada.");
      await refreshData();
    } else {
      setStatus("statusMessage", (data && data.error) || "Erro ao registrar.", false);
      await refreshData();
    }
  } catch {
    setStatus("statusMessage", "Falha de rede. Tente novamente.", false);
  } finally {
    button.disabled = false;
  }
}

async function removeActivity(id) {
  if (!window.confirm("Remover esta atividade?")) return;
  const { ok, data } = await api("/api/activities?id=" + encodeURIComponent(id), { method: "DELETE" });
  setStatus("statusMessage", ok ? "Atividade removida." : (data && data.error) || "Erro ao remover.", ok);
  await refreshData();
}

async function init() {
  $("activityForm").addEventListener("submit", submitActivity);
  $("logoutLink").addEventListener("click", async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", redirect: "manual" });
    } finally {
      location.assign("/");
    }
  });
  const params = new URLSearchParams(location.search);

  try {
    await loadStatus();
  } catch {
    state.user = null;
  }
  applyAuthUI();

  const authError = params.get("auth_error");
  if (authError) {
    setStatus("authMessage", AUTH_ERRORS[authError] || "Erro de autenticação: " + authError, false);
  }
  if (params.has("login") || authError) history.replaceState(null, "", location.pathname);

  await refreshData();
}

init();
