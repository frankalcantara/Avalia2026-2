#!/usr/bin/env node
// entregar.mjs — automatiza a entrega do Projeto #7 (testes, commit, push, D1, evidências e Pull Request).
// Uso (dentro da pasta do projeto):  node entregar.mjs
// Opções: --so-testes  --sem-d1  --sem-pr  --sim (não pergunta nada)  --msg="mensagem do commit"
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KEY = "P26-2A-A113-CCFD-DC47-AC0A";
const NOME = "Julia Letícia Ribeiro de Paula";
const UPSTREAM = "frankalcantara/Avalia2026-2";
const DB = "db-p26-2a-a113-ccfd-dc47-ac0a";
const PROJECT = "projeto-p26-2a-a113-ccfd-dc47-ac0a";
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const msgArg = (args.find((a) => a.startsWith("--msg=")) || "").slice(6);
const WIN = process.platform === "win32";
const hoje = new Date().toISOString().slice(0, 10);
const rl = createInterface({ input: process.stdin, output: process.stdout });

const log = (m = "") => console.log(m);
const ok = (m) => log("  ✔ " + m);
const bad = (m) => log("  ✘ " + m);
const step = (m) => log("\n== " + m);
const q = (a) => (/[\s"&|<>^]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a);
function run(cmd, a = [], cwd = HERE) {
  const r = WIN ? spawnSync(cmd, a.map(q), { cwd, encoding: "utf8", shell: true }) : spawnSync(cmd, a, { cwd, encoding: "utf8" });
  return { ok: r.status === 0, out: ((r.stdout || "") + (r.stderr || "")).trim() };
}
async function ask(p, def = "") {
  if (has("--sim")) return def;
  const a = (await rl.question(p)).trim();
  return a || def;
}
const yes = async (p) => has("--sim") || /^(s|y)/i.test(await ask(p + " [s/N] "));
function stop(m) { bad(m); rl.close(); process.exit(1); }

const ev = { hoje, testes: "", commit: "", log: "", d1: [] };

/* 1) testes */
step("1/6 Testes");
const t = run("node", ["tests/run-tests.mjs"]);
const m = t.out.match(/(\d+) passaram, (\d+) falharam/);
ev.testes = m ? m[0] : "(sem resumo)";
if (!m || m[2] !== "0") { log(t.out.split("\n").slice(-12).join("\n")); stop("Testes falharam. Corrija antes de entregar."); }
ok(ev.testes + ".");
if (has("--so-testes")) { log("\n(--so-testes) Parando aqui."); rl.close(); process.exit(0); }

/* 2) git: confere, commita e envia */
step("2/6 Git (commit e push)");
const top = run("git", ["rev-parse", "--show-toplevel"]);
if (!top.ok) stop("Esta pasta não está dentro de um repositório git.");
const root = top.out;
const rel = path.relative(root, HERE).split(path.sep).join("/");
const branch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], root).out;
const origin = run("git", ["remote", "get-url", "origin"], root).out;
const mm = origin.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
if (!mm) stop("Não consegui ler o remoto 'origin': " + origin);
const [, owner, repo] = mm;
ok(`Fork: ${owner}/${repo} · branch: ${branch} · pasta: ${rel || "."}`);

const fora = run("git", ["status", "--porcelain"], root).out.split("\n").filter(Boolean)
  .map((l) => l.slice(3).replace(/"/g, "")).filter((f) => rel && !f.startsWith(rel + "/"));
if (fora.length) {
  bad("Há alterações FORA da sua pasta (não serão incluídas no commit):");
  fora.forEach((f) => log("      " + f));
}

function commitEPush(msg) {
  run("git", ["add", "-A", "--", HERE], root);
  if (run("git", ["diff", "--cached", "--quiet"], root).ok) { ok("Nada novo para commitar."); }
  else {
    const c = run("git", ["commit", "-m", msg], root);
    if (!c.ok) stop("Commit falhou:\n" + c.out);
    ok("Commit criado: " + msg);
  }
  const p = run("git", ["push", "-u", "origin", branch], root);
  if (!p.ok) stop("Push falhou:\n" + p.out);
  ok("Enviado para o GitHub.");
}
commitEPush(msgArg || "Entrega: jogo da memória espacial com viagem pelo cosmos");

/* 3) D1 remoto (precisa ter jogado uma partida no site publicado) */
step("3/6 Conferência no D1 remoto");
if (has("--sem-d1")) log("  (pulado com --sem-d1)");
else {
  log(`  Se o deploy é automático, espere terminar. Site provável: https://${PROJECT}.pages.dev`);
  log("  Entre pelo Discord e jogue UMA partida completa, depois volte aqui.");
  await ask("  Aperte Enter quando terminar... ");
  const checks = [
    ["Usuário do Discord salvo", "SELECT user_id, username FROM discord_users LIMIT 3"],
    ["Partida finalizada com eficiência", "SELECT id, moves, pairs_total, pairs_found, efficiency, finished_at FROM games WHERE status = 'finished' ORDER BY finished_at DESC LIMIT 3"],
    ["Cartas novas (img:) vindas do servidor", "SELECT text FROM game_cards WHERE substr(text, 1, 4) = 'img:' LIMIT 1"],
  ];
  for (const [nome, sql] of checks) {
    const r = run("npx", ["wrangler", "d1", "execute", DB, "--remote", "--json", "--command", sql]);
    let rows = null;
    try { rows = JSON.parse(r.out.slice(r.out.indexOf("["), r.out.lastIndexOf("]") + 1))[0].results; } catch {}
    if (rows && rows.length) { ok(nome); ev.d1.push({ nome, ok: true, rows }); }
    else { bad(nome + (rows ? " (nenhuma linha)" : " (erro ao consultar; rode 'npx wrangler login')")); ev.d1.push({ nome, ok: false, rows: rows || [] }); }
  }
}

/* 4) evidências + linha real do agente de teste no AGENTS.md */
step("4/6 Evidências");
ev.log = run("git", ["log", "--pretty=format:%h | %ad | %s", "--date=short", "--", HERE], root).out;
ev.commit = run("git", ["rev-parse", "--short", "HEAD"], root).out;
const md = [
  `# Evidências de entrega — ${KEY}`, "", `Gerado em ${hoje} por entregar.mjs (dados reais, nada preenchido à mão).`, "",
  `- Aluna: ${NOME}`, `- Commit: ${ev.commit}`, `- Testes: \`node tests/run-tests.mjs\` → ${ev.testes}`, "",
  "## Histórico de commits da pasta", "```", ev.log, "```", "", "## Conferência no D1 remoto",
  ...(ev.d1.length ? ev.d1.map((c) => `- ${c.ok ? "OK" : "FALHOU"}: ${c.nome}\n\`\`\`json\n${JSON.stringify(c.rows, null, 2)}\n\`\`\``) : ["(não executada)"]), "",
].join("\n");
writeFileSync(path.join(HERE, "evidencias-entrega.md"), md);
ok("Criado evidencias-entrega.md");

const agPath = path.join(HERE, "AGENTS.md");
let ag = readFileSync(agPath, "utf8");
const linha = /^\| 3 – Teste e validação \|.*$/m;
if (linha.test(ag) && ag.match(linha)[0].includes("___")) {
  ag = ag.replace(linha, `| 3 – Teste e validação | ${hoje} | saída de \`node tests/run-tests.mjs\` (evidencias-entrega.md) | \`node tests/run-tests.mjs\` → ${ev.testes.split(" ")[0]} passaram |`);
  writeFileSync(agPath, ag);
  ok("AGENTS.md: linha do agente de teste preenchida com o resultado real.");
}
if (/^\| [12] – .*\| \| \|/m.test(ag)) bad("AGENTS.md: as linhas dos agentes 1 (Arquiteto) e 2 (Frontend) estão vazias. Preencha com o que de fato aconteceu (use o histórico em evidencias-entrega.md).");

/* 5) segundo commit com as evidências */
step("5/6 Enviando evidências");
if (await yes("  Commitar e enviar evidências + AGENTS.md agora?")) commitEPush("Evidências de entrega e registro do agente de teste");

/* 6) Pull Request */
step("6/6 Pull Request");
const site = has("--sem-pr") ? "" : await ask(`  URL do site no Cloudflare (Enter = https://${PROJECT}.pages.dev): `, `https://${PROJECT}.pages.dev`);
let base = "main";
const gh = run("gh", ["--version"], root).ok && run("gh", ["auth", "status"], root).ok;
if (gh) { const b = run("gh", ["repo", "view", UPSTREAM, "--json", "defaultBranchRef", "-q", ".defaultBranchRef.name"], root); if (b.ok && b.out) base = b.out; }
const compare = `https://github.com/${UPSTREAM}/compare/${base}...${owner}:${branch}?expand=1`;
const titulo = `${KEY} — ${NOME} — Jogo da Memória`;
const corpo = `Projeto #7: Jogo da Memória Temático\n\nChave: ${KEY}\nSite: ${site}\nRepositório: https://github.com/${owner}/${repo}\n`;
if (has("--sem-pr")) log("  (pulado com --sem-pr)\n  Abra manualmente: " + compare);
else if (!gh) { log("  GitHub CLI (gh) não encontrado ou sem login. Abra o PR por este link:\n  " + compare); }
else {
  const ja = run("gh", ["pr", "list", "--repo", UPSTREAM, "--head", `${owner}:${branch}`, "--json", "url", "-q", ".[0].url"], root);
  if (ja.ok && ja.out) ok("Já existe um PR: " + ja.out);
  else if (await yes(`  Criar o PR "${titulo}" para ${UPSTREAM}?`)) {
    const r = run("gh", ["pr", "create", "--repo", UPSTREAM, "--base", base, "--head", `${owner}:${branch}`, "--title", titulo, "--body", corpo], root);
    if (r.ok) ok("PR criado: " + r.out.split("\n").pop()); else { bad("Não consegui criar o PR:\n" + r.out); log("  Abra manualmente: " + compare); }
  } else log("  Ok, não criei. Link: " + compare);
}

log("\n== Falta só o que não dá para automatizar");
log("  • Preencher as linhas 1 e 2 do AGENTS.md com datas/evidências reais.");
log("  • Postar no AVA: URL do site no Cloudflare + URL do repositório no GitHub.");
rl.close();
