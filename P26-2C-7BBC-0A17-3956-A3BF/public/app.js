const CHAVE_PROJETO = "P26-2C-7BBC-0A17-3956-A3BF";
const state = { user: null, events: [], openId: null };

const $ = (id) => document.getElementById(id);

// Cria elementos sem innerHTML (evita XSS com texto digitado por usuários)
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children) if (c !== null && c !== undefined) node.append(c);
  return node;
}

async function api(path, options) {
  const res = await fetch(path, { credentials: "same-origin", ...options });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) {
    const err = new Error((data && data.error) || "erro");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const ERROS = {
  unauthorized: "Faça login com o Discord para continuar.",
  not_found: "Evento não encontrado.",
  not_registered: "Você não está inscrito neste evento.",
  validation: "Confira os campos do formulário.",
  invalid_json: "Dados inválidos.",
};

function mostrarMensagem(texto, ok = true) {
  const box = $("globalMessage");
  box.textContent = texto || "";
  box.className = "message " + (ok ? "ok" : "erro");
}

function mostrarErro(err) {
  mostrarMensagem(ERROS[err.message] || "Não foi possível concluir a ação.", false);
}

function formatarData(iso) {
  const [y, m, d] = String(iso).split("-");
  return d + "/" + m + "/" + y;
}

function renderHeader() {
  const box = $("discordProfile");
  box.replaceChildren();
  if (state.user) {
    box.append(
      el("img", { class: "avatar", src: state.user.avatar, alt: "", width: "28", height: "28" }),
      el("span", {}, state.user.username),
      el("a", { href: "/api/auth/logout", class: "logout-link" }, "Sair")
    );
  } else {
    box.append(el("a", { href: "/api/auth/discord", class: "login-link" }, "Entrar com Discord"));
  }
  $("createSection").hidden = !state.user;
}

async function carregarUsuario() {
  try {
    const data = await api("/api/me");
    state.user = data.user;
  } catch {
    state.user = null;
  }
  renderHeader();
}

async function carregarEventos() {
  try {
    const data = await api("/api/events");
    state.events = data.events;
  } catch {
    state.events = [];
    mostrarMensagem("Não foi possível carregar os eventos.", false);
  }
  renderEventos();
}

async function preencherDetalhe(eventId, box) {
  try {
    const d = await api("/api/events/" + eventId);
    box.replaceChildren();

    const confirmados = el("ul", { class: "people" });
    d.confirmed.forEach((p) => confirmados.append(el("li", {}, p.username)));
    if (d.confirmed.length === 0) confirmados.append(el("li", {}, "Ninguém confirmado ainda."));

    const fila = el("ol", { class: "people" });
    d.waitlist.forEach((p) => fila.append(el("li", {}, p.username)));
    if (d.waitlist.length === 0) fila.append(el("li", { class: "vazio" }, "Fila vazia."));

    box.append(el("h4", {}, "Confirmados (" + d.confirmed.length + "/" + d.event.capacity + ")"), confirmados);
    box.append(el("h4", {}, "Fila de espera (" + d.waitlist.length + ")"), fila);
    if (d.my_waitlist_position) {
      box.append(el("p", { class: "minha-fila" }, "Sua posição na fila: " + d.my_waitlist_position + "º"));
    }
  } catch (err) {
    box.textContent = "Não foi possível carregar os participantes.";
  }
}

async function confirmarPresenca(id) {
  try {
    const r = await api("/api/events/" + id + "/rsvp", { method: "POST" });
    mostrarMensagem(r.status === "confirmed" ? "Presença confirmada!" : "Lotação esgotada: você entrou na fila de espera.");
  } catch (err) {
    mostrarErro(err);
  }
  await carregarEventos();
}

async function cancelarInscricao(id) {
  try {
    await api("/api/events/" + id + "/rsvp", { method: "DELETE" });
    mostrarMensagem("Inscrição cancelada.");
  } catch (err) {
    mostrarErro(err);
  }
  await carregarEventos();
}

function renderEventos() {
  const list = $("eventsList");
  list.replaceChildren();

  if (state.events.length === 0) {
    list.append(el("p", {}, "Nenhum evento criado ainda."));
    return;
  }

  state.events.forEach((ev) => {
    const lotado = ev.confirmed_count >= ev.capacity;
    const detalhe = el("div", { class: "event-detail" });

    let acao;
    if (!state.user) {
      acao = el("a", { class: "btn-primary", href: "/api/auth/discord" }, "Entrar para confirmar presença");
    } else if (!ev.my_status) {
      acao = el("button", { class: "btn-primary", type: "button", onclick: () => confirmarPresenca(ev.id) },
        lotado ? "Entrar na fila de espera" : "Confirmar presença");
    } else {
      acao = el("button", { class: "btn-secondary", type: "button", onclick: () => cancelarInscricao(ev.id) },
        "Cancelar inscrição");
    }

    const statusTexto = ev.my_status === "confirmed" ? "Você está confirmado"
      : ev.my_status === "waitlist" ? "Você está na fila de espera" : null;

    const card = el("article", { class: "event-card" },
      el("h3", {}, ev.title),
      el("p", {}, ev.location + " · " + formatarData(ev.event_date) + " às " + ev.event_time),
      el("p", { class: "vagas" },
        "Vagas: " + ev.confirmed_count + "/" + ev.capacity +
        (ev.waitlist_count > 0 ? " · Fila: " + ev.waitlist_count : "") +
        (lotado ? " · LOTADO" : "")),
      statusTexto ? el("p", { class: "meu-status" }, statusTexto) : null,
      el("div", { class: "event-actions" },
        acao,
        el("button", {
          class: "btn-link", type: "button",
          onclick: () => {
            state.openId = state.openId === ev.id ? null : ev.id;
            renderEventos();
          },
        }, state.openId === ev.id ? "Ocultar participantes" : "Ver participantes")
      ),
      detalhe
    );

    if (state.openId === ev.id) preencherDetalhe(ev.id, detalhe);
    list.append(card);
  });
}

$("createBtn").addEventListener("click", async () => {
  const body = {
    title: $("evTitle").value,
    location: $("evLocation").value,
    event_date: $("evDate").value,
    event_time: $("evTime").value,
    capacity: Number($("evCapacity").value),
  };
  try {
    await api("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    ["evTitle", "evLocation", "evDate", "evTime", "evCapacity"].forEach((id) => ($(id).value = ""));
    mostrarMensagem("Evento criado!");
    await carregarEventos();
  } catch (err) {
    mostrarErro(err);
  }
});

(async function iniciar() {
  const params = new URLSearchParams(location.search);
  if (params.get("auth_error")) mostrarMensagem("Falha no login com o Discord: " + params.get("auth_error"), false);
  await carregarUsuario();
  await carregarEventos();
})();