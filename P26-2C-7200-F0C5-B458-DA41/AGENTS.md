# Documentação de Engenharia de Agentes e Harness (P26-2C-7200-F0C5-B458-DA41)

> **Projeto #38 — Rastreador de Solicitações e Chamados Internos (Issue Tracker)**
> Estudante: Vitória Faranhas Braga · Turma 2C · RA 2026109204
>
> **Requisito da Rubrica (25 pontos):** no mínimo **3 agentes diferentes**, sendo obrigatoriamente **1 agente de teste e validação**, documentando o *harness* em que operaram e as *skills* da pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness:** **Claude Code** (harness agêntico da Anthropic, usado pelo aplicativo Claude), executando em um workspace Linux com shell, Node.js 22 e ferramentas de arquivo (`Read`, `Write`, `Edit`, `Bash`).
- **Modelo base dos três agentes:** Claude Opus 5.5 (`claude-opus-5-5`).
- **Como os agentes foram criados:** a sessão principal atuou como Agente 1 e orquestradora. Os Agentes 2 e 3 foram lançados como **subagentes independentes** pela ferramenta `Agent` do Claude Code. Cada um começou do zero, sem ver a conversa da sessão principal: recebeu apenas o seu prompt de papel (arquivos em [`agents/`](./agents)) e a sua skill (em [`skills/`](./skills)).
- **Estratégia de coordenação (contrato → construção → verificação):**
  1. O Agente 1 escreveu o banco, as regras e a API e publicou o **contrato JSON** das rotas.
  2. O Agente 2 construiu a interface só a partir desse contrato e da CSP, escrevendo exclusivamente em `public/`.
  3. O Agente 3, que não escreveu nenhuma funcionalidade, testou tudo e devolveu os defeitos. O Agente 1 corrigiu e o Agente 3 testou de novo (2 rodadas).
- **Isolamento:** todo o trabalho fica dentro de `P26-2C-7200-F0C5-B458-DA41/`, como exige o fluxo de Pull Request do repositório `frankalcantara/Avalia2026-2`.

```
                 contrato da API                      relatório de defeitos
  Agente 1  ─────────────────────▶  Agente 2         ◀──────────────────────┐
  Backend                           Interface                               │
  (functions/, migrations/)         (public/)                               │
      │                                 │                                   │
      └──────────── código ─────────────┴──────────▶  Agente 3  ────────────┘
                                                      Teste e Validação
                                                      (tests/)
```

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Definição:** [`agents/agente-1-arquiteto-backend.md`](./agents/agente-1-arquiteto-backend.md)
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Onde operou:** sessão principal do Claude Code, que também orquestrou os outros agentes.
- **Entregas:**
  - `migrations/0001_init.sql`: tabelas `users`, `sessions`, `tickets` e `ticket_events`, com `CHECK`, `UNIQUE`, chaves estrangeiras e índices.
  - `functions/_lib/rules.js`: regras puras.
    - Validação de campos e máquina de estados (`aberto → em_analise → aguardando → resolvido`; `resolvido` é final).
    - Permissões: técnico × autor.
    - Código único `CH-XXXXXX`, em Crockford Base32 com `crypto.getRandomValues`.
  - `functions/_lib/session.js`: sessões no D1. O cookie é HttpOnly, Secure e SameSite=Lax, e o banco guarda só o SHA-256 do token.
  - Fluxo **Discord OAuth2** (`/api/auth/discord` e `/api/auth/discord/callback`), com `state` anti-CSRF. Importa `user_id`, nome e avatar.
  - Rotas de chamados, comentários e mudança de estado:
    - mudança de estado protegida contra concorrência (`UPDATE ... WHERE status = ?`);
    - limite de 10 chamados por hora;
    - verificação de `Origin` em toda mutação.
  - **Correções pedidas pelo Agente 3:**
    - middleware de erros (`functions/api/_middleware.js`);
    - 503 quando o OAuth não está configurado;
    - 404 JSON para rotas inexistentes (`functions/api/[[path]].js`);
    - abertura de chamado atômica via `DB.batch`.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Definição:** [`agents/agente-2-ui-vanilla.md`](./agents/agente-2-ui-vanilla.md)
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Onde operou:** subagente independente do Claude Code. Só tinha permissão de escrita em `public/`.
- **Entregas:**
  - `public/index.html`, `public/styles.css`, `public/app.js` e `public/favicon.svg`, sem nenhum framework.
  - Roteador por hash: `#/` (painel), `#/novo` (abrir chamado) e `#/chamado/CH-XXXXXX` (detalhe).
  - Cabeçalho com avatar e nome do Discord. Cartões de contagem por estado. Filtros por estado, severidade, busca e "só meus".
  - **Linha do tempo visual** (`<ol class="timeline">`):
    - marcadores coloridos por estado;
    - avatar e nome de quem agiu;
    - data relativa, com a data completa no `title`;
    - barra de progresso dos 4 estados.
  - Botões de estado só aparecem para as transições permitidas pelo servidor. O comentário fica bloqueado depois de "Resolvido".
  - Anti-XSS: dado da API só entra no DOM via `textContent` e `createElement`, nunca `innerHTML`. Compatível com a CSP de `public/_headers`.
  - Responsivo (mobile first), modo escuro, foco visível e `aria-live`.
  - Rodapé com a Chave Única **P26-2C-7200-F0C5-B458-DA41**.
  - Testou a própria interface no Chrome headless com uma API simulada antes de entregar.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Definição:** [`agents/agente-3-teste-validacao.md`](./agents/agente-3-teste-validacao.md)
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Onde operou:** subagente independente do Claude Code. Não escreveu funcionalidades, só testes e relatório.
- **Método:**
  - Testes unitários com `node:test`, sem dependências: `tests/rules.test.mjs`.
  - Testes de API: `tests/api.test.mjs`.
    - Rodam contra `wrangler pages dev` com **Cloudflare D1 local** e sessões criadas direto no banco, porque o login real depende do Discord.
    - Tentam burlar o servidor: sem login, sem `Origin`, dados inválidos, transição pulando etapa, usuário comum tentando mover chamado, comentário em chamado fechado, corrida entre requisições simultâneas e `<script>` no título.
  - Validação da rubrica com `node validar-local.mjs P26-2C-7200-F0C5-B458-DA41`.
- **Resultado:** relatório completo em [`tests/RELATORIO-TESTES.md`](./tests/RELATORIO-TESTES.md).
  - **Rodada 1:** 114 testes, todos passaram. Encontrou 1 defeito (script `npm test` incompatível com o Node 22) e corrigiu. Levantou 5 observações para o Agente 1.
  - **Rodada 2:** depois das correções do Agente 1, **120 de 120 testes passaram**. Isso inclui os novos casos de erro 404/503, a atomicidade da abertura e o banco sem migração.

---

## 3. Skills (pasta `skills/`)

| Skill | Usada por | Conteúdo |
|---|---|---|
| [`serverless-d1-discord`](./skills/serverless-d1-discord/SKILL.md) | Agente 1 | estrutura de `functions/`, regras no servidor, códigos HTTP, máquina de estados, OAuth2 |
| [`vanilla-dom-ui`](./skills/vanilla-dom-ui/SKILL.md) | Agente 2 | proibições (frameworks, inline, innerHTML), padrões de DOM, linha do tempo, acessibilidade |
| [`teste-validacao`](./skills/teste-validacao/SKILL.md) | Agente 3 | protocolo de testes, tabela de casos obrigatórios, checagem da rubrica e relatório |

## 4. Como reproduzir

```bash
cd P26-2C-7200-F0C5-B458-DA41
npm test                                         # testes unitários
npx wrangler d1 migrations apply DB --local
npx wrangler pages dev public --port 8788 --binding ADMIN_DISCORD_IDS=<seu-id>
# em outro terminal: BASE_URL=http://localhost:8788 (+ tokens, ver tests/api.test.mjs) npm test
cd .. && node validar-local.mjs P26-2C-7200-F0C5-B458-DA41
```

Para recriar os agentes no Claude Code, copie os arquivos de `agents/` para `.claude/agents/` e os de `skills/` para `.claude/skills/`.
