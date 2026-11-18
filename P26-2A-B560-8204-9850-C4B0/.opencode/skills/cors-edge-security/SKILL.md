---
name: cors-edge-security
description: Configuração rigorosa de CORS em functions/api/_middleware.js e headers de segurança estáticos em public/_headers.
---

# Domínio de CORS & Segurança HTTP na Borda

## 1. Headers para Ativos Estáticos (`public/_headers`)
Garante segurança nos arquivos HTML/CSS/JS diretamente pelo CDN do Cloudflare Pages sem consumir invocações de Functions:
```text
/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: strict-origin-when-cross-origin
```

## 2. Middleware CORS da API (`functions/api/_middleware.js`)
```javascript
const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:8788',
  '[http://127.0.0.1:8788](http://127.0.0.1:8788)',
];

function resolveAllowedOrigin(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return null;

  const requestOrigin = new URL(request.url).origin;
  if (origin === requestOrigin) return origin;

  const configured = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const allowlist = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
  return allowlist.has(origin) ? origin : null;
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const allowedOrigin = resolveAllowedOrigin(request, env);

  const corsHeaders = {
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Max-Age': '86400',
  };

  if (allowedOrigin) {
    corsHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
    corsHeaders['Access-Control-Allow-Credentials'] = 'true';
  }

  if (request.method === 'OPTIONS') {
    if (request.headers.get('Origin') && !allowedOrigin) {
      return new Response('CORS Origin Forbidden', { status: 403 });
    }
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const response = await next();
  const newHeaders = new Headers(response.headers);

  for (const [k, v] of Object.entries(corsHeaders)) {
    newHeaders.set(k, v);
  }

  newHeaders.set('X-Content-Type-Options', 'nosniff');
  newHeaders.set('X-Frame-Options', 'DENY');
  newHeaders.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
```