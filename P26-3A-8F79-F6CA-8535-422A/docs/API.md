# Contrato da API — Shared To-Do (P26-3A-8F79-F6CA-8535-422A)

Contrato combinado entre os agentes de backend, frontend e teste. Todas as rotas `/api/*` respondem JSON.
Erros: `{ "error": "mensagem" }` com 400 (dados inválidos), 401 (sem sessão), 403/404 (sem acesso ou não existe), 409 (conflito).

## Esquema D1 (`migrations/0001_init.sql`)

| Tabela | Colunas |
| --- | --- |
| `users` | `user_id` TEXT PK (id do Discord), `username`, `avatar` (URL), `created_at`, `updated_at` |
| `lists` | `id` INTEGER PK, `name`, `share_code` UNIQUE, `owner_id` → users, `created_at` |
| `list_members` | `list_id` → lists, `user_id` → users, `role` (`owner`/`member`), `joined_at`; PK (`list_id`, `user_id`) |
| `tasks` | `id` INTEGER PK, `list_id` → lists, `parent_id` → tasks (NULL = tarefa principal), `title`, `done` (0/1), `assignee_id` → users (NULL = sem responsável), `created_by` → users, `created_at`, `updated_at` |

Subtarefas têm um nível só: `parent_id` precisa apontar para uma tarefa principal da mesma lista. Excluir uma tarefa exclui as subtarefas.

## Sessão

Cookie `session` = `base64url(payload).base64url(assinatura)`, payload `{ "uid": "<user_id>", "exp": <epoch s> }`,
assinatura HMAC-SHA256 com `SESSION_SECRET` calculada sobre o texto `base64url(payload)`. Validade 7 dias. `HttpOnly; Secure; SameSite=Lax; Path=/`.

## Objetos

```json
User   { "id": "123", "username": "cesar", "avatarUrl": "https://cdn.discordapp.com/..." }
List   { "id": 1, "name": "TCC", "shareCode": "K7QX9M2P", "role": "owner", "memberCount": 2, "taskCount": 5, "doneCount": 1 }
Task   { "id": 10, "parentId": null, "title": "Escrever intro", "done": false, "assignee": User | null, "createdBy": "123", "updatedAt": "2026-11-20T20:00:00Z" }
```

## Rotas

| Método e rota | Corpo | Resposta |
| --- | --- | --- |
| `GET /api/auth/discord` | — | 302 para o Discord (com `state`) |
| `GET /api/auth/discord/callback` | — | 302 para `/` com cookie de sessão; erro → `/?auth_error=...` |
| `POST /api/auth/logout` | — | 204, apaga o cookie |
| `GET /api/me` | — | `{ "user": User }` ou 401 |
| `GET /api/lists` | — | `{ "lists": [List] }` (só as listas de que sou membro) |
| `POST /api/lists` | `{ "name" }` (1–80 caracteres) | 201 `{ "list": List }` (criador vira `owner`) |
| `POST /api/lists/join` | `{ "code" }` | 200 `{ "list": List }`; código inexistente → 404; já membro → 200 sem duplicar |
| `GET /api/lists/:id` | — | `{ "list": List, "members": [User + "role"], "tasks": [Task] }` |
| `POST /api/lists/:id/tasks` | `{ "title", "parentId"?, "assigneeId"? }` | 201 `{ "task": Task }` |
| `PATCH /api/tasks/:id` | qualquer de `{ "title", "done", "assigneeId" }` (`assigneeId: null` remove) | 200 `{ "task": Task }` |
| `DELETE /api/tasks/:id` | — | 204 |
| `DELETE /api/lists/:id/members/:userId` | — | 204 (sair da lista ou remover membro; ver regras abaixo) |

Membros (`DELETE /api/lists/:id/members/:userId`):
- `userId` igual ao usuário da sessão = **sair da lista**. O dono não pode sair → 409.
- `userId` de outro usuário = **remover membro**: só o dono pode → 403 para quem não é dono; o dono não pode ser removido → 409.
- Quem chama precisa ser membro da lista (senão 404); o alvo precisa ser membro (senão 404).
- Na mesma operação (`DB.batch`), as tarefas da lista atribuídas ao removido ficam sem responsável (`assignee_id = NULL`).
  O removido perde o acesso imediatamente (as rotas da lista passam a responder 404 para ele).

Regras validadas no servidor: sessão válida em toda rota (exceto login); só membros da lista leem ou alteram;
`title` 1–200 caracteres após `trim`; `done` booleano; `assigneeId` precisa ser membro da lista;
`parentId` precisa ser tarefa principal da mesma lista.
