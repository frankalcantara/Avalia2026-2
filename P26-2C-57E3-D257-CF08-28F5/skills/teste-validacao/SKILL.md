---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2C-57E3-D257-CF08-28F5/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2C-57E3-D257-CF08-28F5` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

## Checklist de Auditoria do Projeto #37
- Confirmar ausência total de frameworks ou CDNs no frontend (`public/`).
- Verificar se as transações gravadas no D1 registram ID do item, quantidade movimentada, `user_id` do Discord e `timestamp`.
- Validar se a chave `P26-2C-57E3-D257-CF08-28F5` consta tanto no `README.md` quanto no rodapé do `index.html`.
- Conferir se o arquivo `LICENSE` é MIT e se o `AGENTS.md` documenta o uso destes três agentes no harness do VS Code.