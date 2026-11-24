---
name: cloudflare-pages-d1
description: Padrões de arquitetura para Cloudflare Pages Functions, Workers, Wrangler CLI e banco D1 otimizados para o plano gratuito.
---

# Cloudflare Pages Functions & D1 Playbook (Free Tier Optimized)

## 1. Estrutura de Diretórios (Economia de Invocações)
Posicione o middleware dentro de `functions/api/` para que ativos estáticos em `public/` sejam servidos diretamente pelo CDN sem gastar a cota diária de 100.000 requisições de Functions:

```text
<PROJECT_DIR>/
├── public/                     # Servido 100% pelo CDN (zero custo de Worker Function)
│   ├── index.html
│   ├── _headers                # Headers de segurança e cache para ativos estáticos
│   ├── css/
│   └── js/
├── functions/
│   └── api/
│       ├── _middleware.js      # CORS e hardening aplicados apenas em /api/*
│       ├── health.js           # GET /api/health
│       └── auth/
│           ├── login.js        # GET /api/auth/login
│           ├── callback.js     # GET /api/auth/callback
│           ├── me.js           # GET /api/auth/me
│           └── logout.js       # POST /api/auth/logout
├── migrations/
│   └── 0001_initial_schema.sql
└── wrangler.toml
```

## 2. Configuração `wrangler.toml` / `wrangler.jsonc`
```toml
name = "app-serverless"
compatibility_date = "2025-01-01"
pages_build_output_dir = "public"

[[d1_databases]]
binding = "DB"
database_name = "app-db"
database_id = "<D1_DATABASE_ID>"
migrations_dir = "migrations"
```

## 3. Comandos Essenciais Wrangler
```bash
# Criar banco D1
npx wrangler d1 create app-db

# Aplicar migrations localmente e em produção
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote

# Executar servidor local integrado Pages + D1
npx wrangler pages dev public --d1=DB --port=8788

# Configurar secrets de produção
printf "%s" "$DISCORD_CLIENT_SECRET" | npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name=app-serverless
```

## 4. Boas Práticas D1 no Plano Gratuito (500 MB / 5M leituras / 100k escritas por dia)
- Use apenas **1 banco D1 remoto** por projeto; use `--local` para desenvolvimento e CI.
- Crie `INDEX` em toda coluna usada em `WHERE`, `JOIN` ou `ORDER BY`.
- Use `.prepare(...).bind(...)` e `db.batch([...])` em operações compostas:

```javascript
export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders,
    },
  });
}
```