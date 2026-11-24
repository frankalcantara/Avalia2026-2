// Requisitos de entrega (README.md, LICENSE, AGENTS.md e skills).
// Arquivos criados pelo orquestrador no fim: podem falhar antes disso.

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { KEY, ROOT } from "./helpers/app.mjs";

const readRoot = (f) => readFileSync(path.join(ROOT, f), "utf8");

test("README.md existe e contém a chave", () => {
  assert.ok(existsSync(path.join(ROOT, "README.md")), "README.md ausente");
  assert.ok(readRoot("README.md").includes(KEY), "chave ausente no README.md");
});

test("LICENSE é MIT", () => {
  assert.ok(existsSync(path.join(ROOT, "LICENSE")), "LICENSE ausente");
  const lic = readRoot("LICENSE");
  assert.match(lic, /MIT License/i);
  assert.match(lic, /Permission is hereby granted, free of charge/);
  assert.match(lic, /Copyright \(c\) \d{4}/i);
});

test("AGENTS.md descreve 3 ou mais agentes", () => {
  assert.ok(existsSync(path.join(ROOT, "AGENTS.md")), "AGENTS.md ausente");
  const md = readRoot("AGENTS.md");
  const numbered = new Set([...md.matchAll(/Agente\s*(\d+)/gi)].map((m) => m[1]));
  const headings = md.split("\n").filter((l) => /^#{2,4}\s.*agente/i.test(l));
  assert.ok(
    numbered.size >= 3 || headings.length >= 3,
    `encontrados ${numbered.size} agentes numerados e ${headings.length} títulos de agente`,
  );
  assert.match(md, /teste|valida/i, "AGENTS.md deve citar o agente de teste");
});

test("3 ou mais skills/*/SKILL.md com frontmatter name/description", () => {
  const dir = path.join(ROOT, "skills");
  const skills = existsSync(dir)
    ? readdirSync(dir).filter((d) => existsSync(path.join(dir, d, "SKILL.md")))
    : [];
  assert.ok(skills.length >= 3, `só ${skills.length} SKILL.md`);
  for (const s of skills) {
    const src = readFileSync(path.join(dir, s, "SKILL.md"), "utf8");
    assert.match(src, /^---\n[\s\S]*?\bname:\s*\S+[\s\S]*?\bdescription:\s*\S+[\s\S]*?\n---/, `${s}/SKILL.md sem frontmatter`);
  }
});
