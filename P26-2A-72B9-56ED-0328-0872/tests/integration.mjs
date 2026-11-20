import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(projectDir, "node_modules/wrangler/bin/wrangler.js");
const localSecret = "integration-test-only-secret";
const testUsers = ["integration-student-a", "integration-student-b"];
const varsPath = resolve(projectDir, ".dev.vars");
let createdVars = false, server, serverOutput = "", baseUrl, passed = 0;
function logPass(name) { passed++; process.stdout.write(`✓ ${name}\n`); }
function wranglerCommand(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], { cwd: projectDir, encoding: "utf8", windowsHide: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  if (result.status !== 0) throw new Error(`Wrangler failed: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
async function freePort() {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolvePromise));
  const { port } = probe.address(); await new Promise(resolvePromise => probe.close(resolvePromise)); return port;
}
function b64url(value) { return Buffer.from(value).toString("base64url"); }
async function sessionCookie(userId) {
  const payload = b64url(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(localSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))).toString("base64url");
  return `__Host-discord-session=${payload}.${signature}`;
}
async function request(path, { user = testUsers[0], ...options } = {}) {
  const headers = new Headers(options.headers || {});
  if (user) headers.set("cookie", await sessionCookie(user));
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  return fetch(`${baseUrl}${path}`, { ...options, headers, redirect: options.redirect || "manual" });
}
async function json(response) { return response.json(); }
async function waitUntilReady() {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Wrangler exited early:\n${serverOutput}`);
    try { const response = await fetch(`${baseUrl}/api/auth/status`); if (response.ok) return; } catch { /* wait */ }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Local Worker did not start:\n${serverOutput}`);
}
async function run() {
  assert.ok(existsSync(wrangler), "Install dependencies before running integration tests");
  if (existsSync(varsPath)) throw new Error("Refusing to overwrite existing .dev.vars; preserve local credentials first.");
  const port = await freePort(); baseUrl = `http://127.0.0.1:${port}`;
  writeFileSync(varsPath, [`DISCORD_CLIENT_ID="123456789012345678"`,`DISCORD_CLIENT_SECRET="${localSecret}"`,`DISCORD_REDIRECT_URI="${baseUrl}/api/auth/discord/callback"`,""].join("\n"), { flag: "wx" }); createdVars = true;
  wranglerCommand(["d1", "migrations", "apply", "painel-tarefas-db", "--local"]);
  wranglerCommand(["d1", "execute", "painel-tarefas-db", "--local", "--command", `INSERT OR REPLACE INTO users (id, username, display_name, avatar_url) VALUES ('${testUsers[0]}','student-a','Student A',NULL),('${testUsers[1]}','student-b','Student B',NULL);`]);
  server = spawn(process.execPath, [wrangler, "dev", "--local", "--ip", "127.0.0.1", "--port", String(port)], { cwd: projectDir, stdio: ["ignore", "pipe", "pipe"], windowsHide: true, env: { ...process.env, WRANGLER_SEND_METRICS: "false" } });
  server.stdout.on("data", chunk => { serverOutput += chunk.toString(); }); server.stderr.on("data", chunk => { serverOutput += chunk.toString(); }); await waitUntilReady();

  const authStatus = await json(await request("/api/auth/status", { user: null })); assert.equal(authStatus.discord_configured, true); logPass("Discord OAuth configuration and unauthenticated status");
  const startAuth = await request("/api/auth/discord/start", { user: null }); assert.equal(startAuth.status, 302); assert.equal(new URL(startAuth.headers.get("location")).hostname, "discord.com"); logPass("Discord OAuth redirect");
  assert.equal((await request("/api/time/entries", { user: null })).status, 401); logPass("Timesheet data requires an authenticated session");

  const timer = await request("/api/time/start", { method: "POST", body: JSON.stringify({ project_name: "Projeto de teste", module: "Codificação", description: "Fluxo de cronômetro" }) });
  assert.equal(timer.status, 201); const active = await json(timer);
  const duplicate = await request("/api/time/start", { method: "POST", body: JSON.stringify({ project_name: "Outro", module: "Testes" }) }); assert.equal(duplicate.status, 409);
  logPass("Timer starts once and prevents concurrent timers per user");

  const data = await json(await request(`/api/time/entries?date=${new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" })}`));
  assert.ok(data.entries.some(item => item.id === active.id && item.mine)); assert.equal(data.modules.length, 4); logPass("Daily individual/team dashboard and four engineering stages");

  const stopped = await request("/api/time/stop", { method: "POST", body: "{}" }); assert.equal(stopped.status, 200); assert.ok((await json(stopped)).duration_minutes >= 1);
  assert.equal((await request("/api/time/stop", { method: "POST", body: "{}" })).status, 404); logPass("Timer stop stores a positive elapsed duration");

  const start = new Date(Date.now() - 2 * 60 * 60 * 1000); const end = new Date(Date.now() - 60 * 60 * 1000);
  const localValue = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const manualBody = { project_name: "Projeto de teste", module: "Testes", description: "Apontamento manual", started_at: localValue(start), ended_at: localValue(end) };
  const manual = await request("/api/time/manual", { method: "POST", body: JSON.stringify(manualBody) }); assert.equal(manual.status, 201); assert.ok((await json(manual)).duration_minutes >= 59);
  const invalidManual = await request("/api/time/manual", { method: "POST", body: JSON.stringify({ ...manualBody, ended_at: localValue(new Date(Date.now() + 3600000)) }) }); assert.equal(invalidManual.status, 400);
  logPass("Manual time entry accepts valid periods and rejects future end times");

  const estimates = await json(await request("/api/time/estimates")); assert.equal(estimates.modules.length, 4); assert.ok(estimates.modules.every(item => Number.isInteger(item.estimate_minutes)));
  const badEstimate = await request("/api/time/estimates", { method: "PUT", body: JSON.stringify({ module: "Qualquer coisa", estimate_minutes: -10 }) }); assert.equal(badEstimate.status, 400);
  logPass("Module estimates are stored in D1 and validated");

  const logout = await request("/api/auth/logout", { method: "POST" }); assert.equal(logout.status, 204); logPass("Logout clears the session cookie");
  const invalidCallback = await fetch(`${baseUrl}/api/auth/discord/callback?code=dummy&state=wrong&iss=https%3A%2F%2Fdiscord.com`, { headers: { cookie: "__Host-discord-oauth-state=other" }, redirect: "manual" }); assert.equal(invalidCallback.status, 400); logPass("OAuth callback rejects invalid state");
}
try { await run(); process.stdout.write(`\n${passed} integration checks passed against local Worker + D1.\n`); }
finally {
  if (server && server.exitCode === null) { server.kill("SIGTERM"); await Promise.race([new Promise(resolvePromise => server.once("exit", resolvePromise)), new Promise(resolvePromise => setTimeout(resolvePromise, 3000))]); }
  try {
    if (existsSync(wrangler)) wranglerCommand(["d1", "execute", "painel-tarefas-db", "--local", "--command", `DELETE FROM time_entries WHERE user_id IN ('${testUsers.join("','")}'); UPDATE project_modules SET updated_by=NULL WHERE updated_by IN ('${testUsers.join("','")}'); DELETE FROM users WHERE id IN ('${testUsers.join("','")}');`]);
  } catch (error) { process.stderr.write(`Local fixture cleanup failed: ${error.message}\n`); process.exitCode = 1; }
  if (createdVars && existsSync(varsPath)) unlinkSync(varsPath);
}
