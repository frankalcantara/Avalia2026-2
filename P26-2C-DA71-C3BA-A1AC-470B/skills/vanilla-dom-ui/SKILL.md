---
name: vanilla-dom-ui
description: Padrões para construir a interface da loja em HTML5, CSS3 e JavaScript puro — catálogo, filtros de preço, carrinho com estado local, checkout e histórico — sem frameworks. Use ao escrever ou revisar qualquer arquivo em public/.
---

# Skill: Interface Web Vanilla (HTML5 + CSS3 + JS puro)

Usada pelo **Agente 3 (Frontend)**. Consome somente as rotas descritas em
`docs/CONTRATO-API.md`.

## 1. Proibido
- React, Vue, Angular, Svelte, jQuery, Tailwind, Bootstrap ou qualquer
  biblioteca de UI/CSS. Nenhum `<script src>` externo. Nenhum build.
- `innerHTML` com dados vindos da API ou do usuário. Montar nós com
  `document.createElement` + `textContent` (evita XSS com nomes do Discord).
- `text-shadow` ou `filter: drop-shadow` em textos.

## 2. Estado no cliente
- Um único objeto `state` (`user`, `products`, `filters`, `cart`, `orders`)
  e funções `render*()` que redesenham a partir dele. Eventos alteram o
  `state` e chamam o render — nada de estado escondido no DOM.
- Carrinho: `Map productId → quantity`, persistido em `localStorage`
  (chave por usuário) dentro de `try/catch`. Quantidade nunca passa do
  estoque exibido; o servidor é quem decide de fato.
- Filtros (busca, categoria, preço mínimo/máximo, ordenação) aplicados
  localmente sobre `state.products`, com feedback imediato.
- O total do carrinho é só informativo. O checkout envia apenas
  `{ items: [{ productId, quantity }] }`.

## 3. Fluxos obrigatórios
1. Sem sessão (`GET /api/me` → 401): catálogo visível, botão "Entrar com
   Discord" (`/api/auth/discord`), carrinho/checkout bloqueados.
2. Com sessão: cabeçalho com avatar, nome, user_id e saldo de créditos.
3. Checkout: botão desabilitado durante a requisição; em 201 atualizar
   saldo, estoques (recarregar `/api/products`), limpar carrinho e abrir o
   recibo; em 409 mostrar a mensagem do servidor (saldo ou estoque) sem
   perder o carrinho.
4. Histórico de pedidos com recibo detalhado (itens, preço unitário,
   subtotal, total, saldo antes/depois, data, id).

## 4. Acessibilidade e responsividade
- HTML semântico (`header`, `main`, `section`, `aside`, `footer`, `dialog`).
- `aria-live="polite"` para mensagens de status; botões com rótulo textual.
- Layout em CSS Grid/Flex; uma coluna abaixo de 760 px; sem rolagem
  horizontal em 360 px. Foco visível em todos os controles.
- Respeitar `prefers-color-scheme` com variáveis CSS.

## 5. Rodapé
- `<footer>` com a Chave Única `P26-2C-DA71-C3BA-A1AC-470B`, link do
  repositório e menção à licença MIT.
