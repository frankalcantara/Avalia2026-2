---
name: vanilla-dom-ui
description: Padrões de interface do Memorize em HTML5, CSS3 e JavaScript puro (sem frameworks), incluindo a animação 3D de virar o cartão. Use ao criar ou alterar qualquer arquivo em public/.
---

# Skill · Interface Vanilla (HTML5 + CSS3 + JS puro)

## Proibido
- React, Vue, Angular, Svelte, jQuery, Tailwind, Bootstrap ou qualquer biblioteca de UI/CDN.
- `innerHTML` com dados do usuário (risco de XSS). Use `textContent` ou o helper `h(tag, attrs, ...filhos)`.
- Guardar dados de estudo em `localStorage`; a fonte da verdade é o D1.

## Estrutura
- `public/index.html`: todas as telas são `<section class="view">` alternadas com o atributo `hidden`.
- Roteamento por hash: `#/` (baralhos), `#/deck/:id` (gerenciar), `#/study/:id|all` (estudar).
- `public/app.js` é um IIFE em modo estrito; toda chamada à API passa por `api()`, que envia `X-Timezone` e trata 401 voltando ao login.
- O rodapé `<footer>` contém sempre a Chave Única `P26-2A-DF64-8C37-3512-F974`.

## Cartão que vira (CSS 3D)
```css
.flashcard        { perspective: 1400px; }
.flashcard-inner  { display: grid; transform-style: preserve-3d; transition: transform .6s; }
.flashcard.is-flipped .flashcard-inner { transform: rotateY(180deg); }
.face             { grid-area: 1 / 1; backface-visibility: hidden; }
.face-back        { transform: rotateY(180deg); }
```
- As duas faces ocupam a mesma célula do grid, então a altura acompanha a face maior.
- Ao trocar de cartão: `is-leaving` → preenche o próximo com `no-anim` (sem animar a volta) → `is-entering`.
- `prefers-reduced-motion` desliga as animações.

## Interação de estudo
- Clique no cartão, `Espaço` ou `Enter` revela a resposta; só então aparecem **Difícil / Bom / Fácil**.
- Atalhos `1`, `2`, `3`. Cada botão mostra o intervalo previsto devolvido pelo servidor (`preview`).
- Botões ficam desabilitados enquanto a requisição está em andamento (evita clique duplo).

## Acessibilidade e responsividade
- O cartão tem `role="button"`, `tabindex="0"`, `aria-pressed` e `aria-label` atualizados.
- Toasts em região `aria-live`. Foco visível (`:focus-visible`).
- Layout fluido com `grid`/`clamp()`; pontos de quebra em 820px e 560px; tema escuro por `prefers-color-scheme`.
