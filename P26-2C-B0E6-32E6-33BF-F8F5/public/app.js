"use strict";
const $ = (s) => document.querySelector(s);
const DAY = 864e5, H0 = 7, H1 = 22; // grade de 07h às 22h
const fmtT = (ms) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
const fmtD = (ms) => new Date(ms).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
const state = { me: null, mode: "aluno", week: mondayOf(new Date()), slots: [] };
const AUTH_MSGS = {
  cancelado: "Você cancelou a autorização no Discord.",
  state_invalido: "A sessão de login expirou. Tente entrar de novo.",
  config_ausente: "Login indisponível no momento.",
  troca_token: "O Discord recusou o login. Tente de novo.",
  perfil: "Não foi possível ler seu perfil do Discord.",
  erro_interno: "Erro interno ao entrar. Tente de novo.",
};

function mondayOf(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
const dayAt = (i) => { const x = new Date(state.week); x.setDate(x.getDate() + i); return x; };
function el(tag, props = {}, ...kids) {
  const e = Object.assign(document.createElement(tag), props);
  kids.flat().forEach((k) => e.append(k));
  return e;
}
function toast(msg, err) {
  const t = $("#toast");
  t.textContent = msg; t.className = "show" + (err ? " err" : "");
  clearTimeout(toast.id); toast.id = setTimeout(() => (t.className = ""), 3500);
}
async function api(path, method = "GET", body) {
  let res;
  try {
    res = await fetch("/api" + path, {
      method, headers: body ? { "Content-Type": "application/json" } : {},
      body: body && JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error("Sem conexão com o servidor. Verifique a internet e tente de novo."), { status: 0 });
  }
  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && path !== "/me") location.href = "/"; // sessão expirou
    throw Object.assign(
      new Error(data?.error || (res.status >= 500 ? "O servidor falhou. Tente novamente em instantes." : "Erro inesperado.")),
      { status: res.status });
  }
  return data;
}
async function act(fn, okMsg, btn) {
  const d = $("#dlg");
  if (btn) btn.disabled = true;
  try {
    await fn();
    if (d.open) d.close();
    if (okMsg) toast(okMsg);
  } catch (e) {
    if (btn) btn.disabled = false;
    if (d.open && e.status !== 409) { // erro recuperável: mantém o diálogo e o texto digitado
      let p = d.querySelector(".error");
      if (!p) {
        p = el("p", { className: "error" });
        p.setAttribute("role", "alert");
        d.querySelector(".actions").before(p);
      }
      p.textContent = e.message;
      return;
    }
    if (d.open) d.close();
    toast(e.message, true); // 409: o horário mudou, fecha e atualiza a grade
  }
  await refresh().catch(() => {});
  if (document.activeElement === document.body) $(".scroll").focus();
}

/* ---------- modal ---------- */
function modal(title, body, ...buttons) {
  const d = $("#dlg");
  d.setAttribute("aria-labelledby", "dlgTitle");
  d.replaceChildren(
    el("h3", { id: "dlgTitle", textContent: title }), ...[].concat(body),
    el("div", { className: "actions" }, el("button", { textContent: "Fechar", onclick: () => d.close() }), ...buttons)
  );
  d.showModal();
}
function bookDialog(s) {
  const ta = el("textarea", { maxLength: 300, placeholder: "Ex.: dúvida sobre recursão na lista 3" });
  modal(`Reservar ${fmtD(s.start)}, ${fmtT(s.start)}–${fmtT(s.end)}`,
    [el("p", { textContent: `Monitor: ${s.monitor.name}` }), el("label", {}, "Tema da dúvida", ta)],
    el("button", { className: "primary", textContent: "Confirmar reserva",
      onclick: (ev) => act(() => api("/bookings", "POST", { slot_id: s.id, topic: ta.value }), "Horário reservado.", ev.currentTarget) }));
}
function manageDialog(s) {
  const own = s.monitor.id === state.me.id;
  const body = [];
  if (s.student) body.push(el("p", { textContent: `Aluno: ${s.student}` }));
  body.push(el("p", { textContent: s.booked ? `Tema: ${s.topic}` : "Este horário está livre." }));
  const btns = [];
  if (s.booked) btns.push(el("button", { className: "danger", textContent: "Cancelar agendamento",
    onclick: (ev) => act(() => api("/bookings/" + s.booking_id, "DELETE"), "Agendamento cancelado.", ev.currentTarget) }));
  if (own) btns.push(el("button", { className: "danger", textContent: "Remover horário",
    onclick: (ev) => act(() => api("/slots/" + s.id, "DELETE"), "Horário removido.", ev.currentTarget) }));
  modal(`${fmtD(s.start)}, ${fmtT(s.start)}–${fmtT(s.end)}`, body, ...btns);
}

/* ---------- grade ---------- */
function chip(s) {
  const own = s.monitor.id === state.me.id;
  const cls = s.mine ? "mine" : s.booked ? "taken" : "free";
  const status = s.mine ? "reservado por você" : s.booked ? "ocupado" : "livre";
  let label;
  if (state.mode === "monitor") label = s.booked ? `Reservado · ${s.student}` : "Livre";
  else label = own ? "Seu horário" : `${s.monitor.name} · ${s.mine ? "Seu" : s.booked ? "Ocupado" : "Livre"}`;

  const b = el("button", { className: "slot " + cls }, `${fmtT(s.start)}–${fmtT(s.end)}`, el("small", { textContent: label }));
  b.setAttribute("aria-label", `${fmtD(s.start)}, ${fmtT(s.start)} às ${fmtT(s.end)}, ${s.monitor.name}, ${status}`);
  if (s.start <= Date.now()) { b.disabled = true; b.style.opacity = 0.5; return b; }

  if (state.mode === "monitor" && own) b.onclick = () => manageDialog(s);
  else if (state.mode === "aluno" && s.mine) b.onclick = () => manageDialog(s);
  else if (state.mode === "aluno" && !s.booked && !own) b.onclick = () => bookDialog(s);
  else b.disabled = true;
  return b;
}
function render() {
  const g = $("#grid");
  const days = [...Array(7)].map((_, i) => dayAt(i));
  const opt = { day: "2-digit", month: "short" };
  $("#range").textContent = `${days[0].toLocaleDateString("pt-BR", opt)} – ${days[6].toLocaleDateString("pt-BR", { ...opt, year: "numeric" })}`;
  const visible = state.slots.filter((s) => state.mode === "aluno" || s.monitor.id === state.me.id);
  const today = new Date().toDateString();

  g.replaceChildren(el("div", { className: "h" }),
    ...days.map((d) => el("div", { className: "h" + (d.toDateString() === today ? " today" : ""), textContent: fmtD(d.getTime()) })));
  for (let h = H0; h < H1; h++) {
    g.append(el("div", { className: "t", textContent: String(h).padStart(2, "0") + "h" }));
    days.forEach((d) => {
      const from = new Date(d).setHours(h, 0, 0, 0), to = from + 36e5;
      const cell = el("div");
      visible.filter((s) => s.start >= from && s.start < to).forEach((s) => cell.append(chip(s)));
      g.append(cell);
    });
  }
  const em = $("#empty");
  em.hidden = visible.length > 0;
  em.textContent = state.mode === "monitor"
    ? "Nenhum horário aberto nesta semana. Use o formulário acima."
    : "Nenhum horário disponível nesta semana. Tente a próxima semana (›).";
}


async function refresh() {
  const seq = ++refresh.seq, from = state.week.getTime(), to = dayAt(7).getTime();
  const [{ slots }, { bookings }] = await Promise.all([api(`/slots?from=${from}&to=${to}`), api("/bookings")]);
  if (seq !== refresh.seq) return; // resposta antiga: ignora
  const sig = JSON.stringify([from, state.mode, slots, bookings]);
  if (sig === refresh.sig) return; // nada mudou: não refaz a tela
  refresh.sig = sig;
  state.slots = slots;
  render();
  $("#mine").hidden = state.mode !== "aluno";
  $("#mineList").replaceChildren(...(bookings.length
    ? bookings.map((b) => {
        const when = `${fmtD(b.start_ts)} às ${fmtT(b.start_ts)} com ${b.monitor_name}`;
        const btn = el("button", { className: "danger", textContent: "Cancelar",
          onclick: (ev) => act(() => api("/bookings/" + b.id, "DELETE"), "Agendamento cancelado.", ev.currentTarget) });
        btn.setAttribute("aria-label", "Cancelar atendimento de " + when);
        return el("li", {}, el("span", { textContent: `${fmtD(b.start_ts)}, ${fmtT(b.start_ts)} · ${b.monitor_name} · ${b.topic}` }), btn);
      })
    : [el("li", { textContent: "Você ainda não tem reservas futuras." })]));
}
refresh.seq = 0; refresh.sig = "";

/* ---------- eventos ---------- */
function setMode(m) {
  state.mode = m;
  $("#tab-aluno").setAttribute("aria-pressed", m === "aluno");
  $("#tab-monitor").setAttribute("aria-pressed", m === "monitor");
  $("#windowForm").hidden = m !== "monitor";
  refresh().catch((e) => toast(e.message, true));
}
function shiftWeek(n) {
  const d = new Date(state.week); d.setDate(d.getDate() + 7 * n);
  state.week = d; refresh().catch((e) => toast(e.message, true));
}
$("#tab-aluno").onclick = () => setMode("aluno");
$("#tab-monitor").onclick = () => setMode("monitor");
$("#prev").onclick = () => shiftWeek(-1);
$("#next").onclick = () => shiftWeek(1);
$("#today").onclick = () => { state.week = mondayOf(new Date()); refresh().catch(() => {}); };
$("#windowForm").onsubmit = (e) => {
  e.preventDefault();
  const at = (t) => new Date(`${$("#wDate").value}T${t}`).getTime();
  const s = at($("#wStart").value), f = at($("#wEnd").value);
  if (!(f > s)) return toast("O horário final deve ser depois do inicial.", true);
  if (s <= Date.now()) return toast("Escolha um horário no futuro.", true);
  act(async () => {
    await api("/slots", "POST", { start: s, end: f });
    state.week = mondayOf(new Date(s)); // leva o monitor à semana que acabou de abrir
  }, "Horários disponibilizados.");
};

/* ---------- início ---------- */
(async function init() {
  const code = new URLSearchParams(location.search).get("auth_error");
  let user = null, netErr = null;
  try { ({ user } = await api("/me")); } catch (e) { netErr = e.message; }
  if (!user) {
    $("#login").hidden = false;
    const msg = netErr || (code && (AUTH_MSGS[code] || "Não foi possível entrar. Tente de novo."));
    if (msg) { const p = $("#authError"); p.hidden = false; p.setAttribute("role", "alert"); p.textContent = msg; }
    return;
  }
  state.me = user;
  $("#wDate").min = new Date().toLocaleDateString("sv-SE"); // impede datas passadas
  $("#auth").append(
    ...(/^https:\/\//.test(user.avatar || "") ? [el("img", { src: user.avatar, alt: "", referrerPolicy: "no-referrer" })] : []),
    el("span", { textContent: user.name }),
    el("button", { textContent: "Sair", onclick: async () => { await api("/auth/logout", "POST").catch(() => {}); location.href = "/"; } })
  );
  $("#app").hidden = false;
  const em = $("#empty"); em.hidden = false; em.textContent = "Carregando horários…";
  await refresh().catch((e) => { toast(e.message, true); em.textContent = "Não foi possível carregar os horários."; });
  setInterval(() => {
    if (!document.hidden && !$("#dlg").open && !$("#grid").contains(document.activeElement)) refresh().catch(() => {});
  }, 20000); // mantém a grade atualizada
})();