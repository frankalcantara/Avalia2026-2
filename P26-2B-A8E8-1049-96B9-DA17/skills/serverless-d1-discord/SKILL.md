---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.

## Padrões aplicados no Acervo (verificados em 2026-11-08)
Revisão do agente de backend contra as 3 regras: todas CUMPREM (14 de 14 testes passando na data da revisão; o estado atual, em 2026-11-19, é 42 de 42). Como cada regra foi atendida:

**Regra 1 (borda):**
- A lógica fica em `functions/api/*` e em `functions/_lib/*` (módulos de apoio que não exportam `onRequest*`, logo não viram rotas).
- Contrato de resposta único: `{ok:true,...}` ou `{ok:false,error,fields?}`; status usados: 400, 401, 403, 404, 405, 413, 415, 500.
- Dono-only: o `user_id` vem da sessão, nunca do corpo, e `UPDATE`/`DELETE` repetem `AND user_id = ?`.
- Feed e sorteio forçam `is_public = 1` no servidor; "minhas" filtra por `user_id`.
- Mutações com cookie checam `Origin` (`sameOriginOk`) além de `SameSite=Lax`.
- Qualquer `/api/*` sem rota devolve 404 JSON (`functions/api/[[path]].js`).
- Limites: corpo até 32 KB, `Content-Type: application/json`, texto 2000, autor 200, obra 300, reflexão 3000, página inteira de 0 a 999999.
- Respostas JSON levam `Cache-Control: no-store`, `X-Content-Type-Options: nosniff` e `Referrer-Policy`.

**Regra 2 (SQL):**
- Todo valor vindo do usuário passa por `.bind`. O único SQL montado por texto (`functions/_lib/list.js`) concatena apenas fragmentos fixos do servidor; cursor, limite e id são validados por regex antes de chegar ao SQL.

**Regra 3 (sessão Discord):**
- Fluxo com scope `identify`: `state` aleatório em cookie `HttpOnly` (path `/api/auth`, 10 min), comparado em tempo constante; erros viram `/?auth_error=<código>` sem detalhes.
- `user_id`, `username` e `avatar` são gravados em `discord_users` (upsert).
- Sessão assinada com HMAC-SHA256 (`SESSION_SECRET`), expira em 7 dias, em cookie `HttpOnly; SameSite=Lax` (+`Secure` em HTTPS).
- Segredos só em variáveis de ambiente (`.dev.vars` local ignorado pelo git; painel/`wrangler pages secret` em produção); o repositório traz apenas `.dev.vars.example` com os nomes.

**Limites conhecidos:** sem limitação de requisições (rate limit); requisição sem cabeçalho `Origin` passa pela checagem de origem; a tabela `project_records` vem do esquema inicial do modelo e não é usada.
