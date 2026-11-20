# Agentes, harness e skills

**Harness:** Claude Code (subagentes em `.claude/agents/*.md`, skills em `.claude/skills/*/SKILL.md`).

| Agente | Papel | Skills que usa |
|---|---|---|
| `arquiteto-backend` | Modela o banco no D1, escreve as Pages Functions, o OAuth2 do Discord e a validação no servidor | `discord-oauth2`, `d1-modelagem` |
| `dev-frontend` | Constrói a interface em HTML, CSS e JavaScript puro e o escalonador de porções | `escalonador-porcoes` |
| `qa-validador` | **Agente de teste e validação.** Roda `npm test`, escreve testes novos, revisa o código contra a rubrica e reporta falhas | `qa-rubrica`, `escalonador-porcoes` |

## Fluxo

1. `arquiteto-backend` entrega schema, rotas e `lib/validate.js`.
2. `dev-frontend` consome a API e implementa busca, escalonador e favoritos.
3. `qa-validador` roda os testes, confere cada item da rubrica e devolve uma lista de correções. Os dois primeiros corrigem e o QA roda de novo até passar.

## Registro de uso (preencher com o que realmente aconteceu)

Descreva aqui, para cada agente, as tarefas executadas, os problemas que o `qa-validador` encontrou e como foram corrigidos. Esta seção deve refletir a execução real no seu ambiente.

- `arquiteto-backend`:
- `dev-frontend`:
- `qa-validador`:
