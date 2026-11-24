---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord. Armazenar as sessões na tabela `sessoes` do D1 e enviar no cookie `HttpOnly` apenas um token de sessão aleatório; nunca serializar dados do usuário em base64 no cookie.
4. **Proteção OAuth2:** Gerar e validar o parâmetro `state` no fluxo OAuth2 do Discord antes de aceitar o callback.
5. **Isolamento dos cartões:** Em toda consulta `SELECT`, `UPDATE` ou `DELETE` de cartão, incluir `AND user_id = ?` e fornecer por `.bind()` o `user_id` obtido da sessão validada. Nunca usar o `user_id` recebido do cliente para autorizar uma operação. Em inserções, definir o proprietário com o `user_id` da sessão, também por parâmetros `.bind()`.
6. **Rotas da API:** Implementar `GET` e `DELETE /api/sessao`, `GET` e `POST /api/cartoes`, além de `PATCH` e `DELETE /api/cartoes/:id`. Proteger as rotas de cartões com a sessão validada no servidor.
