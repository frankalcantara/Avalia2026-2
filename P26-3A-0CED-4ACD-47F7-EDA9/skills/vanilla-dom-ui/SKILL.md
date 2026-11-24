---
name: vanilla-dom-ui
description: Protocolo do Agente de Interface para construir a interface do Cypher em HTML5, CSS3 e JavaScript puro, com manipulação direta do DOM, identidade visual "Cofre", animações CSS, acessibilidade e responsividade.
---

# Skill: Interface Web Vanilla (HTML5 + CSS3 + DOM)

## Quando usar
Ao criar ou alterar qualquer arquivo em `public/`.

## Restrições da disciplina
- Proibido React, Vue, Angular, Svelte, Solid, jQuery, Tailwind, Bootstrap ou qualquer framework/biblioteca de UI. Nada de CDN de framework.
- JavaScript em ES modules nativos (`<script type="module">`), sem etapa de build.
- Grade de letras e teclado virtual criados com `document.createElement` / `append` (manipulação direta do DOM).
- A chave `P26-3A-0CED-4ACD-47F7-EDA9` aparece em um `<footer>` visível em todas as telas.

## Identidade visual "Cofre"
- Divertida e chamativa, mas leve: cor forte só nas peças do jogo e nos momentos de vitória; o resto da tela é calmo e plano.
- Letras em fonte monoespaçada; peças com cantos arredondados, como teclas de um painel de cofre.
- Paleta própria (não o verde/amarelo do Termo): **menta** para letra certa, **coral** para letra no lugar errado, **grafite** para ausente; um acento de marca para botões principais.
- Temas claro e escuro (`prefers-color-scheme` + alternância manual salva em `localStorage`) e **modo daltônico** (cores de alto contraste + ícone/marcação na peça, para não depender só da cor).
- Animações curtas (≤ 300 ms por peça): giro de "disco de cofre" ao revelar, tremida ao recusar a palavra, "destravar" do tabuleiro ao vencer. Respeitar `prefers-reduced-motion`.
- Sem sombras pesadas, brilho neon ou gradientes chamativos.

## Experiência
- Tela de entrada (antes do login) que vende o jogo: nome, frase curta, tabuleiro de demonstração se resolvendo sozinho (palavra `COFRE`, apenas no cliente) e botão "Entrar com Discord".
- Feedback sempre vem da API; o cliente nunca calcula cores nem conhece a resposta.
- Teclado físico e virtual; teclas do teclado virtual coloridas com o melhor estado já revelado.
- Mensagens de erro da API viram avisos amigáveis (toast) em pt-BR.
- Responsivo de 320 px a desktop; alvo de toque ≥ 44 px; foco visível; `aria-live` para anunciar resultados; navegação por teclado.

## Checklist antes de entregar
- [ ] Nenhum framework ou CDN de UI.
- [ ] Rodapé com a chave em todas as telas.
- [ ] Funciona em 360 px de largura sem rolagem horizontal.
- [ ] Modo escuro, claro e daltônico conferidos.
- [ ] Todas as chamadas `fetch` tratam `401` (volta para a tela de entrada) e erros de rede.
