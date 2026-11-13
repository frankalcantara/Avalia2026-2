---
name: frontend-vanilla
description: Regras de interface em HTML5, CSS3 e JavaScript puro para o projeto de flashcards: virar cartão com CSS, acessibilidade e segurança do DOM.
---
Regras aplicadas pelo agente `frontend-vanilla` na revisão de `public/`:

- Sem frameworks nem bibliotecas externas; DOM criado com JavaScript puro.
- Dados do usuário (nome do baralho, frente, verso, mensagens de erro) sempre com `textContent`, nunca `innerHTML`.
- O cartão vira com `transform: rotateY` e `backface-visibility`; os botões Difícil, Bom e Fácil só aparecem depois de virar.
- Elementos escondidos com o atributo `hidden` precisam de `[hidden]{display:none !important}` no CSS, porque regras de `display` do autor vencem o padrão do navegador.
- Todo clique que chama a API deve tratar falha com `try/catch` e mostrar o erro na tela.
- Cartão virável por teclado (Enter e Espaço), com `role` e `aria-label`; foco visível; respeitar `prefers-reduced-motion`.
- O rodapé deve conter a chave `P26-2B-5901-26E6-F1AD-5F02`.
