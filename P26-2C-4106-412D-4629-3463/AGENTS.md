# Documentação de Engenharia de Agentes e Harness (P26-2C-4106-412D-4629-3463)

Projeto #18 — Mural de Avisos Departamental por Disciplina. Chave: `P26-2C-4106-412D-4629-3463`.

## 1. Ambiente de orquestração (harness)

- **Harness:** VS Code com Cline (Agente 1), Continue (Agente 2) e GitHub Copilot Free em modo agente (Agente 3).
- **Modelos base:** _preencher com os modelos realmente usados em cada harness._
- **Coordenação:** cada agente tem um arquivo de instruções em [`docs/agentes/`](docs/agentes/) e carrega o seu skill de [`skills/`](skills/). O Arquiteto define o contrato da API, o Construtor de Interface o consome e o Testador verifica tudo sem escrever funcionalidade.

## 2. Agentes (mínimo de 3)

### Agente 1 — Arquiteto de Backend (Cloudflare D1 e Discord OAuth2)
- **Papel:** esquema do D1 (`migrations/0001_init.sql`), login Discord (`functions/api/auth/`), rotas e regras de negócio validadas no servidor.
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](skills/serverless-d1-discord/SKILL.md)
- **Instruções:** [`docs/agentes/arquiteto-backend.md`](docs/agentes/arquiteto-backend.md)

### Agente 2 — Construtor de Interface (HTML5, CSS3 e JavaScript puro)
- **Papel:** `public/index.html`, `public/styles.css` e `public/app.js`, sem frameworks de interface, com DOM seguro e responsividade.
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](skills/vanilla-dom-ui/SKILL.md)
- **Instruções:** [`docs/agentes/construtor-interface.md`](docs/agentes/construtor-interface.md)

### Agente 3 — Testador e Validador (obrigatório)
- **Papel:** testes automatizados (`npm test`), verificação do site publicado (`node tests/smoke.mjs <URL>`), conferência da rubrica e `validar-local.mjs`. Só altera arquivos em `tests/`.
- **Skill:** [`skills/teste-validacao/SKILL.md`](skills/teste-validacao/SKILL.md)
- **Instruções:** [`docs/agentes/testador-validador.md`](docs/agentes/testador-validador.md)

## 3. Registro de uso (preenchido pelo autor)

| Agente | Modelo usado | Tarefa executada | Evidência (arquivo) | Ajuste feito por mim |
|---|---|---|---|---|
| Arquiteto de Backend | _a preencher_ | _a preencher_ | _a preencher_ | _a preencher_ |
| Construtor de Interface | _a preencher_ | _a preencher_ | _a preencher_ | _a preencher_ |
| Testador e Validador | _a preencher_ | _a preencher_ | _a preencher_ | _a preencher_ |
