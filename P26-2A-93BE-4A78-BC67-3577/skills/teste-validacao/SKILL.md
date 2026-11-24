---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2A-93BE-4A78-BC67-3577/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2A-93BE-4A78-BC67-3577` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.
4. **Teste de regras:** executar `node tests/regras.test.mjs` (deve terminar com 0 falhas).
5. **Teste de API no servidor local:** criar sessões de teste direto no D1 local, exercitar casos inválidos (fora do limite, sobreposição, tamanho forjado, tiro repetido, tiro fora de vez, outro usuário, sem login), conferir que a frota do computador nunca aparece nas respostas e **apagar todos os dados de teste** ao final.
6. **Segredos:** `git status --short` não pode listar `.dev.vars` nem `.wrangler/`; nenhum segredo em arquivos versionados.
7. **Regressão:** todo defeito encontrado vira correção + caso de teste e é registrado em `AGENTS.md`.
