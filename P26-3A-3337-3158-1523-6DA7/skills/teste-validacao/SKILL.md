---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-3A-3337-3158-1523-6DA7/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-3A-3337-3158-1523-6DA7` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

## Casos de Ataque/Borda a Tentar (Projeto #20)
4. **Sessão forjada:** enviar cookie `discord_session` com JSON/base64 sem assinatura, com assinatura adulterada, expirado e assinado com outro segredo → sempre `401`.
5. **Teto por categoria:** 60h exatas aceitas; qualquer excedente `409`; `61h` numa atividade só `409`; soma fracionária no limite sem falso bloqueio; requisições concorrentes não ultrapassam 60h.
6. **Payloads inválidos:** categoria inexistente, horas `0`/negativas/`NaN`/texto/booleano/array, URL `javascript:`/`ftp:`, JSON malformado → `400` e nada gravado.
7. **Isolamento entre usuários:** estudante B não lista nem remove atividades do estudante A (`404`); `user_id` enviado no corpo é ignorado.
8. **OAuth2:** `callback` sem `state` ou com `state` divergente não chama o Discord nem cria sessão; sem credenciais não existe login alternativo.
9. **Rodar `node --test`** e registrar o resultado real (sem afirmar aprovação que não foi executada).
