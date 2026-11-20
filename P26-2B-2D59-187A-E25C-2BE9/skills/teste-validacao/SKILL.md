---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

## Checklist de Verificação Obrigatória
1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2B-2D59-187A-E25C-2BE9/`.
2. **Sessão e OAuth:** Verificar assinatura e expiração dos cookies, integridade do parâmetro `state` e rejeição de chamadas protegidas sem sessão válida.
3. **Integridade das movimentações:** Testar payloads inválidos (`400`), item inexistente (`404`), saldo insuficiente (`409`) e sucesso (`201`), confirmando que a identidade registrada vem da sessão e não do cliente.
4. **Login local:** Testar cadastro e login por e-mail, armazenamento apenas do hash, credenciais inválidas e prevenção de cadastro duplicado.
5. **Cadastro de itens:** Testar autorização, validação, criação de item numerado e persistência do agente responsável.
6. **Testes locais:** Executar `node --test P26-2B-2D59-187A-E25C-2BE9\tests\*.test.mjs` sem credenciais externas.
7. **Conformidade de entrega:** Executar `node validar-local.mjs P26-2B-2D59-187A-E25C-2BE9` na raiz do repositório; confirmar o deploy real separadamente, sem declarar a verificação online aprovada antes de publicar.
