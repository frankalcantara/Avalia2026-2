/*
 * Rastreador de Hábitos — JavaScript puro (Vanilla JS), manipulação direta do DOM.
 * O cliente só exibe: regras de negócio e métricas são validadas/calculadas no servidor.
 */
(() => {
  "use strict";

  const COLORS = ["azul", "verde", "roxo", "laranja", "rosa", "ciano"];
  const COLOR_LABELS = { azul: "Azul", verde: "Verde", roxo: "Roxo", laranja: "Laranja", rosa: "Rosa", ciano: "Ciano" };
  const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
  const AUTH_ERRORS = {
    not_configured: "O login ainda não foi configurado no servidor (DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET).",
    access_denied: "Você cancelou a autorização no Discord.",
    invalid_state: "A tentativa de login expirou. Tente novamente.",
    token_exchange_failed: "Não foi possível concluir o login com o Discord. Tente novamente.",
    profile_failed: "Não foi possível ler seu perfil do Discord. Tente novamente.",
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c) node.append(c);
    return node;
  };

  const state = {
    user: null,
    today: localToday(),
    month: null,
    habits: [],
    summary: null,
    newColor: "azul",
    editing: null,
    scrolledFor: null,
  };

  // ---------- datas ----------
  function localToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const monthOf = (iso) => iso.slice(0, 7);
  function shiftMonth(month, delta) {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  function daysInMonth(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
  }
  function monthLabel(month) {
    const [y, m] = month.split("-").map(Number);
    const label = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
    return label.charAt(0).toUpperCase() + label.slice(1); // "Novembro de 2026"
  }
  const fmtPct = (n) => `${Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---------- API ----------
  class ApiError extends Error {
    constructor(status, message, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  async function api(path, { method = "GET", body } = {}) {
    const opts = { method, credentials: "same-origin", headers: { Accept: "application/json" } };
    if (body !== undefined) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch {
      throw new ApiError(0, "Sem conexão com o servidor. Verifique sua internet.");
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      showLogin();
      throw new ApiError(401, data.message || "Sessão expirada. Entre novamente.");
    }
    if (!res.ok || data.ok === false) {
      throw new ApiError(res.status, data.message || `Erro ${res.status}`, data.error);
    }
    return data;
  }

  const query = () => `month=${encodeURIComponent(state.month)}&today=${encodeURIComponent(state.today)}`;

  // ---------- avisos ----------
  let toastTimer;
  function toast(message, isError = false) {
    const t = $("toast");
    t.textContent = message;
    t.classList.toggle("error", isError);
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), isError ? 5000 : 2500);
  }

  // ---------- telas ----------
  function show(view) {
    $("loading-view").hidden = view !== "loading";
    $("login-view").hidden = view !== "login";
    $("app-view").hidden = view !== "app";
    $("user-box").hidden = view !== "app";
  }

  function showLogin(message) {
    state.user = null;
    const box = $("login-error");
    box.textContent = message || "";
    box.hidden = !message;
    show("login");
  }

  function renderUser() {
    const u = state.user;
    $("user-avatar").src = u.avatarUrl;
    $("user-avatar").alt = `Avatar de ${u.displayName}`;
    $("user-name").textContent = u.displayName;
    $("user-handle").textContent = `@${u.username}`;
  }

  // ---------- cabeçalho e indicadores ----------
  function renderToolbar() {
    $("month-title").textContent = monthLabel(state.month);
    const current = monthOf(state.today);
    $("next-month").disabled = state.month >= current;
    $("today-btn").hidden = state.month === current;
  }

  function renderKpis() {
    const s = state.summary || { monthlyRate: 0, completedDays: 0, eligibleDays: 0, bestCurrentStreak: 0, bestMaxStreak: 0, doneToday: 0, habits: 0 };
    $("kpi-rate").textContent = fmtPct(s.monthlyRate);
    $("kpi-rate-sub").textContent = `${s.completedDays} de ${s.eligibleDays} marcações possíveis`;
    $("kpi-current").textContent = plural(s.bestCurrentStreak, "dia", "dias");
    $("kpi-max").textContent = plural(s.bestMaxStreak, "dia", "dias");
    $("kpi-today").textContent = `${s.doneToday}/${s.habits}`;
    $("kpi-today-sub").textContent = s.habits && s.doneToday === s.habits ? "tudo feito hoje!" : "hábitos concluídos hoje";
  }

  // ---------- grade ----------
  function renderGrid() {
    const head = $("grid-head");
    const body = $("grid-body");
    const total = daysInMonth(state.month);
    const [y, m] = state.month.split("-").map(Number);

    head.replaceChildren(el("th", { class: "name-head", scope: "col", text: "Hábito" }));
    for (let d = 1; d <= total; d++) {
      const date = `${state.month}-${String(d).padStart(2, "0")}`;
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const cls = ["day-head", wd === 0 || wd === 6 ? "weekend" : "", date === state.today ? "today" : ""].join(" ").trim();
      head.append(el("th", { class: cls, scope: "col", "aria-label": `Dia ${d}` }, String(d), el("span", { class: "wd", text: WEEKDAYS[wd] })));
    }

    body.replaceChildren(...state.habits.map((h) => buildRow(h, total, y, m)));
    $("empty").hidden = state.habits.length > 0;
    $("grid-wrap").hidden = state.habits.length === 0;

    scrollToToday();
  }

  /** No mês corrente, rola a grade até o dia de hoje (uma vez por mês exibido, só com o painel visível). */
  function scrollToToday() {
    const wrap = $("grid-wrap");
    if ($("app-view").hidden || wrap.hidden || state.scrolledFor === state.month) return;
    if (state.month !== monthOf(state.today)) return;
    const todayHead = $("grid-head").querySelector(".today");
    if (!todayHead) return;
    state.scrolledFor = state.month;
    if (wrap.scrollWidth > wrap.clientWidth) {
      const nameCol = $("grid-head").firstElementChild.offsetWidth;
      wrap.scrollLeft = Math.max(0, todayHead.offsetLeft - nameCol - (wrap.clientWidth - nameCol) / 2);
    }
  }

  function buildRow(habit, total, y, m) {
    const row = el("tr", { class: `c-${habit.color}`, dataset: { habitId: habit.id } });
    const done = new Set(habit.days);

    const editBtn = el("button", { class: "edit-btn", type: "button", "aria-label": `Editar ${habit.name}`, title: "Editar", dataset: { edit: habit.id }, text: "✎" });
    const bar = el("div", { class: "bar", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": "100", "aria-label": `Progresso do mês em ${habit.name}` }, el("span"));
    const stats = el("div", { class: "habit-stats" });
    const nameCell = el(
      "th",
      { class: "name-cell", scope: "row" },
      el("div", { class: "habit-top" }, el("span", { class: "habit-dot", "aria-hidden": "true" }), el("span", { class: "habit-name", title: habit.name, text: habit.name }), editBtn),
      bar,
      stats
    );
    row.append(nameCell);

    for (let d = 1; d <= total; d++) {
      const date = `${state.month}-${String(d).padStart(2, "0")}`;
      const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const future = date > state.today;
      const cls = ["day-cell", wd === 0 || wd === 6 ? "weekend" : "", date === state.today ? "today" : ""].join(" ").trim();
      const box = el("input", {
        type: "checkbox",
        class: "check",
        checked: done.has(date),
        disabled: future,
        "aria-label": `${habit.name}, dia ${d}${future ? " (futuro)" : ""}`,
        dataset: { habitId: habit.id, date },
      });
      row.append(el("td", { class: cls }, box));
    }

    paintRowMetrics(row, habit);
    return row;
  }

  /** Atualiza barra de progresso e indicadores numéricos de uma linha. */
  function paintRowMetrics(row, habit) {
    const mt = habit.metrics;
    const pct = Math.max(0, Math.min(100, mt.monthlyRate));
    const bar = row.querySelector(".bar");
    bar.firstElementChild.style.setProperty("--p", `${pct}%`);
    bar.setAttribute("aria-valuenow", String(pct));
    bar.setAttribute("aria-valuetext", `${fmtPct(pct)} (${mt.completedDays} de ${mt.eligibleDays} dias)`);

    const stats = row.querySelector(".habit-stats");
    stats.replaceChildren(
      el("span", { title: "Taxa de cumprimento no mês" }, el("b", { text: fmtPct(mt.monthlyRate) }), " no mês"),
      el("span", { title: "Sequência atual" }, "atual ", el("b", { text: String(mt.currentStreak) })),
      el("span", { title: "Maior sequência (streak máximo)" }, "máx ", el("b", { text: String(mt.maxStreak) }))
    );
  }

  const findHabit = (id) => state.habits.find((h) => h.id === id);
  const findRow = (id) => $("grid-body").querySelector(`tr[data-habit-id="${id}"]`);

  // ---------- marcações (atualização imediata + confirmação do servidor) ----------
  async function toggle(box) {
    const id = Number(box.dataset.habitId);
    const date = box.dataset.date;
    const done = box.checked;
    const habit = findHabit(id);
    if (!habit) return;

    // 1) atualização otimista: barra de progresso muda na hora
    const before = { days: habit.days.slice(), metrics: { ...habit.metrics }, summary: { ...state.summary } };
    habit.days = done ? [...habit.days, date] : habit.days.filter((d) => d !== date);
    const completed = habit.days.length;
    const eligible = habit.metrics.eligibleDays;
    habit.metrics = { ...habit.metrics, completedDays: completed, monthlyRate: eligible ? Math.min(100, Math.round((completed / eligible) * 1000) / 10) : 0 };
    const delta = done ? 1 : -1;
    state.summary = {
      ...state.summary,
      completedDays: state.summary.completedDays + delta,
      monthlyRate: state.summary.eligibleDays ? Math.min(100, Math.round(((state.summary.completedDays + delta) / state.summary.eligibleDays) * 1000) / 10) : 0,
    };
    const row = findRow(id);
    if (row) paintRowMetrics(row, habit);
    renderKpis();

    box.disabled = true;
    box.classList.add("pending");

    // 2) servidor valida, grava no D1 e devolve as métricas oficiais
    try {
      const res = await api(`/api/habits/${id}/completions/${date}?${query()}`, { method: done ? "PUT" : "DELETE" });
      Object.assign(habit, res.habit);
      state.summary = res.summary;
    } catch (err) {
      habit.days = before.days;
      habit.metrics = before.metrics;
      state.summary = before.summary;
      box.checked = !done;
      if (err.status !== 401) toast(err.message, true);
    } finally {
      box.disabled = date > state.today;
      box.classList.remove("pending");
      const r = findRow(id);
      if (r) paintRowMetrics(r, habit);
      renderKpis();
    }
  }

  // ---------- carregamento ----------
  async function loadMonth(month) {
    state.today = localToday();
    const data = await api(`/api/habits?month=${encodeURIComponent(month)}&today=${encodeURIComponent(state.today)}`);
    state.month = data.month;
    state.today = data.today; // o servidor confirma qual é "hoje"
    state.habits = data.habits;
    state.summary = data.summary;
    renderToolbar();
    renderKpis();
    renderGrid();
  }

  async function goToMonth(month) {
    try {
      await loadMonth(month);
    } catch (err) {
      if (err.status !== 401) toast(err.message, true);
    }
  }

  // ---------- cores ----------
  function buildSwatches(fieldset, name, selected, onPick) {
    fieldset.querySelectorAll(".swatch").forEach((n) => n.remove());
    for (const c of COLORS) {
      const input = el("input", { type: "radio", name, value: c, checked: c === selected, "aria-label": COLOR_LABELS[c] });
      input.addEventListener("change", () => onPick(c));
      fieldset.append(el("label", { class: `swatch c-${c}`, title: COLOR_LABELS[c] }, input, el("span", { "aria-hidden": "true" })));
    }
  }

  // ---------- criar hábito ----------
  async function onAdd(e) {
    e.preventDefault();
    const input = $("habit-name");
    const name = input.value.trim();
    if (!name) return;
    const btn = $("add-btn");
    btn.disabled = true;
    try {
      await api("/api/habits", { method: "POST", body: { name, color: state.newColor } });
      input.value = "";
      await loadMonth(state.month);
      toast("Hábito adicionado.");
    } catch (err) {
      if (err.status !== 401) toast(err.message, true);
    } finally {
      btn.disabled = false;
      input.focus();
    }
  }

  // ---------- editar / excluir ----------
  function openEdit(id) {
    const habit = findHabit(id);
    if (!habit) return;
    state.editing = { id, color: habit.color, confirmDelete: false };
    $("edit-name").value = habit.name;
    $("delete-btn").textContent = "Excluir";
    buildSwatches($("edit-swatches"), "edit-color", habit.color, (c) => (state.editing.color = c));
    $("edit-dialog").showModal();
    $("edit-name").focus();
  }

  async function onEditSubmit(e) {
    e.preventDefault();
    const dialog = $("edit-dialog");
    if (e.submitter && e.submitter.value === "cancel") {
      dialog.close();
      return;
    }
    const { id, color } = state.editing;
    const name = $("edit-name").value.trim();
    if (!name) return;
    const btn = $("save-btn");
    btn.disabled = true;
    try {
      await api(`/api/habits/${id}`, { method: "PATCH", body: { name, color } });
      dialog.close();
      await loadMonth(state.month);
      toast("Hábito atualizado.");
    } catch (err) {
      if (err.status !== 401) toast(err.message, true);
    } finally {
      btn.disabled = false;
    }
  }

  async function onDelete() {
    const ed = state.editing;
    if (!ed) return;
    if (!ed.confirmDelete) {
      ed.confirmDelete = true;
      $("delete-btn").textContent = "Confirmar exclusão";
      return;
    }
    try {
      await api(`/api/habits/${ed.id}`, { method: "DELETE" });
      $("edit-dialog").close();
      await loadMonth(state.month);
      toast("Hábito excluído.");
    } catch (err) {
      if (err.status !== 401) toast(err.message, true);
    }
  }

  async function onLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* mesmo com erro, volta para a tela de login */
    }
    showLogin();
  }

  // ---------- início ----------
  async function init() {
    $("add-form").addEventListener("submit", onAdd);
    $("edit-form").addEventListener("submit", onEditSubmit);
    $("delete-btn").addEventListener("click", onDelete);
    $("logout-btn").addEventListener("click", onLogout);
    $("prev-month").addEventListener("click", () => goToMonth(shiftMonth(state.month, -1)));
    $("next-month").addEventListener("click", () => goToMonth(shiftMonth(state.month, 1)));
    $("today-btn").addEventListener("click", () => goToMonth(monthOf(localToday())));
    $("grid-body").addEventListener("change", (e) => {
      if (e.target.matches("input.check")) toggle(e.target);
    });
    $("grid-body").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-edit]");
      if (btn) openEdit(Number(btn.dataset.edit));
    });
    buildSwatches(document.querySelector("#add-form .swatches"), "new-color", state.newColor, (c) => (state.newColor = c));
    // se o avatar do Discord não carregar, mostra só o círculo (sem texto quebrado)
    $("user-avatar").addEventListener("error", (e) => {
      e.target.hidden = true;
    });

    // mensagem de erro do login (?auth_error=...) e limpeza da URL
    const params = new URLSearchParams(location.search);
    const authError = params.get("auth_error");
    if (location.search) history.replaceState(null, "", location.pathname);

    try {
      const me = await api("/api/me");
      state.user = me.user;
      renderUser();
      await loadMonth(monthOf(state.today));
      show("app");
      scrollToToday();
    } catch (err) {
      if (err.status === 401) showLogin(authError ? AUTH_ERRORS[authError] || "Falha no login. Tente novamente." : "");
      else showLogin(err.message);
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
