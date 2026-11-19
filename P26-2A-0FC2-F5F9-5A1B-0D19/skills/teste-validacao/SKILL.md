---
name: teste-validacao
description: Protocolo do agente de teste e validação. Executa o projeto localmente (wrangler pages dev + D1 local), ataca as regras do servidor, roda testes automatizados e a rubrica de entrega. Usar antes de cada commit de entrega.
---

# Skill: Teste, Auditoria e Validação

Usada pelo **Agente 3 (Teste e Validação)**. Este agente **não escreve código de produção**: ele testa, reporta defeitos ao agente responsável e só corrige se o defeito for trivial e documentado no relatório.

## Ambiente de teste

```bash
npm install --no-save wrangler                      # apenas para teste, nada vai para public/
npx wrangler d1 migrations apply DB --local
npx wrangler pages dev public --port 8788
```

Como o OAuth2 real do Discord não roda localmente, os testes **criam usuários e sessões direto no D1 local** (gravando o SHA-256 do token) e enviam o cookie `sessao`. Isso testa a mesma lógica de sessão usada em produção, sem nenhuma porta dos fundos no código.

## Suítes obrigatórias

1. **Unitários** (`tests/unit.test.mjs`, `node --test`): `validatePollInput` e `buildResults` com casos de limite (título curto, 1 opção, 11 opções, opções repetidas, prazo no passado, percentuais somando ~100).
2. **Integração da API** (`tests/api.test.mjs`, `node --test`, contra `http://localhost:8788`):
   - sem cookie em `/api/polls` → 401
   - criar enquete válida → 201; inválida → 400
   - detalhe antes de votar → `results === null`
   - votar → 201 com barras; votar de novo → **409**
   - duas requisições de voto simultâneas do mesmo usuário → exatamente uma 201
   - opção de outra enquete → 400
   - enquete com prazo vencido (ajustada no D1) → **403** e resultados visíveis
   - `user_id` enviado no corpo é ignorado (voto conta para o dono da sessão)
   - POST com `Origin` estranho → 403
   - sessão expirada → 401
3. **Estáticos:** nenhum framework proibido, nenhum `innerHTML` com dados dinâmicos, nenhum SQL concatenado em `functions/`, chave no `<footer>` do `public/index.html`.
4. **Rubrica:** `node validar-local.mjs P26-2A-0FC2-F5F9-5A1B-0D19` na raiz do fork.

## Relatório

Gravar `tests/RELATORIO-VALIDACAO.md` com: data, comandos executados, resultado de cada caso (passou/falhou), defeitos encontrados, quem corrigiu e evidência da reexecução.
