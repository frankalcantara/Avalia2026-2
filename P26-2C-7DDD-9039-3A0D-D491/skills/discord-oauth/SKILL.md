# Skill: discord-oauth

- O login redireciona ao Discord com `response_type=code`, escopo `identify`, redirect URI da aplicação e `state` aleatório.
- O callback compara o `state` retornado com o cookie temporário, troca o código por token e consulta `/api/users/@me`.
- Salvar ID, nome de usuário e avatar no D1; a sessão assinada guarda o `user_id` e expiração.
- Cookies da sessão e do state devem ser `HttpOnly`, `Secure` e `SameSite=Lax`.
- Rotas financeiras usam o ID autenticado da sessão, nunca o ID informado pelo navegador.
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` devem ser configurados como segredos no Cloudflare e nunca versionados.
- Redirect URI deve ser exatamente `https://SEU-DOMINIO/api/callback`.
