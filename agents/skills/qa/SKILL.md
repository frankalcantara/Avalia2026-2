# Skill: QA e validação

- Leia a rubrica e converta cada requisito em um teste observável.
- Execute `npm test` após alterações.
- Verifique existência de endpoints, tabelas, chave de auditoria e licença.
- Revise autorização no servidor: edição e exclusão devem filtrar simultaneamente por ID do post e ID do usuário autenticado.
- Teste entradas vazias, limites de tamanho, sessão ausente e IDs inexistentes.
- Após deploy, valide OAuth2, D1, comentários cronológicos, curtidas e responsividade em navegador.
- Registre claramente o que foi testado automaticamente e o que depende de credenciais/infraestrutura real.
