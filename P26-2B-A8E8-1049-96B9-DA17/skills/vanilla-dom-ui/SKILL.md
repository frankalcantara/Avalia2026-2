---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar `text-shadow` ou `filter: drop-shadow(...)` em elementos de texto. Utilizar contraste de cor, peso tipográfico (`700`/`800`) e pílulas de fundo sólidas.
3. **Rastreabilidade no Rodapé:** Exibir obrigatoriamente a Chave Única (`P26-2B-A8E8-1049-96B9-DA17`) no elemento `<footer>` da aplicação.

## Padrões aplicados no Acervo (verificados em 2026-11-08)
Revisão do agente de interface contra as 3 regras, e como cada uma foi atendida:

**Regra 1 (sem frameworks):** CUMPRE. Só `app.js` e `theme.js` (sem CDN de JS, sem `import`); elementos criados com `document.createElement` por um helper `h()`; estado em objeto simples; cada tela é uma `<section>` alternada pelo atributo `hidden`. Os únicos recursos externos são o CSS do Google Fonts e os avatares do `cdn.discordapp.com`.

**Regra 2 (tipografia):** PARCIAL, com desvio declarado.
- Sem `text-shadow` nem `drop-shadow`: 0 ocorrências no CSS e 0 elementos com sombra de texto no DOM (390 e 1440 px). As sombras existentes são `box-shadow` de caixas.
- Hierarquia por contraste de cor, tamanho e pílulas/marcador de fundo sólido (`--marker`, botões com `--accent`).
- Desvio: o peso `700`/`800` não é usado; o design usa Literata 400 nos títulos e Hanken Grotesk 400 a 600 no texto (o Google Fonts pede só esses pesos), seguindo o `DESIGN.md`.

**Regra 3 (rodapé):** `<footer>` com a chave em `index.html` e também em `404.html`.

**Outros padrões verificados:**
- Nenhum `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write` ou `eval`: todo texto do usuário entra por `textContent`/`createTextNode`.
- CSP estrita sem inline (`public/_headers`: `script-src 'self'`, `frame-ancestors 'none'`, etc.); sem `<style>`, `style=` ou `onclick=` nos HTML.
- Tokens de cor em CSS (`:root`), tema claro e escuro por `prefers-color-scheme` e por escolha manual (`data-theme`, `localStorage` em `try/catch`), aplicado por `theme.js` antes da pintura.
- Rotas por hash (`#/feed`, `#/minhas`, `#/nova`, `#/editar/:id`), com guarda de rota e foco movido para o `h1` a cada navegação.
- Busca no cliente por autor, tema ou tudo, ignorando acentos e caixa, com atraso (debounce) de 150 ms.
- Acessibilidade: `lang="pt-BR"`, link "Pular para o conteúdo", `aria-live` em avisos, `aria-invalid`/`aria-describedby` nos campos, alvos de toque de pelo menos 44 px, `prefers-reduced-motion`.
- Responsividade medida: sem rolagem horizontal em 320, 390 e 1440 px.
