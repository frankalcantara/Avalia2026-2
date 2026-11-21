# Documentação de Engenharia de Agentes e Harness (P26-2A-A113-CCFD-DC47-AC0A)

> **Requisito da Rubrica (25 pontos):** no mínimo **3 agentes diferentes**, sendo **1 dedicado a teste e validação**, com o harness documentado e as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Claude (interface de chat web, claude.ai). Cada agente é uma conversa separada, iniciada com o conteúdo do `SKILL.md` correspondente como instrução de papel.
- **Modelo(s) Base:** Claude Sonnet 5.5 (família Claude, Anthropic).
- **Estratégia de Coordenação:** os agentes trabalham sobre a subpasta `P26-2A-A113-CCFD-DC47-AC0A/` e compartilham três contratos: o esquema do D1 (`migrations/`), o contrato JSON das Pages Functions (`/api/game/start`, `/api/game/pick`, `/api/game/leaderboard`, `/api/me`) e a suíte `tests/run-tests.mjs`.

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** esquema relacional no D1, login Discord OAuth2 e toda a regra de negócio no servidor.
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas:**
  - `migrations/0002_game.sql`: tabelas `games` e `game_cards`.
  - OAuth2 com parâmetro `state` anti-CSRF e cookie de sessão **assinado com HMAC-SHA256** (`functions/_lib/util.js`).
  - `functions/api/game/start.js`: embaralha no servidor com `crypto.getRandomValues` e devolve apenas tokens opacos.
  - `functions/api/game/pick.js`: valida o par no servidor, incrementa `moves` no D1 e grava a eficiência (pares ÷ movimentos) ao descobrir todos os pares, com `UPDATE` condicional contra jogadas duplicadas.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** interface responsiva em HTML5, CSS3 e JavaScript puro, sem frameworks.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`.
  - Cartas viradas com CSS 3D (`transform-style: preserve-3d`, `rotateY(180deg)`, `backface-visibility: hidden`) acionado por JavaScript.
  - Cabeçalho com `user_id`, nome e avatar do Discord; rodapé com a Chave Única.
  - A face de uma carta só é desenhada depois que o servidor a revela.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** verificação independente, sem editar o código de produção.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas:** `tests/run-tests.mjs` (`node tests/run-tests.mjs`). Executa as Functions reais contra um D1 simulado e cobre:
  - cookie forjado, expirado ou assinado com outro segredo (401);
  - origem diferente (403) e payload inválido (400);
  - partida de outro usuário e token inexistente (404);
  - jogada repetida, carta já combinada e partida encerrada (409);
  - ausência de vazamento do conteúdo das cartas na resposta de `start`;
  - cálculo da eficiência e os valores gravados no D1;
  - conformidade com a rubrica (chave no rodapé e no README, licença MIT, ausência de frameworks, skills presentes).

---

## 3. Registro de Execução

| Agente | Data | Conversa / evidência | Resultado |
|---|---|---|---|
| 1 – Arquiteto | | | |
| 2 – Frontend | | | |
| 3 – Teste e validação | | | `node tests/run-tests.mjs` → ___ passaram |
