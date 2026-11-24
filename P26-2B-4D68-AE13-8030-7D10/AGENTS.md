# Agentes de Engenharia — P26-2B-4D68-AE13-8030-7D10

## Harness

- **Harness do projeto:** GitHub Copilot no VS Code, usando agentes personalizados `.agent.md` reconhecidos pelo Copilot.
- **Modelos:** definidos pelo modelo selecionado/configurado no runtime do Copilot; os arquivos deste projeto não fixam nem presumem um modelo específico.
- **Escopo:** agentes e alterações deste projeto devem operar somente dentro desta subpasta.
- **Coordenação:** para tarefas que envolvam mais de uma área, o coordenador divide o trabalho entre especialistas e preserva os contratos JSON das Pages Functions e o esquema D1. A validação oficial, quando disponível, é `node validar-local.mjs P26-2B-4D68-AE13-8030-7D10`, executada na raiz do repositório.

## Agentes personalizados

Os agentes aparecem no seletor de agentes do Copilot no VS Code e também podem ser usados como subagentes conforme o runtime permitir.

### Agente 1: Arquiteto Serverless D1 e Discord

Pages Functions, Cloudflare D1, OAuth2 Discord e autorização no servidor. Definição: [serverless-d1-discord.agent.md](./.github/agents/serverless-d1-discord.agent.md). Skill: [serverless-d1-discord](./skills/serverless-d1-discord/SKILL.md).

### Agente 2: Especialista UI Vanilla

HTML, CSS, acessibilidade e JavaScript nativo da interface. Definição: [vanilla-dom-ui.agent.md](./.github/agents/vanilla-dom-ui.agent.md). Skill: [vanilla-dom-ui](./skills/vanilla-dom-ui/SKILL.md).

### Agente 3: Teste e Validação (obrigatório)

Validação funcional independente, contratos, requisitos da entrega e execução de testes; não modifica arquivos. Definição: [teste-validacao.agent.md](./.github/agents/teste-validacao.agent.md). Skill: [teste-validacao](./skills/teste-validacao/SKILL.md).

### Agente 4: Coordenador do Projeto (opcional)

Coordena tarefas multidisciplinares e delega aos três especialistas acima. Definição: [coordenador-projeto.agent.md](./.github/agents/coordenador-projeto.agent.md).

Esses arquivos configuram as responsabilidades e os fluxos dos agentes; não afirmam que eles já executaram tarefas ou produziram entregas. Registre resultados de execução somente depois de efetivamente realizar e verificar o trabalho.
