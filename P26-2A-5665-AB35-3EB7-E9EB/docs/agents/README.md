# Harness e agentes

## Harness

Os três agentes especializados foram executados em tarefas independentes pelo harness multiagente do Codex. O agente principal coordenou o trabalho e integrou o código. Os agentes de revisão receberam escopo explícito, acesso ao mesmo repositório e instruções para não editar arquivos nem publicar. A validação final foi dividida entre a verificação de produção feita pelo agente principal e a revisão independente do agente de testes.

## Agentes especializados

| Agente | Objetivo | Skill usada | Resultado |
| --- | --- | --- | --- |
| Backend e D1 | Revisar API, persistência e validação server-side | `skills/backend/SKILL.md` | Identificou erros de JSON, validação de `done` e exposição de detalhes internos; correções integradas pelo agente principal. |
| Interface e acessibilidade | Revisar fluxos, responsividade e acessibilidade | `skills/frontend/SKILL.md` | Recomendou estados vazios distintos, `aria-pressed` e indicador de conexão real; melhorias integradas. |
| Teste e validação | Conferir implantação, endpoints, D1 e lacunas da rubrica | `skills/testing/SKILL.md` | Confirmou página/API online e listou requisitos ainda pendentes. Revisão independente sem alteração de produção. |

## Agente principal

O agente principal transformou a rubrica visível em plano, implementou a versão inicial, aplicou as recomendações e registrou as verificações locais/remotas. O produto atual ainda é provisório até receber o título e as instruções completas do projeto sorteado, que estavam ocultos na tela até a confirmação do e-mail.
