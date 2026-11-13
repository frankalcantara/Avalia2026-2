#!/usr/bin/env node
/**
 * .github/scripts/encerrar-avaliacoes.mjs
 * Workflow manual para encerramento de entregas:
 * 1. Lista todos os Pull Requests abertos para a branch main.
 * 2. Filtra pela turma solicitada (ou todas as turmas).
 * 3. Rejeita e fecha imediatamente qualquer Pull Request de teste (T26-...).
 * 4. Inspeciona o código, consulta a IA, registra as notas oficiais no D1 e comenta no PR.
 *
 * IMPORTANTE: este script NUNCA faz merge. O merge oficial é manual, feito pelo professor
 * somente a partir de 20/11/2026.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { inspecionarSubpasta } from "../../validar-local.mjs";

const API_BASE = (process.env.PROJETOS_API_BASE || "https://frank-active-reader.frank-alcantara.workers.dev").replace(/\/+$/, "");
const VALIDATION_TOKEN = process.env.PROJETOS_VALIDATION_TOKEN || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const DEEPSEEK_API_KEY = (process.env.DEEPSEEK_API_KEY || "").trim();
const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "deepseek-flash").trim();
const REPO = process.env.GITHUB_REPOSITORY || "frankalcantara/Avalia2026-2";
const TURMA_FILTRO = (process.env.TURMA_FILTRO || "todas").trim().toUpperCase();

const KEY_REGEX = /^(P26|T26)-(2A|2B|2C|2D|3A|3B)-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

// Data a partir da qual o professor fará os merges MANUAIS. Nenhum merge é automatizado.
const DATA_MERGE_MANUAL = "20/11/2026";

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

async function comentarNoPr(prNumber, markdown) {
  if (!GITHUB_TOKEN || !prNumber) return;
  await githubApi(`/repos/${REPO}/issues/${prNumber}/comments`, {
    method: "POST",
    body: JSON.stringify({ body: markdown }),
  });
}

async function adicionarLabelsNoPr(prNumber, labels) {
  if (!GITHUB_TOKEN || !prNumber || !labels.length) return;
  await githubApi(`/repos/${REPO}/issues/${prNumber}/labels`, {
    method: "POST",
    body: JSON.stringify({ labels }),
  });
}

async function fecharPr(prNumber) {
  if (!GITHUB_TOKEN || !prNumber) return false;
  const { ok, status, data } = await githubApi(`/repos/${REPO}/pulls/${prNumber}`, {
    method: "PATCH",
    body: JSON.stringify({ state: "closed" }),
  });
  if (!ok) {
    console.warn(`[PR #${prNumber}] Falha ao fechar o PR (HTTP ${status}):`, JSON.stringify(data));
    return false;
  }
  console.log(`[PR #${prNumber}] ✓ Pull Request fechado (sem merge).`);
  return true;
}

async function recusarTeste(prNumber, chave, student, motivo) {
  const nome = student?.nomeCompleto ? `**${student.nomeCompleto}**` : "estudante";
  await comentarNoPr(
    prNumber,
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
      `> Nenhum Pull Request é mesclado antes de **${DATA_MERGE_MANUAL}**. O merge oficial é feito manualmente pelo professor.`,
    ].join("\n")
  );
  await adicionarLabelsNoPr(prNumber, [
    "status:teste-bloqueado",
    ...(student?.turma ? [`turma:${student.turma}`] : []),
  ]);
  await fecharPr(prNumber);
}

async function listarArquivosDoPr(prNumber) {
  const files = [];
  let page = 1;
  while (page <= 10) {
    const { ok, data } = await githubApi(`/repos/${REPO}/pulls/${prNumber}/files?per_page=100&page=${page}`);
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
  console.log(`==================================================================`);
  console.log(`  RODADA DE ENCERRAMENTO E AVALIAÇÃO DE ENTREGAS COM IA`);
  console.log(`  Filtro de Turma: ${TURMA_FILTRO}`);
  console.log(`  Repositório: ${REPO}`);
  console.log(`==================================================================\n`);

  // 1. Buscar todos os PRs abertos
  const { ok, data: openPrs } = await githubApi(`/repos/${REPO}/pulls?state=open&per_page=100`);
  if (!ok || !Array.isArray(openPrs) || openPrs.length === 0) {
    console.log("Nenhum Pull Request aberto encontrado para avaliar.");
    return;
  }

  console.log(`Total de PRs abertos encontrados: ${openPrs.length}\n`);

  const results = [];

  for (const pr of openPrs) {
    const prNumber = pr.number;
    console.log(`--- Processando PR #${prNumber} (${pr.title}) ---`);

    const changedFiles = await listarArquivosDoPr(prNumber);
    const topFolders = new Set();
    let invalidIsolation = false;

    for (const file of changedFiles) {
      const parts = file.split("/");
      if (parts.length < 2) {
        invalidIsolation = true;
      } else {
        topFolders.add(parts[0].toUpperCase());
      }
    }

    if (invalidIsolation || topFolders.size !== 1) {
      console.warn(`[PR #${prNumber}] Violação de isolamento de subpasta. Ignorando.`);
      continue;
    }

    const chave = Array.from(topFolders)[0];
    if (!KEY_REGEX.test(chave)) {
      console.warn(`[PR #${prNumber}] Nome de pasta inválido: ${chave}. Ignorando.`);
      continue;
    }

    // Bloqueio imediato de qualquer entrega de teste (T26-...)
    if (chave.startsWith("T26-")) {
      console.log(`[PR #${prNumber}] Entrega de TESTE (${chave}). Rejeitando e fechando — nunca será mesclada.`);
      await recusarTeste(
        prNumber,
        chave,
        null,
        "Entregas com chave de teste (T26-...) não são aceitas neste repositório."
      );
      continue;
    }

    // 2. Validar a chave no Worker Cloudflare D1
    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "Avalia2026-BatchEvaluator/1.0",
    };
    if (VALIDATION_TOKEN) headers.Authorization = `Bearer ${VALIDATION_TOKEN}`;

    const validarUrl = `${API_BASE}/api/projetos2026/validar?chave=${encodeURIComponent(chave)}`;
    const valRes = await fetch(validarUrl, { headers });
    const valData = await valRes.json().catch(() => ({}));

    if (!valRes.ok || !valData.valid) {
      console.warn(`[PR #${prNumber}] Chave ${chave} não validada no banco. Ignorando.`);
      continue;
    }

    const { student, project, isTest } = valData;

    // Bloqueio defensivo: a API também pode classificar a entrega como teste
    if (isTest) {
      console.log(`[PR #${prNumber}] API classificou como teste (${chave}). Rejeitando e fechando.`);
      await recusarTeste(
        prNumber,
        chave,
        student,
        "A API classificou esta entrega como Projeto 0 (teste, sem nota)."
      );
      continue;
    }

    // Filtro por turma
    if (TURMA_FILTRO !== "TODAS" && student.turma.toUpperCase() !== TURMA_FILTRO) {
      console.log(`[PR #${prNumber}] Turma ${student.turma} não corresponde ao filtro ${TURMA_FILTRO}. Pulando.`);
      continue;
    }

    console.log(`[PR #${prNumber}] Aluno: ${student.nomeCompleto} | RA: ${student.ra} | Turma: ${student.turma} | Projeto #${project.id}`);

    // 3. Fazer checkout dos arquivos do PR para a subpasta local
    try {
      execSync(`git fetch origin pull/${prNumber}/head:pr-${prNumber} --depth 1`, { stdio: "ignore" });
      execSync(`git checkout pr-${prNumber} -- ${chave}`, { stdio: "ignore" });
    } catch (err) {
      console.error(`[PR #${prNumber}] Falha ao baixar arquivos do PR:`, err.message);
      continue;
    }

    const folderPath = path.resolve(process.cwd(), chave);
    if (!fs.existsSync(folderPath)) {
      console.warn(`[PR #${prNumber}] Pasta local ${chave} não encontrada após checkout.`);
      continue;
    }

    // 4. Inspecionar subpasta e executar avaliação
    const { checks, cloudflareUrl, dossier } = await inspecionarSubpasta(folderPath, chave, { checkLiveUrl: true });

    const externalAiEvaluation = await consultarAiEvaluation({
      student,
      project,
      isTest,
      checks,
      dossier,
    });

    const evalRes = await fetch(`${API_BASE}/api/projetos2026/avaliar`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        chave,
        prNumber,
        prUrl: pr.html_url,
        githubRepoUrl: pr.head?.repo?.html_url || "",
        cloudflareUrl,
        checks,
        dossier,
        externalAiEvaluation,
      }),
    });

    const evalData = await evalRes.json().catch(() => null);
    if (!evalRes.ok || !evalData?.ok) {
      console.error(`[PR #${prNumber}] Erro ao chamar avaliador:`, evalData?.message);
      continue;
    }

    console.log(`[PR #${prNumber}] Avaliação IA concluída com sucesso! Nota: ${evalData.scoreTotal}/100 pts.`);

    // 5. Postar o comentário final de nota no PR
    await comentarNoPr(prNumber, evalData.markdownReport);

    // 6. NUNCA fazemos merge automático. O merge oficial é manual (a partir de 20/11/2026).
    console.log(
      `[PR #${prNumber}] ✓ Avaliado e mantido ABERTO. Merge será manual a partir de ${DATA_MERGE_MANUAL}.`
    );

    const labels = [`turma:${student.turma}`, `nota:${evalData.scoreTotal}`, "status:avaliado"];
    await adicionarLabelsNoPr(prNumber, labels);

    results.push({
      prNumber,
      aluno: student.nomeCompleto,
      ra: student.ra,
      turma: student.turma,
      chave,
      projeto: `#${project.id}`,
      nota: evalData.scoreTotal,
      merge: "manual",
    });
  }

  console.log(`\n==================================================================`);
  console.log(`  RESUMO DA RODADA DE AVALIAÇÃO (${results.length} PRs processados)`);
  console.log(`==================================================================`);
  console.table(results);
}

main();
