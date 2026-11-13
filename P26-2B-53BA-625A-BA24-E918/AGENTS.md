# Engenharia de agentes — P26-2B-53BA-625A-BA24-E918

## Harness

- **Agente 1 e Agente 3:** GitHub Copilot (Chat/Agent) no VS Code. Os modelos não foram informados pelo harness e por isso não são declarados.
- **Agente 2:** Claude, em sessão do aplicativo Claude (ambiente de agente em nuvem). Modelo configurado na sessão: `claude-sonnet-5-5`; o modelo que respondeu cada turno pode diferir do configurado.
- O estudante coordenou os três, decidiu o que aceitar, executou os comandos na própria máquina e fez os testes manuais.

## Agentes e entregas

### Agente 1 — Construção (Copilot, VS Code)

- Gerou o backend (Pages Functions, validação, autorização de autoria, sessão assinada, esquema D1) e a interface Vanilla JS.
- Skills: `skills/serverless-d1-discord/SKILL.md` e `skills/vanilla-dom-ui/SKILL.md`.
- Entrega: `functions/`, `migrations/`, `public/`.

### Agente 2 — Revisão de código e apoio ao deploy (Claude)

- Leu o código entregue pelo Agente 1 e conferiu: validação de `state` e escopo `identify` no OAuth, cookie HttpOnly/Secure/SameSite, identidade do autor vinda da sessão, checagem de autoria em editar/excluir, queries parametrizadas, ausência de `innerHTML` e de dependências externas no frontend.
- Rodou `node --check` nos arquivos JS e `validar-local.mjs` (o único item pendente na época era o deploy).
- Orientou a criação do D1, a configuração do Cloudflare Pages e do Discord, e diagnosticou o erro `no such table: discord_users` do ambiente local (migração aplicada em outra pasta de estado).
- Skill: `skills/revisao-codigo/SKILL.md`.

### Agente 3 — Teste e validação (Copilot, modo Agent, sessão separada)

- Seguiu `skills/teste-validacao/SKILL.md`, sem alterar arquivos.
- Resultado: `node --check` passou em 12 arquivos; `validar-local.mjs` passou nos 9 critérios, incluindo a URL pública do Cloudflare Pages.

## Testes manuais do estudante

- Local (`wrangler pages dev`, D1 local): login Discord e fluxo completo.
- Produção (Cloudflare Pages + D1), com duas contas Discord em sessões separadas: inscrição individual, feed só das disciplinas inscritas, segunda conta sem botões de editar/excluir no aviso alheio, "lido" e "fixado" individuais, aviso de uma conta visível para a outra.

## Contratos de dados

- A identidade do autor vem da sessão assinada, nunca do corpo da requisição.
- `subscriptions` define o feed de cada estudante; `post_states` guarda `is_read` e `is_pinned` por aviso/usuário.
- `posts` guarda `author_id`, `author_name` e `author_avatar` na criação.