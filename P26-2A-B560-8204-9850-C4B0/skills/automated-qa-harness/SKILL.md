---
name: automated-qa-harness
description: Estratégias e templates de testes unitários, de integração com Wrangler/D1 e validação automatizada via GitHub Actions.
---

# Suíte de QA Automatizado & Validação Contínua

## 1. Estrutura de Testes (`<PROJECT_DIR>/tests/`)
Utilize o runner nativo do Node.js (`node --test`) para máxima velocidade e zero fragilidade no CI:
```text
tests/
├── unit/
│   ├── validation.test.js    # Regras de negócio, cálculos e sanitização
│   └── session-hmac.test.js  # Assinatura e verificação de tokens de sessão
└── integration/
    ├── cors.test.js          # Preflight OPTIONS, origens permitidas e bloqueadas
    └── api-endpoints.test.js # Rotas HTTP, status 401/400/200 e persistência D1
```

## 2. Exemplo de Teste de Integração HTTP & CORS (`tests/integration/cors.test.js`)
```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

const BASE_URL = process.env.TEST_BASE_URL || '[http://127.0.0.1:8788](http://127.0.0.1:8788)';

test('Preflight OPTIONS deve retornar 204 para origem permitida', async () => {
  const res = await fetch(`${BASE_URL}/api/status`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:8788',
      'Access-Control-Request-Method': 'POST',
    },
  });

  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:8788');
  assert.equal(res.headers.get('access-control-allow-credentials'), 'true');
});

test('Preflight OPTIONS deve bloquear origem não autorizada com 403', async () => {
  const res = await fetch(`${BASE_URL}/api/status`, {
    method: 'OPTIONS',
    headers: {
      Origin: '[https://origem-maliciosa.example.com](https://origem-maliciosa.example.com)',
      'Access-Control-Request-Method': 'POST',
    },
  });

  assert.equal(res.status, 403);
});
```

## 3. Execução Local Orquestrada (a partir de `<PROJECT_DIR>`)
```bash
# 1. Aplicar schema no D1 local
npx wrangler d1 migrations apply DB --local

# 2. Subir Pages Functions em background e executar suíte completa
npx wrangler pages dev public --d1=DB --port=8788 &
SERVER_PID=$!
sleep 3
TEST_BASE_URL=[http://127.0.0.1:8788](http://127.0.0.1:8788) node --test tests/**/*.test.js
EXIT_CODE=$?
kill $SERVER_PID
exit $EXIT_CODE
```