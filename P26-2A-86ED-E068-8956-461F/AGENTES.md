# Agentes, harness e skills

Chave Única do projeto: **P26-2A-86ED-E068-8956-461F**

## Harness

Os agentes foram definidos para o harness **Claude Code** (CLI da Anthropic). Nesse harness:

- cada agente é um arquivo Markdown em `.claude/agents/`, com nome, descrição, ferramentas permitidas e os skills que usa;
- cada skill é uma pasta em `.claude/skills/<nome>/SKILL.md`, carregada pelo agente quando a tarefa pede.

## Agentes (3)

| Agente | Papel | Skills usados | Arquivo |
|---|---|---|---|
| arquiteto-backend | Schema do D1, login Discord OAuth2, endpoints, regras de negócio e reserva atômica | cloudflare-d1-atomico, discord-oauth2 | `.claude/agents/arquiteto-backend.md` |
| construtor-frontend | Interface em HTML5, CSS3 e JavaScript puro | frontend-vanilla-js | `.claude/agents/construtor-frontend.md` |
| testador-validador | **Agente de teste e validação**: roda os testes, confere a rubrica e o deploy | validacao-e-testes | `.claude/agents/testador-validador.md` |

## Skills

| Skill | O que ensina | Arquivo |
|---|---|---|
| cloudflare-d1-atomico | Consultas parametrizadas, batch transacional, contadores atômicos | `.claude/skills/cloudflare-d1-atomico/SKILL.md` |
| discord-oauth2 | Fluxo Authorization Code, state, sessão em cookie | `.claude/skills/discord-oauth2/SKILL.md` |
| frontend-vanilla-js | DOM seguro, acessibilidade, responsividade, sem frameworks | `.claude/skills/frontend-vanilla-js/SKILL.md` |
| validacao-e-testes | Testes automáticos, roteiro manual e formato do relatório | `.claude/skills/validacao-e-testes/SKILL.md` |

## Fluxo de trabalho

1. O **arquiteto-backend** cria `schema.sql` e `functions/` e publica a lista de endpoints.
2. O **construtor-frontend** cria `public/` consumindo esses endpoints.
3. O **testador-validador** roda `npm test` e `npm test -- <URL do site>` e devolve um relatório. Falhas voltam ao agente responsável.
4. Quando o relatório não tem falhas, o projeto é publicado e entregue.

## Separação de responsabilidades

- O testador-validador não altera código. Ele só executa e relata.
- O frontend não implementa regra de negócio. Toda validação é repetida e decidida no servidor.
- Nenhum agente guarda segredos no repositório. As credenciais do Discord ficam em variáveis do Cloudflare.

## Como reproduzir

```
npm test
npm test -- https://caronas-cracco.pages.dev
```
