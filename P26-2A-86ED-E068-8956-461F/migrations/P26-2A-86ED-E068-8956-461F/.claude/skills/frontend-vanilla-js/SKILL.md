---
name: frontend-vanilla-js
description: Boas práticas de interface com HTML5, CSS3 e JavaScript puro (sem frameworks): DOM seguro, acessibilidade, responsividade e estados de carregamento/erro.
---

# Front-end Vanilla

## Regras
1. Sem frameworks ou bibliotecas de UI. Apenas HTML, CSS e JS do navegador.
2. Montar o DOM com `createElement` e `textContent`. Nunca `innerHTML` com dados vindos do servidor ou do usuário (evita XSS).
3. Um único wrapper `api()` para `fetch`, que trata 401 (volta ao login) e exibe a mensagem de erro do servidor.
4. Todo estado tem tela: carregando, vazio (com ação sugerida), erro (dizendo o que fazer).
5. Acessibilidade: `label` em todo campo, foco visível, link de pular para o conteúdo, `aria-live` para avisos, `prefers-reduced-motion` respeitado.
6. Responsividade: layout fluido com grid/flex, ponto de quebra para celular em 640px.
7. Botões dizem exatamente o que fazem ("Reservar vaga", "Cancelar reserva") e mantêm o mesmo nome em toda a interface.
8. Exibir a Chave Única no rodapé.
