# Documentação de Engenharia de Agentes e Harness (P26-2A-B560-8204-9850-C4B0)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** **OpenCode** (CLI + TUI, modelo **Nemotron 3 Ultra** via OpenRouter — `nvidia/nemotron-3-ultra-550b-a55b:free`)
- **Modelo(s) Base:** Nemotron 3 Ultra (contexto 128k, otimizado para código e raciocínio técnico)
- **Estratégia de Coordenação:** **Hub-and-spoke sequencial estrita** — o agente `@orchestrator` despacha um subagente por vez via `task`, aguarda conclusão, valida arquivos em disco, passa ao próximo. Isolamento total em `PROJECT_DIR = P26-2A-B560-8204-9850-C4B0/`. Estado compartilhado apenas via sistema de arquivos (especificações D1, contratos JSON, `wrangler.jsonc`). Zero chamadas paralelas para respeitar cotas de taxa (rate limits) de modelos gratuitos.

---

## 2. Agentes Criados e Responsabilidades (6 Agentes — Sequência de Execução)

### Agente 1: `@infra-devops` — Infraestrutura, GitHub CLI, CI/CD, Cloudflare Pages/D1
- **Papel:** Preparação do ambiente base isolado na subpasta do fork.
- **Skills:** `github-cli-actions`, `cloudflare-pages-d1`
- **Entregas:**
  - `wrangler.jsonc` com `name = p26-2a-b560-8204-9850-c4b0`, binding D1 `DB`, `pages_build_output_dir = ./public`
  - `package.json` (ESM, zero deps, scripts: `dev`, `test`, `db:migrate:local`, `deploy`)
  - `.gitignore` (`.wrangler/`, `.dev.vars`, `node_modules/`, `dist/`)
  - `.dev.vars.example` (placeholders Discord + `SESSION_SECRET`)
  - `.github/workflows/ci-deploy.yml` — Jobs `build-test` (D1 local + `node --test`) e `deploy` (migrações remotas + Pages deploy), `working-directory` em todos os steps, secrets `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`

### Agente 2: `@backend-architect` — Cloudflare Pages Functions, D1, Discord OAuth2, Validação Server-Side
- **Papel:** Backend completo: schema D1, migrations, 14 módulos de API, autenticação, middleware de segurança.
- **Skills:** `serverless-d1-discord`, `discord-oauth2-sessions`, `cors-edge-security`, `cloudflare-pages-d1`
- **Entregas:**
  - `migrations/0001_init.sql` — 5 tabelas, FKs `ON DELETE CASCADE`, 10 índices, `CHECK` constraints
  - `functions/api/_lib/{http,session,validate,d1}.js` — Utilitários puros (HMAC-SHA256 WebCrypto, validação rigorosa, D1 helpers)
  - `functions/api/_middleware.js` — CORS allowlist, anti-CSRF, rate limit (120R/30W min), headers de segurança, `Vary: Origin`
  - Endpoints: `/api/status`, `/api/auth/{discord,callback,me,logout}`, `/api/recipes` (index, `[id]`, `[id]/favorite`), `/api/favorites`
  - Contratos JSON fixados, 100% `prepare().bind()`, zero fallback de segredos, sessão stateless em cookie `HttpOnly; Secure; SameSite=Lax`

### Agente 3: `@frontend-designer` — HTML5, CSS3, Vanilla JS (Zero Frameworks)
- **Papel:** Interface responsiva, acessível, consumindo a API real via `fetch`.
- **Skills:** `vanilla-dom-ui`, `vanilla-web-craft`
- **Entregas:**
  - `public/index.html` — Header fixo com perfil Discord, tabs ARIA (`Explorar`, `Minhas Receitas`, `Meu Livro`), filtros com debounce 350 ms, grade de cards, dialogs nativos (nova receita, detalhe), rodapé com Chave Única
  - `public/styles.css` — Mobile-first (1→2→3 colunas), tokens CSS (terracota/oliva/creme), dark mode, `text-shadow: none` global, shimmer loading
  - `public/app.js` (ES Module) — Estado único, `AbortController`, favorito otimista com rollback, validação client-side espelhada, criação de receita com ingredientes/passos dinâmicos
  - `public/receitas-math.js` — Funções puras `escalarQuantidade`, `formatarQuantidade`, `fatorEscala` + `window.ReceitasMath` (testável via `node --test`)
  - `public/_headers` — CSP estrita, HSTS, `X-Frame-Options: DENY`, cache `immutable` para assets, `no-store` para `/api/*`
  - `public/favicon.svg`, `public/robots.txt`

### Agente 4: `@security-auditor` — Auditoria de Segurança Aplicada (AppSec) com Correções Cirúrgicas
- **Papel:** Revisão adversarial completa + correção de falhas críticas/altas.
- **Skills:** `cors-edge-security`, `discord-oauth2-sessions`, `teste-validacao`
- **Entregas:**
  - 10 achados (S-01 a S-10), 4 correções aplicadas (`C-01` a `C-04`):
    - **C-01** (`recipes/index.js`): Limite real de padrão `LIKE` (50 bytes UTF-8) → evita `SQLITE_ERROR` por termo longo/emoji (DoS)
    - **C-02** (`_lib/http.js`): Limite de body em bytes reais (`TextEncoder`) → fecha bypass multibyte
    - **C-03** (`auth/discord/callback.js`): Expiração do cookie `oauth_state` em `invalid_state` (400)
    - **C-04** (`_middleware.js`): HSTS em todas as respostas `/api/*`
  - Bateria adversarial real (49/49 PASS): 401/403/400/404/405/413/429, CORS, CSRF, SQLi, mass assignment, rate limit, headers, sessão HMAC, OAuth state, logout
  - **STATUS: APROVADO** (nenhuma falha crítica/alta residual)

### Agente 5: `@qa-engineer` — **Agente Dedicado a Teste e Validação** (Obrigatório pela Rubrica)
- **Papel:** Suíte de testes determinística, offline, cobertura real de regras de negócio.
- **Skills:** `teste-validacao`, `automated-qa-harness`, `cloudflare-pages-d1`
- **Entregas:**
  - `tests/helpers/{d1-mock,env,seed,payload,token}.mjs` — Adapter D1 sobre `node:sqlite`, fixtures, factories
  - 97 testes em 8 suítes: `session`, `validate`, `middleware`, `recipes.crud`, `recipes.search`, `favorites`, `auth`, `math`, `status`, `rubrica`
  - Cobertura: HMAC round-trip, validação server-side, CORS/preflight/rate-limit do middleware de borda, CRUD + autorização (403 `forbidden_not_owner`), ingredientes em colunas separadas (quantity/unit/name) e passos ordenados, busca (q/ingredient/maxTime + regressão S-01), favoritos (toggle/idempotência), OAuth2 (state, callback mock), escalonador (matemática + formatação pt-BR), rubrica estática
  - **3 execuções consecutivas: 97 pass / 0 fail** (determinístico, ~390 ms, zero rede, zero deps)

### Agente 6: `@docs-compliance` — Documentação Técnica, Conformidade, Licença, Sincronização
- **Papel:** README completo, AGENTS.md atualizado, LICENSE MIT, sincronização `.opencode/` ↔ `skills/`, description do repo GitHub.
- **Skills:** `github-cli-actions`, `opencode`
- **Entregas:**
  - `README.md` reescrito (arquitetura, schema, endpoints, escalonador, segurança, otimizações, CI/CD, harness/agentes/skills, licença)
  - `AGENTS.md` atualizado (6 agentes, harness OpenCode, skills por agente, estratégia hub-and-spoke)
  - `LICENSE` MIT válida (copyright 2026 Leonardo Mulhenhoff Borim)
  - Sincronização `skills/` ↔ `.opencode/skills/` verificada
  - `gh repo edit lewou12/Avalia2026-2 --description "Projeto #28 | P26-2A-B560-8204-9850-C4B0 | Livro de Receitas Colaborativo com Escalonador de Porções | Cloudflare Pages + D1 + Discord OAuth2 | Vanilla JS"`

---

## 3. Pasta `skills/` e `.opencode/skills/` (Espelhadas)

| Skill | Descrição | Usada por |
|-------|-----------|-----------|
| `serverless-d1-discord` | Cloudflare Functions + D1 + Discord OAuth2 | `@backend-architect`, `@infra-devops` |
| `discord-oauth2-sessions` | OAuth2 Authorization Code Flow + HMAC-SHA256 stateless | `@backend-architect`, `@security-auditor` |
| `cors-edge-security` | CORS rigoroso, headers, rate limit | `@backend-architect`, `@security-auditor` |
| `cloudflare-pages-d1` | Wrangler, D1 migrations, Pages, cota gratuita | `@infra-devops`, `@backend-architect`, `@qa-engineer` |
| `vanilla-dom-ui` / `vanilla-web-craft` | HTML5/CSS3/Vanilla JS sem frameworks | `@frontend-designer` |
| `teste-validacao` / `automated-qa-harness` | Protocolo QA, testes offline D1 | `@qa-engineer`, `@security-auditor` |
| `github-cli-actions` | `gh` fork, secrets, workflows, repo description | `@infra-devops`, `@docs-compliance` |
| `opencode` | Configuração do harness OpenCode | `@orchestrator`, `@docs-compliance` |

---

## 4. Validação Final (Rubrica 100 pontos — Itens Determinísticos)

Executado na raiz do repositório (`C:\Users\leona\Desktop\Avaliacao\Avalia2026-2`):

```powershell
node validar-local.mjs P26-2A-B560-8204-9850-C4B0
```

**Resultado esperado (itens 1–8):**
- ✅ LICENSE (MIT)
- ✅ Chave Única no README.md
- ✅ Chave Única no rodapé do HTML (`public/index.html` → `<footer>`)
- ✅ AGENTS.md ≥ 3 agentes + agente de teste/validação
- ✅ Pasta `skills/` com ≥ 1 `SKILL.md`
- ✅ Frontend Vanilla (sem frameworks proibidos)
- ✅ Backend Cloudflare Functions + D1 + Discord OAuth2
- (Item 9 — Deploy online — validado separadamente após `gh` + Cloudflare Pages)

---

Chave Única de Auditoria: `P26-2A-B560-8204-9850-C4B0` — Turma 2A — Licenciado sob MIT