# Skill: cloudflare-deploy

1. Autenticar no Wrangler, criar o D1 e substituir o placeholder de `database_id`.
2. Aplicar `schema.sql` no banco remoto e configurar o binding `DB` no Pages.
3. Configurar `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` como secrets do projeto.
4. Registrar no Discord a URL publicada seguida de `/api/callback`.
5. Publicar `public` com o nome do projeto esperado e testar as rotas na URL HTTPS.
6. Nunca incluir secrets em arquivos versionados, comandos registrados ou documentação compartilhada.
7. Se não houver acesso ao terminal, configurar bindings, D1 e secrets pelo painel Cloudflare.
