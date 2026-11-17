---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto. Utilizar contraste de cor, peso tipográfico (`700`/`800`) e pílulas de fundo sólidas.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (`P26-2C-57E3-D257-CF08-28F5`) no elemento `<footer>` da aplicação.

## Especificações do Projeto #37 (Almoxarifado de Hardware)
- **Arquivos (`public/`):** Criar `index.html`, `style.css` e `app.js` usando exclusivamente HTML5, CSS3 e JavaScript puro (zero frameworks ou bibliotecas de UI).
- **Funcionalidades:** Tela de login com Discord OAuth2, painel para consultar saldo de componentes (ESP32, Arduino, sensores, ferramentas), formulário de retirada/devolução e aba "Estoque Crítico" destacando visualmente itens que atingiram o limite mínimo.
- **Auditoria Visual:** Exibir obrigatoriamente a chave `P26-2C-57E3-D257-CF08-28F5` no rodapé (`<footer>`) da interface.