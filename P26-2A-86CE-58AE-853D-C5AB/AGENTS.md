# Documentação de Engenharia de Agentes e Harness

## 1. Ambiente de Orquestração

- **Harness Principal:** GitHub Copilot no VS Code, com agentes personalizados em `.github/agents/`.
- **Modelo(s) Base:** Seleção automática do Copilot (Copilot Fusion); nas sessões registradas, o modelo escolhido foi o GPT-6 Luna.
- **Estratégia de Coordenação:** Os agentes trabalham modularmente na pasta do projeto, alinhados pelos contratos da API, regras das skills e resultados de testes.
- **Apoio fora do harness:** o Claude (claude.ai) foi usado para planejar as etapas e redigir os prompts e a descrição do Agente 3; o Claude in Chrome criou o fork e configurou a aplicação do Discord.

## 2. Agentes e Responsabilidades

### Agente 1: Backend Sênior
- **Papel:** Implementa a API serverless do Quadro Kanban com Cloudflare Pages Functions e D1. É responsável pela autenticação Discord, validações no servidor e isolamento dos cartões por usuário.
- **Arquivo de definição:** `.github/agents/backend-senior.agent.md`
- **Pastas/arquivos que pode alterar:** `functions/`, `migrations/` e `wrangler.jsonc`.
- **Skills que lê:** `skills/serverless-d1-discord/SKILL.md`.
- **Entregas realizadas:** no commit `f4e660f`, implementou `functions/api/sessao.js`, `functions/api/cartoes/index.js`, `functions/api/cartoes/[id].js`, `functions/api/auth/discord.js`, `functions/api/auth/discord/callback.js`, `_middleware.js`, `_utils.js`, a migração `migrations/0002_kanban.sql` (tabelas `sessoes` e `cartoes`), e removeu o `functions/api/status.js` do modelo.

### Agente 2: Frontend Sênior
- **Papel:** Implementa a interface responsiva e acessível em HTML, CSS e JavaScript puro. Integra a interface com a API e oferece arrastar e soltar nativo e controles alternativos para mover cartões.
- **Arquivo de definição:** `.github/agents/frontend-senior.agent.md`
- **Pastas/arquivos que pode alterar:** `public/`.
- **Skills que lê:** `skills/vanilla-dom-ui/SKILL.md` e `skills/kanban-drag-drop/SKILL.md`.
- **Entregas realizadas:** no commit `19b0744`, reescreveu `public/index.html`, `public/styles.css` e `public/app.js`, com o quadro, perfil de visitante/autenticado, Drag and Drop, controles de movimento e persistência pela API.

### Agente 3: Testador e Validador (Teste e Validação)
- **Papel:** Testa independentemente a API, a segurança, a interface e os requisitos da rubrica, registrando evidências reproduzíveis. Não corrige código de produção; relata defeitos aos agentes responsáveis.
- **Arquivo de definição:** `.github/agents/testador-validador.agent.md`
- **Pastas/arquivos que pode alterar:** `tests/` e `docs/`.
- **Skills que lê:** `skills/teste-validacao/SKILL.md`, `skills/serverless-d1-discord/SKILL.md`, `skills/vanilla-dom-ui/SKILL.md` e `skills/kanban-drag-drop/SKILL.md`.
- **Entregas realizadas:** no commit `f1774de` fez a primeira rodada de testes da API e auditoria estrutural em `tests/api.test.mjs` e `docs/relatorio-testes.md`; no commit `72c19be` fez a segunda rodada, incluindo o frontend, os GET públicos e o registro do teste manual do usuário.

Os arquivos dos três agentes, as quatro skills em `skills/` e este `AGENTS.md` entraram no commit `cbedc6b`.

## 3. Fluxo de trabalho

Cada agente rodou em um chat novo, escolhido no seletor de agentes do Copilot. A ordem real foi: criação das definições dos agentes e das skills; implementação do Backend em `f4e660f`; rodada 1 de testes pelo Agente 3 em `f1774de`; implementação do Frontend em `19b0744`; e rodada 2 de testes pelo Agente 3 em `72c19be`.

O humano revisou cada alteração e pressionou Keep antes de continuar. Ele aplicou a migração remota e fez os commits. Os agentes não usaram `--remote` e não leram segredos de `.dev.vars` ou outros valores secretos.

## 4. Casos de teste e resultados

As duas rodadas executaram os mesmos 12 casos da API, com 12/12 aprovados em cada uma:

- Sem login em GET de sessão e cartões: Aprovado
- Token de sessão inexistente: Aprovado
- Cookie legado `discord_session` forjado: Aprovado
- Isolamento entre usuários: Aprovado
- Validações de coluna, prioridade, título, descrição, posição, ID e JSON: Aprovado
- `user_id` enviado pelo cliente: Aprovado
- Atualização e ordenação persistidas: Aprovado
- Exclusão própria: Aprovado
- SQL Injection e texto HTML: Aprovado
- Erros seguros: Aprovado
- Logout isolado: Aprovado
- OAuth2 e `state` divergente: Aprovado

Na rodada 2, as verificações do frontend aprovaram página pública sem redirecionamento, rodapé e chave, link de visitante, HTML5 Drag and Drop, uso seguro de texto, ausência de frameworks/CDN e sombras de texto, PATCH de mudanças, perfil autenticado e layout celular. Foram feitos GET somente leitura em `/`, `/api/sessao` e `/api/cartoes` no site publicado. O usuário informou que um teste manual no site publicado, em aba anônima, passou para visitante, login Discord, criação e edição, movimentação, persistência após F5, exclusão, celular e logout; isso foi registrado como relato do usuário.

O `validar-local.mjs` passou com 9/9 na rodada 1 e na rodada 2. Evidências, comandos e limitações estão em [`docs/relatorio-testes.md`](./docs/relatorio-testes.md).
