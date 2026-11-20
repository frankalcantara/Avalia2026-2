# Agentes do Projeto #23 — P26-2B-CF46-EB49-68C0-7D86

Antes de cada tarefa, os agentes `frontend`, `backend` e `testes` devem ler [REQUISITOS.md](REQUISITOS.md), identificar os requisitos aplicáveis e consultar sua skill. Ao concluir, registrem o que foi entregue ou verificado e sinalizem divergências e pendências.

| Agente | Responsabilidade | Configuração | Skill | Documentação |
| --- | --- | --- | --- | --- |
| `frontend` | Interface HTML5, CSS3 e JavaScript puro, formulários e interação no navegador. | [TOML](.codex/agents/frontend.toml) | [frontend-referencias](skills/frontend-referencias/SKILL.md) | [Perfil](docs/agente-frontend.md) |
| `backend` | Pages Functions, D1, Discord OAuth2, validação no servidor, proteção de dados e operações de projetos e referências. | [TOML](.codex/agents/backend.toml) | [backend-referencias](skills/backend-referencias/SKILL.md) | [Perfil](docs/agente-backend.md) |
| `testes` | Execução de testes, validação bibliográfica e registro de defeitos e resultados observados. | [TOML](.codex/agents/testes.toml) | [testes-referencias](skills/testes-referencias/SKILL.md) | [Perfil](docs/agente-testes.md) |

## Agente 1 — Frontend

O agente `frontend` implementou a interface, os formulários e a interação com a API. O histórico registra as verificações de interface realizadas nas etapas de desenvolvimento.

## Agente 2 — Backend

O agente `backend` implementou o esquema D1, as operações bibliográficas, o OAuth2 e a autorização em Pages Functions.

## Agente 3 — Testes e validação

O agente `testes` verificou formatação, persistência, isolamento, autenticação e fluxos de navegador. Os relatórios das etapas registram resultados e limites.

## Harness e registro

O harness usado na primeira etapa foi a sessão Codex com a ferramenta de colaboração em um workspace compartilhado. Os três subagentes foram iniciados por nome, leram seus perfis TOML e aplicaram as skills correspondentes. O carregamento nativo dos perfis TOML pelo executor ficou fora daquela execução.

Registre em [docs/HISTORICO.md](docs/HISTORICO.md) cada execução real, com agente, harness, tarefa, skills efetivamente usadas, resultado e limites da verificação. Consulte [docs/PENDENCIAS.md](docs/PENDENCIAS.md) para acompanhar a diferença entre o estado do projeto e a especificação.

## Skills do scaffold oficial

A pasta `skills/` conserva também os guias oficiais de [backend](skills/serverless-d1-discord/SKILL.md), [interface Vanilla](skills/vanilla-dom-ui/SKILL.md) e [validação](skills/teste-validacao/SKILL.md). O histórico identifica quais skills cada agente efetivamente aplicou em cada etapa.