import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = resolve(projectDir, "node_modules/wrangler/bin/wrangler.js");
const localSecret = "integration-test-only-secret";
const testUsers = ["integration-student-a", "integration-student-b"];
const testDates = ["2099-01-01", "2099-01-02"];
const varsPath = resolve(projectDir, ".dev.vars");
let createdVars = false;
let server;
let serverOutput = "";
let baseUrl;
let passed = 0;

function logPass(name) { passed++; process.stdout.write(`✓ ${name}\n`); }
function wranglerCommand(args) {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    cwd: projectDir,
    encoding: "utf8",
    windowsHide: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  if (result.status !== 0) throw new Error(`Wrangler failed: ${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
async function freePort() {
  const probe = createServer();
  await new Promise((resolvePromise, reject) => probe.once("error", reject).listen(0, "127.0.0.1", resolvePromise));
  const { port } = probe.address();
  await new Promise(resolvePromise => probe.close(resolvePromise));
  return port;
}
function b64url(value) { return Buffer.from(value).toString("base64url"); }
async function sessionCookie(userId) {
  const payload = b64url(JSON.stringify({ sub: userId, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(localSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
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
    try {
      const response = await fetch(`${baseUrl}/api/auth/status`);
      if (response.ok) return;
    } catch { /* wait for local listener */ }
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Local Worker did not start:\n${serverOutput}`);
}

async function run() {
  assert.ok(existsSync(wrangler), "Wrangler must be installed before running integration tests");
  if (existsSync(varsPath)) throw new Error("Refusing to overwrite an existing .dev.vars file; preserve local credentials and retry after moving it aside.");
  const port = await freePort();
  baseUrl = `http://127.0.0.1:${port}`;
  writeFileSync(varsPath, [
    `DISCORD_CLIENT_ID="123456789012345678"`,
    `DISCORD_CLIENT_SECRET="${localSecret}"`,
    `DISCORD_REDIRECT_URI="${baseUrl}/api/auth/discord/callback"`,
    "",
  ].join("\n"), { flag: "wx" });
  createdVars = true;

  wranglerCommand(["d1", "migrations", "apply", "painel-tarefas-db", "--local"]);
  const userSql = `INSERT OR REPLACE INTO users (id, username, display_name, avatar_url) VALUES ('${testUsers[0]}', 'student-a', 'Student A', NULL), ('${testUsers[1]}', 'student-b', 'Student B', NULL);`;
  wranglerCommand(["d1", "execute", "painel-tarefas-db", "--local", "--command", userSql]);

  const redirectUri = `${baseUrl}/api/auth/discord/callback`;
  server = spawn(process.execPath, [wrangler, "dev", "--local", "--ip", "127.0.0.1", "--port", String(port)], {
    cwd: projectDir,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  server.stdout.on("data", chunk => { serverOutput += chunk.toString(); });
  server.stderr.on("data", chunk => { serverOutput += chunk.toString(); });
  await waitUntilReady();

  const authStatus = await json(await request("/api/auth/status", { user: null }));
  assert.equal(authStatus.discord_configured, true);
  logPass("local OAuth configuration status");

  const authStart = await request("/api/auth/discord/start", { user: null });
  assert.equal(authStart.status, 302);
  const authorizeUrl = new URL(authStart.headers.get("location"));
  assert.equal(authorizeUrl.hostname, "discord.com");
  assert.equal(authorizeUrl.searchParams.get("scope"), "identify");
  assert.equal(authorizeUrl.searchParams.get("redirect_uri"), redirectUri);
  assert.match(authStart.headers.get("set-cookie") || "", /__Host-discord-oauth-state=/);
  logPass("Discord authorization redirect, scope, callback, and state cookie");

  assert.equal((await request("/api/me", { user: null })).status, 401);
  assert.equal((await request("/api/reservations", { user: null, method: "POST", body: "{}" })).status, 401);
  logPass("authentication required for profile and reservation writes");

  const me = await json(await request("/api/me"));
  assert.equal(me.id, testUsers[0]);
  assert.equal(me.username, "student-a");
  const availabilityPath = `/api/availability?date=${testDates[0]}`;
  let availability = await json(await request(availabilityPath));
  assert.equal(availability.resources.length, 6);
  assert.equal(availability.user_minutes_reserved, 0);
  logPass("session resolves the D1 user and lists the six seeded spaces");

  const invalidDate = await request("/api/availability?date=2099-02-31", { user: null });
  assert.equal(invalidDate.status, 400);
  const invalidDuration = await request("/api/reservations", {
    method: "POST", body: JSON.stringify({ resource_id: "meeting-a", date: testDates[0], start_time: "08:00", duration_minutes: 45 }),
  });
  assert.equal(invalidDuration.status, 400);
  const pastReservation = await request("/api/reservations", {
    method: "POST", body: JSON.stringify({ resource_id: "meeting-a", date: "2000-01-01", start_time: "08:00", duration_minutes: 30 }),
  });
  assert.equal(pastReservation.status, 400);
  logPass("invalid date, unsupported duration, and past booking are rejected");

  const first = await request("/api/reservations", {
    method: "POST", body: JSON.stringify({ resource_id: "meeting-a", date: testDates[0], start_time: "08:00", duration_minutes: 60 }),
  });
  assert.equal(first.status, 201);
  const firstReservation = await json(first);
  const overlap = await request("/api/reservations", {
    method: "POST", body: JSON.stringify({ resource_id: "meeting-a", date: testDates[0], start_time: "08:30", duration_minutes: 30 }),
  });
  assert.equal(overlap.status, 409);
  const second = await request("/api/reservations", {
    method: "POST", body: JSON.stringify({ resource_id: "study-1", date: testDates[0], start_time: "09:00", duration_minutes: 60 }),
  });
  assert.equal(second.status, 201);
  const dailyLimit = await request("/api/reservations", {
    method: "POST", body: JSON.stringify({ resource_id: "lab-1", date: testDates[0], start_time: "10:00", duration_minutes: 30 }),
  });
  assert.equal(dailyLimit.status, 409);
  logPass("reservation creation, room overlap prevention, and two-hour daily limit");

  const otherUserAvailability = await json(await request(availabilityPath, { user: testUsers[1] }));
  const otherUsersView = otherUserAvailability.reservations.find(item => item.id === firstReservation.id);
  assert.equal(otherUsersView.mine, false);
  assert.equal(otherUsersView.owner_label, null);
  assert.equal("username" in otherUsersView, false);
  logPass("third-party reservations are visible without exposing the owner identity");

  const deniedCancel = await request(`/api/reservations/${firstReservation.id}`, { user: testUsers[1], method: "DELETE" });
  assert.equal(deniedCancel.status, 404);
  const cancelled = await request(`/api/reservations/${firstReservation.id}`, { method: "DELETE" });
  assert.equal(cancelled.status, 204);
  logPass("only the reservation owner can cancel a future reservation");

  const logout = await request("/api/auth/logout", { method: "POST" });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get("set-cookie") || "", /Max-Age=0/);
  logPass("logout clears the session cookie");

  const invalidCallback = await fetch(`${baseUrl}/api/auth/discord/callback?code=dummy&state=wrong&iss=https%3A%2F%2Fdiscord.com`, {
    headers: { cookie: "__Host-discord-oauth-state=some-other-state" }, redirect: "manual",
  });
  assert.equal(invalidCallback.status, 400);
  logPass("OAuth callback rejects an invalid state value");
}

try {
  await run();
  process.stdout.write(`\n${passed} integration checks passed against local Worker + D1.\n`);
} finally {
  if (server && server.exitCode === null) {
    server.kill("SIGTERM");
    await Promise.race([new Promise(resolvePromise => server.once("exit", resolvePromise)), new Promise(resolvePromise => setTimeout(resolvePromise, 3000))]);
  }
  try {
    const cleanupSql = `DELETE FROM reservations WHERE user_id IN ('${testUsers.join("','")}'); DELETE FROM users WHERE id IN ('${testUsers.join("','")}');`;
    if (existsSync(wrangler)) wranglerCommand(["d1", "execute", "painel-tarefas-db", "--local", "--command", cleanupSql]);
  } catch (error) {
    process.stderr.write(`Local fixture cleanup failed: ${error.message}\n`);
    process.exitCode = 1;
  }
  if (createdVars && existsSync(varsPath)) unlinkSync(varsPath);
}
