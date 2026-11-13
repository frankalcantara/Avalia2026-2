/**
 * Testes da entrega documental: harness, agentes, skills e licenças.
 *
 * A rubrica de 25 pontos exige no mínimo 3 agentes (1 dedicado a teste) e as
 * skills relacionadas na pasta `skills/`. Estes testes falham se a estrutura
 * for apagada ou se o mapeamento agente → skill sair do lugar.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ler = (relativo) => readFileSync(join(RAIZ, relativo), "utf8");
const existe = (relativo) => existsSync(join(RAIZ, relativo));

const AGENTES = [
  ".opencode/agents/arquiteto-d1-discord.md",
  ".opencode/agents/interface-vanilla.md",
  ".opencode/agents/auditoria-sorteio.md",
  ".opencode/agents/teste-validacao.md",
];

const SKILLS_PROJETO = [
  "skills/cloudflare-d1-discord/SKILL.md",
  "skills/sorteio-auditavel/SKILL.md",
  "skills/teste-validacao/SKILL.md",
  "skills/vanilla-ui-dom/SKILL.md",
];

const SKILLS_VENDOR = [
  "skills/vendor/ponytail/skills/ponytail/SKILL.md",
  "skills/vendor/ponytail/skills/ponytail-review/SKILL.md",
  "skills/vendor/ponytail/skills/ponytail-audit/SKILL.md",
  "skills/vendor/ponytail/skills/ponytail-debt/SKILL.md",
];

test("opencode.json declara skills e instruções do harness", () => {
  const config = JSON.parse(ler("opencode.json"));
  assert.equal(config.$schema, "https://opencode.ai/config.json");
  assert.deepEqual(config.skills, ["./skills"]);
  assert.ok(config.instructions.includes("AGENTS.md"));
});

test("existem quatro agentes com frontmatter e modo subagent", () => {
  for (const caminho of AGENTES) {
    assert.ok(existe(caminho), `agente ausente: ${caminho}`);
    const texto = ler(caminho);
    assert.match(texto, /^---\r?\n/, `frontmatter ausente em ${caminho}`);
    assert.match(texto, /^mode:\s*subagent$/m, `mode subagent ausente em ${caminho}`);
    assert.match(texto, /^description:\s*\S+/m, `description ausente em ${caminho}`);

    // Só pode carregar skills explicitamente liberadas.
    assert.match(texto, /action:\s*skill/, `permissão de skill ausente em ${caminho}`);
    assert.match(texto, /resource:\s*"\*"\s*\r?\n\s*effect:\s*deny/, `deny global ausente em ${caminho}`);
  }
});

test("cada agente libera apenas skills que existem", () => {
  const existentes = [...SKILLS_PROJETO, ...SKILLS_VENDOR];
  for (const caminho of AGENTES) {
    const texto = ler(caminho);
    const liberadas = [
      ...texto.matchAll(/resource:\s*"([^"]+)"\s*\r?\n\s*effect:\s*allow/g),
    ].map((match) => match[1]);

    assert.ok(liberadas.length > 0, `nenhuma skill liberada em ${caminho}`);
    for (const id of liberadas) {
      assert.match(id, /^[a-z0-9-]+$/, `id de skill inválido em ${caminho}: ${id}`);
      const encontrada = existentes.some((skill) => skill.endsWith(`/${id}/SKILL.md`));
      assert.ok(encontrada, `skill liberada não existe: ${id} (${caminho})`);
    }
  }
});

test("o agente de teste é dedicado e não altera a implementação", () => {
  const texto = ler(".opencode/agents/teste-validacao.md");
  assert.match(texto, /teste e valida/i);
  assert.match(texto, /não corrige a\s+implementação/i);
  assert.match(texto, /node --test tests\//);
  assert.match(texto, /validar-local\.mjs/);
});

test("existem as quatro skills autorais e as quatro vendorizadas", () => {
  for (const caminho of [...SKILLS_PROJETO, ...SKILLS_VENDOR]) {
    assert.ok(existe(caminho), `skill ausente: ${caminho}`);
    assert.match(ler(caminho), /^---\r?\nname:\s*\S+/m, `frontmatter inválido: ${caminho}`);
  }
});

test("o vendor do Ponytail preserva licença, origem e adaptação", () => {
  const licenca = ler("skills/vendor/ponytail/LICENSE");
  assert.match(licenca, /MIT License/);
  assert.match(licenca, /Copyright \(c\) 2026 DietrichGebert/);
  assert.match(licenca, /Permission is hereby granted, free of charge/);

  const proveniencia = ler("skills/vendor/ponytail/PROVENANCE.md");
  assert.match(proveniencia, /96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/);
  assert.match(proveniencia, /5\.3\.3/);
  assert.match(proveniencia, /MIT/);

  const adaptacao = ler("skills/vendor/ponytail/ADAPTACAO.md");
  assert.match(adaptacao, /adaptad/i);
  assert.match(adaptacao, /não copiad/i);
  assert.match(adaptacao, /OpenCode/);
});

test("README traz chave, URL da Cloudflare e licença", () => {
  const readme = ler("README.md");
  assert.ok(readme.includes("P26-2A-B12E-0CFD-70CA-18E1"));
  assert.match(readme, /https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.pages\.dev/i);
  assert.match(readme, /MIT/);
  assert.match(readme, /Cloudflare Pages Functions/i);
  assert.match(readme, /Cloudflare D1/i);
  assert.match(readme, /Discord OAuth2/i);
});

test("AGENTS.md documenta harness, quatro agentes e agente de teste", () => {
  const doc = ler("AGENTS.md");
  assert.match(doc, /OpenCode/);
  assert.match(doc, /`skills\/`|skills\//);
  assert.match(doc, /teste e valida/i);
  assert.match(doc, /Ponytail/);
  assert.match(doc, /96608e078b2d5ea607c5c3b8b5a54d1c1fba6846/);

  const titulos = doc.match(/^#{2,4}\s+.*(?:Agente|Agent)\b.*$/gim) ?? [];
  assert.ok(titulos.length >= 4, `esperava 4 títulos de agente, achei ${titulos.length}`);
});

test("o rodapé do HTML exibe a chave única", () => {
  const html = ler("public/index.html");
  assert.ok(html.includes("P26-2A-B12E-0CFD-70CA-18E1"));
  assert.match(html, /<footer/i);
});

test("não sobraram skills do scaffold", () => {
  const pastas = readdirSync(join(RAIZ, "skills"), { withFileTypes: true })
    .filter((entrada) => entrada.isDirectory())
    .map((entrada) => entrada.name);
  assert.equal(pastas.includes("serverless-d1-discord"), false);
  assert.equal(pastas.includes("vanilla-dom-ui"), false);
});
