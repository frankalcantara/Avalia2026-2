#!/usr/bin/env node
/**
 * validar-local.mjs — Validador Local Pré-Pull Request (Zero-Dependências / Compatível com Scoop)
 * Verifica na máquina do laboratório se a pasta <CHAVE>/ cumpre todos os requisitos da rubrica de 100 pontos.
 * Uso:
 *   node validar-local.mjs <SUA-CHAVE-T26-OU-P26>
 */

import fs from "node:fs";
import path from "node:path";

const KEY_REGEX = /^(P26|T26)-(2A|2B|2C|2D|3A|3B)-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i;
const PROHIBITED_FRAMEWORKS = ["react", "react-dom", "vue", "next", "nuxt", "@angular/core", "svelte", "solid-js"];

function listarArquivosRecursivo(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".wrangler") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listarArquivosRecursivo(full, baseDir));
    } else {
      results.push(path.relative(baseDir, full).replace(/\\/g, "/"));
    }
  }
  return results;
}

function extrairConteudosFooter(html) {
  const blocos = [];
  const regex = /<footer\b[^>]*>([\s\S]*?)<\/footer>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    blocos.push(match[1]);
  }
  return blocos;
}

export async function inspecionarSubpasta(rootDir, chave, { checkLiveUrl = true } = {}) {
  const files = listarArquivosRecursivo(rootDir);
  const readText = (rel) => {
    const p = path.join(rootDir, rel);
    return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  };

  // 1. Licença MIT
  const licenseText = readText("LICENSE") || readText("LICENSE.md") || readText("LICENSE.txt");
  const hasMitLicense = /MIT License/i.test(licenseText) && /Permission is hereby granted, free of charge/i.test(licenseText);

  // 2. README.md com a Chave e URL da Cloudflare
  const readmeText = readText("README.md");
  const hasReadmeWithHash = readmeText.toUpperCase().includes(chave.toUpperCase());
  const urlMatch = readmeText.match(/https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:pages\.dev|workers\.dev|frankalcantara\.com)[^\s)`"']*/i);
  const cloudflareUrl = urlMatch ? urlMatch[0].replace(/[.,;]+$/, "") : "";

  // 3. Documento de Agentes e Harness (AGENTS.md) + pasta skills/
  const agentsDoc = readText("AGENTS.md") || readText("AGENTES.md") || readText("docs/AGENTS.md");
  const hasAgentsDoc = agentsDoc.trim().length > 120;
  const agentHeadings = agentsDoc.match(/^#{2,4}\s+.*(?:Agente|Agent)\b.*$/gim) || [];
  const agentsCountDetected = Math.max(agentHeadings.length, (agentsDoc.match(/\bAgente\s+[1-9]\b/gi) || []).length);
  const hasTestingAgent = /(?:teste|validação|validacao|qa|testing|auditoria)/i.test(agentsDoc);
  const skillFiles = files.filter((f) => /^skills\/.*\/SKILL\.md$/i.test(f) || /^skills\/.*\.md$/i.test(f));
  const skillsCount = skillFiles.length;

  // 4. Frontend HTML5/CSS3/JS Vanilla e Rodapé com a Chave
  const htmlFiles = files.filter((f) => f.endsWith(".html"));
  const jsFiles = files.filter((f) => f.endsWith(".js") || f.endsWith(".mjs"));
  const allHtmlContent = htmlFiles.map(readText).join("\n");
  const hasVanillaFrontend = htmlFiles.length > 0;
  const localHtmlHasHash = allHtmlContent.toUpperCase().includes(chave.toUpperCase());
  const localHtmlHasFooterElement = /<footer\b[^>]*>/i.test(allHtmlContent);
  const localHtmlFooterHasHash = extrairConteudosFooter(allHtmlContent).some((bloco) =>
    bloco.toUpperCase().includes(chave.toUpperCase())
  );

  let hasProhibitedFrameworks = false;
  const pkgJsonText = readText("package.json");
  if (pkgJsonText) {
    try {
      const pkg = JSON.parse(pkgJsonText);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
      if (PROHIBITED_FRAMEWORKS.some((fw) => Object.prototype.hasOwnProperty.call(deps, fw))) {
        hasProhibitedFrameworks = true;
      }
    } catch {
      // ignora erro de parse
    }
  }
  if (/unpkg\.com\/(?:react|vue)|esm\.sh\/(?:react|vue)|cdn\.jsdelivr\.net\/npm\/(?:react|vue)/i.test(allHtmlContent)) {
    hasProhibitedFrameworks = true;
  }

  // 5. Backend Serverless (Cloudflare Functions + D1 + Discord OAuth2)
  const functionFiles = files.filter((f) => f.startsWith("functions/") || f.startsWith("src/"));
  const sqlFiles = files.filter((f) => f.endsWith(".sql"));
  const wranglerText = readText("wrangler.jsonc") || readText("wrangler.toml") || readText("wrangler.json");
  const allBackendContent = [...functionFiles.map(readText), wranglerText].join("\n");

  const hasCloudflareFunctions = functionFiles.length > 0;
  const hasD1BindingOrSql = sqlFiles.length > 0 || /d1_databases|env\.DB/i.test(allBackendContent);
  const hasDiscordOAuth = /discord\.com\/api\/oauth2|DISCORD_CLIENT_ID|discord/i.test(allBackendContent + "\n" + jsFiles.map(readText).join("\n"));

  // 6. Verificação Online na Cloudflare
  let cloudflareOnline = false;
  let cloudflareHasHashInFooter = localHtmlHasHash;
  let hasFooterElement = localHtmlHasFooterElement;
  let footerHasHash = localHtmlFooterHasHash;
  if (checkLiveUrl && cloudflareUrl && !cloudflareUrl.includes("seu-projeto.pages.dev")) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(cloudflareUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        cloudflareOnline = true;
        const liveHtml = await res.text();
        if (liveHtml.toUpperCase().includes(chave.toUpperCase())) {
          cloudflareHasHashInFooter = true;
        }
        const liveFooterBlocks = extrairConteudosFooter(liveHtml);
        if (liveFooterBlocks.length > 0) {
          hasFooterElement = true;
        }
        if (liveFooterBlocks.some((bloco) => bloco.toUpperCase().includes(chave.toUpperCase()))) {
          footerHasHash = true;
        }
      }
    } catch {
      cloudflareOnline = false;
    }
  }

  // Monta dossiê resumido para avaliação por IA
  const dossierParts = [
    `ARQUIVOS NA SUBPASTA (${files.length}):\n${files.join("\n")}`,
    `--- README.md ---\n${readmeText.slice(0, 5000)}`,
    `--- AGENTS.md ---\n${agentsDoc.slice(0, 6000)}`,
    ...skillFiles.slice(0, 5).map((sf) => `--- ${sf} ---\n${readText(sf).slice(0, 2500)}`),
    `--- wrangler ---\n${wranglerText.slice(0, 2000)}`,
    ...sqlFiles.slice(0, 3).map((sq) => `--- ${sq} ---\n${readText(sq).slice(0, 3000)}`),
    ...functionFiles.slice(0, 6).map((ff) => `--- ${ff} ---\n${readText(ff).slice(0, 4000)}`),
    ...htmlFiles.slice(0, 3).map((hf) => `--- ${hf} ---\n${readText(hf).slice(0, 4000)}`),
  ];

  return {
    cloudflareUrl,
    checks: {
      cloudflareUrl,
      cloudflareOnline,
      cloudflareHasHashInFooter,
      localHtmlHasHash,
      hasFooterElement,
      footerHasHash,
      hasMitLicense,
      hasReadmeWithHash,
      hasAgentsDoc,
      agentsCountDetected,
      hasTestingAgent,
      skillsCount,
      hasVanillaFrontend,
      hasProhibitedFrameworks,
      hasCloudflareFunctions,
      hasD1BindingOrSql,
      hasDiscordOAuth,
    },
    dossier: dossierParts.join("\n\n").slice(0, 60000),
  };
}

async function main() {
  const rawKey = (process.argv[2] || "").trim().toUpperCase();
  if (!rawKey || !KEY_REGEX.test(rawKey)) {
    console.error("Uso: node validar-local.mjs <SUA-CHAVE-T26-OU-P26>");
    process.exit(1);
  }

  const folderPath = path.resolve(process.cwd(), rawKey);
  if (!fs.existsSync(folderPath)) {
    console.error(`[ERRO] A pasta ${rawKey}/ não existe. Execute primeiro: node iniciar.mjs ${rawKey}`);
    process.exit(1);
  }

  console.log(`\n🔍 Inspecionando a subpasta ${rawKey}/ ...`);
  const { checks, cloudflareUrl } = await inspecionarSubpasta(folderPath, rawKey, { checkLiveUrl: true });

  const rows = [
    ["1. Arquivo LICENSE (MIT)", checks.hasMitLicense],
    ["2. Chave Única no README.md", checks.hasReadmeWithHash],
    ["3. Chave Única no rodapé do HTML", checks.cloudflareHasHashInFooter],
    ["4. Documento AGENTS.md (Mín. 3 agentes)", checks.hasAgentsDoc && checks.agentsCountDetected >= 3],
    ["5. Agente de Teste e Validação documentado", checks.hasTestingAgent],
    ["6. Arquivos de Skills na pasta skills/", checks.skillsCount >= 1],
    ["7. Frontend HTML/CSS/JS Puro (Sem frameworks proibidos)", checks.hasVanillaFrontend && !checks.hasProhibitedFrameworks],
    ["8. Backend Cloudflare Functions + D1 + Discord OAuth2", checks.hasCloudflareFunctions && checks.hasD1BindingOrSql && checks.hasDiscordOAuth],
    [`9. Deploy Online na Cloudflare (${cloudflareUrl || "não informado"})`, checks.cloudflareOnline],
  ];

  console.log("\n==================================================================");
  console.log(`  RELATÓRIO DE PRÉ-VALIDAÇÃO LOCAL (${rawKey})`);
  console.log("==================================================================");
  let falhasCriticas = 0;
  for (const [label, ok] of rows) {
    console.log(`  ${ok ? "✅ [OK]    " : "⚠️ [PENDENTE]"} ${label}`);
    if (!ok) falhasCriticas++;
  }
  console.log("==================================================================\n");

  if (falhasCriticas > 0) {
    console.log(`⚠️ Atenção: ${falhasCriticas} item(ns) precisam de revisão antes da entrega final.`);
  } else {
    console.log("🎉 Tudo pronto! Sua subpasta cumpre todos os pré-requisitos estruturais para o Pull Request.");
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, "/")}` || process.argv[1]?.endsWith("validar-local.mjs")) {
  main();
}
