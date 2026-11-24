// Teste de interface com Chrome headless contra o servidor local real (wrangler pages dev + D1 local).
// Não é dependência do projeto: o puppeteer-core é carregado de fora da pasta (PUPPETEER_PATH).
// Uso:
//   PUPPETEER_PATH=/caminho/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js \
//   CHROME=/usr/bin/google-chrome BASE_URL=http://localhost:8788 TEST_TOKEN=... TEST_TOKEN_2=... \
//   SHOTS=/tmp/shots node tests/ui-real.mjs
// Roda depois de tests/api.test.mjs (usa o estado deixado por ele: partidas de hoje já encerradas).
import { mkdirSync } from "node:fs";
import { ANSWERS } from "../src/data/answers.js";
import { VALID } from "../src/data/valid.js";

const { default: puppeteer } = await import(process.env.PUPPETEER_PATH || "puppeteer-core");
const BASE = (process.env.BASE_URL || "http://localhost:8788").replace(/\/$/, "");
const SHOTS = process.env.SHOTS || "/tmp/cypher-shots";
const T1 = process.env.TEST_TOKEN;
const T2 = process.env.TEST_TOKEN_2;
const KEY = "P26-3A-0CED-4ACD-47F7-EDA9";
mkdirSync(SHOTS, { recursive: true });

const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
const answerKeys = new Set(ANSWERS.map(norm));
const LOSERS = VALID.split(" ").filter((w) => !answerKeys.has(w)).filter((_, i) => i % 131 === 0);
const PNG_1PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

const results = [];
const consoleErrors = [];
const expectedNetwork = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function check(name, ok, detail = "") {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? "PASSOU" : "FALHOU"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

async function newPage(token) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // Avatares do Discord (rede externa) respondidos localmente para não depender da internet
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    if (req.url().startsWith("https://cdn.discordapp.com/")) req.respond({ status: 200, contentType: "image/png", body: PNG_1PX });
    else req.continue();
  });
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    // O Chrome registra no console toda resposta HTTP 4xx; nas rotas de API isso é o comportamento esperado
    if (/Failed to load resource: the server responded with a status of 4\d\d/.test(text)) {
      expectedNetwork.push(`${text} ${msg.location()?.url || ""}`);
      return;
    }
    consoleErrors.push(text);
  });
  page.on("pageerror", (err) => consoleErrors.push(`pageerror: ${err.message}`));
  if (token) {
    await page.setCookie({ name: "cypher_session", value: token, url: BASE, httpOnly: true });
  }
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem("cypher-seen-help", "1"); } catch {} });
  return page;
}

const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
const sheetOpen = (page) => page.$eval("#sheet", (d) => d.open);
async function closeSheet(page) {
  if (await sheetOpen(page)) {
    await page.click("#sheet-close");
    await page.waitForFunction(() => !document.getElementById("sheet").open, { timeout: 3000 });
  }
}
async function rowStates(page, r) {
  return page.$$eval(`#board .row:nth-child(${r + 1}) .tile`, (ts) =>
    ts.map((t) => (t.className.match(/tile--(correct|present|absent)/) || [])[1] || null));
}
async function typeWord(page, word) {
  // espera a animação de revelação anterior terminar (o teclado fica bloqueado durante ela)
  await page.waitForFunction(() => !document.getElementById("keyboard").classList.contains("is-disabled"), { timeout: 8000 });
  await page.keyboard.type(word.toLowerCase(), { delay: 25 });
  await page.keyboard.press("Enter");
}
async function waitToast(page, re) {
  try {
    await page.waitForFunction((src) => [...document.querySelectorAll("#toasts .toast")].some((t) => new RegExp(src, "i").test(t.textContent)), { timeout: 4000 }, re.source);
    return true;
  } catch {
    return false;
  }
}

try {
  // ---------------- sem cookie: tela de entrada
  {
    const page = await newPage(null);
    await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
    const landing = await page.$eval("#landing", (e) => !e.hidden && e.offsetHeight > 0);
    const appHidden = await page.$eval("#app", (e) => e.hidden);
    check("sem cookie: tela de entrada aparece e o app fica oculto", landing && appHidden);
    const href = await page.$eval("#login-btn", (a) => a.getAttribute("href"));
    check("sem cookie: botão de login aponta para /api/auth/discord", href.startsWith("/api/auth/discord"), href);
    const footer = await page.$eval("footer", (f) => f.textContent);
    check("rodapé com a chave do projeto (entrada)", footer.includes(KEY));
    await sleep(1500);
    await shot(page, "01-entrada-sem-login");
    await page.goto(`${BASE}/?desafio=AAAAAAAAAA`, { waitUntil: "networkidle0" });
    const invite = await page.$eval("#landing-invite", (e) => !e.hidden);
    const href2 = await page.$eval("#login-btn", (a) => a.getAttribute("href"));
    check("sem cookie com link de desafio: convite visível e returnTo preservado", invite && href2.includes(encodeURIComponent("/?desafio=AAAAAAAAAA")), href2);
    await shot(page, "02-entrada-convite-desafio");
    await page.close();
  }

  // ---------------- com cookie: jogo clássico em cofre antigo pelo teclado físico
  const page = await newPage(T1);
  await page.goto(`${BASE}/?data=2026-11-03`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#board .row .tile");
  check("com cookie: app aparece e entrada fica oculta", await page.$eval("#landing", (e) => e.hidden) && await page.$eval("#app", (e) => !e.hidden));
  check("rodapé com a chave do projeto (app)", (await page.$eval("footer", (f) => f.textContent)).includes(KEY));
  check("banner de cofre antigo visível", await page.$eval("#banner", (b) => !b.hidden && /Cofre antigo/.test(b.textContent)));

  // linha inicial = tentativas já gravadas nesse cofre (o roteiro pode ser repetido)
  const start = await page.$$eval("#board .row", (rs) => rs.filter((r) => r.querySelector('.tile[class*="tile--"]:not(.tile--filled)')).length);
  await typeWord(page, "zzzzz");
  check("palavra fora do dicionário mostra aviso", await waitToast(page, /dicion/));
  check("palavra inválida não preenche estados", (await rowStates(page, start)).every((s) => s === null));
  for (let i = 0; i < 5; i++) await page.keyboard.press("Backspace");
  await page.keyboard.type("abc");
  await page.keyboard.press("Enter");
  check("palavra curta mostra aviso de letras faltando", await waitToast(page, /Faltam letras/));
  for (let i = 0; i < 3; i++) await page.keyboard.press("Backspace");

  for (let r = start; r < start + 2; r++) {
    await typeWord(page, LOSERS[r]);
    await page.waitForFunction((n) => document.querySelectorAll(`#board .row:nth-child(${n}) .tile[class*="tile--correct"], #board .row:nth-child(${n}) .tile[class*="tile--present"], #board .row:nth-child(${n}) .tile[class*="tile--absent"]`).length === 5, { timeout: 8000 }, r + 1);
    const st = await rowStates(page, r);
    check(`clássico: linha ${r + 1} (${LOSERS[r]}) recebe estados nas 5 peças`, st.every(Boolean), st.join(","));
  }
  const marked = await page.$$eval("#keyboard .key", (ks) => ks.filter((k) => /key--(correct|present|absent)/.test(k.className)).length);
  check("teclado virtual marca as letras usadas", marked > 0, `${marked} teclas`);
  // o cabeçalho só é atualizado ao fim da animação de revelação
  await page.waitForFunction(() => !document.getElementById("keyboard").classList.contains("is-disabled"), { timeout: 8000 });
  const head = await page.$eval("#game-head", (h) => h.textContent);
  check(`cabeçalho mostra a tentativa ${start + 3} de 6`, new RegExp(`${start + 3} de 6`).test(head), head.trim());
  await page.waitForFunction(() => !document.querySelector("#toasts .toast"), { timeout: 6000 }).catch(() => {});
  await shot(page, "03-classico-cofre-antigo-jogando");

  // recarregar mantém as tentativas
  await page.reload({ waitUntil: "networkidle0" });
  await page.waitForSelector("#board .row .tile");
  check("recarregar a página mantém as tentativas", (await rowStates(page, start + 1)).every(Boolean));

  // ---------------- sombra
  await page.goto(`${BASE}/?modo=sombra&data=2026-11-03`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#board .row .tile");
  const rows = await page.$$eval("#board .row", (r) => r.length);
  check("sombra: tabuleiro com 10 linhas", rows === 10, String(rows));
  await typeWord(page, LOSERS[5]);
  await page.waitForFunction(() => {
    const c = document.querySelector("#board .row:nth-child(1) .clue--exact");
    return c && /\d/.test(c.textContent);
  }, { timeout: 8000 });
  const clue = await page.$eval("#board .row:nth-child(1) .clue", (c) => c.textContent.trim());
  const colored = (await rowStates(page, 0)).some(Boolean);
  check("sombra: linha mostra contagens e nenhuma peça colorida", /\d/.test(clue) && !colored, clue);
  await page.waitForFunction(() => !document.getElementById("keyboard").classList.contains("is-disabled"), { timeout: 8000 });
  await shot(page, "04-sombra-cofre-antigo");

  // ---------------- partida de hoje já encerrada: resultado abre sozinho
  await page.goto(`${BASE}/`, { waitUntil: "networkidle0" });
  await page.waitForFunction(() => document.getElementById("sheet").open, { timeout: 5000 }).catch(() => {});
  check("partida encerrada de hoje abre o resultado", await sheetOpen(page));
  await sleep(500);
  await shot(page, "05-resultado-hoje");
  await closeSheet(page);
  await shot(page, "06-classico-hoje-aberto");

  // ---------------- painéis
  for (const [panel, name] of [["cofres", "07-cofres-antigos"], ["estatisticas", "08-estatisticas"], ["ranking", "09-ranking-global"]]) {
    await page.click(`[data-panel="${panel}"]`);
    await page.waitForFunction(() => document.getElementById("sheet").open, { timeout: 3000 });
    await sleep(900);
    const body = await page.$eval("#sheet-body", (b) => b.textContent);
    check(`painel ${panel} abre com conteúdo`, body.trim().length > 20, (await page.$eval("#sheet-title", (t) => t.textContent)).trim());
    await shot(page, name);
    if (panel === "ranking") {
      const hasMe = body.includes("teste1");
      check("ranking global lista o usuário 1", hasMe);
      await page.select("#sheet-body select", "900000000000000001");
      await sleep(900);
      const gbody = await page.$eval("#sheet-body", (b) => b.textContent);
      check("ranking do servidor lista só membros (sem teste2)", gbody.includes("teste1") && !gbody.includes("teste2"));
      await shot(page, "10-ranking-servidor");
    }
    await closeSheet(page);
  }

  // ---------------- desafio: central, criação e visão do criador
  await page.click("#tab-desafio");
  await page.waitForSelector("#desafio-view:not([hidden]) form input");
  await page.type("#desafio-view form input", "festa");
  await page.click("#desafio-view form button[type=submit]");
  await page.waitForFunction(() => /\/d\/[A-Za-z0-9]{10}/.test(document.getElementById("desafio-view").textContent), { timeout: 5000 });
  check("desafio: criar pela interface mostra o link /d/:id", true);
  await sleep(500);
  await shot(page, "11-desafio-central");
  const verBtn = await page.$("#desafio-view .list button");
  await verBtn.click();
  await page.waitForFunction(() => /Seu desafio/.test(document.getElementById("desafio-view").textContent), { timeout: 5000 });
  check("desafio: criador vê a própria palavra e não o tabuleiro", await page.$eval("#board-wrap", (b) => b.hidden));
  await shot(page, "12-desafio-criador");

  // ---------------- desafio como jogador (desafio criado pelo usuário 2)
  const r = await fetch(`${BASE}/api/challenge`, { headers: { Cookie: `cypher_session=${T2}` } });
  const { challenges } = await r.json();
  const target = challenges.find((c) => c.plays === 0);
  await page.goto(`${BASE}/?desafio=${target.id}`, { waitUntil: "networkidle0" });
  await page.waitForSelector("#board .row .tile");
  check("desafio: jogador vê banner do criador", await page.$eval("#banner", (b) => !b.hidden && /teste2/.test(b.textContent)));
  await typeWord(page, LOSERS[8]);
  await page.waitForFunction(() => document.querySelectorAll('#board .row:nth-child(1) .tile[class*="tile--a"], #board .row:nth-child(1) .tile[class*="tile--p"], #board .row:nth-child(1) .tile[class*="tile--c"]').length === 5, { timeout: 8000 });
  check("desafio: chute pelo teclado recebe estados", (await rowStates(page, 0)).every(Boolean));
  const html = await page.content();
  check("desafio: a palavra não está no DOM durante a partida", !norm(html).includes(target.word));
  await sleep(400);
  await shot(page, "13-desafio-jogador");
  await page.close();

  check("nenhum erro de console ou de página", consoleErrors.length === 0, consoleErrors.join(" | "));
} catch (err) {
  check("execução do roteiro", false, err.stack);
} finally {
  await browser.close();
}

console.log("\nRespostas HTTP 4xx esperadas registradas pelo Chrome:");
for (const n of expectedNetwork) console.log("  " + n);
const fail = results.filter((r) => !r.ok).length;
console.log(`\nInterface: ${results.length - fail} passaram, ${fail} falharam. Screenshots em ${SHOTS}`);
process.exit(fail ? 1 : 0);
