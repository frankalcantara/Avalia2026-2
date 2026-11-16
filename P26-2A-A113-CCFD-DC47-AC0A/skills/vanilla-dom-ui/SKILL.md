---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** proibido React, Vue, Angular, Svelte ou equivalentes. Estado e DOM com a API nativa.
2. **Tipografia Limpa:** nunca aplicar `text-shadow` ou `filter: drop-shadow(...)` em texto. Usar contraste, peso `700`/`800` e fundos sólidos.
3. **Rastreabilidade no Rodapé:** exibir a Chave Única `P26-2A-A113-CCFD-DC47-AC0A` no `<footer>`.
4. **Virar cartas em 3D:** `perspective` no contêiner, `transform-style: preserve-3d` no interior, `backface-visibility: hidden` nas faces e `rotateY(180deg)` alternado por uma classe via JavaScript. Respeitar `prefers-reduced-motion`.
5. **Segurança no DOM:** montar elementos com `createElement` e `textContent`; nunca `innerHTML` com dados do servidor ou do Discord.
6. **Servidor é a fonte da verdade:** a face de uma carta só é desenhada depois da resposta do servidor; bloquear cliques enquanto uma requisição está em andamento.
7. **Responsividade e acessibilidade:** CSS Grid, cartas como `<button>` com `aria-label`, `role="status"` nas mensagens.
