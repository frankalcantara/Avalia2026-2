---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.

## Convenções deste projeto (Shared To-Do)
4. A sessão é o cookie `sessao`, assinado com HMAC-SHA256 usando `SESSION_SECRET`. Nunca confiar em cookie sem assinatura.
5. Toda rota (exceto as de `auth/` e `status`) chama `autenticar()` de `lib/util.js` primeiro e depois `ehMembro()` antes de tocar numa lista.
6. Quem não é membro recebe **404**, não 403, para não revelar que a lista existe.
7. O responsável de uma tarefa precisa ser membro da mesma lista. Subtarefa só sob tarefa da mesma lista e com um único nível.
8. Mutações (POST, PATCH, DELETE) exigem `Origin` igual à origem do site.
9. O fluxo OAuth usa `state` aleatório em cookie e confere no callback.
10. Mudanças de esquema entram como nova migração numerada em `migrations/`; nunca editar a anterior.
11. Segredos (`DISCORD_CLIENT_SECRET`, `SESSION_SECRET`) vivem só nas variáveis do Cloudflare, nunca no repositório.
