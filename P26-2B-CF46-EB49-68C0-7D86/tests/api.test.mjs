import assert from "node:assert/strict";
import { bind, migration, seedSession } from "./support/database.mjs";
import { mkdtempSync, rmdirSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { onRequest } from "../functions/api/[[route]].js";

const origin = "https://example.test";
const book = { sourceType: "book", fields: {
  author: "Ana Silva", title: "Pesquisa Aplicada", year: "2024",
  location: "Curitiba", publisher: "Editora Horizonte",
} };

async function request(sqlite, method, path, { token, body, database = bind(sqlite) } = {}) {
  const headers = { Origin: origin };
  if (token) headers.Cookie = "__Host-p23_session=" + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  return onRequest({
    request: new Request(origin + path, { method, headers, body: JSON.stringify(body) }),
    env: { DB: database },
  });
}

test("migração e handlers com SQLite em arquivo", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "p23-qa-"));
  const path = join(directory, "qa.sqlite");
  let sqlite = new DatabaseSync(path);
  t.after(() => {
    sqlite.close();
    unlinkSync(path);
    rmdirSync(directory);
  });
  sqlite.exec(migration);
  const owner = seedSession(sqlite, "owner");
  const other = seedSession(sqlite, "other");
  let projectPath;
  let referencePath;

  await t.test("sessão anônima e sessão de fixture persistida", async () => {
    const anonymous = await request(sqlite, "GET", "/api/session");
    assert.equal(anonymous.status, 200);
    assert.deepEqual(await anonymous.json(), { user: null });
    assert.equal((await request(sqlite, "GET", "/api/projects")).status, 401);
    const authenticated = await request(sqlite, "GET", "/api/session", { token: owner });
    assert.equal(authenticated.status, 200);
    const { user } = await authenticated.json();
    assert.equal(user.displayName, "owner");
    assert.equal(user.avatarUrl, "https://example.org/avatar.png");
  });

  await t.test("criação do projeto e validação independente no servidor", async () => {
    const invalidProject = await request(sqlite, "POST", "/api/projects", {
      token: owner, body: { name: "", style: "abnt" },
    });
    assert.equal(invalidProject.status, 422);
    const created = await request(sqlite, "POST", "/api/projects", {
      token: owner, body: { name: "Projeto de teste", style: "abnt" },
    });
    assert.equal(created.status, 201);
    const { project } = await created.json();
    projectPath = "/api/projects/" + project.id;
    const invalidReference = await request(sqlite, "POST", projectPath + "/references", {
      token: owner, body: { ...book, fields: { ...book.fields, publisher: "" } },
    });
    assert.equal(invalidReference.status, 422);
    const saved = await request(sqlite, "POST", projectPath + "/references", { token: owner, body: book });
    assert.equal(saved.status, 201);
    referencePath = projectPath + "/references/" + (await saved.json()).reference.id;
  });

  await t.test("proprietário reabre o banco e outro usuário não tem acesso", async () => {
    assert.ok(projectPath && referencePath, "Casos de criação devem terminar com sucesso");
    sqlite.close();
    sqlite = new DatabaseSync(path);
    const reloaded = await request(sqlite, "GET", projectPath + "/references", { token: owner });
    assert.equal(reloaded.status, 200);
    assert.equal((await reloaded.json()).references[0].fields.title, book.fields.title);
    const otherProjects = await request(sqlite, "GET", "/api/projects", { token: other });
    assert.equal(otherProjects.status, 200);
    assert.deepEqual((await otherProjects.json()).projects, []);
    assert.equal((await request(sqlite, "GET", projectPath + "/references", { token: other })).status, 404);
    assert.equal((await request(sqlite, "PATCH", referencePath, { token: other, body: book })).status, 404);
    const project = await request(sqlite, "GET", projectPath, { token: owner });
    assert.equal(project.status, 200);
    assert.equal((await project.json()).project.name, "Projeto de teste");
  });

  await t.test("compilação autorizada, ordenação e troca de estilo", async (scenario) => {
    const created = await request(sqlite, "POST", "/api/projects", {
      token: owner, body: { name: "Compilação QA", style: "abnt" },
    });
    const { project } = await created.json();
    const path = "/api/projects/" + project.id;
    const bibliography = path + "/bibliography";
    const empty = await request(sqlite, "GET", bibliography, { token: owner });
    assert.deepEqual(await empty.json(), { style: "abnt", entries: [], text: "" });

    for (const author of ["Lia Vieira", "Clara Álvaro"]) {
      const saved = await request(sqlite, "POST", path + "/references", {
        token: owner, body: { ...book, fields: { ...book.fields, author } },
      });
      assert.equal(saved.status, 201);
    }
    const response = await request(sqlite, "GET", bibliography, { token: owner });
    const compiled = await response.json();
    assert.equal(compiled.style, "abnt");
    assert.equal(compiled.entries.length, 2);
    assert.match(compiled.entries[0].text, /^ÁLVARO, Clara/);
    assert.match(compiled.entries[1].text, /^VIEIRA, Lia/);
    assert.equal(compiled.text, compiled.entries.map(entry => entry.text).join("\n"));
    assert.ok(compiled.entries.every(entry => entry.parts.some(part => part.italic)));
    assert.equal((await request(sqlite, "GET", bibliography)).status, 401);
    assert.equal((await request(sqlite, "GET", bibliography, { token: other })).status, 404);

    const changed = await request(sqlite, "PATCH", path, {
      token: owner, body: { name: "Compilação revisada", style: "ieee" },
    });
    assert.equal(changed.status, 200);
    assert.equal((await changed.json()).project.name, "Compilação revisada");
    const refreshed = await request(sqlite, "GET", bibliography, { token: owner });
    const ieee = await refreshed.json();
    assert.equal(ieee.style, "ieee");
    assert.deepEqual(ieee.entries.map(entry => entry.id), compiled.entries.map(entry => entry.id));
    assert.match(ieee.entries[0].text, /^\[1\] C\. Álvaro/);
    assert.match(ieee.entries[1].text, /^\[2\] L\. Vieira/);
    const concurrent = await Promise.all([
      request(sqlite, "PATCH", path, { token: owner, body: { name: "Nome atualizado" } }),
      request(sqlite, "PATCH", path, { token: owner, body: { style: "abnt" } }),
    ]);
    scenario.diagnostic("PATCH concorrentes: " + concurrent.map(result => result.status).join(", "));
    const patches = [{ name: "Nome atualizado" }, { style: "abnt" }];
    for (const [index, result] of concurrent.entries()) {
      if (result.status === 409) {
        assert.equal((await result.json()).error.code, "concurrent_update");
        const retry = await request(sqlite, "PATCH", path, { token: owner, body: patches[index] });
        assert.equal(retry.status, 200);
      } else {
        assert.equal(result.status, 200);
      }
    }
    const reloaded = await request(sqlite, "GET", path, { token: owner });
    const { project: current } = await reloaded.json();
    assert.equal(current.name, "Nome atualizado");
    assert.equal(current.style, "abnt");

    const database = bind(sqlite, {
      beforeRun(sql) {
        if (sql.startsWith("UPDATE projects SET")) {
          sqlite.prepare("UPDATE projects SET name = ? WHERE id = ?").run("Alteração simultânea", project.id);
        }
      },
    });
    const conflict = await request(sqlite, "PATCH", path, {
      token: owner, body: { style: "ieee" }, database,
    });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, "concurrent_update");
    const preserved = await request(sqlite, "GET", path, { token: owner });
    const { project: afterConflict } = await preserved.json();
    assert.equal(afterConflict.name, "Alteração simultânea");
    assert.equal(afterConflict.style, "abnt");
    assert.equal((await request(sqlite, "DELETE", path, { token: owner })).status, 204);
  });

  await t.test("atualização, exclusão e revogação da sessão", async () => {
    assert.ok(projectPath && referencePath, "Casos de criação devem terminar com sucesso");
    const updated = await request(sqlite, "PATCH", referencePath, {
      token: owner, body: { ...book, fields: { ...book.fields, title: "Pesquisa revisada" } },
    });
    assert.equal(updated.status, 200);
    const listed = await request(sqlite, "GET", projectPath + "/references", { token: owner });
    assert.equal((await listed.json()).references[0].fields.title, "Pesquisa revisada");
    assert.equal((await request(sqlite, "DELETE", referencePath, { token: owner })).status, 204);
    const empty = await request(sqlite, "GET", projectPath + "/references", { token: owner });
    assert.deepEqual((await empty.json()).references, []);
    assert.equal((await request(sqlite, "POST", projectPath + "/references", { token: owner, body: book })).status, 201);
    assert.equal((await request(sqlite, "DELETE", projectPath, { token: owner })).status, 204);
    assert.equal(sqlite.prepare("SELECT count(*) AS total FROM bibliographic_references").get().total, 0);
    assert.equal((await request(sqlite, "POST", "/api/auth/logout", { token: owner })).status, 204);
    assert.equal((await request(sqlite, "GET", "/api/projects", { token: owner })).status, 401);
  });
});
