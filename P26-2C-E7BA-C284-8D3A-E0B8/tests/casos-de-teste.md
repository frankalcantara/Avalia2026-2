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

## 2. Casos pendentes ou parcialmente executados

| ID | Cenário | Resultado esperado | Situação |
|----|---------|--------------------|----------|
| P01 | Rota protegida `/api/progress/track` sem sessão | 401 `not_authenticated` | Passou no site publicado (17/11/2026); ver PROD-05 |
| P02 | `forum/post` com conteúdo vazio | 400 `empty_content` | Passou no site publicado (17/11/2026); ver PROD-06 |
| P03 | `forum/post` com mais de 2000 caracteres | 400 `content_too_long` | Passou no site publicado (17/11/2026); ver PROD-07 |
| P04 | `forum/post` e `progress/update` com capítulo `0`, negativo ou não inteiro | 400 `invalid_chapter` | Passou no site publicado (17/11/2026); ver PROD-08 |
| P05 | `forum/post` por usuário não inscrito | 403 `not_subscribed` | Passou no site publicado (17/11/2026); ver PROD-10 |
| P06 | `progress/update` por usuário não inscrito | 403 `not_subscribed` | Passou no site publicado (17/11/2026); ver PROD-09 |
| P07 | Callback com `state` diferente do cookie | Redirect para `/?auth_error=invalid_state` | Passou no site publicado (17/11/2026); ver PROD-13 |
| P08 | `POST /api/auth/logout` | 200 e cookie de sessão apagado | Passou no site publicado (17/11/2026); ver PROD-11 |
| P09 | `GET /api/progress/track` logado | 200, lista de leitores sem `userId` dos outros | Passou no site publicado (17/11/2026); ver PROD-12 |
| P10 | Repetir no site publicado todos os casos executados localmente | Mesmos resultados do ambiente local | Parcial; ver seção 3 |

## 3. Testes manuais reportados no site publicado

- **Ambiente:** produção, `https://clube-de-leitura.pages.dev`.
- **Datas dos relatos:** 16–17/11/2026.
- **Fonte:** testes manuais realizados pelo responsável pelo projeto e relatados nesta conversa; não foram executados pelo validador automatizado.
- **Limite do registro:** não foram anotados status HTTP, capturas de tela ou resultados de todos os casos da seção 1.

| ID | Cenário | Resultado reportado |
|----|---------|---------------------|
| PROD-01 | Login pelo Discord | Passou |
| PROD-02 | Avançar e recuar capítulos | Passou |
| PROD-03 | Publicar comentários no fórum | Passou |
| PROD-04 | Tentar visualizar capítulo além do progresso atual | Conteúdo permaneceu bloqueado, conforme relato do responsável |
| PROD-05 | `GET /api/progress/track` sem sessão, via janela anônima | `401`, `not_authenticated` |
| PROD-06 | `POST /api/forum/post` com capítulo 1 e conteúdo vazio | `400`, `empty_content` |
| PROD-07 | `POST /api/forum/post` com capítulo 1 e conteúdo de 2001 caracteres | `400`, `content_too_long`; `maxLength: 2000` |
| PROD-08 | `forum/post` e `progress/update` com capítulo zero, negativo e decimal | Os seis pedidos retornaram `400`, `invalid_chapter` |
| PROD-09 | `POST /api/progress/update` no capítulo 1 por conta autenticada não inscrita | `403`, `not_subscribed` |
| PROD-10 | `POST /api/forum/post` no capítulo 1 com comentário de teste por conta não inscrita | `403`, `not_subscribed`; comentário não publicado |
| PROD-11 | `POST /api/auth/logout`, seguido de chamada à rota protegida | Logout `200`; rota protegida `401`, `not_authenticated` |
| PROD-12 | `GET /api/progress/track` logado | `200`, `ok: true`; 2 leitores e nenhum campo `userId` |
| PROD-13 | Callback OAuth com `code` fictício e `state` incorreto após iniciar login | Redirecionou com aviso de login não confirmado |

O caso PROD-04 registra o comportamento observado no site, mas não confirma por si só o status HTTP da resposta nem substitui um teste direto da função em produção. Todos os casos P01–P09 foram testados no site publicado. A bateria P10 continua parcial porque nem todos os casos T01–T12 foram repetidos em produção.