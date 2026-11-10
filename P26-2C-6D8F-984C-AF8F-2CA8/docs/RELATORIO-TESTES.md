# Relatório de Testes — P26-2C-6D8F-984C-AF8F-2CA8

**Data:** 2026-11-10 · **Agente:** testador-validador (Agente 3) · **Protocolo:** `skills/teste-validacao/SKILL.md`
**Ambiente:** Windows 11, Node 24, wrangler 4.160.0, Chromium (Playwright)

## Resumo

| Área | Resultado |
|---|---|
| 1. Unitário (cálculo + validação) | **PASSOU** — 16/16 (5 originais + 11 de borda novos) |
| 2. API local (wrangler pages dev + D1 local) | **15/16** — falha: cookie malformado → 500. Mais um achado fora da suíte: corrida no limite de 20 |
| 3. Interface (Playwright) | **PASSOU** — recálculo na hora, persistência, rodapé, 375 px, console limpo |
| 4. Produção (sem login) | **5/6** — a mesma falha do cookie malformado (500) |
| 5. Rubrica (`validar-local.mjs`) | **PASSOU** — 9/9 |

Nenhuma falha de isolamento entre usuários nem de validação no servidor. Os achados abaixo vão de severidade média a informativa.

## Falhas e achados

| # | Severidade | Onde | Descrição | Sugestão |
|---|---|---|---|---|
| F1 | **Média** | `functions/_util.js:9` (chamado em `functions/api/_middleware.js:8`, `functions/api/auth/logout.js:5`) | `decodeURIComponent` lança `URIError` com cookie `sid=%E0%A4%A`. O `catch` do middleware devolve **500** (`erro_interno`) em vez de **401**. Reproduzido em produção. Não vaza dados, mas qualquer cliente pode gerar 500 e sujar os logs. | `try { return decodeURIComponent(m[1]) } catch { return null }` em `lerCookie`. |
| F2 | **Média** | `functions/api/disciplinas/index.js:16-18` | O limite de 20 disciplinas pode ser burlado com requisições simultâneas: **30 POSTs paralelos criaram 30 disciplinas** (todas 201). O comentário `ponytail:` já aponta o problema. | Fazer o INSERT condicional no mesmo batch: `INSERT ... SELECT ... WHERE (SELECT COUNT(*) FROM disciplinas WHERE user_id=?) < 20` e responder 409 quando `meta.changes === 0` (as avaliações também precisam desse guard). |
| F3 | Baixa | `public/js/calculo.js:45,56-61` | A média é arredondada (`arred`) **antes** de ser comparada com as metas. Média real 6,996 vira 7,00 e dá "aprovado" (teste `ACHADO: média é arredondada…`). `notaNoExame` também usa a média arredondada. Pode ser regra intencional; se não for, está errado. | Comparar com o valor bruto e arredondar só na saída. Senão, documentar a regra no contrato. |
| F4 | Baixa | `public/js/calculo.js:82,106` | `Number()` converte tipos que não são número: `nota: true` vira 1, `[]` vira 0 e `"  "` vira 0, e tudo isso passa na validação. Os dados continuam coerentes. | Aceitar só `number` ou string numérica não vazia (`/^\s*-?\d+(\.\d+)?\s*$/`). |
| F5 | Info | `public/js/calculo.js:17-18,63` | `calcular()` com 0 avaliações devolve meta "garantida" e situação "aprovado". Pela API isso não acontece, porque a validação exige pelo menos 1 avaliação. | Opcional: tratar `somaPesos === 0` como "em_andamento". |
| F6 | Info | produção (`public/`) | Não há cabeçalhos de segurança (CSP, `X-Frame-Options`, `Referrer-Policy`) na home. A UI usa `textContent` e não foi encontrado XSS (nome com `<script>` aparece literal). | `public/_headers` com CSP `default-src 'self'; img-src 'self' https://cdn.discordapp.com` + `frame-ancestors 'none'`. |

## 1. Unitário

```
node --test tests/*.test.mjs
ℹ tests 32 · pass 16 · fail 0 · skipped 16   (os 16 pulados são de tests/api.test.mjs, que só roda com BASE_URL)
```

Arquivo novo: `tests/calculo-bordas.test.mjs`. Ele cobre:
- todas as avaliações pendentes
- 0 avaliações
- pesos decimais (0,1 + 0,2 + 0,7)
- nota máxima 100, com nota 100 aceita e 100,01 rejeitada
- fronteiras exatas (7, 4 e 3,99, além da nota necessária = notaMax, que conta como "possível")
- nota de exame acima de notaMax
- 30 × 31 avaliações e limites de nome
- tipo com caixa errada, peso negativo, NaN e Infinity, `null` e não-array
- normalização de strings
- regras fora da faixa
- achados F3, F4 e F5 (cada teste documenta o comportamento atual)

## 2. API local

**Preparação:**

```
npx wrangler d1 execute DB --local --command "INSERT INTO discord_users (user_id, username, avatar) VALUES ('test-user-a','Teste A',NULL),('test-user-b','Teste B',NULL);
  INSERT INTO sessions (token,user_id,expires_at) VALUES ('tok-teste-a-0123456789abcdef','test-user-a',datetime('now','+1 day')),
  ('tok-teste-b-0123456789abcdef','test-user-b',datetime('now','+1 day')),('tok-teste-expirado','test-user-a',datetime('now','-1 minute'));"
npx wrangler pages dev --port 8788      # em segundo plano
BASE_URL=http://localhost:8788 SID_A=tok-teste-a-0123456789abcdef SID_B=tok-teste-b-0123456789abcdef node --test tests/api.test.mjs
```

`expires_at` usa o formato `datetime()` do SQLite (`YYYY-MM-DD HH:MM:SS`), o mesmo que o middleware compara com `datetime('now')`.

**Resultado:** 15/16.

| Caso | Resultado |
|---|---|
| 401 sem cookie: GET `/api/me`, GET/POST `/api/disciplinas`, PUT/DELETE `/api/disciplinas/1` | ✔ |
| 401 com cookie forjado, 64×"a", `' OR '1'='1`, user_id no lugar do token, sessão expirada | ✔ |
| Cookie `sid=%E0%A4%A` deve dar 401 | ✖ **500** (F1) |
| `/api/auth/discord` 302. Local: `auth_error=discord_nao_configurado`, porque não há `.dev.vars` | ✔ |
| Callback com `state` divergente → `auth_error=state_invalido` | ✔ |
| 400 em POST **e** PUT: nome vazio/espaços/>80, peso 0/negativo/texto, nota >notaMax/negativa, tipo inválido, 0 e 31 avaliações, `avaliacoes` não-array, mediaExame>mediaAprovacao, mediaAprovacao>notaMax, notaMax 0, JSON inválido, `null`, `[]`, string. PUT inválido não altera nada | ✔ |
| 400 para `:id` = `abc`, `0`, `-1`, `1.5`, `01`, `1e3`, `%20`. 404 para id grande inexistente | ✔ |
| Isolamento: B não vê a disciplina de A na lista. PUT/DELETE de B na disciplina de A → 404, e A continua intacta (nome + 3 avaliações) | ✔ |
| `resumo` do servidor `deepEqual` `calcular()` local em POST, PUT (notaMax 100, pesos 0,3/0,7) e GET | ✔ |
| `resumo` mandado pelo cliente é ignorado | ✔ |
| Sequestro: B manda `user_id`/`userId`/`id` de A no POST, e `id`/`disciplina_id`/id de avaliação de A no PUT. Nada de A muda | ✔ |
| Injeção SQL/HTML no nome da disciplina e da avaliação é gravada literalmente | ✔ |
| PUT substitui as avaliações. DELETE dá `{ok:true}` e depois 404 em DELETE/PUT | ✔ |
| 21ª disciplina (sequencial) → 409 | ✔ |
| Logout → 200 + `sid=; Max-Age=0` | ✔ |

**Teste extra (script avulso, fora da suíte):** 30 POSTs simultâneos com a sessão B deram `{201: 30}` e 30 disciplinas no total (F2). Depois tudo foi apagado.

## 3. Interface (Playwright, Chromium, cookie `sid` de teste em localhost:8788)

| Verificação | Evidência |
|---|---|
| Login por sessão → painel com "Teste A" | `usuarioNome = "Teste A"` |
| Rodapé com a chave | `Chave Única: P26-2C-6D8F-984C-AF8F-2CA8 · Licença MIT` |
| Criar disciplina pelo editor (preset "2 provas + trabalho") | título "Cálculo UI 2" |
| Recálculo instantâneo ao digitar | média "—" → P1=6 → "6" ("precisa de 7,67…"; "2,67… exame") → Lista=10 → "7,33" ("6,5 … aprovação"; "Direito ao exame já garantido") — confere com o cálculo manual: (70−24)/6 = 7,67 e (70−44)/4 = 6,5 |
| Nota inválida (11) | `aria-invalid="true"` + "“P2”: a nota deve estar entre 0 e 10." |
| Salvamento automático | "Salvo ✓" |
| Persistência após reload | P1=6, P2 vazia, Lista=10, média 7,33, "Em andamento" |
| 375 px sem rolagem horizontal | `scrollWidth 360 = clientWidth 360` (a barra de rolagem vertical ocupa 15 px). Com o editor aberto: dialog `305/305` |
| Excluir pela UI (confirm) | lista volta a "Nenhuma disciplina ainda" |
| Console | 0 erros / 0 avisos / 0 `pageerror` |

Capturas: `docs/evidencias/ui-desktop.png`, `docs/evidencias/ui-375.png`, `docs/evidencias/ui-375-editor.png`.

## 4. Produção — https://notas-p26-2c.pages.dev (sem login, nenhum dado criado)

```
curl -i …/                    → 200, rodapé "Chave Única: P26-2C-6D8F-984C-AF8F-2CA8 · Licença MIT"
curl -i …/api/me              → 401 {"erro":"nao_autenticado"}
curl -i …/api/disciplinas     → 401 (GET), 401 (POST)
curl -i …/api/auth/discord    → 302 discord.com/oauth2/authorize?…scope=identify&state=<32 hex>
                                 Set-Cookie: oauth_state=…; HttpOnly; Secure; SameSite=Lax; Max-Age=600
callback com state errado     → 302 /?auth_error=state_invalido
Cookie sid=forjado            → 401
Cookie sid=%E0%A4%A           → 500   (F1)
BASE_URL=https://notas-p26-2c.pages.dev node --test tests/api.test.mjs → 5 pass, 1 fail (F1), 10 skipped (precisam de sessão)
```

## 5. Rubrica

```
cd C:\Users\ADD-10044\projetos\Avalia2026-2 && node validar-local.mjs P26-2C-6D8F-984C-AF8F-2CA8
✅ 1 LICENSE MIT · ✅ 2 Chave no README · ✅ 3 Chave no rodapé · ✅ 4 AGENTS.md (≥3 agentes) · ✅ 5 Agente de teste
✅ 6 skills/ · ✅ 7 HTML/CSS/JS puro · ✅ 8 Functions + D1 + Discord OAuth2 · ✅ 9 Deploy (https://notas-p26-2c.pages.dev)
→ 9/9 "Tudo pronto!"
```

## Limpeza

- O `wrangler pages dev` iniciado pelo agente foi encerrado pela árvore de PID (`taskkill /PID 13864 /T /F`). A porta 8788 ficou livre.
- D1 local: as linhas `test-user-%` foram apagadas das tabelas `avaliacoes`, `disciplinas`, `sessions` e `discord_users`. Contagem final: 0/0/0/0.
- O D1 remoto não foi tocado.

## Como reexecutar

1. `node --test tests/*.test.mjs` roda só os unitários. A suíte de API fica pulada sem `BASE_URL`.
2. Para a API local, siga a seção 2: crie as sessões, suba o servidor e rode com `BASE_URL`, `SID_A` e `SID_B`. A suíte apaga o que cria.

## 6. Ciclo de correção e reteste (2026-11-10)

O orquestrador corrigiu os achados e a suíte foi reexecutada:

| Achado | Correção | Reteste |
|---|---|---|
| F1 cookie malformado → 500 | `functions/_util.js` `lerCookie`: `decodeURIComponent` em try/catch → `null` | `Cookie: sid=%E0%A4%A` → **401** |
| F2 limite de 20 burlável | `functions/api/disciplinas/index.js`: `INSERT … SELECT … WHERE (SELECT COUNT(*) …) < 20` (atômico); avaliações inseridas pelo id exato, com rollback manual se falhar | 30 POSTs simultâneos → **20×201, 10×409**, 0 disciplinas sem avaliações |
| F3 arredondar antes de comparar | `calcular()` decide a situação final com a média exata; arredondamento só na exibição | teste `F3 corrigido` (6,996 → `exame`) |
| F4 `true`/`[]` aceitos como número | `num()` só aceita `number` ou string numérica; string em branco = sem nota | teste `F4 corrigido` |
| F5 0 avaliações = aprovado | situação `em_andamento` quando Σpesos = 0 | teste ajustado |
| F6 sem cabeçalhos de segurança | `public/_headers`: CSP `default-src 'self'`, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` | cabeçalhos presentes; interface sem erros de console com CSP ativo |

```
node --test tests/*.test.mjs                                              → 16 pass, 0 fail (API pulada sem BASE_URL)
BASE_URL=http://localhost:8788 SID_A=… SID_B=… node --test tests/api.test.mjs → 16 pass, 0 fail
```
