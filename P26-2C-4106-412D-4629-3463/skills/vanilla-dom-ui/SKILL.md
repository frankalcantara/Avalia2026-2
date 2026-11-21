---
name: vanilla-dom-ui
description: Boas práticas para interface em HTML5/CSS3/JavaScript puro sem frameworks, com DOM seguro, responsividade e acessibilidade. Use ao mexer em public/.
---

# Interface com JavaScript puro

## Regras
- Sem frameworks ou bibliotecas de interface. Sem scripts ou estilos de CDN (a CSP só permite `'self'`).
- Monte elementos com `document.createElement` (ver helper `h()` em `public/app.js`).
- Texto vindo do servidor: `textContent` ou `createTextNode`; nunca `innerHTML`.
- Links externos: `rel="noopener noreferrer"`; aceitar apenas `http(s)` (o servidor já valida).
- Toda chamada à API passa por `api()`, que trata 401 voltando à tela de login e mostra o erro do servidor.

## Qualidade mínima
- Responsivo: grade de duas colunas acima de 760px, uma coluna abaixo.
- Cada campo com `<label>`; foco visível; `aria-live` na área de status; `aria-pressed` em botões de alternância.
- Respeitar `prefers-reduced-motion`.
- Estados vazios explicam o próximo passo; erros dizem o que fazer.
- O rodapé mantém a chave `P26-2C-4106-412D-4629-3463`.
