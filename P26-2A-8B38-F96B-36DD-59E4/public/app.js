const $ = (id) => document.getElementById(id);
const rotulos = { livro: "Editora", artigo: "Periódico", web: "Site ou portal" };
const campos = ["autor", "titulo", "veiculo", "ano", "local", "vol", "num", "pag", "url", "acesso"];
let tocado = false;

function parseAutores(raw) {
  return raw.split(/;|\n/).map((s) => s.trim()).filter(Boolean).map((a) => {
    if (a.includes(",")) { const [s, ...r] = a.split(","); return { sur: s.trim(), giv: r.join(",").trim() }; }
    const p = a.split(/\s+/); const sur = p.pop(); return { sur, giv: p.join(" ") };
  });
}
const fim = (s) => s.replace(/[.\s]+$/, "") + ". ";

function autoresAbnt(l) {
  const f = (a) => (a.giv ? a.sur.toUpperCase() + ", " + a.giv : a.sur.toUpperCase());
  return l.length > 3 ? f(l[0]) + " et al" : l.map(f).join("; ");
}
function autoresIeee(l) {
  const f = (a) => (a.giv ? a.giv.split(/\s+/).map((n) => n[0].toUpperCase() + ".").join(" ") + " " : "") + a.sur;
  if (l.length > 6) return f(l[0]) + " et al.";
  if (l.length <= 2) return l.map(f).join(" and ");
  return l.slice(0, -1).map(f).join(", ") + ", and " + f(l[l.length - 1]);
}

function formatar(v) {
  const l = parseAutores(v.autor), s = [];
  const add = (t, m) => s.push([t, !!m]);
  const art = (pre) => (v.vol ? ", " + pre[0] + " " + v.vol : "") + (v.num ? ", " + pre[1] + " " + v.num : "") + (v.pag ? ", " + pre[2] + " " + v.pag : "");
  if (v.norma === "abnt") {
    if (l.length) add(fim(autoresAbnt(l)));
    if (v.tipo === "livro") { add(v.titulo, 1); add(". " + (v.local || "[s. l.]") + ": " + v.veiculo + ", " + v.ano + "."); }
    if (v.tipo === "artigo") { add(fim(v.titulo)); add(v.veiculo, 1); add((v.local ? ", " + v.local : "") + art(["v.", "n.", "p."]) + ", " + v.ano + "."); }
    if (v.tipo === "web") { add(v.titulo, 1); add(". " + (v.veiculo ? v.veiculo + ", " : "") + v.ano + ". Disponível em: " + v.url + "." + (v.acesso ? " Acesso em: " + v.acesso + "." : "")); }
  } else {
    if (l.length) add(autoresIeee(l) + ", ");
    if (v.tipo === "livro") { add(v.titulo, 1); add(". " + (v.local ? v.local + ": " : "") + v.veiculo + ", " + v.ano + "."); }
    if (v.tipo === "artigo") { add("“" + v.titulo + ",” "); add(v.veiculo, 1); add(art(["vol.", "no.", "pp."]) + ", " + v.ano + "."); }
    if (v.tipo === "web") {
      add("“" + v.titulo + ",” ");
      if (v.veiculo) { add(v.veiculo, 1); add(", "); }
      add(v.ano + ". [Online]. Available: " + v.url + (v.acesso ? " (accessed " + v.acesso + ")." : ""));
    }
  }
  return s;
}

function validar(v) {
  if (!v.titulo) return "Informe o título.";
  if (!/^\d{4}$/.test(v.ano)) return "Informe o ano com 4 dígitos.";
  if (v.tipo !== "web" && !v.veiculo) return "Informe o campo " + rotulos[v.tipo].toLowerCase() + ".";
  if (v.tipo === "web" && !/^https?:\/\//.test(v.url)) return "Informe o endereço completo, começando com http.";
  return "";
}

function atualizar() {
  const v = { norma: $("norma").value, tipo: $("tipo").value };
  campos.forEach((k) => (v[k] = $(k).value.trim()));
  document.querySelectorAll("[data-for]").forEach((el) => (el.hidden = el.dataset.for !== v.tipo));
  $("lblVeiculo").textContent = rotulos[v.tipo] || "Veículo";
  const p = $("previa");
  p.textContent = "";
  $("copiar").disabled = true;
  if (!v.norma || !v.tipo) { $("erro").textContent = ""; p.textContent = "Escolha a norma e o tipo para começar."; return; }
  const e = validar(v);
  $("erro").textContent = tocado ? e : "";
  if (e) { p.textContent = "Preencha os campos para ver a referência."; return; }
  const marca = v.norma === "abnt" ? "strong" : "em";
  formatar(v).forEach(([t, m]) => { const n = document.createElement(m ? marca : "span"); n.textContent = t; p.appendChild(n); });
  $("copiar").disabled = false;
}

$("copiar").addEventListener("click", async () => {
  const p = $("previa"), b = $("copiar");
  try {
    if (window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([p.innerHTML], { type: "text/html" }),
        "text/plain": new Blob([p.textContent], { type: "text/plain" }),
      })]);
    } else { await navigator.clipboard.writeText(p.textContent); }
    b.textContent = "Copiado!";
  } catch { b.textContent = "Não foi possível copiar"; }
  setTimeout(() => (b.textContent = "Copiar referência"), 1800);
});

document.querySelectorAll("input,select").forEach((el) => el.addEventListener("input", () => { tocado = true; atualizar(); }));

async function sessao() {
  try {
    const r = await fetch("/api/status");
    const u = (await r.json()).sessionUser;
    if (!u) return;
    const box = $("user");
    box.textContent = "";
    if (u.avatar && /^https?:/.test(u.avatar)) { const i = document.createElement("img"); i.src = u.avatar; i.alt = ""; box.appendChild(i); }
    const s = document.createElement("span"); s.textContent = u.username; box.appendChild(s);
  } catch { /* sem sessão */ }
}

atualizar();
sessao();
