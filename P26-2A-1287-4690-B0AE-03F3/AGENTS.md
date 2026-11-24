# AGENTS.md — Agentes, harness e skills

Chave Única: `P26-2A-1287-4690-B0AE-03F3`

## Harness
Todos os agentes operaram no **Claude Code** (harness agêntico da Anthropic, executado via Claude Agent SDK), com o modelo **Claude Sonnet 5.5**. Um agente orquestrador criou o contrato (`docs/API.md`, schema D1, definições de agentes e skills) e delegou o trabalho a subagentes com contexto isolado. Cada subagente tem definição em `agents/` e uma skill em `skills/`.

## Agentes (3, sendo 1 de teste e validação)
| # | Agente | Papel | Arquivo | Skill usada |
|---|---|---|---|---|
| Agente 1 | `backend-agent` | Functions, D1, OAuth2 Discord, regras de negócio no servidor | `agents/backend-agent.md` | `cloudflare-pages-d1` |
| Agente 2 | `frontend-agent` | Interface HTML5/CSS3/Vanilla JS, grade, filtros, formulário | `agents/frontend-agent.md` | `vanilla-frontend` |
| Agente 3 | `qa-agent` | **Teste e validação**: testes automatizados, auditoria de segurança e de conformidade com a rubrica | `agents/qa-agent.md` | `qa-validation` |

## Skills
- `skills/cloudflare-pages-d1/SKILL.md`
- `skills/vanilla-frontend/SKILL.md`
- `skills/qa-validation/SKILL.md`

## Fluxo
1. Orquestrador → contrato (`API.md`, `migrations/0001_init.sql`, `wrangler.toml`).
2. `backend-agent` e `frontend-agent` em paralelo, cada um restrito à sua pasta.
3. `qa-agent` valida a integração, escreve testes, corrige falhas mínimas e registra em `docs/RELATORIO-QA.md`.

## Observação
Os agentes são assistentes de desenvolvimento; o autor revisou o resultado e responde pelo projeto.

## Agente 1 — backend-agent
Implementou `functions/` (login Discord OAuth2, sessões, kudos, filtros) e as regras de negócio no servidor. Skill: `skills/cloudflare-pages-d1/SKILL.md`.

## Agente 2 — frontend-agent
Implementou `public/` em HTML5, CSS3 e Vanilla JS, sem frameworks. Skill: `skills/vanilla-frontend/SKILL.md`.

## Agente 3 — qa-agent (teste e validação)
Escreveu os testes automatizados (`tests/`, 36 casos, `npm test`), fez auditoria estática e registrou os resultados em `docs/RELATORIO-QA.md`. Skill: `skills/qa-validation/SKILL.md`.
