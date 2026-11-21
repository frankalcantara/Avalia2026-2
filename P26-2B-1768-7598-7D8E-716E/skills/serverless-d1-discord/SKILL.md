---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação ou verificação de permissão executa nas Cloudflare Pages Functions (`functions/api/*`). O cliente nunca decide nada.
2. **Queries Parametrizadas no D1:** Sempre `env.DB.prepare("... ? ...").bind(...)`. Nunca concatenar texto em SQL.
3. **Sessão Discord OAuth2:** Importar `user_id`, `username` e `avatar` pelo fluxo OAuth2. A sessão é um UUID aleatório guardado na tabela `sessions` do D1 e entregue em cookie `sid` com `HttpOnly; Secure; SameSite=Lax`, válido por 7 dias.
4. **Sem segredos no código:** usar `env.DISCORD_CLIENT_ID` e `env.DISCORD_CLIENT_SECRET`.

## Estrutura de rotas
- O arquivo define a rota: `functions/api/me.js` vira `/api/me`.
- Handlers por método: `onRequestGet`, `onRequestPost`.
- Código compartilhado em `functions/_lib/util.js`.

## Fluxo OAuth2
1. `/api/auth/login`: gera `state`, grava no cookie `oauth_state` (10 min) e redireciona para `https://discord.com/oauth2/authorize` com `scope=identify`.
2. `/api/auth/callback`: compara o `state` da URL com o cookie, troca o `code` por token, lê `https://discord.com/api/users/@me`, faz upsert em `users` e cria a sessão.
3. O `redirect_uri` precisa ser idêntico ao cadastrado no Discord Developer Portal.
4. `/api/auth/logout` apaga a linha da sessão e limpa o cookie.

## Banco D1 (binding `DB`)
- `users(discord_id, username, avatar, wins, losses)`
- `sessions(id, discord_id, expires_at)`
- `games(id, discord_id, status, player_fleet, enemy_fleet, player_shots, enemy_shots, created_at)`
- Gravações que andam juntas usam `env.DB.batch([...])`.

## Regras do jogo (no servidor)
- Frota: Porta-aviões 5, Encouraçado 4, Cruzador 3, Submarino 3, Destroyer 2.
- Posição válida: linhas e colunas de 0 a 9, sem sobreposição, cada navio uma vez, orientação "H" ou "V".
- Tiro válido: inteiros de 0 a 9, partida do dono e em andamento, célula ainda não atacada.
- Resposta do tiro: só `agua`, `acerto` ou `afundado` (com o nome do navio ao afundar).
- `enemy_fleet` nunca é enviada ao cliente durante a partida.

## Checklist antes de entregar
- [ ] Nenhuma rota confia em dados do cliente sem validar.
- [ ] Todas as queries usam `bind`.
- [ ] Nenhum segredo no repositório.
- [ ] Erros em JSON com campo `erro` e status correto (400, 401, 404, 409).