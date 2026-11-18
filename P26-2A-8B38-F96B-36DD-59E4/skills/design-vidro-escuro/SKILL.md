---
name: design-vidro-escuro
description: Direção visual do projeto: tema escuro com cartões de vidro, destaque violeta, acessível e responsivo, em CSS puro.
---

# Skill: Design escuro com vidro (CSS puro)

## Quando usar
Ao criar ou ajustar o visual de `public/index.html` e `public/styles.css`.

## Regras
- **60-30-10:** 60% fundo `#09090b`, 30% cartões `#0f172a` com 60% de opacidade, borda `rgba(255,255,255,.1)` e `backdrop-filter: blur`, 10% destaque `#8b5cf6` (hover `#a78bfa`).
- **Texto:** principal `#f4f4f5`, secundário `#a1a1aa`; erro `#f87171`. Manter contraste legível sobre o vidro.
- **Cores como variáveis** em `:root`; nenhum framework de UI e nenhuma biblioteca externa.
- **Acessibilidade:** foco visível em campos e botões, `role="alert"` nas mensagens de erro, rótulo em todo campo, alvo de toque confortável.
- **Responsividade:** mobile-first; grade de duas colunas que vira uma coluna abaixo de 560px.
- **Micro-interações:** transição curta em hover e foco; desativar com `prefers-reduced-motion`.
- **Texto gerado pelo usuário** só entra no DOM por `textContent`, nunca por `innerHTML`.

## Verificação
- Conferir a página em 360px de largura e em tela larga.
- Conferir que nenhum texto fica ilegível sobre o fundo de vidro.
