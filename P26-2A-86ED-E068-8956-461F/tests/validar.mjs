import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { idValido, limparTexto, validarRota, escaparLike } from "../functions/_lib/validacao.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const HASH = "P26-2A-86ED-E068-8956-461F";
const base = (process.argv[2] || process.env.URL_BASE || "").replace(/\/$/, "");

let total = 0;
let falhas = 0;

async function teste(nome, funcao) {
  total++;
  try {
    await funcao();
    console.log(`  ok    ${nome}`);
  } catch (falha) {
    falhas++;
    console.log(`  FALHA ${nome}\n        ${falha.message}`);
  }
}

function afirmar(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function ler(caminho) {
  const completo = join(raiz, caminho);
  afirmar(existsSync(completo), `arquivo ausente: ${caminho}`);
  return readFileSync(completo, "utf8");
}

console.log("\nVerificações de arquivos e requisitos");
await teste("README.md contém a Chave Única", () => afirmar(ler("README.md").includes(HASH), "chave ausente no README"));
await teste("Rodapé da interface contém a Chave Única", () => {
  const html = ler("public/index.html");
  afirmar(/<footer[\s\S]*P26-2A-86ED-E068-8956-461F[\s\S]*<\/footer>/.test(html), "chave ausente no <footer>");
});
await teste("LICENSE é MIT", () => afirmar(/MIT License/.test(ler("LICENSE")), "LICENSE não é MIT"));
await teste("package.json declara licença MIT", () => afirmar(JSON.parse(ler("package.json")).license === "MIT", "license != MIT"));
await teste("schema.sql tem as 4 tabelas, CHECK e UNIQUE", () => {
  const sql = ler("schema.sql");
  for (const tabela of ["usuarios", "sessoes", "rotas", "reservas"]) afirmar(sql.includes(`CREATE TABLE IF NOT EXISTS ${tabela}`), `tabela ${tabela} ausente`);
  afirmar(sql.includes("CHECK (vagas_livres >= 0"), "CHECK de vagas ausente");
  afirmar(sql.includes("UNIQUE (rota_id, passageiro_id)"), "UNIQUE de reserva ausente");
});
await teste("Funções do backend existem", () => {
  for (const arq of ["functions/api/auth/login.js", "functions/api/auth/callback.js", "functions/api/auth/logout.js", "functions/api/me.js", "functions/api/rotas/index.js", "functions/api/rotas/[id]/reservar.js", "functions/api/minhas-rotas.js", "functions/api/minhas-reservas.js", "functions/api/_middleware.js"]) ler(arq);
});
await teste("Reserva usa batch transacional", () => afirmar(ler("functions/api/rotas/[id]/reservar.js").includes("db.batch(["), "batch ausente"));
await teste("Login usa escopo identify do Discord", () => afirmar(ler("functions/api/auth/login.js").includes('scope: "identify"'), "escopo ausente"));
await teste("Interface sem frameworks de UI", () => {
  const proibidos = /\b(react|vue|angular|svelte|jquery|bootstrap|tailwind)\b/i;
  for (const arq of ["public/index.html", "public/app.js", "public/style.css"]) afirmar(!proibidos.test(ler(arq)), `framework citado em ${arq}`);
});
await teste("Interface não usa innerHTML", () => afirmar(!ler("public/app.js").includes("innerHTML"), "innerHTML encontrado"));
await teste("Há 3 ou mais agentes, incluindo um de teste e validação", () => {
  const agentes = readdirSync(join(raiz, ".claude/agents")).filter((f) => f.endsWith(".md"));
  afirmar(agentes.length >= 3, `apenas ${agentes.length} agente(s)`);
  afirmar(agentes.some((f) => /test|valid/i.test(f)), "nenhum agente de teste/validação");
});
await teste("Cada agente referencia skills que existem", () => {
  for (const arq of readdirSync(join(raiz, ".claude/agents"))) {
    const linha = ler(`.claude/agents/${arq}`).match(/^skills:\s*(.+)$/m);
    afirmar(linha, `${arq} sem skills`);
    for (const skill of linha[1].split(",").map((s) => s.trim())) ler(`.claude/skills/${skill}/SKILL.md`);
  }
});
await teste("AGENTES.md documenta agentes e harness", () => {
  const texto = ler("AGENTES.md");
  afirmar(/harness/i.test(texto), "harness não citado");
  for (const nome of ["arquiteto-backend", "construtor-frontend", "testador-validador"]) afirmar(texto.includes(nome), `${nome} não documentado`);
});

console.log("\nRegras de validação (unitários)");
const futuro = new Date("2026-11-10T12:00:00-03:00");
const rotaBoa = { origem: "Água Verde", destino: "Campus", data: "2026-11-11", horario: "07:30", vagas: 3 };
await teste("rota válida é aceita", () => afirmar(validarRota(rotaBoa, futuro).ok, "rota boa recusada"));
await teste("origem igual ao destino é recusada", () => afirmar(!validarRota({ ...rotaBoa, destino: "água verde" }, futuro).ok, "aceitou"));
await teste("horário no passado é recusado", () => afirmar(!validarRota({ ...rotaBoa, data: "2026-11-10", horario: "08:00" }, futuro).ok, "aceitou"));
await teste("data inexistente é recusada", () => afirmar(!validarRota({ ...rotaBoa, data: "2026-02-30" }, futuro).ok, "aceitou"));
await teste("horário inválido é recusado", () => afirmar(!validarRota({ ...rotaBoa, horario: "25:99" }, futuro).ok, "aceitou"));
await teste("vagas fora de 1 a 8 são recusadas", () => {
  for (const vagas of [0, 9, -1, 2.5, "x", null]) afirmar(!validarRota({ ...rotaBoa, vagas }, futuro).ok, `aceitou vagas=${vagas}`);
});
await teste("data a mais de 60 dias é recusada", () => afirmar(!validarRota({ ...rotaBoa, data: "2027-03-01" }, futuro).ok, "aceitou"));
await teste("corpo vazio ou de tipo errado é recusado", () => {
  afirmar(!validarRota({}, futuro).ok, "aceitou {}");
  afirmar(!validarRota(null, futuro).ok, "aceitou null");
  afirmar(!validarRota({ origem: 123, destino: ["x"], data: 1, horario: 2, vagas: "3" }, futuro).ok, "aceitou tipos errados");
});
await teste("idValido só aceita inteiros positivos", () => {
  afirmar(idValido("12") === 12, "12");
  for (const v of ["0", "-1", "abc", "1.5", "1; DROP TABLE rotas"]) afirmar(idValido(v) === null, `aceitou ${v}`);
});
await teste("limparTexto e escaparLike", () => {
  afirmar(limparTexto("  Água   Verde ", 2, 60) === "Água Verde", "normalização");
  afirmar(limparTexto("a", 2, 60) === null, "mínimo");
  afirmar(escaparLike("50%_x") === "50\\%\\_x", "escape");
});

if (base) {
  console.log(`\nTestes online em ${base}`);
  await teste("página inicial abre e mostra a Chave Única", async () => {
    const r = await fetch(`${base}/`);
    afirmar(r.status === 200, `status ${r.status}`);
    afirmar((await r.text()).includes(HASH), "chave ausente na página");
  });
  await teste("style.css e app.js são servidos", async () => {
    for (const caminho of ["/style.css", "/app.js"]) afirmar((await fetch(`${base}${caminho}`)).status === 200, `${caminho} não abriu`);
  });
  for (const caminho of ["/api/me", "/api/rotas", "/api/minhas-rotas", "/api/minhas-reservas"]) {
    await teste(`GET ${caminho} sem login responde 401`, async () => {
      const r = await fetch(`${base}${caminho}`);
      afirmar(r.status === 401, `status ${r.status}`);
    });
  }
  await teste("POST /api/rotas sem login responde 401", async () => {
    const r = await fetch(`${base}/api/rotas`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    afirmar(r.status === 401, `status ${r.status}`);
  });
  await teste("POST /api/rotas/1/reservar sem login responde 401", async () => {
    const r = await fetch(`${base}/api/rotas/1/reservar`, { method: "POST" });
    afirmar(r.status === 401, `status ${r.status}`);
  });
  await teste("POST de outra origem responde 403", async () => {
    const r = await fetch(`${base}/api/rotas`, { method: "POST", headers: { origin: "https://site-malicioso.example", "content-type": "application/json" }, body: "{}" });
    afirmar(r.status === 403, `status ${r.status}`);
  });
  await teste("login redireciona ao Discord com scope identify e state", async () => {
    const r = await fetch(`${base}/api/auth/login`, { redirect: "manual" });
    afirmar(r.status === 302, `status ${r.status}`);
    const destino = new URL(r.headers.get("location"));
    afirmar(destino.origin === "https://discord.com" && destino.pathname === "/oauth2/authorize", `destino ${destino.href}`);
    afirmar(destino.searchParams.get("scope") === "identify", "scope");
    afirmar(destino.searchParams.get("state")?.length >= 32, "state");
    afirmar(destino.searchParams.get("redirect_uri") === `${base}/api/auth/callback`, "redirect_uri diferente do cadastrado");
    afirmar(/oauth_state=/.test(r.headers.get("set-cookie") || ""), "cookie de state ausente");
  });
  await teste("callback com state inválido volta ao início com erro", async () => {
    const r = await fetch(`${base}/api/auth/callback?code=x&state=y`, { redirect: "manual" });
    afirmar(r.status === 302 && /erro=/.test(r.headers.get("location") || ""), `status ${r.status}`);
  });
} else {
  console.log("\n(testes online pulados: passe a URL do site como argumento)");
}

console.log(`\n${total - falhas} de ${total} verificações passaram.`);
if (falhas > 0) process.exit(1);
