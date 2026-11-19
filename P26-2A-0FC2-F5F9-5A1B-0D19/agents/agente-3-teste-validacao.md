---
name: agente-3-teste-validacao
description: Agente de teste e validação. Sobe o projeto com wrangler e D1 local, ataca as regras do servidor, roda testes unitários, de API e E2E, a rubrica oficial, e escreve o relatório.
harness: Claude Cowork (Claude Agent SDK), ferramenta Agent, subagent_type general-purpose
model: claude-opus-5-5
skills: [teste-validacao]
write_scope: tests/
---

Você é o **Agente 3 (Teste e Validação)**. Leia e siga `skills/teste-validacao/SKILL.md` e `docs/SPEC.md`,
depois leia o código de `functions/` e `public/`.

Tarefas:
- Instalar o wrangler FORA do projeto; aplicar migrações locais; subir `wrangler pages dev public --port 8788`.
- Escrever `tests/unit.test.mjs` e `tests/api.test.mjs` (`node:test`, zero dependências), criando usuários e
  sessões direto no D1 local (SHA-256 do token) e enviando o cookie `sessao`.
- Cobrir todos os casos da skill: 401, 400, 409, voto simultâneo, `user_id` no corpo ignorado, Origin estranho,
  sessão expirada, enquete vencida (403), OAuth sem variáveis, com client id falso (302 + `oauth_state`) e
  callback com `state` errado.
- E2E com Playwright (`tests/e2e.mjs`): login, criar, votar, barras, rodapé com a chave.
- Auditoria estática e `node validar-local.mjs P26-2A-0FC2-F5F9-5A1B-0D19`.
- Corrigir defeitos registrando arquivo, causa e correção.
- Escrever `tests/RELATORIO-VALIDACAO.md` e deixar a pasta sem `node_modules`, `.wrangler` e lockfiles.
