---
name: teste-validacao
description: Protocolo do agente de teste e validação — testa a API e as regras de negócio contra um D1 local real, procura falhas de segurança e confere a rubrica de entrega. Usar antes de cada entrega/PR.
---

# Skill: Teste e Validação

Usada pelo **Agente 3 (Teste e Validação)** do projeto #34 — `P26-2B-DEE2-E5F5-044F-D681`. Este agente **não escreveu o código** que testa.

## Ambiente
1. `npx wrangler d1 migrations apply DB --local`
2. `.dev.vars` com `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` falsos.
3. `npx wrangler pages dev --port 8788`
4. Como o Discord real não é acessível em teste automatizado, criar usuários e sessões direto no D1 local com `tests/seed-local.sql` e mandar o cookie `sid` correspondente.

## O que verificar (todos com asserção automática em `tests/api.test.mjs`)
1. **Autenticação:** escrita sem cookie → 401; cookie inválido/expirado → 401; `/api/auth/discord` redireciona com `state` e cookie HttpOnly; callback com `state` errado é rejeitado.
2. **Validação de item:** tipo/categoria fora da lista, título/descrição curtos ou longos, data futura ou inválida → 400 com `details` por campo.
3. **CSRF/entrada:** POST sem `application/json` → 415; `Origin` de outro site → 403; JSON malformado → 400.
4. **Reivindicação:** não pode reivindicar o próprio item (403); duplicada (409); em item não aberto (409); grava o contato do Discord das duas partes.
5. **Máquina de estados:** só o dono aceita/recusa; só o reivindicante cancela; concluir encerra o item e recusa as pendentes; transições inválidas → 409; terceiros → 403.
6. **XSS:** texto com `<script>` é salvo como texto e o front usa `textContent`.
7. **SQL injection:** parâmetros com aspas/`%` não quebram a consulta.
8. **Rubrica:** `node validar-local.mjs P26-2B-DEE2-E5F5-044F-D681` na raiz do repositório; sem frameworks proibidos; chave no README e no `<footer>`; LICENSE MIT.

## Saída
Registrar o resultado em `tests/RELATORIO.md` (data, comandos, total de testes, falhas encontradas e como foram corrigidas).
