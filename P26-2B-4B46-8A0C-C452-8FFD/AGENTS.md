# Engenharia de agentes — Termo Diário

O projeto foi desenvolvido no Codex Work Mode, no harness de colaboração do Codex. O agente coordenador delegou três tarefas a agentes Codex, cada qual com responsabilidade e arquivos próprios, e integrou as mudanças na mesma cópia do fork. Os agentes trabalharam com um contrato JSON compartilhado para o estado da partida.

### Agente 1 — Backend, Discord OAuth2 e D1

Responsável pelo fluxo de autenticação, persistência, seleção da palavra do dia e avaliação dos palpites. Usou a skill [serverless-d1-discord](skills/serverless-d1-discord/SKILL.md).

### Agente 2 — Interface Vanilla

Responsável por renderizar a grade e o teclado com o DOM, apresentar o perfil Discord, animar as avaliações das letras e mostrar as estatísticas. Usou a skill [vanilla-dom-ui](skills/vanilla-dom-ui/SKILL.md).

### Agente 3 — Teste e validação

Responsável pela verificação independente dos contratos do jogo e da estrutura exigida pela rubrica. Usou a skill [teste-validacao](skills/teste-validacao/SKILL.md).

A suíte `tests/termo.test.mjs` chama as funções do servidor com a migração real em SQLite e respostas simuladas do Discord. Ela cobre autenticação, saída, letras repetidas, rejeição de palpites inválidos, persistência das tentativas, limite diário, isolamento entre contas e estatísticas históricas. A execução com `node --test tests/termo.test.mjs` aprovou os seis casos.

O agente também executou `public/app.js` com DOM e API simulados. Verificou a entrada com Discord, a montagem da grade e do teclado, o envio de uma palavra, as três marcações de letras, a exibição das estatísticas, a restauração da tentativa após recarga e a saída da conta. A inspeção visual no navegador e os testes com Discord e D1 reais ficaram pendentes.
