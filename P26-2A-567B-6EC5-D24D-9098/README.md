# Projeto #42: Agregador e Curadoria de Links Técnicos (Bookmark Manager)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Rogério Gapski da Silva
- **Turma:** 2A
- **Chave Única:** `P26-2A-567B-6EC5-D24D-9098`
- **URL_CLOUDFLARE:** `https://projeto-p26-2a-567b-6ec5-d24d-9098.pages.dev`
- **Repositório (fork):** https://github.com/RogerioGapski/Avalia2026-2 (pasta `P26-2A-567B-6EC5-D24D-9098/`)
- **Licença:** MIT (arquivo `LICENSE`)

---

## Especificação do Projeto

Desenvolva um gerenciador de favoritos na nuvem para substituir as dezenas de abas abertas no navegador durante pesquisas acadêmicas. Autenticado via Discord OAuth2, o usuário salva URLs acompanhadas de título, resumo pessoal, coleção/pasta e status de leitura ("Para Ler", "Lendo", "Concluído").

O backend na Cloudflare persiste os links no banco D1 e oferece rotas para filtragem combinada por coleção e status. O usuário também pode tornar uma coleção pública para compartilhar uma trilha de estudos (ex: "Melhores artigos sobre Compiladores") com o restante da turma através de uma listagem limpa e organizada.

---

## O que foi implementado

- **Login somente com Discord OAuth2** (escopo `identify`): `state` aleatório, sessão no D1 e cookie `discord_session` (`HttpOnly; Secure; SameSite=Lax`, 7 dias).
- **Coleções:** criar, listar, renomear, excluir (apaga os links da coleção) e tornar pública/privada.
- **Links:** URL (só `http`/`https`), título, resumo pessoal, coleção e status ("Para Ler", "Lendo", "Concluído").
- **Filtro combinado** por coleção e status: `GET /api/links?collection_id=&status=`.
- **Coleção pública sem login:** `colecao.html?s=SLUG`, com os links agrupados por status.
- **Validação no servidor** em todas as rotas; o cliente só repete as regras por conveniência.

## Tecnologias

- **Cliente:** HTML5, CSS3 e JavaScript puro (módulos ES), sem frameworks e sem CDN.
- **Backend:** Cloudflare Pages Functions (`functions/`).
- **Banco:** Cloudflare D1 (SQLite), binding `DB`.

## Estrutura

```
P26-2A-567B-6EC5-D24D-9098/
├── public/            interface (index.html, colecao.html, styles.css, app.js, colecao.js, js/)
├── functions/         API serverless (_lib/ e api/)
├── migrations/        0001_init.sql e 0002_bookmarks.sql
├── tests/             testes automatizados, checklist manual e relatório de QA
├── skills/            serverless-d1-discord, vanilla-dom-ui e teste-validacao
├── wrangler.jsonc     configuração (binding DB)
├── AGENTS.md          agentes, harness e skills
├── LICENSE            MIT
└── README.md
```

## Rotas da API

Erros vêm sempre como `{"error":"mensagem"}`. Rotas protegidas respondem `401` sem sessão. Recurso de outro usuário responde `404`.

| Método e rota | Login | Descrição |
|---|---|---|
| `GET /api/auth/discord` | não | Inicia o login e redireciona para o Discord |
| `GET /api/auth/discord/callback` | não | Conclui o login; volta para `/?login=success` ou `/?auth_error=CODIGO` |
| `GET /api/auth/me` | sim | `{user_id, username, avatar}` |
| `POST /api/auth/logout` | sim | Apaga a sessão e o cookie |
| `GET /api/collections` | sim | Lista as coleções do usuário |
| `POST /api/collections` | sim | Cria coleção `{name, description?}` |
| `PATCH /api/collections/:id` | sim | Renomeia ou altera a descrição |
| `PATCH /api/collections/:id/visibility` | sim | `{is_public: true/false}`; gera ou apaga o slug público |
| `DELETE /api/collections/:id` | sim | Exclui a coleção e seus links |
| `GET /api/links?collection_id=&status=` | sim | Lista links; filtros opcionais e combináveis |
| `POST /api/links` | sim | Cria link `{collection_id, url, title, summary?, status?}` |
| `PATCH /api/links/:id` | sim | Altera qualquer subconjunto dos campos |
| `DELETE /api/links/:id` | sim | Exclui o link |
| `GET /api/public/:slug` | não | Coleção pública (somente leitura) |

Limites validados no servidor: nome da coleção 1 a 80 caracteres, descrição até 500, título do link 1 a 200, resumo até 1000, URL até 2048, corpo da requisição até 16 KB.

---

## Como rodar localmente

1. Crie o arquivo `.dev.vars` dentro da pasta do projeto (ele está no `.gitignore`, nunca vai para o GitHub):
   ```
   DISCORD_CLIENT_ID=seu_client_id
   DISCORD_CLIENT_SECRET=seu_client_secret
   ```
2. No Discord Developer Portal, em **OAuth2 → Redirects**, cadastre `http://localhost:8788/api/auth/discord/callback`.
3. Aplique as migrations no banco local e suba o servidor:
   ```
   cd P26-2A-567B-6EC5-D24D-9098
   npx wrangler d1 migrations apply DB --local
   npx wrangler pages dev
   ```
4. Abra `http://localhost:8788`.

## Testes

Os testes automatizados usam `node:test` e `fetch`, sem dependências (Node 18 ou superior). Com o servidor local rodando:

```
npx wrangler d1 execute DB --local --file=tests/seed-qa.sql
node --test tests/api.test.mjs
npx wrangler d1 execute DB --local --file=tests/cleanup-qa.sql
```

O `seed-qa.sql` cria usuários e sessões fictícios só no banco local. Os testes recusam rodar contra URLs que não sejam `localhost`, a menos que `QA_ALLOW_REMOTE=1` seja definido. O roteiro manual está em `tests/CHECKLIST_MANUAL.md` e o relatório em `tests/RELATORIO_QA.md`.

## Como foi publicado (Cloudflare Pages + D1 + Discord OAuth2)

A publicação foi feita pelo terminal, com o `wrangler`, a partir da pasta do projeto:

1. Login na conta Cloudflare:
   ```
   npx wrangler login
   ```
2. Criação do banco D1 e atualização do `wrangler.jsonc` (`database_name` e `database_id`, binding `DB`):
   ```
   npx wrangler d1 create bookmark-manager
   npx wrangler d1 migrations apply DB --remote
   ```
3. Criação do projeto no Pages e guarda das chaves do Discord:
   ```
   npx wrangler pages project create projeto-p26-2a-567b-6ec5-d24d-9098 --production-branch=main
   npx wrangler pages secret put DISCORD_CLIENT_ID --project-name=projeto-p26-2a-567b-6ec5-d24d-9098
   npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name=projeto-p26-2a-567b-6ec5-d24d-9098
   ```
4. Publicação (o binding `DB` vem do `wrangler.jsonc`):
   ```
   npx wrangler pages deploy public --project-name=projeto-p26-2a-567b-6ec5-d24d-9098 --branch=main
   ```
5. No Discord Developer Portal, em **OAuth2 → Redirects**, foi cadastrado o endereço de produção:
   `https://projeto-p26-2a-567b-6ec5-d24d-9098.pages.dev/api/auth/discord/callback`

Os segredos (`DISCORD_CLIENT_SECRET`) ficam só no Cloudflare e no `.dev.vars` local; nunca no repositório.

## Notas e limitações

- A migration `0002_bookmarks.sql` remove de propósito a tabela `project_records`, que era apenas um exemplo gerado pelo script oficial.
- Não há paginação nas listagens.
- A URL do avatar público (formato do CDN do Discord) contém o ID do usuário do Discord. Esse ID não é segredo, mas fica visível na rota pública.
- Os achados da revisão de QA ainda em aberto estão listados em `tests/RELATORIO_QA.md`.

## Agentes e skills

A documentação dos agentes, do harness utilizado e das skills está em [`AGENTS.md`](./AGENTS.md). As skills ficam em `skills/`.

## Licença

Distribuído sob a licença MIT. Veja o arquivo [`LICENSE`](./LICENSE).