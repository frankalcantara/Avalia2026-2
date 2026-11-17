---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.

## Regras Complementares (Projeto #20)
4. **Assinatura real:** o cookie de sessão é `payload.assinatura` com HMAC-SHA256 (Web Crypto) e expiração (`exp`). Cookie sem assinatura válida equivale a não autenticado (`401`).
5. **Parâmetro `state`:** gerado aleatoriamente em `/api/auth/discord`, guardado em cookie `HttpOnly` e conferido em `/callback` antes de trocar o `code`.
6. **Login exclusivo via Discord:** não criar rotas de demonstração ou bypass de autenticação.
7. **Identidade só da sessão:** `user_id` e `username` nunca são lidos do corpo da requisição.
8. **Teto por categoria atômico:** gravar com um único `INSERT ... SELECT ... WHERE (soma atual + novas horas) <= teto` e verificar `meta.changes`; resposta `409` quando excedido.
9. **Códigos HTTP:** `400` payload inválido, `401` sem sessão, `403` origem não permitida, `404` recurso de outro usuário/inexistente, `409` regra de negócio violada.
