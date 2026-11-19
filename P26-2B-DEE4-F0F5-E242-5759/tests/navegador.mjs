import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, sep } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fixture } from "./fixture.mjs";

const browserPath = process.argv[2];
assert.ok(browserPath, "Informe o caminho do Edge ou Chrome.");
const { db, cookies, dispatch } = await fixture();
const day = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(new Date());
const origin = "<b>Centro</b>";
db.prepare("INSERT INTO rides VALUES (1,'1',?,'Campus','2099-01-01T20:00:00.000Z',?,1,1)").run(origin, day);
let failSearch = false;
const assets = { "/": ["index.html", "text/html"], "/app.js": ["app.js", "text/javascript"],
  "/styles.css": ["styles.css", "text/css"] };
const server = createServer(async (incoming, outgoing) => {
  try {
    const url = new URL(incoming.url, `http://${incoming.headers.host}`);
    if (assets[url.pathname]) {
      const [file, type] = assets[url.pathname];
      outgoing.writeHead(200, { "Content-Type": type + "; charset=utf-8" });
      outgoing.end(await readFile(new URL("../public/" + file, import.meta.url)));
      return;
    }
    const headers = new Headers(incoming.headers);
    headers.set("Cookie", cookies["2"]);
    const response = failSearch && url.pathname === "/api/rides"
      ? Response.json({ ok: false, error: "banco_indisponivel" }, { status: 503 })
      : await dispatch(new Request(url, { method: incoming.method, headers }));
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end();
  }
});

const workspace = resolve(".");
const profile = await mkdtemp(resolve(workspace, ".browser-audit-"));
assert.ok(resolve(profile).startsWith(workspace + sep + ".browser-audit-"));
let browser;
let socket;
try {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const url = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(browserPath, ["--headless", "--disable-gpu", "--disable-background-networking",
    "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0",
    `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore", windowsHide: true });
  let launchError;
  browser.on("error", (error) => { launchError = error; });
  async function until(check) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw launchError;
      const value = await check();
      if (value) return value;
      await delay(100);
    }
    throw new Error("Tempo de espera excedido no teste do navegador");
  }
  const port = await until(async () => {
    const file = await readFile(resolve(profile, "DevToolsActivePort"), "utf8").catch(() => "");
    return file.split(/\r?\n/)[0];
  });
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket = new WebSocket(targets.find(({ type }) => type === "page").webSocketDebuggerUrl);
  await once(socket, "open");
  let nextId = 0;
  async function command(method, params = {}) {
    const id = ++nextId;
    const result = new Promise((resolve, reject) => {
      function receive(event) {
        const reply = JSON.parse(event.data);
        if (reply.id !== id) return;
        socket.removeEventListener("message", receive);
        if (reply.error) reject(new Error(reply.error.message));
        else resolve(reply.result);
      }
      socket.addEventListener("message", receive);
    });
    socket.send(JSON.stringify({ id, method, params }));
    return result;
  }
  async function evaluate(expression) {
    const reply = await command("Runtime.evaluate", { expression, returnByValue: true });
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.text);
    return reply.result.value;
  }
  const button = 'document.querySelector("#results button")';
  const confirmed = 'document.querySelector("#results")?.textContent.includes("Sua vaga está confirmada.")';
  await command("Page.navigate", { url });
  await until(() => evaluate(`Boolean(${button})`));
  assert.equal(await evaluate('document.querySelector("#username").textContent'), "Passageiro");
  assert.equal(await evaluate('document.querySelector("#results h3").textContent'), origin + " → Campus");
  assert.equal(await evaluate('Boolean(document.querySelector("#results h3 b"))'), false);
  for (const width of [320, 480, 768, 1024, 1440]) {
    await command("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: false });
    assert.equal(await evaluate("innerWidth"), width);
    assert.equal(await evaluate("document.documentElement.scrollWidth === document.documentElement.clientWidth"), true);
    const columns = await evaluate('getComputedStyle(document.querySelector(".workspace")).gridTemplateColumns.split(" ").length');
    assert.equal(columns, width <= 864 ? 1 : 2);
    console.log(`OK layout ${width} × 900`);
  }
  await evaluate(`${button}.click()`);
  await until(() => evaluate(confirmed));
  assert.equal(db.prepare("SELECT available_seats FROM rides WHERE id = 1").get().available_seats, 0);
  await evaluate("window.auditBeforeReload = true");
  await command("Page.reload");
  await until(() => evaluate(`!window.auditBeforeReload && document.readyState === "complete" && ${confirmed}`));
  assert.equal(await evaluate(`Boolean(${button})`), false);
  console.log("OK perfil, texto literal e reserva após recarregar");
  failSearch = true;
  await evaluate('document.querySelector("#search").requestSubmit()');
  await until(() => evaluate('document.querySelector("#search-status").dataset.kind === "error"'));
  assert.match(await evaluate('document.querySelector("#search-status").textContent'), /indisponível/);
  console.log("OK mensagem de API indisponível");
} finally {
  socket?.close();
  if (browser?.pid && browser.exitCode === null) {
    browser.kill();
    await once(browser, "exit");
  }
  server.close();
  await rm(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 200 });
}
