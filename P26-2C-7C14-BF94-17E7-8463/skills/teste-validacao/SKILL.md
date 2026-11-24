---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2C-7C14-BF94-17E7-8463/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2C-7C14-BF94-17E7-8463` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

## Casos específicos do Kanban
- Rotas /api/cards sem sessão devem responder 401.
- Cookie discord_session adulterado deve responder 401.
- Coluna ou prioridade inválida deve responder 400.
- Cartão de outro usuário (ou id inexistente) deve responder 404 em PATCH, PUT e DELETE.
- user_id enviado no corpo, na URL ou na query nunca pode ser usado.
- Títulos com HTML (por exemplo <img src=x onerror=alert(1)>) devem aparecer como texto, sem executar.
- Nenhum framework ou biblioteca externa na interface.