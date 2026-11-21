---
name: vanilla-dom-ui
description: Use ao criar ou alterar qualquer arquivo em public/ do Catálogo de Filmes (P26-2A-52D1-7EC2-3200-758A). Define como construir a interface só com HTML5, CSS3 e JavaScript puro, com segurança e responsividade.
---

# Skill: Interface Web Vanilla (HTML5, CSS3 e DOM)

## Regras obrigatórias

1. **Zero frameworks.** Proibido React, Vue, Angular, Svelte, jQuery ou qualquer biblioteca de UI, inclusive via CDN.
   Sem `package.json` com dependências de front-end. Só a API nativa do DOM.
2. **Nada de `innerHTML` com dados.** Todo conteúdo vindo da API (nomes, resenhas, nomes do Discord) entra por
   `textContent` / `createTextNode`. Usar o helper `el(tag, atributos, ...filhos)` de `app.js`, que achata listas
   aninhadas com `flat(Infinity)`.
3. **A API é a fonte da verdade.** Média, total, ordenação e "minha nota" vêm do servidor. Depois de gravar, recarregar
   a galeria e os detalhes em vez de recalcular no navegador.
4. **HTML semântico e acessível.** `<header>`, `<main>`, `<footer>`, `<dialog>` nativo para janelas, `aria-live` na área
   de usuário, `role="tablist"` nas abas de ordenação, `aria-label` nos cartões e no seletor de estrelas, foco visível.
5. **Seletor de estrelas só com CSS.** Rádios + `label` em ordem 5→1 com `flex-direction: row-reverse` e o seletor
   irmão `~` para acender as estrelas anteriores no `:hover` e no `:checked`.
6. **Responsivo.** Grid `auto-fill` com `minmax()`; abaixo de 640px, filtros em duas colunas e cartões menores.
   Testar em 1280px e em 390px de largura.
7. **Tipografia limpa.** Sem `text-shadow` em textos; contraste por cor e peso (700/800).
8. **Rodapé com a chave.** `<footer>` sempre com `P26-2A-52D1-7EC2-3200-758A`.
9. **Erros visíveis.** Mensagens da API (`dados.erro`) aparecem perto do formulário (`role="alert"`) ou no aviso do topo.
   Um 401 recarrega o estado do usuário.

## Telas
- **Topo:** marca + botão "Entrar com Discord" ou avatar, nome e "Sair".
- **Galeria:** abas ⭐ Melhor nota / 🔥 Mais avaliados / 🆕 Lançamentos recentes, filtro de tipo, busca e "+ Cadastrar título".
  Cada cartão mostra tipo, ano, gênero, estrelas, média, total e "Sua nota".
- **Detalhes (dialog):** média grande, barras de distribuição 5→1, formulário de avaliação (criar/editar/remover), resenhas.
- **Cadastro (dialog):** nome, tipo, ano, gênero; um 409 abre o título que já existe.
