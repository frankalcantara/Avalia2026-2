const $ = (s) => document.querySelector(s);
const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x !== undefined) e.textContent = x; return e; };
const SHIPS = [["Porta-aviões", 5], ["Encouraçado", 4], ["Cruzador", 3], ["Submarino", 3], ["Destroyer", 2]];
const SIZE = Object.fromEntries(SHIPS);
const app = $("#app");
let fleet = [], sel = 0, orient = "H", gameId = null;

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {});
  const d = await r.json().catch(() => null);
  if (d === null) throw new Error("Resposta inválida do servidor: a API pode não estar publicada");
  if (!r.ok) throw new Error(d.erro || "Erro " + r.status);
  return d;
}
const cellsOf = (s) => Array.from({ length: SIZE[s.name] }, (_, i) => [s.r + (s.o === "V" ? i : 0), s.c + (s.o === "H" ? i : 0)]);

function board(onClick, onHover) {
  const root = el("div", "board"), cells = [];
  for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) {
    const b = el("button", "cell");
    b.type = "button";
    b.setAttribute("aria-label", `Linha ${r + 1}, coluna ${c + 1}`);
    if (onClick) b.onclick = () => onClick(r, c);
    if (onHover) { b.onmouseenter = b.onfocus = () => onHover(r, c); b.onmouseleave = b.onblur = () => onHover(-1, -1); }
    cells.push(b); root.append(b);
  }
  return { root, at: (r, c) => cells[r * 10 + c], cells };
}

function avatar(u) {
  const i = el("img"); i.alt = "";
  i.src = u.avatar ? `https://cdn.discordapp.com/avatars/${u.discord_id}/${u.avatar}.png?size=64` : "https://cdn.discordapp.com/embed/avatars/0.png";
  return i;
}

function login() {
  app.replaceChildren();
  const box = el("div", "center");
  const a = el("a"); a.href = "/api/auth/login";
  a.append(el("button", "primary", "Entrar com Discord"));
  box.append(el("h2", null, "Comande sua frota"), el("p", null, "Entre com o Discord para jogar e entrar no placar."), a);
  app.append(box);
}

function placing() {
  app.replaceChildren();
  const msg = el("p", "msg");
  const list = el("div", "ships");
  const ok = el("button", "primary", "Confirmar frota");
  const rot = el("button", null, "Girar: horizontal");
  const bd = board(click, hover);
  const draw = () => {
    bd.cells.forEach((c) => { c.className = "cell"; });
    fleet.forEach((s) => cellsOf(s).forEach(([r, c]) => bd.at(r, c).classList.add("ship")));
    list.replaceChildren();
    SHIPS.forEach(([n, z], i) => {
      const b = el("button", fleet.some((s) => s.name === n) ? "done" : "", `${n} (${z})`);
      b.setAttribute("aria-pressed", i === sel); b.onclick = () => { sel = i; draw(); };
      list.append(b);
    });
    ok.disabled = fleet.length !== 5;
  };
  const fits = (name, r, c) => {
    const cs = cellsOf({ name, r, c, o: orient });
    const used = new Set(fleet.filter((s) => s.name !== name).flatMap(cellsOf).map(([a, b]) => a * 10 + b));
    return { cs, valid: cs.every(([a, b]) => a < 10 && b < 10 && !used.has(a * 10 + b)) };
  };
  function hover(r, c) {
    draw();
    if (r < 0) return;
    const { cs, valid } = fits(SHIPS[sel][0], r, c);
    cs.forEach(([a, b]) => { if (a < 10 && b < 10) bd.at(a, b).classList.add("prev", ...(valid ? [] : ["bad"])); });
  }
  function click(r, c) {
    const name = SHIPS[sel][0];
    if (!fits(name, r, c).valid) { msg.className = "msg err"; msg.textContent = "Posição inválida: o navio sai da malha ou sobrepõe outro."; return; }
    msg.className = "msg"; msg.textContent = "";
    fleet = fleet.filter((s) => s.name !== name).concat({ name, r, c, o: orient });
    const next = SHIPS.findIndex(([n]) => !fleet.some((s) => s.name === n));
    if (next >= 0) sel = next;
    draw();
  }
  const flip = () => { orient = orient === "H" ? "V" : "H"; rot.textContent = "Girar: " + (orient === "H" ? "horizontal" : "vertical"); };
  rot.onclick = flip;
  document.onkeydown = (e) => { if (e.key.toLowerCase() === "r" && $(".board")) flip(); };
  ok.onclick = async () => {
    try { ok.disabled = true; await api("/api/game/place", { gameId, ships: fleet }); combat(); }
    catch (e) { msg.className = "msg err"; msg.textContent = e.message; ok.disabled = false; }
  };
  const side = el("div", "panel"), row = el("div", "row");
  row.append(rot, ok);
  side.append(el("h2", null, "Posicione sua frota"), el("p", null, "Escolha um navio, gire com o botão ou a tecla R e clique na malha."), list, row, msg);
  app.append(side, bd.root);
  draw();
}

function combat() {
  app.replaceChildren();
  document.onkeydown = null;
  const mine = board(), foe = board(fire);
  fleet.forEach((s) => cellsOf(s).forEach(([r, c]) => mine.at(r, c).classList.add("ship")));
  const status = el("p", "msg", "Sua vez: escolha uma coordenada no mar inimigo.");
  const log = el("ol", "log");
  let busy = false, done = false;
  const note = (t) => log.prepend(el("li", null, t));
  const label = (x) => (x.result === "afundado" ? `afundou o ${x.ship}!` : x.result === "acerto" ? "acertou um navio." : "acertou a água.");
  async function fire(r, c) {
    if (busy || done || foe.at(r, c).classList.length > 1) return;
    busy = true;
    try {
      const d = await api("/api/game/fire", { gameId, r, c });
      foe.at(d.r, d.c).classList.add(d.result);
      note(`Você ${label(d)}`);
      if (d.enemy) { mine.at(d.enemy.r, d.enemy.c).classList.add(d.enemy.result); note(`Inimigo ${label(d.enemy)}`); }
      status.className = "msg";
      if (d.over) { done = true; end(d.winner === "player"); }
    } catch (e) { status.className = "msg err"; status.textContent = e.message; }
    busy = false;
  }
  async function end(win) {
    status.textContent = win ? "Vitória! A frota inimiga foi afundada." : "Derrota. Sua frota foi afundada.";
    const again = el("button", "primary", "Jogar novamente");
    again.onclick = start;
    const rank = el("ol", "rank");
    try { (await api("/api/scores")).forEach((p) => { const li = el("li"); li.append(avatar(p), `${p.username}: ${p.wins} vitórias, ${p.losses} derrotas`); rank.append(li); }); } catch {}
    const p = el("div", "panel");
    p.append(el("h3", null, "Placar geral"), rank, again);
    app.append(p);
  }
  const a = el("div"), b = el("div"), grid = el("div", "boards");
  a.append(el("h3", null, "Sua frota"), mine.root);
  b.append(el("h3", null, "Mar inimigo"), foe.root);
  grid.append(a, b);
  app.append(status, grid, log);
}

async function start() {
  fleet = []; sel = 0;
  gameId = (await api("/api/game/new", {})).gameId;
  placing();
}

(async () => {
  try {
    const u = await api("/api/me");
    const box = $("#user"), out = el("button", null, "Sair");
    out.onclick = async () => { await api("/api/auth/logout", {}); location.reload(); };
    box.append(avatar(u), u.username, out);
    await start();
  } catch { login(); }
})();