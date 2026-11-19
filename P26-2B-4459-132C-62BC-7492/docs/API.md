# Contrato da API — Quiz Competitivo Temporizado

Chave Única: `P26-2B-4459-132C-62BC-7492`

## Regras gerais

- JSON em UTF-8. Erros: `{ "error": "codigo", "message": "texto legível" }`.
- Sessão: cookie `sid` (HttpOnly, SameSite=Lax, Secure em HTTPS). O servidor guarda apenas o SHA-256 do token (tabela `sessions`).
- Toda rota `POST` exige `Content-Type: application/json` e cabeçalho `Origin` igual à origem da requisição (proteção CSRF).
- **O relógio oficial é o do servidor.** `sent_at` e `answered_at` são gravados no D1 e a diferença é calculada no servidor. Nenhum tempo enviado pelo cliente é usado.
- O payload de pergunta **nunca** contém o gabarito. O índice correto só é revelado (a) na resposta de `/api/quiz/answer`, depois que a pergunta foi encerrada, e (b) na revisão final do quiz.
- A ordem das alternativas é embaralhada no servidor por quiz e guardada em `quiz_items.option_order`. O cliente trabalha apenas com o índice **exibido** (0–3).

## Autenticação (Discord OAuth2, scope `identify`)

| Rota | Descrição |
|---|---|
| `GET /api/auth/login` | Gera `state`, grava no cookie `oauth_state` (10 min) e redireciona (302) ao Discord. |
| `GET /api/auth/callback?code&state` | Valida `state`, troca o `code` por token, lê `/users/@me`, faz upsert de `user_id`, nome e avatar, cria sessão e redireciona para `/`. Em falha: `/?erro=<codigo>`. |
| `POST /api/auth/logout` | Apaga a sessão. `{ "ok": true }` |
| `GET /api/me` | `200 { "user": { "id", "name", "avatarUrl" } }` ou `401 { "error": "unauthenticated" }` |

## Quiz (todas exigem sessão; sem sessão → `401`)

### `GET /api/categories`
`200 { "categories": [ { "id", "name", "description", "questionCount" } ] }`

### `POST /api/quiz/start`
Corpo: `{ "categoryId": "web" }`
`200 { "quizId": "…", "total": 10 }`
Erros: `400 invalid_body`, `404 category_not_found`, `429 too_many_quizzes`.
Efeito: marca outros quizzes ativos do usuário como `abandoned`, sorteia até 10 perguntas e embaralha as alternativas de cada uma. Nenhuma pergunta é considerada "enviada" ainda.

### `POST /api/quiz/next`
Corpo: `{ "quizId": "…" }`

Entrega a próxima pergunta pendente e **inicia o cronômetro oficial** (grava `sent_at` no D1) na primeira vez. Chamadas repetidas devolvem a mesma pergunta com `remainingMs` menor (recarregar a página não reinicia o tempo). Se o tempo da pergunta pendente já expirou, ela é encerrada como `timeout` e a próxima é entregue.

```json
{ "done": false,
  "question": { "quizId": "…", "position": 0, "number": 1, "total": 10,
                "text": "…", "options": ["…","…","…","…"],
                "timeLimitMs": 15000, "remainingMs": 15000, "score": 0 } }
```
Quando não restam perguntas o quiz é finalizado:
```json
{ "done": true,
  "summary": { "score": 7420, "correctCount": 8, "total": 10, "accuracy": 0.8,
               "review": [ { "number": 1, "text": "…", "options": ["…"],
                             "correctIndex": 2, "chosenIndex": 2,
                             "result": "correct", "points": 912, "elapsedMs": 1320 } ] } }
```
Erros: `404 quiz_not_found` (inexistente ou de outro usuário), `409 quiz_abandoned`.

### `POST /api/quiz/answer`
Corpo: `{ "quizId": "…", "position": 0, "choice": 2 }` (`choice` = índice exibido 0–3, ou `null` para "sem resposta").

Resposta `200`:
```json
{ "accepted": true, "result": "correct", "correctIndex": 2, "points": 912,
  "elapsedMs": 1320, "score": 912, "answered": 1, "total": 10, "finished": false }
```
- `result`: `correct` | `wrong` | `timeout` | `skipped`.
- `correctIndex` só é devolvido quando `result` é `correct` ou `wrong`; em `timeout`/`skipped` vem `null` (evita sondar o gabarito pulando perguntas). A revisão final sempre traz o gabarito.
- Resposta com alternativa enviada **depois** de `time_limit_ms + GRACE_MS` → `408` com o mesmo formato, `accepted:false`, `result:"timeout"`, `points:0`.
- `choice:null` → `200`, `timeout` se o tempo já esgotou, senão `skipped`; sempre 0 ponto.
- Erros: `400 invalid_body`, `404 quiz_not_found | question_not_found`, `409 not_sent` (pergunta ainda não entregue), `409 already_answered`, `409 quiz_not_active`.

### `GET /api/ranking?categoryId=web`
```json
{ "categoryId": "web",
  "ranking": [ { "rank": 1, "name": "…", "avatarUrl": "…", "best": 9120, "games": 3, "isMe": false } ],
  "me": { "rank": 4, "best": 7420, "games": 2 } }
```
`me` é `null` se o usuário ainda não finalizou quiz nessa categoria. Ranking = melhor pontuação por usuário nos quizzes `finished` (top 10).

## Pontuação (calculada só no servidor)

```
errou / sem resposta / fora do tempo → 0
acertou → MIN + round((MAX - MIN) * (1 - elapsed / limite))     (elapsed limitado a [0, limite])
MAX = 1000 (resposta instantânea), MIN = 100 (no último instante)
```

## Estados

- `quiz_sessions.status`: `active` → `finished` (todas respondidas/expiradas) ou `abandoned` (usuário iniciou outro quiz).
- `quiz_items`: `sent_at` nulo → pergunta ainda não entregue; `answered_at` nulo → em aberto; `result` define o desfecho.
- Cada item só pode ser respondido uma única vez (UPDATE condicional `WHERE answered_at IS NULL`).
