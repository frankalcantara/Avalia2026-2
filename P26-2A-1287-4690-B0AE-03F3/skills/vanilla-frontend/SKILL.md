---
name: vanilla-frontend
description: Diretrizes para a interface HTML5/CSS3/Vanilla JS do Kudos Board, sem frameworks. Use ao criar ou alterar arquivos em public/.
---

# Frontend Vanilla

## Regras
- Apenas HTML5, CSS3 e JavaScript puro. Sem React/Vue/jQuery/Tailwind/Bootstrap nem build step.
- Renderizar dados do usuário com `textContent`/`createElement`; NUNCA `innerHTML` com conteúdo dinâmico (previne XSS).
- Layout em grade: CSS Grid ou colunas CSS (masonry); responsivo com `@media`/`auto-fill, minmax`.
- Acessibilidade: `lang="pt-BR"`, labels nos campos, foco visível, contraste suficiente, `aria-live` para mensagens de status.
- `fetch` com `credentials: 'same-origin'`; tratar 401 mostrando o botão de login.
- Rodapé obrigatório com a Chave Única `P26-2A-1287-4690-B0AE-03F3`.
- Estado simples em variáveis de módulo; funções pequenas e nomeadas.
- Contador de caracteres (280) no formulário; o servidor revalida.
