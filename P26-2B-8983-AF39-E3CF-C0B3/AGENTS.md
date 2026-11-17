# Agentes, Harness e Skills

Entrega oficial **P26-2B-8983-AF39-E3CF-C0B3**. Os agentes abaixo foram executados pelo harness **Copilot SDK em VS Code** e receberam escopos de edição separados, além das skills versionadas neste projeto. Os modelos são gerenciados pelo harness e não ficam expostos nesta sessão; por isso, nenhum nome de modelo foi presumido.

## Coordenação

O contrato compartilhado define as rotas `/api/auth/me`, `/api/auth/logout`, `/api/recipes` e `/api/favorites`. O agente de backend é responsável pelas Functions e pelo D1; o agente de interface consome esse contrato sem framework; o agente de teste verifica a integração, os requisitos da rubrica e a validação local. Segredos Cloudflare/Discord não são incluídos nos arquivos versionados.

## Agente 1 — Backend D1 e OAuth Discord

- **Responsabilidade:** implementar autenticação Discord, sessão protegida, regras e validações server-side, consultas parametrizadas e persistência de receitas e favoritos.
- **Harness:** Copilot SDK em VS Code, agente customizado de implementação (`general-purpose`).
- **Skill utilizada:** [serverless-d1-discord](./skills/serverless-d1-discord/SKILL.md).
- **Arquivos sob responsabilidade:** `functions/`, `migrations/` e `wrangler.jsonc`.

## Agente 2 — Interface Vanilla JS

- **Responsabilidade:** implementar catálogo, busca, formulário estruturado de receitas, favoritos e escalonador de porções em HTML/CSS/JavaScript nativos.
- **Harness:** Copilot SDK em VS Code, agente customizado de implementação (`general-purpose`).
- **Skill utilizada:** [vanilla-dom-ui](./skills/vanilla-dom-ui/SKILL.md).
- **Arquivos sob responsabilidade:** `public/`.

## Agente 3 — Teste e Validação

- **Responsabilidade:** validar os contratos frontend/backend, os limites de entrada e autorização, os casos do escalonador, os arquivos exigidos pela rubrica e executar o validador local. Este agente é dedicado a teste e validação, sem escopo de implementação de funcionalidades.
- **Harness:** Copilot SDK em VS Code, agente customizado de teste (`task`).
- **Skill utilizada:** [teste-validacao](./skills/teste-validacao/SKILL.md).
- **Relatório:** identificou exposição de registros privados no endpoint de status e falha de busca por títulos com acentos em caixa diferente; ambos foram corrigidos. A tentativa inicial de executar rotas com um fixture ad hoc falhou; os imports relativos também foram corrigidos e os testes de rota adicionados à suíte nativa.

## Skills versionadas

- `skills/serverless-d1-discord/SKILL.md`
- `skills/vanilla-dom-ui/SKILL.md`
- `skills/teste-validacao/SKILL.md`

## Evidências de teste e limites

- `node --test tests/backend.test.mjs` (executado na pasta do projeto): 10 testes passaram; repetido nesta retomada.
- `npx wrangler@4 pages functions build ./functions --project-directory . --build-output-directory ./public --outdir ./.wrangler/pages-build` (executado na pasta do projeto): compilação Cloudflare Pages Functions aprovada; repetida nesta retomada.
- Migrações aplicadas em SQLite local; constraints e busca `PÃO`/`pão` verificadas.
- Migração de catálogo aplicada em SQLite local: 50 receitas, com ingredientes e etapas, e 50 ilustrações SVG locais verificadas.
- Chromium com API local simulada verificou o escalonamento de 2 para 5 e depois 3 porções e uma viewport móvel sem overflow horizontal. A captura gerada usa dados fictícios e não representa um deploy.
- A validação estrutural pode ser executada com `node validar-local.mjs P26-2B-8983-AF39-E3CF-C0B3` a partir da raiz do repositório, onde o diretório da entrega está localizado.
- O login Wrangler foi concluído, mas a conta autenticada não tem autorização para o projeto Pages nem para o D1 configurados. Nenhuma migração remota, alteração de secret ou publicação foi feita; OAuth de produção e D1 remoto continuam pendentes.
