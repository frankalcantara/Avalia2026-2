#!/usr/bin/env node
/**
 * .github/scripts/avaliar-pr.mjs
 * Pipeline Automatizado de Verificação de Pull Requests para frankalcantara/Avalia2026-2
 *
 * Etapa 1: Lê os arquivos do PR, verifica isolamento na pasta <CHAVE>/, valida a chave no endpoint
 *          de auditoria (identificando aluno, RA, turma e projeto).
 *          - Pull Requests de Teste (T26-...): são REJEITADOS e FECHADOS imediatamente.
 *          - Pull Requests Oficiais (P26-...): são avaliados e MANTIDOS ABERTOS.
 *          Este script NUNCA faz merge. O merge oficial é manual, feito pelo professor
 *          somente a partir de 20/11/2026.
 * Etapa 2: Inspeciona a subpasta e publica o checklist preliminar de conformidade técnica no PR.
 */

import fs from "node:fs";
import path from "node:path";
import { inspecionarSubpasta } from "../../validar-local.mjs";

const API_BASE = (process.env.PROJETOS_API_BASE || "https://frank-active-reader.frank-alcantara.workers.dev").replace(/\/+$/, "");
const VALIDATION_TOKEN = process.env.PROJETOS_VALIDATION_TOKEN || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const DEEPSEEK_API_KEY = (process.env.DEEPSEEK_API_KEY || "").trim();
const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "deepseek-flash").trim();
const REPO = process.env.GITHUB_REPOSITORY || "frankalcantara/Avalia2026-2";
const PR_NUMBER = Number(process.env.PR_NUMBER || 0);
const PR_HTML_URL = process.env.PR_HTML_URL || `https://github.com/${REPO}/pull/${PR_NUMBER}`;
const PR_HEAD_REPO_URL = process.env.PR_HEAD_REPO_URL || "";

const KEY_REGEX = /^(P26|T26)-(2A|2B|2C|2D|3A|3B)-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

async function githubApi(endpoint, options = {}) {
  const url = endpoint.startsWith("http") ? endpoint : `https://api.github.com${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function comentarNoPr(markdown) {
  if (!GITHUB_TOKEN || !PR_NUMBER) {
    console.log("\n--- COMENTÁRIO DO PR (MODO SIMULAÇÃO) ---\n" + markdown);
    return;
  }
  await githubApi(`/repos/${REPO}/issues/${PR_NUMBER}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: markdown }),
  });
}

async function adicionarLabelsNoPr(labels) {
  if (!GITHUB_TOKEN || !PR_NUMBER || !labels.length) return;
  await githubApi(`/repos/${REPO}/issues/${PR_NUMBER}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels }),
  });
}

async function fecharPr() {
  if (!GITHUB_TOKEN || !PR_NUMBER) {
    console.log("[Simulação] O Pull Request seria fechado sem merge.");
    return false;
  }
  const { ok, status, data } = await githubApi(`/repos/${REPO}/pulls/${PR_NUMBER}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
  if (!ok) {
    console.warn(`Falha ao fechar o PR #${PR_NUMBER} (HTTP ${status}):`, JSON.stringify(data));
    return false;
  }
  console.log(`✓ Pull Request #${PR_NUMBER} fechado (sem merge).`);
  return true;
}

async function recusarPullRequestDeTeste({ chave, student, motivo }) {
  const nome = student?.nomeCompleto ? `**${student.nomeCompleto}**` : "estudante";
  await comentarNoPr(
    [
      `## ❌ Pull Request de Teste Rejeitado e Fechado`,
      ``,
      `Olá, ${nome}! Este repositório **não aceita Pull Requests de teste (\`T26-...\`)**.`,
      ``,
      `- **Pasta/Chave detectada:** \`${chave}\``,
      `- **Motivo:** ${motivo}`,
      `- **Ação automática:** Pull Request fechado, sem merge e sem avaliação.`,
      ``,
      `O Projeto 0 é apenas um treino local/de deploy: **não abra Pull Request com a chave de teste** (\`T26-...\`).`,
      `Quando receber a sua Chave Oficial (\`P26-...\`), abra um novo Pull Request contendo **apenas** a pasta \`P26-.../\`.`,
      ``,
      `> Nenhum Pull Request é mesclado antes de **20/11/2026**. O merge oficial é feito manualmente pelo professor.`,
    ].join("\n")
  );
  await adicionarLabelsNoPr([
    "status:teste-bloqueado",
    ...(student?.turma ? [`turma:${student.turma}`] : []),
  ]);
  await fecharPr();
}

async function listarArquivosDoPr() {
  const files = [];
  let page = 1;
  while (page <= 10) {
    const { ok, data } = await githubApi(`/repos/${REPO}/pulls/${PR_NUMBER}/files?per_page=100&page=${page}`);
    if (!ok || !Array.isArray(data) || data.length === 0) break;
    for (const item of data) {
      files.push(item.filename);
    }
    if (data.length < 100) break;
    page++;
  }
  return files;
}

async function consultarAiEvaluation({ student, project, isTest, checks, dossier }) {
  if (DEEPSEEK_API_KEY) {
    try {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEEPSEEK_MODEL,
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Você é o avaliador assistente da disciplina do Prof. Frank de Alcantara. Retorne um JSON com { scores: { deploy (0-25), backend (0-25), frontend (0-15), agents (0-25), repo (0-10) }, summary, strengths: [], improvements: [] }.",
            },
            {
              role: "user",
              content: `Modalidade: ${isTest ? "Teste Sem Nota" : "Oficial"}\nAluno: ${student.nomeCompleto}\nProjeto #${project.id}: ${project.title}\nDescrição: ${project.description}\nChecks: ${JSON.stringify(checks)}\nDossiê:\n${String(dossier).slice(0, 50000)}`,
            },
          ],
        }),
      });
      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (content) {
          return { ...JSON.parse(content), modelUsed: `deepseek/${DEEPSEEK_MODEL}` };
        }
      } else {
        console.warn(`[DeepSeek API] Status ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      console.warn("[DeepSeek API] Erro na consulta:", err.message);
    }
  }

  if (GITHUB_TOKEN) {
    try {
      const res = await fetch("https://models.inference.ai.azure.com/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "Você é o avaliador assistente da disciplina do Prof. Frank de Alcantara. Retorne um JSON com { scores: { deploy (0-25), backend (0-25), frontend (0-15), agents (0-25), repo (0-10) }, summary, strengths: [], improvements: [] }.",
            },
            {
              role: "user",
              content: `Modalidade: ${isTest ? "Teste Sem Nota" : "Oficial"}\nAluno: ${student.nomeCompleto}\nProjeto #${project.id}: ${project.title}\nDescrição: ${project.description}\nChecks: ${JSON.stringify(checks)}\nDossiê:\n${String(dossier).slice(0, 28000)}`,
            },
          ],
        }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      if (!content) return null;
      return { ...JSON.parse(content), modelUsed: "github-models/gpt-4o-mini" };
    } catch {
      return null;
    }
  }

  return null;
}

async function main() {
  if (!PR_NUMBER) {
    console.error("PR_NUMBER ausente.");
    process.exit(1);
  }

  // 1. Verificar os arquivos alterados pelo Pull Request
  const changedFiles = await listarArquivosDoPr();
  if (changedFiles.length === 0) {
    await comentarNoPr("❌ **Pull Request Rejeitado:** Nenhum arquivo foi encontrado neste Pull Request.");
    process.exit(1);
  }

  const topFolders = new Set();
  const rootFilesTouched = [];

  for (const file of changedFiles) {
    const parts = file.split("/");
    if (parts.length < 2) {
      rootFilesTouched.push(file);
    } else {
      topFolders.add(parts[0].toUpperCase());
    }
  }

  if (rootFilesTouched.length > 0 || topFolders.size !== 1) {
    await comentarNoPr(
      [
        `## ❌ Pull Request Inválido — Violação de Isolamento de Subpasta`,
        ``,
        `Seu Pull Request deve adicionar ou modificar arquivos **exclusivamente dentro da pasta nomeada com a sua Chave Única** (\`P26-.../\` ou \`T26-.../\`).`,
        ``,
        `- **Pastas de topo detectadas:** ${Array.from(topFolders).map((f) => `\`${f}/\``).join(", ") || "nenhuma"}`,
        ...(rootFilesTouched.length > 0
          ? [`- **Arquivos fora da sua pasta que não podem ser alterados:** ${rootFilesTouched.map((f) => `\`${f}\``).join(", ")}`]
          : []),
        ``,
        `Execute \`node iniciar.mjs SUA-CHAVE\` e faça \`git add SUA-CHAVE/\` para enviar apenas a sua pasta.`,
      ].join("\n")
    );
    process.exit(1);
  }

  const chave = Array.from(topFolders)[0];
  if (!KEY_REGEX.test(chave)) {
    await comentarNoPr(
      `## ❌ Formato de Pasta Inválido (\`${chave}/\`)\n\nA pasta deve ter exatamente o nome da sua Chave Oficial (\`P26-TURMA-XXXX-XXXX-XXXX-XXXX\`) ou da sua Chave de Teste (\`T26-TURMA-XXXX-XXXX-XXXX-XXXX\`).`
    );
    process.exit(1);
  }

  // 1.1. Bloqueio imediato de qualquer entrega de teste (T26-...)
  if (chave.startsWith("T26-")) {
    console.log(`✗ Pull Request de teste detectado (${chave}). Rejeitando e fechando...`);
    await recusarPullRequestDeTeste({
      chave,
      motivo: "Entregas com chave de teste (T26-...) não são aceitas neste repositório.",
    });
    process.exit(0);
  }

  // 2. Validar a Chave no Endpoint do Worker (frankalcantara.com/api/projetos2026/validar)
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Avalia2026-Evaluator/1.0 (GitHubActions)",
  };
  if (VALIDATION_TOKEN) {
    headers.Authorization = `Bearer ${VALIDATION_TOKEN}`;
  }

  const validarUrl = `${API_BASE}/api/projetos2026/validar?chave=${encodeURIComponent(chave)}`;
  console.log(`[Validar] Consultando: ${validarUrl}`);
  const valRes = await fetch(validarUrl, {
    method: "GET",
    headers,
  });
  const valText = await valRes.text();
  let valData = {};
  try {
    valData = JSON.parse(valText);
  } catch (err) {
    console.error(`[Validar] Erro no parse JSON (HTTP ${valRes.status}):`, valText.slice(0, 300));
  }
  console.log(`[Validar] HTTP ${valRes.status} -> valid: ${valData.valid}, student: ${valData.student?.nomeCompleto || "N/A"}`);

  if (!valRes.ok || !valData.valid) {
    await comentarNoPr(
      [
        `## ❌ Não Foi Possível Identificar o Aluno ou Validar a Chave (\`${chave}\`)`,
        ``,
        `- **Motivo:** ${valData.message || valData.error || "Chave não localizada no sistema de sorteio."}`,
        ``,
        `Verifique se você copiou a chave corretamente em \`https://frankalcantara.com/projetos2026\` e se já confirmou o e-mail de recebimento.`,
      ].join("\n")
    );
    process.exit(1);
  }

  const { student, project, isTest } = valData;

  // 2.1. Bloqueio defensivo: a API também pode classificar a entrega como teste
  if (isTest) {
    console.log(`✗ A API classificou ${chave} como Projeto 0 (teste). Rejeitando e fechando...`);
    await recusarPullRequestDeTeste({
      chave,
      student,
      motivo: "A API classificou esta entrega como Projeto 0 (teste, sem nota).",
    });
    process.exit(0);
  }

  // 3. Aluno e Projeto identificados com sucesso — merge NUNCA é automático
  console.log(`✓ Aluno identificado: ${student.nomeCompleto} (RA: ${student.ra}, Turma: ${student.turma})`);
  console.log(`✓ Projeto Oficial P26: Pull Request #${PR_NUMBER} mantido ABERTO (merge manual, a partir de 20/11/2026).`);

  await comentarNoPr(
    [
      `## ✅ Etapa 1 Concluída: Aluno Identificado e Entrega Registrada com Sucesso!`,
      ``,
      `- **Estudante:** ${student.nomeCompleto}`,
      `- **RA (Matrícula):** \`${student.ra}\``,
      `- **Turma:** \`${student.turma}\``,
      `- **Chave Validada:** \`${chave}\` (🏆 **Projeto Oficial Sorteado — Valendo 0 a 100 pontos**)`,
      `- **Projeto Correspondente:** **#${project.id} — ${project.title}**`,
      `- **Status do Pull Request:** Aberto e Registrado ✅ (nenhum merge é feito automaticamente; o merge oficial será manual, a partir de 20/11/2026)`,
      ``,
      `⏳ *Iniciando pré-inspeção técnica da subpasta \`${chave}/\` e verificação do deploy no Cloudflare...*`,
    ].join("\n")
  );

  // 4. Etapa 2: Inspecionar a subpasta do aluno
  let targetFolder = chave;
  if (!fs.existsSync(path.resolve(process.cwd(), chave))) {
    const entries = fs.readdirSync(process.cwd());
    const match = entries.find((e) => e.toUpperCase() === chave.toUpperCase());
    if (match) targetFolder = match;
  }
  const folderPath = path.resolve(process.cwd(), targetFolder);
  const { checks, cloudflareUrl, dossier } = await inspecionarSubpasta(folderPath, chave, { checkLiveUrl: true });

  const checklistMarkdown = [
      `## 📋 Diagnóstico Preliminar de Entrega — Projeto #${project.id} (\`${chave}\`)`,
      ``,
      `Olá, **${student.nomeCompleto}**! Seu Pull Request foi registrado e inspecionado com sucesso.`,
      ``,
      `### Status dos Pré-Requisitos Técnicos`,
      `| Item Verificado | Status | Diagnóstico |`,
      `| :--- | :---: | :--- |`,
      `| **1. Deploy Online no Cloudflare** | ${checks.cloudflareOnline ? "✅ OK" : "⚠️ PENDENTE"} | ${checks.cloudflareOnline ? `Online em ${cloudflareUrl}` : "Não foi possível conectar à URL da Cloudflare informada no README"} |`,
      `| **2. Serverless (Functions + D1 + Discord OAuth2)** | ${checks.hasCloudflareFunctions && checks.hasD1BindingOrSql ? "✅ OK" : "⚠️ PENDENTE"} | Functions: ${checks.hasCloudflareFunctions ? "Sim" : "Não"} · D1: ${checks.hasD1BindingOrSql ? "Sim" : "Não"} · Discord OAuth2: ${checks.hasDiscordOAuth ? "Sim" : "Não"} |`,
      `| **3. Frontend HTML5/CSS3/JS Vanilla** | ${checks.hasVanillaFrontend && !checks.hasProhibitedFrameworks ? "✅ OK" : "⚠️ ATENÇÃO"} | ${checks.hasProhibitedFrameworks ? "Frameworks proibidos detectados" : "HTML/CSS/JS puro"} |`,
      `| **4. Engenharia de Agentes (Mín. 3 Agentes + Teste + Skills)** | ${checks.hasAgentsDoc && checks.hasTestingAgent && checks.skillsCount >= 3 ? "✅ OK" : "⚠️ PENDENTE"} | Agentes: ${checks.agentsCountDetected} · Agente de Teste: ${checks.hasTestingAgent ? "Sim" : "Não"} · Skills: ${checks.skillsCount} |`,
      `| **5. Licença MIT + Chave no README e Rodapé** | ${checks.hasMitLicense && checks.hasReadmeWithHash && checks.localHtmlHasHash ? "✅ OK" : "⚠️ PENDENTE"} | MIT: ${checks.hasMitLicense ? "Sim" : "Não"} · README: ${checks.hasReadmeWithHash ? "Sim" : "Não"} · Rodapé: ${checks.localHtmlHasHash ? "Sim" : "Não"} |`,
      ``,
      `💡 **Observação:** Seu Pull Request permanece **ABERTO**. Você pode continuar realizando commits e melhorias no seu repositório à vontade (o Pull Request atualizará sozinho a cada \`git push\`). A avaliação por Inteligência Artificial com atribuição de nota final (0 a 100) e o merge oficial serão executados pelo professor na data de encerramento das entregas.`,
    ].join("\n");

  await comentarNoPr(checklistMarkdown);
  await adicionarLabelsNoPr([`turma:${student.turma}`, "status:aguardando-avaliacao"]);
}

main();
