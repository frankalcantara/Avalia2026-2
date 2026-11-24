# Contrato da API — Projeto #24 (P26-2C-BF60-C440-6484-80FA)

Contrato compartilhado entre o **Agente Backend**, o **Agente Frontend** e o **Agente de Teste**.
Qualquer mudança aqui deve ser feita antes do código, nunca o contrário.

Todas as rotas ficam em `functions/api/**` (Cloudflare Pages Functions). Respostas são JSON
(`Content-Type: application/json; charset=utf-8`), exceto os redirecionamentos de OAuth.

## Convenções

- **Erro:** `{ "error": "<codigo_curto>", "message": "<texto em português>" }`
  com status `400` (entrada inválida), `401` (não autenticado), `403` (sem permissão),
  `404` (não encontrado), `405` (método não permitido, `method_not_allowed`), `409` (conflito de estado),
  `415` (Content-Type diferente de `application/json`), `429` (limite).
- **Sessão:** cookie `session=<token aleatório 32 bytes hex>`; `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`.
  O token é buscado na tabela `sessions` (com `expires_at > now`). Nada de identidade é confiado ao cliente.
- **Escrita (POST/PATCH/DELETE):** exige sessão válida **e** `Content-Type: application/json`
  (para POST/PATCH com corpo) — defesa CSRF junto com `SameSite=Lax`. Sem corpo JSON válido → `400`.
- **Datas:** `YYYY-MM-DD` (UTC) para `due_date`; timestamps no formato `datetime('now')` do SQLite.
- **Objeto público de usuário** (`UserPublic`):
  `{ "user_id", "username", "display_name", "avatar_url" }` — `username` é o handle do Discord usado para contato.

## Objeto `Book`

```json
{
  "id": 1, "title": "Clean Code", "author": "Robert C. Martin",
  "category": "tecnico|literario", "mode": "emprestimo|troca|ambos",
  "condition": "novo|bom|usado|desgastado", "isbn": "string|null", "description": "string|null",
  "status": "Disponível|Reservado|Emprestado",
  "due_date": "YYYY-MM-DD|null",
  "owner": UserPublic,
  "holder": UserPublic|null,
  "created_at": "...", "is_mine": true
}
```

## Objeto `Request`

```json
{
  "id": 1, "type": "emprestimo|troca",
  "status": "pendente|aprovado|recusado|cancelado|devolvido|concluido",
  "message": "string|null", "due_date": "YYYY-MM-DD|null",
  "created_at": "...", "decided_at": "...|null", "returned_at": "...|null",
  "book": { "id", "title", "author", "status" },
  "offered_book": { "id", "title", "author" } | null,
  "requester": UserPublic, "owner": UserPublic
}
```

## Máquina de estados (validada no servidor)

| Evento | Quem | Pré-condição | Efeito |
|---|---|---|---|
| Pedir empréstimo/troca | usuário logado ≠ dono | livro `Disponível`; `mode` aceita o `type`; usuário com < 3 pedidos pendentes | request `pendente`; livro → `Reservado` |
| Troca com livro oferecido | solicitante | `offered_book_id` é do solicitante e está `Disponível` | livro oferecido → `Reservado` também |
| Cancelar | solicitante | request `pendente` | request `cancelado`; livros → `Disponível` |
| Recusar | dono | request `pendente` | request `recusado`; livros → `Disponível` |
| Aprovar empréstimo | dono | request `pendente`, `mode` do livro ainda aceita o `type`, `due_date` entre amanhã e hoje+90 dias | request `aprovado` com `due_date`; livro → `Emprestado`, `holder_id` = solicitante, `due_date` |
| Aprovar troca | dono | request `pendente`, `mode` do livro ainda aceita o `type` | request `concluido`; `owner_id` do livro passa ao solicitante (e o oferecido, se houver, ao dono); ambos → `Disponível` |
| Registrar devolução | dono | request `aprovado` (empréstimo) | request `devolvido`, `returned_at`; livro → `Disponível`, `holder_id`/`due_date` = NULL |
| Editar livro | dono | — | só campos descritivos; `status`, `owner_id`, `holder_id` nunca vêm do cliente |
| Excluir livro | dono | livro `Disponível` | remove o livro |

Transições devem ser **atômicas e à prova de corrida**: usar `env.DB.batch([...])` e
`UPDATE ... WHERE id = ? AND status = '<esperado>'`, conferindo `meta.changes` e retornando `409` se 0.

## Rotas

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/auth/discord` | Gera `state` aleatório, grava cookie `oauth_state` (HttpOnly, 10 min) e redireciona (302) para `https://discord.com/oauth2/authorize` com `scope=identify`. Sem `DISCORD_CLIENT_ID` → `500` JSON `not_configured`. |
| GET | `/api/auth/discord/callback` | Confere `state` == cookie; troca `code` por token; busca `/users/@me`; faz upsert em `users`; cria linha em `sessions`; seta cookie `session`; limpa `oauth_state`; redireciona para `/?login=ok`. Falha → redireciona `/?auth_error=<codigo>`. |
| POST | `/api/auth/logout` | Apaga a sessão no D1 e expira o cookie. `{ "ok": true }` |
| GET | `/api/me` | `{ "user": UserPublic }` ou `{ "user": null }` (200 em ambos os casos). |

### Livros
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/books?q=&category=&status=&mode=&owner=me` | Lista pública (sem login). `q` busca em título/autor (LIKE). `owner=me` exige login. Máx. 200, ordenado por `created_at DESC`. `{ "books": Book[] }` |
| GET | `/api/books/:id` | `{ "book": Book }` ou 404. |
| POST | `/api/books` | Cria livro do usuário logado. Corpo: `title` (1–200), `author` (1–150), `category`, `mode`, `condition`, `isbn?` (≤ 20, só dígitos/X/hífen), `description?` (≤ 1000). Limite: 100 livros por dono. `201 { "book": Book }` |
| PATCH | `/api/books/:id` | Dono edita os mesmos campos (parcial). Mudar `mode` só com o livro `Disponível` (senão `409 mode_locked`). `{ "book": Book }` |
| DELETE | `/api/books/:id` | Dono exclui se `Disponível`. `{ "ok": true }` |

### Pedidos
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/requests` | Corpo: `book_id`, `type` (`emprestimo`/`troca`), `message?` (≤ 500), `offered_book_id?` (só em troca). `201 { "request": Request }` |
| GET | `/api/requests?box=incoming\|outgoing` | Logado. `incoming` = pedidos para livros que eu possuo; `outgoing` = pedidos que eu fiz. `{ "requests": Request[] }` |
| POST | `/api/requests/:id/approve` | Dono. Corpo `{ "due_date": "YYYY-MM-DD" }` (obrigatório para empréstimo, ignorado em troca). `{ "request": Request }` |
| POST | `/api/requests/:id/reject` | Dono. `{ "request": Request }` |
| POST | `/api/requests/:id/cancel` | Solicitante. `{ "request": Request }` |
| POST | `/api/requests/:id/return` | Dono. `{ "request": Request }` |

### Diagnóstico
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/status` | `{ "ok": true, "chave": "P26-2C-BF60-C440-6484-80FA", "d1": true\|false, "discord_configured": bool }` |
