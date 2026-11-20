---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-3A-8F79-F6CA-8535-422A/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-3A-8F79-F6CA-8535-422A` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

## Casos Obrigatórios do Projeto #15 (Shared To-Do)
4. **Sessão:** requisição sem cookie → 401; cookie com assinatura adulterada → 401.
5. **Isolamento:** usuário que não é membro não lê nem altera tarefas de outra lista (403/404).
6. **Entrar por código:** código inválido → 404; entrar duas vezes não duplica o membro.
7. **Regras de tarefa:** responsável que não é membro → 400; subtarefa com pai de outra lista → 400; título vazio ou com mais de 200 caracteres → 400.
8. **Fluxo feliz:** criar lista, entrar com segundo usuário, criar tarefa e subtarefa, atribuir, concluir e ler o estado atualizado pelos dois usuários.
9. **Frontend:** nenhum framework em `public/`; chave P26-3A-8F79-F6CA-8535-422A no `<footer>`.
