import { createRequire } from "node:module";
import { start, env, db } from "./harness.mjs";
import { createSessionCookie } from "../functions/_lib/session.js";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const PORT = 8792, B = `http://localhost:${PORT}`, OUT = (process.env.SHOTS || "./shots");
const server = await start(PORT);
const browser = await chromium.launch();
const errors = [];

// 1) sem login
let ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
let page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(B);
await page.waitForSelector("#loginView:not([hidden])");
await page.screenshot({ path: OUT + "/1-login.png" });
await ctx.close();

// 2) com sessão, desktop
const raw = (await createSessionCookie({ userId: "111", username: "Vitor", avatar: "" }, env)).split(";")[0];
const [name, value] = [raw.slice(0, raw.indexOf("=")), raw.slice(raw.indexOf("=") + 1)];
ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && !m.text().includes("Failed to load resource") && errors.push(m.text()));
await page.goto(B);
await page.waitForSelector(".card");
const n = await page.locator(".card").count();
if (n !== 16) throw new Error("esperava 16 cartas, veio " + n);
// o DOM não deve conter conteúdo nem pair_key antes de virar
const html0 = await page.locator("#board").innerHTML();
if (/pair|\bconsole\b|typeof/.test(html0)) throw new Error("conteúdo vazou no DOM");
await page.screenshot({ path: OUT + "/2-start.png" });

const gameId = await page.evaluate(() => null); // não exposto; pega do banco
const g = db.prepare("SELECT id FROM games WHERE user_id='111' AND status='active'").get();
const keys = Object.fromEntries(db.prepare("SELECT card_id, pair_key FROM game_cards WHERE game_id=?").all(g.id).map((r) => [r.card_id, r.pair_key]));
const ids = await page.$$eval(".card", (els) => els.map((e) => e.dataset.id));
const byPair = {};
ids.forEach((id) => (byPair[keys[id]] ??= []).push(id));
const pairs = Object.values(byPair);
const card = (id) => page.locator(`.card[data-id="${id}"]`);

// erro proposital
await card(pairs[0][0]).click();
await card(pairs[1][0]).click();
await page.waitForSelector(".card.mismatch");
await page.waitForTimeout(700); // meio da animação / antes do desvirar
await page.screenshot({ path: OUT + "/3-mismatch.png" });
await page.waitForFunction(() => !document.querySelector(".card.flipped"));

// acerta alguns pares e tira print no meio
for (let i = 0; i < 4; i++) {
  await card(pairs[i][0]).click();
  await card(pairs[i][1]).click();
  await page.waitForFunction((k) => document.querySelectorAll(".card.matched").length >= (k + 1) * 2, i);
}
await page.waitForTimeout(700);
await page.screenshot({ path: OUT + "/4-meio.png" });
for (let i = 4; i < 8; i++) {
  await card(pairs[i][0]).click();
  await card(pairs[i][1]).click();
  await page.waitForFunction((k) => document.querySelectorAll(".card.matched").length >= (k + 1) * 2, i);
}
await page.waitForSelector("#winPanel:not([hidden])");
await page.waitForTimeout(700);
console.log("moves:", await page.textContent("#movesValue"), "| eficiência:", await page.textContent("#efficiencyValue"), "| win:", await page.textContent("#winText"));
await page.screenshot({ path: OUT + "/5-vitoria.png", fullPage: true });
await ctx.close();

// 3) celular
ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, deviceScaleFactor: 2 });
await ctx.addCookies([{ name, value, domain: "localhost", path: "/" }]);
page = await ctx.newPage();
await page.goto(B);
await page.waitForSelector(".card");
await page.locator(".card").nth(0).click();
await page.waitForSelector(".card.flipped");
await page.waitForTimeout(700);
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
console.log("overflow horizontal no celular:", overflow);
await page.screenshot({ path: OUT + "/6-mobile.png", fullPage: true });

console.log("erros de JS/console:", errors.length ? errors : "nenhum");
await browser.close();
server.close();
