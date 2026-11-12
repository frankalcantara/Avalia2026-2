# Projeto #38: Rastreador de Solicitações e Chamados Internos (Issue Tracker)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Vitória Faranhas Braga
- **RA:** 2026109204
- **Turma:** 2C
- **Chave Única:** `P26-2C-7200-F0C5-B458-DA41`
- **URL_CLOUDFLARE:** `https://seu-projeto.pages.dev` *(troque pela URL real do deploy antes do Pull Request)*
- **Repositório GitHub:** `https://github.com/SEU-USUARIO/Avalia2026-2/tree/main/P26-2C-7200-F0C5-B458-DA41`
- **Licença:** MIT ([LICENSE](./LICENSE))

---

## O que o sistema faz

Sistema simplificado de abertura e acompanhamento de chamados técnicos — computador com defeito no laboratório, bug em projeto da turma etc.

1. O estudante entra **somente com o Discord (OAuth2)**; o sistema importa `user_id`, nome e avatar para o Cloudflare D1.
2. Abre um chamado com **título, laboratório/projeto afetado, severidade** (Baixa, Média, Alta, Crítica) e **descrição**.
3. Cada chamado recebe um **código único** no D1 (ex.: `CH-7K2M9Q`, alfabeto Crockford Base32, gerado com `crypto.getRandomValues` e protegido por `UNIQUE`).
4. O chamado transita pelos estados **Aberto → Em Análise → Aguardando Peça/Correção → Resolvido**, seguindo uma máquina de estados validada no servidor.
5. A página do chamado desenha uma **linha do tempo visual** com abertura, mudanças de estado (com observação) e **comentários técnicos**, que podem ser adicionados até o fechamento.

### Regras de negócio (todas validadas nas Cloudflare Pages Functions)

| Regra | Onde |
|---|---|
| Título 5–120, local 2–80, descrição 10–4000, comentário 2–2000 caracteres; severidade só dos valores permitidos | `functions/_lib/rules.js` → `validateTicketInput`, `validateComment` |
| Transições permitidas: aberto → em análise / resolvido · em análise → aguardando / resolvido · aguardando → em análise / resolvido · **resolvido é final** | `TRANSITIONS`, `canTransition` |
| Técnicos (IDs do Discord em `ADMIN_DISCORD_IDS`) fazem qualquer transição válida; o **autor** só pode marcar o próprio chamado como resolvido | `canChangeStatus` |
| Chamado resolvido **não aceita comentários** (409) | `api/tickets/[code]/comments.js` |
| Máximo de 10 chamados por usuário por hora (429) | `api/tickets/index.js` |
| Mudança de estado concorrente (duas abas) devolve 409 | `UPDATE ... WHERE status = <lido>` |
| Mutações exigem cabeçalho `Origin` do próprio site (anti-CSRF) e sessão válida | `_lib/http.js`, `_lib/session.js` |

## Arquitetura

```
public/                 Frontend HTML5 + CSS3 + JavaScript puro (sem frameworks)
  index.html            rodapé com a Chave Única
  styles.css
  app.js                roteador por hash: #/ · #/novo · #/chamado/CH-XXXXXX
  _headers              CSP e cabeçalhos de segurança
functions/              Cloudflare Pages Functions
  _lib/rules.js         regras de negócio puras (testadas com node --test)
  _lib/session.js       sessões em D1 (cookie HttpOnly; D1 guarda só o SHA-256 do token)
  _lib/http.js, _lib/tickets.js
  api/auth/discord.js            GET  inicia OAuth2 (state anti-CSRF)
  api/auth/discord/callback.js   GET  troca o code, importa o usuário, cria sessão
  api/auth/logout.js             POST
  api/me.js                      GET  usuário logado
  api/status.js                  GET  diagnóstico (D1 / Discord)
  api/tickets/index.js           GET lista (filtros) · POST abre chamado
  api/tickets/[code].js          GET detalhe + linha do tempo
  api/tickets/[code]/comments.js POST comentário
  api/tickets/[code]/status.js   POST muda estado
migrations/0001_init.sql  users · sessions · tickets · ticket_events
tests/                    testes do agente de validação
agents/                   definição dos 3 agentes
skills/                   SKILL.md usadas pelos agentes
AGENTS.md                 documentação dos agentes e do harness
```

## Deploy (Cloudflare Pages + D1 + Discord)

> No PowerShell do laboratório use `npx.cmd` / `npm.cmd`.

1. **Fork + estrutura:** faça fork de `frankalcantara/Avalia2026-2`, clone, copie esta pasta para a raiz do fork e rode `node iniciar.mjs P26-2C-7200-F0C5-B458-DA41` (ele mantém os arquivos existentes).
2. **Banco D1:**
   ```powershell
   cd P26-2C-7200-F0C5-B458-DA41
   npx.cmd wrangler login
   npx.cmd wrangler d1 create db-p26-2c-7200-f0c5-b458-da41
   # cole o database_id no wrangler.jsonc
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
3. **Pages:** Workers & Pages → Create → Pages → Connect to Git → seu fork.
   - Root directory: `P26-2C-7200-F0C5-B458-DA41`
   - Build command: *(vazio)*
   - Build output directory: `public`
4. **Binding D1:** projeto Pages → Settings → Functions/Bindings → D1 → Variable name `DB` → banco `db-p26-2c-7200-f0c5-b458-da41`.
5. **Discord:** [Developer Portal](https://discord.com/developers/applications) → New Application → OAuth2 → copie Client ID, gere Client Secret, e em Redirects adicione `https://<seu-projeto>.pages.dev/api/auth/discord/callback`.
6. **Variáveis no Pages** (Settings → Variables and Secrets, ambiente Production):
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET` (tipo *Secret*)
   - `ADMIN_DISCORD_IDS` — seu ID do Discord (e de quem for técnico), separados por vírgula. Para ver o ID: Discord → Configurações → Avançado → Modo desenvolvedor → clique direito no seu nome → Copiar ID.
7. Faça um novo deploy (Deployments → Retry deployment) para as variáveis valerem, abra a URL, faça login e teste.
8. Atualize `URL_CLOUDFLARE` acima, rode `node validar-local.mjs P26-2C-7200-F0C5-B458-DA41` na raiz do fork, faça commit/push e abra o Pull Request. Poste as URLs (projeto + repositório) no AVA.

## Desenvolvimento local

```bash
cd P26-2C-7200-F0C5-B458-DA41
npm test                                       # testes unitários (zero dependências)
npx wrangler d1 migrations apply DB --local
npx wrangler pages dev                         # http://localhost:8788
```
Para login local, crie `.dev.vars` (não vai para o Git) com `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `ADMIN_DISCORD_IDS`, e adicione `http://localhost:8788/api/auth/discord/callback` nos Redirects do Discord.

## Agentes

Veja [AGENTS.md](./AGENTS.md): 3 agentes (backend, interface e **teste/validação**) operando no harness Claude Code, com as skills em [`skills/`](./skills).

---

Chave Única: **P26-2C-7200-F0C5-B458-DA41** · Vitória Faranhas Braga · Turma 2C · Licença MIT
