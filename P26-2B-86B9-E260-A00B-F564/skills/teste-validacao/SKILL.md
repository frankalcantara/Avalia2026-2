---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste, Auditoria e Validação

## Checklist de verificação obrigatória

1. **Isolamento da subpasta:** confirmar que todos os arquivos do projeto residem em `P26-2B-86B9-E260-A00B-F564/`.
2. **Autenticação real:** confirmar que existe fluxo OAuth2 com `DISCORD_CLIENT_ID`, troca de `code`, importação de `user_id`/`username`/`avatar` e persistência em `discord_users`.
3. **Sessão não forjável:** confirmar assinatura HMAC, expiração e cookie `HttpOnly`; tentar alterar o payload e verificar que a sessão é rejeitada.
4. **Teste anti-manipulação:** `POST` sem sessão deve retornar `401`; payload inválido deve retornar `400`; enquete encerrada e voto duplicado devem retornar `409`; recurso inexistente deve retornar `404`.
5. **Integridade no D1:** confirmar tabelas `discord_users`, `polls`, `poll_options`, `votes`, chave estrangeira lógica e `UNIQUE (poll_id, user_id)`.
6. **Consolidação de resultados:** confirmar que a API retorna total de votos, votos por opção e percentual, e que o cliente renderiza barras proporcionais.
7. **Frontend vanilla:** confirmar ausência de frameworks proibidos em `package.json` e em `public/*.html`.
8. **Rastreabilidade:** confirmar a Chave Única `P26-2B-86B9-E260-A00B-F564` no `README.md` e no `<footer>`.
9. **Licença:** confirmar `LICENSE` com texto MIT.
10. **Deploy:** executar `node validar-local.mjs P26-2B-86B9-E260-A00B-F564` e registrar os itens que dependem de ação manual (URL pública, D1 remoto e credenciais).

## Evidências a registrar

- Saída do validador local.
- Lista de rotas testadas e códigos HTTP observados.
- Lista de pendências manuais separada das falhas de implementação.
- Confirmação de que nenhum segredo (`DISCORD_CLIENT_SECRET`, `SESSION_SECRET`) foi versionado.

## Critério de bloqueio

Falhas de segurança no servidor, aceitação de voto duplicado, ausência de validação de prazo ou presença de framework de UI **bloqueiam** a entrega até correção. Itens de deploy/credenciais são reportados como pendência manual, não como falha de código.
