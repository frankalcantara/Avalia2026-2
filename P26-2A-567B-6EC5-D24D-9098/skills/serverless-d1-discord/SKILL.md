Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

Regras Obrigatórias

1. Validação na Borda: Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (functions/api/*).
2. Queries Parametrizadas no D1: Sempre utilizar env.DB.prepare("...").bind(...) para prevenir SQL Injection.
3. Sessão Discord OAuth2: Importar e validar user_id, username e avatar via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie HttpOnly.

Migrations no D1 (Bookmark Manager)

1. Cada mudança é um novo arquivo em migrations/ com número sequencial (ex: 0002_bookmarks.sql). Não edite migrations já aplicadas (a 0001_init.sql veio do script oficial).
2. SQLite: CREATE TABLE IF NOT EXISTS, PRIMARY KEY, FOREIGN KEY ... ON DELETE CASCADE, CHECK(...) para valores permitidos, UNIQUE quando necessário.
3. Status de leitura restrito por CHECK a: 'Para Ler', 'Lendo', 'Concluído'.
4. Índices para as consultas de filtro (user_id, collection_id, status) e para public_slug.
5. Aplicar: npx wrangler d1 migrations apply DB --local e --remote (no PowerShell do Windows, npx.cmd).
6. Nunca guardar segredos no banco.

Login Discord (rotas)

- /api/auth/discord: gera state aleatório, guarda em cookie e redireciona para a autorização do Discord (escopo identify).
- /api/auth/discord/callback: valida o state, troca o code por token, busca GET https://discord.com/api/users/@me, faz UPSERT em users (id, username, avatar), cria a sessão e redireciona para a página inicial.
- GET /api/auth/me (usuário logado ou 401) e POST /api/auth/logout (apaga a sessão e o cookie).
- Segredos em DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET (variáveis de ambiente), nunca no código.
- O redirect_uri deve ser idêntico ao cadastrado no Discord Developer Portal.
- Sessão: id aleatório via crypto.getRandomValues, gravado em sessions com expiração; cookie HttpOnly; Secure; SameSite=Lax; Path=/.
- Helper getUser(request, env) em functions/_lib/: lê o cookie, consulta sessions + users, valida a expiração, devolve o usuário ou null.
- Avatar: https://cdn.discordapp.com/avatars/{id}/{avatar}.png, com imagem padrão quando for nulo.

Checklist de validação da API

1. Rota protegida chama getUser(); sem sessão → 401.
2. Toda consulta filtra pelo user_id da sessão; recurso de outro usuário → 403 ou 404. Nunca confiar em user_id do corpo.
3. url: obrigatória, validada com new URL(), só http: ou https:, máximo 2048 caracteres.
4. title 1 a 200; summary até 1000; nome de coleção 1 a 80.
5. status só 'Para Ler', 'Lendo' ou 'Concluído'; outro valor → 400.
6. collection_id deve existir e pertencer ao usuário.
7. JSON inválido → 400; método não suportado → 405.
8. Respostas em JSON com status HTTP correto; sem vazar stack trace.
9. /api/public/:slug: somente leitura, só coleções com is_public = 1, expõe apenas username e avatar do dono.
10. GET /api/links?collection_id=&status=: parâmetros opcionais e combináveis; valores inválidos → 400.

Exemplo curto

Entrada {"url":"javascript:alert(1)","title":"x"} → 400 {"error":"URL inválida"}.