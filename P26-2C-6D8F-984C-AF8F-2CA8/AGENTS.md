# Engenharia de Agentes e Harness — P26-2C-6D8F-984C-AF8F-2CA8

Projeto #17 — Calculadora e Simulador de Desempenho Acadêmico.

## 1. Harness

| Item | Valor |
|---|---|
| **Harness** | **Claude Code** (CLI da Anthropic), no Windows 11, com as ferramentas Bash, leitura/escrita de arquivos e Playwright (navegador) |
| **Modelo** | Claude Opus 5.5 (`claude-opus-5-5`) em todos os agentes |
| **Mecanismo** | Uma sessão principal (orquestrador) dispara **subagentes** com a ferramenta `Agent` do Claude Code. Cada subagente roda com contexto próprio e isolado e só recebe o prompt de tarefa. Ao terminar, devolve um relatório ao orquestrador. |
| **Definição dos agentes** | `.claude/agents/*.md` (formato de subagente do Claude Code: frontmatter com `name`, `description`, `tools`, `skills` + instruções) |
| **Skills** | `skills/<nome>/SKILL.md` (frontmatter `name`/`description` + regras e checklist). Cada agente lê sua skill antes de agir. |
| **Coordenação** | Contrato escrito antes do código (`docs/CONTRATO-API.md`), mais um módulo de regra de negócio compartilhado (`public/js/calculo.js`). Com isso os agentes 1 e 2 trabalharam **em paralelo** sem pisar no escopo um do outro. |

### Fluxo executado

```
Orquestrador (sessão principal)
 ├─ escreveu: calculo.js + testes, schema D1, CONTRATO-API.md, skills, definições dos agentes
 ├─ criou: banco D1 (remoto+local, migrado) e projeto Cloudflare Pages
 │
 ├──► Agente 1 (backend)  ┐ em paralelo
 ├──► Agente 2 (frontend) ┘
 │        └─ deploy em https://notas-p26-2c.pages.dev
 ├──► Agente 3 (teste e validação) → docs/RELATORIO-TESTES.md (6 achados)
 │
 └─ ciclo de correção: orquestrador corrige F1–F6 → reexecuta a suíte do Agente 3 (16/16) → novo deploy
```

---

## 2. Agentes

### Agente 1 — Arquiteto Backend (Cloudflare Functions + D1 + Discord OAuth2)

- **Definição:** [`.claude/agents/arquiteto-backend.md`](./.claude/agents/arquiteto-backend.md)
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Escopo:** apenas `functions/**`
- **Entregas:**
  - `functions/api/_middleware.js`: lê o cookie `sid`, busca a sessão em `sessions` + `discord_users` e preenche `context.data.user`. Responde 401 nas rotas de dados sem sessão.
  - `functions/api/auth/discord.js` e `callback.js`: OAuth2 com `state` anti-CSRF. Importa `user_id`, nome e avatar e cria uma sessão opaca (token aleatório de 32 bytes no D1).
    - Substituiu o cookie do scaffold, que era um JSON em base64 forjável pelo cliente.
  - `functions/api/me.js` e `functions/api/auth/logout.js`.
  - `functions/api/disciplinas/index.js` e `[id].js`: CRUD com `validarDisciplina()` no servidor e isolamento por dono (recurso de outro usuário responde 404).
    - O `PUT` grava tudo de forma atômica com `DB.batch`, e o `resumo` é recalculado no servidor.
- **Como se validou:** subiu `wrangler pages dev`, criou sessões de teste no D1 local e conferiu com curl:
  - 401 sem sessão;
  - 201 e 400 no POST;
  - 404 entre usuários;
  - 409 no limite de disciplinas;
  - logout.

### Agente 2 — Designer Frontend (HTML5, CSS3 e Vanilla JS)

- **Definição:** [`.claude/agents/designer-frontend.md`](./.claude/agents/designer-frontend.md)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Escopo:** apenas `public/**`. `calculo.js` só é importado, nunca alterado.
- **Entregas:**
  - `public/index.html`, `app.js` e `styles.css`, sem frameworks e com módulos ES nativos.
  - Login com Discord; cabeçalho com avatar, nome e user_id; lista de disciplinas com pílula de situação e progresso do peso lançado.
  - Editor (`<dialog>`) com modelos de fórmula ("2 provas + trabalho", "3 provas", "Provas + listas").
  - **Recálculo instantâneo** no evento `input`: média parcial, garantida e máxima, nota mínima nas restantes para aprovação direta e para o exame, e nota necessária no exame.
  - Salvamento automático com PUT (debounce de 600 ms, fila e indicador de estado).
  - Texto do usuário sempre via `textContent`, tema escuro, responsivo a partir de 360 px, `aria-live` e foco visível.
- **Como se validou:** testou no Chromium (Playwright) com a API simulada conforme o contrato: recálculo, validação, presets e 360 px sem rolagem horizontal.

### Agente 3 — Agente de Teste e Validação (obrigatório)

- **Definição:** [`.claude/agents/testador-validador.md`](./.claude/agents/testador-validador.md)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Escopo:** independente e adversarial. Só pode escrever em `tests/` e `docs/RELATORIO-TESTES.md`; não corrige código de produção, só reporta.
- **Entregas:**
  - `tests/calculo-bordas.test.mjs`: 11 casos de borda do cálculo.
  - `tests/api.test.mjs`: 16 testes de API reutilizáveis, com `BASE_URL`, `SID_A` e `SID_B` vindos de variáveis de ambiente. Cobrem:
    - cookie forjado;
    - payloads inválidos;
    - isolamento entre usuários;
    - `resumo` do servidor igual ao do cliente;
    - tentativa de sequestro via `user_id` no corpo;
    - injeção SQL gravada literalmente.
  - Teste da interface com Playwright contra o servidor real local: recálculo, persistência após reload, rodapé, console sem erros e 375 px.
  - Smoke test em produção sem criar dados e auditoria com `validar-local.mjs` (9/9).
  - [`docs/RELATORIO-TESTES.md`](./docs/RELATORIO-TESTES.md), com evidências em `docs/evidencias/`.
- **Achados (todos corrigidos e retestados):**
  - **F1:** cookie malformado causava erro 500.
  - **F2:** o limite de 20 disciplinas podia ser furado com requisições simultâneas.
  - **F3:** a média era arredondada antes de ser comparada com a meta.
  - **F4:** valores como `true` e `[]` passavam na validação como número.
  - **F5:** disciplina sem avaliações aparecia como "aprovado".
  - **F6:** faltavam cabeçalhos de segurança, resolvido com `public/_headers` (CSP).

---

## 3. Skills utilizadas

| Skill | Usada por | Conteúdo |
|---|---|---|
| [`serverless-d1-discord`](./skills/serverless-d1-discord/SKILL.md) | Agente 1 | Sessão opaca, OAuth2 com `state`, SQL parametrizado, isolamento por usuário, `DB.batch`, segredos fora do repositório |
| [`vanilla-dom-ui`](./skills/vanilla-dom-ui/SKILL.md) | Agente 2 | Zero frameworks, módulos ES, recálculo no `input` com PUT em debounce, `textContent`, sem `text-shadow`, responsivo e acessível |
| [`teste-validacao`](./skills/teste-validacao/SKILL.md) | Agente 3 | Protocolo: unitário, API local adversarial, interface com Playwright, produção, rubrica, relatório com arquivo:linha |
