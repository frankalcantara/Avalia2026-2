---
name: serverless-d1-discord
description: Padrões para Cloudflare Pages Functions com Cloudflare D1 e login Discord OAuth2 (user_id, nome e avatar), com validação no servidor.
---

# Skill: Serverless com Cloudflare Functions, D1 e Discord OAuth2

## Regras obrigatórias
1. **Validação no servidor:** tipo, valor, categoria, data e tamanho dos textos são validados em `functions/` (`validateTransaction` em `functions/_lib.js`). O cliente nunca é a única barreira.
2. **Consultas parametrizadas:** sempre `env.DB.prepare("...").bind(...)`, sem concatenar dados do usuário no SQL.
3. **Dono dos dados:** toda consulta de transações filtra por `user_id` da sessão (`WHERE id = ? AND user_id = ?`); acesso a dado de outro usuário responde 404.
4. **OAuth2 do Discord:** escopo `identify`; parâmetro `state` aleatório em cookie para evitar CSRF; importar `id`, `username`/`global_name` e `avatar`.
5. **Sessão:** token aleatório de 256 bits em cookie `HttpOnly`, `SameSite=Lax` e `Secure` (em HTTPS); no D1 fica só o hash SHA-256, com data de expiração.
6. **Mutações:** POST, PUT e DELETE rejeitam `Origin` diferente do site (403) e payload inválido (400); sem sessão responde 401.
7. **Dinheiro:** guardado em centavos inteiros, nunca em ponto flutuante.
8. **Segredos:** `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` ficam como secrets do Cloudflare, nunca no repositório.
