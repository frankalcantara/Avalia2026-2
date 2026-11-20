/* Cliente em JavaScript puro (sem frameworks).
 * O navegador só exibe o que o servidor envia: a regra de bloqueio das cápsulas
 * é aplicada nas Cloudflare Functions; aqui há apenas a contagem regressiva visual. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };
  var state = { user: null, clockOffsetMs: 0, countdowns: [], refreshing: false };

  // ---------- utilidades ----------
  function api(path, options) {
    options = options || {};
    var init = { method: options.method || "GET", credentials: "same-origin", headers: {} };
    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    return fetch(path, init).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.message || data.error || "Erro " + res.status);
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text; // textContent evita XSS
    return node;
  }

  function showNotice(message, isError) {
    var box = $("notice");
    box.textContent = message;
    box.className = "notice" + (isError ? " is-error" : "");
    box.setAttribute("role", isError ? "alert" : "status");
    box.hidden = false;
    clearTimeout(showNotice._t);
    showNotice._t = setTimeout(function () { box.hidden = true; }, 6000);
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  function avatarImg(src, name) {
    var img = el("img", "avatar");
    img.width = 36; img.height = 36; img.loading = "lazy";
    img.alt = "Avatar de " + name;
    if (typeof src === "string" && src.indexOf("https://cdn.discordapp.com/") === 0) img.src = src;
    return img;
  }

  function authorBlock(author, metaText) {
    var wrap = el("div", "item__head");
    wrap.appendChild(avatarImg(author.avatar, author.name));
    var who = el("div", "item__who");
    who.appendChild(el("span", "item__name", author.name));
    who.appendChild(el("span", "item__meta", metaText));
    wrap.appendChild(who);
    return wrap;
  }

  // ---------- sessão ----------
  function renderAuth() {
    var logged = !!state.user;
    $("login-btn").hidden = logged;
    $("user-box").hidden = !logged;
    $("message-form").hidden = !logged;
    $("capsule-form").hidden = !logged;
    $("mural-login-hint").hidden = logged;
    $("capsule-login-hint").hidden = logged;
    if (logged) {
      $("user-name").textContent = state.user.username;
      var av = $("user-avatar");
      av.alt = "Avatar de " + state.user.username;
      if (state.user.avatar && state.user.avatar.indexOf("https://cdn.discordapp.com/") === 0) av.src = state.user.avatar;
    }
  }

  function loadSession() {
    return api("/api/auth/me").then(function (data) {
      state.user = data.authenticated ? data.user : null;
      renderAuth();
    }).catch(function (e) {
      state.user = null;
      renderAuth();
      showNotice("Não foi possível verificar o login: " + e.message, true);
    });
  }

  // ---------- mural ----------
  function renderMessages(list) {
    var ul = $("message-list");
    ul.textContent = "";
    $("message-empty").hidden = list.length > 0;
    list.forEach(function (m) {
      var li = el("li", "item");
      li.appendChild(authorBlock(m.author, fmtDate(m.created_at)));
      li.appendChild(el("p", "item__text", m.content));
      ul.appendChild(li);
    });
  }

  function loadMessages() {
    $("message-loading").hidden = false;
    $("message-empty").hidden = true;
    $("message-list").setAttribute("aria-busy", "true");
    return api("/api/messages").then(function (d) { renderMessages(d.messages || []); })
      .catch(function (e) { showNotice("Não foi possível carregar o mural: " + e.message, true); })
      .then(function () {
        $("message-loading").hidden = true;
        $("message-list").setAttribute("aria-busy", "false");
      });
  }

  // ---------- cápsulas ----------
  function formatRemaining(totalSeconds) {
    var s = Math.max(0, totalSeconds);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600); s -= h * 3600;
    var m = Math.floor(s / 60); s -= m * 60;
    var pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return (d > 0 ? d + "d " : "") + pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function renderCapsules(list) {
    var ul = $("capsule-list");
    ul.textContent = "";
    state.countdowns = [];
    $("capsule-empty").hidden = list.length > 0;

    list.forEach(function (c) {
      var li = el("li", "item" + (c.locked ? " is-locked" : ""));
      var audience = c.audience === "self" ? "para si mesmo(a)" : "para a turma";
      var head = authorBlock(c.author, "Cápsula " + audience);
      head.appendChild(el("span", "badge " + (c.locked ? "badge--locked" : "badge--open"), c.locked ? "Trancada" : "Aberta"));
      li.appendChild(head);
      li.appendChild(el("p", "item__title", c.title));

      if (c.locked) {
        var cd = el("div", "countdown", formatRemaining(c.seconds_remaining));
        cd.setAttribute("role", "timer");
        li.appendChild(cd);
        li.appendChild(el("p", "locked-note", "Abre em " + fmtDate(c.unlock_date) + ". O conteúdo só é enviado pelo servidor depois dessa data."));
        state.countdowns.push({ node: cd, unlockMs: Date.parse(c.unlock_date) });
      } else {
        li.appendChild(el("p", "item__text", c.content));
        li.appendChild(el("p", "item__meta", "Desbloqueada em " + fmtDate(c.unlock_date)));
      }
      ul.appendChild(li);
    });
  }

  function loadCapsules() {
    $("capsule-loading").hidden = false;
    $("capsule-empty").hidden = true;
    $("capsule-list").setAttribute("aria-busy", "true");
    return api("/api/capsules").then(function (d) {
      // alinha o relógio visual ao do servidor (só para a contagem; o bloqueio é do servidor)
      state.clockOffsetMs = Date.parse(d.server_time) - Date.now();
      renderCapsules(d.capsules || []);
    }).catch(function (e) { showNotice("Não foi possível carregar as cápsulas: " + e.message, true); })
      .then(function () {
        $("capsule-loading").hidden = true;
        $("capsule-list").setAttribute("aria-busy", "false");
      });
  }

  function tick() {
    var nowMs = Date.now() + state.clockOffsetMs;
    var reached = false;
    state.countdowns.forEach(function (c) {
      var left = Math.ceil((c.unlockMs - nowMs) / 1000);
      c.node.textContent = formatRemaining(left);
      if (left <= 0) reached = true;
    });
    if (reached && !state.refreshing) {
      // pede ao servidor a lista de novo: só ele decide se o texto já pode ser enviado
      state.refreshing = true;
      loadCapsules().then(function () {
        setTimeout(function () { state.refreshing = false; }, 3000);
      });
    }
  }

  // ---------- formulários ----------
  function setupForms() {
    var msg = $("message-content");
    msg.addEventListener("input", function () { $("message-counter").textContent = msg.value.length + "/500"; });

    $("message-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var btn = ev.target.querySelector("button[type=submit]");
      btn.disabled = true;
      api("/api/messages", { method: "POST", body: { content: msg.value } })
        .then(function () { msg.value = ""; $("message-counter").textContent = "0/500"; showNotice("Depoimento publicado!"); return loadMessages(); })
        .catch(function (e) { showNotice(e.message, true); })
        .then(function () { btn.disabled = false; });
    });

    var unlock = $("capsule-unlock");
    var soon = new Date(Date.now() + 5 * 60 * 1000);
    soon.setMinutes(soon.getMinutes() - soon.getTimezoneOffset());
    unlock.min = soon.toISOString().slice(0, 16); // só ajuda o usuário; o servidor valida de verdade

    $("capsule-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var btn = ev.target.querySelector("button[type=submit]");
      var when = new Date(unlock.value);
      if (isNaN(when.getTime())) { showNotice("Informe a data de desbloqueio.", true); return; }
      btn.disabled = true;
      api("/api/capsules", {
        method: "POST",
        body: {
          title: $("capsule-title").value,
          content: $("capsule-content").value,
          audience: $("capsule-audience").value,
          unlock_date: when.toISOString()
        }
      }).then(function () {
        ev.target.reset();
        showNotice("Cápsula trancada! Ela abrirá na data escolhida.");
        return loadCapsules();
      }).catch(function (e) { showNotice(e.message, true); })
        .then(function () { btn.disabled = false; });
    });

    $("logout-btn").addEventListener("click", function () {
      api("/api/auth/logout", { method: "POST" }).then(function () {
        state.user = null; renderAuth(); loadCapsules();
      }).catch(function (e) { showNotice("Não foi possível sair: " + e.message, true); });
    });
  }

  function setupTabs() {
    var tabs = { mural: ["tab-mural", "panel-mural"], capsulas: ["tab-capsulas", "panel-capsulas"] };
    Object.keys(tabs).forEach(function (key) {
      $(tabs[key][0]).addEventListener("click", function () {
        Object.keys(tabs).forEach(function (k) {
          var active = k === key;
          $(tabs[k][0]).classList.toggle("is-active", active);
          $(tabs[k][0]).setAttribute("aria-selected", String(active));
          $(tabs[k][0]).setAttribute("tabindex", active ? "0" : "-1");
          $(tabs[k][1]).hidden = !active;
        });
      });
      $(tabs[key][0]).addEventListener("keydown", function (ev) {
        var keys = Object.keys(tabs);
        var index = keys.indexOf(key);
        var next = null;
        if (ev.key === "ArrowRight") next = keys[(index + 1) % keys.length];
        if (ev.key === "ArrowLeft") next = keys[(index + keys.length - 1) % keys.length];
        if (ev.key === "Home") next = keys[0];
        if (ev.key === "End") next = keys[keys.length - 1];
        if (next) {
          ev.preventDefault();
          $(tabs[next][0]).focus();
          $(tabs[next][0]).click();
        }
      });
    });
  }

  function handleAuthQuery() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("login") === "success") showNotice("Login realizado com sucesso!");
    if (params.get("auth_error")) showNotice("Falha no login (" + params.get("auth_error") + "). Tente novamente.", true);
    if (params.has("login") || params.has("auth_error")) history.replaceState(null, "", window.location.pathname);
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupTabs();
    setupForms();
    handleAuthQuery();
    loadSession().then(function () { return Promise.all([loadMessages(), loadCapsules()]); });
    setInterval(tick, 1000);
  });
})();
