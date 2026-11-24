---
name: vanilla-ui
description: Interface em HTML5, CSS3 e JavaScript puro, segura contra XSS, responsiva e acessível, com roteamento por hash e renderização de código técnico.
---

# UI com JavaScript puro

## Regras
1. Sem frameworks, sem bibliotecas de UI, sem CDN. Tudo em `public/index.html`, `style.css` e `app.js`.
2. **Nunca** usar `innerHTML` com texto vindo do usuário. Criar nós com `document.createElement` e `textContent`.
3. Um helper `h(tag, props, ...filhos)` mantém o código legível sem virar framework.
4. Roteamento por `location.hash` e evento `hashchange`; cada rota tem uma função que monta a tela.
5. Estado mínimo: usuário atual (`/api/me`), e dados da tela atual. Depois de uma ação, recarregar do servidor.
6. Toda chamada `fetch` usa `credentials: "same-origin"`, `Content-Type: application/json` nos POST e trata `!res.ok` mostrando `error` da API em `role="alert"`.

## Renderização de texto técnico (seguro)
- Dividir o texto por blocos de três crases: partes ímpares viram `<pre><code>`.
- Fora dos blocos, linhas em branco separam `<p>`; crases simples viram `<code>`.
- Tudo via DOM; nada de montar string HTML.

## CSS
- Mobile first, `max-width` de leitura (~72ch), variáveis CSS para cores e espaçamentos.
- `:focus-visible` evidente, contraste AA, estados de botão desabilitado.
- Estado nunca só por cor: selos têm texto ("Aberto", "Resolvido", "Solução Aceita").
- `prefers-color-scheme` e `prefers-reduced-motion` respeitados.

## Rodapé obrigatório
Texto exato em todas as telas: `Chave: P26-2C-DC19-34DD-D6E4-3F3F`.
