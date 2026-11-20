// Auditoria estática de segurança do backend (functions/).

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT } from "./helpers/app.mjs";

const FN = path.join(ROOT, "functions");

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
}
const files = walk(FN);
const skip = files.length === 0 && "functions/ vazio";
const rel = (p) => path.relative(ROOT, p);
const lineOf = (src, i) => src.slice(0, i).split("\n").length;

test("sem import de pacote npm nas Functions", { skip }, () => {
  const bad = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\bimport\s+(?:[^"';]+from\s+)?["']([^"']+)["']|\brequire\s*\(\s*["']([^"']+)["']/g)) {
      const spec = m[1] ?? m[2];
      if (!spec.startsWith(".")) bad.push(`${rel(f)}:${lineOf(src, m.index)} ${spec}`);
    }
  }
  assert.deepEqual(bad, []);
});

test("DISCORD_CLIENT_SECRET só é lido de env e nunca vai para log", { skip }, () => {
  const bad = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      if (line.includes("DISCORD_CLIENT_SECRET") && !/env\.DISCORD_CLIENT_SECRET/.test(line)) bad.push(`${rel(f)}:${i + 1}`);
      // "code" sozinho não entra: as rotas registram códigos internos de erro
      // (o teste dinâmico em auth.test.mjs confere que o code do OAuth não vaza).
      if (/console\.\w+\([^)]*\b(secret|token|access_token|cookie|cookies|state|request|body|profile)\b/i.test(line)) {
        bad.push(`${rel(f)}:${i + 1} log suspeito: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(bad, []);
});

test("SQL sempre parametrizado: prepare() sem concatenação de valores", { skip }, () => {
  const bad = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const m of src.matchAll(/\.prepare\(\s*`([^`]*)`/g)) {
      // só são aceitas interpolações de constantes em MAIÚSCULAS (fragmentos fixos de SQL)
      const vars = [...m[1].matchAll(/\$\{\s*([^}]+?)\s*\}/g)].map((x) => x[1]);
      const unsafe = vars.filter((v) => !/^[A-Z][A-Z0-9_]*$/.test(v));
      if (unsafe.length) bad.push(`${rel(f)}:${lineOf(src, m.index)} interpola ${unsafe}`);
    }
    for (const m of src.matchAll(/\.prepare\(\s*["'][^"']*["']\s*\+/g)) {
      bad.push(`${rel(f)}:${lineOf(src, m.index)} concatena string no SQL`);
    }
  }
  assert.deepEqual(bad, []);
});

test("cada rota do contrato existe", () => {
  const need = [
    "functions/api/auth/discord.js",
    "functions/api/auth/discord/callback.js",
    "functions/api/auth/logout.js",
    "functions/api/me.js",
    "functions/api/events/index.js",
    "functions/api/events/[id].js",
    "functions/api/events/[id]/rsvp.js",
  ];
  const missing = need.filter((p) => !existsSync(path.join(ROOT, p)));
  assert.deepEqual(missing, []);
});
