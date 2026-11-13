// Regras de formatação ABNT/IEEE. Usado pelo navegador e pelo servidor (uma única fonte da verdade).
export const rotulos = { livro: "Editora", artigo: "Periódico", web: "Site ou portal" };
export const campos = ["autor", "titulo", "veiculo", "ano", "local", "vol", "num", "pag", "url", "acesso"];

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

export function limpar(norma, tipo, d = {}) {
  if (!["abnt", "ieee"].includes(norma) || !["livro", "artigo", "web"].includes(tipo)) return null;
  const v = { norma, tipo };
  campos.forEach((k) => (v[k] = String((d && d[k]) ?? "").trim().slice(0, 300)));
  // Campos que não pertencem ao tipo escolhido são descartados (evita texto "escondido" aparecer na referência).
  const usa = { livro: ["local"], artigo: ["vol", "num", "pag"], web: ["url", "acesso"] }[tipo];
  ["local", "vol", "num", "pag", "url", "acesso"].forEach((k) => { if (!usa.includes(k)) v[k] = ""; });
  return v;
}

export function formatar(v) {
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

export function validar(v) {
  if (!v.titulo) return "Informe o título.";
  if (!/^\d{4}$/.test(v.ano)) return "Informe o ano com 4 dígitos.";
  if (v.tipo !== "web" && !v.veiculo) return "Informe o campo " + rotulos[v.tipo].toLowerCase() + ".";
  if (v.tipo === "web" && !/^https?:\/\//.test(v.url)) return "Informe o endereço completo, começando com http.";
  return "";
}

// Ordem alfabética rigorosa: sobrenome do primeiro autor (ou título), sem acentos nem maiúsculas.
export function chaveOrdem(v) {
  const a = parseAutores(v.autor || "")[0];
  return ((a ? a.sur : v.titulo) + " " + v.titulo + " " + v.ano).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
