---
name: backend-referencias
description: Planeja, implementa e revisa o backend do Projeto 23 com Cloudflare Pages Functions, Cloudflare D1 e Discord OAuth2, incluindo segurança, validação no servidor, usuários, projetos e referências bibliográficas.
---

# Backend do gerador de referências

- Defina ou preserve o contrato dos endpoints com o frontend, incluindo entradas, respostas e erros. Valide no servidor os campos exigidos pelo tipo de fonte, seus formatos e limites, mesmo quando a interface já os validar.
- Valide o parâmetro `state` no retorno do Discord OAuth2, vinculando-o à sessão que iniciou o fluxo e consumindo-o uma única vez. Troque o código no servidor, vincule o usuário local ao identificador do Discord e mantenha tokens e segredos fora das respostas e dos logs.
- Proteja a sessão com cookies `HttpOnly`, `Secure` e uma política `SameSite` compatível com o retorno OAuth2. Verifique a sessão e a autorização no servidor para cada operação protegida. Confira o acesso ao projeto ao operar sobre suas referências, inclusive ao consultar um identificador recebido do cliente.
- Use o binding do D1 e consultas parametrizadas. Ao alterar o esquema, preserve os dados existentes e use operações atômicas quando a consistência depender de várias escritas.
- Verifique os fluxos afetados, incluindo entrada inválida, sessão ausente, retorno OAuth2 inválido e tentativa de acesso a projeto ou referência de outro usuário, conforme aplicável.
