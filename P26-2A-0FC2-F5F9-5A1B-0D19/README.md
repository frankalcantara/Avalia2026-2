# Projeto #26: Sistema de Enquetes e Votação Verificada

- **Estudante:** Vinicius Kichel Derganho
- **Turma:** 2A · **RA:** 2026107869
- **Chave Única:** `P26-2A-0FC2-F5F9-5A1B-0D19`
- **URL_CLOUDFLARE:** https://p26-2a-0fc2-f5f9-5a1b-0d19.pages.dev
- **Licença:** [MIT](./LICENSE)

Plataforma de decisão coletiva: qualquer usuário autenticado pelo **Discord OAuth2** cria enquetes com título, descrição, prazo de encerramento e várias opções. O servidor (**Cloudflare Pages Functions + D1**) garante que cada `user_id` do Discord vote uma única vez por enquete e só dentro do prazo. Depois de votar, o cliente recebe os dados consolidados e desenha barras horizontais proporcionais ao percentual de cada opção.

## Funcionalidades

| Requisito | Onde está |
|---|---|
| Login exclusivo via Discord OAuth2 (importa `user_id`, nome e avatar) | `functions/api/auth/discord.js`, `functions/api/auth/discord/callback.js` |
| Sessão segura (token aleatório, só o SHA-256 no D1, cookie `HttpOnly`) | `functions/_lib/session.js` |
| Criar enquete (título, descrição, prazo, 2 a 10 opções) validada no servidor | `functions/api/polls/index.js`, `functions/_lib/polls.js` |
| Bloqueio de voto fora do prazo (`403`) | `functions/api/polls/[id]/vote.js` |
| Bloqueio de voto duplicado por `user_id` (`409` + `UNIQUE(poll_id, user_id)` no D1) | `vote.js`, `migrations/0001_init.sql` |
| Resultados ocultos até o usuário votar ou a enquete encerrar | `functions/api/polls/[id]/index.js` |
| Barras horizontais proporcionais em JavaScript puro | `public/js/views.js`, `public/styles.css` |
| Chave no rodapé da interface | `public/index.html` (`<footer>`) |

## Arquitetura

```
public/            HTML5 + CSS3 + Vanilla JS (ES modules, sem framework, sem build)
functions/         Cloudflare Pages Functions (API REST + OAuth2)
migrations/        Esquema SQLite do Cloudflare D1
docs/SPEC.md       Contrato de API compartilhado entre os agentes
AGENTS.md          Agentes, harness e fluxo de trabalho
agents/            Definição (prompt) de cada agente
skills/            SKILL.md usadas pelos agentes
tests/             Testes unitários, de API e E2E + relatório de validação
```

### Rotas da API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/auth/discord` | Inicia o OAuth2 (com `state` anti-CSRF) |
| GET | `/api/auth/discord/callback` | Troca o código, salva o usuário e cria a sessão |
| POST | `/api/auth/logout` | Encerra a sessão |
| GET | `/api/me` | Usuário logado |
| GET | `/api/polls` | Lista enquetes |
| POST | `/api/polls` | Cria enquete |
| GET | `/api/polls/:id` | Detalhe (resultados só após votar ou encerrar) |
| POST | `/api/polls/:id/vote` | Registra voto |
| GET | `/api/status` | Diagnóstico público (D1 e OAuth configurados) |

### Modelo de dados (D1)

`users` → `sessions`; `users` → `polls` → `poll_options`; `votes` liga `polls`, `poll_options` e `users` com `UNIQUE(poll_id, user_id)`.

## Como publicar (Cloudflare Pages + D1 + Discord)

1. **Cloudflare Pages:** Workers & Pages → Create → Pages → Connect to Git → fork `Avalia2026-2`.
   - Project name: `p26-2a-0fc2-f5f9-5a1b-0d19`
   - Root directory: `P26-2A-0FC2-F5F9-5A1B-0D19`
   - Build command: *(em branco)* · Build output directory: `public`
2. **D1:**
   ```powershell
   cd P26-2A-0FC2-F5F9-5A1B-0D19
   npx.cmd wrangler login
   npx.cmd wrangler d1 create db-p26-2a-0fc2-f5f9-5a1b-0d19
   # copie o database_id para wrangler.jsonc
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
   No Pages: Settings → Bindings → Add → D1 database → Variable name `DB` → banco criado.
3. **Discord:** https://discord.com/developers/applications → New Application → OAuth2 → copie Client ID, gere Client Secret, e em Redirects adicione `https://p26-2a-0fc2-f5f9-5a1b-0d19.pages.dev/api/auth/discord/callback`.
4. **Variáveis no Pages** (Settings → Variables and Secrets, ambiente Production): `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (marque o segredo como *Secret*).
5. **Redeploy** (Deployments → Retry deployment) para aplicar binding e variáveis.
6. Conferir `https://p26-2a-0fc2-f5f9-5a1b-0d19.pages.dev/api/status`: `d1Connected` e `discordOAuthConfigured` devem ser `true`.

## Desenvolvimento local

```bash
npx wrangler d1 migrations apply DB --local
# crie .dev.vars com DISCORD_CLIENT_ID=... e DISCORD_CLIENT_SECRET=... (arquivo ignorado pelo git)
npx wrangler pages dev public --port 8788
```

Testes: ver [`tests/README.md`](./tests/README.md). Último resultado: [`tests/RELATORIO-VALIDACAO.md`](./tests/RELATORIO-VALIDACAO.md).

## Agentes

Desenvolvido com 3 agentes no harness **Claude Cowork (Claude Agent SDK)**: Backend, Frontend e **Teste e Validação**. Detalhes em [`AGENTS.md`](./AGENTS.md).

---

Chave Única de Auditoria: **P26-2A-0FC2-F5F9-5A1B-0D19**
