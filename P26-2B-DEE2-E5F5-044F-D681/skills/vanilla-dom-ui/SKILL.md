---
name: vanilla-dom-ui
description: Padrões para construir a interface em HTML5, CSS3 e JavaScript puro (sem frameworks), consumindo a API das Pages Functions. Usar ao criar/alterar arquivos em public/.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro

Usada pelo **Agente 2 (Interface Vanilla)** do projeto #34 — Vitrine de Achados e Perdidos do Campus (`P26-2B-DEE2-E5F5-044F-D681`).

## Regras obrigatórias
1. **Zero frameworks e zero CDNs de UI.** Nada de React, Vue, Angular, Svelte, jQuery, Bootstrap, Tailwind. Só `public/index.html`, `public/styles.css`, `public/app.js`.
2. **DOM direto e seguro.** Criar elementos com `document.createElement` e preencher com `textContent`. **Nunca** pôr texto vindo da API em `innerHTML` (evita XSS — títulos e descrições são digitados por usuários).
3. **HTML semântico e acessível:** `header`, `main`, `section`, `footer`, `<button>` para ações, `<label for>` em todo campo, `<dialog>` para modais, `aria-live` para mensagens, foco visível, contraste AA.
4. **Responsivo mobile-first** com CSS Grid/Flexbox e media queries; usável a partir de 360 px.
5. **Tipografia limpa:** sem `text-shadow` nem `drop-shadow` em texto.
6. **Rodapé obrigatório** com a chave `P26-2B-DEE2-E5F5-044F-D681` dentro de `<footer>` no HTML estático.
7. **A interface valida para ajudar, o servidor valida para valer.** Sempre exibir `message`/`details` de erro devolvidos pela API.

## Padrões
- `fetch` com `credentials: "same-origin"` e `Content-Type: application/json` nas escritas.
- Estado em um objeto `estado` + função `render()`; nada de estado espalhado no DOM.
- **Filtros cruzados rápidos:** carregar `/api/items` uma vez e filtrar no cliente (tipo × categoria × status × busca), mostrando a contagem de cada opção já considerando os outros filtros ativos; atualizar a cada tecla sem novo request.
- Exibir avatar e nome do Discord do usuário logado no cabeçalho.
