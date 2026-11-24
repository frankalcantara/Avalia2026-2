---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2B-A8E8-1049-96B9-DA17/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2B-A8E8-1049-96B9-DA17` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

## Como o checklist foi executado no Acervo (2026-11-08)
1. **Isolamento:** `git status --porcelain -uall` na raiz mostra apenas `?? P26-2B-A8E8-1049-96B9-DA17/...`; `git diff` vazio (nenhum arquivo rastreado alterado). `.dev.vars` e `.wrangler/` ficam ignorados pelo `.gitignore` da própria pasta.
2. **Anti-manipulação:**
   - Em produção, sem sessão e com cookie forjado, `POST`/`PUT`/`DELETE` em `/api/*` retornam 401; `PATCH` retorna 405; rota inexistente retorna 404 JSON.
   - Em servidor isolado (handlers reais sobre D1 simulado), 25 de 25 casos retornaram o código esperado: 400 (vazio, JSON inválido, array, tipos errados, texto acima de 2000, página negativa, visibilidade inválida), 401, 403 (outro usuário ou `Origin` alheia), 404, 405, 413 (corpo acima de 32 KB), 415.
   - O `409` não se aplica: o esquema não tem conflito de negócio (cada `POST` cria um registro novo).
3. **Entrega:** `node validar-local.mjs P26-2B-A8E8-1049-96B9-DA17` retorna 9 de 9 `[OK]`; `node --test tests/*.test.mjs` retornava 14 de 14 em 2026-11-08; no estado atual (2026-11-19) retorna 42 de 42.

Além do checklist, também foram testados: XSS (payloads gravados e exibidos como texto), cabeçalhos de segurança, responsividade (320/390/1440 px), fluxo logado completo em produção (criar, editar, excluir, busca, sorteio) e varredura de segredos nos arquivos versionáveis.
