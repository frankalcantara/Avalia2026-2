---
name: qa-cloudflare
description: Checklist de testes e execução local para Cloudflare Pages e D1.
---

- Execute `npm test` e inicialize Pages localmente com o comando `npm run dev`.
- Valide a rota de saúde com `GET /api/health` e confirme o comportamento para métodos não permitidos.
- Use somente D1 local; nunca execute deploy nem migrations remotas sem autorização explícita.
