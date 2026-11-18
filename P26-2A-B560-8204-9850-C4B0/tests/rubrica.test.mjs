import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

// Raiz do projeto derivada do próprio arquivo: a suíte precisa rodar em
// qualquer máquina (Linux/macOS/Windows) e no CI, nunca com caminho absoluto.
const PROJECT_DIR = path.resolve(import.meta.dirname, "..");
const read = (rel) => fs.existsSync(path.join(PROJECT_DIR, rel)) ? fs.readFileSync(path.join(PROJECT_DIR, rel), "utf8") : "";

describe("Validação estática da Rubrica (100 pontos)", () => {
  it("LICENSE existe com MIT License e texto padrão", () => {
    const license = read("LICENSE");
    assert.ok(license.length > 0, "LICENSE não encontrado");
    assert.ok(/MIT License/i.test(license));
    assert.ok(/Permission is hereby granted, free of charge/i.test(license));
  });

  it("README.md contém a Chave Única P26-2A-B560-8204-9850-C4B0", () => {
    const readme = read("README.md");
    assert.ok(readme.toUpperCase().includes("P26-2A-B560-8204-9850-C4B0"));
  });

  it("public/index.html tem <footer> com a Chave Única", () => {
    const html = read("public/index.html");
    assert.ok(/<footer\b[^>]*>/i.test(html), "Elemento <footer> não encontrado");
    const footerMatch = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i);
    assert.ok(footerMatch, "Footer não fechado corretamente");
    assert.ok(footerMatch[1].toUpperCase().includes("P26-2A-B560-8204-9850-C4B0"), "Chave única não está no rodapé");
  });

  it("public/_headers existe e contém Content-Security-Policy", () => {
    const headers = read("public/_headers");
    assert.ok(headers.length > 0, "public/_headers não encontrado");
    assert.ok(/Content-Security-Policy/i.test(headers));
  });

  it("wrangler.jsonc tem d1_databases com binding DB", () => {
    const wrangler = JSON.parse(read("wrangler.jsonc"));
    assert.ok(wrangler.d1_databases && Array.isArray(wrangler.d1_databases));
    const db = wrangler.d1_databases.find(d => d.binding === "DB");
    assert.ok(db, "Binding DB não encontrado em d1_databases");
  });

  it("migrations/0001_init.sql contém as 5 tabelas obrigatórias", () => {
    const sql = read("migrations/0001_init.sql");
    const tables = ["discord_users", "recipes", "recipe_ingredients", "recipe_steps", "favorites"];
    for (const t of tables) {
      assert.ok(new RegExp(`CREATE TABLE.*${t}`, "i").test(sql), `Tabela ${t} não encontrada na migration`);
    }
  });

  it("package.json não tem frameworks proibidos", () => {
    const pkg = JSON.parse(read("package.json"));
    const prohibited = ["react", "react-dom", "vue", "next", "nuxt", "@angular/core", "svelte", "solid-js"];
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
    for (const fw of prohibited) {
      assert.ok(!Object.prototype.hasOwnProperty.call(deps, fw), `Framework proibido ${fw} encontrado nas dependências`);
    }
  });

  it("public/index.html não carrega recursos externos proibidos", () => {
    const html = read("public/index.html");
    // Permitido: cdn.discordapp.com para avatares, xmlns do SVG do favicon
    // Proibido: fonts.googleapis.com, unpkg.com/react|vue, cdn.jsdelivr.net/npm/react|vue, esm.sh/react|vue
    const prohibitedPatterns = [
      /fonts\.googleapis\.com/i,
      /unpkg\.com\/(react|vue)/i,
      /cdn\.jsdelivr\.net\/npm\/(react|vue)/i,
      /esm\.sh\/(react|vue)/i,
    ];
    for (const pat of prohibitedPatterns) {
      assert.ok(!pat.test(html), `Recurso externo proibido detectado: ${pat}`);
    }
  });

  it("AGENTS.md cita pelo menos 3 agentes e um agente de teste/validação", () => {
    const agents = read("AGENTS.md");
    const agentHeadings = agents.match(/^#{2,4}\s+.*(?:Agente|Agent)\b.*$/gim) || [];
    const agentCount = Math.max(agentHeadings.length, (agents.match(/\bAgente\s+[1-9]\b/gi) || []).length);
    assert.ok(agentCount >= 3, `AGENTS.md deve documentar >= 3 agentes, encontrou ${agentCount}`);
    assert.ok(/(?:teste|validação|validacao|qa|testing|auditoria)/i.test(agents), "AGENTS.md deve citar agente de teste/validação");
  });

  it("pasta skills/ contém pelo menos 1 SKILL.md", () => {
    const skillsDir = path.join(PROJECT_DIR, "skills");
    assert.ok(fs.existsSync(skillsDir), "Pasta skills/ não existe");
    const skillFiles = fs.readdirSync(skillsDir).filter(f => fs.statSync(path.join(skillsDir, f)).isDirectory());
    assert.ok(skillFiles.length >= 1, "Nenhuma skill encontrada em skills/");
    for (const skill of skillFiles) {
      const skillFile = path.join(skillsDir, skill, "SKILL.md");
      assert.ok(fs.existsSync(skillFile), `SKILL.md não encontrado em skills/${skill}/`);
    }
  });
});