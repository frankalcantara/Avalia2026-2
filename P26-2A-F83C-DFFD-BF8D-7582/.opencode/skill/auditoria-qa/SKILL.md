---
name: auditoria-qa
description: Checklist operacional de testes, segurança, contratos e conformidade da rubrica do Projeto #14.
---

# Auditoria e QA — regras operacionais

## Gate obrigatório

```bash
node --test tests/api.test.mjs        # 6/6
node validar-local.mjs P26-2A-F83C-DFFD-BF8D-7582   # 9/9
```

## Verificações críticas

1. Rotas protegidas: `401` sem cookie, com cookie adulterado e expirado.
2. `POST /api/logs`: ignora `criado_em` do cliente e grava UTC do servidor.
3. `GET /api/logs`: somente `user_id` da sessão; `fim` inclusivo (`T23:59:59.999Z`).
4. Payload: `400` para vazio, >2000 caracteres e impedimento inválido.
5. Aliases `/api/auth/discord*` preservam query e redirecionam corretamente.
6. Sem frameworks, sem segredos e sem alterações fora da pasta da chave.
7. Chave `P26-2A-F83C-DFFD-BF8D-7582` no README e no `<footer>`.
8. Deploy online: home 200, CSS 200, `/api/auth/me` e `/api/logs` 401 sem sessão.
9. QA visual: claro/escuro, 360/768/1280, foco, reduced motion e estados.

## Evidência mínima

```text
tests: 6/6 | validator: 9/9 | deploy: 200 | APIs sem sessão: 401
```

- [ ] Relatório com status por critério e evidência.
- [ ] Guia completo: `skills/auditoria-qa/SKILL.md`.

