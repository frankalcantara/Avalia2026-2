---
name: testes-referencias
description: Planeja e executa testes do Projeto 23 e registra resultados observados em ABNT, IEEE, formulários, login Discord OAuth2, Cloudflare D1, segurança das APIs e ordenação alfabética.
---

# Testes do gerador de referências

- Compare as saídas ABNT e IEEE com exemplos aprovados para os tipos de fonte suportados. Verifique autoria, pontuação, ordem dos elementos e tratamento de campos opcionais. Para ordenação alfabética, use o critério definido pelo projeto e inclua nomes com acentos e chaves de ordenação iguais. Registre lacunas no critério como pendências de especificação.
- Exercite os formulários com valores válidos, campos obrigatórios vazios e valores inválidos. Verifique as mensagens exibidas e confirme que a validação no servidor também aplica o contrato documentado.
- Verifique o login Discord OAuth2 com uma conta de teste autorizada. Cubra login concluído, cancelamento e encerramento de sessão quando disponíveis. Use dados de teste e omita segredos e tokens das evidências.
- Verifique a persistência no Cloudflare D1 com dados isolados. Após criar, editar ou excluir um registro pelos fluxos disponíveis, releia os dados em uma nova requisição para confirmar o estado persistido.
- Valide os controles de segurança previstos no contrato das APIs, incluindo autenticação, permissões de contas de teste com papéis distintos e ausência de informações sensíveis nas respostas de erro.
- Para cada caso, registre a versão ou revisão testada, o ambiente, os passos ou comando, o resultado esperado, o resultado observado e o status. Use os status aprovado, falhou, bloqueado ou não executado. Para falhas, inclua o impacto e evidências que permitam reproduzir o bug em um ambiente de teste. Para bloqueios, identifique o pré-requisito ausente.
