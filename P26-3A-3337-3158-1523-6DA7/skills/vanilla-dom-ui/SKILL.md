---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto. Utilizar contraste de cor, peso tipográfico (`700`/`800`) e pílulas de fundo sólidas.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (`P26-3A-3337-3158-1523-6DA7`) no elemento `<footer>` da aplicação.
4. **DOM seguro:** montar elementos com `createElement`/`textContent`; nunca inserir dados do servidor via `innerHTML`.
5. **Barras de progresso acessíveis:** `role="progressbar"` com `aria-valuenow`/`aria-valuemax`, mostrando horas validadas, o teto e quanto falta.
6. **Responsividade e foco:** layout fluido com `@media (max-width: 600px)`, estados `:focus-visible` e respeito a `prefers-reduced-motion`.
