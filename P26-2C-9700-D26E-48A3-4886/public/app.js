(() => {
  "use strict";

  const ICONS = {
    "bug-critico": "\u{1F41B}",
    "otima-explicacao": "\u{1F4A1}",
    "ajuda-projeto": "\u{1F91D}",
    "codigo-limpo": "\u2728",
    "trabalho-em-equipe": "\u{1F680}",
    "review-caprichado": "\u{1F50D}",
  };
  const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
  const $ = (sel) => document.querySelector(sel);
  const state = { me: null, users: [], badges: [] };

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else node.setAttribute(k, v);
    }
    for (const c of children) if (c) node.append(c);
    return node;
  }

  async function api(path, options = {}) {
    const res = await fetch(path, { credentials: "same-origin", ...options });
    let data = null;
    try { data = await res.json(); } catch { /* sem corpo */ }
    if (!res.ok) throw new Error((data && data.message) || "Erro " + res.status);
    return data;
  }

  function avatar(url) {
    const safe = typeof url === "string" && url.startsWith("https://cdn.discordapp.com/") ? url : DEFAULT_AVATAR;
    return el("img", { class: "avatar", src: safe, alt: "", width: "32", height: "32", loading: "lazy" });
  }

  function flash(text, kind) {
    const box = $("#flash");
    box.textContent = text;
    box.className = "flash " + kind;
    box.hidden = false;
    clearTimeout(flash.t);
    flash.t = setTimeout(() => { box.hidden = true; }, 6000);
  }

  function fmtDate(s) {
    const d = new Date(String(s).replace(" ", "T") + "Z");
    return isNaN(d) ? "" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function renderAuth() {
    const box = $("#auth");
    box.replaceChildren();
    if (state.me) {
      const out = el("button", { class: "btn ghost", type: "button", text: "Sair" });
      out.addEventListener("click", logout);
      box.append(avatar(state.me.avatar), el("span", { class: "who", text: state.me.username }), out);
    } else {
      box.append(el("a", { class: "btn", href: "/api/auth/discord", text: "Entrar com Discord" }));
    }
    $("#login-card").hidden = !!state.me;
    $("#send-card").hidden = !state.me;
  }

  function fillUsers() {
    const to = $("#to");
    to.replaceChildren(el("option", { value: "", text: "Escolha um colega..." }));
    for (const u of state.users) {
      if (!state.me || u.user_id !== state.me.userId) {
        to.append(el("option", { value: u.user_id, text: u.username }));
      }
    }
    const fp = $("#filter-profile");
    fp.replaceChildren(el("option", { value: "", text: "Todos os perfis" }));
    for (const u of state.users) {
      const mine = state.me && u.user_id === state.me.userId;
      fp.append(el("option", { value: u.user_id, text: u.username + (mine ? " (você)" : "") }));
    }
  }

  function fillBadges() {
    const box = $("#badges");
    box.replaceChildren();
    state.badges.forEach((b, i) => {
      const input = el("input", { type: "radio", name: "badge", value: b.key });
      if (i === 0) input.checked = true;
      const text = (ICONS[b.key] ? ICONS[b.key] + " " : "") + b.label;
      box.append(el("label", { class: "chip" }, input, el("span", { text })));
    });
  }

  function renderBoard(list) {
    const board = $("#board");
    board.replaceChildren();
    $("#empty").hidden = list.length > 0;
    for (const k of list) {
      const who = el("div", { class: "line" },
        el("strong", { text: k.from_username }),
        document.createTextNode(" \u2192 "),
        el("strong", { text: k.to_username }));
      board.append(el("article", { class: "kudo" },
        el("span", { class: "badge", text: (ICONS[k.badge] ? ICONS[k.badge] + " " : "") + k.badge_label }),
        el("p", { class: "msg", text: k.message }),
        el("footer", { class: "meta" },
          avatar(k.from_avatar),
          el("div", {}, who, el("time", { text: fmtDate(k.created_at) })))));
    }
  }

  async function loadKudos() {
    const profile = $("#filter-profile").value;
    const mode = $("#filter-mode").value;
    $("#filter-mode").disabled = !profile;
    const qs = new URLSearchParams();
    if (profile) qs.set(mode, profile);
    const q = qs.toString();
    const data = await api("/api/kudos" + (q ? "?" + q : ""));
    renderBoard(data.kudos);
  }

  async function logout() {
    try {
      await api("/api/logout", { method: "POST" });
      location.reload();
    } catch {
      flash("Não foi possível sair da conta.", "error");
    }
  }

  function updateCounter() {
    $("#counter").textContent = $("#message").value.length + "/280";
  }

  async function onSubmit(e) {
    e.preventDefault();
    const btn = $("#send-btn");
    const checked = document.querySelector('input[name="badge"]:checked');
    const payload = { to_id: $("#to").value, badge: checked ? checked.value : "", message: $("#message").value };
    btn.disabled = true;
    try {
      await api("/api/kudos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      $("#message").value = "";
      updateCounter();
      flash("Kudos enviado!", "ok");
      await loadKudos();
    } catch (err) {
      flash(err.message, "error");
    } finally {
      btn.disabled = false;
    }
  }

  async function init() {
    const params = new URLSearchParams(location.search);
    if (params.get("auth_error")) {
      flash("Não foi possível entrar com o Discord (" + params.get("auth_error") + "). Tente de novo.", "error");
    }
    if (params.has("auth_error") || params.has("login")) history.replaceState(null, "", location.pathname);

    try {
      const [me, users, badges] = await Promise.all([api("/api/me"), api("/api/users"), api("/api/badges")]);
      state.me = me.user;
      state.users = users.users;
      state.badges = badges.badges;
      renderAuth();
      fillUsers();
      fillBadges();
      await loadKudos();
    } catch (err) {
      flash("Erro ao carregar: " + err.message, "error");
    }

    $("#kudos-form").addEventListener("submit", onSubmit);
    $("#message").addEventListener("input", updateCounter);
    $("#filter-profile").addEventListener("change", () => loadKudos().catch((e) => flash(e.message, "error")));
    $("#filter-mode").addEventListener("change", () => loadKudos().catch((e) => flash(e.message, "error")));
  }

  document.addEventListener("DOMContentLoaded", init);
})();
