# Relatório de Validação (Agente 3: Teste e Validação)

Projeto #26 · Chave `P26-2A-0FC2-F5F9-5A1B-0D19` · Skill: [`skills/teste-validacao/SKILL.md`](../skills/teste-validacao/SKILL.md) · Contrato: [`docs/SPEC.md`](../docs/SPEC.md)

## 1. Resumo

| Suíte | Resultado |
|---|---|
| Unitários (`tests/unit.test.mjs`) | **19/19 passaram** |
| Integração da API (`tests/api.test.mjs`) | **38/38 passaram** (0 pulados) |
| E2E da interface (`tests/e2e.mjs`, Playwright/Chromium) | **16/16 passaram** |
| Auditoria estática | **sem achados** |
| Rubrica (`validar-local.mjs`) | **8/9 OK**; item 9 (deploy online) pendente, esperado nesta fase |

Defeitos de produção encontrados: **nenhum**. Nenhum arquivo de `functions/`, `public/` ou `migrations/` foi alterado pelo Agente 3.

## 2. Data e ambiente

- Data da execução final: 19/11/2026, 09:10 (UTC-3)
- Sistema: Linux (contêiner), Node.js **v22.23.5**
- Wrangler **4.165.0**, instalado fora do projeto (`/home/claude/wr`), sem `package.json` nem `node_modules` na pasta do projeto
- D1 local (Miniflare) com estado em pasta externa (`--persist-to /home/claude/wr/state`)
- Playwright com Chromium headless (pacote já disponível no ambiente)
- Dois servidores locais:
  - `:8788` sem variáveis do Discord (ambiente principal dos testes)
  - `:8789` com `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET` **falsos**, só para verificar o redirecionamento do OAuth

## 3. Comandos executados

```bash
mkdir -p /home/claude/wr && cd /home/claude/wr && npm init -y && npm i wrangler
W=/home/claude/wr/node_modules/.bin/wrangler; ST=/home/claude/wr/state
cd P26-2A-0FC2-F5F9-5A1B-0D19
$W d1 migrations apply DB --local --persist-to $ST
$W pages dev public --port 8788 --inspector-port 9230 --persist-to $ST &
$W pages dev public --port 8789 --inspector-port 9231 --persist-to $ST \
   --binding DISCORD_CLIENT_ID=123456789012345678 --binding DISCORD_CLIENT_SECRET=segredo-falso-teste &

node --test tests/unit.test.mjs
WRANGLER=$W PERSIST_TO=$ST node --test --test-reporter=spec tests/api.test.mjs
cd .. && WRANGLER=$W PERSIST_TO=$ST SCREENS_DIR=/home/claude/work/screens node P26-2A-0FC2-F5F9-5A1B-0D19/tests/e2e.mjs
node validar-local.mjs P26-2A-0FC2-F5F9-5A1B-0D19
```

Usuários e sessões de teste são gravados direto no D1 local com `wrangler d1 execute DB --local --command ...` (somente o SHA-256 do token, igual ao callback do OAuth). O cookie `sessao` é então enviado nas requisições. Não há porta dos fundos no código de produção.

## 4. Casos de teste

### 4.1 Unitários (`validatePollInput` e `buildResults`)

| # | Caso | Resultado |
|---|---|---|
| U1 | Enquete válida, com `trim` em título e opções | passou |
| U2 | Corpo nulo, array ou não objeto | passou |
| U3 | Título 2 caracteres (falha), 3 (passa), 120 (passa), 121 (falha) | passou |
| U4 | Título que não é texto | passou |
| U5 | Descrição ausente vira vazia; 1000 passa; 1001 falha; não texto falha | passou |
| U6 | Prazo no passado | passou |
| U7 | Prazo: 5 min menos 1 s falha; exatamente 5 min passa | passou |
| U8 | Prazo: 365 dias passa; 366 falha | passou |
| U9 | Prazo inválido, vazio, numérico ou nulo | passou |
| U10 | 1 opção falha; 2 passa; 10 passa; 11 falha | passou |
| U11 | Opções repetidas sem diferenciar maiúsculas e com espaços | passou |
| U12 | Opção vazia, com 101 caracteres ou não texto falha; 100 passa | passou |
| U13 | `buildResults` sem votos: total 0 e percentuais 0 | passou |
| U14 | Contagens no formato do D1, ordem das opções preservada (60/0/40) | passou |
| U15 | 1/3 de cada: 33.3 com 1 casa e soma aproximadamente 100 | passou |
| U16 | 2/3 e 1/3 arredondam para 66.7 e 33.3 | passou |
| U17 | 7 votos: no máximo 1 casa decimal e soma aproximadamente 100 | passou |
| U18 | Contagem de opção desconhecida e chaves em texto | passou |
| U19 | Entradas nulas não quebram | passou |

### 4.2 Integração da API (casos obrigatórios da skill em negrito)

| # | Caso | Esperado | Resultado |
|---|---|---|---|
| A1 | `GET /api/status` público com a chave e `d1Connected` | 200 | passou |
| A2 | **Sem cookie em `/api/polls`** (e em `/api/polls/:id`, POSTs e `/api/me`) | 401 `nao_autenticado` | passou |
| A3 | Token desconhecido ou malformado (inclui `' OR 1=1 --`) | 401 | passou |
| A4 | `/api/me` com sessão válida | 200 com usuário | passou |
| A5 | **Sessão expirada** (`expires_at` no passado) em `/api/me` e `/api/polls` | 401 e sessão apagada do D1 | passou |
| A6 | Logout apaga a sessão e expira o cookie | 200, `Max-Age=0`, depois 401 | passou |
| A7 | Método não suportado | 405 | passou |
| A8 | **Criar enquete válida** | 201 com id e opções | passou |
| A9 | **Criar inválida**: título curto, 1 opção, 11 opções, repetidas, prazo no passado, prazo em 1 min, prazo acima de 365 dias, data inválida, descrição longa (9 testes) | 400 `dados_invalidos` | passou |
| A10 | JSON quebrado e `Content-Type` diferente de JSON | 400 | passou |
| A11 | `creator_id`/`user_id` no corpo da criação são ignorados | criador = dono da sessão | passou |
| A12 | **POST com `Origin` estranho** em criar, votar e logout | 403 `origem_invalida`; sessão intacta | passou |
| A13 | POST com `Origin` igual à origem do servidor | 201 | passou |
| A14 | **Detalhe antes de votar** | `results === null`, `my_option_id === null` | passou |
| A15 | **Votar** e **votar de novo** | 201 com barras (100%); depois 409 `voto_duplicado` | passou |
| A16 | Outro usuário que não votou não vê o parcial | `results === null` | passou |
| A17 | Lista com `has_voted`, `total_votes`, `option_count` | valores corretos | passou |
| A18 | **Opção de outra enquete** (e `option_id` texto ou ausente) | 400 `opcao_invalida` | passou |
| A19 | Enquete inexistente ou id inválido (detalhe e voto) | 404 `enquete_nao_encontrada` | passou |
| A20 | **`user_id` no corpo do voto é ignorado** | voto gravado para o dono da sessão; o outro usuário ainda pode votar | passou |
| A21 | **Votos simultâneos do mesmo usuário**: 5 requisições em paralelo, 3 rodadas | exatamente uma 201 e quatro 409; 1 linha no D1 | passou |
| A22 | **Exatamente duas requisições simultâneas** | uma 201 e uma 409 | passou |
| A23 | **Enquete vencida (closes_at ajustado no D1)** | 403 `enquete_encerrada`, inclusive com opção inválida (ordem do SPEC); nenhum voto gravado | passou |
| A24 | **Enquete vencida: resultados visíveis** para quem não votou | `is_open=false`, `results` preenchido | passou |
| A25 | Ordenação da lista: abertas (prazo mais próximo) antes das encerradas (mais recentes) | ordem do SPEC | passou |
| A26 | `/api/auth/discord` sem variáveis | 500 `oauth_not_configured` com mensagem clara | passou |
| A27 | Callback sem variáveis | 302 para `/?erro=oauth_not_configured` | passou |
| A28 | `/api/auth/discord` com `DISCORD_CLIENT_ID` falso | 302 para `https://discord.com/oauth2/authorize` com `response_type=code`, `scope=identify`, `redirect_uri` correto, `state` de 64 hex; cookie `oauth_state` igual ao `state`, `HttpOnly`, `SameSite=Lax`, `Max-Age=600` | passou |
| A29 | Callback com `state` errado, sem cookie ou sem `state` (3 variações) | 302 para `/?erro=state_invalido` e cookie `oauth_state` expirado | passou |
| A30 | Callback com `error=access_denied` | 302 para `/?erro=acesso_negado` | passou |

### 4.3 E2E da interface (Playwright, Chromium)

| # | Caso | Resultado | Evidência |
|---|---|---|---|
| E1 | Sem cookie aparece a tela de login com "Entrar com Discord" (`href=/api/auth/discord`) | passou | `screens/e2e-01-login.png` |
| E2 | `?erro=state_invalido` mostra aviso amigável e limpa a URL | passou | |
| E3 | Footer contém a chave (sem sessão) | passou | |
| E4 | Com cookie `sessao`: cabeçalho com nome e avatar, lista carregada | passou | `screens/e2e-02-lista.png` |
| E5 | Validação no cliente bloqueia opção vazia | passou | |
| E6 | Criar enquete pela UI (3 opções, botão adicionar opção) | passou | `screens/e2e-03-nova-enquete.png` |
| E7 | Título com `<img onerror>` aparece como texto, sem execução (XSS) | passou | `screens/e2e-05-resultado.png` |
| E8 | Detalhe antes de votar: 3 radios, botão desabilitado, sem barras | passou | `screens/e2e-04-detalhe-antes.png` |
| E9 | Votar e ver barras proporcionais (0%, 100%, 0%), destaque "seu voto", "Resultado parcial" | passou | `screens/e2e-05-resultado.png` |
| E10 | Recarregar mantém o resultado (estado vem do servidor) | passou | |
| E11 | Lista mostra "Você votou" e "1 voto" | passou | |
| E12 | Enquete encerrada (ajustada no D1) mostra "Resultado final" e selo "Encerrada" | passou | `screens/e2e-06-encerrada.png` |
| E13 | Footer contém a chave (com sessão) e está visível | passou | |
| E14 | Layout móvel 390 px sem rolagem horizontal | passou | `screens/e2e-07-mobile.png` |
| E15 | Botão Sair volta ao login e `/api/me` passa a responder 401 | passou | `screens/e2e-08-apos-sair.png` |
| E16 | Nenhum erro de JavaScript na página durante todo o fluxo | passou | |

Os screenshots ficam em `/home/claude/work/screens/` (fora do projeto, não vão para o repositório).

### 4.4 Auditoria estática

| Verificação | Método | Resultado |
|---|---|---|
| Nenhum framework proibido (React, Vue, Angular, jQuery, Svelte, Tailwind, Bootstrap, htmx, Alpine etc.) | busca em `public/` e `functions/` | nenhum encontrado |
| Nenhum `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval` ou `new Function` | busca em `public/` e `functions/` | só aparecem em comentários; DOM criado com `createElement`/`textContent` (`public/js/dom.js`) |
| Nenhum SQL concatenado em `functions/` | busca por `${` e `+` dentro de `prepare(` | 17 chamadas `prepare()`, todas com `?` e `.bind()`; interpolações existentes são só em mensagens, cookies e URLs |
| Chave no `<footer>` de `public/index.html` | leitura do arquivo + E2E | presente |
| Sem scripts ou estilos de CDN externa, sem `text-shadow` | busca em `public/` | nenhum |
| Nenhum segredo no código ou no `wrangler.jsonc` | busca por `client_secret` com valor | nenhum |
| Só o SHA-256 do token vai para o D1 | leitura de `functions/_lib/session.js` + teste A5 | confirmado |

### 4.5 Rubrica (`validar-local.mjs`)

```
  ✅ [OK]     1. Arquivo LICENSE (MIT)
  ✅ [OK]     2. Chave Única no README.md
  ✅ [OK]     3. Chave Única no rodapé do HTML
  ✅ [OK]     4. Documento AGENTS.md (Mín. 3 agentes)
  ✅ [OK]     5. Agente de Teste e Validação documentado
  ✅ [OK]     6. Arquivos de Skills na pasta skills/
  ✅ [OK]     7. Frontend HTML/CSS/JS Puro (Sem frameworks proibidos)
  ✅ [OK]     8. Backend Cloudflare Functions + D1 + Discord OAuth2
  ⚠️ [PENDENTE] 9. Deploy Online na Cloudflare (https://p26-2a-0fc2-f5f9-5a1b-0d19.pages.dev)
```

O item 9 depende do deploy, que ainda não foi feito. Não é defeito de código.

## 5. Defeitos encontrados

**Nenhum defeito no código de produção.** Todas as regras do SPEC verificadas se comportaram como especificado na primeira execução.

Problemas encontrados e corrigidos **nos próprios testes** (não afetam o produto):

| Arquivo | Causa | Correção |
|---|---|---|
| `tests/e2e.mjs`, `tests/api.test.mjs` | O SQL de várias linhas passava pelo shell e o `\n` chegava literal ao D1 (`unrecognized token`) | Troca de `execSync` por `execFileSync` com lista de argumentos; o SQL não passa mais pelo shell |
| ambiente | Dois `wrangler pages dev` simultâneos disputavam a porta do inspetor | Uso de `--inspector-port` distinto (9230 e 9231) |

## 6. Observações e limitações (não bloqueiam a entrega)

1. **Caminho feliz do callback OAuth não é testável localmente**: a troca do `code` exige o Discord real. Foram testados localmente todos os desvios (sem variáveis, `state` errado, sem cookie, `error=access_denied`) e a montagem do redirecionamento. Validar o login completo após o deploy, com as variáveis configuradas no painel da Cloudflare e o `redirect_uri` `https://p26-2a-0fc2-f5f9-5a1b-0d19.pages.dev/api/auth/discord/callback` cadastrado no Discord Developer Portal.
2. **Concorrência no D1 local**: o Miniflare serializa as consultas, então a corrida de votos pode ser absorvida pela checagem prévia antes de chegar ao `UNIQUE`. A garantia final no D1 real é a restrição `UNIQUE(poll_id, user_id)` mais o tratamento de `UNIQUE constraint failed` como 409 em `functions/api/polls/[id]/vote.js`, conferidos por leitura de código.
3. **Avatar sem fallback visual**: no ambiente de teste sem internet a imagem do CDN do Discord aparece quebrada (visível nos screenshots). Em produção a URL carrega normalmente. Melhoria opcional: esconder a imagem no evento `error`.
4. **`AGENTS.md`** ainda tem os campos "Harness Principal" e "Modelo(s) Base" com texto de exemplo. O validador aceita, mas a rubrica de 25 pontos pede essa informação preenchida.

## 7. Evidência da reexecução final (19/11/2026, 09:10)

```
$ node --test tests/unit.test.mjs
# tests 19
# pass 19
# fail 0
# skipped 0

$ WRANGLER=$W PERSIST_TO=$ST node --test --test-reporter=spec tests/api.test.mjs
ℹ tests 38
ℹ pass 38
ℹ fail 0
ℹ skipped 0

$ node tests/e2e.mjs
E2E: 16/16 passaram. Screenshots em /home/claude/work/screens

$ node validar-local.mjs P26-2A-0FC2-F5F9-5A1B-0D19
8 itens OK, 1 pendente (deploy online)
```

Todas as suítes verdes. Após a execução, os servidores foram encerrados e a pasta `.wrangler/` criada pelo `pages dev` dentro do projeto foi apagada; o projeto não contém `node_modules/`, `package.json` nem `package-lock.json`.

Responsável pela validação: Agente 3 (Teste e Validação).
