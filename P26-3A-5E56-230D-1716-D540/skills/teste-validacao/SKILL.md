---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação — testes unitários das validações, testes de API ponta a ponta contra o app rodando localmente (com D1 local e sessões semeadas), testes de regra de negócio e de ataque, e conferência da rubrica com validar-local.mjs. Usar antes de cada deploy e antes do Pull Request.
---

# Skill: Teste e Validação

O agente de teste **não confia** no que os outros agentes disseram: roda tudo e reporta o resultado
real (comando + saída). Teste que falha é reportado com o motivo; nunca é "ajustado" para passar
escondendo um defeito do código.

## Ferramentas
- `node --test` (nativo, zero dependências). Arquivos em `tests/*.test.mjs`.
- App local: `npx wrangler d1 migrations apply DB --local` + `npx wrangler pages dev --port 8788`.
- Login nos testes: **sem porta dos fundos no código**. O teste semeia usuários e sessões direto no D1
  local (`npx wrangler d1 execute DB --local --command "INSERT ..."`) com o SHA-256 de tokens
  conhecidos, e manda o cookie `sessao=<token>`. Isso só existe no banco local.

## Camadas
1. **Unitário** (`tests/validacao.test.mjs`): importa `functions/_lib/validacao.js` e cobre limites
   (2/3 e 80/81 chars, data futura, data > 1 ano, categoria inválida, caracteres de controle).
2. **API ponta a ponta** (`tests/api.test.mjs`, precisa de `BASE_URL`, padrão `http://localhost:8788`):
   - sem sessão: `POST /api/itens` → 401; `GET /api/me` → `usuario: null`;
   - cria item válido (201) e inválido (400); `Origin` estranho → 403; sem JSON → 415;
   - filtros cruzados: `tipo+categoria+q` retornam só o que bate; filtro inválido → 400;
   - reivindicar o próprio item → 403; reivindicar 2× → 409; outro usuário reivindica → 201;
   - não-autor tenta aceitar → 403; autor aceita → item `em_devolucao`; nova reivindicação → 409;
   - contatos visíveis às duas partes e **invisíveis** a um terceiro;
   - encerrar → item `encerrado`, reivindicação `concluida`; sai da lista padrão e aparece com `status=todos`;
   - SQL injection na busca não quebra nem vaza (200 com 0 itens ou 400);
   - limite de 10 itens/hora → 11º devolve 429.
3. **Fumaça em produção** (somente leitura): `/`, `/api/status`, `/api/itens`, cabeçalhos de segurança,
   redirect do `/api/auth/discord`. **Não** criar dados de teste em produção.
4. **Rubrica**: na raiz do repositório, `node validar-local.mjs P26-3A-5E56-230D-1716-D540` — os 9 itens ✅.
5. **Escopo do PR**: `git diff --name-only upstream/main...HEAD` só lista arquivos dentro de `P26-3A-5E56-230D-1716-D540/`.

## Saída
`docs/RELATORIO-TESTES.md` com data, comando, total passou/falhou e falhas encontradas (e se foram corrigidas).
