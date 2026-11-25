# Engenharia de Agentes e Harness

## Ambiente

- **Harness:** não informado; preencher quando confirmado.
- **Modelos:** não informados; preencher quando confirmados.
- **Perfis Copilot:** definidos em `.github/agents/` na raiz do repositório.
- **Skills Copilot:** disponíveis em `.github/skills/`. As cópias em `skills/` nesta pasta são mantidas para a estrutura de entrega exigida.

Não afirmar que um agente executou uma tarefa ou que um teste passou sem registrar evidência correspondente.

## Agentes e limites

### Agente: Arquiteto Serverless

- **Responsabilidade:** contrato de API, arquitetura Pages Functions, D1, OAuth e validação/autorização no servidor.
- **Perfil:** `.github/agents/serverless-architect.agent.md`
- **Skill:** `.github/skills/serverless-d1-discord/SKILL.md`
- **Não é responsável por:** implementar a interface ou certificar o próprio trabalho como QA independente.

### Agente: Desenvolvedor Frontend Vanilla

- **Responsabilidade:** HTML, CSS e JavaScript da interface, consumindo o contrato de API acordado.
- **Perfil:** `.github/agents/frontend-vanilla.agent.md`
- **Skill:** `.github/skills/vanilla-dom-ui/SKILL.md`
- **Não é responsável por:** autenticar/autorização de forma definitiva no cliente, alterar o contrato sem acordo ou modificar o backend.

### Agente: Teste e Validação

- **Responsabilidade:** verificar de forma independente a aplicação e registrar evidências, resultados e falhas.
- **Perfil:** `.github/agents/test-validator.agent.md`
- **Skill:** `.github/skills/teste-validacao/SKILL.md`
- **Não é responsável por:** implementar funcionalidades ou corrigir o código sob teste.

## Comunicação e handoff

O fluxo e os critérios de passagem estão em [`docs/agent-handoff.md`](./docs/agent-handoff.md). O contrato compartilhado está em [`docs/api-contract.md`](./docs/api-contract.md). A ordem padrão é:

1. Serverless publica ou propõe o contrato.
2. Frontend implementa contra o contrato acordado e registra incompatibilidades.
3. QA valida ambos de forma independente e entrega um relatório.
4. Correções retornam ao agente responsável; QA revalida.

Alterações de contrato devem ser registradas e comunicadas antes de integrações dependentes. Os agentes não devem assumir configurações externas, credenciais, IDs, harness ou modelos que não tenham sido confirmados.
