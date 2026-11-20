# Documentação de Engenharia de Agentes e Harness (P26-2C-50B3-F413-07FD-8793)

> **Requisito da Rubrica (25 pontos):** no mínimo **3 agentes diferentes** (sendo **1 dedicado a teste e validação**), com o *harness* em que operaram e as *skills* em `skills/`.

Projeto #7 — **Jogo da Memória Temático** (pares "código JavaScript ↔ saída"), em Cloudflare Pages + Functions + D1, com login Discord OAuth2 e interface em HTML5/CSS3/JS puro.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Claude (Anthropic), em modo agêntico no app Claude, com ferramentas de arquivos, shell e navegador headless (Chromium + Playwright) em ambiente Linux isolado.
- **Modelo Base:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Estratégia de Coordenação:** o desenvolvimento foi dividido em três **papéis** com responsabilidades e skills distintas, executados em sequência pelo mesmo harness, sobre a subpasta `P26-2C-50B3-F413-07FD-8793/`. O contrato entre eles é a API JSON (`/api/game/start`, `/flip`, `/check`, `/api/me`, `/api/ranking`) e o esquema do D1 (`migrations/`). O estudante conduziu o processo, executou os comandos no laboratório (Scoop/Node, Wrangler, Git), configurou Cloudflare e Discord e validou o resultado em produção.

---

## 2. Agentes e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** esquema do D1, autenticação Discord OAuth2 e regras de negócio no servidor (`functions/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas:**
  - `migrations/0002_game.sql`: tabelas `games` (movimentos, pares, eficiência, status) e `game_cards` (`pair_key` e conteúdo ficam só no servidor).
  - `functions/_lib/deck.js`: baralho de 11 pares, sorteio de 8 e embaralhamento Fisher-Yates com `crypto.getRandomValues`.
  - `functions/api/game/start.js`: embaralha no servidor e devolve **apenas IDs opacos** (UUID).
  - `functions/api/game/flip.js`: revela uma carta por vez; o servidor impede mais de 2 cartas viradas sem validação (UPDATE condicional atômico).
  - `functions/api/game/check.js`: decide se é par, **incrementa o contador de movimentos no D1** e, ao achar o último par, grava a **eficiência** (pares ÷ movimentos × 100).
  - `functions/_lib/session.js`: sessão em cookie `HttpOnly; Secure; SameSite=Lax` **assinado com HMAC-SHA256**, impedindo que o cliente forje `user_id`, nome ou avatar.
  - `functions/api/auth/discord/callback.js` (grava a sessão assinada), `auth/logout.js`, `me.js`, `ranking.js` e `status.js`.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** interface responsiva e acessível com HTML, CSS e JavaScript puro, sem frameworks.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas:**
  - `public/index.html`: cabeçalho com avatar e nome do Discord, estatísticas, tabuleiro, ranking e rodapé com a Chave Única `P26-2C-50B3-F413-07FD-8793`.
  - `public/styles.css`: efeito de virar carta com **transformações CSS 3D** (`perspective`, `preserve-3d`, `backface-visibility`, `rotateY`), grade responsiva e `prefers-reduced-motion`.
  - `public/app.js`: manipulação direta do DOM (`createElement`/`textContent`, sem `innerHTML` com dados), bloqueio de cliques durante as requisições e consumo da API via `fetch`. O cliente nunca decide se há um par.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** verificação independente do que os agentes 1 e 2 produziram, tentando burlar as regras do servidor e conferindo a interface no navegador.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas (código em [`tests/`](./tests/)):**
  - `tests/api.test.mjs` executa as Functions reais contra um D1 simulado (`node:sqlite`) e verifica: 401 sem sessão, com cookie adulterado e com o formato de cookie antigo (não assinado); `start` não devolve conteúdo nem chaves de par; a 3ª carta virada é recusada (409); `check` sem cartas viradas (409); acesso à partida de outro usuário (404); contagem de movimentos; eficiência = pares ÷ movimentos × 100; carta já combinada e partida encerrada (409); nova partida abandona a anterior; ranking; logout.
  - `tests/ui.test.mjs` joga uma partida completa no Chromium, confirma que nenhum conteúdo de carta existe no DOM antes de virar, que não há overflow horizontal em 375 px e que não há erros de console.
  - Auditoria da rubrica: sem frameworks de UI, licença MIT, chave no `README.md` e no rodapé, e `node validar-local.mjs`.
  - **Teste em produção** (feito pelo estudante, em aba anônima): login Discord, partida completa, ranking e logout no domínio `pages.dev`.

---

## 3. Como reproduzir os testes

```
node tests/api.test.mjs      # Node 22+, sem dependências
node tests/ui.test.mjs       # requer: npm i playwright
```

## 4. Skills utilizadas

Os arquivos estão em [`skills/`](./skills/): `serverless-d1-discord`, `vanilla-dom-ui` e `teste-validacao`.
