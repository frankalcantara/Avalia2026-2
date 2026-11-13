# Auditoria de Segurança — P26-3A-5E56-230D-1716-D540

- **Data:** 09/11/2026
- **Agente:** Auditor de Segurança (`.claude/agents/auditor-seguranca.md`)
- **Checklists:** `skills/seguranca-web/SKILL.md` (OWASP aplicado) e
  `skills/cloudflare-oficial/workers-best-practices/SKILL.md` (anti-padrões de Workers)
- **Escopo:** `functions/` (back-end), `public/` (front-end + `_headers`), `migrations/0001_init.sql`,
  `wrangler.jsonc`, `.gitignore`, `.dev.vars`, `scripts/publicar.sh`. Contrato: `docs/ESPECIFICACAO.md`.
- **Como:** leitura linha a linha + verificação dinâmica com `npx wrangler pages dev --port 8790` sobre um
  estado D1 local **isolado** (`--persist-to` no scratchpad), com 3 usuários e sessões semeados no formato de
  `functions/_lib/sessao.js`. Nada remoto, nada de deploy.

## 1. Resumo

| Gravidade | Encontrados | Corrigidos | Risco aceito |
|---|---|---|---|
| Alta  | 0 | – | – |
| Média | 1 | 1 | 0 |
| Baixa | 7 | 0 | 7 (documentados abaixo) |

Nenhuma falha de controle de acesso, injeção, XSS, CSRF ou sessão foi encontrada. O único achado Média
(abuso de criação de reivindicações) foi corrigido.

## 2. Tabela de achados (antes / depois)

| # | Gravidade | Arquivo:linha | Cenário de ataque | Antes | Depois |
|---|---|---|---|---|---|
| M1 | **Média** | `functions/api/itens/[id]/reivindicacoes.js:29-59` (INSERT); efeito em `functions/api/itens/[id].js:26` e `functions/api/reivindicacoes/index.js:17` | Usuário logado faz *criar → cancelar → criar…* em laço no item da vítima. O índice único só barra duas **ativas**; as `cancelada` acumulam sem limite. Medido: 40 de 40 tentativas viraram linhas. O autor recebe **todas** no detalhe do item (resposta sem teto, até 500 chars cada) e a lista `recebidas` (teto 200, ordenada por `atualizado_em`) é inundada, empurrando reivindicações legítimas para fora. | Sem limite | **Corrigido:** no máximo 5 reivindicações (qualquer status) por usuário no mesmo item, conferido **na mesma instrução** do INSERT (sem corrida) → `429 limite_excedido`. Medido depois: 5×201, 35×429; o autor vê 5. |
| B1 | Baixa | `functions/_lib/sessao.js:75-81` | Cookie `sessao` sem prefixo `__Host-`. Mitigado: `Secure`, `Path=/`, sem `Domain`, e `pages.dev` está na Public Suffix List (subdomínio vizinho não planta cookie). | – | Aceito (o nome `sessao` é contrato e é usado pelos testes). |
| B2 | Baixa | `functions/_lib/sessao.js:112` | Sessões expiradas só são limpas para o usuário que faz login de novo; as de quem nunca volta ficam na tabela (só hash + datas, sem valor para atacante). | – | Aceito; sugestão: limpeza periódica (Cron Trigger) se a tabela crescer. |
| B3 | Baixa | `functions/api/auth/discord/callback.js:74,85` | `await resp.json()` bufferiza a resposta do Discord sem teto. Origem confiável, `AbortSignal.timeout(8000)` e respostas pequenas. | – | Aceito. |
| B4 | Baixa | `functions/api/auth/discord.js:27` | `prompt=none`: quem já autorizou o app não vê a tela de consentimento. Um site pode forçar o navegador da vítima a iniciar o login, mas ela entra **na própria conta** (o `state` fica preso ao cookie dela); sem impacto. | – | Aceito (decisão de UX). |
| B5 | Baixa | `functions/api/status.js:31` | `GET /api/status` (público) informa `oauth_configurado`. Não revela o segredo, só se ele existe. | – | Aceito (exigido pelo contrato e pelo `scripts/publicar.sh`). |
| B6 | Baixa | `functions/_lib/repositorio.js:95-98` | `contato_autor` = username do autor, que já é público em `Item.autor.username` (`GET /api/itens`). A regra "contato só para as partes" protege de fato só o `contato_reivindicante`. Isso decorre do próprio contrato (seção 4.1). | – | Aceito (registrado para o dono do produto). |
| B7 | Baixa | `wrangler.jsonc` | Sem bloco `observability` (Workers Logs/Traces). Em Pages Functions os logs são vistos por `wrangler pages deployment tail` / painel; os erros já são logados em JSON estruturado (`_middleware.js:59-68`) sem ir para o cliente. | – | Aceito. |

## 3. Checklist `seguranca-web` item por item

### 3.1 Controle de acesso (A01) — OK
- Toda rota que altera estado usa `exigirUsuario(context)` (sessão do servidor); nenhum `user_id` é lido do
  corpo/URL. Teste: `POST /api/itens` com `autor_id`, `status`, `id` extras → ignorados; reivindicação com
  `reivindicante_id`/`status` no corpo → gravada como `pendente` do usuário da sessão.
- Autor ≠ reivindicante: `reivindicacoes.js` checa antes e **repete no SQL** (`i.autor_id <> ?`). → 403 medido.
- Só o autor aceita/recusa: checado em JS e no `WHERE ... EXISTS (... autor_id = ?)` de `[acao].js:21-44`.
  IDOR (C aceita/recusa/cancela a reivindicação de B; B aceita a própria) → 403 nos quatro casos.
- Encerrar/apagar item alheio → 403; apagar item `em_devolucao` → 409 (`DELETE ... AND status='aberto' AND NOT EXISTS aceita`).
- Contatos: `serializarReivindicacao` (único ponto) só inclui `contato_*` para autor do item ou reivindicante.
  Medido: anônimo vê 0 contatos; C não vê nada de B (nem a reivindicação).
- Ação dinâmica `/api/reivindicacoes/:id/:acao`: `Object.hasOwn` impede `__proto__`/`constructor` → 404 medido.
- **Corrida:** dois `aceitar` simultâneos em reivindicações diferentes do mesmo item → um 200 e um 409; fica
  exatamente 1 `aceita` (UPDATE condicionado + `env.DB.batch` atômico + índice único `uq_reiv_aceita_por_item`).
  Limite de 10 itens/h sob 8 POSTs paralelos → 4×201 + 4×429, total final exatamente 10 (contagem e INSERT
  na mesma instrução).

### 3.2 Injeção (A03) — OK
- Todo SQL usa `prepare().bind()`. As únicas interpolações `${...}` em SQL são constantes do código
  (`SELECT_ITEM`, `SELECT_REIVINDICACAO`, `AGORA`, `quemPode`, `itemEncerrado`) ou cláusulas montadas de uma
  lista fixa (`montarWhere`); `ORDER BY` só `ASC`/`DESC` por lista branca (`ORDENS`).
- `LIKE` com `escaparLike` + `ESCAPE '\'` (`itens/index.js:32-38`). Medido: `q=%` e `q=_` → 0 resultados (não viram curinga).
- Medido: `categoria=x' OR 1=1--`, `status=aberto'--`, `ordem=id;DROP TABLE itens`, `/api/itens/1 OR 1=1` → 400.

### 3.3 XSS — OK
- `public/js`: nenhum `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`.
  Todo dado entra por nó de texto (`el()`/`anexar()` em `ui.js:43-72`); `on*` só aceita função;
  `href`/`src` passam por `urlSegura()` (bloqueia `javascript:`/`data:`).
- Avatar só se começar com `https://cdn.discordapp.com/` (`ui.js:104`), e o banco tem CHECK igual
  (`migrations/0001_init.sql`). O servidor monta a URL do avatar só com hash validado por regex (`discord.js:21-26`).
- `erro_login` da URL é traduzido por mapa; código desconhecido só aparece se casar `^[a-z0-9_-]{1,40}$`.
- Medido: título `Celular <img src=x onerror=alert(1)>` é gravado como texto e o front o renderiza como texto.
- CSP sem `'unsafe-inline'` em script e style; `index.html` não tem script/style inline (tema em `tema.js` externo).

### 3.4 CSRF e sessão (A07) — OK
- `_middleware.js:28-39`: POST/PUT/PATCH/DELETE exigem `Origin` idêntico à origem → medido 403 para origem
  estranha, sem `Origin`, `Origin: null` e logout cross-site. Corpo não-JSON → 415 (`text/plain`,
  `form-urlencoded` medidos). `lerJson` confere o Content-Type de novo (cobre HTTP/2 sem Content-Length).
- Corpo > 8 KB → 413 tanto com `Content-Length` quanto com `Transfer-Encoding: chunked` (leitura em stream com corte).
- Cookie `sessao`: `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800`; token de 32 bytes de
  `crypto.getRandomValues`; banco guarda só SHA-256; expiração conferida no SELECT; logout apaga do D1
  (medido: depois do logout o mesmo cookie dá `usuario: null`).
- Sessão não é forjável: medido 401 com JSON base64 no cookie e com o próprio hash do banco no cookie.
- OAuth: `state` aleatório de 32 bytes, cookie `oauth_state` HttpOnly/Secure/Lax/10 min/`Path=/api/auth/discord`,
  comparação em tempo constante (`crypto.subtle.timingSafeEqual` sobre SHA-256), cookie sempre expirado no
  callback (medido), `redirect_uri` fixo pela origem, sem redirecionamento aberto (destinos são caminhos fixos).
  Login apaga a sessão anterior do navegador (anti-fixação).

### 3.5 Cabeçalhos (A05) — OK
- `public/_headers` (medido em `/`): CSP exatamente a do checklist, HSTS 1 ano + includeSubDomains, `nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `COOP: same-origin`.
- `/api/*` (middleware): `Cache-Control: no-store`, CSP `default-src 'none'; frame-ancestors 'none'`,
  `nosniff`, `X-Frame-Options: DENY`, HSTS, CORP/COOP `same-origin`, `Referrer-Policy: no-referrer`.

### 3.6 Segredos e dados (A02/A04) — OK
- `wrangler.jsonc` só tem `DISCORD_CLIENT_ID` (público) e o id do D1; `DISCORD_CLIENT_SECRET` é *secret* do Pages
  (`scripts/publicar.sh` confere com `wrangler pages secret list`).
- `git status`: a pasta do projeto está toda não rastreada; `git status --untracked-files=all` (respeita o
  `.gitignore`) lista só código/documentação — `.dev.vars`, `.wrangler/` e `node_modules/` ficam fora
  (`git check-ignore` confirma `.gitignore:3 .dev.vars` e `.gitignore:2 .wrangler/`).
- `grep` por `client_secret|SECRET|token` com valor atribuído e por formato de token de bot do Discord: nenhum valor real
  versionável. `.dev.vars` local tem valores de teste (5 chars), não lidos para este relatório.
- Erros: 500 genérico `{erro:"interno"}`; pilha só no log do servidor. Mensagens de D1/Discord não vão ao cliente.
  Medido: rota inexistente → 404 JSON; PUT → 405; UTF-8 inválido → 400; JSON malformado/array → 400.
- Tamanhos: corpo ≤ 8 KB; campos com mínimo/máximo no validador **e** CHECK no banco; 10 itens/h (429);
  agora também 5 reivindicações por usuário por item (429, achado M1).

### 3.7 Workers best practices
- Sem `Math.random` (tokens com `crypto.getRandomValues`), sem estado mutável em módulo por requisição, sem
  `passThroughOnException`, sem promessa solta (nenhum `waitUntil` necessário), comparação de segredo em tempo
  constante, `fetch` externo com timeout, corpo da requisição lido em stream com teto.
- `compatibility_date` 2026-11-01 (atual). Observabilidade: ver B7.

## 4. Mudanças feitas

| Arquivo | Mudança |
|---|---|
| `functions/api/itens/[id]/reivindicacoes.js` | M1: constante `LIMITE_POR_ITEM = 5`; condição de contagem dentro do `INSERT ... SELECT`; se não inseriu, distingue 429 (limite) de 409 (item não aberto). |
| `functions/_lib/repositorio.js` | Sugestão do front-end: `item.autor` (`user_id`, `username`, `nome_exibicao`, `avatar_url` — nada além) no resumo do item de cada reivindicação; `JOIN usuarios ua` em `SELECT_REIVINDICACAO`. Sem risco: os mesmos 4 campos já são públicos em `GET /api/itens`. `item.autor_id` foi mantido. |
| `docs/ESPECIFICACAO.md` | Seção 6, decisão 11 registrando as duas mudanças acima (o código 429 já era do contrato). |

### Mudanças de comportamento observável (para o Agente de Teste re-rodar)
1. `POST /api/itens/:id/reivindicacoes`: a **6ª** reivindicação do mesmo usuário no mesmo item (contando
   `cancelada`, `recusada` etc.) agora responde **`429 { erro: "limite_excedido" }`** em vez de 201.
   Ordem: 401 → 415/400 → 404 → 403 → 400 → 409 (item não aberto) → 409 (já tem ativa) → 429.
2. `GET /api/reivindicacoes`, `GET /api/itens/:id` (lista `reivindicacoes`), `POST .../reivindicacoes` (201) e
   `POST /api/reivindicacoes/:id/<acao>`: o objeto `reivindicacao.item` ganhou a chave **`autor`**. Um teste que
   compare as chaves de `reivindicacao.item` com igualdade exata precisa incluí-la.

Obs.: o servidor do testador (porta 8788) usa a mesma pasta `functions/` e recarrega sozinho com essas mudanças.

## 5. Verificação

- Dinâmica (porta 8790, estado isolado): 40+ checagens de CSRF, 415/413, sessão, injeção, IDOR, corrida e
  abuso — todas com o resultado esperado depois da correção (roteiro em
  `/tmp/claude-1000/-home-alexandre/4ba6c4cd-c5f2-46f7-8dc8-873ced86161e/scratchpad/dinamico.sh`).
- `node --check` nos dois arquivos alterados; `node --test tests/validacao.test.mjs` → 36/36.
- Servidor 8790 encerrado pelos PIDs (wrapper npx, wrangler, workerd); `.wrangler/state` e `tests/` intocados.

## 6. Risco residual aceito

B1–B7 acima. Nenhum item Alta/Média pendente. Antes do deploy: confirmar que o *secret*
`DISCORD_CLIENT_SECRET` existe no projeto Pages (o `publicar.sh` já bloqueia se faltar) e que o
`redirect_uri` cadastrado no portal do Discord é só o de produção.
