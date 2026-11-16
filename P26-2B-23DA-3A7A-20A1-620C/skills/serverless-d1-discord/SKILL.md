---
name: serverless-d1-discord
description: Padrões para Cloudflare Pages Functions com D1 e Discord OAuth2, com validação de regras de negócio no servidor e sessão por token com hash.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras obrigatórias
1. **Validação na borda:** toda regra de negócio, contador, cronômetro e permissão executa em `functions/api/*`. O navegador nunca decide resultado.
2. **Queries parametrizadas:** sempre `env.DB.prepare("...").bind(...)`. Nunca concatenar entrada do usuário em SQL.
3. **OAuth2 com `state`:** gerar `state` aleatório, guardá-lo em cookie `HttpOnly` de curta duração e conferi-lo no callback antes de trocar o `code`.
4. **Sessão por token opaco:** gerar token aleatório de 32 bytes, gravar no D1 apenas o hash SHA-256 (`sessions.token_hash`) e enviar o token em cookie `HttpOnly; SameSite=Lax` (`Secure` em HTTPS). Nunca colocar dados do usuário no cookie.
5. **Identidade vem da sessão:** `user_id` é lido da sessão no D1. Nunca aceitar `userId` vindo do corpo da requisição.
6. **Autoria:** toda consulta a dados de partida filtra por `user_id` da sessão.
7. **Estado secreto no servidor:** `pair_key` e o conteúdo de cartas ocultas nunca saem do servidor. O frontend recebe apenas IDs opacos.
8. **Aleatoriedade criptográfica:** embaralhar com `crypto.getRandomValues` (Fisher-Yates com rejection sampling). Proibido `Math.random`.
9. **Atomicidade:** limites de turno aplicados no próprio `UPDATE` condicional; operações compostas em `env.DB.batch`.
10. **Segredos:** `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` ficam em `.dev.vars` (ignorado pelo Git) e em secrets do Pages. Nunca versionar.
11. **Códigos HTTP:** `400` entrada inválida, `401` sem sessão, `404` recurso inexistente ou de outro usuário, `409` jogada fora de regra.
12. **Migrations:** mudanças de esquema só por arquivo numerado em `migrations/`, aplicado primeiro com `--local` e depois `--remote`.