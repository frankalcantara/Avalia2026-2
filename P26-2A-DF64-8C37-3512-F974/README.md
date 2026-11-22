# Memorize · Cartões com repetição espaçada

**Chave Única de Auditoria:** `P26-2A-DF64-8C37-3512-F974`
**Turma:** 2A · **Licença:** [MIT](LICENSE)

URL_CLOUDFLARE: https://p26-2a-df64-8c37-3512-f974.pages.dev

Ferramenta de memorização baseada em baralhos de cartões de frente e verso. O estudante entra com o
**Discord (OAuth2)**, cria seus baralhos e estuda a fila do dia: clica no cartão, que **vira com uma
animação CSS 3D**, e se autoavalia como **Difícil**, **Bom** ou **Fácil**. Uma **Cloudflare Pages
Function** aplica um algoritmo simplificado de repetição espaçada inspirado no **SuperMemo SM-2**,
recalcula o intervalo em dias e grava no **Cloudflare D1** a data da próxima revisão do cartão,
atualizando a fila de estudos diária.

## Funcionalidades
- Login exclusivo com Discord (`identify`): importa `user_id`, nome de usuário e avatar.
- Baralhos pessoais: criar, renomear, excluir; cartões: adicionar, importar em lote (`frente ; verso`), editar, reiniciar progresso, excluir.
- Estudo com cartão que vira (clique, `Espaço` ou `Enter`) e atalhos `1` `2` `3` para Difícil / Bom / Fácil.
- Cada botão mostra o intervalo previsto (ex.: `1d`, `6d`, `2 meses`), calculado pelo servidor.
- Fila diária: cartões vencidos + até 20 cartões novos por baralho por dia, no fuso horário do aluno.
- Painel com revisões pendentes, novos do dia, avaliações de hoje e sequência de dias estudados.
- Responsivo (celular a desktop), tema claro/escuro automático, acessível por teclado.

## Arquitetura

```
public/            HTML5 + CSS3 + JavaScript puro (sem frameworks)
  index.html       telas (login, baralhos, gerenciar, estudar) e rodapé com a chave
  styles.css       layout responsivo + animação 3D de virar o cartão
  app.js           roteamento por hash, DOM direto, chamadas fetch à API
functions/         Cloudflare Pages Functions (regras de negócio e validação)
  _lib/            sm2.js · queue.js · dates.js · session.js · validate.js · http.js · decks.js
  api/_middleware.js        sessão, 401, bloqueio CSRF, erros em JSON
  api/auth/discord.js       GET  início do OAuth2 (state anti-CSRF)
  api/auth/discord/callback.js  GET  troca do código, upsert do usuário, sessão
  api/auth/logout.js        POST encerra a sessão
  api/me.js                 GET  perfil + estatísticas
  api/decks/index.js        GET/POST baralhos
  api/decks/[id].js         GET/PUT/DELETE baralho
  api/decks/[id]/cards.js   GET/POST cartões do baralho (um ou em lote)
  api/cards/[id].js         PUT/DELETE cartão
  api/study.js              GET  fila de hoje (?deck=<id>|all)
  api/review.js             POST avaliação → SM-2 → nova data no D1
  api/status.js             GET  saúde (D1 migrado, OAuth configurado)
migrations/0001_init.sql    tabelas users, sessions, decks, cards, reviews
tests/                      testes unitários (node --test) e teste de fumaça do deploy
skills/                     skills usadas pelos agentes (SKILL.md)
.claude/agents/             definições dos 3 agentes (harness Claude Code)
AGENTS.md                   documentação dos agentes e do harness
```

### Algoritmo (SM-2 simplificado)
| | Difícil (q=3) | Bom (q=4) | Fácil (q=5) |
|---|---|---|---|
| Fator de facilidade | −0,14 | ±0 | +0,10 (mín. 1,3) |
| 1ª revisão | 1 dia | 1 dia | 4 dias |
| 2ª revisão | 3 dias | 6 dias | 8 dias |
| Seguintes (intervalo I) | I × 1,2 | I × EF | I × EF × 1,3 |

Detalhes em [skills/sm2-repeticao-espacada/SKILL.md](skills/sm2-repeticao-espacada/SKILL.md).

### Regras validadas no servidor (sem confiar no cliente)
- Identidade vem só da sessão (token aleatório no cookie HttpOnly; o D1 guarda apenas o SHA-256).
- Todo acesso a baralho/cartão confere o dono (`user_id`).
- Só é possível avaliar cartões da fila de hoje (409 se ainda não venceu ou se estourou o limite de novos).
- Avaliação dupla/concorrente é rejeitada (UPDATE condicional).
- Tamanhos e campos obrigatórios validados; escritas de outra origem bloqueadas (CSRF).

## Como publicar (Cloudflare Pages + D1 + Discord)

> No laboratório (PowerShell): se `node` não for reconhecido, rode
> `$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"` e use `npx.cmd`.

1. **Fork + pasta:** faça fork de `frankalcantara/Avalia2026-2`, clone e, na raiz do fork, rode
   `node iniciar.mjs P26-2A-DF64-8C37-3512-F974`. Copie o conteúdo desta pasta para a pasta criada
   (substituindo os arquivos do modelo; mantenha o `LICENSE` gerado, que já tem o seu nome).
2. **D1:**
   ```powershell
   cd P26-2A-DF64-8C37-3512-F974
   npx.cmd wrangler login
   npx.cmd wrangler d1 create memorize-db
   # copie o database_id para wrangler.jsonc
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
3. **Discord:** em <https://discord.com/developers/applications> crie uma aplicação → *OAuth2* → copie
   *Client ID* e *Client Secret* e adicione o redirect
   `https://p26-2a-df64-8c37-3512-f974.pages.dev/api/auth/discord/callback`.
4. **Pages:** *Workers & Pages → Create → Pages → Connect to Git*, escolha o fork e configure:
   - Project name: `p26-2a-df64-8c37-3512-f974`
   - Root directory: `P26-2A-DF64-8C37-3512-F974`
   - Build command: *(vazio)* · Build output directory: `public`
   - *Settings → Variables and Secrets*: `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (tipo Secret)
   - O binding D1 `DB` vem do `wrangler.jsonc` (confira em *Settings → Bindings*).
5. Faça um novo deploy (*Retry deployment*) depois de cadastrar os segredos.
6. **Validar:**
   ```powershell
   node --test tests/
   node tests/smoke.mjs https://p26-2a-df64-8c37-3512-f974.pages.dev
   cd ..; node validar-local.mjs P26-2A-DF64-8C37-3512-F974
   ```
7. Commit/push da pasta, abra o Pull Request para `frankalcantara/Avalia2026-2` e poste no AVA a URL
   do Pages e a URL do repositório.

### Desenvolvimento local
```powershell
copy .dev.vars.example .dev.vars   # preencha os segredos
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler pages dev
```
Para o login local, cadastre também `http://localhost:8788/api/auth/discord/callback` no Discord.

## Agentes
O projeto foi desenvolvido com 3 agentes (arquitetura serverless, UI vanilla e **teste e validação**) no
harness **Claude Code**. Veja [AGENTS.md](AGENTS.md) e a pasta [skills/](skills/).

---
Chave Única: `P26-2A-DF64-8C37-3512-F974` · Licenciado sob MIT.
