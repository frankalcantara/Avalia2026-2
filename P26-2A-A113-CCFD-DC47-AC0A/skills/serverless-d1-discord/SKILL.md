---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** toda regra de negócio (pares, contagem de movimentos, eficiência) executa nas Pages Functions (`functions/api/*`). O cliente nunca decide o resultado.
2. **Queries Parametrizadas no D1:** sempre `env.DB.prepare("...").bind(...)`. Esquema só via `migrations/`, nunca `CREATE TABLE` em tempo de requisição.
3. **Sessão Discord OAuth2:** importar `user_id`, `username` e `avatar`; usar parâmetro `state` e cookie `HttpOnly; SameSite=Lax` **assinado com HMAC** (`SESSION_SECRET`). Cookie sem assinatura é inválido.
4. **Segredos fora do Git:** `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` ficam em `.dev.vars` (local) e nas variáveis do Cloudflare Pages.
5. **Dados opacos:** o servidor embaralha com `crypto.getRandomValues` e envia só tokens; face e `pair_id` ficam no D1.
6. **Concorrência:** usar `UPDATE ... WHERE` condicional e conferir `meta.changes` para rejeitar jogadas duplicadas (409).
7. **Códigos HTTP:** 400 payload inválido, 401 sem sessão, 403 origem inválida, 404 recurso inexistente ou de outro usuário, 409 estado incompatível.
