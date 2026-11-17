# Relatório de Teste e Validação — Projeto #24 (P26-2C-BF60-C440-6484-80FA)

- **Data:** 2026-11-17
- **Agente:** Teste e Validação (`agents/teste-validacao.md`, skill `skills/teste-validacao/SKILL.md`)
- **Contrato testado:** `docs/API.md`

## Ambiente

| Item | Valor |
|---|---|
| SO | Windows 11 Pro (Git Bash) |
| Node | v26.8.1 (`fetch` nativo, sem dependências) |
| Wrangler | 4.164 via `npx wrangler` |
| Servidor | `npx wrangler pages dev public --port 8788` |
| Banco | D1 **local** (`.wrangler/state`). Nada foi executado com `--remote`. |
| Sessões de teste | usuários e sessões inseridos direto no D1 local por `tests/e2e.mjs` (`wrangler d1 execute DB --local --file`), com ids e tokens aleatórios a cada execução |
| OAuth | 1ª execução sem `.dev.vars`; 2ª com um `.dev.vars` **temporário** (`DISCORD_CLIENT_ID=test123`, `DISCORD_CLIENT_SECRET=fake`), apagado ao final |

**Observação de ambiente:** ao iniciar, o D1 local **não tinha a migração aplicada**
(`/api/status` devolvia `"d1": false` e `wrangler d1 migrations list DB --local` listava `0001_init.sql` como pendente).
Apliquei `wrangler d1 migrations apply DB --local` (passo 1 da skill). Depois disso, `d1: true`.

## Como reproduzir

```bash
cd P26-2C-BF60-C440-6484-80FA
npx wrangler d1 migrations apply DB --local
npx wrangler pages dev public --port 8788      # em outro terminal
node tests/e2e.mjs http://localhost:8788       # suíte e2e (reexecutável)
node tests/audit.mjs                           # auditoria estática (não precisa de servidor)
cd .. && node validar-local.mjs P26-2C-BF60-C440-6484-80FA
```

Para o grupo OAuth completo, crie antes um `.dev.vars` com credenciais **falsas** e reinicie o servidor;
sem ele o grupo testa a resposta `500 not_configured` e marca o resto como SKIP.

## Resultado geral

| Execução | PASS | FAIL | SKIP |
|---|---|---|---|
| `tests/e2e.mjs` sem Discord configurado | 248 | 3 | 1 |
| `tests/e2e.mjs` com `.dev.vars` de teste (OAuth ativo) | 265 | 3 | 0 |
| `tests/audit.mjs` | 130 | 0 | — |
| `validar-local.mjs` | 8 OK | 0 | 1 PENDENTE (deploy) |

As 3 falhas da suíte e2e são as mesmas nas duas execuções e correspondem aos defeitos D1 e D2 abaixo.

## Casos → resultado

| # | Grupo (skill) | O que foi verificado | Resultado |
|---|---|---|---|
| 1 | Autenticação | escritas sem cookie, token inventado, token malformado/SQLi e sessão expirada → 401; `/api/me` deslogado → `{ user: null }`; `/api/me` só expõe `UserPublic`; logout apaga só a própria sessão, expira o cookie, token antigo deixa de valer; logout sem cookie → 200 | **PASS**, exceto `GET /api/auth/logout` → 404 em vez de 405 (D2) |
| 2 | OAuth | sem config → 500 `not_configured`; com config: 302 para `discord.com/oauth2/authorize`, `scope=identify`, `redirect_uri` correto, `state` de 64 hex novo a cada vez, cookie `oauth_state` HttpOnly 10 min; callback sem cookie, com state divergente, sem state, vazio → `/?auth_error=invalid_state` sem criar sessão; sem `code` → `missing_code`; `?error=access_denied` repassado; `?error=<script>` normalizado; state correto + code falso → `/?auth_error=token_exchange_failed` (sem 500, sem sessão, `oauth_state` limpo) | **PASS** |
| 3 | Autoria | B não edita, não exclui, não aprova, não recusa, não cancela e não registra devolução de livro/pedido de A (403); solicitante não aprova/recusa/devolve; dono não cancela; portador (holder) não edita; antigo dono não edita livro trocado; pedidos alheios não aparecem em `incoming`/`outgoing` | **PASS** |
| 4 | Regras de estado | pedir o próprio livro → 403 `own_book`; livro Reservado/Emprestado → 409; `mode` incompatível → 400 `mode_not_allowed`; `offered_book_id` em empréstimo → 400; oferecer livro alheio → 403, inexistente → 404, já Reservado → 409; 4º pendente → 429 (e libera após cancelar); 101º livro → 429; `due_date` ausente, ontem, hoje, hoje+91, inválida, outros formatos → 400 (pedido segue pendente); amanhã e hoje+90 aceitos; excluir Reservado/Emprestado → 409; transições a partir de estado errado → 409 | **PASS** |
| 5 | Campos protegidos | `status`, `owner_id`, `holder_id`, `due_date`, `id`, `created_at`, `is_mine` injetados no POST/PATCH de livro, no POST de pedido e no approve não têm efeito: livro fica `Disponível`, dono = quem chamou, holder = solicitante real (conferido pelo GET) | **PASS** |
| 6 | Fluxo feliz | empréstimo: criar (título acentuado) → pedir → Reservado → aprovar com hoje+14 → `Emprestado`, `holder` = solicitante, `due_date` gravada → devolver → `Disponível`, holder/due_date nulos; troca com livro oferecido → `concluido`, donos trocados, ambos `Disponível`; troca sem oferecido; cancelar troca libera os dois livros; excluir livro Disponível | **PASS** |
| 7 | Corrida | 6 pedidos simultâneos no mesmo livro → exatamente 1×201 e 5×409; 6 pedidos simultâneos do mesmo usuário → exatamente 3×201 e 3×429, sem reserva órfã; aprovar × cancelar → 1×200 e 1×409 com estado final coerente; aprovar 2× + recusar → 1×200; mesmo livro oferecido em duas trocas simultâneas → 1×201; excluir × pedir → coerente | **PASS** |
| 8 | Entrada maliciosa | `'; DROP TABLE books; --` e `<img src=x onerror=alert(1)>` gravados literalmente (título, autor, descrição, mensagem) e tabela intacta; `q=%`, `q=_`, `q=' OR '1'='1`, `q=\` não listam tudo; q > 100 → 400; filtros inválidos → 400; JSON inválido/array/null/string/número → 400; sem Content-Type, `text/plain`, form-urlencoded e multipart → 415; corpo > 20000 → 400; limites de tamanho e enums → 400; Origin de outro site ou `null` → 403 `bad_origin`; ids malformados → 404 JSON; rota desconhecida → 404 JSON | **PASS**, exceto `application/jsonx` aceito (D1) e `GET` em rota de ação → 404 (D2) |
| 9 | Frontend | sem framework/CDN e imports só locais; nenhum `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`eval`; sem script inline; `el()` só registra `on*` quando o valor é função; avatar só aceita `https://`; chave no `<footer>` estático e no `<title>`; sem `text-shadow`; `/`, `/app.js`, `/js/*.js`, `/styles.css` → 200 com Content-Type correto; as 13 rotas `/api` distintas chamadas pelo frontend existem em `functions/` com o método certo | **PASS** |
| 9b | Backend (auditoria) | nenhuma rota de login falsa; só o callback OAuth cria sessões; `state` conferido antes da troca do `code`; todo SQL usa `prepare` + `bind`; cada interpolação `${…}` em SQL auditada (constantes, colunas fixas de `validateBookInput`, ternário de literais) | **PASS** |
| 10 | Rubrica | `node validar-local.mjs P26-2C-BF60-C440-6484-80FA` | itens 1–8 **OK**; item 9 (deploy) **PENDENTE**, esperado porque ainda não há deploy, **não é defeito** |

Saída de `validar-local.mjs`:

```
  ✅ [OK]     1. Arquivo LICENSE (MIT)
  ✅ [OK]     2. Chave Única no README.md
  ✅ [OK]     3. Chave Única no rodapé do HTML
  ✅ [OK]     4. Documento AGENTS.md (Mín. 3 agentes)
  ✅ [OK]     5. Agente de Teste e Validação documentado
  ✅ [OK]     6. Arquivos de Skills na pasta skills/
  ✅ [OK]     7. Frontend HTML/CSS/JS Puro (Sem frameworks proibidos)
  ✅ [OK]     8. Backend Cloudflare Functions + D1 + Discord OAuth2
  ⚠️ [PENDENTE] 9. Deploy Online na Cloudflare (https://p26-2c-bf60-c440-6484-80fa.pages.dev)
```

## Defeitos encontrados

Nenhum defeito crítico ou alto. As regras de autoria, estado, campos protegidos e concorrência resistiram a todas as tentativas.

### D1 — `Content-Type` aceito por prefixo (severidade: baixa)

- **Onde:** `src/http.js:74`, em `readJson`: `ct.split(";")[0].trim().startsWith("application/json")`
- **Problema:** aceita qualquer tipo que **comece** com `application/json`, por exemplo `application/jsonx` ou
  `application/json-patch+json`. O contrato exige `Content-Type: application/json`. O risco real de CSRF é
  baixo, porque esses tipos já forçam preflight CORS, e o Origin também é conferido. Mesmo assim, a regra está mais frouxa do que a documentada.
- **Reprodução:**
  ```bash
  curl -i -X POST http://localhost:8788/api/books -H "Cookie: session=<token válido>" \
    -H "Content-Type: application/jsonx" \
    -d '{"title":"x","author":"y","category":"tecnico","mode":"ambos","condition":"bom"}'
  # obtido: 201 Created  — esperado: 415 unsupported_media_type
  ```
  Caso e2e: `[G8] Content-Type application/jsonx (não é application/json) → 415`.
- **Correção sugerida:** comparar o tipo inteiro: `ct.split(";")[0].trim() === "application/json"`.

### D2 — `GET` em rota que só aceita POST responde 404, e o 405 vem sem corpo JSON (severidade: baixa)

- **Onde:** `functions/api/_middleware.js:8`, junto com o roteamento do Pages.
- **Problema:** a skill do backend (`skills/serverless-d1-discord/SKILL.md`, item 2) promete "método não exportado → 405 automático".
  Para `PUT`/`DELETE` isso vale. Para `GET`, o Pages cai no HTML estático (fallback de SPA), e o middleware
  converte esse HTML em `404 not_found`. Além disso, os 405 automáticos saem com corpo vazio e sem
  `Content-Type`, contra o contrato ("Respostas são JSON").
- **Reprodução:**
  ```bash
  curl -i http://localhost:8788/api/auth/logout               # 404 {"error":"not_found"...}   (esperado 405)
  curl -i http://localhost:8788/api/requests/1/approve        # 404                            (esperado 405)
  curl -i -X PUT http://localhost:8788/api/books/1 -H "Origin: http://localhost:8788"   # 405, corpo vazio, sem Content-Type
  ```
  Casos e2e: `[G1] GET /api/auth/logout → 405 (só POST)` e `[G8] GET em rota de ação → 405`.
- **Correção sugerida:** no middleware, converter `res.status === 405` em
  `errorResponse(405, "method_not_allowed", "Método não permitido.")`. Para o GET, exportar
  `onRequestGet` nas rotas só-POST (`auth/logout.js`, `requests/[id]/*.js`) devolvendo esse mesmo 405 JSON
  (ou aceitar o 404 e corrigir a frase da skill).

### Observações (fora do texto do contrato, não contadas como falha)

- **O1 — excluir um livro apaga o histórico de pedidos.** `migrations/0001_init.sql:49`
  (`book_id … REFERENCES books(id) ON DELETE CASCADE`) com `src/books.js:102`. Um empréstimo `devolvido`
  ou `recusado` some do "Meus pedidos" do solicitante quando o dono exclui o livro.
  Reprodução: pedir → recusar → dono exclui o livro → `GET /api/requests?box=outgoing` do solicitante não traz mais o pedido.
  Sugestão: decidir se isso é intencional. Se não for, use exclusão lógica ou impeça a exclusão de livros com histórico.
- **O2 — `mode` pode mudar com um pedido pendente, e o approve não confere o `mode` de novo.**
  `src/books.js:85-95` (PATCH aceita `mode` em livro `Reservado`) e `src/requests.js:140-185` (approve não
  confere `mode`). Reprodução: livro `ambos`, pedido de troca pendente → dono faz PATCH `mode: "emprestimo"`
  → aprova → a troca é concluída num livro que agora é "só empréstimo". O contrato só exige a compatibilidade
  no momento do pedido, então não há violação literal. Sugestão: bloquear a troca de `mode` enquanto o livro não estiver `Disponível`.
- **O3 — mensagens de erro de OAuth no frontend.** `public/app.js:83-88` não mapeia `token_exchange_failed`,
  `fetch_user_failed`, `missing_code` nem `server_error`. O usuário vê a mensagem genérica com o código. Isso é cosmético.

## O que não pôde ser testado

- **OAuth real com o Discord:** sem credenciais reais, não foi possível validar a troca de `code` por token,
  `/users/@me`, o upsert do usuário real nem o cookie `session` emitido pelo callback. A troca foi exercitada
  até o Discord recusar as credenciais falsas (`token_exchange_failed`), e as rotas autenticadas foram testadas com sessões inseridas no D1.
- **Ambiente publicado (`https://p26-2c-bf60-c440-6484-80fa.pages.dev`):** ainda não há deploy (item 9 PENDENTE).
  Não foram verificados o D1 remoto, o comportamento de `Secure`/`SameSite` em HTTPS real, a checagem de `Origin` atrás do proxy da Cloudflare nem o fallback de SPA em produção.
- **Interface no navegador:** fiz a auditoria estática e o smoke HTTP dos arquivos. Não houve teste de clique, leitor de tela, modo escuro nem largura de 360px.
- **Concorrência no D1 remoto:** as corridas foram feitas contra o D1 local (SQLite do Miniflare, serializado). O D1 de produção também serializa as escritas por banco, mas isso não foi medido.
