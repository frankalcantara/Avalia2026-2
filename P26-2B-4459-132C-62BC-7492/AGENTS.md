# AGENTS.md — Engenharia de Agentes

Chave Única: `P26-2B-4459-132C-62BC-7492` · Aluno: Bernardo Lopes de Araujo · Turma 2B · Projeto #5 Quiz Competitivo Temporizado

## Harness

Todos os agentes rodaram no **Claude Code (harness do Claude Agent SDK)**, em uma sessão do Claude com o modelo **Claude Sonnet 5.5** (`claude-sonnet-5-5`). Um agente orquestrador (a sessão principal) delega trabalho a subagentes pela ferramenta `Agent`. Cada subagente recebe um briefing próprio, trabalha em contexto isolado e devolve um relatório final.

Ferramentas do harness usadas: `Read`, `Write`, `Edit`, `Bash`, `Glob`/`Grep`, `Agent` (subagentes), `Skill` (carrega skills) e Playwright/Chromium.

## Agente 1 — Orquestrador / Backend

- **Tipo no harness:** sessão principal.
- **Papel:** lê a especificação, define o contrato da API (`docs/API.md`) e o schema D1, escreve o backend (Cloudflare Pages Functions), o seed, os testes de integração e a documentação, e integra o trabalho dos demais agentes.
- **Entradas:** enunciado do projeto, relatórios dos outros agentes.
- **Saídas:** `functions/`, `schema.sql`, `db/`, `scripts/`, `tests/api.test.mjs`, `docs/`.
- **Skills:** nenhum skill específico.

## Agente 2 — Arquiteto (revisor de desenho)

- **Tipo no harness:** subagente `Plan` (somente leitura).
- **Papel:** revisa `docs/API.md` e `schema.sql` antes da implementação e lista brechas anti-manipulação e armadilhas de Cloudflare Pages/D1.
- **Entradas:** `docs/API.md`, `schema.sql`.
- **Saídas:** 18 recomendações, aplicadas pelo orquestrador: índice único parcial de quiz ativo, `correctIndex` oculto em `timeout`/`skipped`, pontuação derivada de `SUM(points)`, `sent_at` com UPDATE condicional e releitura, `crypto.getRandomValues` no embaralhamento, `Secure` conforme o protocolo, `state` do OAuth descartado após o uso e `db.batch` para atomicidade.
- **Skills:** nenhum skill específico.

## Agente 3 — Frontend

- **Tipo no harness:** subagente `general-purpose`.
- **Papel:** constrói a interface em HTML5, CSS3 e JavaScript puro conforme o contrato da API e a CSP (sem scripts nem estilos inline, sem `innerHTML` com dados do servidor).
- **Entradas:** `docs/API.md`, restrições de CSP.
- **Saídas:** `public/index.html`, `public/css/style.css`, `public/js/app.js`.
- **Skills:** `skills/frontend-design`.

## Agente 4 — Agente de Teste e Validação (obrigatório)

- **Tipo no harness:** subagente `general-purpose`, sem permissão para alterar código de produção.
- **Papel:** testa o frontend em navegador real (Chromium/Playwright) com a API simulada: injeção de HTML (XSS), barra regressiva, duplo envio, tempo esgotado, rodapé com a chave, responsividade e requisições externas.
- **Entradas:** `public/`, `docs/API.md`.
- **Saídas:** `tests/e2e/frontend.e2e.mjs`, capturas de tela e relatório PASS/FAIL.
- **Resultado:** encontrou um bug bloqueante (`ui` era zerado em `mount()` depois de preenchido, travando a barra e o envio de respostas); a correção foi aplicada e as 19 verificações passaram.
- **Skills:** `skills/validacao-quiz`.

O Agente 1 também executa `npm test` (21 testes de integração do backend contra um D1 simulado em `node:sqlite`), como segunda camada de validação.

## Fluxo de trabalho

1. O Agente 1 escreve o contrato (`docs/API.md`) e o schema.
2. O Agente 2 revisa o desenho; o Agente 1 aplica as correções.
3. O Agente 1 implementa o backend e os testes de integração; o Agente 3 implementa a interface a partir do mesmo contrato.
4. O Agente 4 exercita a interface integrada ao contrato; as falhas voltam ao Agente 1 para correção.

## Skills versionados

- `skills/frontend-design/SKILL.md` — direção visual intencional, usada pelo Agente 3.
- `skills/validacao-quiz/SKILL.md` — checklist de anti-manipulação e de UX, usado pelo Agente 4.

## Limitações registradas

- Durante a sessão o Agente 3 foi interrompido uma vez por limite de uso da conta; os arquivos já estavam gravados e foram validados em seguida.
- O teste de ponta a ponta com Discord e D1 reais só é possível após o deploy (ver `README.md`).
