# Engenharia de Agentes e Harness (P26-2A-0FC2-F5F9-5A1B-0D19)

Projeto #26: Sistema de Enquetes e Votação Verificada · Vinicius Kichel Derganho · Turma 2A · RA 2026107869

## 1. Harness utilizado

| Item | Valor |
|---|---|
| **Harness** | **Claude Cowork** (aplicativo desktop Claude, construído sobre o **Claude Agent SDK**, o mesmo motor do Claude Code), executando em sandbox Linux na nuvem com acesso à pasta local do aluno |
| **Modelo base** | Claude Opus 5.5 (`claude-opus-5-5`) para o orquestrador e para os 3 subagentes |
| **Mecanismo de agentes** | Ferramenta `Agent` do harness: cada subagente é uma instância isolada, com contexto próprio, iniciada pelo orquestrador com um prompt de papel e uma skill obrigatória |
| **Ferramentas disponíveis aos agentes** | Read, Write, Edit, Bash (Node 22, npm, wrangler, Playwright/Chromium) |
| **Contrato compartilhado** | [`docs/SPEC.md`](./docs/SPEC.md): rotas, formatos JSON, códigos de erro, modelo de dados e telas |

Os prompts de criação de cada agente estão versionados em [`agents/`](./agents/) e as skills em [`skills/`](./skills/).

## 2. Fluxo de coordenação

```
Orquestrador (sessão principal no Cowork)
 │ 1. lê o enunciado e o repositório Avalia2026-2 (iniciar.mjs, validar-local.mjs)
 │ 2. gera o esqueleto (node iniciar.mjs ... --offline) e escreve docs/SPEC.md,
 │    migrations/0001_init.sql e as 3 skills
 │
 ├──► Agente 1: Backend ───┐   executados em PARALELO,
 ├──► Agente 2: Frontend ──┘   ambos presos ao mesmo SPEC
 │
 ├──► Agente 3: Teste e Validação (depois dos dois; testa o sistema integrado)
 │
 └── 3. revisa relatórios, aplica ajustes finais, escreve README/AGENTS e entrega
```

Isolamento de escrita: o Agente 1 só podia escrever em `functions/`, o Agente 2 só em `public/` e o Agente 3 só em `tests/` (com permissão de corrigir defeitos registrando no relatório). Isso evitou conflitos entre agentes rodando ao mesmo tempo.

## 3. Agentes criados (3 agentes + orquestrador)

### Agente 1: Backend Serverless (Cloudflare Functions + D1 + Discord OAuth2)

- **Definição:** [`agents/agente-1-backend.md`](./agents/agente-1-backend.md)
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Escopo de escrita:** `functions/`
- **Entregas:**
  - `functions/_lib/`: `http.js` (respostas, erros, checagem de Origin), `session.js` (token aleatório, SHA-256 no D1, cookie HttpOnly), `polls.js` (validação e cálculo de percentuais como funções puras).
  - OAuth2 do Discord com `state` anti-CSRF: `/api/auth/discord` e `/api/auth/discord/callback`, importando `user_id`, nome e avatar para a tabela `users`.
  - Regras do escrutínio no servidor: prazo checado com o relógio do servidor, `INSERT` condicional ao prazo, `UNIQUE(poll_id, user_id)` no D1 e conversão de violação em `409 voto_duplicado`.
- **Verificação própria:** `node --check` em todos os arquivos e teste de fumaça das rotas com D1 simulado.

### Agente 2: Interface Web Vanilla (HTML5, CSS3 e DOM)

- **Definição:** [`agents/agente-2-frontend.md`](./agents/agente-2-frontend.md)
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Escopo de escrita:** `public/`
- **Entregas:**
  - SPA sem framework com roteamento por hash (`#/`, `#/nova`, `#/enquete/:id`) e ES modules (`app.js`, `js/api.js`, `js/dom.js`, `js/views.js`).
  - Cabeçalho com avatar e nome do Discord, formulário com opções dinâmicas (2 a 10) e barras horizontais proporcionais ao percentual de cada opção, com `role="meter"`.
  - Nenhum `innerHTML` com dados dinâmicos (helper `h()` com `textContent`), modo escuro, layout mobile-first e rodapé com a chave.
- **Verificação própria:** servidor mock fora do projeto e screenshots Playwright em 375px e 1280px, usados para corrigir espaçamentos.

### Agente 3: Teste, Auditoria de Segurança e Validação (obrigatório)

- **Definição:** [`agents/agente-3-teste-validacao.md`](./agents/agente-3-teste-validacao.md)
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Escopo de escrita:** `tests/`
- **Entregas:**
  - [`tests/unit.test.mjs`](./tests/unit.test.mjs): 19 testes de validação de entrada e percentuais.
  - [`tests/api.test.mjs`](./tests/api.test.mjs): 38 testes contra `wrangler pages dev` com D1 local (401, 400, 403 de prazo, 409 de voto duplicado, 5 votos simultâneos, `user_id` forjado no corpo ignorado, Origin estranho, sessão expirada, OAuth com `state` inválido).
  - [`tests/e2e.mjs`](./tests/e2e.mjs): 16 verificações no Chromium (login, criar, votar, barras, XSS no título, rodapé com a chave).
  - Execução do `validar-local.mjs` oficial e o relatório [`tests/RELATORIO-VALIDACAO.md`](./tests/RELATORIO-VALIDACAO.md).
- **Resultado:** todos os testes verdes, nenhum defeito de produção encontrado. Pontos que só podem ser testados após o deploy (login real no Discord) estão listados no relatório.

### Orquestrador (sessão principal)

Não é contado entre os 3 agentes obrigatórios. Escreveu o contrato, o esquema e as skills, disparou os agentes, revisou os relatórios e fez um ajuste pós-teste (fallback de avatar no frontend quando a imagem do Discord falha, apontado pelo Agente 3).

## 4. Lições do uso de agentes

- **Contrato antes do código:** com o `SPEC.md` fixo, backend e frontend rodaram em paralelo sem se ver, e a integração funcionou na primeira execução do Agente 3.
- **Divergências que o contrato não cobria:** o Agente 2 supôs nomes de erro do OAuth (`?erro=`) que o Agente 1 definiu de outro jeito em parte. A interface tem mensagem genérica para códigos desconhecidos, então não quebrou, mas o SPEC deveria listar esses códigos.
- **Limite do teste local:** o D1 local executa consultas em série, então o teste de votos simultâneos não prova a corrida; a garantia real é a restrição `UNIQUE` do banco, verificada por leitura de código.
