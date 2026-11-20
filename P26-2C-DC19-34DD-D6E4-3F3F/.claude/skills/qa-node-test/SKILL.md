---
name: qa-node-test
description: Como validar as Cloudflare Functions com node:test e um shim de D1 sobre node:sqlite, cobrindo permissões, validação e o fluxo de Solução Aceita.
---

# QA com `node --test`

## Ambiente
- Node 22+. `node:sqlite` (`DatabaseSync`) em memória substitui o D1 nos testes.
- Shim em `tests/helpers/d1-shim.mjs` expondo `prepare(sql).bind(...)` com `first()`, `all()`, `run()` (retornando `meta.changes` e `meta.last_row_id`) e `batch()`.
- O esquema vem de `migrations/0001_init.sql`, aplicado com `exec`.
- As Functions são importadas direto (`import { onRequestPost } from "../functions/..."`) e chamadas com `new Request(...)` e `env = { DB, DISCORD_CLIENT_ID, ... }`.
- `fetch` global é trocado por um mock para o Discord; restaurar no `afterEach`.

## Casos obrigatórios
1. Sem sessão: criar tópico, responder e aceitar devolvem 401.
2. Validação: título curto/longo, corpo curto, JSON inválido, `Content-Type` errado, `Origin` de outro host.
3. Autor não responde o próprio tópico (403). Tópico resolvido não recebe resposta (409).
4. **Aceitar solução**: usuário que não é o autor recebe 403 e nada muda no banco; autor consegue (200), `status='resolved'`, `accepted_answer_id` correto, `resolved_at` preenchido.
5. `answer_id` de outro tópico ou inexistente: 422, sem alteração.
6. Trocar a resposta aceita funciona e mantém uma única aceita.
7. Detalhe do tópico lista a aceita primeiro e `viewer.can_accept` só é verdadeiro para o autor.
8. OAuth: `state` inválido redireciona com `erro=estado_invalido`; fluxo feliz cria usuário (user_id, nome, avatar) e sessão; logout invalida a sessão.
9. Injeção: título com `'; DROP TABLE topics; --` é gravado como texto e a tabela continua existindo.
10. Busca com `%` e `_` não vira curinga.

## Relato
Rodar `node --test tests/` e entregar: total de testes, falhas, e lista de bugs encontrados com arquivo e linha. Bugs de código de produção são **relatados**, não corrigidos pelo agente de teste.
