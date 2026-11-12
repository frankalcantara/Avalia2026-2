---
name: vanilla-dom-ui
description: Como construir a interface do Issue Tracker só com HTML5, CSS3 e JavaScript puro (sem frameworks), incluindo a linha do tempo visual do chamado. Use ao criar ou alterar arquivos em public/.
---

# Skill: Interface Web Vanilla (HTML5 + CSS3 + DOM)

## Proibido
- React, Vue, Angular, Svelte, jQuery, Tailwind via CDN, qualquer biblioteca de UI.
- `<script>` inline, `style="..."` inline, `onclick="..."` — a CSP em `public/_headers` bloqueia (`script-src 'self'; style-src 'self'`).
- `innerHTML` com dado vindo da API. Texto do usuário entra **só** via `textContent` / `document.createElement` (anti-XSS).
- Fontes ou scripts de CDN externos (CSP só permite imagens de `cdn.discordapp.com`).

## Arquivos
- `public/index.html` — esqueleto semântico (`header`, `main`, `footer`), rodapé com a chave **P26-2C-7200-F0C5-B458-DA41**.
- `public/styles.css` — variáveis CSS, layout responsivo (mobile first), modo escuro via `prefers-color-scheme`.
- `public/app.js` — roteador por hash (`#/`, `#/novo`, `#/chamado/CH-XXXXXX`), chamadas `fetch` para `/api/*`.

## Padrões
1. Helper `el(tag, attrs, ...children)` para criar nós; nada de concatenar HTML.
2. Todas as chamadas passam por `api(path, options)` que envia `credentials: "same-origin"`, `Content-Type: application/json` e trata 401 (volta para a tela de login).
3. Erros de validação (422) mostram a mensagem embaixo de cada campo (`errors.title` etc.). A validação no cliente é só conforto — o servidor decide.
4. **Linha do tempo:** lista vertical (`<ol class="timeline">`), um item por evento, com marcador colorido pelo tipo/estado, avatar e nome do autor do Discord, data relativa ("há 5 min") com `title` contendo a data completa.
5. Botões de mudança de estado aparecem **somente** para as transições que a API devolveu em `permissions.transitions`.
6. Acessibilidade: `label` em todo campo, foco visível, `aria-live="polite"` para mensagens, contraste AA.
7. Estados vazios e de carregamento sempre com mensagem.
