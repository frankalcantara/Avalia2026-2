---
name: vanilla-dom-ui
description: Padrões de construção de interfaces responsivas em HTML5, CSS3 e JavaScript puro (Vanilla JS) sem frameworks externos.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

## Regras Obrigatórias
1. **Zero Frameworks de UI:** Proibido React, Vue, Angular, Svelte ou equivalentes. Toda atualização de estado usa a API nativa do DOM.
2. **Tipografia Limpa:** Nunca aplicar `text-shadow` nem `filter: drop-shadow(...)` em texto. Usar contraste de cor e peso tipográfico (`700`/`800`).
3. **Rastreabilidade no Rodapé:** Exibir a Chave Única `P26-2B-1768-7598-7D8E-716E` no elemento `<footer>`.

## Estrutura
- `public/index.html`: casca da página (cabeçalho, `<main id="app">`, rodapé com a chave).
- `public/styles.css`: estilos com variáveis CSS em `:root`.
- `public/app.js`: toda a lógica, sem módulos externos.

## DOM
- Criar elementos com `document.createElement` e texto com `textContent`. Nunca `innerHTML` com dados da API.
- Trocar de tela com `replaceChildren()`.
- Cada célula do tabuleiro é um `<button>` com `aria-label` ("Linha X, coluna Y").

## Posicionamento
- Estado local: lista de navios `{name, r, c, o}`.
- Pré-visualização ao passar o mouse ou focar: verde se válido, vermelho se inválido.
- A tecla R e o botão alternam horizontal e vertical.
- "Confirmar frota" só habilita com os 5 navios. O cliente valida para dar resposta rápida, mas quem decide é o servidor.

## Combate
- Um `fetch` por clique no mar inimigo, bloqueando novos cliques enquanto a requisição não volta.
- Classes de resultado: `agua`, `acerto`, `afundado`.
- Mostrar o campo `erro` do servidor na tela.

## Responsividade e acessibilidade
- Tabuleiro: `repeat(10, 1fr)` com `aspect-ratio: 1`.
- Dois tabuleiros: `repeat(auto-fit, minmax(280px, 1fr))`.
- `:focus-visible` visível e `prefers-reduced-motion` respeitado.
- Contraste de texto mínimo de 4.5:1.

## Checklist antes de entregar
- [ ] Nenhum framework de interface.
- [ ] Funciona em 360px de largura, sem rolagem horizontal.
- [ ] Rodapé com a Chave Única.
- [ ] Falha de rede não trava o jogo.