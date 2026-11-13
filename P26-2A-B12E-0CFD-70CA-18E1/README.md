# Projeto #43 — Sorteador Auditável de Equipes e Ordem de Apresentação

- **Estudante:** Bruno Kenyu Ochiai
- **RA:** 2026005370
- **Turma:** 2A
- **Modalidade:** Projeto Oficial Sorteado (0 a 100 pontos)
- **Chave Única:** `P26-2A-B12E-0CFD-70CA-18E1`
- **URL_CLOUDFLARE:** `https://avalia2026-2-2f6.pages.dev/`
- **Repositório:** `https://github.com/Kenchiai/Avalia2026-2`
- **Licença:** MIT

---

## O que é

Ferramenta para professores e representantes de turma sortearem **equipes** ou
a **ordem de apresentação** de um seminário. O organizador entra com o Discord,
monta a lista de participantes (manualmente, por entrada dos próprios alunos ou
as duas coisas) e dispara o sorteio.

O ponto central é a **auditoria**. O embaralhamento **Fisher-Yates roda dentro
da Cloudflare Function**, nunca no navegador. O resultado vira uma **ata
imutável no Cloudflare D1**, com código de verificação `SORT-XXXX-XXXX`, data/hora
e hash SHA-256. Qualquer pessoa pode abrir a ata pública e **recalcular o hash no
próprio navegador** — sem confiar na API.

## Stack obrigatória

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + CSS3 + **JavaScript puro** (sem framework, sem bundler) |
| Backend | **Cloudflare Pages Functions** (ES Modules) |
| Banco | **Cloudflare D1** (SQLite) |
| Login | **Discord OAuth2**, escopo `identify` apenas |
| Deploy | Cloudflare Pages + D1 |

Nenhum framework de UI, nenhuma dependência de produção, nenhum passo de build.

## Como a auditoria funciona

1. O organizador dispara `POST /api/rooms/{code}/draw`.
2. A Function tira um **snapshot** dos participantes do D1.
3. O Fisher-Yates roda no servidor com `crypto.getRandomValues` e registra cada
   troca efetiva em `swaps: [[i, j], ...]`.
4. Um **payload canônico** (chaves ordenadas, sem espaços) é serializado e
   recebe SHA-256 → `audit_hash`.
5. A ata é gravada com `seq`, `prev_hash` (elo da ata anterior), código de
   verificação e `created_at`. Triggers do D1 **abortam UPDATE e DELETE**.
6. O navegador reconstrói o mesmo payload, recalcula o SHA-256 e reaplica os
   `swaps`. Se qualquer byte mudou, o hash não confere.

Re-sorteios **não apagam** nada: criam uma nova ata (`seq + 1`) encadeada pelo
hash da anterior. A ata é reconstruída do snapshot gravado, nunca da tabela
`rooms` mutável.

## Funcionalidades

- Criar sala em modo **equipes** (tamanho máximo de 2 a 50, grupos balanceados
  com diferença de no máximo 1) ou **ordem de apresentação**.
- Adicionar participantes manualmente (um nome por linha).
- Abrir a entrada para alunos entrarem sozinhos com o Discord.
- Sortear e re-sortear, sempre gerando uma nova ata imutável.
- Consultar a ata pública por código, com resultado, hash, snapshot e cadeia
  de atas anteriores.
- Verificar a ata no navegador com WebCrypto.
- Tema claro/escuro, layout responsivo e impressão da ata.

## Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/api/health` | Sonda pública: Function + D1 + config do Discord |
| `GET` | `/api/me` | Sessão atual e se o OAuth está configurado |
| `GET` | `/api/auth/discord` | Inicia o OAuth2 com `state` |
| `GET` | `/api/auth/discord/callback` | Troca o code, importa o perfil e cria a sessão |
| `POST` | `/api/auth/logout` | Encerra a sessão no D1 |
| `GET`/`POST` | `/api/rooms` | Lista as salas do dono / cria uma sala |
| `GET`/`PATCH`/`DELETE` | `/api/rooms/{code}` | Detalhe público, edição e exclusão (sem ata) |
| `GET`/`POST` | `/api/rooms/{code}/participants` | Lista / adiciona nomes manuais |
| `DELETE` | `/api/rooms/{code}/participants/{id}` | Remove um participante |
| `POST`/`DELETE` | `/api/rooms/{code}/join` | Aluno entra / sai com o Discord |
| `POST` | `/api/rooms/{code}/draw` | Executa o sorteio e grava a ata |
| `GET` | `/api/rooms/{code}/draws` | Histórico de atas da sala |
| `GET` | `/api/draws` | Últimas atas públicas |
| `GET` | `/api/draws/{codigo}` | Ata pública por `SORT-XXXX-XXXX` |

Toda resposta de erro segue `{ ok: false, erro, mensagem }`. Rotas que alteram
estado exigem sessão, checam `Origin` e recusam origem externa.

## Segurança

- Cookie de sessão `HttpOnly; Secure; SameSite=Lax`; o D1 guarda **apenas** o
  SHA-256 de um token aleatório de 32 bytes.
- `state` no OAuth2 contra CSRF de login; `next` só aceita caminho interno.
- `DISCORD_CLIENT_SECRET` nunca é versionado (`.dev.vars` local;
  `wrangler pages secret put` em produção).
- CSP restritiva, `X-Content-Type-Options`, `X-Frame-Options` e
  `Referrer-Policy` no `_middleware.js`.
- Toda query usa `prepare(...).bind(...)`.
- Nomes de usuário são renderizados com `textContent`, nunca como HTML.

## Rodar localmente

```powershell
cd P26-2A-B12E-0CFD-70CA-18E1

# 1. testes unitários, de schema e de rota
node --test tests/

# 2. banco local + migration
Remove-Item -Recurse -Force .wrangler\state\v3\d1 -ErrorAction SilentlyContinue
npx.cmd --yes wrangler@latest d1 execute DB --local --file=migrations/0001_init.sql

# 3. servidor
npx.cmd --yes wrangler@latest pages dev public --port 8788 --ip 127.0.0.1
# abra http://127.0.0.1:8788/
```

Para repetir o E2E de API (67 asserções), semeie sessões e rode o script:

```powershell
npx.cmd --yes wrangler@latest d1 execute DB --local --file=scripts/semear-sessoes.sql
node scripts/e2e-api.mjs
```

Para login real, copie `.dev.vars.example` para `.dev.vars` e preencha
`DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET`. Sem o secret, o roteiro
`skills/teste-validacao/SKILL.md` mostra como semear sessões no D1 local.

## Deploy no Cloudflare Pages + D1

1. **Pages:** Workers & Pages → Create → Pages → Connect to Git → fork
   `Avalia2026-2`.
   - **Root directory:** `P26-2A-B12E-0CFD-70CA-18E1`
   - **Build command:** *(vazio)*
   - **Build output directory:** `public`
2. **D1:**
   ```powershell
   npx.cmd wrangler d1 create db-p26-2a-b12e-0cfd-70ca-18e1
   # copie o database_id para wrangler.jsonc
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
3. **Binding:** Pages → Settings → Functions → D1 database bindings →
   variable `DB` → banco `db-p26-2a-b12e-0cfd-70ca-18e1`.
4. **Discord:** Developer Portal → OAuth2 → Redirect
   `https://SEU-DEPLOY.pages.dev/api/auth/discord/callback`.
5. **Segredo:**
   ```powershell
   npx.cmd wrangler pages secret put DISCORD_CLIENT_SECRET --project-name <projeto>
   npx.cmd wrangler pages secret put DISCORD_CLIENT_ID --project-name <projeto>
   ```
6. Atualize **URL_CLOUDFLARE** no topo deste README e valide:
   ```powershell
   node validar-local.mjs P26-2A-B12E-0CFD-70CA-18E1
   ```

## Verificação

| Verificação | Resultado |
|---|---|
| `node --test tests/` | **46/46** testes |
| E2E de API com sessões semeadas | **67** asserções |
| Lighthouse | acessibilidade **100**, boas práticas **100** |
| Ata no navegador | “Ata íntegra ✔” (hash + replay) |

## Agentes e skills

O desenvolvimento usou **4 agentes** no harness **OpenCode**, incluindo um
agente dedicado a teste e validação. O mapeamento completo, as evidências e a
licença das skills vendorizadas estão em [`AGENTS.md`](./AGENTS.md).

Skills autorais: `cloudflare-d1-discord`, `sorteio-auditavel`, `teste-validacao`
e `vanilla-ui-dom`. Skills adaptadas do Ponytail (MIT, © 2026 DietrichGebert),
com origem fixada no commit `96608e078b2d5ea607c5c3b8b5a54d1c1fba6846`:
`ponytail`, `ponytail-review`, `ponytail-audit` e `ponytail-debt`.

## Estrutura

```text
P26-2A-B12E-0CFD-70CA-18E1/
├── functions/            # Pages Functions (API)
│   ├── _lib/             # crypto, db, http, sessao, discord, salas, sorteio
│   ├── api/              # rotas
│   └── _middleware.js    # CSP + segurança
├── migrations/           # schema D1
├── public/               # HTML5, CSS3 e JS puro
├── scripts/              # semeadura de sessões + E2E de API
├── tests/                # unitários, schema, rotas e documentação
├── skills/               # skills autorais + vendor/ponytail
├── .opencode/agents/     # 4 agentes
├── opencode.json         # harness
├── wrangler.jsonc        # Pages + binding DB
├── AGENTS.md             # harness, agentes e skills
└── LICENSE               # MIT
```

## Licença

MIT — @2026 Bruno Kenyu Ochiai. As skills vendorizadas mantêm a licença MIT de
seus autores, preservada em `skills/vendor/ponytail/LICENSE`.
