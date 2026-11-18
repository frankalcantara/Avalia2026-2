# Desenvolvimento por agentes

Três agentes distintos trabalharam no Projeto 41. O harness foi o Codex multiagente no ChatGPT Work Mode, com um diretório Git compartilhado. O coordenador definiu o contrato JSON, atribuiu áreas de escrita distintas e integrou o trabalho no fork. Os arquivos em `skills/` registram as diretrizes aplicadas a cada função.

## Agente de backend — acervo_api

Aplicou `skills/serverless-d1-discord/SKILL.md`. Implementou os handlers das Pages Functions, a autenticação baseada no código do Projeto 0 e a migração do D1. As consultas filtram registros pelo usuário da sessão ou pela visibilidade pública. Conferiu gravações com sessão assinada e SQLite em memória.

## Agente de interface — acervo_ui

Aplicou `skills/vanilla-dom-ui/SKILL.md`. Construiu o Entrelinhas em HTML, CSS e JavaScript, incluindo formulário, busca por autor ou tema, sorteio e navegação por teclado. Alinhou os limites dos campos com o backend e corrigiu o aviso de falha de autenticação apontado na revisão.

## Agente de teste e validação — acervo_qa

Aplicou `skills/teste-validacao/SKILL.md`. Criou testes com duas identidades, executou a migração em SQLite e verificou respostas dos handlers para visitantes e leitores autenticados. Revisou os estados de erro da interface, os identificadores HTML, as referências acessíveis e a chave do rodapé. O navegador local teve a inicialização bloqueada pelo ambiente. Após a publicação, Bruno validou o login com a própria conta Discord e o cadastro de uma citação pública. O coordenador conferiu a ficha em uma sessão de visitante, a busca por autor e tema e o sorteio com a nota de leitura.
