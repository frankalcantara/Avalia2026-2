---
name: vanilla-dom-ui
description: Construir interfaces web com HTML5, CSS3 e JavaScript puro (sem frameworks de UI), com manipulação direta do DOM, acessibilidade, responsividade e barras de progresso em CSS. Use ao criar ou alterar qualquer arquivo em public/.
---

# Skill: UI em Vanilla JS

## Quando usar
Qualquer mudança em `public/index.html`, `public/styles.css`, `public/app.js`.

## Proibido
React, Vue, Svelte, jQuery, Tailwind via CDN, bibliotecas de componentes. Apenas HTML, CSS e JS do navegador. Sem scripts ou estilos inline (a CSP em `public/_headers` bloqueia).

## DOM
- Crie nós com `document.createElement` (helper `el(tag, attrs, ...children)`); texto do usuário **sempre** via `textContent` — nunca `innerHTML` com dados do servidor (XSS).
- Estado em um objeto único (`state`); funções separadas: `buildGrid()` (reconstrói a tabela só quando mês/hábitos mudam) e `updateStats()` (atualiza barras e indicadores sem reconstruir, preservando o foco do teclado).
- Valores dinâmicos de estilo via CSSOM (`el.style.width = '42%'`, `el.style.setProperty('--habit-color', c)`), que a CSP permite.

## Atualização otimista com servidor como fonte da verdade
1. Ao marcar um checkbox, atualize o estado local e as barras **imediatamente**.
2. Envie `PUT` ao servidor numa fila (uma requisição por vez) para evitar respostas fora de ordem.
3. Quando a última resposta chegar, substitua o estado pelo retorno do servidor (streaks e taxa oficiais) e sincronize os checkboxes.
4. Em erro, mostre toast e recarregue o painel do servidor.
5. Em `401`, volte à tela de login.

## Barras de progresso em CSS
`<div class="progress" role="progressbar" aria-valuenow="…"><div class="progress-fill"></div></div>`; o preenchimento usa `width` com `transition`. Mantenha `aria-valuenow` em sincronia.

## Acessibilidade e responsividade
- Todo controle tem rótulo (`aria-label` descritivo, ex.: "Meditar — dia 05/11"); `:focus-visible` visível; contraste ≥ 4.5:1.
- Tabela semântica (`th scope="col|row"`); primeira coluna fixa (`position: sticky`) e rolagem horizontal no contêiner.
- Layout fluido com `grid`/`flex`; ponto de quebra em 720px; alvo de toque ≥ 24px; respeite `prefers-reduced-motion`.

## Requisitos do projeto
- Rodapé com a chave única `P26-2C-7195-ACC2-3B49-1AE1` em todas as telas.
- Login obrigatório via Discord (link para `/api/auth/discord`); mostrar nome e avatar do usuário.
- Indicadores numéricos: sequência atual, maior sequência e cumprimento mensal.

## Checklist antes de entregar
- [ ] Sem `innerHTML` com dados dinâmicos.
- [ ] Funciona em 360px de largura (sem rolagem horizontal da página).
- [ ] Navegação completa por teclado.
- [ ] Nenhum framework ou script externo.
