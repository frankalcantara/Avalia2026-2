---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Estilo Simples e Acessível:** Prefira cores, espaçamentos e botões simples, com boa leitura em celular e foco visível para teclado. Nunca aplique `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (`P26-2B-2D59-187A-E25C-2BE9`) no elemento `<footer>` da aplicação.
4. **Login e Cadastro:** Ofereça as opções de login por Discord e por e-mail/senha, com mensagens de erro claras e sem bloquear um método por falta de configuração do outro.
5. **Estoque:** Permita filtrar itens críticos e cadastrar itens autenticados com código numérico gerado pelo servidor e agente responsável; construa a interface com elementos DOM e `textContent`, nunca HTML injetado.
