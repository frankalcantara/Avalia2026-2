// Teste E2E da interface com Playwright (chromium) contra o servidor local.
// Executar: node tests/e2e.mjs   (requer o pacote playwright disponível; ver tests/README.md)
// Injeta o cookie `sessao` de um usuário de teste criado direto no D1 local.
// Projeto #26 · Chave P26-2A-0FC2-F5F9-5A1B-0D19
//
// Variáveis: BASE_URL (padrão http://localhost:8788), WRANGLER, PERSIST_TO,
//            SCREENS_DIR (padrão ../screens relativo à pasta do projeto)
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(join(process.cwd(), "noop.js"));
const { chromium } = require("playwright");

const BASE = (process.env.BASE_URL || "http://localhost:8788").replace(/\/$/, "");
const WRANGLER = process.env.WRANGLER || "npx wrangler";
const PERSIST = process.env.PERSIST_TO ? ["--persist-to", process.env.PERSIST_TO] : [];
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCREENS = process.env.SCREENS_DIR || resolve(ROOT, "..", "screens");
const CHAVE = "P26-2A-0FC2-F5F9-5A1B-0D19";
mkdirSync(SCREENS, { recursive: true });

function sql(command) {
  const [bin, ...pre] = WRANGLER.split(" ").filter(Boolean);
  const out = execFileSync(bin, [...pre, "d1", "execute", "DB", "--local", ...PERSIST, "--json", "--command", command],
    { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  return JSON.parse(out.slice(out.indexOf("["))).flatMap((r) => r.results || []);
}

const RUN = Date.now().toString().slice(-9);
const userId = `8${RUN}00001`;
const token = randomBytes(32).toString("hex");
const sha = (t) => createHash("sha256").update(t).digest("hex");
sql(`INSERT INTO users (user_id, username, avatar_url) VALUES ('${userId}', 'Usuária E2E', 'https://cdn.discordapp.com/embed/avatars/1.png');
     INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ('${sha(token)}', '${userId}', ${Date.now() + 3600000});`);

const resultados = [];
async function caso(nome, fn) {
  try { await fn(); resultados.push([nome, "passou"]); console.log("ok  -", nome); }
  catch (e) { resultados.push([nome, "FALHOU: " + e.message]); console.log("ERRO-", nome, "\n     ", e.message); }
}
const shot = (page, nome) => page.screenshot({ path: join(SCREENS, `e2e-${nome}.png`), fullPage: true });

const browser = await chromium.launch();
const errosPagina = [];
const XSS = `<img src=x onerror="window.__xss=1"> Enquete E2E ${RUN}`;
let pollId;

try {
  // 1) Sem cookie: tela de login
  const anon = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p0 = await anon.newPage();
  p0.on("pageerror", (e) => errosPagina.push(e.message));
  await caso("sem cookie mostra a tela de login com 'Entrar com Discord'", async () => {
    await p0.goto(BASE + "/");
    const btn = p0.getByRole("link", { name: "Entrar com Discord" });
    await btn.waitFor();
    assert.equal(await btn.getAttribute("href"), "/api/auth/discord");
    assert.equal(await p0.locator("#usuario").isHidden(), true);
    await shot(p0, "01-login");
  });
  await caso("?erro=state_invalido mostra aviso amigável e limpa a URL", async () => {
    await p0.goto(BASE + "/?erro=state_invalido");
    await p0.locator(".aviso-erro").waitFor();
    assert.match(await p0.locator(".aviso-erro").textContent(), /verificação de segurança/);
    assert.equal(new URL(p0.url()).search, "");
  });
  await caso("footer contém a chave (sem sessão)", async () => {
    assert.ok((await p0.locator("footer").textContent()).includes(CHAVE));
  });
  await anon.close();

  // 2) Com cookie de sessão
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const u = new URL(BASE);
  await ctx.addCookies([{ name: "sessao", value: token, domain: u.hostname, path: "/", httpOnly: true, secure: u.protocol === "https:", sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errosPagina.push(e.message));

  await caso("com sessão mostra cabeçalho com nome/avatar e a lista", async () => {
    await page.goto(BASE + "/");
    await page.locator("#usuario").waitFor({ state: "visible" });
    assert.equal(await page.locator("#nome").textContent(), "Usuária E2E");
    assert.match(await page.locator("#avatar").getAttribute("src"), /cdn\.discordapp\.com/);
    await page.getByRole("heading", { name: "Enquetes", exact: true }).waitFor();
    await shot(page, "02-lista");
  });

  await caso("validação no cliente bloqueia opção vazia", async () => {
    await page.getByRole("link", { name: "+ Nova enquete" }).click();
    await page.locator("#titulo").waitFor();
    await page.fill("#titulo", "Título qualquer");
    await page.getByRole("button", { name: "Criar enquete" }).click();
    await page.locator(".aviso-erro").waitFor();
    assert.match(await page.locator(".aviso-erro").textContent(), /opções/i);
  });

  await caso("criar enquete pela UI (3 opções, título com HTML)", async () => {
    await page.fill("#titulo", XSS);
    await page.fill("#descricao", "Criada pelo teste E2E");
    const inputs = page.locator(".opcoes-edit input");
    await inputs.nth(0).fill("Pizza");
    await inputs.nth(1).fill("Hambúrguer");
    await page.getByRole("button", { name: "+ Adicionar opção" }).click();
    await inputs.nth(2).fill("Sushi");
    assert.equal(await inputs.count(), 3);
    await shot(page, "03-nova-enquete");
    await page.getByRole("button", { name: "Criar enquete" }).click();
    await page.waitForURL(/#\/enquete\/\d+$/);
    pollId = Number(page.url().match(/(\d+)$/)[1]);
    await page.locator("form.voto").waitFor();
  });

  await caso("título com HTML aparece como texto (sem XSS)", async () => {
    assert.equal(await page.locator("article h1").textContent(), XSS);
    assert.equal(await page.evaluate(() => window.__xss), undefined);
    assert.equal(await page.locator("article h1 img").count(), 0);
  });

  await caso("detalhe antes de votar: radios, botão desabilitado, sem barras", async () => {
    assert.equal(await page.locator('input[name="opcao"]').count(), 3);
    assert.equal(await page.getByRole("button", { name: "Votar" }).isDisabled(), true);
    assert.equal(await page.locator(".resultados").count(), 0);
    await shot(page, "04-detalhe-antes");
  });

  await caso("votar e ver barras proporcionais com destaque", async () => {
    await page.getByLabel("Hambúrguer").check();
    await page.getByRole("button", { name: "Votar" }).click();
    await page.locator(".resultados").waitFor();
    await page.waitForTimeout(900); // transição CSS da largura
    assert.equal(await page.locator(".resultado").count(), 3);
    assert.equal(await page.locator(".resultado.minha .rotulo").first().textContent().then((t) => t.includes("Hambúrguer")), true);
    const larguras = await page.locator(".resultado .bar").evaluateAll((els) => els.map((e) => e.style.width));
    assert.deepEqual(larguras, ["0%", "100%", "0%"]);
    const px = await page.locator(".resultado.minha .bar").evaluate((e) => e.getBoundingClientRect().width);
    const trilho = await page.locator(".resultado.minha .trilho").evaluate((e) => e.getBoundingClientRect().width);
    assert.ok(px > 0 && Math.abs(px - trilho) < 2, `barra ${px}px, trilho ${trilho}px`);
    assert.match(await page.locator(".resultado.minha .numeros").textContent(), /100,0%.*1 voto/);
    assert.match(await page.locator(".resultados h2").textContent(), /Resultado parcial/);
    await shot(page, "05-resultado");
  });

  await caso("recarregar mantém o resultado (servidor sabe que votei)", async () => {
    await page.reload();
    await page.locator(".resultados").waitFor();
    assert.equal(await page.locator("form.voto").count(), 0);
  });

  await caso("lista mostra a enquete com 'Você votou'", async () => {
    await page.goto(BASE + "/#/");
    const card = page.locator(`a[href="#/enquete/${pollId}"]`);
    await card.waitFor();
    assert.match(await card.textContent(), /Você votou/);
    assert.match(await card.textContent(), /1 voto/);
  });

  await caso("enquete encerrada (ajustada no D1) mostra resultado final", async () => {
    sql(`UPDATE polls SET closes_at = ${Date.now() - 60000} WHERE id = ${pollId}`);
    await page.goto(BASE + `/#/enquete/${pollId}`);
    await page.reload();
    await page.locator(".resultados").waitFor();
    assert.match(await page.locator(".resultados h2").textContent(), /Resultado final/);
    assert.match(await page.locator(".selo-encerrada").first().textContent(), /Encerrada/);
    await shot(page, "06-encerrada");
  });

  await caso("footer contém a chave (com sessão)", async () => {
    const footer = page.locator("footer");
    assert.ok((await footer.textContent()).includes(CHAVE));
    assert.ok(await footer.isVisible());
  });

  await caso("layout móvel (390px) sem rolagem horizontal", async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BASE + "/#/");
    await page.locator(".grade").waitFor();
    const sobra = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(sobra <= 0, `rolagem horizontal de ${sobra}px`);
    await shot(page, "07-mobile");
  });

  await caso("Sair volta para o login e invalida a sessão", async () => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.getByRole("button", { name: "Sair" }).click();
    await page.getByRole("link", { name: "Entrar com Discord" }).waitFor();
    const st = await page.evaluate(() => fetch("/api/me").then((r) => r.status));
    assert.equal(st, 401);
    await shot(page, "08-apos-sair");
  });

  await caso("nenhum erro de JavaScript na página", async () => {
    assert.deepEqual(errosPagina, []);
  });
  await ctx.close();
} finally {
  await browser.close();
}

const falhas = resultados.filter(([, r]) => r !== "passou");
console.log(`\nE2E: ${resultados.length - falhas.length}/${resultados.length} passaram. Screenshots em ${SCREENS}`);
process.exit(falhas.length ? 1 : 0);
