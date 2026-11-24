---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** todos os arquivos do projeto ficam dentro de `P26-2A-A113-CCFD-DC47-AC0A/`.
2. **Teste Anti-Manipulação:** `POST` em `/api/*` rejeita payload inválido (400), requisição sem sessão válida ou com cookie forjado/expirado (401), origem diferente (403), recurso de outro usuário (404) e estado incompatível (409).
3. **Sigilo do Embaralhamento:** a resposta de `/api/game/start` contém apenas tokens opacos, sem texto nem `pair_id`.
4. **Integridade no D1:** `moves`, `pairs_found`, `status` e `efficiency` conferem com a sequência de jogadas.
5. **Suíte automatizada:** executar `node tests/run-tests.mjs` (precisa passar 100%) e, na raiz do repositório, `node validar-local.mjs P26-2A-A113-CCFD-DC47-AC0A`.
6. **Teste manual em produção:** login, partida completa, ranking, logout e tela estreita (celular).
