---
name: teste-validacao
description: Protocolo do agente de teste e validação — sobe o ambiente local (wrangler pages dev + D1 local), testa o contrato da API de ponta a ponta, tenta burlar as regras de negócio do checkout e audita a rubrica. Use antes de qualquer entrega ou após mudanças em functions/, migrations/ ou public/.
---

# Skill: Agente de Teste e Validação

Usada pelo **Agente 4 (Teste e Validação)**. Ele não escreve código de
produção: só testes, relatórios e, se achar defeito, um relatório com
passos de reprodução para o agente responsável.

## 1. Ambiente de teste (não confie, verifique)
1. Dentro da subpasta do projeto, aplicar as migrações **sempre** — o
   comando é idempotente e uma frase "já está migrado" num briefing é uma
   alegação, não um fato:
   `CI=1 npx wrangler d1 migrations apply DB --local < /dev/null`
   (`migrations apply` não tem `--yes`; sem `CI=1` num shell não interativo
   ele pode só imprimir ajuda e sair com 0). Confira na saída a tabela de
   migrações aplicadas, não o código de saída.
2. Subir `npx wrangler pages dev public --port 8788` em segundo plano.
3. **Portão de saúde:** `GET /api/status` precisa responder
   `d1Connected: true` e `products > 0` antes de qualquer outro teste.
   Se falhar, o relatório é "ambiente quebrado", não uma lista de falhas.

## 2. Usuários de teste sem Discord
O login real exige o Discord. Para testes locais, criar usuário e sessão
diretamente no D1 local (nunca em produção, nunca uma rota de bypass):
gerar token aleatório, inserir `users` e `sessions` (com o SHA-256 do token)
via `wrangler d1 execute DB --local --command ...` e enviar `Cookie: sid=<token>`.

## 3. Casos obrigatórios (`tests/api.test.mjs`, Node puro, sem dependências)
- Status, catálogo, filtros (`min`, `max`, `category`, `q`, `sort`) e filtro inválido → 400.
- Rotas autenticadas sem cookie → 401; cookie inválido/expirado → 401.
- Checkout feliz: saldo debitado = Σ preço_D1 × qtd; estoque baixado; pedido
  e itens no histórico; `GET /api/orders/:id` devolve o recibo.
- **Anti-manipulação:** enviar `price`, `total` ou `user_id` no corpo não muda
  nada; quantidade 0, negativa, fracionária, string, >99 → 400; produto
  inexistente → 404; estoque insuficiente → 409 e **nada** muda no banco;
  saldo insuficiente → 409 e **nada** muda; `Origin` estranho → 403.
- Concorrência: vários checkouts simultâneos que juntos estouram o saldo —
  saldo final nunca negativo e soma dos pedidos = saldo inicial − saldo final.
- Pedido de outro usuário → 404. `PUT /api/checkout` → 405. `/api/nada` → 404 JSON.
- Comportamentos implícitos do framework (405 automático, fallback) também
  são testados, não só as rotas escritas.

## 4. Frontend
- Abrir no navegador, conferir catálogo, filtros, carrinho, checkout e
  recibo com a sessão de teste; conferir rodapé com a chave; largura 375 px
  sem rolagem horizontal; console sem erros.
- Varredura estática: nenhum framework/CDN em `public/`, nenhum
  `innerHTML` com dados da API.

## 5. Rubrica
- `node validar-local.mjs P26-2C-DA71-C3BA-A1AC-470B` na raiz do repositório.
- Relatório final em `tests/RELATORIO-VALIDACAO.md`: comandos executados,
  resultados (passou/falhou), defeitos encontrados e status de cada item.
