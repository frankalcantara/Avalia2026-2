import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { tmpdir } from "node:os";
import { isAbsolute, join, relative, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../", import.meta.url));
const files = new Map([
  ["/", ["index.html", "text/html"]],
  ["/app.js", ["app.js", "text/javascript"]],
  ["/references.mjs", ["references.mjs", "text/javascript"]],
  ["/styles.css", ["styles.css", "text/css"]],
]);

export async function poll(fn, label) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await delay(40);
  }
  throw new Error("Timeout: " + label);
}

export async function serve(t, api, tls) {
  const handle = async (request, response) => {
    try {
      const url = new URL(request.url, origin);
      if (!url.pathname.startsWith("/api/")) {
        const file = files.get(url.pathname);
        if (!file) {
          response.writeHead(404).end();
          return;
        }
        const content = await readFile(resolve(project, "public", file[0]));
        response.writeHead(200, { "Content-Type": file[1] + "; charset=utf-8" }).end(content);
        return;
      }
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const result = await api(new Request(url, { method: request.method, headers: request.headers, body }));
      const headers = Object.fromEntries(result.headers);
      const cookies = result.headers.getSetCookie();
      if (cookies.length) headers["set-cookie"] = cookies;
      response.writeHead(result.status, headers).end(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
      response.writeHead(500).end(String(error));
    }
  };
  const server = tls ? createSecureServer(tls, handle) : createServer(handle);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = (tls ? "https" : "http") + "://127.0.0.1:" + server.address().port;
  t.after(() => new Promise(resolveClose => server.close(resolveClose)));
  return origin;
}

function connect(url) {
  const socket = new WebSocket(url);
  let id = 0;
  const pending = new Map();
  const events = new Map();
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    if (message.method) events.get(message.method)?.(message.params);
    if (!pending.has(message.id)) return;
    const { resolveCommand, rejectCommand } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectCommand(new Error(message.error.message));
    else resolveCommand(message.result);
  });
  const opened = new Promise((resolveConnection, rejectConnection) => {
    socket.addEventListener("open", resolveConnection, { once: true });
    socket.addEventListener("error", rejectConnection, { once: true });
  });
  return {
    close: () => socket.close(),
    on: (method, handler) => events.set(method, handler),
    async send(method, params = {}) {
      await opened;
      const commandId = ++id;
      return new Promise((resolveCommand, rejectCommand) => {
        pending.set(commandId, { resolveCommand, rejectCommand });
        socket.send(JSON.stringify({ id: commandId, method, params }));
      });
    },
  };
}

export async function openBrowser(t, origin, { tlsPin } = {}) {
  const binary = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  ].find(path => path && existsSync(path));
  if (!binary) throw new Error("Set CHROME_PATH to an installed Chromium browser");
  const tempParent = await realpath(tmpdir());
  const profile = await mkdtemp(join(tempParent, "p23-browser-"));
  const browser = spawn(binary, [
    "--headless=new", "--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0",
    "--no-first-run", "--no-default-browser-check", "--disable-background-networking",
    ...(tlsPin ? ["--ignore-certificate-errors-spki-list=" + tlsPin] : []),
    "--user-data-dir=" + profile, "about:blank",
  ], { windowsHide: true, stdio: "ignore" });
  t.after(async () => {
    if (browser.exitCode === null) {
      const closed = once(browser, "exit");
      browser.kill();
      await Promise.race([closed, delay(1500, null, { ref: false })]);
    }
    const target = await realpath(profile);
    const child = relative(tempParent, target);
    if (!isAbsolute(child) && /^p23-browser-[^\\/]+$/.test(child)) {
      await rm(target, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
    }
  });

  const [port, wsPath] = (await poll(async () =>
    readFile(join(profile, "DevToolsActivePort"), "utf8").catch(() => ""), "Chrome CDP")).split(/\r?\n/);
  const debugOrigin = "127.0.0.1:" + port;
  const browserCdp = connect("ws://" + debugOrigin + wsPath);
  t.after(() => browserCdp.close());
  await browserCdp.send("Browser.grantPermissions", {
    origin, permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
  });
  const targets = await (await fetch("http://" + debugOrigin + "/json/list")).json();
  const page = connect(targets.find(target => target.type === "page").webSocketDebuggerUrl);
  t.after(() => page.close());
  const evaluate = async (expression) => {
    const result = await page.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  await page.send("Page.enable");
  await page.send("Network.enable");
  page.on("Page.javascriptDialogOpening", () => {
    void page.send("Page.handleJavaScriptDialog", { accept: true });
  });

  return {
    evaluate,
    version: async () => (await browserCdp.send("Browser.getVersion")).product,
    async denyClipboardWrite() {
      await browserCdp.send("Browser.setPermission", {
        origin, permission: { name: "clipboard-write" }, setting: "denied",
      });
    },
    async navigate() { await page.send("Page.navigate", { url: origin + "/" }); },
    async mockExternal(patterns, respond) {
      page.on("Fetch.requestPaused", event => {
        void Promise.resolve().then(() => respond(new URL(event.request.url))).then(response =>
          page.send("Fetch.fulfillRequest", { requestId: event.requestId, ...response })
        ).catch(() => page.send("Fetch.failRequest", { requestId: event.requestId, errorReason: "Failed" }));
      });
      await page.send("Fetch.enable", { patterns: patterns.map(urlPattern => ({ urlPattern })) });
    },
    async session(token) {
      const result = await page.send("Network.setCookie", {
        name: "__Host-p23_session", value: token, url: origin, path: "/", secure: true, httpOnly: true,
      });
      if (!result.success) throw new Error("Fixture session cookie was not set");
    },
    async click(selector) {
      const { x, y } = await evaluate("(() => { const element = document.querySelector(" + JSON.stringify(selector) +
        "); element.scrollIntoView({block: 'center'}); const r = element.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()");
      await page.send("Input.dispatchMouseEvent", { x, y, type: "mousePressed", button: "left", clickCount: 1 });
      await page.send("Input.dispatchMouseEvent", { x, y, type: "mouseReleased", button: "left", clickCount: 1 });
    },
  };
}
