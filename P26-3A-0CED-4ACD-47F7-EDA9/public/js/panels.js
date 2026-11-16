// Painéis: resultado, estatísticas, cofres antigos, ranking, configurações e ajuda

import { Api } from "./api.js";
import { el, openSheet, closeSheet, spinner, segmented, toast, avatarImg, formatDayMonth, formatLongDate } from "./ui.js";
import { shareText, shareResult } from "./share.js";

const MODE_LABEL = { classico: "Clássico", sombra: "Sombra" };
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

function errorBox(err) {
  return el("div", { class: "empty" }, el("strong", { text: "Não deu pra carregar agora." }), err.message);
}

// ---------- Contagem regressiva até a meia-noite de Brasília (UTC-3) ----------
export function msToNextCipher() {
  const day = 86400000;
  const brt = Date.now() - 3 * 3600000;
  return day - (brt % day);
}
function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n) => String(n).padStart(2, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// ---------- Estatísticas ----------
function statsBlock(stats, highlight) {
  const grid = el("div", { class: "stats-grid" },
    el("div", { class: "stat" }, el("b", { text: stats.played }), el("span", { text: "jogos" })),
    el("div", { class: "stat" }, el("b", { text: `${stats.winRate}%` }), el("span", { text: "vitórias" })),
    el("div", { class: "stat" }, el("b", { text: stats.currentStreak }), el("span", { text: "sequência atual" })),
    el("div", { class: "stat" }, el("b", { text: stats.maxStreak }), el("span", { text: "maior sequência" })));
  const max = Math.max(1, ...stats.distribution);
  const dist = el("div", { class: "dist", role: "list", "aria-label": "Distribuição de tentativas" });
  stats.distribution.forEach((n, i) => {
    const bar = el("div", { class: `dist__bar${highlight === i + 1 ? " is-hit" : ""}`, style: `width:${Math.max(8, (n / max) * 100)}%`, text: n });
    dist.append(el("div", { class: "dist__row", role: "listitem", "aria-label": `${i + 1} tentativas: ${n}` }, el("span", { text: i + 1 }), bar));
  });
  const arch = el("p", { class: "note", text: `Cofres antigos: ${stats.archive.played} ${stats.archive.played === 1 ? "jogado" : "jogados"}, ${stats.archive.wins} ${stats.archive.wins === 1 ? "aberto" : "abertos"}. Eles não contam para a sequência nem para o ranking.` });
  return [grid, el("h3", { text: "Distribuição de tentativas" }), dist, arch];
}

export function openStats(ctx, initialMode = "classico") {
  const holder = el("div", { class: "sheet-section" });
  const load = async (mode) => {
    holder.replaceChildren(spinner());
    try {
      const stats = await Api.stats(mode);
      holder.replaceChildren(...statsBlock(stats));
    } catch (err) {
      if (ctx.onAuthError(err)) return;
      holder.replaceChildren(errorBox(err));
    }
  };
  const seg = segmented([{ value: "classico", label: "Clássico" }, { value: "sombra", label: "Sombra" }], initialMode, load, "Modo");
  openSheet("Estatísticas", [seg, holder]);
  load(initialMode);
}

// ---------- Resultado ----------
export async function openResult(ctx, game) {
  const won = game.status === "won";
  const isChallenge = game.mode === "desafio";
  const answer = (game.answer || "").toUpperCase();
  const word = el("div", { class: "result-word", "aria-label": `A palavra era ${answer}` },
    ...[...answer].map((ch) => el("span", { class: `tile ${won ? "tile--correct" : "tile--absent"}`, text: ch })));
  const title = el("p", { class: "result-title", text: won
    ? (game.attempts.length === 1 ? "Abriu de primeira. Inacreditável." : `Você abriu o cofre em ${game.attempts.length} ${game.attempts.length === 1 ? "tentativa" : "tentativas"}.`)
    : "O cofre ficou lacrado. A palavra era:" });

  const shareBtn = el("button", { type: "button", class: "btn btn--brass", text: "Compartilhar", onclick: async () => {
    const text = shareText({ mode: game.mode, date: isChallenge ? null : game.date, status: game.status, attempts: game.attempts, maxAttempts: game.maxAttempts, colorblind: ctx.colorblind() });
    const r = await shareResult(text);
    if (r === "copied") toast("Resultado copiado. Cole no Discord.");
    else if (r === "failed") toast("Não deu pra copiar. Tente de novo.");
  } });

  const parts = [title, word];
  const statsHolder = el("div");
  if (!isChallenge) {
    if (game.isArchive) parts.push(el("p", { class: "note", text: `Cofre antigo de ${formatLongDate(game.date)}. Não contou para a sequência nem para o ranking.` }));
    parts.push(statsHolder);
  }
  parts.push(el("div", { class: "actions" }, shareBtn,
    isChallenge ? null : el("button", { type: "button", class: "btn btn--ghost", text: "Cofres antigos", onclick: () => openVaults(ctx, game.mode) })));

  if (!isChallenge && game.isToday) {
    const count = el("b", { text: fmtCountdown(msToNextCipher()) });
    parts.push(el("div", { class: "countdown" }, count, el("span", { text: "até a próxima cifra" })));
    const timer = setInterval(() => {
      if (!document.body.contains(count)) return clearInterval(timer);
      const ms = msToNextCipher();
      count.textContent = fmtCountdown(ms);
    }, 1000);
  }

  openSheet(won ? "Cofre aberto" : "Cofre lacrado", parts);

  if (!isChallenge) {
    statsHolder.append(spinner());
    try {
      const stats = await Api.stats(game.mode);
      statsHolder.replaceChildren(...statsBlock(stats, won ? game.attempts.length : null));
    } catch (err) {
      statsHolder.replaceChildren();
    }
  }
}

// ---------- Cofres antigos ----------
const VAULT_STATUS = {
  won: { cls: "cal-day--won", label: "Aberto", mark: "aberto" },
  lost: { cls: "cal-day--lost", label: "Lacrado", mark: "lacrado" },
  playing: { cls: "cal-day--playing", label: "Em andamento", mark: "jogando" },
  untouched: { cls: "", label: "Intacto", mark: "" },
};

function calendar(ctx, data, mode) {
  const byDate = new Map(data.days.map((d) => [d.date, d]));
  const [ly, lm] = data.launchDate.split("-").map(Number);
  const [ty, tm] = data.today.split("-").map(Number);
  const out = [];
  let y = ty, m = tm;
  while (y > ly || (y === ly && m >= lm)) {
    const first = new Date(Date.UTC(y, m - 1, 1));
    const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const grid = el("div", { class: "cal-grid" });
    ["D", "S", "T", "Q", "Q", "S", "S"].forEach((d) => grid.append(el("div", { class: "cal-dow", "aria-hidden": "true", text: d })));
    for (let i = 0; i < first.getUTCDay(); i++) grid.append(el("div", { class: "cal-day cal-day--empty", "aria-hidden": "true" }));
    for (let d = 1; d <= daysIn; d++) {
      const iso = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const info = byDate.get(iso);
      if (!info) {
        const future = iso > data.today;
        grid.append(el("div", { class: "cal-day cal-day--locked", "aria-label": `${d}: ${future ? "ainda trancado" : "antes do lançamento"}` }, String(d)));
        continue;
      }
      const st = VAULT_STATUS[info.status] || VAULT_STATUS.untouched;
      const btn = el("button", {
        type: "button",
        class: `cal-day ${st.cls}${iso === data.today ? " cal-day--today" : ""}`,
        "aria-label": `${d} de ${MONTHS[m - 1]}: ${st.label}${iso === data.today ? ", hoje" : ""}`,
        onclick: () => {
          closeSheet();
          ctx.navigate({ mode, date: iso === data.today ? null : iso });
        },
      }, String(d));
      grid.append(btn);
    }
    out.push(el("div", { class: "cal-month" }, el("h3", { text: `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} de ${y}` }), grid));
    m--;
    if (m === 0) { m = 12; y--; }
  }
  return out;
}

export function openVaults(ctx, initialMode = "classico") {
  const holder = el("div", { class: "sheet-section" });
  const load = async (mode) => {
    holder.replaceChildren(spinner());
    try {
      const data = await Api.vaults(mode);
      const won = data.days.filter((d) => d.status === "won").length;
      holder.replaceChildren(
        el("p", { class: "note", text: `${won} de ${data.days.length} cofres abertos no modo ${MODE_LABEL[mode]}. Toque em um dia para jogar.` }),
        ...calendar(ctx, data, mode),
        el("div", { class: "legend" },
          el("span", {}, el("i", { class: "l-won" }), "Aberto"),
          el("span", {}, el("i", { class: "l-lost" }), "Lacrado"),
          el("span", {}, el("i", { class: "l-playing" }), "Em andamento"),
          el("span", {}, el("i"), "Intacto")));
    } catch (err) {
      if (ctx.onAuthError(err)) return;
      holder.replaceChildren(errorBox(err));
    }
  };
  const seg = segmented([{ value: "classico", label: "Clássico" }, { value: "sombra", label: "Sombra" }], initialMode, load, "Modo");
  openSheet("Cofres antigos", [el("p", { text: "Jogue as cifras dos dias que você perdeu. Elas contam nas suas estatísticas, mas não na sequência nem no ranking." }), seg, holder]);
  load(initialMode);
}

// ---------- Ranking ----------
export function openRanking(ctx) {
  const st = { mode: "classico", scope: "global", guild: "", sort: "wins" };
  const holder = el("div");
  const scopeSel = el("select", { class: "select", "aria-label": "Onde comparar" },
    el("option", { value: "", text: "Global: todos os jogadores" }),
    ...(ctx.me.guilds || []).map((g) => el("option", { value: g.id, text: `Servidor: ${g.name}` })));
  scopeSel.addEventListener("change", () => {
    st.guild = scopeSel.value;
    st.scope = st.guild ? "guild" : "global";
    load();
  });

  const row = (e) => {
    // avgAttempts é null quando o jogador ainda não tem vitórias
    const metric = st.sort === "streak"
      ? el("div", { class: "rank-metric" }, String(e.currentStreak), el("small", { text: `maior ${e.maxStreak}` }))
      : el("div", { class: "rank-metric" }, String(e.wins), el("small", { text: e.avgAttempts === null ? "média —" : `média ${Number(e.avgAttempts).toFixed(1).replace(".", ",")}` }));
    return el("li", { class: e.isMe ? "is-me" : "" },
      el("span", { class: `rank-pos${e.rank === 1 ? " rank-pos--1" : ""}`, text: e.rank }),
      avatarImg(e.avatar, ""),
      el("div", { class: "grow" }, el("strong", { text: e.username }), el("div", { class: "muted", text: `${e.played} ${e.played === 1 ? "jogo" : "jogos"}${e.isMe ? " · você" : ""}` })),
      metric);
  };

  const load = async () => {
    holder.replaceChildren(spinner());
    try {
      const data = await Api.ranking(st.mode, st.scope, st.guild, st.sort);
      if (!data.entries.length) {
        holder.replaceChildren(el("div", { class: "empty" }, el("strong", { text: "Ninguém no ranking ainda." }),
          st.scope === "guild" ? "Chame o pessoal do servidor para jogar a cifra de hoje." : "Abra o cofre de hoje para aparecer aqui."));
        return;
      }
      const list = el("ol", { class: "list rank-list", "aria-label": "Ranking" }, ...data.entries.map(row));
      if (data.me) list.append(row(data.me));
      holder.replaceChildren(list,
        el("p", { class: "note", text: st.sort === "wins" ? "Ordenado por vitórias; no empate, menor média de tentativas. Só contam cofres do próprio dia." : "Ordenado pela sequência atual de vitórias. Só contam cofres do próprio dia." }));
    } catch (err) {
      if (ctx.onAuthError(err)) return;
      holder.replaceChildren(errorBox(err));
    }
  };

  openSheet("Ranking", [
    segmented([{ value: "classico", label: "Clássico" }, { value: "sombra", label: "Sombra" }], st.mode, (v) => { st.mode = v; load(); }, "Modo"),
    scopeSel,
    segmented([{ value: "wins", label: "Vitórias" }, { value: "streak", label: "Sequência" }], st.sort, (v) => { st.sort = v; load(); }, "Ordenar por"),
    holder,
  ]);
  load();
}

// ---------- Configurações ----------
export function openSettings(ctx) {
  const current = ctx.theme();
  const cb = el("input", { type: "checkbox", role: "switch", "aria-label": "Modo daltônico" });
  cb.checked = ctx.colorblind();
  cb.addEventListener("change", () => ctx.setColorblind(cb.checked));
  openSheet("Configurações", [
    el("h3", { text: "Tema" }),
    segmented([{ value: "system", label: "Sistema" }, { value: "light", label: "Claro" }, { value: "dark", label: "Escuro" }], current, (v) => ctx.setTheme(v), "Tema"),
    el("label", { class: "switch" }, el("span", {}, "Modo daltônico", el("small", { text: "Troca menta e coral por laranja e azul, com marcas nas peças." })), cb),
    el("h3", { text: "Conta" }),
    el("div", { class: "list" }, el("li", {}, avatarImg(ctx.me.user.avatar, ""), el("div", { class: "grow" }, el("strong", { text: ctx.me.user.username }), el("div", { class: "muted", text: "Conectado pelo Discord" })))),
    el("button", { type: "button", class: "btn btn--ghost", text: "Sair da conta", onclick: () => ctx.logout() }),
  ]);
}

// ---------- Como jogar ----------
function helpRow(word, states) {
  return el("div", { class: "help-row", "aria-hidden": "true" }, ...[...word].map((ch, i) => el("span", { class: `tile ${states[i] ? `tile--${states[i]}` : "tile--filled"}`, text: ch })));
}
export function openHelp() {
  openSheet("Como jogar", [el("div", { class: "help" },
    el("p", { text: "Descubra a palavra de cinco letras trancada no cofre. Acentos não precisam ser digitados; eles aparecem no final." }),
    el("h3", { text: "Clássico · 6 tentativas" }),
    helpRow("PRAIA", ["correct", null, null, null, null]),
    el("p", { text: "P está na palavra e no lugar certo." }),
    helpRow("NUVEM", [null, null, "present", null, null]),
    el("p", { text: "V está na palavra, mas em outro lugar." }),
    helpRow("LIVRO", [null, null, null, "absent", null]),
    el("p", { text: "R não está na palavra." }),
    el("h3", { text: "Sombra · 10 tentativas" }),
    el("p", { text: "As letras não ganham cor. Cada linha mostra só quantas letras estão no lugar certo (menta) e quantas estão na palavra mas no lugar errado (coral). Igual ao Mastermind." }),
    el("h3", { text: "Desafio" }),
    el("p", { text: "Escolha uma palavra, gere o link e mande para um amigo. Você vê quantas tentativas cada um precisou." }),
    el("h3", { text: "Cofres antigos" }),
    el("p", { text: "Cada dia desde 1º de novembro tem a sua cifra. Jogue os que você perdeu pelo calendário. Eles não contam para a sequência nem para o ranking." }),
    el("p", { class: "note", text: "Uma cifra nova abre todo dia à meia-noite, horário de Brasília." }))]);
}

export { formatDayMonth };
