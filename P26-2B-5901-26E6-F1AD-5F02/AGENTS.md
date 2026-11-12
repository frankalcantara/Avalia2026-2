# Engenharia de Agentes

Projeto #16: Plataforma de Estudos por Flashcards (Repetição Espaçada)
Chave Única: `P26-2B-5901-26E6-F1AD-5F02`

## Harness

Os agentes foram definidos como arquivos de instruções em `.claude/agents/` (formato dos subagentes do Claude Code) e executados no **chat do Claude (claude.ai)**: o conteúdo de cada arquivo foi colado como instrução, junto com a tarefa e o código a revisar. Os skills usados ficam em `skills/`. Os resultados de cada execução estão em `qa/`.

## Agente 1: qa-validador (teste e validação)

- **Arquivo:** `.claude/agents/qa-validador.md`
- **Papel:** agente de **teste e validação**. Roda `npm test`, tenta burlar as regras do servidor (chamada sem sessão, cartão de outro usuário, avaliação inválida, cartão ainda não vencido) e confere a rubrica.
- **Skills usados:** `skills/sm2-review/SKILL.md`.
- **Execução:** revisou `functions/api/study/review.js`. Os 5 testes passaram e as simulações de ataque retornaram 401, 400, 404 e 409 como esperado. Achou que um corpo JSON `null` causava erro 500, corrigido em `review.js`, `decks.js` e `cards.js`.
- **Resultado:** `qa/relatorio-qa-validador.md`.

## Agente 2: arquiteto-backend

- **Arquivo:** `.claude/agents/arquiteto-backend.md`
- **Papel:** projetar e implementar o backend serverless: migrations do D1, login Discord OAuth2, Cloudflare Pages Functions e regras de negócio no servidor.
- **Skills usados:** `skills/cloudflare-d1-oauth/SKILL.md` e `skills/sm2-review/SKILL.md`.
- **Execução:** revisou `functions/api/decks.js`. Confirmou autoria por `user_id` em todas as consultas e ausência de SQL concatenado. Registrou melhorias de robustez no `DELETE` e um limite de baralhos por usuário, e a correção do corpo `null` foi aplicada.
- **Resultado:** `qa/relatorio-arquiteto-backend.md`.

## Agente 3: frontend-vanilla

- **Arquivo:** `.claude/agents/frontend-vanilla.md`
- **Papel:** construir a interface em HTML5, CSS3 e JavaScript puro, com a animação CSS de virar o cartão, os botões Difícil, Bom e Fácil, responsividade e acessibilidade.
- **Skills usados:** nenhum skill de projeto; segue as regras do próprio arquivo do agente (sem frameworks, `textContent` em vez de `innerHTML`, `prefers-reduced-motion`).
- **Execução:** revisou `public/app.js`. Achou que o atributo `hidden` não escondia os botões de avaliação por causa do CSS, e que as exclusões não tratavam erro. As duas correções foram aplicadas.
- **Resultado:** `qa/relatorio-frontend-vanilla.md`.

## Fluxo entre os agentes

1. O **arquiteto-backend** define o esquema do banco e as rotas em `functions/`.
2. O **frontend-vanilla** consome apenas o contrato da API (`/api/...`).
3. O **qa-validador** executa os testes e tenta ataques ao servidor. Falhas voltam ao agente responsável.

## Skills versionados

- `skills/sm2-review/SKILL.md`: regras e tabela do algoritmo de revisão espaçada.
- `skills/cloudflare-d1-oauth/SKILL.md`: padrões de sessão, OAuth e consultas com controle de autoria.
