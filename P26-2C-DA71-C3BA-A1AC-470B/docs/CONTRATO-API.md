# Contrato da API — Loja de Créditos Fictícios (P26-2C-DA71-C3BA-A1AC-470B)

Documento escrito pelo agente orquestrador antes da implementação. Backend
(`functions/`) e frontend (`public/`) foram construídos por agentes
diferentes a partir **somente** deste contrato; o agente de teste valida a
implementação contra ele.

Todas as respostas são JSON (`Content-Type: application/json; charset=utf-8`),
exceto os redirecionamentos do OAuth2. Erros sempre seguem o formato:

```json
{ "ok": false, "error": "codigo_maquina", "message": "Mensagem legível em pt-BR" }
```

Valores monetários são inteiros em **créditos**.

## Autenticação (Discord OAuth2)

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/api/auth/discord` | Gera `state` aleatório, grava no cookie `oauth_state` (HttpOnly, 10 min) e redireciona (302) para `https://discord.com/oauth2/authorize` com `scope=identify`. Se `DISCORD_CLIENT_ID` não estiver configurado: 503 `oauth_not_configured`. |
| GET | `/api/auth/discord/callback` | Confere `state` contra o cookie (senão redireciona para `/?auth_error=invalid_state`), troca o `code` por token, lê `/users/@me`, faz **upsert** do usuário (saldo inicial `INITIAL_BALANCE` só na criação; nome e avatar atualizados a cada login), cria sessão e redireciona para `/?login=success`. |
| POST | `/api/auth/logout` | Apaga a sessão no D1 e expira o cookie. 200 `{ ok: true }`. |

Sessão: cookie `sid` = 32 bytes aleatórios em hex; HttpOnly, Secure,
SameSite=Lax, Path=/, Max-Age 7 dias. No D1 guarda-se só o SHA-256 do token
(`sessions.token_hash`). Sessão expirada = não autenticado.

## Rotas da loja

### `GET /api/me` (autenticado)
200:
```json
{ "ok": true, "user": { "user_id": "123", "username": "pedro", "avatar": "https://cdn.discordapp.com/...", "balance": 5000, "created_at": "..." } }
```
401 `unauthorized` sem sessão válida.

### `GET /api/products` (público)
Query opcionais (o servidor também filtra; o frontend pode filtrar localmente):
`q` (busca em nome/descrição), `category`, `min`, `max` (preço inteiro),
`sort` = `price_asc` | `price_desc` | `name` (padrão `name`).
Parâmetro inválido (ex.: `min=abc`, `min>max`) → 400 `invalid_filter`.

200:
```json
{ "ok": true, "products": [ { "id": 1, "sku": "PER-001", "name": "...", "description": "...", "category": "Periféricos", "price": 890, "stock": 12, "icon": "⌨️" } ],
  "categories": ["Colecionáveis", "Itens Digitais", "Periféricos", "Software"],
  "priceRange": { "min": 50, "max": 2900 } }
```
`categories` e `priceRange` refletem o catálogo inteiro, não o filtro.

### `POST /api/checkout` (autenticado)
Corpo:
```json
{ "items": [ { "productId": 1, "quantity": 2 }, { "productId": 8, "quantity": 1 } ] }
```
Regras validadas **no servidor** (o cliente não envia preço nem total):
- `items` array com 1 a 50 entradas; `productId` inteiro > 0; `quantity` inteiro 1..99. IDs repetidos são somados. Caso contrário → 400 `invalid_items`.
- Produto inexistente → 404 `product_not_found` com `productId`.
- Estoque insuficiente → 409 `insufficient_stock` com `details: [{ productId, name, requested, available }]`.
- Total (preço do D1 × quantidade) maior que o saldo → 409 `insufficient_balance` com `total` e `balance`.
- Débito do saldo, baixa de estoque, criação de `orders` e `order_items` acontecem num único `env.DB.batch()`; os CHECKs (`balance >= 0`, `stock >= 0`) fazem o lote inteiro falhar em corrida → 409 `conflict_retry`.
- Corpo não-JSON → 400 `invalid_json`. Header `Origin` de outro host → 403 `forbidden_origin`.

201:
```json
{ "ok": true, "order": { "id": "uuid", "total": 1199, "item_count": 3, "balance_before": 5000, "balance_after": 3801, "created_at": "...",
  "items": [ { "product_id": 1, "product_name": "...", "unit_price": 890, "quantity": 1, "subtotal": 890 } ] },
  "balance": 3801 }
```

### `GET /api/orders` (autenticado)
200 `{ ok: true, orders: [ ...mesmo formato de "order" acima, mais recentes primeiro, com items ] }` (máx. 50).

### `GET /api/orders/:id` (autenticado)
200 `{ ok: true, order }`. Pedido de outro usuário ou inexistente → 404 `order_not_found`.

### `GET /api/status` (público)
200 `{ ok: true, chave, projectId: 35, d1Connected: bool, discordOAuthConfigured: bool, products: n, serverTimestamp }`.

## Comportamentos gerais
- Rota `/api/*` desconhecida → 404 JSON `not_found` (via `functions/api/_middleware.js`, **sem** catch-all `[[path]]`, para não quebrar o 405 automático).
- Método não suportado numa rota existente → 405.
- Toda query D1 usa `prepare(...).bind(...)`.
