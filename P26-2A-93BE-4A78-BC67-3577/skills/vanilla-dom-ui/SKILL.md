---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto. Utilizar contraste de cor, peso tipográfico (`700`/`800`) e pílulas de fundo sólidas.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (`P26-2A-93BE-4A78-BC67-3577`) no elemento `<footer>` da aplicação.
4. **Sem `innerHTML` com dados de usuário:** nomes e mensagens entram com `textContent`/`createElement` para evitar XSS.
5. **O cliente não decide regras:** pré-visualizações de posicionamento são só conveniência; o servidor valida tudo e o cliente exibe o erro que ele devolver.
6. **Acessibilidade:** células do tabuleiro são `<button>` com `aria-label` (ex.: `B3`), mensagens em região `aria-live`, e estado não depende só de cor (símbolos •, ✹, ✖).
7. **Estado do servidor é a fonte da verdade:** após cada ação, recarregar `GET /api/games/:id` e redesenhar; travar os botões enquanto a requisição está em andamento.
