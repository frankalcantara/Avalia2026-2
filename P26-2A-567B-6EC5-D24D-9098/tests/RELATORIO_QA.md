# Relatório de QA — Bookmark Manager (Projeto #42)

Chave única: **P26-2A-567B-6EC5-D24D-9098**

Regra deste relatório: nenhum resultado é inventado. "a preencher" = ainda não executado. Os achados da seção 4 vêm da **revisão estática** do código colado (não de execução).

## 1. Identificação

| Campo | Valor |
|-------|-------|
| URL_CLOUDFLARE | https://projeto-p26-2a-567b-6ec5-d24d-9098.pages.dev |
| Commit / versão testada | a29f792 |
| Data da execução | 18/11/2026 (testes automáticos às 18:28 e 18:31, horário de Brasília) |
| Responsável | Rogério Gapski da Silva |
| Sistema operacional / terminal | Windows com WSL (Linux), terminal bash |
| Node (`node -v`) | v24.22.0 |
| Wrangler (`npx wrangler --version`) | 4.164.0 (versão usada nos testes e no deploy) |
| Navegadores e versões | a preencher |
| Banco usado nos testes automáticos | local (`--local`), com usuários fictícios de `tests/seed-qa.sql` |

## 2. Resumo

| Bloco | Total | Passou | Falhou | Pulados | Observação |
|-------|-------|--------|--------|---------|------------|
| Testes automáticos (`tests/api.test.mjs`) | 115 | 115 | 0 | 0 | 1ª execução (18:28): 114 passaram; HTTP-01 falhou por erro do próprio teste (corpo em GET), corrigido. 2ª execução (18:31): 115 de 115. Os OAUTH-01/02/04 rodaram (Discord configurado) |
| Checklist manual (`CHECKLIST_MANUAL.md`) | 86 | a preencher | a preencher | a preencher | |
| `validar-local.mjs` | 9 itens | 9 | 0 | — | Executado em 18/11/2026, incluindo o item de deploy online |

Achados da revisão estática: **0 críticos, 1 alto (ENC-01, descartado após verificação), 3 médios, 10 baixos** (seção 4).

## 3. Revisão dos requisitos do projeto (estática, código colado)

| Requisito | Resultado da revisão | Evidência |
|-----------|----------------------|-----------|
| Cliente só HTML5/CSS3/JS puro, sem framework | Conforme | Nenhum import externo nem `<script src>` externo em `public/`; só módulos ES locais. Confirmar com E-02 e E-05 |
| Sem `innerHTML` com dados do usuário | Conforme | `public/js/ui.js` usa `createElement` + `textContent`; `app.js` e `publica.js` não usam `innerHTML`. Confirmar com E-03 |
| Validação e regras no servidor | Conforme | `functions/_lib/api.js` (`validateUrl`, `validateTitle`, `validateStatus`, …) valida tudo; cliente só repete como conveniência |
| SQL parametrizado | Conforme | Todos os valores vão por `.bind()`. Os `${...}` em SQL (`sets.join`, `where.join`, `LINK_COLUMNS`, `COLLECTION_SELECT`) são fragmentos constantes escritos no código |
| Login somente Discord OAuth2 (`identify`) | Conforme | `functions/api/auth/discord.js` e `callback.js`; `state` aleatório validado em tempo constante |
| Sessão: id aleatório, `HttpOnly; Secure; SameSite=Lax; Path=/`, com expiração | Conforme | `functions/_lib/auth.js` (`buildCookie`, `getUser`) |
| Rotas protegidas → 401 sem sessão | Conforme | `route()` em `functions/_lib/api.js` chama `getUser()` antes do handler |
| Recurso de outro usuário → 403/404 | Conforme (404) | Toda query filtra por `user_id`; `requireOwnedCollection` |
| Status restrito a 3 valores (API e CHECK) | Conforme, **sujeito a ENC-01** | `STATUSES` em `api.js`; CHECK em `0002_bookmarks.sql` |
| `/api/public/:slug` só `is_public = 1`, somente leitura, expõe username/avatar | Parcial | Conforme, exceto a URL do avatar conter o Discord ID (SEC-02) |
| Tabela de usuários `discord_users` (em vez de `users` da skill) | Aceito | Decisão do projeto informada pelo estudante; não é bug |
| Chave no `<footer>` das duas páginas | Conforme (HTML) | `public/index.html` e `public/colecao.html`. README não foi colado (K-04) |
| Sem `text-shadow` / `drop-shadow` | Conforme | `public/styles.css` só usa `box-shadow` em contêineres. Confirmar com E-04 |
| Mobile-first, breakpoints 768/1100, foco visível, `label` nos campos | Conforme no código; **visual não verificado** | Seção B do checklist |
| Estados carregando/vazio/erro e confirmação antes de excluir | Conforme | `setMessage`, `askConfirm` em `public/app.js` |
| Tudo dentro de `P26-2A-567B-6EC5-D24D-9098/` | **Não verificável** | Só caminhos relativos foram colados. Confirmar com E-01 |
| `wrangler.jsonc`, `README.md`, `AGENTS.md`, `LICENSE`, `functions/api/status.js`, `validar-local.mjs`, `.gitignore` | **Não revisados** (não colados) | Ver DEP-01 |

## 4. Achados da revisão estática

Gravidades: crítico, alto, médio, baixo. Correções são **mínimas e sugeridas** (o QA não altera o código).

### Alto

| ID | Arquivo / trecho | Problema | Correção mínima | Status |
|----|------------------|----------|-----------------|--------|
| ENC-01 | Todos os arquivos colados; críticos: `migrations/0002_bookmarks.sql` (`CHECK(status IN (... 'Conclu├¡do'))`), `functions/_lib/api.js` (`STATUSES`), `public/index.html` (`data-status` e `<option value>`), `public/styles.css` (`[data-status="Conclu├¡do"]`) | O texto colado vem com codificação corrompida ("├¡" no lugar de "í"; "├®", "├ú" etc. nos comentários). **Condicional:** se for só efeito do terminal ao copiar, não há bug; se estiver gravado nos arquivos, "Concluído" real seria rejeitado (400) e/ou barrado pelo CHECK do banco, e a interface exibiria texto corrompido | Rodar `grep -rn "├" .` e conferir os bytes. Se houver corrupção: regravar os arquivos em UTF-8 sem BOM (a migration só se corrige criando a `0003`, pois a `0002` já foi aplicada). Os testes LNK-03, LNK-16, FLT-04 e PUB-08 provam o acento ponta a ponta | descartado: `grep "├"` não achou nada em `functions/`, `migrations/` e `public/` (18/11/2026); a corrupção veio do `clip.exe` na cópia do código para a conversa do QA. Testes LNK-03, LNK-16, FLT-04 e PUB-08 passaram |

### Médio

| ID | Arquivo / trecho | Problema | Correção mínima | Status |
|----|------------------|----------|-----------------|--------|
| SEC-01 | `public/` (não há `_headers` nos arquivos colados); `functions/_lib/http.js` `json()` | Sem CSP, `X-Content-Type-Options`, proteção contra clickjacking nem `Referrer-Policy`. Como o projeto não tem script nem estilo inline, uma CSP estrita é viável | Criar `public/_headers` com `Content-Security-Policy: default-src 'self'; img-src 'self' https://cdn.discordapp.com; frame-ancestors 'none'; base-uri 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`. O `_headers` só vale para arquivos estáticos; para as respostas JSON, acrescentar `X-Content-Type-Options: nosniff` em `json()` | aberto |
| SEC-02 | `functions/api/public/[slug].js`: `avatar: avatarUrl(collection.user_id, collection.avatar)`; `functions/_lib/auth.js` `avatarUrl()` | A URL do CDN (`/avatars/{id}/{hash}.png`) carrega o Discord ID do dono na rota **sem login**, contrariando o item 9 da skill ("expõe apenas username e avatar") e o comentário do arquivo ("nunca o user_id"). O estudante já havia registrado como pendência | Decidir: (a) documentar no README como risco aceito (o ID de usuário do Discord não é segredo), ou (b) na rota pública devolver `avatar: null`/avatar padrão. O teste PUB-06 emite um aviso quando detecta o ID | aberto (decisão do projeto) |
| DEP-01 | `functions/api/status.js` (gerado pelo script oficial, não colado) | A migration `0002` executa `DROP TABLE IF EXISTS project_records`. Se `status.js` (ou outro arquivo do script oficial) ainda consulta essa tabela, a rota passa a responder 500 | Abrir `status.js` (E-14); se usar `project_records`, trocar por consulta a `discord_users`/`collections` ou remover a rota se não for exigida | resolvido: `status.js` foi removido pelo estudante em 17/11/2026 |

### Baixo

| ID | Arquivo / trecho | Problema | Correção mínima | Status |
|----|------------------|----------|-----------------|--------|
| SEC-03 | `functions/_lib/api.js` `readJson()` / `route()` | `readJson` aceita qualquer `Content-Type` e nenhuma rota confere `Origin`. Hoje o CSRF é mitigado só por `SameSite=Lax` (cookie não vai em POST/PATCH/DELETE entre sites) | Em `route()`, para métodos diferentes de GET, exigir `Content-Type: application/json` (415) ou `Origin` igual ao host | aberto |
| SEC-04 | `functions/api/auth/discord/callback.js` (INSERT em `sessions`), `functions/_lib/auth.js` `getUser()` | O id de sessão é guardado em texto puro no banco; vazamento do D1 permitiria sequestrar sessões ativas | Guardar o SHA-256 do id (`crypto.subtle.digest`) e comparar o hash em `getUser`/`logout` | aberto |
| SEC-05 | `public/app.js` `readLoginResultFromUrl()`: `` `Não foi possível entrar (código: ${code.slice(0, 60)}).` `` | Um link `/?auth_error=texto` exibe texto arbitrário (até 60 caracteres) na tela de login. Sem XSS (usa `textContent`), mas permite mensagem forjada | Para códigos desconhecidos, mostrar só a mensagem genérica, sem ecoar o valor | aberto |
| SEC-06 | `public/app.js` `publishBtn` → `changeVisibility(true)` | Publicar não pede confirmação, e a coleção expõe os **resumos pessoais** e todo link adicionado depois | Usar `askConfirm` ao publicar, avisando que título, URL e resumo ficarão públicos | aberto |
| BUG-01 | `public/app.js` `handleConfirmOk()` | Se `pending.done()` falhar depois de o diálogo fechar, o erro é escrito em `confirmError` (diálogo fechado) e o usuário não vê nada | Capturar o erro de `done()` e mostrá-lo em `linksState` com `ui.setMessage(..., 'error')` | aberto |
| A11Y-01 | `public/app.js` `confirmDeleteLink` / `confirmDeleteCollection` | Ao excluir, o botão que abriu o diálogo deixa de existir e o foco cai no `<body>` | Após `done`, mover o foco para `#linksState` ou `#main` (`tabindex="-1"` já existe). Verificar em T-09 | a verificar |
| A11Y-02 | `public/index.html` | Com usuário logado não há `<h1>` (`bootTitle` e `loginTitle` ficam escondidos; o app começa em `<h2>`) | Trocar `h2#contentTitle` por `h1` (ajustar o CSS `.content__title`) | aberto |
| DB-01 | `migrations/0002_bookmarks.sql` | `DROP TABLE IF EXISTS project_records` destrói dados sem aviso. Aceitável (tabela de exemplo do script oficial), mas é irreversível | Registrar no README/AGENTS.md que a tabela foi descartada de propósito | aberto |
| DB-02 | `functions/api/links/index.js` `create`, `functions/api/links/[id].js` `update` | `requireOwnedCollection` e o `INSERT`/`UPDATE` são consultas separadas; se a coleção for excluída entre as duas, a FK falha e a API responde 500 genérico | Raro. Alternativa: `INSERT ... SELECT ... WHERE EXISTS (SELECT 1 FROM collections WHERE id = ? AND user_id = ?)` | aberto |
| REQ-01 | `functions/api/auth/discord/callback.js`: `discordUser.global_name \|\| discordUser.username` | O requisito pede importar `username`; o código grava o nome de exibição (`global_name`) quando existe, e é ele que aparece na página pública | Confirmar a intenção; se for pedir o `username`, usar `discordUser.username` | aberto (confirmar) |

## 5. Casos automatizados (`node --test tests/api.test.mjs`)

Evidência: saída do `node --test tests/api.test.mjs` em 18/11/2026, às 18:31: `tests 115`, `pass 115`, `fail 0`, `skipped 0`. Na 1ª execução (18:28), o HTTP-01 falhou por um erro do próprio teste (o `fetch` não aceita corpo em requisição GET); a linha 1014 do teste foi corrigida e todos passaram na execução seguinte.

### Pré-requisitos

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| PRE-01 | Servidor responde; `/api/auth/me` sem cookie | 401 JSON | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PRE-02 | Sessão do usuário A é válida | 200 com `user_id` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PRE-03 | Sessão de B válida e de outro usuário | 200; `user_id` diferente de A | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### Autenticação (AUTH)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| AUTH-01 | GET `/api/auth/me` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-02 | GET `/api/collections` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-03 | POST `/api/collections` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-04 | PATCH `/api/collections/1` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-05 | DELETE `/api/collections/1` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-06 | PATCH `/api/collections/1/visibility` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-07 | GET `/api/links` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-08 | POST `/api/links` inválido e sem login | 401 (não 400) | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-09 | PATCH `/api/links/1` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-10 | DELETE `/api/links/1` sem login | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-11 | Cookie com sessão inexistente | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-12 | Cookie com formato inválido (5 variações) | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-13 | Sessão expirada | 401 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-14 | Logout apaga a sessão e limpa o cookie | 200; `Max-Age=0`; depois 401; sessão A intacta | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| AUTH-15 | `/api/auth/me` com sessão válida | chaves `user_id`, `username`, `avatar` (URL https) | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### Rotas do Discord (OAUTH)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| OAUTH-01 | `/api/auth/discord` | 302 para discord.com; `scope=identify`; `state` de 64 hex igual ao do cookie; cookie `HttpOnly; Secure; SameSite=Lax; Path=/api/auth/discord`; sem segredo na URL | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| OAUTH-02 | Callback com state inválido | 302 → `/?auth_error=invalid_state`; sem cookie de sessão | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| OAUTH-03 | Callback com `?error=access_denied` | 302 → `/?auth_error=access_denied` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| OAUTH-04 | Callback com state válido sem `code` | 302 → `/?auth_error=missing_code` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| OAUTH-05 | POST nas duas rotas do Discord | 405 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### Coleções (COL)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| COL-01 | Criar coleção | 201; `is_public false`, `public_slug null`, `link_count 0`, sem `user_id` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-02 | Nome vazio | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-03 | Nome só com espaços | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-04 | Nome com 81 caracteres | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-05 | Nome que não é texto | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-06 | Nome ausente | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-07 | Descrição com 501 caracteres | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-08 | Nome duplicado | 409 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-09 | Listar coleções | 200 com a coleção criada | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-10 | Renomear e alterar descrição | 200 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-11 | Renomear para nome existente | 409 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-12 | PATCH sem campos | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-13 | Id inválido (`abc`, `0`, `-1`) | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-14 | PATCH em coleção inexistente | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-15 | Excluir coleção apaga seus links | 200; link some; filtro pela coleção apagada → 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| COL-16 | Excluir coleção inexistente | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### Validação de links (VAL)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| VAL-01 | URL `javascript:` | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-02 | URL `ftp:` | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-03 | URL `data:` | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-04 | Texto que não é URL | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-05 | URL vazia | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-06 | URL com mais de 2048 caracteres | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-07 | Título vazio | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-08 | Título só com espaços | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-09 | Título com 201 caracteres | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-10 | Resumo com 1001 caracteres | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-11 | Status `Done` | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-12 | Status `para ler` (minúsculas) | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-13 | Status que não é texto | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-14 | `collection_id` ausente | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-15 | `collection_id` inválido | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-16 | `collection_id` inexistente | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-17 | JSON inválido | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-18 | Corpo é array | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-19 | Corpo maior que 16 KB | 413 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-20 | Nenhum caso inválido criou link | coleção continua vazia | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-21 | Erros só têm a chave `error` | sem stack trace | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-22 | Título ausente | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-23 | URL ausente | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-24 | URL `JaVaScRiPt:` | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| VAL-25 | URL `file:` | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### CRUD de links (LNK)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| LNK-01 | Criar link mínimo | 201; status "Para Ler"; sem `user_id` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-02 | `user_id` no corpo é ignorado | 201; sem `user_id`; link é do usuário da sessão | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-03 | Criar com os 3 status (inclui "Concluído") | 201; status idêntico, com acento | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-04 | Listar a coleção | 5 links | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-05 | PATCH título e status | 200 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-06 | PATCH com resumo vazio | 200; resumo `""` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-07 | PATCH com URL inválida | 400; link inalterado | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-08 | PATCH sem campos | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-09 | PATCH em link inexistente | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-10 | Mover link para outra coleção própria | 200 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-11 | Mover para coleção inexistente | 404; link não sai do lugar | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-12 | DELETE do link | 200; some da listagem | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-13 | DELETE repetido | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-14 | PUT em `/api/links/:id` | 405 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-15 | Id inválido em PATCH e DELETE | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| LNK-16 | Status "Concluído" em NFD | 201; gravado normalizado | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### Filtro combinado (FLT)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| FLT-01 | Só coleção C1 | f1, f2, f3, f4 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-02 | Só status Lendo | f2, f3, f5; todos "Lendo" | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-03 | C1 + Lendo | exatamente f2 e f3 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-04 | C2 + Concluído | exatamente f6 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-05 | C2 + Para Ler | lista vazia | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-06 | Parâmetros vazios | 200, sem filtro | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-07 | Status inválido | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-08 | `collection_id` inválido | 400 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| FLT-09 | `collection_id` inexistente | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### Isolamento entre usuários (ISO)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| ISO-01 | Listagens de A e B não se cruzam | sem dados do outro | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-02 | A renomeia coleção de B | 403/404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-03 | A exclui coleção de B | 403/404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-04 | A publica coleção de B | 403/404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-05 | A filtra links pela coleção de B | 403/404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-06 | A cria link na coleção de B | 403/404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-07 | A altera link de B | 403/404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-08 | A exclui link de B | 403/404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-09 | A move o próprio link para coleção de B | 403/404; link fica | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| ISO-10 | Dados de B intactos depois dos ataques | nome, visibilidade e link iguais | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### Coleção pública (PUB)

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| PUB-01 | Slug válido inexistente, sem login | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-02 | Slugs de formato inválido | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-03 | Coleção privada por id ou nome | 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-04 | Publicar | 200; `is_public true`; slug válido | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-05 | Publicar de novo | mesmo slug | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-06 | Coleção pública sem login | 200; JSON; `no-store`; 3 links | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-07 | Contrato da resposta pública | só `collection{name,description,owner{username,avatar}}` e `links{url,title,summary,status}`; sem `user_id` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-08 | Ordem de inclusão | P1, P2, P3 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-09 | POST/PUT/PATCH/DELETE na rota pública | 405 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-10 | `is_public` inválido ou ausente | 400; continua pública | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-11 | Despublicar | slug `null`; link antigo 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-12 | Republicar | slug novo; antigo 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| PUB-13 | Excluir coleção pública | link 404 | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

### XSS e HTTP

| ID | Caso | Esperado | Resultado | Evidência |
|----|------|----------|-----------|-----------|
| XSS-01 | HTML em nome, título e resumo | guardado literalmente; resposta `application/json` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| HTTP-01 | Métodos não suportados (9 rotas) | 405 com `Allow` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |
| HTTP-02 | Erros 400/401/404/405 | JSON `{"error": "..."}` | ✅ passou | `node --test tests/api.test.mjs`: 115 de 115 (18/11/2026, 18:31) |

## 6. Casos manuais (detalhe item a item em `CHECKLIST_MANUAL.md`)

| Bloco | Itens | Resultado | Evidência |
|-------|-------|-----------|-----------|
| A. Fluxo completo (login, coleções, links, filtro, publicar, aba anônima, logout) | F-01 a F-25 | a preencher | a preencher |
| B. Responsividade 360 / 768 / 1280 px | R-01 a R-13 | a preencher | a preencher |
| C. Navegação por teclado | T-01 a T-11 | a preencher | a preencher |
| D. XSS | X-01 a X-10 | a preencher | a preencher |
| E. Chave no rodapé | K-01 a K-06 | a preencher | a preencher |
| F. Requisitos estáticos | E-01 a E-15 | a preencher | a preencher |
| G. Produção | D-01 a D-06 | a preencher | a preencher |

## 7. Conclusão

Resultado geral: a preencher.

Pendências para fechar o relatório: executar as seções 5 e 6; resolver ENC-01, DEP-01 e A11Y-01 (marcados "a verificar"); decidir SEC-02 e REQ-01 com o professor ou o responsável pelo projeto; anexar a saída do `node --test` e os prints.