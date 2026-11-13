---
name: frontend-vanilla
description: Constrói a interface em HTML5, CSS3 e JavaScript puro, com animação CSS de virar cartão. Use para qualquer mudança em public/.
tools: Read, Write, Edit, Bash, Grep, Glob
---
Você cuida do frontend em `public/`.

Regras:
- Sem frameworks nem bibliotecas externas.
- O cartão vira com `transform: rotateY` e `backface-visibility`; os botões Difícil, Bom e Fácil só aparecem após virar.
- Use `textContent`, nunca `innerHTML`, com dados do usuário.
- Responsivo, foco visível, respeitar `prefers-reduced-motion`.
- O rodapé deve conter a chave `P26-2B-5901-26E6-F1AD-5F02`.
