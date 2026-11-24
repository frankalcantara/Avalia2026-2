---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto. Utilizar contraste de cor, peso tipográfico (`700`/`800`) e pílulas de fundo sólidas.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (`P26-3A-8F79-F6CA-8535-422A`) no elemento `<footer>` da aplicação.

## Regras do Projeto #15 (Shared To-Do)
4. **Sincronização:** cada ação do usuário chama a API e redesenha a partir da resposta do servidor (o servidor é a fonte da verdade); atualização periódica leve para ver mudanças dos colegas.
5. **Avatares:** mostrar o avatar do Discord do responsável em cada tarefa, com `alt` descritivo.
6. **Segurança no DOM:** inserir texto do usuário com `textContent`, nunca `innerHTML`.
7. **Responsivo e acessível:** layout que funciona em celular, controles com `<label>`, foco visível.
