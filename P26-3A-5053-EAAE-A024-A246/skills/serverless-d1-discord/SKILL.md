---
name: serverless-d1-discord
description: Backend serverless (Cloudflare Pages Functions + D1) e login Discord OAuth2 para a plataforma de empréstimo e troca de livros.
---

# Skill: Backend Cloudflare Functions + D1 + Discord OAuth2

## Regras obrigatórias
1. Toda regra de negócio e permissão é validada em `functions/api/*`, nunca só no cliente.
2. Queries sempre parametrizadas: `env.DB.prepare("...").bind(...)`.
3. Sessão em cookie `HttpOnly; SameSite=Lax` (e `Secure` em HTTPS), assinado com HMAC-SHA256 usando `SESSION_SECRET`, via `crypto.subtle`.
4. OAuth com `state` aleatório gravado em cookie e validado no callback.
5. `dono_id` e `solicitante_id` vêm SEMPRE da sessão, nunca do corpo da requisição.
6. Datas oficiais são geradas no servidor (`new Date()` / `CURRENT_TIMESTAMP`).
7. Schema só em `migrations/`. Nunca usar `CREATE TABLE` dentro de rotas. Não engolir erros com `catch {}` vazio.
8. Segredos só em `.dev.vars` (local) e variáveis/secrets da Cloudflare (produção).

## Modelo de dados
- `discord_users(user_id, username, global_name, avatar)`: `username` é o handle de contato.
- `livros(id, dono_id, titulo, autor, categoria, modalidade, status)`.
- `emprestimos(id, livro_id, solicitante_id, status, mensagem, data_prevista_devolucao, decidido_em, devolvido_em)`.
- Status do livro: Disponível, Reservado, Emprestado.
- Status do empréstimo: Pendente, Aprovado, Recusado, Devolvido, Cancelado.
- Índice único parcial `uq_emprestimo_ativo`: só um pedido Pendente/Aprovado por livro.

## Regras de negócio
- Não se pode solicitar o próprio livro nem um livro que não esteja Disponível.
- Solicitar: livro vira Reservado. Aprovar: livro vira Emprestado. Recusar, cancelar ou devolver: livro volta a Disponível.
- Só o dono aprova, recusa ou registra devolução. Só o solicitante cancela, e apenas pedido Pendente.
- Ao aprovar, `data_prevista_devolucao` deve ser futura e no máximo 90 dias à frente, validada no servidor.
- Livro só pode ser editado/excluído pelo dono e nunca se estiver Reservado ou Emprestado.
- Mudanças em mais de uma tabela usam `db.batch([...])`; atualizações condicionais checam `meta.changes`.

## Formato de resposta
Sucesso: `{ "ok": true, "data": ... }`. Erro: `{ "ok": false, "error": "mensagem" }`.
Status HTTP: 400 validação, 401 não autenticado, 403 sem permissão, 404 não encontrado, 409 conflito de estado.

## Entregáveis
Rotas em `functions/api/`, migration em `migrations/`, contrato documentado em `docs/API.md`.