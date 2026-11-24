# Engenharia de Agentes e Harness (P26-2B-23DA-3A7A-20A1-620C)

Projeto #7: Jogo da Memória Temático (código ↔ saída), com Cloudflare Pages Functions, D1 e Discord OAuth2.

## 1. Harness utilizado

- **Harness:** chat do Claude (claude.ai, interface web), usado como assistente de engenharia.
- **Modelo base:** Claude, da Anthropic.
- **Orquestrador humano:** o estudante (Julio Cesar dos Santos Ventura). Ele executou todos os comandos no PowerShell (Wrangler, Git, Node), colou o código nos arquivos e devolveu ao agente as saídas reais dos testes.
- **Como os agentes foram definidos:** cada agente é um papel com escopo, regras e checklist próprios, descritos em um skill versionado em `skills/`. Os três papéis operaram sobre a mesma subpasta, de forma sequencial e dentro do mesmo harness. Não foram processos autônomos em paralelo.
- **Contrato entre os agentes:** o esquema do D1 (`migrations/`) e os contratos JSON das rotas `/api/...`.

## 2. Agentes e responsabilidades

### Agente 1: Arquiteto Serverless, D1 e Discord OAuth2
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas:**
  - Migrations `0001_init.sql` e `0002_game.sql` (tabelas `discord_users`, `sessions`, `games`, `game_cards`).
  - Login Discord OAuth2 (`functions/api/auth/discord.js` e `discord/callback.js`) com parâmetro `state` anti-CSRF.
  - Sessão com token aleatório: no D1 fica só o hash SHA-256 e o cookie é `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS. O modelo inicial gravava os dados do usuário em um cookie sem assinatura, o que permitia forjar a identidade, e foi substituído.
  - Rotas do jogo: `start` (embaralha com `crypto.getRandomValues` e devolve só IDs opacos), `reveal` (limite atômico de 2 cartas por turno), `check` (valida o par, incrementa `moves`, calcula tempo e eficiência no servidor) e `state` (retomada da partida sem expor `pair_key`).
  - Remoção do endpoint de diagnóstico `status.js`, que aceitava `userId` vindo do navegador.

### Agente 2: Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`, sem frameworks nem bibliotecas externas.
  - Cartas com `transform-style: preserve-3d` e `rotateY(180deg)`, acionadas por JavaScript puro (classe `flipped`).
  - Cabeçalho com avatar e nome do Discord (via `/api/me`), cronômetro de exibição, retomada da partida após recarregar a página, layout responsivo (4, 3 ou 2 colunas) e `prefers-reduced-motion`.
  - Rodapé com a Chave Única de auditoria.
  - Conteúdo vindo do servidor inserido com `textContent`, nunca `innerHTML`.

### Agente 3: Teste, Auditoria de Segurança e Validação (obrigatório)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Papel:** tentar quebrar as regras do servidor e conferir a rubrica, em vez de confiar no que o frontend faz.
- **Artefato executável:** [`testes/producao.mjs`](./testes/producao.mjs). Roda com `node testes/producao.mjs` (aceita uma URL base como argumento) e não precisa de login nem de segredos. Cobre: rotas protegidas sem sessão e com cookie forjado (`401`), método incorreto (`405`), OAuth2 com `state` e cookie `HttpOnly`, callback sem `state` rejeitado e frontend sem scripts externos com a chave no rodapé. Resultado final em produção: **17 ok, 0 falhas**.
- **Falha encontrada e corrigida:** o teste detectou que `GET /api/auth/logout` devolvia `200`, porque o Pages servia o `index.html` como fallback. A rota passou a responder `405` explícito.
- **Testes executados (com resultado):**

| Teste | Resultado esperado | Resultado obtido |
|---|---|---|
| `POST /api/game/start` autenticado | 12 cartas com só `id` e `position` | OK: sem conteúdo nem `pair_key` |
| Partida gravada no D1 | 1 partida `active` com 12 cartas | OK |
| `reveal` em 3 cartas seguidas | 3ª recusada | OK: `409 turn_full` |
| `check` com 2 cartas de pares diferentes | `match:false`, `moves = 1` | OK |
| `check` repetido sem virar cartas | recusado | OK: `409 need_two_cards` |
| Contador de movimentos no banco | `moves = 1` | OK |
| `state` após virar uma carta | só ela mostra conteúdo | OK |
| `/api/me` sem login em produção | 401 | OK: `unauthenticated` |
| Login Discord e partida em produção | funcionar de ponta a ponta | OK |
| `node validar-local.mjs` | itens OK | 8 de 9 OK antes do deploy (o pendente era o deploy online) |
| `GET /api/auth/logout` | `405` | Falhou (200), corrigido, agora OK |
| `node testes/producao.mjs` em produção | 100% | OK: 17 ok, 0 falhas |

## 3. Skills versionados

| Skill | Usado por |
|---|---|
| `skills/serverless-d1-discord/SKILL.md` | Agente 1 |
| `skills/vanilla-dom-ui/SKILL.md` | Agente 2 |
| `skills/teste-validacao/SKILL.md` | Agente 3 |

## 4. Regras de negócio validadas no servidor

- **Identidade:** quem joga é definido pela sessão no D1, nunca por dados enviados pelo navegador.
- **Segredo das cartas:** `pair_key` e o conteúdo de cartas ocultas nunca saem do servidor.
- **Embaralhamento:** feito no servidor com aleatoriedade criptográfica.
- **Turno:** o servidor impede virar mais de 2 cartas por turno e só compara as cartas que ele mesmo registrou como viradas.
- **Autoria da partida:** toda consulta filtra por `user_id`.
- **Cronômetro e eficiência:** calculados pelo servidor (`duration_ms` e `efficiency = pares / movimentos`).
- **Reinício:** iniciar uma partida nova marca a ativa como `abandoned`.