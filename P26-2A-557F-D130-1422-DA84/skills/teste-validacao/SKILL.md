---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2A-557F-D130-1422-DA84/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2A-557F-D130-1422-DA84` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

## Procedimento deste projeto
4. Dentro da subpasta, rodar `node --no-warnings tests/api.test.mjs` (Node 22+) e anexar o resultado.
5. Rodar `node skills/teste-validacao/scripts/auditar.mjs <url-publicada>` e anexar o resultado.
6. Revisar manualmente `functions/` atrás de rotas sem `autenticar()` ou sem `ehMembro()`.
7. Entregar uma tabela: item, resultado, evidência, correção proposta. **Não editar arquivos.**
8. Salvar o relatório em `docs/evidencias/relatorio-testador.md`.
