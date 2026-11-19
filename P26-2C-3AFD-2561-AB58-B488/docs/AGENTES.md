# Agentes, harness e skills

**Harness utilizado:** Claude Code (CLI da Anthropic). Os agentes ficam em `.claude/agents/` e as skills em `.claude/skills/`, que é o formato que o harness carrega automaticamente.

## Agentes

| Agente | Arquivo | Papel |
|---|---|---|
| `arquiteto-backend` | `.claude/agents/arquiteto-backend.md` | Cloudflare Functions, D1, OAuth2 do Discord, regras de negócio no servidor |
| `dev-frontend` | `.claude/agents/dev-frontend.md` | Interface em HTML5, CSS3 e Vanilla JS, busca instantânea e citação aleatória |
| `qa-validador` | `.claude/agents/qa-validador.md` | **Agente de teste e validação**: testes automatizados, revisão de segurança e conferência da rubrica |

## Skills usadas

| Skill | Arquivo | Usada por |
|---|---|---|
| `d1-cloudflare-functions` | `.claude/skills/d1-cloudflare-functions/SKILL.md` | arquiteto-backend |
| `vanilla-js-dom-seguro` | `.claude/skills/vanilla-js-dom-seguro/SKILL.md` | dev-frontend |
| `validacao-e-testes` | `.claude/skills/validacao-e-testes/SKILL.md` | qa-validador |

## Fluxo de trabalho

1. `arquiteto-backend` define `schema.sql` e as rotas em `functions/`.
2. `dev-frontend` constrói `public/` consumindo essas rotas.
3. `qa-validador` roda `npm test`, revisa o código e executa `docs/CHECKLIST-QA.md`.
4. Falhas voltam ao agente responsável; só então o deploy é feito.
