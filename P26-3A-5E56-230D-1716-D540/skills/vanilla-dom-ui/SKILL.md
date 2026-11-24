---
name: vanilla-dom-ui
description: Como construir a interface do projeto só com HTML5, CSS3 e JavaScript puro (sem frameworks) — DOM seguro, filtros rápidos, responsividade e acessibilidade. Usar ao criar ou alterar qualquer arquivo em public/.
---

# Skill: Interface em HTML5 + CSS3 + Vanilla JS

Contrato da API: `docs/ESPECIFICACAO.md`. A interface **não decide regra de negócio**: valida para
ajudar o usuário, mas sempre mostra a mensagem de erro que o servidor devolver.

## Proibido
- React, Vue, Angular, Svelte, jQuery, Bootstrap, Tailwind, qualquer CDN de UI, bundler/transpiler.
- `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` **com dado vindo do servidor ou do usuário**.
  Use `document.createElement` + `textContent`. (Template estático sem dado: `<template>` no HTML + `cloneNode`.)
- Script inline (`<script>…</script>` com código) e `onclick="…"`: a CSP do site bloqueia. Só `<script type="module" src>`.
- `style="…"` inline (CSP `style-src 'self'`). Use classes.

## Padrões
- ES modules nativos: `public/js/api.js` (fetch + erros), `public/js/ui.js` (helpers `el(tag, attrs, ...filhos)`),
  `public/js/app.js` (estado e telas).
- `fetch` com `credentials: 'same-origin'` e `headers: {'Content-Type':'application/json'}` em POST.
- **Filtros cruzados rápidos**: chips para tipo/categoria/status, busca com *debounce* de 250 ms,
  intervalo de datas; cada mudança refaz `GET /api/itens?...` e cancela a requisição anterior com
  `AbortController`. Filtros refletidos na URL (`history.replaceState`) para dar para compartilhar o link.
- Contadores por categoria/tipo vindos de `contagens` na resposta.
- Estados de tela: carregando (skeleton), vazio (mensagem útil), erro (com "tentar de novo").
- Diálogos com `<dialog>` nativo (`showModal()`), formulários com `<form>` + validação HTML5
  (`required`, `minlength`, `maxlength`, `max` na data) e contadores de caracteres.
- Datas exibidas em pt-BR (`Intl.DateTimeFormat('pt-BR')`); datas `YYYY-MM-DD` tratadas como data local.

## Layout e acessibilidade
- Mobile-first, CSS Grid para os cartões (`repeat(auto-fill, minmax(260px, 1fr))`), sem rolagem horizontal em 360 px.
- Variáveis CSS em `:root`, tema escuro com `prefers-color-scheme`.
- Contraste AA, foco visível (`:focus-visible`), `aria-live="polite"` para avisos/toasts,
  rótulos `<label for>` em todo campo, botões de verdade (`<button>`), alvo de toque ≥ 44 px.
- `prefers-reduced-motion` desliga animações.

## Rodapé obrigatório
O `<footer>` do `index.html` deve conter o texto literal `P26-3A-5E56-230D-1716-D540`.
