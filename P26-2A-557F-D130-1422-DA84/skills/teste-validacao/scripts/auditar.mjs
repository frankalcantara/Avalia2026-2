// Uso (dentro da subpasta do projeto): node skills/teste-validacao/scripts/auditar.mjs [url-publicada]
// Só imprime as falhas. Complementa o validar-local.mjs do professor.
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";

const HASH = "P26-2A-557F-D130-1422-DA84";
const url = process.argv[2];
const r = [];
const ok = (nome, cond, obs = "") => r.push({ nome, ok: !!cond, obs });
const ler = (p) => (existsSync(p) ? readFileSync(p, "utf8") : "");
const ls = (p) => (existsSync(p) ? readdirSync(p) : []);

ok("LICENSE é MIT", /MIT License/i.test(ler("LICENSE")));
ok("hash no README", ler("README.md").includes(HASH));
ok("hash no rodapé", /<footer[\s\S]*P26-2A-557F-D130-1422-DA84[\s\S]*<\/footer>/.test(ler("public/index.html")));
const front = ls("public").filter((f) => /\.(html|js)$/.test(f)).map((f) => ler(`public/${f}`)).join("\n");
ok("sem frameworks de UI", !/\b(react|vue|angular|svelte|bootstrap|jquery)\b/i.test(front));
ok("sem innerHTML na interface", !/\.innerHTML\s*=/.test(ler("public/app.js")));
const sql = ls("migrations").map((f) => ler(`migrations/${f}`)).join("\n");
for (const t of ["discord_users", "lists", "list_members", "tasks"])
  ok(`tabela ${t}`, new RegExp(`CREATE TABLE[^;]*\\b${t}\\b`, "i").test(sql));
const skills = ls("skills").filter((d) => existsSync(`skills/${d}/SKILL.md`));
ok("3 ou mais skills", skills.length >= 3, skills.join(", "));
ok("nome da skill = nome da pasta", skills.every((d) => new RegExp(`^name:\\s*${d}\\s*$`, "m").test(ler(`skills/${d}/SKILL.md`))));
ok("AGENTS.md sem pendências (<<PREENCHER)", !ler("AGENTS.md").includes("<<PREENCHER"));
ok("wrangler.jsonc com database_id real", !/0{8}-0{4}-0{4}-0{4}-0{12}/.test(ler("wrangler.jsonc")));

// Toda rota de dados precisa autenticar.
const rotas = [];
const andar = (dir) => ls(dir).forEach((n) => {
  const p = `${dir}/${n}`;
  if (statSync(p).isDirectory()) andar(p); else if (n.endsWith(".js")) rotas.push(p);
});
andar("functions");
const livres = /functions\/api\/(auth\/|status\.js)/;
const semAuth = rotas.filter((p) => !livres.test(p) && !ler(p).includes("autenticar("));
ok("todas as rotas de dados chamam autenticar()", semAuth.length === 0, semAuth.join(", "));
const semMembro = rotas.filter((p) => /lists\/|tasks\//.test(p) && !ler(p).includes("ehMembro(") && !/lists\/(index|join)\.js$/.test(p));
ok("rotas de lista/tarefa checam ehMembro()", semMembro.length === 0, semMembro.join(", "));

if (url) {
  const base = url.replace(/\/$/, "");
  ok("URL é HTTPS", base.startsWith("https://"));
  const home = await fetch(base).catch(() => null);
  ok("home responde 200", home?.status === 200);
  ok("hash na página publicada", ((await home?.text()) ?? "").includes(HASH));
  for (const p of ["/api/me", "/api/lists"]) {
    const x = await fetch(base + p).catch(() => null);
    ok(`${p} sem login → 401`, x?.status === 401);
  }
  const post = await fetch(base + "/api/lists", { method: "POST", headers: { "content-type": "application/json", origin: "https://evil.example" }, body: '{"nome":"x"}' }).catch(() => null);
  ok("POST sem sessão e origem estranha é recusado", post && [401, 403].includes(post.status));
  const l = await fetch(base + "/api/auth/discord", { redirect: "manual" }).catch(() => null);
  ok("login leva ao Discord", (l?.headers.get("location") || "").startsWith("https://discord.com/"));
  const st = await (await fetch(base + "/api/status").catch(() => null))?.json().catch(() => null);
  ok("/api/status: D1 conectado", st?.d1Conectado === true);
  ok("/api/status: Discord configurado", st?.discordConfigurado === true);
  ok("/api/status: SESSION_SECRET configurado", st?.sessaoConfigurada === true);
}

const falhas = r.filter((x) => !x.ok);
console.log(JSON.stringify(falhas, null, 1));
console.log(`${r.length - falhas.length} de ${r.length} verificações OK`);
process.exit(falhas.length ? 1 : 0);
