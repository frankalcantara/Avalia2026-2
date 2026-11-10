import { formatar, validar, limpar, rotulos, campos } from "./formatar.js";
const $ = (id) => document.getElementById(id);
let tocado = false, logado = false, pasta = null, ultimo = null;

const aviso = (t) => ($("aviso").textContent = t || "");
const envio = (metodo, corpo) => ({ method: metodo, headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
async function api(url, opc) {
  const r = await fetch(url, opc);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "Erro no servidor.");
  return d;
}
function desenhar(el, segs, norma) {
  el.textContent = "";
  segs.forEach(([t, m]) => { const n = document.createElement(m ? (norma === "abnt" ? "strong" : "em") : "span"); n.textContent = t; el.appendChild(n); });
}
async function copiar(el, btn, texto, rotulo) {
  try {
    if (window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([el.innerHTML], { type: "text/html" }), "text/plain": new Blob([texto], { type: "text/plain" }) })]);
    } else { await navigator.clipboard.writeText(texto); }
    btn.textContent = "Copiado!";
  } catch { btn.textContent = "Não foi possível copiar"; }
  setTimeout(() => (btn.textContent = rotulo), 1800);
}
const agir = (fn) => async () => { try { await fn(); } catch (e) { aviso(e.message); } };

function atualizar() {
  const v = { norma: $("norma").value, tipo: $("tipo").value };
  campos.forEach((k) => (v[k] = $(k).value.trim()));
  document.querySelectorAll("[data-for]").forEach((el) => (el.hidden = el.dataset.for !== v.tipo));
  $("lblVeiculo").textContent = rotulos[v.tipo] || "Veículo";
  const p = $("previa");
  p.textContent = "";
  ultimo = null;
  $("copiar").disabled = $("salvar").disabled = true;
  if (!v.norma || !v.tipo) { $("erro").textContent = ""; p.textContent = "Escolha a norma e o tipo para começar."; return; }
  const e = validar(v);
  $("erro").textContent = tocado ? e : "";
  if (e) { p.textContent = "Preencha os campos para ver a referência."; return; }
  ultimo = limpar(v.norma, v.tipo, v);
  desenhar(p, formatar(ultimo), v.norma);
  $("copiar").disabled = false;
  $("salvar").disabled = !(logado && pasta);
}

async function carregarPastas() {
  const { folders } = await api("/api/folders");
  const box = $("pastas");
  box.textContent = folders.length ? "" : "Nenhuma pasta ainda. Crie a primeira acima.";
  if (!folders.some((f) => f.id === pasta)) pasta = folders.length ? folders[0].id : null;
  $("pastaAtiva").textContent = "";
  folders.forEach((f) => {
    const b = document.createElement("button");
    b.className = "chip" + (f.id === pasta ? " on" : "");
    b.textContent = f.name + " (" + f.total + ")";
    b.onclick = agir(async () => { pasta = f.id; await carregarPastas(); });
    box.appendChild(b);
    if (f.id === pasta) $("pastaAtiva").textContent = "“" + f.name + "”";
  });
  $("apagarPasta").hidden = !pasta;
  await carregarRefs();
  atualizar();
}

async function carregarRefs() {
  const ul = $("salvas");
  ul.textContent = "";
  $("compilado").hidden = $("copiarComp").hidden = true;
  $("compilar").disabled = true;
  if (!pasta) return;
  const { refs } = await api("/api/references?folder_id=" + pasta);
  refs.forEach((r) => {
    const li = document.createElement("li"), t = document.createElement("span"), x = document.createElement("button");
    desenhar(t, r.segs, r.norma);
    x.className = "mini"; x.textContent = "Apagar";
    x.onclick = agir(async () => { await api("/api/references?id=" + r.id, { method: "DELETE" }); await carregarPastas(); });
    li.append(t, x);
    ul.appendChild(li);
  });
  $("compilar").disabled = !refs.length;
}

$("criarPasta").onclick = agir(async () => {
  const d = await api("/api/folders", envio("POST", { name: $("novaPasta").value }));
  $("novaPasta").value = ""; pasta = d.id; aviso("Pasta criada.");
  await carregarPastas();
});
$("apagarPasta").onclick = agir(async () => {
  if (!confirm("Apagar a pasta e todas as referências dentro dela?")) return;
  await api("/api/folders?id=" + pasta, { method: "DELETE" });
  pasta = null; aviso("Pasta apagada.");
  await carregarPastas();
});
$("salvar").onclick = agir(async () => {
  await api("/api/references", envio("POST", { folder_id: pasta, norma: ultimo.norma, tipo: ultimo.tipo, dados: ultimo }));
  aviso("Referência salva na pasta.");
  await carregarPastas();
});
$("compilar").onclick = agir(async () => {
  const { refs } = await api("/api/references?folder_id=" + pasta + "&compilar=1");
  const box = $("compilado");
  box.textContent = "";
  refs.forEach((r) => { const p = document.createElement("p"); desenhar(p, r.segs, r.norma); box.appendChild(p); });
  box.hidden = $("copiarComp").hidden = false;
});
$("copiar").onclick = () => copiar($("previa"), $("copiar"), $("previa").textContent, "Copiar referência");
$("copiarComp").onclick = () => copiar($("compilado"), $("copiarComp"), [...$("compilado").children].map((p) => p.textContent).join("\n\n"), "Copiar lista compilada");
document.querySelectorAll("#norma,#tipo,#autor,#titulo,#veiculo,#ano,#local,#vol,#num,#pag,#url,#acesso").forEach((el) => el.addEventListener("input", () => { tocado = true; atualizar(); }));

async function sessao() {
  try {
    const u = (await (await fetch("/api/status")).json()).sessionUser;
    if (!u) return;
    logado = true;
    const box = $("user");
    box.textContent = "";
    if (u.avatar && /^https?:/.test(u.avatar)) { const i = document.createElement("img"); i.src = u.avatar; i.alt = ""; box.appendChild(i); }
    const s = document.createElement("span"); s.textContent = u.username; box.appendChild(s);
    const sair = document.createElement("a"); sair.className = "btn ghost"; sair.href = "/api/auth/logout"; sair.textContent = "Sair"; box.appendChild(sair);
    $("criarPasta").disabled = false;
    await carregarPastas();
  } catch (e) { aviso(e.message); }
}

atualizar();
sessao();
