# Projeto #27: Entrelinhas — Blog Técnico da Turma

- **Modalidade:** Projeto Oficial Sorteado (valendo 100 pontos)
- **Estudante:** Luis Fernando Prates Santana
- **RA:** 20226108210
- **Turma:** 2B
- **Chave Única:** `P26-2B-4D68-AE13-8030-7D10`
- **URL_CLOUDFLARE:** `https://blog-dxw.pages.dev`

---

## 1. Sobre o projeto

O **Entrelinhas** é um blog técnico para a turma publicar o que está aprendendo. Qualquer pessoa navega pelo feed; para publicar, comentar ou participar de salas é preciso entrar com Discord.

O frontend é HTML5, CSS3 e JavaScript puro (sem frameworks) e o backend roda em **Cloudflare Pages Functions**, com persistência no **Cloudflare D1**.

---

## 2. Funcionalidades

- **Feed público** de artigos com busca por título/conteúdo, filtro por etiqueta e paginação por cursor.
- **Editor de artigos** em Markdown com pré-visualização, rascunho automático no navegador, até 5 etiquetas e histórico de revisões.
- **HTML e SVG no artigo**: blocos ```` ```html ```` passam por um sanitizador de lista fechada (aceita página completa colada, aproveitando só o `<body>`) e blocos ```` ```svg ```` são exibidos como figura.
- **Comentários** com nome e avatar do Discord, curtidas, exclusão pelo autor do comentário, pelo autor do artigo ou pelo dono da sala, e denúncia.
- **Salas** públicas e privadas. A sala privada tem um **código hash** próprio (o id numérico não dá acesso), com política de entrada `open_link` (entra direto) ou `approval` (fila de pedidos). O dono aprova, remove membros com bloqueio, transfere ou exclui a sala — ao excluir, os artigos voltam para a página pública.
- **Login exclusivo via Discord OAuth2**, com validação de `state`, sessão assinada e cookie `HttpOnly` (`Secure` em HTTPS).
- **Autorização no servidor** em todas as rotas: propriedade do artigo, participação na sala e moderação de comentários.
- **SEO e operação**: RSS, `sitemap.xml`, `robots.txt`, metadados Open Graph, `GET /api/health` e cabeçalhos de segurança (CSP, `nosniff`, `X-Frame-Options`, `Referrer-Policy`, HSTS).

---

## 3. Tecnologias

| Camada | Uso |
| --- | --- |
| Frontend | HTML5, CSS3 e JavaScript (ES Modules), sem frameworks de UI |
| Backend | Cloudflare Pages Functions (JavaScript ESM) |
| Banco | Cloudflare D1 (SQLite relacional) |
| Autenticação | Discord OAuth2 + cookie de sessão assinado (HMAC) |
| Build | Nenhum: o projeto é publicado direto pelo Cloudflare Pages |

---

## 4. Estrutura

```text
P26-2B-4D68-AE13-8030-7D10/
├─ public/           # HTML, CSS, JS do navegador e _headers
├─ functions/        # Pages Functions (API, OAuth2, artigo server-rendered, RSS e sitemap)
│  ├─ api/           # auth, articles, comments, rooms, tags, authors e health
│  ├─ artigo/        # página do artigo renderizada no servidor
│  └─ _lib/          # sessão, autorização, validação, markdown e utilitários
├─ migrations/       # migrações SQL do D1 (0001 a 0006)
├─ seed/             # dados de exemplo para desenvolvimento
├─ tests/            # testes unitários, servidor local e ponta a ponta
├─ docs/             # schema do D1, configuração do Cloudflare/Discord e CI
├─ schema.sql        # schema completo para um banco novo
├─ AGENTS.md         # agentes de desenvolvimento, harness e skills
└─ skills/           # SKILL.md usados pelos agentes
```

---

## 5. Banco de dados (D1)

O schema completo está em [`schema.sql`](./schema.sql) e documentado tabela por tabela em [`docs/schema-d1-e-orientacoes.md`](./docs/schema-d1-e-orientacoes.md).

- **12 tabelas:** `discord_users`, `project_records`, `rooms`, `room_members`, `articles`, `comments`, `article_likes`, `room_join_requests`, `room_blocks`, `article_tags`, `article_revisions`, `comment_reports`.
- **9 índices** explícitos, incluindo o índice único de `articles.slug`.
- O banco é criado e vinculado **pelo painel da Cloudflare**. O projeto não usa Wrangler: não existe `wrangler.jsonc` nem `database_id` no repositório, e o binding se chama exatamente **`DB`**.
- Salas privadas usam `rooms.invite_hash` para guardar o código hash de entrada (24 caracteres hex). A constraint existente continua válida e salas antigas seguem funcionando.

---

## 6. Rodando localmente

Pré-requisitos: Node.js 20+ e uma aplicação Discord OAuth2 criada.

```bash
cd P26-2B-4D68-AE13-8030-7D10

# crie um .env (fora do Git) com DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET e SESSION_SECRET
npm test                 # testes unitários (node:test)
npm run dev:local        # sobe as Pages Functions em http://127.0.0.1:8788
npm run test:e2e         # testes ponta a ponta contra o servidor local
```

O projeto não tem dependências: `tests/server-local.mjs` executa as próprias Pages Functions no Node, com um D1 em `node:sqlite` criado a partir de `schema.sql` e `seed/demo-local.sql`. O `.env` é usado somente pelos testes locais e nunca vai para o Git nem para o Cloudflare.

---

## 7. Publicação (Cloudflare Pages + D1 + Discord)

1. **Pages:** Workers & Pages → Create → Pages → Connect to Git, apontando para o fork do repositório.
   - **Root directory:** `P26-2B-4D68-AE13-8030-7D10`
   - **Build command:** *(em branco)*
   - **Build output directory:** `public`
2. **D1:** Workers & Pages → D1 → Create database, com o nome `db-p26-2b-4d68-ae13-8030-7d10`. Abra o banco → **Console** → cole `schema.sql` → Execute.
3. **Binding:** no projeto Pages, Settings → Bindings → Add → D1 database bindings, com **Variable name** `DB` apontando para o banco criado.
4. **Discord:** no [Discord Developer Portal](https://discord.com/developers/applications), crie a Application e em OAuth2 copie o **Client ID** e o **Client Secret**. Em **Redirects**, cadastre exatamente:
   `https://blog-dxw.pages.dev/api/auth/discord/callback`
5. **Variáveis e Secrets:** em Settings → Variables and Secrets, configure `DISCORD_CLIENT_ID` (variável), `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` (secrets).
6. **Deploy:** refaça o deploy. A aplicação fica disponível em <https://blog-dxw.pages.dev> e o diagnóstico em `/api/health` deve responder `status: ok`.

---

## 8. Validação

Na raiz do repositório:

```bash
node validar-local.mjs P26-2B-4D68-AE13-8030-7D10
```

O script confere licença MIT, chave única no README e no rodapé da interface, `AGENTS.md` com pelo menos 3 agentes (um de teste/validação), pasta `skills/`, frontend Vanilla JS, ausência de frameworks proibidos e o deploy online.

Também é possível validar o código localmente:

```bash
cd P26-2B-4D68-AE13-8030-7D10
npm test
npm run test:e2e
```

---

## 9. Documentação de apoio

- [`AGENTS.md`](./AGENTS.md) — agentes, harness e skills usados no desenvolvimento.
- [`docs/schema-d1-e-orientacoes.md`](./docs/schema-d1-e-orientacoes.md) — schema completo e preparação do D1.
- [`docs/configuracao-cloudflare-discord.md`](./docs/configuracao-cloudflare-discord.md) — configuração do Cloudflare Pages, D1 e Discord.
- [`docs/ci-e-publicacao.md`](./docs/ci-e-publicacao.md) — CI e fluxo de publicação.

---

## 10. Licença

Distribuído sob a licença MIT. Veja [`LICENSE`](./LICENSE).
