---
name: validacao-e-testes
description: Estratégia de testes e checklist de validação do Commonplace Book.
---

# Validação e testes

- Testes unitários: `npm test` (Node `node:test`) em `tests/`, importando `functions/_lib/*.js` sem depender da Cloudflare.
- Casos obrigatórios: campos vazios, só espaços, limites de tamanho, tipos errados, token adulterado/expirado, escape de `LIKE`.
- Revisão de segurança: SQL parametrizado, `textContent`, checagem de dono no servidor, Origin em escritas, `is_public` respeitado em `/api/quotes?scope=public` e `/api/quotes/random`.
- Validação manual em produção: ver `docs/CHECKLIST-QA.md`.
