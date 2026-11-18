# Projeto #28: Livro de Receitas Colaborativo com Escalonador de Porções

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Leonardo Mulhenhoff Borim
- **RA:** 2026107646
- **Turma:** 2A
- **Chave Única:** `P26-2A-B560-8204-9850-C4B0`
- **URL_CLOUDFLARE:** `https://p26-2a-b560-8204-9850-c4b0.pages.dev`

---

## Arquitetura & Stack

| Camada | Tecnologia | Detalhes |
|--------|------------|----------|
| **Frontend** | HTML5 + CSS3 + Vanilla JS (ES2022+) | Zero frameworks, manipulação direta do DOM, `<dialog>` nativo, debounce 350 ms, `AbortController` |
| **Backend** | Cloudflare Pages Functions | Workers runtime, TypeScript-free (JSDoc), ESM puro |
| **Banco** | Cloudflare D1 (SQLite serverless) | 5 tabelas, FKs `ON DELETE CASCADE`, 10 índices, `CHECK` constraints |
| **Auth** | Discord OAuth2 (Authorization Code Flow) | Sessão stateless HMAC-SHA256 em cookie `HttpOnly; Secure; SameSite=Lax` |
| **Edge/Segurança** | `_middleware.js` + `public/_headers` | CORS allowlist, rate limit (120 leituras / 30 escritas por IP/min), CSP, HSTS, `X-Frame-Options: DENY` |
| **CI/CD** | GitHub Actions + Wrangler | `working-directory: P26-2A-B560-8204-9850-C4B0`, migrations D1 locais + `node --test` |

---

## Schema D1 (migrations/0001_init.sql)

```sql
PRAGMA foreign_keys = ON;

-- Usuários vindos do Discord
CREATE TABLE discord_users (
  user_id       TEXT PRIMARY KEY,
  username      TEXT NOT NULL,
  global_name   TEXT,
  avatar        TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Receitas
CREATE TABLE recipes (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  prep_minutes    INTEGER NOT NULL CHECK (prep_minutes BETWEEN 1 AND 1440),
  base_servings   INTEGER NOT NULL CHECK (base_servings BETWEEN 1 AND 100),
  created_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ingredientes (quantidade REAL, unidade TEXT, nome TEXT — campos separados)
CREATE TABLE recipe_ingredients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  name        TEXT NOT NULL,
  quantity    REAL NOT NULL CHECK (quantity >= 0),
  unit        TEXT NOT NULL,
  UNIQUE (recipe_id, position)
);

-- Passos do modo de preparo (sequenciais)
CREATE TABLE recipe_steps (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id     INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL,
  instruction   TEXT NOT NULL,
  UNIQUE (recipe_id, position)
);

-- Favoritos (livro de receitas pessoal)
CREATE TABLE favorites (
  user_id     TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  recipe_id   INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, recipe_id)
);

-- Índices
CREATE INDEX idx_recipes_user          ON recipes(user_id);
CREATE INDEX idx_recipes_prep_minutes  ON recipes(prep_minutes);
CREATE INDEX idx_recipes_created       ON recipes(created_at DESC);
CREATE INDEX idx_recipes_title         ON recipes(title COLLATE NOCASE);
CREATE INDEX idx_ingredients_recipe    ON recipe_ingredients(recipe_id);
CREATE INDEX idx_ingredients_name      ON recipe_ingredients(name COLLATE NOCASE);
CREATE INDEX idx_ingredients_quantity  ON recipe_ingredients(quantity);
CREATE INDEX idx_steps_recipe          ON recipe_steps(recipe_id);
CREATE INDEX idx_favorites_user        ON favorites(user_id);
CREATE INDEX idx_favorites_recipe      ON favorites(recipe_id);
```

---

## Endpoints da API (functions/api/**)

| Método | Path | Auth | Descrição | Respostas |
|--------|------|------|-----------|-----------|
| GET | `/api/status` | não | Diagnóstico (chave, contagens, D1, Discord) | 200, 405 |
| GET | `/api/auth/discord` | não | Inicia OAuth2 (state + cookie `oauth_state`) | 302, 503 |
| GET | `/api/auth/discord/callback` | não | Troca code→token, UPSERT usuário, emite sessão | 302, 400, 500 |
| GET | `/api/auth/me` | não | Usuário da sessão ou `null` | 200 |
| POST | `/api/auth/logout` | sim | Expira cookie de sessão | 200, 405 |
| GET | `/api/recipes` | não* | Lista com filtros (q, ingredient, maxTime, scope, limit, offset) | 200, 400, 401, 429 |
| POST | `/api/recipes` | sim | Cria receita + ingredientes + passos (batch) | 201, 400, 401, 413, 429 |
| GET | `/api/recipes/:id` | não | Detalhe completo (ingredientes + passos ordenados) | 200, 400, 404 |
| DELETE | `/api/recipes/:id` | sim | Apaga apenas se autor (FK remove filhos) | 200, 401, 403, 404 |
| POST | `/api/recipes/:id/favorite` | sim | Toggle favorito | 200, 401, 404 |
| GET | `/api/recipes/:id/favorite` | sim | Estado do favorito | 200, 401, 404 |
| DELETE | `/api/recipes/:id/favorite` | sim | Remove favorito (idempotente) | 200, 401, 404 |
| GET | `/api/favorites` | sim | Lista favoritos do usuário (mesmo shape do index) | 200, 401 |

> * `scope=mine` e `scope=favorites` exigem sessão (401); `scope=all` é público.

**Shape de erro padrão:** `{ ok: false, error: { code, message, details? } }`

---

## Escalonador de Porções

**Fórmula:** `quantidadeExibida = quantidadeBase × (rendimentoAlvo ÷ rendimentoBase)`

- Implementado em **Vanilla JS puro** no `public/receitas-math.js` (funções puras, testáveis via `node --test`).
- No DOM: cada `<span>` de quantidade guarda `data-base-quantity` imutável → recálculo **sempre parte do valor original**, zero acúmulo de erro de arredondamento.
- Formatação pt-BR via `Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 })`.
- Exposto em `window.ReceitasMath` para inspeção/console no navegador.
- Controle com botões `−`/`+`, input numérico e presets (½×, 1×, 2×, 3×), atualização em tempo real via `requestAnimationFrame` — **zero requisições HTTP**.

---

## Segurança (Auditoria @security-auditor → **APROVADO**)

| Vetor | Mitigação |
|-------|-----------|
| **SQL Injection** | 100% `prepare().bind()`, `LIKE` com escape de `% _ \`, `LIMIT/OFFSET` vinculados |
| **XSS** | Zero `innerHTML` com dados de usuário; `textContent` + `createElement`; CSP estrita |
| **CSRF** | `SameSite=Lax` + verificação de `Origin` no middleware (403 `origin_not_allowed`) |
| **Session Hijacking** | HMAC-SHA256 real (WebCrypto), comparação em tempo constante, `exp` válido, segredo ≥ 32 chars sem fallback |
| **OAuth Replay** | `state` CSPRNG 32 bytes em cookie `HttpOnly; Max-Age=600`, validado em tempo constante |
| **Rate Limit / Cota** | 120 req/min leitura, 30 req/min escrita por IP (Map por isolate, limpeza preguiçosa, `Retry-After`) |
| **Headers** | `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `CSP`, `HSTS` |
| **CORS** | Allowlist `ALLOWED_ORIGINS`, `Vary: Origin`, nunca `*` com credenciais, preflight 204 exato |

---

## Otimizações para Plano Gratuito

- **Debounce 350 ms** nos filtros de texto + `AbortController` cancela buscas anteriores → elimina corrida de respostas.
- **Batch D1** (`env.DB.batch`) em criações/exclusões → 1 round-trip transacional.
- **Rate limit por isolate** na edge → protege a cota global de requests.
- **Zero dependências npm** → `package.json` sem `dependencies`/`devDependencies`; cold start mínimo.
- **Cache estático** (`public/_headers`): `immutable` para CSS/JS, `no-store` para `/api/*`.
- **Testes 100% offline** (`node:sqlite` em memória) → CI roda sem segredos Cloudflare.

---

## Como Rodar Localmente

```powershell
cd P26-2A-B560-8204-9850-C4B0
# 1. Instala Wrangler (já presente no ambiente)
# 2. Aplica migrations no D1 local
npm run db:migrate:local        # wrangler d1 migrations apply DB --local
# 3. Sobe o dev server (Pages + D1 local)
npm run dev                     # wrangler pages dev public --d1 DB --local
# 4. Roda a suíte de testes (97 testes, ~390 ms)
npm test                        # node --test tests/*.test.mjs
```

**Variáveis de ambiente** (copie `.dev.vars.example` → `.dev.vars` e preencha):
- `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (Discord Developer Portal)
- `SESSION_SECRET` (≥ 32 chars aleatórios)
- `ALLOWED_ORIGINS` (ex.: `http://localhost:8788`)

---

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/ci-deploy.yml`

- **Triggers:** `push`/`pull_request` em `main` tocando `P26-2A-B560-8204-9850-C4B0/**` ou o próprio workflow; `workflow_dispatch`.
- **Job `build-test`** (ubuntu-latest, Node 24):
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` (Node 24)
  3. `npm ci` (sem deps)
  4. `npx wrangler d1 migrations apply DB --local`
  5. `node --test tests/*.test.mjs` (97 testes)
- **Job `deploy`** (needs `build-test`, só `push` na `main` ou `workflow_dispatch`, `environment: production-cloudflare`):
  1. Mesmos passos de setup
  2. `npx wrangler d1 migrations apply DB --remote`
  3. `npx wrangler pages deploy public --project-name=p26-2a-b560-8204-9850-c4b0 --branch=main`
- **Secrets necessários no repo:** `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- **Variáveis no painel Pages:** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `ALLOWED_ORIGINS`

---

## Harness & Agentes (Engenharia de Agentes)

- **Harness:** **OpenCode** (modelo Nemotron 3 Ultra via OpenRouter)
- **Estratégia:** Hub-and-spoke sequencial (1 agente por vez, isolamento em `PROJECT_DIR`, estado em disco)
- **Agentes criados (6):**
  1. `@infra-devops` — Fork/clone, `wrangler.jsonc`, `package.json`, `.gitignore`, `.dev.vars.example`, workflow CI/CD
  2. `@backend-architect` — Schema D1, migrations, 14 módulos Pages Functions, OAuth2, validação server-side, HMAC-SHA256
  3. `@frontend-designer` — HTML5/CSS3/Vanilla JS responsivo, escalonador tempo real, `public/receitas-math.js`, `_headers`, CSP
  4. `@security-auditor` — Auditoria adversarial completa, 4 correções aplicadas, 49/49 testes adversariais → **APROVADO**
  5. `@qa-engineer` — **Agente dedicado a teste e validação** (obrigatório): 97 testes determinísticos em 8 suítes (session, validate, middleware, recipes CRUD/search, favorites, auth, math, status, rubrica), 3 execuções consecutivas verdes
  6. `@docs-compliance` — README, AGENTS.md, LICENSE, sincronização `.opencode/` ↔ `skills/`, description do repo

- **Skills utilizadas (9, espelhadas em `skills/` e `.opencode/skills/`):**
  - `serverless-d1-discord` — Arquitetura Cloudflare Functions + D1 + Discord OAuth2
  - `discord-oauth2-sessions` — OAuth2 Authorization Code Flow + HMAC-SHA256 stateless
  - `cors-edge-security` — CORS rigoroso, headers de segurança, rate limit
  - `cloudflare-pages-d1` — Wrangler, D1 migrations, Pages Functions, cota gratuita
  - `vanilla-dom-ui` / `vanilla-web-craft` — HTML5/CSS3/Vanilla JS sem frameworks
  - `teste-validacao` / `automated-qa-harness` — Protocolo de QA, testes offline D1
  - `github-cli-actions` — `gh` para fork, secrets, workflows, repo description

- **Artefatos versionados neste diretório:**
  - `.opencode/agents/` — 7 definições de subagentes (`orchestrator`, `infra-devops`, `backend-architect`, `frontend-designer`, `security-auditor`, `qa-engineer`, `docs-compliance`)
  - `.opencode/skills/` — as 9 skills acima, cada uma com `SKILL.md`
  - `.opencode/opencode.jsonc` — configuração do harness (providers, permissões, delegação)
  - `skills/` — espelho versionado das mesmas 9 skills (exigência da rubrica)

---

## Licença

**MIT License** — veja `LICENSE` na raiz deste projeto.

---

Chave Única de Auditoria: `P26-2A-B560-8204-9850-C4B0` — Turma 2A — Licenciado sob MIT