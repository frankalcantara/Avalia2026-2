---
name: vanilla-dom-ui
description: Padrões de interface em HTML5 semântico, CSS3 e JavaScript puro (sem frameworks) — DOM direto, recálculo instantâneo no input, responsividade mobile-first e acessibilidade. Use ao criar ou alterar arquivos em public/.
---

# Skill: Interface Web em HTML5, CSS3 e Vanilla JS

## Quando usar
Qualquer mudança em `public/**`.

## Regras obrigatórias
1. **Zero frameworks de UI.** Nada de React, Vue, Angular, Svelte, jQuery, Tailwind CDN. Só `document.createElement`, `<template>`, `addEventListener`, `fetch`.
2. **Módulos ES nativos.** `<script type="module">` e `import { calcular } from "./js/calculo.js"` — o mesmo módulo que o servidor usa.
3. **Cálculo instantâneo.** Evento `input` em cada nota recalcula e redesenha o resumo **sem esperar a rede**. A persistência é um `PUT` com debounce (~600 ms) e indicador "salvando…/salvo".
4. **Segurança no DOM.** Texto vindo do usuário entra via `textContent`/`value`, nunca `innerHTML`.
5. **Tipografia limpa.** Proibido `text-shadow` e `filter: drop-shadow` em texto. Contraste por cor, peso (600–800) e pílulas de fundo sólido.
6. **Responsivo.** Mobile-first, funciona a partir de 360 px sem rolagem horizontal; `prefers-color-scheme` para tema escuro.
7. **Acessível.** `<label>` em todo campo, foco visível, `aria-live="polite"` no resumo da média, contraste AA.
8. **Rastreabilidade.** `<footer>` exibe a Chave Única `P26-2C-6D8F-984C-AF8F-2CA8`.

## Checklist antes de entregar
- [ ] Nenhuma dependência em `package.json` e nenhum `<script src>` externo de framework
- [ ] Digitar uma nota atualiza a média parcial no mesmo frame
- [ ] Layout ok em 375 px e 1280 px
