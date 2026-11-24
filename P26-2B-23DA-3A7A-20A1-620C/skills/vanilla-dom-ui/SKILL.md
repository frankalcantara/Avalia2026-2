---
name: vanilla-dom-ui
description: Padrões para interfaces responsivas em HTML5, CSS3 e JavaScript puro, com animação 3D por CSS acionada via JS e renderização segura do DOM.
---

# Skill: Interface Web em HTML5, CSS3 e JavaScript Puro

## Regras obrigatórias
1. **Zero frameworks e bibliotecas externas:** proibido React, Vue, Angular, Svelte e CDNs de terceiros. Estado e DOM com a API nativa.
2. **Virar a carta com CSS 3D acionado por JS:** `perspective` no contêiner, `transform-style: preserve-3d` no interior, `backface-visibility: hidden` nas faces, e o JavaScript apenas alterna a classe `flipped` (`rotateY(180deg)`).
3. **Renderização segura:** texto vindo do servidor entra com `textContent`. Proibido `innerHTML` com dados externos.
4. **Servidor é a fonte da verdade:** o frontend não calcula acerto, movimentos nem eficiência. Ele exibe o que a API devolve. O cronômetro na tela é só visual.
5. **Bloquear cliques concorrentes:** durante uma requisição (`reveal`/`check`) novos cliques são ignorados.
6. **Retomada:** ao carregar a página, consultar `/api/me` e `/api/game/state` e reconstruir o tabuleiro.
7. **Cabeçalho do usuário:** exibir avatar e nome vindos de `/api/me`; só aceitar URL de avatar do domínio `cdn.discordapp.com`.
8. **Responsividade e acessibilidade:** grade com 4, 3 e 2 colunas por `@media`; cartas são `<button>` com `aria-label`; mensagens em região `aria-live`; respeitar `prefers-reduced-motion`.
9. **Tipografia limpa:** sem `text-shadow` nem `drop-shadow` em texto. Usar contraste, peso (`700`/`800`) e fundos sólidos.
10. **Rastreabilidade:** a Chave Única `P26-2B-23DA-3A7A-20A1-620C` aparece no `<footer>`.