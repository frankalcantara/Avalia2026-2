#!/usr/bin/env node
/**
 * iniciar.mjs — Inicializador Zero-Dependências para Avalia2026-2
 * Compatível com Node.js instalado em modo usuário via Scoop nos laboratórios da instituição.
 * Uso:
 *   node iniciar.mjs <SUA-CHAVE-P26-E26-OU-T26>
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const API_BASE = process.env.PROJETOS_API_BASE || "https://frankalcantara.com";
const KEY_REGEX = /^(P26|E26|T26)-(2A|2B|2C|2D|3A|3B)-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i;

function banner(title) {
  console.log("\n==================================================================");
  console.log(`  ${title}`);
  console.log("==================================================================");
}

function diagnosticarAmbienteScoop() {
  banner("1. DIAGNÓSTICO DO AMBIENTE (NODE.JS / SCOOP / GIT)");

  const nodeVersion = process.version;
  const major = Number(nodeVersion.replace(/^v/, "").split(".")[0]);
  const execPath = process.execPath;
  const homeDir = os.homedir();
  const isScoop =
    execPath.toLowerCase().includes("scoop") ||
    fs.existsSync(path.join(homeDir, "scoop", "apps", "nodejs")) ||
    fs.existsSync(path.join(homeDir, "scoop", "apps", "nodejs-lts"));

  console.log(`✓ Sistema Operacional : ${os.platform()} (${os.release()})`);
  console.log(`✓ Versão do Node.js   : ${nodeVersion}`);
  console.log(`✓ Executável Node     : ${execPath}`);
  console.log(`✓ Instalação Scoop    : ${isScoop ? "Detectada em modo usuário (~/scoop) ✅" : "Padrão do sistema ✅"}`);

  if (major < 18) {
    console.error(
      "\n[ERRO] É necessário Node.js v18 ou superior. No laboratório com Scoop, execute:\n" +
      "  scoop update nodejs-lts   (ou scoop install nodejs-lts)"
    );
    process.exit(1);
  }

  try {
    const gitVer = execSync("git --version", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    console.log(`✓ Git disponível      : ${gitVer}`);
  } catch {
    console.warn("⚠ Aviso: comando 'git' não encontrado no PATH atual. Verifique se o Git está instalado no Scoop (scoop install git).");
  }

  if (os.platform() === "win32") {
    console.log(
      "\n💡 DICA PARA COMPUTADORES DA INSTITUIÇÃO (WINDOWS + SCOOP):\n" +
      "   - Sempre execute scripts com 'node nome-do-script.mjs' (não depende de ExecutionPolicy do PowerShell).\n" +
      "   - Se o PowerShell bloquear 'npm' ou 'npx' (.ps1), use 'npm.cmd' e 'npx.cmd' (ex: npx.cmd wrangler ...)."
    );
  }
}

async function consultarChaveNoServidor(chave, offlineMode) {
  banner("2. VALIDAÇÃO DA CHAVE E IDENTIFICAÇÃO DO PROJETO");

  const isTest = chave.startsWith("T26-");
  const isExame = chave.startsWith("E26-");
  const turma = chave.split("-")[1];

  if (offlineMode) {
    console.log("⚠ Modo --offline ativado: gerando estrutura local sem consultar a API remota.");
    return {
      valid: true,
      isTest,
      isExame,
      graded: !isTest,
      student: {
        turma,
        ra: "000000",
        nomeCompleto: "Estudante (Modo Offline)",
        studentHash: chave,
      },
      project: isTest
        ? {
            id: 0,
            title: "Projeto 0 (Teste de Ambiente e Entrega — Sem Nota): Painel de Diagnóstico Cloudflare + D1 + Discord",
            description:
              "Projeto universal de treinamento (sem sorteio e sem nota) que todos os estudantes realizam igualmente para validar o ambiente Node.js via Scoop, o deploy de subpasta no Cloudflare Pages com D1 e o fluxo de entrega via Pull Request.",
          }
        : isExame
          ? {
              id: 1,
              title: "Projeto de Exame / Recuperação Sorteado (Consulte https://frankalcantara.com/projetos2026/exame)",
              description: "Substitua pela descrição oficial recebida no seu e-mail de confirmação de recuperação.",
            }
          : {
              id: 1,
              title: "Projeto Oficial Sorteado (Consulte https://frankalcantara.com/projetos2026)",
              description: "Substitua pela descrição oficial recebida no seu e-mail de confirmação.",
            },
    };
  }

  const url = `${API_BASE}/api/projetos2026/validar?chave=${encodeURIComponent(chave)}`;
  console.log(`Consultando: ${url} ...`);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data.valid) {
      if (data.error === "draw_not_confirmed_yet") {
        console.error(
          `\n[ATENÇÃO] Sua chave (${chave}) foi sorteada, mas você ainda não clicou no link de confirmação enviado para o seu e-mail!\n` +
          `1. Abra seu e-mail e confirme o recebimento para liberar o tema sorteado.\n` +
          `2. Enquanto isso, você JÁ PODE treinar todo o processo usando sua Chave de Teste: ${data.student?.testHash || "T26-..."}\n`
        );
        process.exit(1);
      }
      throw new Error(data.message || `Chave não validada pelo servidor (HTTP ${res.status}).`);
    }

    const modalidade = data.isTest
      ? "PROJETO 0 DE TESTE (Sem Sorteio · Sem Nota)"
      : (data.isExame || isExame)
        ? "PROJETO DE EXAME / RECUPERAÇÃO (Valendo 0 a 100 pontos · Prazo: 10/12/2026 23:59)"
        : "PROJETO OFICIAL (Valendo 0 a 100 pontos)";
    console.log(`✓ Estudante identificado : ${data.student.nomeCompleto} (RA: ${data.student.ra} · Turma: ${data.student.turma})`);
    console.log(`✓ Modalidade da Chave    : ${modalidade}`);
    console.log(`✓ Projeto Vinculado      : #${data.project.id} — ${data.project.title}`);
    return { ...data, isExame: Boolean(data.isExame || isExame) };
  } catch (err) {
    console.error(`\n[ERRO DE VALIDAÇÃO] ${err.message}`);
    console.error(
      "Se o computador do laboratório estiver temporariamente sem acesso externo, você pode testar a criação da pasta com:\n" +
      `  node iniciar.mjs ${chave} --offline`
    );
    process.exit(1);
  }
}

function escreverArquivoSeguro(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (fs.existsSync(filePath)) {
    console.log(`  [mantido] ${path.relative(process.cwd(), filePath)} (já existe)`);
    return;
  }
  fs.writeFileSync(filePath, content, "utf8");
  console.log(`  [criado]  ${path.relative(process.cwd(), filePath)}`);
}

function gerarEstruturaSubpasta(info) {
  const { student, project, isTest, isExame } = info;
  const chave = student.studentHash;
  const isExameKey = Boolean(isExame || String(chave).startsWith("E26-"));
  const rootDir = path.resolve(process.cwd(), chave);

  banner(`3. CRIANDO ESTRUTURA DA SUBPASTA: ${chave}/`);

  fs.mkdirSync(rootDir, { recursive: true });
  const anoAtual = new Date().getFullYear();
  const slugLower = chave.toLowerCase();

  // 1. LICENSE (MIT Obrigatória)
  const licenseText = `MIT License

Copyright (c) ${anoAtual} ${student.nomeCompleto} (${chave})

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;

  // 2. README.md da Subpasta
  const readmeText = `# Projeto #${project.id}: ${project.title}

- **Modalidade:** ${isTest ? "Projeto 0 — Teste de Ambiente e Entrega (Sem Sorteio e Sem Nota)" : isExameKey ? "Projeto de Exame / Recuperação (Valendo 100 pontos · Prazo: 10/12/2026 23:59)" : "Projeto Oficial Sorteado (Valendo 100 pontos)"}
- **Estudante:** ${student.nomeCompleto}
- **Turma:** ${student.turma}
- **Chave Única:** \`${chave}\`
- **URL_CLOUDFLARE:** \`https://${slugLower}.pages.dev\` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*

---

## Especificação do Projeto

${project.description}

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório \`Avalia2026-2\`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** \`${chave}\`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** \`public\`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   \`\`\`powershell
   cd ${chave}
   npx.cmd wrangler d1 create db-${slugLower}
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   \`\`\`
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** \`DB\`
     - **D1 database:** selecione o banco que você criou (\`db-${slugLower}\`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       \`https://${slugLower}.pages.dev/api/auth/discord/callback\`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - \`DISCORD_CLIENT_ID\`
       - \`DISCORD_CLIENT_SECRET\`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste \`README.md\` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute \`node validar-local.mjs ${chave}\` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
`;

  // 3. AGENTS.md (Documentação obrigatória dos 3+ agentes e do Harness)
  const agentsMd = `# Documentação de Engenharia de Agentes e Harness (${chave})

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta \`skills/\`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** *(Descreva aqui qual harness foi utilizado, ex: Antigravity / Claude Code / Cursor / Cline / GitHub Copilot Workspace / OpenHands)*
- **Modelo(s) Base:** *(Informe os modelos utilizados pelos agentes)*
- **Estratégia de Coordenação:** Os agentes operaram de forma modular sobre a subpasta \`${chave}/\`, compartilhando especificações de banco de dados D1, contratos JSON das Cloudflare Pages Functions e verificação automatizada via \`validar-local.mjs\`.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (\`migrations/0001_init.sql\`), implementação do fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (\`functions/\`).
- **Skill Utilizada:** [\`skills/serverless-d1-discord/SKILL.md\`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Estruturação das tabelas e índices no Cloudflare D1.
  - Proteção das rotas serverless contra manipulação no cliente.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** Construção da interface responsiva e acessível utilizando exclusivamente HTML5 semântico, CSS3 moderno (sem sombras em fontes) e JavaScript puro (Vanilla JS), consumindo as rotas serverless via \`fetch\`.
- **Skill Utilizada:** [\`skills/vanilla-dom-ui/SKILL.md\`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - Componentes visuais em \`public/index.html\`, \`public/styles.css\` e \`public/app.js\`.
  - Inclusão do cabeçalho de perfil do Discord (\`user_id\`, nome e avatar) e rodapé oficial com a Chave Única \`${chave}\`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** Verificação independente de ponta a ponta: inspeção de contratos de API, tentativa de contorno das validações do servidor, auditoria da rubrica de 100 pontos e execução de testes funcionais.
- **Skill Utilizada:** [\`skills/teste-validacao/SKILL.md\`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - Bateria de verificação de integridade dos endpoints e conformidade com a rubrica (\`validar-local.mjs\` e casos de teste documentados abaixo).
  - Relatório de validação confirmando ausência de frameworks proibidos, presença da licença MIT e funcionamento no Cloudflare.
`;

  // 4. Skills versionadas na pasta skills/
  const skillServerless = `---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (\`functions/api/*\`).
2. **Queries Parametrizadas no D1:** Sempre utilizar \`env.DB.prepare("...").bind(...)\` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar \`user_id\`, \`username\` e \`avatar\` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie \`HttpOnly\`.
`;

  const skillFrontend = `---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar \`text-shadow\` ou \`filter: drop-shadow(...)\` em elementos de texto. Utilizar contraste de cor, peso tipográfico (\`700\`/\`800\`) e pílulas de fundo sólidas.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (\`${chave}\`) no elemento \`<footer>\` da aplicação.
`;

  const skillTest = `---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de \`${chave}/\`.
2. **Teste Anti-Manipulação:** Verificar que chamadas \`POST\`/\`PUT\`/\`PATCH\` para \`/api/*\` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (\`400\`, \`401\`, \`403\`, \`409\`).
3. **Conformidade de Entrega:** Executar \`node validar-local.mjs ${chave}\` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.
`;

  // 5. wrangler.jsonc
  const wranglerJsonc = `{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "projeto-${slugLower}",
  "compatibility_date": "2026-03-01",
  "pages_build_output_dir": "./public",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "db-${slugLower}",
      "database_id": "00000000-0000-0000-0000-000000000000"
    }
  ]
}
`;

  // 6. migrations/0001_init.sql
  const migrationSql = `-- Esquema Inicial Cloudflare D1 para ${chave} (Projeto #${project.id})
CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  chave_projeto TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_records_user ON project_records(user_id);
`;

  // 7. functions/api/status.js
  const functionStatusJs = `/**
 * Cloudflare Pages Function — /api/status
 * Verifica conectividade com o Cloudflare D1, sessão Discord OAuth2 e permite registrar pings de diagnóstico.
 */
export async function onRequest(context) {
  const { request, env } = context;
  const chave = ${JSON.stringify(chave)};
  const projectId = ${Number(project.id)};
  const projectTitle = ${JSON.stringify(project.title)};

  // Lê sessão real do Discord a partir do cookie HttpOnly se autenticado
  const cookieHeader = request.headers.get("Cookie") || "";
  let sessionUser = null;
  const sessionMatch = cookieHeader.match(/discord_session=([^;]+)/);
  if (sessionMatch) {
    try {
      sessionUser = JSON.parse(decodeURIComponent(atob(sessionMatch[1])));
    } catch {}
  }

  if (request.method === "GET") {
    let dbConnected = false;
    let totalRegistros = 0;
    let ultimosRegistros = [];

    if (env.DB) {
      try {
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS project_records (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, chave_projeto TEXT NOT NULL, conteudo TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ).run();
        const countRow = await env.DB.prepare("SELECT COUNT(*) AS total FROM project_records").first();
        const listRes = await env.DB.prepare("SELECT id, user_id, username, conteudo, created_at FROM project_records ORDER BY id DESC LIMIT 10").all();
        dbConnected = true;
        totalRegistros = Number(countRow?.total || 0);
        ultimosRegistros = listRes.results || [];
      } catch (err) {
        dbConnected = false;
      }
    }

    return Response.json({
      ok: true,
      chave,
      projectId,
      projectTitle,
      d1Connected: dbConnected,
      discordOAuthConfigured: Boolean(env.DISCORD_CLIENT_ID),
      sessionUser,
      totalRegistros,
      ultimosRegistros,
      serverTimestamp: new Date().toISOString(),
    });
  }

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const userId = String(body.userId || "discord_demo_user").trim().slice(0, 64);
    const username = String(body.username || "Estudante").trim().slice(0, 80);
    const conteudo = String(body.conteudo || "").trim().slice(0, 500);

    if (!conteudo) {
      return Response.json({ ok: false, error: "Conteúdo obrigatório." }, { status: 400 });
    }

    if (env.DB) {
      await env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS project_records (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, username TEXT NOT NULL, chave_projeto TEXT NOT NULL, conteudo TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
      ).run();
      await env.DB.prepare(
        "INSERT INTO project_records (user_id, username, chave_projeto, conteudo) VALUES (?, ?, ?, ?)"
      ).bind(userId, username, chave, conteudo).run();
    }

    return Response.json({
      ok: true,
      saved: Boolean(env.DB),
      chave,
      serverTimestamp: new Date().toISOString(),
    }, { status: 201 });
  }

  return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
`;

  // 8. functions/api/auth/discord.js
  const functionDiscordJs = `/**
 * Cloudflare Pages Function — /api/auth/discord
 * Endpoint de autenticação OAuth2 do Discord (importa user_id, username e avatar).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  if (!env.DISCORD_CLIENT_ID) {
    return Response.json({
      configured: false,
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages para login real, ou utilize o perfil de sessão local durante o diagnóstico.",
    });
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;
  const authorizeUrl = new URL("https://discord.com/api/oauth2/authorize");
  authorizeUrl.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "identify");

  return Response.redirect(authorizeUrl.href, 302);
}
`;

  // 8B. functions/api/auth/discord/callback.js
  const functionDiscordCallbackJs = `/**
 * Cloudflare Pages Function — /api/auth/discord/callback
 * Troca o authorization code pelo token de acesso do Discord, obtém o perfil (@me)
 * e persiste no Cloudflare D1 com cookie de sessão.
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return Response.redirect(new URL("/?auth_error=" + encodeURIComponent(error || "missing_code"), url.origin).href, 302);
  }

  if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET) {
    return Response.json({
      ok: false,
      error: "missing_credentials",
      message: "Defina DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET nas variáveis do Cloudflare Pages (Settings -> Environment variables).",
    }, { status: 500 });
  }

  const redirectUri = new URL("/api/auth/discord/callback", url.origin).href;

  try {
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID,
        client_secret: env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      return Response.redirect(new URL("/?auth_error=token_exchange_failed", url.origin).href, 302);
    }

    const tokenData = await tokenRes.json();
    const userRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: \`Bearer \${tokenData.access_token}\` },
    });

    if (!userRes.ok) {
      return Response.redirect(new URL("/?auth_error=fetch_user_failed", url.origin).href, 302);
    }

    const discordUser = await userRes.json();
    const userId = discordUser.id;
    const username = discordUser.global_name || discordUser.username;
    const avatar = discordUser.avatar
      ? \`https://cdn.discordapp.com/avatars/\${userId}/\${discordUser.avatar}.png\`
      : "https://cdn.discordapp.com/embed/avatars/0.png";

    if (env.DB) {
      try {
        await env.DB.prepare(
          "CREATE TABLE IF NOT EXISTS discord_users (user_id TEXT PRIMARY KEY, username TEXT NOT NULL, avatar TEXT, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"
        ).run();
        await env.DB.prepare(
          "INSERT INTO discord_users (user_id, username, avatar, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP) ON CONFLICT(user_id) DO UPDATE SET username = excluded.username, avatar = excluded.avatar, updated_at = CURRENT_TIMESTAMP"
        ).bind(userId, username, avatar).run();
      } catch {}
    }

    const sessionPayload = JSON.stringify({ userId, username, avatar });
    const encodedSession = btoa(encodeURIComponent(sessionPayload));

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/?login=success",
        "Set-Cookie": \`discord_session=\${encodedSession}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400; Secure\`,
      },
    });
  } catch (err) {
    return Response.redirect(new URL("/?auth_error=exception", url.origin).href, 302);
  }
}
`;

  // 9. public/styles.css
  const stylesCss = `*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

/* Regra estrita de tipografia: ZERO sombras em textos */
h1, h2, h3, p, span, label, button, input, textarea, code, strong, a, footer {
  text-shadow: none !important;
  filter: none !important;
}

body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
  background-color: #eef2f6;
  color: #0f172a;
  line-height: 1.5;
}

.topbar {
  background: #ffffff;
  border-bottom: 1px solid #dce4ef;
  padding: 0.9rem 1.5rem;
}

.topbar-inner {
  max-width: 960px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.discord-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #1d4ed8;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
}

main {
  flex: 1;
  max-width: 960px;
  width: 100%;
  margin: 0 auto;
  padding: 2rem 1.25rem;
}

.card {
  background: #ffffff;
  border: 1px solid #dce4ef;
  border-radius: 20px;
  padding: 1.75rem;
  margin-bottom: 1.25rem;
  box-shadow: 0 10px 26px -10px rgba(15, 23, 42, 0.07);
}

.pill {
  display: inline-block;
  background: #dcfce7;
  border: 1px solid #bbf7d0;
  color: #166534;
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  margin-bottom: 0.75rem;
}

h1 {
  font-size: 1.65rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
}

.desc {
  color: #475569;
  font-size: 0.95rem;
  margin-bottom: 1.25rem;
}

.form-row {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.input-text {
  flex: 1;
  min-width: 220px;
  padding: 0.75rem 1rem;
  border: 1.5px solid #cbd5e1;
  border-radius: 12px;
  font-size: 0.95rem;
  font-weight: 600;
}

.btn-primary {
  background: #0f172a;
  color: #ffffff;
  border: none;
  border-radius: 999px;
  padding: 0.75rem 1.4rem;
  font-size: 0.92rem;
  font-weight: 800;
  cursor: pointer;
}

.btn-primary:hover {
  background: #1e293b;
}

.records-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.records-list li {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  font-size: 0.9rem;
}

footer {
  text-align: center;
  padding: 1.25rem;
  background: #ffffff;
  border-top: 1px solid #dce4ef;
  font-size: 0.84rem;
  font-weight: 700;
  color: #334155;
}
`;

  // 10. public/index.html
  const indexHtml = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Projeto #${project.id} — ${chave}</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div>
        <strong>Projeto #${project.id}: ${project.title}</strong>
      </div>
      <div class="discord-badge" id="discordProfile">
        <a id="discordLoginLink" href="/api/auth/discord" style="color:inherit;text-decoration:none;">
          <span id="discordUserText">Entrar com Discord OAuth2</span>
        </a>
      </div>
    </div>
  </header>

  <main>
    <section class="card">
      <span class="pill">${isTest ? "Projeto 0 · Teste de Entrega (Sem Nota)" : isExameKey ? `Exame / Recuperação · Projeto #${project.id}` : `Projeto Oficial #${project.id}`}</span>
      <h1>${project.title}</h1>
      <p class="desc">${project.description.replace(/\n+/g, " ")}</p>

      <div class="form-row">
        <input class="input-text" id="recordInput" type="text" placeholder="Digite um registro para gravar na Cloudflare Function + D1...">
        <button class="btn-primary" id="sendBtn" type="button">Registrar no Cloudflare D1</button>
      </div>
      <div id="statusMessage" style="font-size:0.88rem;font-weight:700;color:#166534;margin-bottom:0.75rem;"></div>
    </section>

    <section class="card">
      <h2 style="font-size:1.15rem;font-weight:800;margin-bottom:0.85rem;">Registros Persistidos (Cloudflare Pages Functions + D1)</h2>
      <ul class="records-list" id="recordsList">
        <li>Carregando status da API serverless...</li>
      </ul>
    </section>
  </main>

  <footer id="projectFooter">
    Chave Única de Auditoria: <code>${chave}</code> · Turma ${student.turma} · Licenciado sob MIT
  </footer>

  <script src="/app.js"></script>
</body>
</html>
`;

  // 11. public/app.js
  const appJs = `const CHAVE_PROJETO = ${JSON.stringify(chave)};

const discordSession = {
  user_id: "discord_" + CHAVE_PROJETO.slice(-4).toLowerCase(),
  username: ${JSON.stringify(student.nomeCompleto.split(" ")[0] || "Estudante")},
  avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
};

function renderDiscordHeader() {
  const el = document.getElementById("discordUserText");
  if (el) {
    el.textContent = "Discord: " + discordSession.username + " (" + discordSession.user_id + ")";
  }
}

async function carregarStatus() {
  const listEl = document.getElementById("recordsList");
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    listEl.innerHTML = "";
        if (data.sessionUser) {
      discordSession.user_id = data.sessionUser.userId;
      discordSession.username = data.sessionUser.username;
      discordSession.avatar = data.sessionUser.avatar || discordSession.avatar;
      renderDiscordHeader();
    }
    const items = Array.isArray(data.ultimosRegistros) ? data.ultimosRegistros : [];
    if (items.length === 0) {
      const li = document.createElement("li");
      li.textContent = "API Online (" + (data.d1Connected ? "D1 Conectado ✅" : "Modo Diagnóstico Serverless ✅") + "). Nenhum registro gravado ainda.";
      listEl.appendChild(li);
      return;
    }
    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = "[" + (item.created_at || "agora") + "] " + item.username + " (" + item.user_id + "): " + item.conteudo;
      listEl.appendChild(li);
    });
  } catch (err) {
    listEl.innerHTML = "<li>Modo estático local. Publique no Cloudflare Pages para ativar /api/status.</li>";
  }
}

document.getElementById("sendBtn")?.addEventListener("click", async () => {
  const input = document.getElementById("recordInput");
  const statusEl = document.getElementById("statusMessage");
  const conteudo = (input.value || "").trim();
  if (!conteudo) return;

  statusEl.textContent = "Enviando para Cloudflare Function...";
  try {
    const res = await fetch("/api/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: discordSession.user_id,
        username: discordSession.username,
        conteudo,
      }),
    });
    if (res.ok) {
      input.value = "";
      statusEl.textContent = "✓ Registro validado e processado na borda!";
      await carregarStatus();
    } else {
      statusEl.textContent = "Erro ao registrar.";
    }
  } catch {
    statusEl.textContent = "API disponível após o deploy no Cloudflare Pages.";
  }
});

renderDiscordHeader();
carregarStatus();
`;

  escreverArquivoSeguro(path.join(rootDir, "LICENSE"), licenseText);
  escreverArquivoSeguro(path.join(rootDir, "README.md"), readmeText);
  escreverArquivoSeguro(path.join(rootDir, "AGENTS.md"), agentsMd);
  escreverArquivoSeguro(path.join(rootDir, "skills", "serverless-d1-discord", "SKILL.md"), skillServerless);
  escreverArquivoSeguro(path.join(rootDir, "skills", "vanilla-dom-ui", "SKILL.md"), skillFrontend);
  escreverArquivoSeguro(path.join(rootDir, "skills", "teste-validacao", "SKILL.md"), skillTest);
  escreverArquivoSeguro(path.join(rootDir, "wrangler.jsonc"), wranglerJsonc);
  escreverArquivoSeguro(path.join(rootDir, "migrations", "0001_init.sql"), migrationSql);
  escreverArquivoSeguro(path.join(rootDir, "functions", "api", "status.js"), functionStatusJs);
  escreverArquivoSeguro(path.join(rootDir, "functions", "api", "auth", "discord.js"), functionDiscordJs);
  escreverArquivoSeguro(path.join(rootDir, "functions", "api", "auth", "discord", "callback.js"), functionDiscordCallbackJs);
  escreverArquivoSeguro(path.join(rootDir, "public", "styles.css"), stylesCss);
  escreverArquivoSeguro(path.join(rootDir, "public", "index.html"), indexHtml);
  escreverArquivoSeguro(path.join(rootDir, "public", "app.js"), appJs);

  banner("4. PRÓXIMOS PASSOS PARA ENTREGA");
  console.log(`1. Desenvolva/ajuste seu projeto exclusivamente dentro da pasta: ${chave}/`);
  console.log(`2. No Cloudflare Pages, configure "Root directory" como: ${chave}`);
  console.log(`3. Atualize o campo URL_CLOUDFLARE no arquivo ${chave}/README.md`);
  console.log(`4. Antes de enviar seu Pull Request, valide tudo localmente com:`);
  console.log(`     node validar-local.mjs ${chave}`);
  console.log(`5. Faça o commit e envie para o seu fork:`);
  console.log(`     git add ${chave}`);
  console.log(`     git commit -m "Entrega ${chave}"`);
  console.log(`     git push origin main`);
  console.log(`6. Abra o Pull Request para https://github.com/frankalcantara/Avalia2026-2\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const offlineMode = args.includes("--offline");
  const rawKey = (args.find((a) => !a.startsWith("--")) || "").trim().toUpperCase();

  diagnosticarAmbienteScoop();

  if (!rawKey || !KEY_REGEX.test(rawKey)) {
    console.error(
      "\n[USO INCORRETO]\n" +
      "Informe sua Chave Única Oficial (P26-...), sua Chave de Exame/Recuperação (E26-...) ou sua Chave de Teste (T26-...):\n\n" +
      "  Exemplo (Projeto Oficial — Valendo 100 pontos):\n" +
      "    node iniciar.mjs P26-2A-9F8E-7D6C-5B4A-3210\n\n" +
      "  Exemplo (Exame / Recuperação — Valendo 100 pontos · Prazo: 10/12/2026 23:59):\n" +
      "    node iniciar.mjs E26-2A-4B3C-2D1E-9F8A-7654\n\n" +
      "  Exemplo (Projeto 0 de Teste — Sem Nota):\n" +
      "    node iniciar.mjs T26-2A-1A2B-3C4D-5E6F-7890\n"
    );
    process.exit(1);
  }

  const info = await consultarChaveNoServidor(rawKey, offlineMode);
  gerarEstruturaSubpasta(info);
}

main();
