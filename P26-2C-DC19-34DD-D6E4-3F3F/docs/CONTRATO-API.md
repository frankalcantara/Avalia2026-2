# Contrato da API (fonte única entre backend, frontend e QA)

Projeto: Dúvidas Técnicas, perguntas e respostas com Discord OAuth2, Cloudflare Pages Functions e D1.
Chave de auditoria: **P26-2C-DC19-34DD-D6E4-3F3F**

## Estrutura de pastas

```
public/                  front-end estático (index.html, style.css, app.js)
functions/_lib/          módulos compartilhados (não viram rota)
functions/api/...        rotas (Cloudflare Pages Functions, roteamento por arquivo)
migrations/0001_init.sql esquema do D1 (já existe, não alterar)
tests/                   testes com node:test
(config no painel da Cloudflare: binding DB (D1), variáveis e secret; saída = public/)
```

## Ambiente

| Nome | Tipo | Uso |
|---|---|---|
| `DB` | binding D1 | banco relacional |
| `DISCORD_CLIENT_ID` | variável | OAuth2 |
| `DISCORD_CLIENT_SECRET` | secret | OAuth2 |
| `DISCORD_REDIRECT_URI` | variável opcional | padrão: `<origin>/api/auth/callback` |

## Convenções

- Respostas em JSON UTF-8. Erros: `{ "error": "mensagem em português", "field": "campo (opcional)" }`.
- Códigos: 400 JSON inválido, 401 não autenticado, 403 sem permissão, 404 não encontrado, 409 conflito de estado, 422 validação, 500 erro interno.
- Toda requisição que altera dados (POST) exige: sessão válida, `Content-Type: application/json` e `Origin` com o mesmo host da requisição (proteção CSRF). Senão 403.
- Sessão: cookie `sid` (HttpOnly, SameSite=Lax, Path=/, Secure quando HTTPS, 7 dias). O valor é um token aleatório de 32 bytes em hex; o D1 guarda apenas o SHA-256 dele (`sessions.token_hash`).
- Regras de negócio e permissões são validadas **somente no servidor**; o cliente só reflete o que o servidor informa.
- Limites (após `trim`): título 5 a 120 caracteres, descrição do tópico 10 a 5000, resposta 3 a 5000.
- O `user_id` do Discord (snowflake em texto) é a chave primária de `users`. Nunca aceitar `user_id` vindo do corpo da requisição.

## Autenticação

### `GET /api/auth/login`
302 para `https://discord.com/oauth2/authorize` com `client_id`, `redirect_uri`, `response_type=code`, `scope=identify`, `state` aleatório e `prompt=none`. Grava o cookie `oauth_state` (HttpOnly, SameSite=Lax, Path=/api/auth, 10 min).

### `GET /api/auth/callback?code=...&state=...`
1. Se vier `error` (ex.: `access_denied`): 302 `/?erro=login_cancelado`.
2. `state` ausente ou diferente do cookie: 302 `/?erro=estado_invalido`.
3. Troca `code` em `POST https://discord.com/api/oauth2/token` (form-urlencoded) e lê `GET https://discord.com/api/users/@me`. Falha: 302 `/?erro=falha_discord`.
4. Importa `id` (user_id), nome (`global_name` ou `username`) e avatar (`https://cdn.discordapp.com/avatars/<id>/<hash>.png?size=128`; sem avatar, `https://cdn.discordapp.com/embed/avatars/<(id >> 22) % 6>.png`). Faz upsert em `users`.
5. Cria sessão, grava `sid`, apaga `oauth_state`, 302 `/`.

### `POST /api/auth/logout`
Apaga a sessão no D1 e limpa o cookie. 200 `{ "ok": true }`. Funciona também sem sessão.

### `GET /api/me`
200 `{ "user": null }` ou `{ "user": { "id", "username", "avatar_url" } }`.

## Tópicos

Formato de autor: `{ "id", "username", "avatar_url" }`.

### `GET /api/topics?status=open|resolved&q=texto&page=1`
Público. `q` filtra por título (LIKE, com escape de `%` e `_`). Ordem: mais recentes primeiro. Página de 20.
200 `{ "topics": [ { "id", "title", "status", "created_at", "answer_count", "author": {...} } ], "page", "page_size": 20, "total" }`

### `POST /api/topics`
Corpo `{ "title", "body" }`. 401 sem sessão, 422 validação.
201 `{ "topic": { "id" } }`

### `GET /api/topics/:id`
Público. 404 se não existir.
200
```json
{
  "topic": { "id": 1, "title": "", "body": "", "status": "open|resolved", "created_at": "", "resolved_at": null, "accepted_answer_id": null, "author": {} },
  "answers": [ { "id": 1, "body": "", "created_at": "", "is_accepted": false, "author": {} } ],
  "viewer": { "logged_in": true, "is_author": false, "can_answer": true, "can_accept": false }
}
```
Ordem de `answers`: a aceita primeiro, depois por `created_at` crescente.
`can_answer` = logado, não é o autor e o tópico está aberto. `can_accept` = é o autor e há ao menos uma resposta.

### `POST /api/topics/:id/answers`
Corpo `{ "body" }`.
- 401 sem sessão; 404 tópico inexistente.
- 403 se o usuário é o autor do tópico ("Você não pode responder ao seu próprio tópico.").
- 409 se o tópico já está resolvido.
- 422 validação.
201 `{ "answer": { "id" } }`

### `POST /api/topics/:id/accept`
Corpo `{ "answer_id": number }`. **Diferencial do projeto.**
- 401 sem sessão.
- 404 tópico inexistente.
- 403 se `session.user_id !== topics.author_id` (comparação feita na Function, com o valor do D1).
- 422 se `answer_id` não for inteiro positivo ou a resposta não pertencer ao tópico.
- Sucesso: atualização atômica em uma única instrução `UPDATE topics SET status='resolved', accepted_answer_id=?, resolved_at=? WHERE id=? AND author_id=? AND EXISTS (SELECT 1 FROM answers WHERE id=? AND topic_id=?)`; se `meta.changes === 0`, responder o erro correspondente.
- O autor pode trocar a resposta aceita (aceitar outra substitui a anterior).
200 `{ "ok": true, "topic": { "id", "status": "resolved", "accepted_answer_id" } }`

## Interface (public/)

- HTML5 semântico, CSS3 responsivo (mobile first), JavaScript puro em um único `app.js` (módulo ES opcional). Sem frameworks, sem bibliotecas de UI, sem CDN.
- Rotas por hash: `#/` lista (filtros Todos/Abertos/Resolvidos e busca), `#/novo` formulário, `#/t/<id>` detalhe.
- Cabeçalho: nome do site, botão "Entrar com Discord" (link para `/api/auth/login`) ou avatar + nome + "Sair".
- Rodapé em todas as telas com o texto exato: `Chave: P26-2C-DC19-34DD-D6E4-3F3F`.
- Selo do tópico: "Aberto" ou "Resolvido" (estilo diferente, com texto, nunca só cor).
- Detalhe: a "Solução Aceita" aparece primeiro, destacada (borda e selo "Solução Aceita"). Botão "Marcar como solução" só aparece quando `viewer.can_accept` e a resposta ainda não é a aceita. Formulário de resposta só quando `viewer.can_answer`; mensagens claras nos demais casos (não logado, autor, resolvido).
- Texto do usuário **nunca** entra por `innerHTML`. Usar `textContent`/`createElement`. Renderização de texto técnico: blocos com três crases viram `<pre><code>`, crases simples viram `<code>`, linhas em branco separam parágrafos. Tudo montado via DOM.
- Mostrar erros da API em área com `role="alert"`; tratar `?erro=` da URL com mensagem amigável; foco visível; contraste AA; funciona sem mouse.
