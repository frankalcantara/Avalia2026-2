---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2A-86CE-58AE-853D-C5AB/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2A-86CE-58AE-853D-C5AB` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.
4. **Sessão e isolamento:** Sem cookie, `GET /api/cartoes` retorna `401`. O usuário B não vê cartões do usuário A e recebe `404` ao tentar alterar um deles.
5. **Validação de cartões:** Coluna, prioridade, título vazio, título com mais de 120 caracteres ou posição inválidos retornam `400`. Corpo que não é JSON também retorna `400`.
6. **Persistência:** Um `PATCH` válido atualiza o cartão e a alteração persiste quando consultada novamente.
7. **Página pública:** `GET /` responde `200` sem login, e o HTML contém a chave `P26-2A-86CE-58AE-853D-C5AB`.
