# Engenharia de Agentes

Projeto #16: Plataforma de Estudos por Flashcards (Repetição Espaçada)
Chave Única: `P26-2B-5901-26E6-F1AD-5F02`

## Harness

Os agentes foram definidos para o **Claude Code** (CLI da Anthropic). Cada agente é um arquivo em `.claude/agents/` e os skills que eles usam ficam em `skills/`, ambos versionados neste repositório.

## Agente 1: arquiteto-backend

- **Arquivo:** `.claude/agents/arquiteto-backend.md`
- **Papel:** projetar e implementar o backend serverless: migrations do D1, login Discord OAuth2, Cloudflare Pages Functions e regras de negócio no servidor.
- **Skills usados:** `skills/cloudflare-d1-oauth/SKILL.md` e `skills/sm2-review/SKILL.md`.
- **Entregas:** `migrations/0001_init.sql`, `functions/_lib.js`, `functions/api/**`.

## Agente 2: frontend-vanilla

- **Arquivo:** `.claude/agents/frontend-vanilla.md`
- **Papel:** construir a interface em HTML5, CSS3 e JavaScript puro, com a animação CSS de virar o cartão, os botões Difícil, Bom e Fácil, responsividade e acessibilidade.
- **Skills usados:** nenhum skill de projeto; segue as regras do próprio arquivo do agente (sem frameworks, `textContent` em vez de `innerHTML`, `prefers-reduced-motion`).
- **Entregas:** `public/index.html`, `public/style.css`, `public/app.js`.

## Agente 3: qa-validador (teste e validação)

- **Arquivo:** `.claude/agents/qa-validador.md`
- **Papel:** agente de **teste e validação**. Roda `npm test`, tenta burlar as regras do servidor (chamada sem sessão, cartão de outro usuário, avaliação inválida, cartão ainda não vencido) e confere a rubrica de entrega.
- **Skills usados:** `skills/sm2-review/SKILL.md`.
- **Entregas:** relatório de falhas para os outros agentes; testes em `tests/sm2.test.mjs`.

## Fluxo entre os agentes

1. O **arquiteto-backend** define o esquema do banco e as rotas em `functions/`.
2. O **frontend-vanilla** consome apenas o contrato da API (`/api/...`).
3. O **qa-validador** executa os testes e tenta ataques ao servidor. Falhas voltam ao agente responsável.

## Skills versionados

- `skills/sm2-review/SKILL.md`: regras e tabela do algoritmo de revisão espaçada.
- `skills/cloudflare-d1-oauth/SKILL.md`: padrões de sessão, OAuth e consultas com controle de autoria.
