---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.
## Padrões aplicados neste projeto
- Sessão em cookie assinado com HMAC-SHA256 (`discord_session` e `discord_session_sig`), validada em `functions/_lib/session.js`.
- A decisão entre `confirmed` e `waitlist` é feita em uma única instrução SQL no D1, comparando a lotação atual com a capacidade do evento.
- O cancelamento remove a inscrição e promove o primeiro da fila em `env.DB.batch([...])`.