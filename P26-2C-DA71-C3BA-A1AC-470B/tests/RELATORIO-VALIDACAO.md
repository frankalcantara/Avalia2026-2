# Relatório de Validação — P26-2C-DA71-C3BA-A1AC-470B

- **Data:** 2026-11-17
- **Agente:** Agente 4 — Teste e Validação (protocolo `skills/teste-validacao/SKILL.md`)
- **Harness:** Claude Code (shell Bash/Git Bash no Windows 11, Node v26.8.1, wrangler 4.164.0)
- **Escopo:** contrato `docs/CONTRATO-API.md` contra `functions/`, `public/`, `migrations/`, tudo local (`--local`), sem conta Cloudflare e sem credenciais do Discord.

**Resultado:** ambiente saudável; **47 de 49 casos da API passaram e 2 falharam**. Os 2 são o mesmo defeito, de baixa severidade (veja D1).
A suíte rodou duas vezes, com resultado idêntico. O fluxo do frontend no navegador passou. O `validar-local.mjs` deu 8 itens OK e 1 PENDENTE (deploy online, ainda não publicado).

---

## 1. Comandos executados

```bash
# na subpasta do projeto
CI=1 npx wrangler d1 migrations apply DB --local < /dev/null
#   saída: "✅ No migrations to apply!" (0001 e 0002 já aplicadas)
CI=1 npx wrangler d1 execute DB --local --command "SELECT name FROM d1_migrations; SELECT COUNT(*) n, SUM(stock) s FROM products; ..."
#   conferência independente: 18 produtos, Σ estoque 1157 (= seed), 0 usuários, 0 pedidos

CI=1 npx wrangler pages dev public --port 8788        # em segundo plano

# portão de saúde
curl -s http://localhost:8788/api/status
#   {"ok":true,"chave":"P26-2C-DA71-C3BA-A1AC-470B","projectId":35,"d1Connected":true,
#    "discordOAuthConfigured":false,"products":18,...}

node tests/api.test.mjs                                # 1ª execução: 47 passaram, 2 falharam
# (teste de frontend no navegador embutido; detalhes na seção 4)
node tests/api.test.mjs                                # 2ª execução: idêntica, e ela também limpa a fixture de UI
CI=1 npx wrangler d1 execute DB --local --json --command "SELECT COUNT(*) FROM users; SELECT SUM(stock) FROM products; ..."
#   pós-limpeza: users 0, Σ estoque 1157, orders 0, sessions 0  → banco local de volta ao seed

# raiz do repositório
node validar-local.mjs P26-2C-DA71-C3BA-A1AC-470B

# encerramento: a tarefa foi parada, mas o workerd continuou escutando na 8788
netstat -ano | grep 8788          # LISTENING PID 8076 (workerd)
# Stop-Process 8076, 6820 (workerd) e 14680 (node wrangler pages dev)
netstat -ano | grep 8788 | grep -c LISTEN   # 0
```

A suíte chama o mesmo binário do `npx wrangler` (`node node_modules/wrangler/bin/wrangler.js d1 execute DB --local --json --command ...`, com `CI=1`) via `spawnSync`, sem passar pelo shell. Assim o `cmd.exe` não quebra as aspas do SQL. Se o arquivo não existir, ela cai em `npx wrangler`.

### Fixtures
- Usuários `test-a4-a` … `test-a4-g`, inseridos direto no D1 local, com saldos 5000/5000/1000/100/100000/5000/5000.
- Sessões: token aleatório de 32 bytes em hex no cookie `sid`; SHA-256 hex em `sessions.token_hash`; `expires_at` em epoch segundos (agora + 3600).
- Uma sessão expirada (`expires_at` = agora − 60).
- Na limpeza, antes e depois da suíte, são apagados `order_items`, `orders`, `sessions` e `users` com `user_id LIKE 'test-a4-%'`. Os estoques voltam aos valores lidos de `migrations/0002_seed_products.sql`.

---

## 2. Casos da API (`tests/api.test.mjs`) — resultado real

| # | Caso | Resultado |
|---|------|-----------|
| 1 | `GET /api/status`: chave, projectId 35, d1Connected, products = 18, serverTimestamp | PASSOU |
| 2 | `GET /api/products`: 18 produtos, campos do contrato, preço/estoque = seed, categories (4), priceRange {50, 2900} | PASSOU |
| 3 | Ordenação padrão por nome | PASSOU |
| 4 | `sort=price_asc` / `price_desc` | PASSOU |
| 5 | `category=Software` → 3; categories/priceRange continuam os do catálogo inteiro | PASSOU |
| 6 | `q=teclado` (nome), `q=100 níveis` (descrição), `q=%` literal → 0 | PASSOU |
| 7 | `min=100&max=500` (inclusivo, 9 itens); `min=max=890` → só PER-001 | PASSOU |
| 8–12 | `min=abc`, `max=-1`, `min=1.5`, `min=500&max=100`, `sort=foo` → 400 `invalid_filter` | PASSOU (5/5) |
| 13–16 | Sem cookie: `GET /api/me`, `GET /api/orders`, `GET /api/orders/abc`, `POST /api/checkout` → 401 `unauthorized` | PASSOU (4/4) |
| 17 | Cookie inválido (token inexistente, não-hex, o próprio hash como token) → 401 | PASSOU |
| 18 | Sessão expirada → 401 em `/api/me`, `/api/orders`, `/api/checkout`; banco inalterado (snapshot) | PASSOU |
| 19 | `GET /api/me` válido → user_id, username, balance 5000, avatar, created_at | PASSOU |
| 20 | **Checkout feliz** (Origin = mesma origem): 2×PER-001 + 1×DIG-002 → 201; total = Σ preço_D1×qtd; item_count 3; balance_before/after; saldo, estoques, orders +1 e order_items +2 conferidos **no D1** | PASSOU |
| 21 | `GET /api/orders/:id` devolve o recibo idêntico ao do 201; o pedido aparece em `GET /api/orders` | PASSOU |
| 22 | IDs repetidos somados (1+2 → um item com qtd 3) | PASSOU |
| 23 | Histórico: mais recentes primeiro, todos com `items`, ≤ 50 | PASSOU |
| 24 | **Anti-manipulação:** `price`, `unit_price`, `subtotal`, `total`, `user_id`/`userId` (de outro usuário) e `balance` no corpo são ignorados; total vem do D1; o débito cai no usuário da sessão; o outro usuário fica intocado e sem pedido | PASSOU |
| 25 | **Anti-manipulação:** 14 corpos inválidos (qtd 0, −1, 1.5, "2", 100, ausente; productId 0, "1", 1.5; items vazio/ausente/objeto/51 entradas/[null]) → 400 `invalid_items`; snapshot do banco idêntico | PASSOU |
| 26 | Corpo não-JSON → 400 `invalid_json` | PASSOU |
| 27 | Produto inexistente (misturado com um válido) → 404 `product_not_found` com `productId`; nada muda | PASSOU |
| 28 | **Estoque insuficiente** (COL-001 com qtd 4 e estoque 3; COL-003 com estoque 0; mais um item válido no carrinho) → 409 `insufficient_stock` com `details` exatos dos 2 itens; **saldo, estoques, orders e order_items idênticos** | PASSOU |
| 29 | **Saldo insuficiente** (saldo 100, PER-004 a 2900) → 409 `insufficient_balance` com `total` e `balance`; **nada muda** | PASSOU |
| 30 | Saldo exato (2×50 = 100) → 201, saldo 0; compra seguinte → 409 | PASSOU |
| 31 | `Origin: https://evil.example` → 403 `forbidden_origin`; nada muda | PASSOU |
| 32 | **Concorrência de saldo:** 8 checkouts simultâneos de 450 com saldo 1000 → 2 respostas 201 e 6 respostas 409 `conflict_retry`; saldo final 100 (≥ 0); Σ totais (900) = inicial − final; estoque baixou exatamente 2; pedidos gravados = 201s; balance_before − total = balance_after em todos | PASSOU |
| 33 | **Concorrência de estoque:** 6 checkouts simultâneos de COL-001 (estoque 3) → 3 respostas 201; estoque 3 → 0 (nunca negativo); débito = 3 × preço | PASSOU |
| 34 | **Concorrência mista:** 2 usuários × 4 carrinhos simultâneos (3×PER-003 + 2×SOF-003) → 2 respostas 201; estoque + vendido = inicial para cada produto; Σ débitos = Σ totais | PASSOU |
| 35 | **Pedido de outro usuário** → 404 `order_not_found`; UUID inexistente e id de 200 caracteres → 404; o pedido não vaza no histórico do outro | PASSOU |
| 36 | `PUT /api/checkout` → 405 JSON `method_not_allowed` | PASSOU |
| 37 | `GET /api/checkout` → 405 | **FALHOU** (veio 404 `not_found`; defeito D1) |
| 38 | `DELETE /api/me` → 405 JSON | PASSOU |
| 39 | `POST /api/products` → 405 JSON | PASSOU |
| 40 | `GET /api/auth/logout` → 405 | **FALHOU** (veio 404 `not_found`; defeito D1) |
| 41–43 | `/api/nada`, `/api/orders/abc/def`, `/api/products/1` → 404 JSON `not_found` | PASSOU (3/3) |
| 44 | `GET /` serve HTML com a chave | PASSOU |
| 45 | `GET /api/auth/discord` sem credenciais → 503 `oauth_not_configured` (esperado localmente) | PASSOU |
| 46 | Callback com `state` ausente ou divergente → 302 `/?auth_error=invalid_state` | PASSOU |
| 47 | Logout com Origin estranho → 403, e a sessão continua válida | PASSOU |
| 48 | Logout: 200 `{ok:true}`, `Set-Cookie: sid=; … Max-Age=0`, sessão apagada no D1; depois `/api/me` e um novo logout → 401 | PASSOU |
| 49 | Invariantes finais no D1: nenhum saldo ou estoque negativo; `orders.total`/`item_count` = Σ dos itens; `subtotal = unit_price × quantity` | PASSOU |

Todas as respostas de erro conferidas têm `Content-Type: application/json` e o formato `{ok:false, error, message}`.

Divergências aceitas pelo orquestrador, tratadas como esperadas e não como defeito: 405 com corpo JSON `method_not_allowed`; logout sem sessão → 401; `sort` inválido → 400; `item_count` = soma das quantidades; erro de batch que não é CHECK → 500 `checkout_failed` (não exercitado: não há como provocá-lo sem mexer no código).

---

## 3. Defeitos

### D1 — GET/HEAD numa rota que só aceita POST devolve 404 `not_found` em vez de 405 (severidade baixa)

O contrato diz: "Método não suportado numa rota existente → 405". Para PUT, DELETE e POST isso vale. Para **GET e HEAD** em rotas que só exportam `onRequestPost` (`/api/checkout`, `/api/auth/logout`), a resposta é 404.

**Reprodução**
```bash
npx wrangler pages dev public --port 8788
curl -i http://localhost:8788/api/checkout            # HTTP/1.1 404  {"ok":false,"error":"not_found",...}
curl -I http://localhost:8788/api/checkout            # HTTP/1.1 404
curl -i -X PUT http://localhost:8788/api/checkout     # HTTP/1.1 405  {"ok":false,"error":"method_not_allowed",...}  (correto)
curl -i http://localhost:8788/api/auth/logout         # HTTP/1.1 404
```

**Causa provável:** `functions/api/_middleware.js`, linhas 13–16. Num GET/HEAD sem Function para o método, o Pages não gera o 405 automático: ele cai no servidor de estáticos, que devolve o `index.html` (fallback de SPA). O middleware vê `text/html` e converte em 404 **antes** de chegar ao tratamento de 405 (linhas 18–21). Ou seja, o 405 automático só existe para métodos que o servidor de estáticos não atende.

**Sugestão para o agente de backend** (não corrigido aqui, por regra):
- exportar `onRequestGet`/`onRequestHead` que devolvam 405 em `checkout.js` e `logout.js`; ou
- no middleware, quando o fallback HTML vier para GET/HEAD num caminho de rota conhecida só-POST, responder 405 com `Allow: POST`.

**Impacto:** nenhum na segurança nem nas regras de negócio (nada é executado). É só uma divergência de código HTTP em relação ao contrato.

Nenhum defeito encontrado nas regras de negócio: preço do servidor, atomicidade, ausência de saldo ou estoque negativo sob concorrência, isolamento entre usuários, expiração de sessão e Origin.

---

## 4. Frontend (navegador embutido do Claude Code, `http://localhost:8788/`)

| Verificação | Resultado |
|---|---|
| Página deslogada: catálogo com 18 cards, botões "Entre para comprar", COL-003 marcado como "Esgotado" | PASSOU |
| Rodapé com `Chave Única: P26-2C-DA71-C3BA-A1AC-470B` (também no `<title>`) | PASSOU |
| Filtros (os eventos reais dos controles disparados via JS): categoria Software → "3 de 18 produtos"; busca "teclado" → "1 de 18"; faixa 100–500 → "9 de 18"; "Só disponíveis" → "17 de 18"; "Menor preço" → primeiro COL-002 (50 cr); "Limpar filtros" → 18 | PASSOU |
| Login simulado: sessão de teste no D1 e `document.cookie = "sid=<token>; path=/"`, depois recarregar → cabeçalho "Teste UI", ID test-a4-ui, saldo 5.000 cr | PASSOU |
| Adicionar ao carrinho: 2× Mouse (420) + 1× Emote (80) → total estimado 920 cr, saldo restante estimado 4.080 cr | PASSOU |
| Finalizar compra → aviso "Compra concluída! 920 cr debitados. Novo saldo: 4.080 cr."; saldo do cabeçalho 4.080 cr; carrinho esvaziado; estoque do Emote 200 → 199 na grade | PASSOU |
| Recibo (`#receipt`): pedido, data, cliente, itens (qtd, unitário, subtotal), total 920, saldo antes 5.000, depois 4.080, chave no rodapé do recibo | PASSOU |
| "Meus pedidos": "1 pedido (mais recentes primeiro)", resumo dos itens, "Ver recibo →" abre o recibo | PASSOU |
| 375 px (preset mobile): `scrollWidth` = `innerWidth` = 375, nenhum elemento passa da borda direita; captura de tela visualmente correta | PASSOU |
| "Sair" → volta ao estado deslogado ("Entrar com Discord") e o cookie é removido | PASSOU |
| Console: um único erro, `401 (Unauthorized)` no carregamento deslogado (sondagem de `/api/me` sem sessão) | PASSOU (esperado, não é erro de código) |
| Varredura estática de `public/`: nenhum `innerHTML` em `app.js`, nenhum `<script>`/`<link>` externo (só `/styles.css` e `/app.js`) | PASSOU |

O viewport voltou para desktop ao final e a aba foi fechada. A fixture de UI (`test-a4-ui`) foi removida pela 2ª execução da suíte.

**Limitação:** com o painel do navegador oculto, o viewport ficou 0×0 e `read_page` não funcionou. Por isso as interações foram feitas com `.click()` e eventos `input`/`change` disparados via `javascript_tool` nos elementos reais, e não por clique em coordenadas. A captura de tela só foi feita na largura de 375 px.

---

## 5. Saída do `validar-local.mjs`

```
==================================================================
  RELATÓRIO DE PRÉ-VALIDAÇÃO LOCAL (P26-2C-DA71-C3BA-A1AC-470B)
==================================================================
  ✅ [OK]     1. Arquivo LICENSE (MIT)
  ✅ [OK]     2. Chave Única no README.md
  ✅ [OK]     3. Chave Única no rodapé do HTML
  ✅ [OK]     4. Documento AGENTS.md (Mín. 3 agentes)
  ✅ [OK]     5. Agente de Teste e Validação documentado
  ✅ [OK]     6. Arquivos de Skills na pasta skills/
  ✅ [OK]     7. Frontend HTML/CSS/JS Puro (Sem frameworks proibidos)
  ✅ [OK]     8. Backend Cloudflare Functions + D1 + Discord OAuth2
  ⚠️ [PENDENTE] 9. Deploy Online na Cloudflare (https://loja-creditos-p26-2c-da71.pages.dev)
==================================================================
```

O item 9 fica pendente: o projeto ainda não foi publicado.

---

## 6. Não testado / fora do alcance local

- **Fluxo OAuth2 real com o Discord** (troca de `code`, `/users/@me`, upsert com `INITIAL_BALANCE` só na criação, criação de sessão pelo callback): não há credenciais locais. Foram testados só o 503 `oauth_not_configured` e a rejeição de `state` inválido.
- **Atributos do cookie `sid` emitido pelo callback** (HttpOnly/Secure/SameSite/Max-Age 7 dias): só por leitura de código (`functions/_lib/cookies.js`), não em execução.
- **500 `checkout_failed`** (erro de batch que não é CHECK): não reproduzível sem alterar o código.
- **Ambiente remoto (D1 de produção, `*.pages.dev`):** não publicado.
- **Limite de 50 pedidos em `/api/orders`:** conferido só como "≤ 50". Não foram criados 51 pedidos.

## 5. Reteste após correção (2026-11-17)

- **Correção do defeito D1** (feita pelo orquestrador): `functions/api/_middleware.js` passou a responder 405 `method_not_allowed` (`Allow: POST`) para GET/HEAD nas rotas só-POST (`/api/checkout`, `/api/auth/logout`), em vez de converter o fallback HTML em 404.
- **Reteste:** `node tests/api.test.mjs` contra `wrangler pages dev` com D1 local recém-migrado. Resultado: **49 passaram, 0 falharam, 49 casos.** `GET /api/checkout` → 405 e `GET /api/nada` → 404.
- **Status do defeito D1:** corrigido.
