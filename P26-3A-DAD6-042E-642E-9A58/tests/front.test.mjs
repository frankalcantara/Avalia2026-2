// Segurança e requisitos do front (análise estática de public/).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { KEY, ROOT } from "./helpers/app.mjs";

const PUB = path.join(ROOT, "public");
const read = (f) => readFileSync(path.join(PUB, f), "utf8");
const has = (f) => existsSync(path.join(PUB, f));
const skipJs = !has("app.js") && "public/app.js ausente";
const skipHtml = !has("index.html") && "public/index.html ausente";

function lineOf(src, index) {
  return src.slice(0, index).split("\n").length;
}

// Um valor de sink HTML só é aceito se for literal de string fixo (sem ${}).
function isStaticLiteral(rhs) {
  const s = rhs.trim();
  return /^"[^"\\]*"\s*;?$/.test(s) || /^'[^'\\]*'\s*;?$/.test(s) || /^`[^`$]*`\s*;?$/.test(s);
}

test("public/app.js não usa innerHTML/outerHTML/insertAdjacentHTML com dados dinâmicos", { skip: skipJs }, () => {
  const src = read("app.js");
  const problems = [];
  const assign = /\.(innerHTML|outerHTML)\s*\+?=\s*([^\n;]*)/g;
  for (const m of src.matchAll(assign)) {
    if (!isStaticLiteral(m[2])) problems.push(`app.js:${lineOf(src, m.index)} ${m[0].trim()}`);
  }
  for (const m of src.matchAll(/insertAdjacentHTML\s*\(\s*[^,]+,\s*([^)\n]*)/g)) {
    if (!isStaticLiteral(m[1])) problems.push(`app.js:${lineOf(src, m.index)} ${m[0].trim()}`);
  }
  for (const m of src.matchAll(/document\.write(ln)?\s*\(|\beval\s*\(|new\s+Function\s*\(|createContextualFragment|DOMParser/g)) {
    problems.push(`app.js:${lineOf(src, m.index)} ${m[0]}`);
  }
  assert.deepEqual(problems, [], `sinks perigosos:\n${problems.join("\n")}`);
});

test("public/app.js usa DOM direto (createElement/textContent) e fetch same-origin", { skip: skipJs }, () => {
  const src = read("app.js");
  assert.match(src, /createElement\s*\(/);
  assert.match(src, /\.textContent\s*=/);
  assert.match(src, /hashchange/);
  assert.doesNotMatch(src, /credentials\s*:\s*["']include["']/, "não precisa de credentials: include");
});

test("sem framework nem CDN de UI (HTML, JS e sem package.json no front)", { skip: skipHtml }, () => {
  const html = read("index.html");
  const externals = [...html.matchAll(/<(script|link)\b[^>]*(src|href)\s*=\s*["']([^"']+)["']/gi)]
    .map((m) => m[3])
    .filter((u) => /^(https?:)?\/\//i.test(u));
  assert.deepEqual(externals, [], `recursos externos no HTML: ${externals}`);
  const fw = /\b(react|vue|angular|jquery|bootstrap|tailwind|bulma|svelte|preact|alpine|htmx|lit-html)\b/i;
  const blob = html + (has("app.js") ? read("app.js") : "") + (has("styles.css") ? read("styles.css") : "");
  const hits = blob.split("\n").filter((l) => fw.test(l) && /(import|src=|href=|@import|require\()/i.test(l));
  assert.deepEqual(hits, [], `referência a framework: ${hits}`);
  if (has("app.js")) {
    const imports = [...read("app.js").matchAll(/\bimport\s+(?:[^"']+from\s+)?["']([^"']+)["']/g)].map((m) => m[1]);
    assert.ok(imports.every((s) => s.startsWith(".") || s.startsWith("/")), `import de pacote: ${imports}`);
  }
  assert.ok(!readdirSync(PUB).includes("package.json"), "public/ não deve ter package.json");
  assert.ok(!readdirSync(PUB).includes("node_modules"), "public/ não deve ter node_modules");
});

test("index.html: HTML5 semântico, footer com a chave, turma 3A e MIT", { skip: skipHtml }, () => {
  const html = read("index.html");
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html[^>]*lang=["']pt-BR["']/i);
  assert.match(html, /<meta[^>]+name=["']viewport["']/i);
  for (const tag of ["header", "main", "footer"]) assert.match(html, new RegExp(`<${tag}\\b`, "i"), `<${tag}> ausente`);
  const footer = html.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] ?? "";
  assert.ok(footer.includes(KEY), "chave ausente no <footer>");
  assert.match(footer, /3A/);
  assert.match(footer, /MIT/);
  assert.match(html, /src=["']\/?app\.js["']/);
  assert.match(html, /href=["']\/?styles\.css["']/);
});

test("styles.css: responsivo e com tema escuro", { skip: !has("styles.css") && "styles.css ausente" }, () => {
  const css = read("styles.css");
  assert.match(css, /@media/);
  assert.match(css, /prefers-color-scheme\s*:\s*dark/);
  assert.match(css, /--[\w-]+\s*:/, "variáveis CSS");
});
