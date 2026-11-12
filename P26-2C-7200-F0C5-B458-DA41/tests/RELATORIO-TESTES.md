# Relatório de Testes — Agente 3 (Teste e Validação)

**Projeto #38 — Issue Tracker · Chave Única: P26-2C-7200-F0C5-B458-DA41**

- **Data:** 2026-11-12
- **Ambiente:** Linux · Node.js v22.23.4 · npm 10.9.9 · wrangler 4.161.0 (instalado fora do projeto, em `/tmp/wr`) · D1 local (miniflare/workerd)
- **Resultado final (Rodada 2):** **120 testes, 120 aprovados, 0 falhas** (64 unitários + 56 de API). Na Rodada 1 foram 114/114. Sem `BASE_URL`, os testes de API são pulados (`# SKIP`) e `node --test` continua passando (64/64).

## 1. Comandos executados

```bash
# 1) Testes unitários (sem Cloudflare)
node --test                      # ou: npm test   (acha tests/*.test.mjs)

# 2) Servidor local (wrangler fora do projeto; estado do D1 fora do projeto)
npm i wrangler --prefix /tmp/wr
export PATH=/tmp/wr/node_modules/.bin:$PATH
wrangler d1 migrations apply DB --local --persist-to /tmp/wr/state
wrangler d1 execute DB --local --persist-to /tmp/wr/state --file /tmp/wr/seed.sql   # usuários + sessões (abaixo)
wrangler pages dev public --port 8788 --persist-to /tmp/wr/state \
  --binding ADMIN_DISCORD_IDS=100000000000000001 &

# 3) Testes de API
export BASE_URL=http://localhost:8788 TOKEN_TECH=... TOKEN_AUTHOR=... TOKEN_OTHER=... \
       TOKEN_SPAM=... TOKEN_LOGOUT=... TOKEN_EXPIRED=... TOKEN_POOL=tok1,tok2,... ID_AUTHOR=200000000000000002 \
       BASE_URL_NO_MIGRATION=http://localhost:8789   # opcional: 2º servidor com D1 sem migrações (Rodada 2)
node --test

# 4) Rubrica (na raiz do fork)
node validar-local.mjs P26-2C-7200-F0C5-B458-DA41
```

**Como os usuários/sessões foram criados** (o login real exige o Discord): para cada usuário, um token aleatório de 64 hex; no D1 vai só o SHA-256 dele; o teste manda o cookie `it_session=<token>`.

```bash
node -e '
const c=require("crypto"), exp=new Date(Date.now()+2*864e5).toISOString();
const t=c.randomBytes(32).toString("hex"), h=c.createHash("sha256").update(t).digest("hex");
console.log(`INSERT INTO users (user_id,username) VALUES (\x27100000000000000001\x27,\x27tech\x27);`);
console.log(`INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (\x27${h}\x27,\x27100000000000000001\x27,\x27${exp}\x27);`);
console.error("TOKEN_TECH="+t);' > /tmp/wr/seed.sql
```
Usuários usados: técnico `100000000000000001` (em `ADMIN_DISCORD_IDS`), autor `200000000000000002`, outro `300000000000000003`, spam `400000000000000004` (só para o teste de limite), 12 usuários "pool" (`TOKEN_POOL`, para a suíte poder rodar várias vezes na mesma hora sem bater no limite de 10 chamados/hora), uma sessão vencida (`TOKEN_EXPIRED`) e uma descartável para logout (`TOKEN_LOGOUT`).

## 2. Testes unitários — `tests/rules.test.mjs` (64/64 ✅)

| Grupo | O que cobre | Resultado |
|---|---|---|
| constantes | chave única, 4 estados, 4 severidades, destinos da máquina são estados válidos | ✅ |
| `cleanText` | não-string → `""`, controles → espaço (linha única), `\r\n` → `\n` e `\t` preservado (multilinha), NFC | ✅ |
| `validateTicketInput` | título 5..120 (limites exatos, 120 emojis = 120 caracteres), só espaços/controles, não-string, local 2..80, descrição 10..4000, severidade inválida (`urgente`, vazia, número, `__proto__`, `toString`, `constructor`), todas as válidas, `<script>` aceito como texto, campos extras descartados | ✅ |
| `validateComment` | vazio, só espaços, 1 caractere, só controles, `null`, 2000 ok / 2001 rejeitado, aparo + quebras de linha | ✅ |
| `validateStatusChange` | destino desconhecido/maiúsculo/protótipo, nota opcional, 1000 ok / 1001 rejeitado | ✅ |
| máquina de estados | **todas as 16 combinações** (6 válidas, 10 inválidas), `resolvido` final, estados desconhecidos/protótipo | ✅ |
| `ADMIN_DISCORD_IDS` | separadores `, ; espaço \n`, lixo ignorado, vazio = ninguém, comparação como string | ✅ |
| permissões | técnico (todas as válidas ok; inválida 409), resolvido 409 para todos, autor só `resolvido` (403 no resto), outro usuário 403, 409 tem prioridade sobre 403, `allowedTransitionsFor` espelha `canChangeStatus` | ✅ |
| código `CH-XXXXXX` | formato, alfabeto Crockford sem I/L/O/U (2000 sorteios), pede 6 bytes, `normalizeTicketCode` (minúsculas, espaços, formatos inválidos, `../`, `\n`) | ✅ |
| filtros da listagem | vazio, válidos, desconhecidos/protótipo ignorados, `mine` só com `1`, `q` limpo e cortado em 80 | ✅ |
| `parseCookies` | vários cookies, `=` no valor, cabeçalho ausente/malformado, percent-encoding inválido | ✅ |

## 3. Testes de API — `tests/api.test.mjs` (Rodada 1: 50/50 ✅ · Rodada 2: 56/56 ✅)

### 3.1 Casos obrigatórios da skill

| Caso | Esperado | Obtido | |
|---|---|---|---|
| `GET /api/tickets` sem cookie | 401 | 401 JSON `{ok:false}` | ✅ |
| `POST /api/tickets` sem header `Origin` | 403 | 403, total de chamados inalterado | ✅ |
| `POST /api/tickets` com Origin de outro site (`evil.example`, `null`, `localhost.evil.example`) | 403 | 403 | ✅ |
| `POST /api/tickets` com título de 2 letras | 422 + `errors.title` | 422 + `errors.title` | ✅ |
| `POST /api/tickets` com severidade `"urgente"` | 422 + `errors.severity` | 422 + `errors.severity` | ✅ |
| `POST /api/tickets` válido | 201 + `code` `CH-XXXXXX` | 201, `CH-…` válido, 1 evento `criado`, `id` interno não vaza | ✅ |
| Usuário comum move para `em_analise` | 403 | 403 (autor e outro); outro usuário tentando `resolvido` também 403 | ✅ |
| Técnico move aberto → aguardando (pula etapa) | 409 | 409, nenhum evento gravado | ✅ |
| Técnico aberto → em_analise → aguardando → resolvido | 200 em cada passo, 4 eventos | 200 ×3; eventos `criado(→aberto)`, `aberto→em_analise`, `em_analise→aguardando` (com nota), `aguardando→resolvido` (com nota), ids crescentes e datas não-decrescentes; `resolved_at` preenchido; depois disso qualquer transição = 409 | ✅ |
| Comentar em chamado resolvido | 409 | 409, nada gravado (autor resolveu o próprio chamado: 200) | ✅ |
| `GET /api/tickets/CH-ZZZZZZ` | 404 | 404 (também `abc`, `CH-IIIIII`, tentativa de SQL na URL; status/comentário em código inexistente → 404) | ✅ |
| Título com `<script>` | salvo como texto, nunca executado | API devolve o texto idêntico; `app.js` não usa `innerHTML`/`insertAdjacentHTML`/`document.write`/`eval` (só `createTextNode`); CSP sem `unsafe-inline` | ✅ |
| 11º chamado na mesma hora | 429 | 10 × 201 e o 11º = 429; outro usuário continua abrindo (limite é por usuário) | ✅ |

### 3.2 Casos extras

| Caso | Esperado | Obtido | |
|---|---|---|---|
| `GET /api/status` | 200, chave, `d1Connected:true` | idem | ✅ |
| `GET /api/me` sem cookie / técnico / comum | `user:null` / `admin:true` / `admin:false` | idem | ✅ |
| Cookie malformado, desconhecido, MAIÚSCULO ou sessão vencida | não logado (401 nas rotas) | idem | ✅ |
| `GET /` | HTML com a chave no `<footer>` e os 4 cabeçalhos de `public/_headers` | idem (comparado linha a linha com o arquivo); sem script/estilo inline | ✅ |
| `functions/_lib/*` como rota (`/_lib/rules.js`, `/functions/_lib/rules.js`, `/api/_lib/rules.js`, …) | não expor código nem executar | só o fallback `index.html`; nenhum código-fonte, nenhum JSON de API; POST não cria nada | ✅ |
| `/api/auth/discord` sem credenciais | erro tratado | JSON `{ok:false, error:"Discord OAuth2 não configurado…"}` (Rodada 1: status 500; Rodada 2: 503) | ✅ |
| Callback sem `code` / `state` errado / `error=access_denied` / sem credenciais | 302 `/?auth_error=…` | `missing_code`, `invalid_state`, `access_denied`, `oauth_not_configured`; cookie de state apagado | ✅ |
| Corpo não-JSON, JSON inválido, array, `null`, corpo > 16 KB | 400 | 400 | ✅ |
| Campos extras (`status`, `author_id`, `code`) no POST | ignorados | chamado nasce `aberto`, autor = quem está logado | ✅ |
| Status inválido / nota > 1000 / sem Origin | 422 / 422 / 403 | idem; estado não muda | ✅ |
| Comentário vazio / sem Origin / sem cookie | 422 / 403 / 401 | idem; nada gravado | ✅ |
| `PUT`/`PATCH`/`DELETE` | 405/404, nada executa | Rodada 1: 405; Rodada 2: 404 JSON (catch-all) | ✅ |
| Linha do tempo com comentário | `criado`, `status`, `comentario` em ordem; `\r\n` → `\n`; contagem na listagem | idem | ✅ |
| Filtros `q` (título/local/código, minúsculas), `%` e `_` escapados | só resultados que contêm o texto literal | idem | ✅ |
| Filtros `status`, `severity`, `mine=1` e combinação | só os chamados certos | idem | ✅ |
| Filtros desconhecidos | ignorados | mesma lista que sem filtro; `totals` soma = `totalTickets` | ✅ |
| Ordenação | resolvidos por último; crítica → baixa | idem | ✅ |
| Logout sem Origin / com Origin | 403 (sessão continua) / 200 + cookie apagado + sessão removida do D1 | idem | ✅ |

### 3.3 `changes()` dentro do `DB.batch` em `functions/api/tickets/[code]/status.js`

| Verificação | Esperado | Obtido | |
|---|---|---|---|
| UPDATE afeta 1 linha (via API) | exatamente 1 evento `status` com from/to/nota certos | idem | ✅ |
| 5 rodadas × 8 requisições simultâneas `aberto→em_analise` (via API) | 1 × 200, 7 × 409, **1 só evento** por chamado | idem em todas as rodadas; entre 2 e 7 das respostas 409 vieram do caminho `changes()=0` ("alterado por outra pessoa"), ou seja, o UPDATE não afetou linhas e o INSERT não gravou nada | ✅ |
| Transição inválida | não toca o banco | `updated_at` igual, nenhum evento | ✅ |
| Checagem determinística com o mesmo SQL via `getPlatformProxy` do wrangler (script temporário em `/tmp`, D1 separado) | estado obsoleto → 0 linhas → nenhum evento | `aberto→em_analise: UPDATE.changes=1 INSERT.changes=1 eventos=1`; repetir `aberto→em_analise`: `UPDATE.changes=0 INSERT.changes=0 eventos=1`; `aberto→resolvido` obsoleto: `0/0, eventos=1`; `em_analise→aguardando`: `1/1, eventos=2` | ✅ |

**Conclusão:** o `changes()` funciona como pretendido dentro do `DB.batch` (as instruções rodam em sequência na mesma conexão/transação): grava o evento só quando o UPDATE mudou a linha.

## 4. Rubrica — `node validar-local.mjs P26-2C-7200-F0C5-B458-DA41`

```
✅ [OK]       1. Arquivo LICENSE (MIT)
✅ [OK]       2. Chave Única no README.md
✅ [OK]       3. Chave Única no rodapé do HTML
⚠️ [PENDENTE] 4. Documento AGENTS.md (Mín. 3 agentes)
⚠️ [PENDENTE] 5. Agente de Teste e Validação documentado
✅ [OK]       6. Arquivos de Skills na pasta skills/
✅ [OK]       7. Frontend HTML/CSS/JS Puro (Sem frameworks proibidos)
✅ [OK]       8. Backend Cloudflare Functions + D1 + Discord OAuth2
⚠️ [PENDENTE] 9. Deploy Online na Cloudflare (https://seu-projeto.pages.dev)
```
O item 9 é esperado (deploy ainda não feito). **Os itens 4 e 5 ficam pendentes porque `AGENTS.md` não existe na pasta do projeto** — o README (linhas 61 e 102) já aponta para ele. Precisa ser criado antes da entrega.

## 5. Bugs encontrados e correções

| # | Bug | Correção | Arquivo |
|---|---|---|---|
| 1 | `node --test tests/` (script `npm test` e comando das skills) **falha no Node 22+** com `MODULE_NOT_FOUND`: o Node trata `tests/` como módulo, não como pasta. | Script trocado para `node --test` (sem argumento, acha `tests/*.test.mjs` em qualquer versão ≥ 20); comando corrigido nas skills. Rodado de novo: 114/114. | `package.json`, `skills/teste-validacao/SKILL.md`, `skills/serverless-d1-discord/SKILL.md` |

Nenhum bug de regra de negócio, permissão, máquina de estados ou segurança foi encontrado.

### Observações da Rodada 1 (devolvidas ao Agente 1/backend — A–D corrigidas na Rodada 2, ver seção 7)

- **A. Erros do D1 não tratados viram 500 genérico do runtime.** Testado com um servidor sem migrações: `GET /api/tickets` com cookie em formato válido devolve `Error: D1_ERROR: no such table: sessions` (com stack trace no dev; em produção, página de erro da Cloudflare). Cenário real: esquecer `wrangler d1 migrations apply DB --remote`. Nesse caso `/api/status` diz `d1Connected:false`, o que confunde (o D1 está ligado, faltam as tabelas). Sugestão: `functions/api/_middleware.js` com `try/catch` devolvendo JSON 500/503 e mensagem "aplique as migrações".
- **B. `/api/auth/discord` sem credenciais devolve status 500** (JSON tratado, com mensagem clara). Como é falta de configuração, 503 ou redirecionar para `/?auth_error=oauth_not_configured` (a UI já tem essa mensagem) seria mais adequado. Impacto baixo: a UI já desabilita o botão quando `discordConfigured` é falso.
- **C. Rotas `/api/...` inexistentes devolvem 200 com o `index.html`** (fallback de SPA do Pages), não 404 JSON. A UI trata (resposta não-JSON vira erro), mas um `functions/api/[[path]].js` com 404 JSON deixaria a API mais limpa.
- **D. Abertura de chamado não é atômica** (`functions/api/tickets/index.js`, linhas 73–80): o INSERT do chamado e o do evento `criado` são separados; se o segundo falhar, fica um chamado sem evento inicial. Sugestão: `DB.batch` com `INSERT INTO ticket_events … SELECT id … FROM tickets WHERE code = ?`.
- **E.** Comentários não têm limite de taxa (só a abertura de chamados tem 429). A listagem tem `LIMIT 200` sem paginação.
- **F. (só no ambiente local)** `GET /_headers` devolve 502 no `wrangler pages dev` (detalhe do servidor local). Em produção o Pages não serve esse arquivo. Não é bug do projeto.

## 6. Pendências (só a aluna pode testar)

- **Login real com Discord:** troca do `code` por `access_token`, leitura de `/users/@me`, gravação de `user_id`/nome/avatar no D1, cookie de sessão em HTTPS. Só os caminhos de erro do callback foram testados aqui.
- **Deploy no Cloudflare Pages:** binding D1 `DB` com o `database_id` real no `wrangler.jsonc`, `wrangler d1 migrations apply DB --remote`, variáveis `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `ADMIN_DISCORD_IDS`, redirect URI no Discord e URL real no README (item 9 do validador).
- **Criar `AGENTS.md`** (itens 4 e 5 do validador).
- **Teste visual no navegador:** a segurança contra XSS foi conferida pela API e por análise do `app.js` + CSP, não por um navegador real. Vale abrir um chamado com `<script>alert(1)</script>` no título e conferir que aparece como texto.

## 7. Rodada 2 — correções do backend (2026-11-12)

O Agente 1 corrigiu as observações A–D. Wrangler reinstalado em `/tmp/wr`, D1 local migrado e semeado de novo (mesmos usuários da seção 1), servidor principal em `:8788` e **um segundo servidor em `:8789` com D1 sem migrações** (`--persist-to /tmp/wr/empty-state --inspector-port 9330`), exportado em `BASE_URL_NO_MIGRATION`.

| Correção | Arquivo | Teste | Esperado | Obtido | |
|---|---|---|---|---|---|
| A. Erros inesperados viram JSON 500 limpo | `functions/api/_middleware.js` (novo) | `GET /api/tickets`, `GET /api/tickets/CH-ZZZZZZ`, `POST /api/tickets` no servidor sem migrações, com cookie em formato válido | 500 JSON, `ok:false`, dica de migração, sem stack | 500 `{"ok":false,"error":"Banco D1 sem tabelas: rode 'wrangler d1 migrations apply DB --remote'."}`; nenhum `at …(`, `D1_ERROR`, `SQLITE`, `cloudflare-internal` ou `arquivo.js:linha`; `/api/me` e `/api/status` continuam 200 | ✅ |
| B. Discord não configurado = 503 | `functions/api/auth/discord.js` | `GET /api/auth/discord` sem credenciais | 503 JSON | 503 JSON com a mensagem sobre `DISCORD_CLIENT_ID` | ✅ |
| C. `/api/*` inexistente = 404 JSON | `functions/api/[[path]].js` (novo) | `GET`/`POST /api/rota-inexistente`, `/api/tickets/CH-ZZZZZZ/foo`, `/api/auth/xyz`, `/api/_lib/rules.js` | 404 JSON, sem HTML | idem | ✅ |
| C. (regressão) catch-all não engole rotas reais | — | `/api/status`, `/api/me`, `/api/tickets` (401 sem cookie / 200 com), callback (302), `/` (HTML com a chave) e toda a suíte da Rodada 1 | sem mudança | sem mudança | ✅ |
| D. Abertura atômica (`DB.batch`) | `functions/api/tickets/index.js` | chamados criados em pares simultâneos: cada um tem **exatamente 1 evento**, do tipo `criado`, `to_status=aberto`, autor = autor do chamado | 1 evento | 1 evento | ✅ |
| D. Criação rejeitada não deixa lixo | `functions/api/tickets/index.js` | 422, 403 (sem Origin) e 429 seguidos | `totalTickets` inalterado | inalterado | ✅ |
| D. Integridade no banco (consulta direta ao D1 local ao fim da execução) | — | `wrangler d1 execute … --command "SELECT …"` | todo chamado com exatamente 1 `criado`, nenhum evento órfão | `chamados=56, eventos_criado=56, chamados_sem_exatamente_1_criado=0, eventos_orfaos=0` | ✅ |

**Placar da Rodada 2:** `node --test` com os dois servidores → **120 testes, 120 aprovados, 0 falhas, 0 pulados**. Uma segunda execução na mesma hora deu 119 aprovados e 1 pulado (o teste de logout, porque `TOKEN_LOGOUT` já tinha sido destruído; comportamento esperado). As corridas de status passaram de novo pelo caminho `changes()=0` sem gravar evento duplicado.

Observação menor (não é falha): com o catch-all, métodos não suportados em rotas existentes (ex.: `PUT /api/tickets`) agora devolvem **404 JSON** em vez de 405. Nada é executado; o teste aceita 404 ou 405.

O `validar-local.mjs` **não** foi rodado nesta rodada, a pedido da coordenação (o `AGENTS.md` está sendo escrito).

## 8. Limpeza

O wrangler foi instalado e o estado do D1 foi guardado em `/tmp/wr`, fora do projeto, nas duas rodadas. No fim de cada rodada: servidor parado e nenhuma pasta `.wrangler/`, `node_modules/` nem arquivo `.dev.vars` deixados na pasta do projeto (`ADMIN_DISCORD_IDS` foi passado com `--binding`, sem `.dev.vars`).
