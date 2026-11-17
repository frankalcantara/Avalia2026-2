---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas por HMAC-SHA-256 em cookie `HttpOnly; Secure; SameSite=Lax`. Validar `state` aleatório e de uso único no callback.
4. **Persistência:** Aplicar o schema com migrações D1. Não criar tabelas nem aceitar dados de usuário dentro dos handlers de requisição.
5. **Validação:** Rejeitar payloads fora do formato, tamanho e limites do domínio; autenticar toda mutação e derivar o autor exclusivamente da sessão validada. Usar respostas JSON explícitas e status HTTP adequados.

## Contrato de API
- `GET /api/auth/me` retorna `{ "user": null | { "userId", "username", "avatar" } }`.
- `POST /api/auth/logout` encerra a sessão.
- `GET /api/auth/discord` inicia o OAuth; o callback é `/api/auth/discord/callback`.
- `GET /api/recipes?q=&ingredient=&maxTime=` lista/pesquisa receitas; `POST /api/recipes` cria uma receita autenticada.
- `GET /api/favorites` lista favoritos; `POST /api/favorites/:recipeId` e `DELETE /api/favorites/:recipeId` alteram favoritos autenticados.

Receitas mantêm ingredientes em linhas normalizadas com nome, quantidade numérica e unidade, além de etapas numeradas para preservar sua sequência. Pesquisa de ingrediente/nome e limite de tempo são executados no D1, não no cliente.

## Configuração de ambiente
Vincular o banco como `DB` e configurar `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` (segredo aleatório de pelo menos 32 caracteres) como variáveis/secrets do Pages. `DISCORD_REDIRECT_URI` é opcional; por padrão usa a URL da origem em `/api/auth/discord/callback`. Substituir no `wrangler.jsonc` o `database_id` de exemplo pelo ID fornecido pelo Cloudflare. Nunca armazenar credenciais em código ou no arquivo de configuração.
