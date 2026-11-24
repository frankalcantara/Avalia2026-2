# Projeto #35: Simulador de E-Commerce com Carteira de Créditos Fictícios

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Pedro Henrique De França Vidal
- **Turma:** 2C
- **Chave Única:** `P26-2C-DA71-C3BA-A1AC-470B`
- **URL_CLOUDFLARE:** https://loja-creditos-p26-2c-da71.pages.dev
- **Licença:** MIT ([LICENSE](./LICENSE))

---

## O que é

Uma loja virtual que simula a compra de itens digitais e periféricos
fictícios usando uma carteira de créditos virtuais:

- **Login exclusivo via Discord OAuth2** — importa `user_id`, nome e avatar.
  No primeiro login o backend cria a conta no D1 com **5000 créditos**.
- **Catálogo** com busca, filtro por categoria, faixa de preço (mínimo e
  máximo) e ordenação — tudo em JavaScript puro.
- **Carrinho** com estado no cliente (persistido em `localStorage`),
  limitado pelo estoque.
- **Checkout validado no servidor** (Cloudflare Pages Function): o preço vem
  do D1, não do navegador; confere estoque e saldo, debita o saldo, baixa o
  estoque e grava o pedido numa única transação (`env.DB.batch()`), com
  `CHECK (balance >= 0)` e `CHECK (stock >= 0)` como trava contra corrida.
- **Histórico de pedidos** com recibo detalhado (itens, subtotais, saldo
  antes e depois) e versão para impressão.

## Arquitetura

```
public/            Frontend HTML5 + CSS3 + Vanilla JS (sem frameworks)
functions/
  _lib/            helpers: JSON, cookies, sessão, validação de Origin
  api/
    _middleware.js 404 JSON para /api/* desconhecido
    auth/          discord.js · discord/callback.js · logout.js
    me.js · products.js · checkout.js · orders.js · orders/[id].js · status.js
migrations/        0001_init.sql (esquema) · 0002_seed_products.sql (catálogo)
docs/              CONTRATO-API.md (contrato entre backend e frontend)
tests/             api.test.mjs + RELATORIO-VALIDACAO.md (agente de teste)
skills/            SKILL.md usados pelos agentes
AGENTS.md          agentes, harness e como foram usados
```

Modelo de dados (D1): `users` (saldo), `sessions` (hash do token),
`products` (preço e estoque), `orders` (recibo) e `order_items`
(nome e preço congelados no momento da compra).

O contrato completo das rotas está em [docs/CONTRATO-API.md](./docs/CONTRATO-API.md).

## Rodar localmente

```powershell
cd P26-2C-DA71-C3BA-A1AC-470B
npm.cmd install
npx.cmd wrangler d1 migrations apply DB --local
# crie .dev.vars com DISCORD_CLIENT_ID=... e DISCORD_CLIENT_SECRET=...
npx.cmd wrangler pages dev public --port 8788
```

No Discord Developer Portal, adicione o redirect
`http://localhost:8788/api/auth/discord/callback` para testar o login local.

Testes de API (com o servidor local rodando): `node tests/api.test.mjs`.

## Publicar no Cloudflare Pages + D1 + Discord

1. **D1:**
   ```powershell
   npx.cmd wrangler d1 create db-p26-2c-da71-c3ba-a1ac-470b
   # copie o database_id gerado para wrangler.jsonc
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
2. **Pages:** Workers & Pages → Create → Pages → Connect to Git → fork
   `Avalia2026-2`. Root directory: `P26-2C-DA71-C3BA-A1AC-470B`; Build
   command: vazio; Build output directory: `public`.
   (Alternativa: `npx.cmd wrangler pages deploy public`.)
3. **Binding:** Settings → Functions → D1 database bindings → `DB` →
   `db-p26-2c-da71-c3ba-a1ac-470b`.
4. **Discord OAuth2:** crie uma Application no
   [Discord Developer Portal](https://discord.com/developers/applications),
   adicione o redirect `https://<seu-projeto>.pages.dev/api/auth/discord/callback`
   e configure `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (secret) em
   Settings → Environment variables (ou `npx.cmd wrangler pages secret put`).
5. Atualize `URL_CLOUDFLARE` acima e rode, na raiz do repositório:
   `node validar-local.mjs P26-2C-DA71-C3BA-A1AC-470B`.

## Agentes

Ver [AGENTS.md](./AGENTS.md). Quatro agentes (orquestrador, backend,
frontend e teste/validação) trabalharam no harness **Claude Code**, cada um
com uma skill em [`skills/`](./skills).

---

Chave Única de Auditoria: **P26-2C-DA71-C3BA-A1AC-470B**
