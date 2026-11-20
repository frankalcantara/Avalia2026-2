import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { onRequest } from "../functions/api/[[route]].js";
import { openBrowser, poll, serve } from "./support/browser.mjs";
import { callbackPath, mockDiscord, oauthEnvironment, prepareOAuthDatabase } from "./support/oauth.mjs";
import { localCertificate } from "./support/tls.mjs";

const avatar = "0123456789abcdef0123456789abcdef";
const image = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const profiles = [
  { id: "123456789012345670", username: "fixture-owner", global_name: "Titular OAuth QA", avatar },
  { id: "123456789012345671", username: "fixture-other", global_name: "Outra conta OAuth QA", avatar },
];

test("login, perfil, proteção e saída no Chrome HTTPS com Discord simulado", { timeout: 35000 }, async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  prepareOAuthDatabase(sqlite);
  const tls = await localCertificate(t);
  let environment;
  let account = 0;
  let approve = false;
  let authorizeRequests = 0;

  const outbound = mockDiscord(t, () => profiles[account], { allowLocal: true });
  const origin = await serve(t, request => onRequest({ request, env: environment }), tls);
  environment = oauthEnvironment(sqlite, origin);
  const browser = await openBrowser(t, origin, { tlsPin: tls.tlsPin });
  t.diagnostic(await browser.version());
  await browser.mockExternal(["https://discord.com/oauth2/authorize*", "https://cdn.discordapp.com/*"], url => {
    if (url.hostname === "cdn.discordapp.com") {
      return { responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "image/gif" }], body: image };
    }
    authorizeRequests++;
    const requestedCallback = url.searchParams.get("redirect_uri");
    assert.equal(requestedCallback, origin + callbackPath);
    const callback = new URL(requestedCallback);
    callback.searchParams.set("state", url.searchParams.get("state"));
    callback.searchParams.set("iss", "https://discord.com");
    callback.searchParams.set(approve ? "code" : "error", approve ? "fixture-browser-code" : "access_denied");
    return {
      responseCode: 302,
      responseHeaders: [{ name: "Location", value: callback.href }],
    };
  });

  const evaluate = browser.evaluate;
  const ready = async (expression, label) => poll(async () => {
    try {
      return await evaluate(expression);
    } catch (error) {
      if (/context|navigat/i.test(error.message)) return false;
      throw error;
    }
  }, label);
  const visible = selector => `Boolean(document.querySelector(${JSON.stringify(selector)})?.getClientRects().length)`;
  const hasText = (selector, text) => `document.querySelector(${JSON.stringify(selector)})?.textContent.includes(${JSON.stringify(text)})`;
  const api = path => evaluate(`fetch(${JSON.stringify(path)}).then(async response => ({
    status: response.status, data: await response.json()
  }))`);

  await browser.navigate();
  await ready(visible("#login-discord"), "botão de login anônimo");
  assert.equal(await evaluate(visible("#workspace")), false);
  assert.equal((await api("/api/projects")).status, 401);

  await browser.click("#login-discord");
  await ready(hasText("#auth-status", "cancelado"), "cancelamento informado");
  assert.equal(await evaluate("location.search"), "");
  assert.equal(authorizeRequests, 1);
  assert.deepEqual(outbound, []);
  assert.equal(await evaluate(visible("#workspace")), false);

  approve = true;
  await browser.click("#login-discord");
  await ready(hasText("#profile-name", profiles[0].global_name), "nome do titular");
  await ready(visible("#profile-avatar"), "avatar do titular carregado");
  assert.equal(await evaluate(visible("#login-discord")), false);
  assert.equal(await evaluate(visible("#workspace")), true);
  assert.equal(await evaluate("document.cookie.includes('__Host-p23_session')"), false);
  const expectedAvatar = "https://cdn.discordapp.com/avatars/" + profiles[0].id + "/" + avatar;
  assert.ok((await evaluate("document.querySelector('#profile-avatar').src")).startsWith(expectedAvatar));

  await browser.click("#new-project");
  await evaluate(`(() => {
    const name = document.querySelector("#project-name");
    name.value = "Projeto do titular OAuth";
    name.dispatchEvent(new Event("input", { bubbles: true }));
  })()`);
  await browser.click("#save-project");
  await ready(hasText("#project-select", "Projeto do titular OAuth"), "projeto criado com login real da aplicação");
  const [{ id }] = (await api("/api/projects")).data.projects;
  assert.ok(id);

  await browser.click("#logout-discord");
  await ready(visible("#login-discord"), "login disponível após saída");
  assert.equal(await evaluate(visible("#workspace")), false);
  assert.equal((await api("/api/projects")).status, 401);

  account = 1;
  await browser.click("#login-discord");
  await ready(hasText("#profile-name", profiles[1].global_name), "nome da segunda conta");
  const ownProjects = await api("/api/projects");
  assert.deepEqual(ownProjects.data.projects, []);
  assert.equal((await api("/api/projects/" + id)).status, 404);
  assert.equal(authorizeRequests, 3);
  assert.deepEqual(outbound.map(call => call.path), ["token", "identity", "token", "identity"]);

  sqlite.prepare("UPDATE sessions SET expires_at = 1").run();
  await browser.navigate();
  await ready(visible("#login-discord"), "sessão expirada no recarregamento");
  assert.equal(await evaluate(visible("#workspace")), false);

  environment = { ...environment, DISCORD_CLIENT_SECRET: "" };
  await browser.click("#login-discord");
  await ready(hasText("#auth-status", "indisponível"), "configuração ausente informada");
  assert.equal(authorizeRequests, 3);
});
