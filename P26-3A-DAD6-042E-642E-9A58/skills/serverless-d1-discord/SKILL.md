---
name: serverless-d1-discord
description: Escrever Cloudflare Pages Functions com persistência no D1 e login Discord OAuth2 seguro, validando todas as regras de negócio no servidor. Usar ao criar ou alterar qualquer arquivo em functions/ ou migrations/.
---

# Skill: Serverless, D1 e Discord OAuth2

## Quando usar
Sempre que for criar ou alterar rotas em `functions/`, o esquema em
`migrations/` ou o fluxo de login.

## Fonte da verdade
- Rotas, formatos e códigos de erro: `docs/contrato-api.md`. Não invente rota
  nem campo fora dele; se precisar mudar, mude o contrato primeiro.
- Esquema: `migrations/0001_init.sql`.

## Regras obrigatórias
1. **Pages Functions puras**: só APIs Web do runtime (`fetch`, `crypto.subtle`,
   `crypto.getRandomValues`, `URL`, `Response`). Sem pacotes npm.
   Arquivos auxiliares ficam em `functions/_shared/` (prefixo `_` não vira rota).
2. **SQL sempre parametrizado**: `env.DB.prepare("… ?1 …").bind(valor)`.
   Nunca concatenar entrada do usuário em SQL.
3. **Atomicidade**: decisão de vaga e inserção na mesma instrução SQL;
   cancelamento + promoção do primeiro da fila no mesmo `env.DB.batch([...])`.
   Nunca "ler a contagem em JS e depois inserir" (condição de corrida).
4. **Nunca confiar no cliente**: validar tipo, tamanho, formato de data/hora,
   data não passada (fuso `America/Sao_Paulo`) e capacidade inteira.
   O cliente nunca envia `status`, `user_id` nem `creator_id`: vêm da sessão.
5. **OAuth2 Discord** (escopo `identify`):
   - `state` aleatório de 32 bytes, guardado como SHA-256 no D1 e amarrado ao
     cookie `__Host-oauth-tx`; uso único (apagar antes de trocar o código).
   - Client Secret só em `env.DISCORD_CLIENT_SECRET`; nunca no código, no log
     ou na resposta.
   - Importar `id`, `username`, `global_name` e `avatar` de `/users/@me`.
   - Revogar o access token depois de ler o perfil; o navegador só recebe o
     cookie de sessão opaco.
6. **Sessão**: cookie `__Host-session` `HttpOnly; Secure; SameSite=Lax; Path=/`,
   D1 guarda só o resumo SHA-256. Rotas que mudam estado exigem `Origin` igual a
   `PUBLIC_BASE_URL`.
7. **Respostas**: JSON com `Cache-Control: no-store` e erros
   `{ error, message }` em português. Logs só com códigos internos, nunca com
   tokens, códigos de autorização ou cookies.
8. **Método errado** responde 405 com cabeçalho `Allow`.

## Checklist antes de entregar
- [ ] Todas as rotas do contrato existem e respondem os status documentados.
- [ ] `grep -rn "DISCORD_CLIENT_SECRET" functions/` só aparece lendo `env`.
- [ ] Nenhum `import` de pacote externo.
- [ ] Toda query usa `bind`.
