# Relatório de Testes e Validação — P26-3A-5E56-230D-1716-D540

- **Data:** 2026-11-09 19:56 (America/Sao_Paulo). Rodada final, depois do registro dos tetos de entrada na seção 6.5 e da correção do D3.
- **Agente:** Teste e Validação (`.claude/agents/testador-validador.md`, skill `skills/teste-validacao/SKILL.md`)
- **Base dos casos:** `docs/ESPECIFICACAO.md` (seções 1–6, incluindo a 6.11 acrescentada pela auditoria de segurança), **não** o código.
- **Ambiente:** Node v22.23.2, wrangler 4.159.0, `wrangler pages dev` + D1 **local**. Nada `--remote`, nenhum deploy.

## Resumo

| Camada | Comando | Testes | Passou | Falhou |
|---|---|---:|---:|---:|
| Unitário (validações) + estático (seção 5) | `npm test` | 43 | 43 | 0 |
| API ponta a ponta (local) | `npm run test:api` | 118 | 118 | 0 |
| Rubrica | `node validar-local.mjs P26-3A-5E56-230D-1716-D540` (na raiz do repo) | 9 itens | 8 ✅ | 1 ⚠️ (deploy, esperado) |
| Escopo do PR | `git status --porcelain` / `git diff --name-only 838337e..HEAD` | — | só a pasta da chave | — |

Nenhuma falha aberta. Os três defeitos encontrados (D1, D2 e D3) foram resolvidos e os testes que os cobrem passam. O teste estático da seção 5 não encontrou nada em `public/` depois das mudanças de CSS do front-end.

## Como rodar

```bash
cd P26-3A-5E56-230D-1716-D540
export PATH=/home/alexandre/.nvm/versions/node/v22.23.2/bin:$PATH
npm test            # node --test tests/validacao.test.mjs tests/estatico.test.mjs
npm run test:api    # bash tests/rodar-api.sh (prepara o D1, sobe o servidor, testa e derruba)
```

Arquivos em `tests/`:

| Arquivo | Papel |
|---|---|
| `validacao.test.mjs` | Unitário: importa `functions/_lib/validacao.js` com relógio injetado (limites 2/3, 80/81, 9/10, 1000/1001, 120/121, emoji como 1 caractere, controles e bidi, data futura, fuso de SP na virada UTC, exatamente 1 ano, ano bissexto, filtros, ids). O teste do `escaparLike` foi retirado porque as rotas não usam mais esse helper, que agora só existe em `validacao.js`. |
| `estatico.test.mjs` | Seção 5 estática: front-end sem `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`document.write`/`eval`; só scripts locais; chave no rodapé; `.dev.vars` no `.gitignore`; o valor do secret do `.dev.vars` não aparece em nenhum arquivo (o valor nunca é impresso); nenhuma interpolação de dado da requisição dentro de `prepare()` (28 `prepare` verificados; as interpolações são só constantes do servidor: `SELECT_ITEM`, `where`, `ordem`, `AGORA`, `quemPode`, `itemEncerrado`, `SELECT_REIVINDICACAO`). |
| `api.test.mjs` | API ponta a ponta contra `BASE_URL` (padrão `http://localhost:8788`). |
| `fixtures.mjs` / `semente.mjs` | Usuários A–G e S, tokens de sessão e 6 itens-semente (marcados com `zebrafiltro`). |
| `preparar.sh` | Apaga `.wrangler/state`, roda `wrangler d1 migrations apply DB --local` e semeia via `wrangler d1 execute DB --local --file`. Sessões: SHA-256 hex do token, como documentado em `functions/_lib/sessao.js`; a sessão de G já nasce expirada. |
| `rodar-api.sh` | Recusa rodar se a porta estiver ocupada, chama `preparar.sh`, sobe `npx wrangler pages dev --port $PORTA`, espera `/api/status`, roda `node --test tests/api.test.mjs` e derruba o wrapper npx, o wrangler e o workerd **pelos PIDs** (árvore via `pgrep -P`, sem `pkill -f`). |

Reprodutível: cada `npm run test:api` começa com o banco zerado. Rodei a bateria 6 vezes enquanto adicionava casos; com o mesmo conjunto de testes, as rodadas repetidas deram resultado idêntico. Ao fim de cada rodada nenhum processo ficou na porta 8788.

## Saída real (última rodada)

```
$ npm test
# tests 43
# pass 43
# fail 0

$ npm run test:api
== preparar: semente → usuarios 8, sessoes 7, itens 6
{"ok":true,"d1":true,"oauth_configurado":true,"chave":"P26-3A-5E56-230D-1716-D540"}
ok 1 - saúde e sessão (seção 3)
ok 2 - POST /api/itens — criação e validação (4.2 e 5)
ok 3 - GET /api/itens — filtros cruzados (4.1 e 6.5)
ok 4 - detalhe, rotas e métodos (6.1, 6.3, 6.6)
ok 5 - fluxo de reivindicação, contatos e encerramento (4.3)
ok 6 - recusar, cancelar, encerrar aberto e apagar (4, 4.3, 6.7)
ok 7 - ataques e cabeçalhos de segurança (5)
ok 8 - limite de criação (4.2 e 6.8)
    ok 10 - tetos de entrada (6.5): pagina=10001 → 400; local com 121 chars → 400
    ok 11 - q e local no tamanho máximo do contrato não quebram (200, nunca 500)
    ok 28 - curingas são literais: q=%, q=_cinza, q=100%, q=_; q=30×ã → 200
# tests 118
# pass 118
# fail 0
== servidor: derrubando PIDs <npx> <sh> <wrangler> <node cli> <workerd> ...
```

## O que a bateria de API cobre (todos ✅)

- **Sessão e OAuth (seção 3):** `/api/me` anônimo → `{usuario:null}`. Com sessão, devolve só os 4 campos. Sessão expirada, token inexistente, cookie malformado ou o próprio hash usado como token → `null`. O cookie de sessão é reconhecido no meio de outros cookies. `/api/auth/discord` → 302 para `discord.com/oauth2/authorize` com `scope=identify`, `state` aleatório e diferente a cada login, cookie `oauth_state` HttpOnly, Secure, SameSite=Lax e `Max-Age=600`. No callback: state errado ou sem cookie → `state_invalido`, sem sessão criada e com `oauth_state` expirado; `error=` → `negado`. Logout apaga a sessão no D1 (o token antigo deixa de valer), expira o cookie e exige `Origin`.
- **Criação (4.2, 5, 6.1):** sem sessão ou com sessão expirada → 401. Item válido → 201 no formato `Item`, com trim e `\t` virando espaço. Campos extras ignorados (não dá para forjar `status`, `autor_id` nem `id`). `charset=utf-8` é aceito. Quatorze entradas inválidas → 400 com `campos.<campo>`, entre elas: data futura em SP, anterior a 1 ano, inexistente e em outro formato; título só com controles ou bidi. Hoje e exatamente 1 ano atrás → 201. `Origin` de outro site, ausente, `null`, com sufixo `.evil`, em outra porta ou em `127.0.0.1` → 403. `text/plain` e form-urlencoded → 415. JSON malformado, vazio ou array → 400. Corpo de exatamente 8192 bytes → 201; acima disso → 413 `corpo_grande`, também em **chunked, sem Content-Length**.
- **Filtros (4.1, 6.5):** formato `{itens,total,pagina,por_pagina,contagens}`. O padrão exclui encerrados; `status=todos` e `status=encerrado` funcionam. `tipo+categoria+q` cruzados devolvem só o que bate nos três. `q` busca em título, descrição e local; `local` funciona como "contém"; `de`/`ate` filtram a data. `contagens` saem antes da paginação, com todas as chaves (inclusive as zeradas). Paginação e `ordem=antigos` (inversa de `recentes`) corretas; página além do fim, dentro do teto (99 e 10000), devolve 200 com lista vazia; valor vazio é tratado como ausente. Tetos da 6.5: `pagina=10001` e `local` com 121 caracteres → 400. Treze filtros inválidos → 400, inclusive `de>ate`, `q` com 61 caracteres e `tipo=perdi' OR '1'='1`. `meus=1` sem login → 401; com login, só os itens do próprio usuário.
- **SQL injection:** 5 cargas em `q` → 200 com 0 itens, sem `SQLITE` nem `token_hash` na resposta, e a tabela continua íntegra. Os caracteres `%` e `_` são literais: `q=%` e `q=100%` só encontram "Casaco 100% lã", `q=_` só encontra o item que tem `_` no texto e `q=_cinza` não casa com `fonecinza`. Termos no tamanho máximo também respondem 200: `q` com 49 e 60 caracteres, 30 × `ã` (60 bytes), 30 × `%` e `local` com 120.
- **Rotas (6.1, 6.3, 6.6):** id não numérico → 400; inexistente → 404. Detalhe anônimo traz `reivindicacoes: []` e `permissoes` todas falsas. Rota desconhecida → 404 em JSON; PUT e PATCH → 405; ação desconhecida → 404.
- **Reivindicação (4.3):** quem reivindica o próprio item recebe 403; mensagem com 9 ou 501 caracteres → 400. Reivindicação de B → 201, com `contato_autor=usuario_a` e `contato_reivindicante=usuario_b`. B de novo → 409; C → 201.
  - **Contatos:** o autor vê as duas reivindicações; B só vê a dele, C só a dele, e nenhum vê o contato do outro. Para um terceiro (E) e para o anônimo, `reivindicacoes: []` e nenhum `contato_` em detalhe, lista ou `/api/reivindicacoes`.
  - **Permissões:** o terceiro E recebe 403 em aceitar, recusar, cancelar e encerrar. C (não autor) e B tentando aceitar → 403. Aceitar sem `Origin` → 403. Reivindicante só com pendente tentando encerrar → 403.
  - **Aceite:** o autor aceita → reivindicação `aceita` e item `em_devolucao`. Aceitar de novo, aceitar outra, fazer nova reivindicação ou apagar o item nesse estado → 409.
  - **Encerramento:** o reivindicante aceito encerra → item `encerrado` com `encerrado_em`, a aceita vira `concluida` e a outra pendente vira `recusada`. `total_reivindicacoes` ignora só as canceladas. O item sai da lista padrão e aparece com `status=todos`. Encerrar de novo → 409. Os contatos continuam visíveis às duas partes.
- **Recusar, cancelar e apagar (6.7):** recusa → `recusada`; recusar de novo ou aceitar uma recusada → 409, e quem foi recusado pode reivindicar de novo. O autor cancelando uma pendente → 409. O cancelamento da aceita (pelo reivindicante ou pelo autor) devolve o item para `aberto`, e a cancelada não conta no total. O reivindicante cancela a própria pendente. Reivindicante tentando recusar ou aceitar a própria → 403. Encerrar item aberto com pendente → 409; sem reivindicação → 200. DELETE: não autor → 403, sem login → 401, `Origin` estranho → 403, autor → `{ok:true}` e depois 404. DELETE de item aberto com pendente → 200 (a reivindicação some junto). DELETE de item encerrado → 409.
- **6.11 (auditoria):** 5 reivindicações do mesmo usuário no mesmo item, alternando cancelada e recusada → todas 201; a 6ª → `429 limite_excedido`. O limite é por usuário: outro usuário ainda consegue reivindicar. `reivindicacao.item.autor` traz exatamente `{user_id, username, nome_exibicao, avatar_url}`, coerente com `autor_id`.
- **Ataques e cabeçalhos (5):** XSS armazenado volta como dado, com `Content-Type: application/json`. A API manda CSP com `frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy e HSTS. A página `/` tem CSP com `default-src 'self'`, `img-src` liberando `cdn.discordapp.com` e `frame-ancestors 'none'`, além dos demais cabeçalhos e da chave no HTML. Erros não expõem pilha nem SQL.
- **Limite de criação (4.2, 6.8):** 10 itens passam e o 11º → 429; outro usuário segue criando. Uma rajada de 8 requisições concorrentes não ultrapassa o total de 10 por hora.

## Defeitos e divergências

### D3 — `q` ou `local` válidos e longos devolviam 500 (gravidade média, CORRIGIDO)
- **Arquivo (antes da correção):** `functions/api/itens/index.js:32` (`q`) e `:38` (`local`). Os dois montavam `%${escaparLike(...)}%` para usar com `LIKE ... ESCAPE`.
- **Causa:** o D1 limita o padrão do LIKE/GLOB a **50 bytes**. O log do wrangler mostra `D1_ERROR: LIKE or GLOB pattern too complex: SQLITE_ERROR`. Como o limite vale também para o D1 de produção, o defeito aparece em produção, não só no ambiente local.
- **Medido com sonda local:** com `local` ou `q` de 48 caracteres ASCII → 200; com 49 → **500**. O limite é em bytes e conta o padrão já escapado, então estoura bem antes dos 60 caracteres: 30 `ã` (60 bytes) → 500, e 30 `%` (60 bytes depois do escape) → 500.
- **Entradas e resultados (todas válidas pelo contrato, 4.1 e 6.5):**

  | Entrada | Esperado | Obtido |
  |---|---|---|
  | `GET /api/itens?q=` + 49 ou 60 × `a` | 200 | 500 `interno` |
  | `GET /api/itens?local=` + 120 × `a` | 200 | 500 `interno` |

- **Correção sugerida:** trocar o LIKE por `instr(lower(i.titulo), lower(?)) > 0` (o mesmo para `descricao` e `local`). `instr` não tem limite de padrão, dispensa `escaparLike` e o `ESCAPE`, e `lower()` do SQLite tem a mesma insensibilidade a maiúsculas que o LIKE (só ASCII). O que não serve é baixar os tetos para 48 bytes, porque isso muda o contrato e o escape continua dobrando o tamanho do padrão.
- **Teste que cobre:** `q e local no tamanho máximo do contrato não quebram (200, nunca 500)` em `tests/api.test.mjs`.
- **Correção:** feita pelo back-end em `functions/api/itens/index.js:31-41`. A busca agora usa `instr(lower(col), lower(?)) > 0` com o termo cru, então `%` e `_` são literais. Os testes de tamanho máximo e o de curingas (`q=100%`, `q=_`, `q=30×ã`) passam.

### D1 — `pagina` acima de 10000 → 400 sem previsão no contrato (RESOLVIDO no contrato)
Ficou registrado na seção 6.5: "Tetos de entrada: `pagina` 1..10000 e `local` (filtro) até 120 caracteres — acima disso → 400". O teste agora verifica `pagina=10001` → 400 e `local` com 121 caracteres → 400; os dois passam.

### D2 — URL de deploy do README ≠ projeto publicado (RESOLVIDO)
O README atual aponta para `https://achados-perdidos-campus.pages.dev`, que é o projeto que `scripts/publicar.sh` publica. A versão que eu tinha lido era antiga.

### Observação de ambiente (não é defeito do app)
O proxy do `wrangler pages dev` reescreve `Origin: https://localhost:PORTA` para `http://localhost:PORTA` antes de a requisição chegar ao worker. Isso foi confirmado com um worker de eco à parte, numa pasta temporária e na porta 8795, já derrubado. Por isso a variante "mesmo host, outro esquema" do teste de CSRF **não pode ser testada localmente** e ficou fora. As outras origens forjadas não são reescritas e dão 403. Em produção não existe esse proxy, e a comparação `Origin === new URL(request.url).origin` continua estrita.

## Rubrica (`validar-local.mjs`)

```
$ cd /home/alexandre/Avalia2026-2 && node validar-local.mjs P26-3A-5E56-230D-1716-D540
  ✅ [OK]     1. Arquivo LICENSE (MIT)
  ✅ [OK]     2. Chave Única no README.md
  ✅ [OK]     3. Chave Única no rodapé do HTML
  ✅ [OK]     4. Documento AGENTS.md (Mín. 3 agentes)
  ✅ [OK]     5. Agente de Teste e Validação documentado
  ✅ [OK]     6. Arquivos de Skills na pasta skills/
  ✅ [OK]     7. Frontend HTML/CSS/JS Puro (Sem frameworks proibidos)
  ✅ [OK]     8. Backend Cloudflare Functions + D1 + Discord OAuth2
  ⚠️ [PENDENTE] 9. Deploy Online na Cloudflare (https://p26-3a-5e56-230d-1716-d540.pages.dev)
```
O item 9 está pendente porque o app ainda não foi publicado, o que é esperado nesta fase. O validador não foi rodado de novo depois disso, porque continua não havendo deploy.

## Escopo do PR

```
$ cd /home/alexandre/Avalia2026-2 && git status --porcelain
 M P26-3A-5E56-230D-1716-D540/docs/ESPECIFICACAO.md
 M P26-3A-5E56-230D-1716-D540/functions/_lib/repositorio.js
 M P26-3A-5E56-230D-1716-D540/functions/api/itens/[id]/reivindicacoes.js
 M P26-3A-5E56-230D-1716-D540/package.json
 M P26-3A-5E56-230D-1716-D540/tests/api.test.mjs
?? P26-3A-5E56-230D-1716-D540/docs/AUDITORIA-SEGURANCA.md
?? P26-3A-5E56-230D-1716-D540/tests/estatico.test.mjs
$ git diff --name-only 838337e..HEAD | grep -vc '^P26-3A-5E56-230D-1716-D540/'
0
```
Tudo está dentro da pasta da chave. Não existe a ref local `upstream/main` (não houve `git fetch upstream`), por isso a comparação foi feita contra o commit anterior à entrega (`838337e`). Este relatório (`docs/RELATORIO-TESTES.md`) entra como arquivo novo, também dentro da pasta.

## Fumaça em produção
Não executada: o app ainda não foi publicado. Quando for, rodar só leitura (`/`, `/api/status`, `/api/itens`, cabeçalhos e redirect de `/api/auth/discord`), sem criar dados.
