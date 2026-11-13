---
name: serverless-d1-discord
description: Diretrizes para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless — Cloudflare Functions + D1 + Discord OAuth2

## Regras obrigatórias

1. **Autoridade no servidor:** toda regra de negócio (prazo, duplicidade de voto, propriedade da opção, autenticação) deve ser validada nas Cloudflare Pages Functions em `functions/api/*`. O cliente nunca é fonte de verdade.
2. **Queries parametrizadas:** sempre usar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection. Nunca interpolar dados de entrada em SQL.
3. **Sessão Discord OAuth2:** importar `user_id`, `username` e `avatar` de `https://discord.com/api/users/@me` após trocar o `code` por token. Persistir o usuário no D1.
4. **Cookie de sessão assinado:** emitir cookie `HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS, com payload assinado em HMAC-SHA-256 (`env.SESSION_SECRET` ou `env.DISCORD_CLIENT_SECRET`). Nunca confiar em cookie apenas codificado em base64.
5. **State anti-CSRF:** gerar `state` aleatório no início do OAuth2, gravá-lo em cookie `HttpOnly` de curta duração e compará-lo no callback.
6. **Integridade no banco:** garantir `UNIQUE (poll_id, user_id)` na tabela `votes` como última barreira contra duplicidade em requisições concorrentes.
7. **Schema versionado:** manter as tabelas em `migrations/*.sql`; o código pode criar o schema de forma defensiva, mas a migração é a fonte oficial.
8. **Respostas explícitas:** devolver códigos HTTP adequados (`400`, `401`, `403`, `404`, `409`, `503`) e JSON com `ok` e `error`.

## Contratos esperados

- `GET /api/auth/discord` → redireciona ao Discord com `state`.
- `GET /api/auth/discord/callback` → troca `code`, importa perfil, grava no D1, emite sessão.
- `GET /api/me` → usuário autenticado ou `null`.
- `GET /api/polls` → enquetes com opções, votos, percentuais e voto do usuário.
- `POST /api/polls` → cria enquete autenticada (2 a 10 opções, prazo futuro).
- `POST /api/vote` → registra voto, bloqueando enquete encerrada e voto duplicado.

## Anti-padrões proibidos

- Confiar em `userId` enviado pelo corpo da requisição.
- Verificar prazo ou duplicidade apenas no JavaScript do cliente.
- Guardar token do Discord em `localStorage`.
- Concatenar SQL com entrada do usuário.
- Retornar `200` para erros de validação.
