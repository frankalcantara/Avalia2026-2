# Documentação de Engenharia de Agentes e Harness (P26-2C-D74F-99D3-3096-8A00)

Projeto #34: Vitrine de Achados e Perdidos do Campus
Produção: https://achados-app.pages.dev

> **Requisito da Rubrica (25 pontos):** no mínimo **3 agentes diferentes** (1 dedicado a teste e validação), com o harness documentado e as skills na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness:** Claude na interface de chat (claude.ai), com uma conversa por papel de agente. Não foram usados Claude Code, Cursor, Copilot nem outro harness.
- **Modelo base:** Claude (Anthropic). [Informe a versão exata que aparece no seletor de modelos do chat.]
- **Execução local:** PowerShell no Windows, Node.js, Wrangler (`wrangler pages dev`, `d1 migrations`, `pages deploy`).
- **Estratégia de coordenação:** cada agente recebeu o `SKILL.md` do seu papel como instrução. O contrato entre eles são as rotas JSON em `functions/api/*` e o schema D1 em `migrations/`. O humano executa os comandos, copia os resultados e decide o que entra no repositório.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** esquema D1, login Discord OAuth2, sessão assinada e regras de negócio no servidor.
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entradas:** requisitos do projeto #34, arquivos do template, erros do terminal.
- **Saídas:**
  - `migrations/0002_itens_e_reivindicacoes.sql` (tabelas `items` e `claims`, constraints e índice único parcial).
  - `functions/_lib/session.js` (cookie assinado com HMAC-SHA256) e `functions/_lib/validate.js`.
  - `functions/api/auth/*`, `me.js`, `items/*`, `claims/*` e `status.js`.
- **Correções feitas sobre o template:** o cookie de sessão original era JSON em base64 sem assinatura (forjável). Foi trocado por cookie assinado, com `state` anti-CSRF no login. Foi removido o binding D1 duplicado do `wrangler.jsonc`.
- **Evidência:** commits do repositório e testes `/api/me` e `POST /api/items` no navegador.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** interface responsiva e acessível, só com HTML5, CSS3 e JavaScript puro.
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entradas:** contrato das rotas do Agente 1.
- **Saídas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`.
  - Filtros cruzados (tipo, categoria, status, texto e local) com debounce de 250 ms.
  - Formulário de novo item, detalhe, reivindicação e painel "Minhas reivindicações".
  - Todo dado de usuário entra no DOM via `textContent` (sem `innerHTML`), o que evita XSS.
  - Cabeçalho com avatar e nome do Discord, e rodapé com a chave `P26-2C-D74F-99D3-3096-8A00`.
  - CSS organizado em 11 seções, com variáveis de tema claro e escuro e layout mobile-first.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** verificação independente contra o deploy de produção, sem alterar o código da aplicação.
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entradas:** URL de produção e cookie de sessão de teste (não versionado).
- **Saídas:**
  - `tests/qa.mjs`: script de testes de API.
  - `QA-REPORT.md`: relatório gerado em produção, **12/12 testes passaram**.
  - Execução do validador oficial `node validar-local.mjs P26-2C-D74F-99D3-3096-8A00`