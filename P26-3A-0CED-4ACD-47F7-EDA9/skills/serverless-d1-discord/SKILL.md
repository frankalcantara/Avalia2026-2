---
name: serverless-d1-discord
description: Protocolo do Agente Arquiteto Serverless para construir as Cloudflare Pages Functions, o esquema D1, o login Discord OAuth2 e as regras de negócio do Cypher no servidor.
---

# Skill: Arquiteto Serverless (Cloudflare Pages Functions + D1 + Discord OAuth2)

## Quando usar
Ao criar ou alterar qualquer arquivo em `functions/`, `src/` (exceto `src/data/`) ou `migrations/`.

## Fonte da verdade
`docs/contrato-api.md`. Nenhuma rota, campo ou código de erro fora do contrato.

## Regras obrigatórias
1. **Servidor decide tudo.** O cliente só envia o chute; o servidor normaliza, valida no dicionário, calcula o feedback, grava e encerra a partida. Nada vindo do cliente é confiado (modo, data, chute e id são sempre validados).
2. **A resposta nunca sai do servidor** enquanto `status = playing`. Conferir todo `Response.json` que inclui estado de jogo.
3. **Sessão segura:** token aleatório de 32 bytes (`crypto.getRandomValues`), cookie `HttpOnly; Secure; SameSite=Lax`, e no D1 somente o SHA-256 do token. Sessão expirada é removida e tratada como `401`.
4. **OAuth2 com `state`** em cookie HttpOnly de curta duração, comparado no callback. `returnTo` aceita só caminhos relativos (`/x`), nunca `//` ou URLs absolutas.
5. **Datas:** sempre `America/Sao_Paulo` via `Intl.DateTimeFormat`. Recusar data futura (`403 future_date`) antes de qualquer acesso ao sorteio.
6. **SQL só com `prepare().bind()`.** Nunca concatenar entrada do usuário em SQL.
7. **Concorrência:** limite de tentativas protegido pela chave primária `(game_id, attempt_no)`; conflito vira `409`. Sorteio com `INSERT OR IGNORE` + releitura.
8. **Erros padronizados** `{ error, message }` com os códigos do contrato. Exceções inesperadas viram `500` sem vazar stack.
9. **Functions enxutas:** cada arquivo em `functions/` só faz roteamento + validação de entrada e chama `src/`. A lógica reutilizável fica em `src/` (sem estado global mutável entre requisições, exceto caches imutáveis como o dicionário).
10. Comentários curtos, neutros e técnicos, em português.

## Checklist antes de entregar
- [ ] Todas as rotas do contrato existem e respondem no formato documentado.
- [ ] `401` em toda rota protegida sem cookie ou com cookie forjado.
- [ ] Data futura, data antes do lançamento, modo inválido, chute inválido e chute após o limite são recusados.
- [ ] Streak e ranking ignoram partidas de arquivo (`is_archive = 1`).
- [ ] `migrations/0001_init.sql` cria todas as tabelas e índices do contrato e roda em D1 limpo.
- [ ] Nenhum segredo no código; tudo via `env`.
