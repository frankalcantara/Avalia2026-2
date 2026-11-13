// Verificações estáticas da seção 5 (segurança) sobre os arquivos do projeto. Rodar: npm test
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const IGNORAR = new Set(["node_modules", ".wrangler", ".git"]);

function arquivos(dir, filtro) {
  const saida = [];
  for (const nome of readdirSync(dir)) {
    if (IGNORAR.has(nome)) continue;
    const p = join(dir, nome);
    if (statSync(p).isDirectory()) saida.push(...arquivos(p, filtro));
    else if (filtro(p)) saida.push(p);
  }
  return saida;
}
const ler = (p) => readFileSync(p, "utf8");
const rel = (p) => relative(RAIZ, p);

describe("front-end: dado do servidor nunca entra por HTML (seção 5)", () => {
  const fontes = arquivos(join(RAIZ, "public"), (p) => /\.(m?js|html)$/.test(p));

  test("há front-end para verificar", () => {
    assert.ok(fontes.some((p) => p.endsWith("index.html")), "public/index.html");
  });

  test("sem innerHTML / outerHTML / insertAdjacentHTML / document.write / eval / new Function", () => {
    const proibido = /\.(innerHTML|outerHTML)\s*[+]?=|insertAdjacentHTML\s*\(|document\.write(ln)?\s*\(|\beval\s*\(|new\s+Function\s*\(/;
    const achados = [];
    for (const p of fontes) {
      ler(p)
        .split("\n")
        .forEach((linha, i) => {
          if (proibido.test(linha)) achados.push(`${rel(p)}:${i + 1}: ${linha.trim()}`);
        });
    }
    assert.deepEqual(achados, []);
  });

  test("scripts só locais (sem CDN / framework externo)", () => {
    const html = ler(join(RAIZ, "public", "index.html"));
    const externos = [...html.matchAll(/<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]).filter((s) => /^(https?:)?\/\//.test(s));
    assert.deepEqual(externos, []);
  });

  test("rodapé com a chave do projeto", () => {
    assert.match(ler(join(RAIZ, "public", "index.html")), /P26-3A-5E56-230D-1716-D540/);
  });
});

describe("segredos fora do repositório (seção 5)", () => {
  test(".dev.vars e .wrangler estão no .gitignore", () => {
    const gi = ler(join(RAIZ, ".gitignore"));
    assert.match(gi, /^\.dev\.vars$/m);
    assert.match(gi, /^\.wrangler\/?$/m);
  });

  test("wrangler.jsonc não define DISCORD_CLIENT_SECRET", () => {
    const w = ler(join(RAIZ, "wrangler.jsonc")).replace(/^\s*\/\/.*$/gm, "");
    assert.doesNotMatch(w, /"DISCORD_CLIENT_SECRET"\s*:/);
  });

  test("o valor do secret de .dev.vars não aparece em nenhum arquivo versionável", { skip: !existsSync(join(RAIZ, ".dev.vars")) }, () => {
    const m = /^DISCORD_CLIENT_SECRET=(.*)$/m.exec(ler(join(RAIZ, ".dev.vars")));
    const valor = m && m[1].trim().replace(/^["']|["']$/g, "");
    if (!valor || valor.length < 6) return;
    const vazou = arquivos(RAIZ, (p) => !p.endsWith(".dev.vars") && statSync(p).size < 2_000_000)
      .filter((p) => ler(p).includes(valor))
      .map(rel);
    assert.deepEqual(vazou, [], "arquivos com o valor do secret (valor não exibido)");
  });
});

describe("back-end: SQL só com prepare().bind() (seção 5)", () => {
  const fontes = arquivos(join(RAIZ, "functions"), (p) => p.endsWith(".js"));

  test("nenhuma interpolação de dado da requisição dentro de prepare()", () => {
    const achados = [];
    for (const p of fontes) {
      const src = ler(p);
      for (const m of src.matchAll(/prepare\(\s*`([\s\S]*?)`\s*,?\s*\)/g)) {
        for (const [, expr] of m[1].matchAll(/\$\{([^}]*)\}/g)) {
          if (/request|params|corpo|url|searchParams|\bf\.|\bv\.|usuario|body/i.test(expr)) achados.push(`${rel(p)}: \${${expr}}`);
        }
      }
      if (/DB\.exec\s*\(/.test(src)) achados.push(`${rel(p)}: usa DB.exec()`);
    }
    assert.deepEqual(achados, []);
  });
});
