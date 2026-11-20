import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { onRequest } from "../functions/api/[[route]].js";
import { openBrowser, poll, serve } from "./support/browser.mjs";
import { bind, migration, seedSession } from "./support/database.mjs";

test("fluxo integrado em Chromium com Pages handler e SQLite", { timeout: 45000 }, async (t) => {
  const sqlite = new DatabaseSync(":memory:");
  t.after(() => sqlite.close());
  sqlite.exec(migration);
  const owner = seedSession(sqlite, "Titular QA");
  const other = seedSession(sqlite, "Outra conta QA");
  let failRequest;
  let delayCollection;
  let forcedStatus;
  const bibliographyReads = new Map();
  const origin = await serve(t, async request => {
    const env = { DB: bind(sqlite) };
    if (failRequest?.(request)) {
      env.DB = { prepare() { throw new Error("fixture intencional"); } };
    }
    const pathname = new URL(request.url).pathname;
    if (request.method === "GET" && pathname.endsWith("/bibliography")) {
      bibliographyReads.set(pathname, (bibliographyReads.get(pathname) ?? 0) + 1);
    }
    const deferred = delayCollection;
    const delayed = deferred?.path === pathname && request.method === "GET";
    if (delayed) {
      delayCollection = undefined;
      deferred.started = true;
      await deferred.release.promise;
    }
    const response = await onRequest({ request, env });
    if (delayed) deferred.finished = true;
    if (failRequest?.(request)) forcedStatus = response.status;
    return response;
  });
  const browser = await openBrowser(t, origin);
  t.diagnostic(await browser.version());
  await browser.navigate();
  const ready = await poll(() => browser.evaluate("location.origin === " + JSON.stringify(origin) +
    " && document.readyState === 'complete'"), "documento carregado");
  assert.equal(ready, true);

  const evaluate = browser.evaluate;
  const waitFor = (expression, label) => poll(() => evaluate(expression), label);
  const setValues = (fields) => evaluate(`(() => {
    for (const [selector, value] of Object.entries(${JSON.stringify(fields)})) {
      const field = document.querySelector(selector);
      field.value = value;
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }
  })()`);
  const visible = selector => `Boolean(document.querySelector(${JSON.stringify(selector)})?.getClientRects().length)`;
  const value = selector => `document.querySelector(${JSON.stringify(selector)}).value`;
  const hasText = (selector, text) => `document.querySelector(${JSON.stringify(selector)})?.textContent.includes(${JSON.stringify(text)})`;
  const api = path => evaluate(`fetch(${JSON.stringify(path)}).then(async response => ({
    status: response.status, data: await response.json()
  }))`);
  const requestBody = (path, method, body) => evaluate(`fetch(${JSON.stringify(path)}, {
    method: ${JSON.stringify(method)}, headers: { "Content-Type": "application/json" },
    body: JSON.stringify(${JSON.stringify(body)})
  }).then(async response => ({ status: response.status, data: await response.json() }))`);

  await t.test("anônimo vê sessão pendente e API protegida rejeita acesso", async () => {
    await waitFor(visible("#session-status"), "estado de sessão");
    assert.deepEqual((await api("/api/session")).data, { user: null });
    assert.equal((await api("/api/projects")).status, 401);
    assert.equal(await evaluate(visible("#project-manager")), false);
  });

  let firstProject;
  let secondProject;

  await t.test("projetos criados pelo formulário e selecionados sem misturar dados", async () => {
    await browser.session(owner);
    await browser.navigate();
    await waitFor(visible("#project-manager"), "gerenciador do titular");
    assert.equal((await api("/api/session")).data.user.displayName, "Titular QA");

    const addProject = async (name) => {
      await browser.click("#new-project");
      await setValues({ "#project-name": name, "#project-style": "abnt" });
      await browser.click("#save-project");
      return waitFor(`[...document.querySelector("#project-select").options]
        .find(option => option.textContent.includes(${JSON.stringify(name)}))?.value`, name);
    };
    firstProject = await addProject("Projeto inicial");
    secondProject = await addProject("Projeto separado");
    assert.notEqual(firstProject, secondProject);
    await setValues({ "#project-select": firstProject });
    await waitFor(`${value("#project-select")} === ${JSON.stringify(firstProject)}`, "seleção primeiro projeto");
    await waitFor(`!document.querySelector("#save-reference")?.disabled`, "formulário da referência habilitado");
    await browser.click("#compile-bibliography");
    await waitFor(hasText("#bibliography-status", "ainda não tem referências"), "compilação vazia");
  });

  await t.test("validação cliente e servidor, gravação e ordenação no clipboard", async () => {
    assert.ok(firstProject);
    await browser.click("#save-reference");
    await waitFor(visible('[aria-invalid="true"]'), "erro de campo obrigatório");
    assert.equal((await requestBody("/api/projects", "POST", { name: "", style: "abnt" })).status, 422);

    const save = async (author, title) => {
      await setValues({
        "#source": "book", "#author": author, "#title": title,
        "#year": "2024", "#publisher": "Editora QA",
      });
      await browser.click("#save-reference");
      await waitFor(hasText("#reference-list", title), "referência listada: " + title);
    };
    await save("Lia Vieira", "Segunda obra");
    await save("Clara Álvaro", "Primeira obra");
    await waitFor(hasText("#bibliography-list", "Primeira obra"), "bibliografia compilada");
    const bibliographyPath = "/api/projects/" + firstProject + "/bibliography";
    const previousReads = bibliographyReads.get(bibliographyPath);
    await browser.click("#compile-bibliography");
    await waitFor(hasText("#bibliography-status", "Bibliografia compilada."), "recompilação por clique");
    assert.ok(bibliographyReads.get(bibliographyPath) > previousReads);
    const compiled = await api(bibliographyPath);
    assert.equal(compiled.data.entries.length, 2);
    assert.match(compiled.data.text, /^ÁLVARO, Clara.+\nVIEIRA, Lia/);
    const rendered = await evaluate('" " + document.querySelector("#bibliography-list").textContent');
    assert.ok(rendered.indexOf("Primeira obra") < rendered.indexOf("Segunda obra"));
    assert.ok(await evaluate('Boolean(document.querySelector("#bibliography-list cite, #bibliography-list i, #bibliography-list em"))'));
    await browser.click("#copy-bibliography");
    const clipboard = await waitFor(
      "navigator.clipboard.readText().then(text => text || false)", "clipboard preenchido",
    );
    // Windows Chromium converts LF to native CRLF on the clipboard.
    assert.equal(clipboard.replace(/\r\n/g, "\n"), compiled.data.text);
    await waitFor(hasText("#bibliography-status", "copiad"), "feedback de cópia");
    await browser.denyClipboardWrite();
    assert.equal(await evaluate('navigator.permissions.query({name:"clipboard-write"}).then(result => result.state)'), "denied");
    await browser.click("#copy-bibliography");
    await waitFor('document.querySelector("#bibliography-status").textContent.match(/copiar manualmente|não foi possível copiar/i)?.[0]', "feedback de cópia negada");
  });

  await t.test("editar referência, alternar projeto e recompilar em IEEE", async () => {
    assert.ok(firstProject && secondProject);
    const refsPath = "/api/projects/" + firstProject + "/references";
    const references = (await api(refsPath)).data.references;
    const initial = references.find(reference => reference.fields.title === "Segunda obra");
    assert.ok(initial);
    const selector = action => `[data-action="${action}"][data-reference-id="${initial.id}"]`;
    await browser.click(selector("edit-reference"));
    await waitFor(`${value("#title")} === "Segunda obra"`, "formulário preenchido para edição");
    await setValues({ "#title": "Segunda obra revisada" });
    await browser.click("#save-reference");
    await waitFor(hasText("#reference-list", "Segunda obra revisada"), "referência editada");

    await setValues({ "#project-select": secondProject });
    await waitFor(`!document.querySelector("#reference-list [data-action=edit-reference]")`, "lista do segundo projeto vazia");
    const release = Promise.withResolvers();
    const delayed = { path: refsPath, release, started: false };
    delayCollection = delayed;
    try {
      await setValues({ "#project-select": firstProject });
      await poll(() => delayed.started, "a listagem do primeiro projeto foi atrasada");
      await setValues({ "#project-select": secondProject });
      await waitFor(hasText("#reference-status", "Nenhuma referência"), "segundo projeto carregado");
    } finally {
      release.resolve();
    }
    await poll(() => delayed.finished, "a listagem anterior terminou");
    assert.equal(await evaluate(hasText("#reference-list", "Segunda obra revisada")), false);
    await setValues({ "#project-select": firstProject });
    await waitFor(hasText("#reference-list", "Segunda obra revisada"), "primeiro projeto reaberto");
    await browser.click("#edit-project");
    await setValues({ "#project-name": "Projeto revisado", "#project-style": "ieee" });
    await browser.click("#save-project");
    await waitFor(hasText("#bibliography-list", "[1]"), "compilação IEEE renderizada");
    const compiled = await api("/api/projects/" + firstProject + "/bibliography");
    assert.equal(compiled.data.style, "ieee");
    assert.match(compiled.data.text, /^\[1\] C\. Álvaro/);
    assert.match(compiled.data.text, /\n\[2\] L\. Vieira/);

    await browser.click(selector("delete-reference"));
    await waitFor(`!document.querySelector(${JSON.stringify(selector("edit-reference"))})`, "referência excluída");
    assert.equal((await api(refsPath)).data.references.length, 1);
  });

  await t.test("erro de serviço aparece sem detalhes internos e dados ficam isolados", async () => {
    assert.ok(firstProject);
    failRequest = request => request.method === "POST" && new URL(request.url).pathname === "/api/projects";
    await browser.click("#new-project");
    await setValues({ "#project-name": "Falha esperada" });
    await browser.click("#save-project");
    await waitFor(`document.querySelector("#project-status").textContent.match(/falha|erro|consegui|possível|tente/i)?.[0]`, "feedback de falha do servidor");
    assert.equal(forcedStatus, 500);
    assert.equal(await evaluate(hasText("#project-status", "fixture intencional")), false);
    failRequest = undefined;
    await browser.session(other);
    await browser.navigate();
    await waitFor(hasText("#session-status", "Outra conta QA"), "sessão da segunda conta");
    assert.deepEqual((await api("/api/projects")).data.projects, []);
    assert.equal((await api("/api/projects/" + firstProject + "/bibliography")).status, 404);
    assert.equal(await evaluate(hasText("#project-select", "Projeto revisado")), false);
  });

  await t.test("exclui projeto, reabre sessão e mantém o segundo projeto", async () => {
    assert.ok(firstProject && secondProject);
    await browser.session(owner);
    await browser.navigate();
    await waitFor(hasText("#project-select", "Projeto revisado"), "projeto persistido após navegação");
    await setValues({ "#project-select": firstProject });
    await browser.click("#delete-project");
    await waitFor(`![...document.querySelector("#project-select").options].some(option => option.value === ${JSON.stringify(firstProject)})`, "projeto removido");
    assert.deepEqual((await api("/api/projects")).data.projects.map(project => project.id), [secondProject]);
    assert.equal((await api("/api/projects/" + firstProject + "/bibliography")).status, 404);
  });
});
