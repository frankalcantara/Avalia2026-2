---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.

## Regras do Projeto #15 (Shared To-Do)
4. **Sessão assinada:** o cookie `session` carrega `user_id` e expiração, assinado com HMAC-SHA256 (`crypto.subtle`) usando o segredo `SESSION_SECRET`. Cookie sem assinatura válida ou expirado = 401. Flags: `HttpOnly; Secure; SameSite=Lax; Path=/`.
5. **OAuth2 com `state`:** gerar `state` aleatório em cookie de curta duração e conferir no callback (proteção CSRF).
6. **Autorização por membro:** toda leitura ou escrita de lista/tarefa consulta `list_members`; quem não é membro recebe 403 (ou 404 para não revelar a lista).
7. **Integridade:** responsável (`assignee_id`) deve ser membro da lista; subtarefa (`parent_id`) deve existir na mesma lista; títulos com 1 a 200 caracteres após `trim`.
8. **Código de acesso:** gerado no servidor com `crypto.getRandomValues`, único, sem caracteres ambíguos.
9. **Erros:** respostas JSON `{ "error": "..." }` com 400/401/403/404/409; nunca expor stack ou SQL.
