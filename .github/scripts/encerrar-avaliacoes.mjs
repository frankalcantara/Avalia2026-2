#!/usr/bin/env node
/**
 * .github/scripts/encerrar-avaliacoes.mjs
 * Pipeline totalmente automático por turma para encerramento, avaliação e merge:
 * 1. Pagina TODOS os Pull Requests abertos para a branch main (sem teto de 100 PRs).
 * 2. Fecha imediatamente PRs de turmas inexistentes (2D e 3B) com: "Esta turma não existe."
 * 3. Fecha automaticamente PRs de teste (T26-...) da turma filtrada (sem merge e sem nota).
 * 4. Verifica data de abertura e data do último commit de cada PR contra 20/11/2026 23:59 (BRT).
 * 5. Agrupa múltiplos PRs abertos do mesmo aluno (por login do GitHub E por chave P26-...):
 *    - Se houver pelo menos um PR válido dentro do prazo:
 *      • Fecha PRs atrasados com "Não foi considerado por ter sido enviado depois do prazo limite."
 *      • Fecha PRs anteriores com "Foi considerado apenas o último PR"
 *      • Avalia e faz merge (squash) do último PR dentro do prazo.
 *    - Se todos os PRs do aluno forem após o prazo:
 *      • Fecha os PRs com "Não foi considerado por ter sido enviado depois do prazo limite."
 *      • Lança nota -1 no D1.
 * 6. NUNCA posta comentário público de avaliação/nota nem label de nota no PR:
 *    - O Worker envia e-mail qualitativo (sem nenhum valor numérico de nota/pontuação) para preferred_email.
 *    - Deméritos e nota ponderada (2A/2B/2C = 7,5 | 3A = 7,75) ficam no relatório exclusivo em /projetos2026/admin.
 * 7. Pula alunos já avaliados, salvo se FORCE_REEVALUATE=true.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import { inspecionarSubpasta } from "../../validar-local.mjs";

const API_BASE = (process.env.PROJETOS_API_BASE || "https://frank-active-reader.frank-alcantara.workers.dev").replace(/\/+$/, "");
const VALIDATION_TOKEN = process.env.PROJETOS_VALIDATION_TOKEN || "";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";
const DEEPSEEK_API_KEY = (process.env.DEEPSEEK_API_KEY || "").trim();
const DEEPSEEK_MODEL = (process.env.DEEPSEEK_MODEL || "deepseek-flash").trim();
const REPO = process.env.GITHUB_REPOSITORY || "frankalcantara/Avalia2026-2";
const TURMA_FILTRO = (process.env.TURMA_FILTRO || "todas").trim().toUpperCase();
const MODO_FILTRO = (process.env.MODO_FILTRO || "todos").trim().toLowerCase();
const FORCE_REEVALUATE = String(process.env.FORCE_REEVALUATE || "false").trim().toLowerCase() === "true";
export const PRAZO_LIMITE_ISO = (process.env.PRAZO_LIMITE_ISO || "2026-11-20T23:59:59-03:00").trim();
export const PRAZO_LIMITE_MS = Date.parse(PRAZO_LIMITE_ISO);
export const PRAZO_EXAME_ISO = (process.env.PRAZO_EXAME_ISO || "2026-12-10T23:59:59-03:00").trim();
export const PRAZO_EXAME_MS = Date.parse(PRAZO_EXAME_ISO);

export const ACTIVE_TURMAS = new Set(["2A", "2B", "2C", "3A"]);
export const NON_EXISTENT_TURMAS = new Set(["2D", "3B"]);
export const KEY_REGEX = /^(P26|E26|T26)-(2A|2B|2C|2D|3A|3B)-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/;

export const MSG_DUPLICADO = "Foi considerado apenas o último PR";
export const MSG_ATRASADO = "Não foi considerado por ter sido enviado depois do prazo limite.";
export const MSG_TURMA_INEXISTENTE = "Esta turma não existe.";

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

async function fecharPr(prNumber, reasonMessage = "", labels = []) {
  if (!GITHUB_TOKEN || !prNumber) return false;
  if (reasonMessage) {
    await comentarNoPr(prNumber, reasonMessage);
  }
  if (labels.length > 0) {
    await adicionarLabelsNoPr(prNumber, labels);
  }
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

async function mesclarPrNoMain(prNumber, commitTitle) {
  if (!GITHUB_TOKEN || !prNumber) return { merged: false, error: "token_ausente" };
  for (const method of ["squash", "merge"]) {
    const { ok, status, data } = await githubApi(`/repos/${REPO}/pulls/${prNumber}/merge`, {
      method: "PUT",
      body: JSON.stringify({
        commit_title: commitTitle,
        merge_method: method,
      }),
    });
    if (ok && data?.merged) {
      console.log(`[PR #${prNumber}] ✓ Pull Request mesclado na branch main (${method})!`);
      return { merged: true, method, sha: data.sha || null };
    }
    console.warn(`[PR #${prNumber}] Tentativa de merge (${method}) retornou HTTP ${status}:`, data?.message || JSON.stringify(data));
    // Se conflito ou PR não mesclável, não adianta tentar outro método se for 405/409 de conflito de merge
    if (status === 409) {
      return { merged: false, status, error: data?.message || "merge_conflict" };
    }
  }
  return { merged: false, error: "merge_failed" };
}

async function recusarTeste(prNumber, chave, turma) {
  const msg = [
    `## ❌ Pull Request de Teste Rejeitado e Fechado`,
    ``,
    `Este repositório **não aceita Pull Requests de teste (\`T26-...\`)**.`,
    `- **Pasta/Chave detectada:** \`${chave}\``,
    `- **Ação automática:** Pull Request fechado sem merge e sem avaliação.`,
  ].join("\n");
  await fecharPr(prNumber, msg, [
    "status:teste-bloqueado",
    ...(turma ? [`turma:${turma}`] : []),
  ]);
}

export async function listarTodosPrsAbertos(apiFn = githubApi, repo = REPO, maxPages = 20) {
  const allPrs = [];
  let page = 1;
  while (page <= maxPages) {
    const { ok, data } = await apiFn(
      `/repos/${repo}/pulls?state=open&sort=created&direction=asc&per_page=100&page=${page}`
    );
    if (!ok || !Array.isArray(data) || data.length === 0) break;
    allPrs.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return allPrs;
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

async function listarCommitsDoPr(prNumber) {
  const commits = [];
  let page = 1;
  while (page <= 10) {
    const { ok, data } = await githubApi(`/repos/${REPO}/pulls/${prNumber}/commits?per_page=100&page=${page}`);
    if (!ok || !Array.isArray(data) || data.length === 0) break;
    commits.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return commits;
}

export function computeEffectiveSubmissionMs(pr, commits = []) {
  let maxMs = Date.parse(pr?.created_at || "") || 0;
  for (const c of commits || []) {
    const committerMs = Date.parse(c?.commit?.committer?.date || "") || 0;
    const authorMs = Date.parse(c?.commit?.author?.date || "") || 0;
    if (committerMs > maxMs) maxMs = committerMs;
    if (authorMs > maxMs) maxMs = authorMs;
  }
  return maxMs;
}

/**
 * Agrupa PRs candidatos por login do GitHub E por chave P26-... (Union-Find)
 * e decide para cada aluno:
 * - Se existe >= 1 PR válido dentro do prazo:
 *     winner = último PR dentro do prazo
 *     lateToClose = todos os PRs atrasados do grupo (sem gravar -1)
 *     duplicatesToClose = todos os PRs anteriores dentro do prazo ou inválidos do grupo
 * - Se NÃO existe nenhum PR válido dentro do prazo, mas existem PRs atrasados:
 *     lateToClose = todos os PRs atrasados do grupo
 *     lateRecordTarget = último PR atrasado com chave válida (para gravar -1 no D1)
 */
export function decideGroupActions(candidatePrs, deadlineMs = PRAZO_LIMITE_MS) {
  const n = candidatePrs.length;
  if (n === 0) return [];

  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  const firstByLogin = new Map();
  const firstByKey = new Map();

  for (let i = 0; i < n; i++) {
    const item = candidatePrs[i];
    const login = String(item.githubLogin || "").trim().toLowerCase();
    const key = String(item.chave || "").trim().toUpperCase();
    if (login) {
      if (firstByLogin.has(login)) union(i, firstByLogin.get(login));
      else firstByLogin.set(login, i);
    }
    if (key) {
      if (firstByKey.has(key)) union(i, firstByKey.get(key));
      else firstByKey.set(key, i);
    }
  }

  const groupsMap = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = groupsMap.get(root) || [];
    list.push(candidatePrs[i]);
    groupsMap.set(root, list);
  }

  const decisions = [];
  for (const group of groupsMap.values()) {
    const sorted = [...group].sort((a, b) => {
      if (a.effectiveMs !== b.effectiveMs) return a.effectiveMs - b.effectiveMs;
      return a.prNumber - b.prNumber;
    });

    const latePrs = [];
    const validOnTime = [];
    const invalidOnTime = [];

    for (const item of sorted) {
      const isLate = item.effectiveMs > deadlineMs;
      if (isLate) {
        latePrs.push(item);
      } else if (item.chave && !item.invalidIsolation) {
        validOnTime.push(item);
      } else {
        invalidOnTime.push(item);
      }
    }

    if (validOnTime.length > 0) {
      const winner = validOnTime[validOnTime.length - 1];
      const duplicatesToClose = [...validOnTime.slice(0, -1), ...invalidOnTime];
      decisions.push({
        winner,
        duplicatesToClose,
        lateToClose: latePrs,
        lateRecordTarget: null,
      });
    } else if (latePrs.length > 0) {
      const validLate = latePrs.filter((item) => item.chave && !item.invalidIsolation);
      const lateRecordTarget = validLate.length > 0 ? validLate[validLate.length - 1] : null;
      decisions.push({
        winner: null,
        duplicatesToClose: invalidOnTime,
        lateToClose: latePrs,
        lateRecordTarget,
      });
    }
  }

  return decisions;
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
                "Você é o avaliador assistente da disciplina do Prof. Frank de Alcantara. Retorne um JSON com { scores: { deploy (0-25), backend (0-25), frontend (0-15), agents (0-25), repo (0-10) }, summary (qualitativo, sem citar números de nota), strengths: [], improvements: [], demerits: [{ criterion, reason }] }.",
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
                "Você é o avaliador assistente da disciplina do Prof. Frank de Alcantara. Retorne um JSON com { scores: { deploy (0-25), backend (0-25), frontend (0-15), agents (0-25), repo (0-10) }, summary (qualitativo, sem citar números de nota), strengths: [], improvements: [], demerits: [{ criterion, reason }] }.",
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
  console.log(`  RODADA AUTOMÁTICA DE AVALIAÇÃO, E-MAIL PRIVADO E MERGE POR TURMA`);
  console.log(`  Filtro de Turma: ${TURMA_FILTRO}`);
  console.log(`  Modalidade: ${MODO_FILTRO.toUpperCase()}`);
  console.log(`  Prazo Limite Oficial (P26): ${PRAZO_LIMITE_ISO}`);
  console.log(`  Prazo Limite Exame (E26)  : ${PRAZO_EXAME_ISO}`);
  console.log(`  Reavaliar já avaliados: ${FORCE_REEVALUATE ? "SIM" : "NÃO (pular)"}`);
  console.log(`  Repositório: ${REPO}`);
  console.log(`==================================================================\n`);

  if (TURMA_FILTRO !== "TODAS" && NON_EXISTENT_TURMAS.has(TURMA_FILTRO)) {
    console.error(`Turma ${TURMA_FILTRO}: ${MSG_TURMA_INEXISTENTE}`);
    process.exit(1);
  }

  // 1. Paginar TODOS os Pull Requests abertos (sem limite de 100)
  const openPrs = await listarTodosPrsAbertos();
  if (openPrs.length === 0) {
    console.log("Nenhum Pull Request aberto encontrado.");
    return;
  }

  console.log(`Total de PRs abertos encontrados (todas as páginas): ${openPrs.length}\n`);

  const workerHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    "User-Agent": "Avalia2026-BatchEvaluator/2.0",
  };
  if (VALIDATION_TOKEN) workerHeaders.Authorization = `Bearer ${VALIDATION_TOKEN}`;

  const inspectedOfficial = [];
  const inspectedExame = [];
  const invalidPrsByLogin = new Map();
  const validOfficialLoginsInTargetTurma = new Set();
  const validExameLoginsInTargetTurma = new Set();

  // 2. Pré-classificação de cada PR aberto (isolamento, turmas 2D/3B, testes T26, filtro de turma e modalidade)
  for (const pr of openPrs) {
    const prNumber = pr.number;
    const githubLogin = String(pr.user?.login || "").trim();
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

    const singleFolder = !invalidIsolation && topFolders.size === 1 ? Array.from(topFolders)[0] : "";
    const keyMatch = singleFolder ? singleFolder.match(KEY_REGEX) : null;

    if (!keyMatch) {
      const loginLower = githubLogin.toLowerCase();
      if (loginLower) {
        const list = invalidPrsByLogin.get(loginLower) || [];
        list.push({
          pr,
          prNumber,
          githubLogin,
          chave: "",
          turmaFromKey: "",
          invalidIsolation: true,
          effectiveMs: Date.parse(pr.created_at || "") || 0,
        });
        invalidPrsByLogin.set(loginLower, list);
      }
      console.warn(`[PR #${prNumber}] Pasta/isolamento inválido (${Array.from(topFolders).join(", ") || "raiz"}).`);
      continue;
    }

    const chave = singleFolder;
    const prefix = keyMatch[1]; // P26, E26 ou T26
    const turmaFromKey = keyMatch[2]; // 2A, 2B, 2C, 2D, 3A, 3B

    // Regra 4: Turmas 2D e 3B não existem — fecha imediatamente com mensagem exata
    if (NON_EXISTENT_TURMAS.has(turmaFromKey)) {
      console.log(`[PR #${prNumber}] Turma ${turmaFromKey} inexistente (${chave}). Fechando PR.`);
      await fecharPr(prNumber, MSG_TURMA_INEXISTENTE, ["status:turma-inexistente"]);
      continue;
    }

    // Regra 8: PRs de teste (T26-...) são fechados automaticamente (respeitando filtro de turma)
    if (prefix === "T26") {
      if (TURMA_FILTRO === "TODAS" || turmaFromKey === TURMA_FILTRO) {
        console.log(`[PR #${prNumber}] Entrega de TESTE (${chave}). Fechando automaticamente.`);
        await recusarTeste(prNumber, chave, turmaFromKey);
      } else {
        console.log(`[PR #${prNumber}] PR de teste da turma ${turmaFromKey} fora do filtro ${TURMA_FILTRO}. Pulando.`);
      }
      continue;
    }

    const isExameKey = prefix === "E26";
    if (MODO_FILTRO === "oficial" && isExameKey) continue;
    if (MODO_FILTRO === "exame" && !isExameKey) continue;

    // Filtro por turma para PRs oficiais (P26) e de exame (E26)
    if (TURMA_FILTRO !== "TODAS" && turmaFromKey !== TURMA_FILTRO) {
      continue;
    }

    const commits = await listarCommitsDoPr(prNumber);
    const effectiveMs = computeEffectiveSubmissionMs(pr, commits);

    const entry = {
      pr,
      prNumber,
      githubLogin,
      chave,
      isExame: isExameKey,
      turmaFromKey,
      invalidIsolation: false,
      effectiveMs,
      effectiveIso: effectiveMs ? new Date(effectiveMs).toISOString() : pr.created_at,
    };

    if (isExameKey) {
      if (githubLogin) validExameLoginsInTargetTurma.add(githubLogin.toLowerCase());
      inspectedExame.push(entry);
    } else {
      if (githubLogin) validOfficialLoginsInTargetTurma.add(githubLogin.toLowerCase());
      inspectedOfficial.push(entry);
    }
  }

  // Anexa eventuais PRs antigos/inválidos do mesmo login para fechamento como duplicata (sem misturar P26 e E26)
  for (const loginLower of validOfficialLoginsInTargetTurma) {
    if (validExameLoginsInTargetTurma.has(loginLower)) continue;
    const extraInvalid = invalidPrsByLogin.get(loginLower) || [];
    for (const inv of extraInvalid) {
      inspectedOfficial.push(inv);
    }
  }
  for (const loginLower of validExameLoginsInTargetTurma) {
    const extraInvalid = invalidPrsByLogin.get(loginLower) || [];
    for (const inv of extraInvalid) {
      inspectedExame.push(inv);
    }
  }

  console.log(`PRs oficiais (P26) candidatos para ${TURMA_FILTRO}: ${inspectedOfficial.length}`);
  console.log(`PRs de exame (E26) candidatos para ${TURMA_FILTRO}: ${inspectedExame.length}\n`);

  // 3. Agrupar separadamente P26 (prazo 20/11) e E26 (prazo 10/12) por login + chave
  const decisions = [
    ...decideGroupActions(inspectedOfficial, PRAZO_LIMITE_MS),
    ...decideGroupActions(inspectedExame, PRAZO_EXAME_MS),
  ];
  const results = [];

  for (const decision of decisions) {
    // 3a. Fechar PRs duplicados anteriores ("Foi considerado apenas o último PR")
    for (const dup of decision.duplicatesToClose) {
      console.log(`[PR #${dup.prNumber}] Duplicata anterior de ${dup.githubLogin || dup.chave}. Fechando.`);
      await fecharPr(dup.prNumber, MSG_DUPLICADO, ["status:duplicado"]);
    }

    // 3b. Fechar PRs atrasados ("Não foi considerado por ter sido enviado depois do prazo limite.")
    for (const late of decision.lateToClose) {
      console.log(`[PR #${late.prNumber}] Enviado/atualizado após o prazo (${late.effectiveIso}). Fechando.`);
      await fecharPr(late.prNumber, MSG_ATRASADO, ["status:fora-do-prazo"]);
    }

    // 3c. Se o aluno só tinha PR(s) fora do prazo, grava nota -1 no D1
    if (!decision.winner && decision.lateRecordTarget) {
      const target = decision.lateRecordTarget;
      console.log(`[PR #${target.prNumber}] Registrando nota -1 no D1 para ${target.chave} (fora do prazo).`);
      const lateRes = await fetch(`${API_BASE}/api/projetos2026/avaliar`, {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({
          chave: target.chave,
          isLate: true,
          prNumber: target.prNumber,
          prUrl: target.pr.html_url,
          githubRepoUrl: target.pr.head?.repo?.html_url || "",
          githubLogin: target.githubLogin,
          prSubmittedAt: target.effectiveIso,
          forceReevaluate: FORCE_REEVALUATE,
        }),
      });
      const lateData = await lateRes.json().catch(() => null);
      if (lateRes.ok && lateData?.ok) {
        results.push({
          prNumber: target.prNumber,
          aluno: lateData.student?.nomeCompleto || target.githubLogin,
          ra: lateData.student?.ra || "-",
          turma: target.turmaFromKey,
          chave: target.chave,
          situacao: lateData.skipped ? "pulado (já registrado)" : "fora do prazo (-1)",
          notaFinal: -1,
          email: "não aplicável",
          merge: "fechado",
        });
      } else {
        console.warn(`[PR #${target.prNumber}] Falha ao gravar -1 no D1:`, lateData?.message || lateRes.status);
      }
      continue;
    }

    if (!decision.winner) continue;

    // 4. Processar o PR vencedor dentro do prazo
    const win = decision.winner;
    const { pr, prNumber, chave, githubLogin, effectiveIso } = win;
    console.log(`--- Avaliando PR #${prNumber} (${chave} | @${githubLogin}) ---`);

    const validarUrl = `${API_BASE}/api/projetos2026/validar?chave=${encodeURIComponent(chave)}`;
    const valRes = await fetch(validarUrl, { headers: workerHeaders });
    const valData = await valRes.json().catch(() => ({}));

    if (!valRes.ok || !valData.valid) {
      console.warn(`[PR #${prNumber}] Chave ${chave} não validada no banco. Ignorando.`);
      continue;
    }

    const { student, project, isTest, alreadyEvaluated } = valData;
    if (isTest) {
      console.log(`[PR #${prNumber}] API classificou como teste (${chave}). Fechando.`);
      await recusarTeste(prNumber, chave, student?.turma);
      continue;
    }

    if (TURMA_FILTRO !== "TODAS" && String(student.turma || "").toUpperCase() !== TURMA_FILTRO) {
      console.log(`[PR #${prNumber}] Turma ${student.turma} divergente do filtro ${TURMA_FILTRO}. Pulando.`);
      continue;
    }

    if (alreadyEvaluated && !FORCE_REEVALUATE) {
      console.log(`[PR #${prNumber}] Aluno ${student.nomeCompleto} (RA ${student.ra}) já avaliado. Pulando (reavaliar=false).`);
      results.push({
        prNumber,
        aluno: student.nomeCompleto,
        ra: student.ra,
        turma: student.turma,
        chave,
        situacao: "pulado (já avaliado)",
        notaFinal: "-",
        email: "mantido",
        merge: "ignorado",
      });
      continue;
    }

    // Checkout isolado da pasta do PR
    const folderPath = path.resolve(process.cwd(), chave);
    try {
      execSync(`git fetch origin pull/${prNumber}/head:pr-${prNumber} --depth 1`, { stdio: "ignore" });
      execSync(`git checkout pr-${prNumber} -- ${chave}`, { stdio: "ignore" });
    } catch (err) {
      console.error(`[PR #${prNumber}] Falha ao baixar arquivos do PR:`, err.message);
      continue;
    }

    if (!fs.existsSync(folderPath)) {
      console.warn(`[PR #${prNumber}] Pasta local ${chave} não encontrada após checkout.`);
      continue;
    }

    let inspection;
    try {
      inspection = await inspecionarSubpasta(folderPath, chave, { checkLiveUrl: true });
    } finally {
      // Limpa pasta local e branch temporária para não contaminar os próximos PRs
      try { fs.rmSync(folderPath, { recursive: true, force: true }); } catch {}
      try { execSync(`git reset -- ${chave}`, { stdio: "ignore" }); } catch {}
      try { execSync(`git branch -D pr-${prNumber}`, { stdio: "ignore" }); } catch {}
    }

    const { checks, cloudflareUrl, dossier } = inspection;

    const externalAiEvaluation = await consultarAiEvaluation({
      student,
      project,
      isTest: false,
      checks,
      dossier,
    });

    // Envia avaliação ao Worker: salva nota ponderada + deméritos no D1 e envia e-mail qualitativo (SEM nota) ao aluno
    const evalRes = await fetch(`${API_BASE}/api/projetos2026/avaliar`, {
      method: "POST",
      headers: workerHeaders,
      body: JSON.stringify({
        chave,
        prNumber,
        prUrl: pr.html_url,
        githubRepoUrl: pr.head?.repo?.html_url || "",
        githubLogin,
        prSubmittedAt: effectiveIso,
        cloudflareUrl,
        checks,
        dossier,
        externalAiEvaluation,
        forceReevaluate: FORCE_REEVALUATE,
        sendStudentEmail: true,
      }),
    });

    const evalData = await evalRes.json().catch(() => null);
    if (!evalRes.ok || !evalData?.ok) {
      console.error(`[PR #${prNumber}] Erro ao chamar avaliador:`, evalData?.message || evalRes.status);
      continue;
    }

    if (evalData.skipped) {
      console.log(`[PR #${prNumber}] Pulado pelo servidor (já avaliado).`);
      continue;
    }

    console.log(
      `[PR #${prNumber}] ✓ Avaliado! Rubrica: ${evalData.scoreTotal}/100 | Escala Turma ${student.turma}: ${evalData.weightedScore}/${evalData.turmaWeight} | E-mail aluno: ${evalData.feedbackEmailSent ? "enviado" : evalData.feedbackEmailError || "pendente"}`
    );

    // IMPORTANTE: NENHUM comentário público e NENHUMA label com nota no PR!
    const isExameEval = Boolean(evalData.isExame || chave.startsWith("E26-"));
    await adicionarLabelsNoPr(prNumber, [
      `turma:${student.turma}`,
      ...(isExameEval ? ["modalidade:exame"] : []),
      "status:avaliado",
    ]);

    // Faz merge na branch main (sem nota no título do commit)
    const mergeTitle = isExameEval
      ? `Entrega Exame/Recuperação ${chave} — ${student.nomeCompleto} (RA ${student.ra})`
      : `Entrega Oficial ${chave} — ${student.nomeCompleto} (RA ${student.ra})`;
    const mergeOutcome = await mesclarPrNoMain(prNumber, mergeTitle);
    if (mergeOutcome.merged) {
      await fetch(`${API_BASE}/api/projetos2026/avaliar`, {
        method: "POST",
        headers: workerHeaders,
        body: JSON.stringify({
          action: "mark_merged",
          chave,
          prNumber,
        }),
      }).catch(() => {});
    }

    results.push({
      prNumber,
      aluno: student.nomeCompleto,
      ra: student.ra,
      turma: student.turma,
      chave,
      situacao: "avaliado",
      notaFinal: evalData.weightedScore,
      email: evalData.feedbackEmailSent ? "enviado" : evalData.feedbackEmailError || "falhou",
      merge: mergeOutcome.merged ? `merged (${mergeOutcome.method})` : `falhou (${mergeOutcome.error})`,
    });
  }

  console.log(`\n==================================================================`);
  console.log(`  RESUMO DA RODADA AUTOMÁTICA (${results.length} alunos processados)`);
  console.log(`==================================================================`);
  console.table(results);
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]).toLowerCase() === path.resolve(fileURLToPath(import.meta.url)).toLowerCase();

if (isDirectExecution) {
  main();
}
