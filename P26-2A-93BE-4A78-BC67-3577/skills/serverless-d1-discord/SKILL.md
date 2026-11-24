---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.
4. **Segredos fora do Git:** `DISCORD_CLIENT_SECRET` só em `.dev.vars` (local) e em variáveis do Cloudflare Pages (produção); `.dev.vars` e `.wrangler/` ficam no `.gitignore`.
5. **Identidade só pela sessão:** o cliente nunca informa quem é; a função lê o cookie `session` e consulta a tabela `sessions` no D1. Cookie `HttpOnly`, `SameSite=Lax`, `Secure`; `state` anti-CSRF no login.
6. **Ocultar o adversário:** a posição da frota do computador nunca é selecionada nas respostas da API; o tiro responde só `agua`, `acerto` ou `afundado`.
7. **Atomicidade:** gravações de um tiro (tiro do jogador, resposta do computador, fim de partida e placar) vão em um único `env.DB.batch`, com `UNIQUE` contra tiro repetido.
8. **Migrações versionadas** em `migrations/` e aplicadas com `wrangler d1 migrations apply DB` (`--remote` em produção).
