# Casos de Teste da API (P26-2C-E7BA-C284-8D3A-E0B8)

Registro dos testes de segurança e de regras de negócio das Cloudflare Pages Functions.

- **Ambiente:** local (`npx wrangler pages dev public`), D1 local com as migrations `0001_init.sql` e `0002_seed.sql`.
- **Livro cadastrado:** "Duna - Frank Herbert", 12 etapas.
- **Data da execução manual:** 15/11/2026.
- **Como foram executados:** chamadas `fetch` no Console do navegador (com o cookie de login real) e `curl.exe` no terminal (para o cookie forjado).

## 1. Casos executados

| ID | Cenário | Requisição | Resultado esperado | Resultado obtido |
|----|---------|------------|--------------------|------------------|
| T01 | Login Discord OAuth2 | `GET /api/auth/discord` e retorno em `/callback` | Redirect para `/?login=success` | Passou |
| T02 | Sessão após login | `GET /api/me` | 200, `ok: true`, usuário e livro ativo, `subscribed: false` | Passou |
| T03 | Inscrição no livro | `POST /api/book/join` | 200, `ok: true`, `currentChapter: 1` | Passou |
| T04 | Estado após inscrição | `GET /api/me` | `subscribed: true`, `currentChapter: 1` | Passou |
| T05 | Inscrição duplicada | `POST /api/book/join` (2ª vez) | 409 `already_subscribed` | Passou |
| T06 | Anti-spoiler na leitura | `GET /api/forum/list?chapter=2` com progresso 1 | 403 `spoiler_blocked` | Passou |
| T07 | Anti-spoiler na escrita | `POST /api/forum/post` no capítulo 2 com progresso 1 | 403 `spoiler_blocked` | Passou |
| T08 | Cookie forjado | `GET /api/me` com `discord_session` inventado e assinatura falsa | 401 `not_authenticated` | Passou |
| T09 | Avanço de progresso | `POST /api/progress/update` com `chapter: 2` | 200, `ok: true` | Passou |
| T10 | Leitura liberada | `GET /api/forum/list?chapter=2` com progresso 2 | 200, `posts: []` | Passou |
| T11 | Publicação permitida | `POST /api/forum/post` no capítulo 2 com progresso 2 | 201, `ok: true` | Passou |
| T12 | Capítulo fora do livro | `POST /api/progress/update` com `chapter: 13` | 400 `chapter_out_of_range` | Passou |

## 2. Casos pendentes (ainda não executados)

| ID | Cenário | Resultado esperado |
|----|---------|--------------------|
| P01 | Qualquer rota `/api/*` protegida sem cookie | 401 `not_authenticated` |
| P02 | `forum/post` com conteúdo vazio | 400 `empty_content` |
| P03 | `forum/post` com mais de 2000 caracteres | 400 `content_too_long` |
| P04 | `forum/post` e `progress/update` com capítulo `0`, negativo ou não inteiro | 400 `invalid_chapter` |
| P05 | `forum/post` por usuário não inscrito | 403 `not_subscribed` |
| P06 | `progress/update` por usuário não inscrito | 403 `not_subscribed` |
| P07 | Callback com `state` diferente do cookie | Redirect para `/?auth_error=invalid_state` |
| P08 | `POST /api/auth/logout` | 200 e cookie de sessão apagado |
| P09 | `GET /api/progress/track` logado | 200, lista de leitores sem `userId` dos outros |
| P10 | Mesmos testes no site publicado no Cloudflare | Mesmos resultados do ambiente local |