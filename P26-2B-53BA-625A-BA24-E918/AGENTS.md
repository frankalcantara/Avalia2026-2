# Engenharia de agentes — P26-2B-53BA-625A-BA24-E918

## Harness

- **Agente 1 e Agente 3:** GitHub Copilot (Chat/Agent) no VS Code. O harness não informou quais modelos atuaram; por isso não são declarados, para evitar atribuição incorreta.
- **Agente 2:** Claude, em sessão do aplicativo Claude (ambiente de agente em nuvem, com shell, leitura e edição de arquivos e navegador para testes). Modelo configurado na sessão: `claude-sonnet-5-5`; o modelo que respondeu cada turno pode diferir do configurado.
- O estudante coordenou os três agentes, decidiu o que aceitar, executou na própria máquina os comandos de banco, deploy e Git e fez os testes manuais com login real.

## Agentes e entregas

### Agente 1 — Construção (Copilot, VS Code)

- Gerou a versão inicial do backend (Pages Functions, validação no servidor, autorização de autoria, sessão assinada, esquema D1) e da interface Vanilla JS.
- Skills: `skills/serverless-d1-discord/SKILL.md` e `skills/vanilla-dom-ui/SKILL.md`.
- Entrega: `functions/`, `migrations/0001_init.sql` e `public/` (versão inicial).

### Agente 2 — Revisão, evolução e apoio ao deploy (Claude)

- **Revisão:** leu o código do Agente 1 e conferiu validação de `state` e escopo `identify` no OAuth, cookie HttpOnly/Secure/SameSite, identidade do autor vinda da sessão, checagem de autoria em editar/excluir, queries parametrizadas, ausência de `innerHTML` e de dependências externas no frontend. Rodou `node --check` e o `validar-local.mjs`.
- **Apoio ao deploy:** orientou a criação do D1, a configuração do Cloudflare Pages e do Discord OAuth2, e diagnosticou o erro local `no such table: discord_users` (migração aplicada em outra pasta de estado).
- **Melhorias na interface:** busca por texto, filtros (não lidos, fixados, tipo), contador de não lidos, tema escuro automático, mensagens de feedback na coluna lateral e barra de filtros fixa junto aos resultados.
- **Prazo nos lembretes:** coluna opcional `due_at` (`migrations/0002_due_at.sql`), validação da data no servidor (POST e PATCH, só o autor altera), selo de contagem regressiva, painel "Próximos prazos" e exportação do prazo para calendário (`.ics`).
- **Testes que escreveu e executou:**
  - Backend: 24 verificações com SQLite real em memória simulando o D1 (aplicação das migrações 0001 e 0002 sobre dados existentes, validação de datas inválidas e tentativa de injeção SQL, 401 sem sessão, 403 sem inscrição ou para outro usuário, PATCH do autor).
  - Interface: 62 verificações no navegador (Chromium/Playwright) com a API simulada, cobrindo filtros, busca, tema claro/escuro, celular sem rolagem horizontal, mensagens, selos de prazo, painel, `.ics` e formulário.
  - Limite: esses testes usam API simulada e SQLite em memória; não exercitam o login real do Discord nem o D1 da Cloudflare, o que foi coberto pelos testes manuais do estudante.
- Skill: `skills/revisao-codigo/SKILL.md`.

### Agente 3 — Teste e validação (Copilot, modo Agent, sessão separada)

- Seguiu `skills/teste-validacao/SKILL.md`, sem alterar arquivos.
- Execução registrada em 10/11/2026: `node --check` passou em 12 arquivos `.js` de `functions/` e `public/`; `node validar-local.mjs P26-2B-53BA-625A-BA24-E918` passou nos 9 critérios, incluindo a URL pública do Cloudflare Pages.

## Testes manuais do estudante

- Local (`wrangler pages dev`, D1 local): login Discord e fluxo completo.
- Produção (Cloudflare Pages + D1), com duas contas Discord em sessões separadas: inscrição individual, feed só das disciplinas inscritas, segunda conta sem botões de editar/excluir no aviso alheio, "lido" e "fixado" individuais, aviso de uma conta visível para a outra.
- Após as melhorias: busca, filtros, mensagens e lembretes com prazo verificados no site publicado.

## Contratos de dados

- A identidade do autor vem da sessão assinada, nunca do corpo da requisição.
- `subscriptions` define o feed de cada estudante; `post_states` guarda `is_read` e `is_pinned` por aviso/usuário.
- `posts` guarda `author_id`, `author_name` e `author_avatar` na criação e, opcionalmente, `due_at` (data `AAAA-MM-DD`) validado no servidor.