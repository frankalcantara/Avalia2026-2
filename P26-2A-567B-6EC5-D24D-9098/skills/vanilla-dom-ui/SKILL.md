Skill: Interface Web em HTML5, CSS3 e JavaScript Puro (Vanilla JS)

Regras Obrigatórias

1. Zero Frameworks de UI: Proibido o uso de React, Vue, Angular, Svelte ou bibliotecas equivalentes. Toda atualização de estado deve usar a API nativa do DOM.
2. Tipografia Limpa: Nunca aplicar text-shadow ou filter: drop-shadow(...) em elementos de texto. Utilizar contraste de cor, peso tipográfico (700/800) e pílulas de fundo sólidas.
3. Rastreabilidade no Rodapé: Exibir obrigatoriamente a Chave Única (P26-2A-567B-6EC5-D24D-9098) no elemento <footer> da aplicação.

DOM seguro (Bookmark Manager)

1. Sem CDN de UI. Apenas HTML5, CSS3 e JavaScript puro, com módulos ES (type="module").
2. Dados do usuário (título, resumo, nome da coleção, username) entram com document.createElement + textContent, nunca com innerHTML.
3. Toda chamada à API usa fetch com credentials: 'same-origin' e mostra a mensagem de erro do servidor.
4. Mostrar estados de carregando, lista vazia e erro. Pedir confirmação antes de excluir.
5. HTML semântico (header, main, nav, section, footer), label em todos os campos, required e type="url" onde couber, foco visível, contraste adequado.
6. CSS mobile-first com media queries; testar em 360px, 768px e 1280px.
7. A chave aparece dentro de <footer> em todas as páginas (index.html e colecao.html).
8. Validação no cliente é só conveniência; a validação real é do servidor.

Exemplo curto

Certo: const t = document.createElement('h3'); t.textContent = link.title; Errado: card.innerHTML = '<h3>' + link.title + '</h3>';