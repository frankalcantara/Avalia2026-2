# Relatório de Teste e Validação — Projeto #34

**Vitrine de Achados e Perdidos do Campus** · Chave `P26-2B-DEE2-E5F5-044F-D681`
Agente 3 (Teste, Auditoria de Segurança e Validação) · skill [`skills/teste-validacao/SKILL.md`](../skills/teste-validacao/SKILL.md)

- **Data:** 2026-11-06
- **Ambiente:** Linux, Node v22.23.4, Wrangler (`wrangler pages dev`, workerd local) com D1 local
  em diretório isolado (`--persist-to /tmp/test-state`), porta 8790, `.dev.vars` com credenciais
  Discord **falsas**. O Discord real não é chamado: as sessões vêm de `tests/seed-local.sql`.

## Comandos executados

```bash
wrangler d1 migrations apply DB --local --persist-to /tmp/test-state     # 0001_init.sql ✅
wrangler d1 execute DB --local --persist-to /tmp/test-state --file tests/seed-local.sql
wrangler pages dev --port 8790 --persist-to /tmp/test-state
node --test tests/api.test.mjs                                           # 2 execuções seguidas
cd .. && node validar-local.mjs P26-2B-DEE2-E5F5-044F-D681
```

## Resultado

| Execução | Testes | Passaram | Falharam |
|---|---|---|---|
| 1ª (código original do Agente 1) | 80 | 75 | **5** |
| Depois das correções — execução 1 | 80 | **80** | 0 |
| Depois das correções — execução 2 (sem reseed, prova de reexecução) | 80 | **80** | 0 |

Por grupo: diagnóstico 1 · autenticação/OAuth 14 · validação de item 19 · CSRF/Content-Type/Origin/JSON 7 ·
reivindicações e máquina de estados 23 · XSS 3 · SQL injection e filtros 11 · logout e limite diário 2.

## Falhas encontradas e correções (mínimas, no backend)

| # | Arquivo | Problema | Correção |
|---|---|---|---|
| 1 | `functions/api/items/index.js` | Busca `q` com mais de ~48 bytes (ou ~24 letras acentuadas) derrubava a listagem com **500** `D1_ERROR: LIKE or GLOB pattern too complex` — o D1 limita o padrão do `LIKE` a 50 bytes e o código cortava em 60 caracteres. Qualquer pessoa sem login conseguia provocar o erro. | O termo é cortado para caber em 48 bytes UTF-8 (+ os dois `%`), sem quebrar caracteres multibyte. |
| 2 | `functions/api/claims/[id].js` | `{"acao":"constructor"}` (ou `toString`, `__proto__`, `hasOwnProperty`) passava pela busca `REGRAS[acao]` — propriedade herdada de `Object` — e estourava `TypeError` → **500** em vez de 400. | `Object.hasOwn(REGRAS, acao)` e exigência de `acao` string. |
| 3 | `functions/_lib/http.js` (`lerJson`) | A verificação de Content-Type usava `includes("application/json")`; `Content-Type: text/plain; application/json` era aceito (201). Esse valor é "CORS-safelisted", ou seja, um site externo pode enviá-lo sem preflight — enfraquecia uma das camadas anti-CSRF (as outras, `Origin` e `SameSite=Lax`, ainda seguravam). | Compara o tipo de mídia exato (antes do `;`) com `application/json`; `application/json; charset=utf-8` continua aceito. |
| 4 | `functions/_lib/http.js` (`parseCookies`) | Cookie com `%` mal formado (ex.: `sid=%E0%A4%A`) fazia `decodeURIComponent` lançar `URIError` → **500** `d1_erro` (com a mensagem interna "URI malformed" no corpo) em **todas** as rotas `/api/*`. | `try/catch` por cookie; valor inválido fica cru e a sessão simplesmente não é reconhecida (401 / `user: null`). |

Nenhuma alteração em `migrations/` nem em `public/`.

## Itens verificados (checklist da skill)

1. **Autenticação** ✅ — escrita sem cookie, token desconhecido, token mal formado, hash do banco usado como token e sessão expirada → 401; `/api/me` devolve `user_id`, nome e avatar do Discord; `/api/auth/discord` → 302 para `discord.com/oauth2/authorize` com `scope=identify`, `redirect_uri` correto, `state` aleatório e cookie `oauth_state` HttpOnly/SameSite=Lax/10 min; callback com `state` diferente ou sem cookie → `auth_error=state_invalido` e nenhum `sid`; logout apaga a sessão no D1.
2. **Validação de item** ✅ — tipo/categoria fora da lista, título/local/descrição curtos, longos ou só espaços, data futura, inexistente (30/02), em formato BR ou com mais de 1 ano → 400 com `details` só do campo errado; limites exatos aceitos; campos extras (`status`, `owner_id`) ignorados.
3. **CSRF/entrada** ✅ (após correção 3) — 415 sem `application/json`; 403 para `Origin` de outro site ou `null` em todos os POST/PATCH; 400 para JSON malformado, array, `null`, número; 413 para corpo > 8000.
4. **Reivindicação** ✅ — próprio item 403; duplicada 409; item em devolução/encerrado 409; inexistente 404; contato do Discord das duas partes gravado e visível **só** para as partes (a vitrine pública não expõe username nem user_id).
5. **Máquina de estados** ✅ (após correção 2) — só o dono aceita/recusa; só o reivindicante cancela; terceiros 403; aceitar põe o item em `em_devolucao` e bloqueia outra aceitação; cancelar uma aceita devolve o item a `aberto`; concluir (por qualquer parte) encerra o item e recusa as pendentes; encerrar manual recusa pendentes e conclui a aceita; toda transição a partir de estado final → 409.
6. **XSS** ✅ — `<script>`/`<img onerror>` em título, local, descrição e mensagem voltam literalmente em JSON; verificação estática de `public/*.js` sem `innerHTML`/`insertAdjacentHTML` com dados dinâmicos (**passou na versão de `public/` do momento do teste — o Agente 2 está reescrevendo a interface; rodar de novo**).
7. **SQL injection** ✅ (após correção 1) — aspas, `UNION`, `DROP TABLE`, `%`, `_` e `\` em `q` não quebram nem ampliam a consulta; filtros `tipo`/`categoria`/`status` com SQL → 400; tabelas intactas.
8. **Filtros** ✅ — `tipo`, as 4 categorias, `status`, combinados, `meus=1` (401 sem login, só itens do usuário com login) e ordenação (abertos primeiro). Limite de 20 cadastros/dia → 429.

## Rubrica — `node validar-local.mjs P26-2B-DEE2-E5F5-044F-D681`

| Item | Resultado |
|---|---|
| 1. LICENSE (MIT) | ✅ OK |
| 2. Chave no README.md | ✅ OK |
| 3. Chave no rodapé do HTML | ✅ OK |
| 4. AGENTS.md (mín. 3 agentes) | ✅ OK |
| 5. Agente de Teste documentado | ✅ OK |
| 6. Skills em `skills/` | ✅ OK |
| 7. Front HTML/CSS/JS puro, sem frameworks | ✅ OK |
| 8. Functions + D1 + Discord OAuth2 | ✅ OK |
| 9. Deploy online (`https://achados-perdidos-p26-2b.pages.dev`) | ⚠️ **PENDENTE** |

## Pendências e observações (não corrigidas)

- **Deploy:** criar o D1 remoto, trocar o `database_id` de zeros em `wrangler.jsonc`, aplicar a migração com `--remote`, cadastrar os Secrets do Discord e o `redirect_uri` `https://<projeto>.pages.dev/api/auth/discord/callback` no Developer Portal; depois rodar o validador de novo (item 9).
- **Interface (`public/`):** em reescrita pelo Agente 2. Repetir `node --test tests/api.test.mjs` (o teste estático de XSS lê `public/*.js`) e o validador depois da entrega dele. A versão antiga de `public/app.js` ainda usava um contrato de API diferente (campos `conteudo`, `d1Connected`).
- **Busca com `%`/`_`:** a API remove esses caracteres em vez de escapá-los (`LIKE ... ESCAPE`), então buscar "100%" não encontra "100% inox". Seguro, só menos preciso.
- **Logout** não passa por `lerJson` (sem checagem de `Origin`/Content-Type). Risco baixo: `SameSite=Lax` já impede o envio do cookie em POST de outro site, e o efeito seria só deslogar.
- O erro 500 `d1_erro` do middleware devolve a mensagem interna da exceção em `details`; em produção seria melhor só registrar no log.
- `idValido` aceita formatos como `1e3` e `0x10` (viram 1000 e 16). Sem impacto de segurança.
- Reexecução: cada usuário de teste pode cadastrar 20 itens/dia; cerca de 4 execuções seguidas cabem no limite, depois é preciso rodar o `seed-local.sql` de novo (ele zera os dados de teste).


---

## Re-execução final (após a interface do Agente 2 e as correções do Agente 1)

- Correções adicionais no backend, a partir dos problemas relatados pelo Agente 2:
  - `functions/api/items/index.js`: a data máxima passou a ser "hoje" no horário de Brasília (UTC-3); antes havia uma tolerância de 36 h.
  - `functions/api/items/[id].js`: "encerrar" devolve 409 se outra requisição já encerrou o item.
- Novo teste: "data de amanhã (+1 dia)" → 400. As datas dos testes agora são calculadas em UTC-3, igual ao servidor.
- Resultado: **81 testes, 81 aprovados, 0 falhas**.
- `node validar-local.mjs P26-2B-DEE2-E5F5-044F-D681`: itens 1 a 8 ✅; item 9 (deploy online) pendente até a publicação.
