---
name: teste-validacao
description: Protocolo do agente de teste e validação — testes unitários do cálculo, testes de API contra o servidor local (wrangler pages dev) incluindo tentativas de burlar a validação, teste de interface no navegador e auditoria da rubrica com validar-local.mjs. Use depois de qualquer mudança e antes de declarar pronto.
---

# Skill: Teste e Validação

## Quando usar
Depois que backend e frontend declararem a tarefa concluída, e antes de qualquer deploy/PR.

## Protocolo
1. **Unitário:** `node --test tests/*.test.mjs` — todos verdes.
2. **API local:** subir `npx wrangler pages dev --port 8788` com D1 local migrado. Criar sessão de teste inserindo `discord_users` + `sessions` direto no D1 local (`wrangler d1 execute DB --local`) e mandar o cookie `sid`.
   - Sem cookie → 401 em `/api/me` e `/api/disciplinas`
   - Corpo inválido (nome vazio, peso ≤ 0, nota > notaMax, tipo fora da lista, 0 ou 31 avaliações) → 400
   - Usuário B tentando GET/PUT/DELETE disciplina do usuário A → 404 / lista vazia
   - `resumo` devolvido pelo servidor bate com `calcular()` para o mesmo dado
   - Cookie `sid` forjado/aleatório → 401
3. **Interface:** abrir no navegador (Playwright), conferir que digitar nota recalcula na hora, que o rodapé tem a chave e que não há erro no console. Testar 375 px.
4. **Produção:** repetir a parte não autenticada contra a URL `*.pages.dev` (401 sem sessão, redirecionamento OAuth com `state`).
5. **Rubrica:** `node validar-local.mjs P26-2C-6D8F-984C-AF8F-2CA8` na raiz do repositório — 9/9.

## Saída esperada
Relatório em `docs/RELATORIO-TESTES.md`: o que rodou, comando, resultado (passou/falhou) e evidência. Falha encontrada vira item com arquivo:linha para o agente responsável corrigir.
