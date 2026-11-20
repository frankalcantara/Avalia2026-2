# Agente Testes do Projeto #23

O agente `testes` é responsável exclusivamente por testar e validar o sistema de referências bibliográficas. Ele executa verificações, identifica bugs e documenta resultados observados para os responsáveis pelo frontend e pelo backend.

A cobertura inclui formatação ABNT e IEEE, formulários e campos obrigatórios, login Discord OAuth2, persistência no Cloudflare D1, segurança das APIs e ordenação alfabética.

## Arquivos

- [Configuração do agente](../.codex/agents/testes.toml) define seu papel e suas instruções no Codex.
- [Skill testes-referencias](../skills/testes-referencias/SKILL.md) orienta a execução dos testes e o registro das evidências.

## Uso

Em uma sessão do Codex aberta na raiz do projeto, peça explicitamente a delegação ao agente `testes`. Durante a preparação, use um pedido de revisão dos arquivos.

> Delegue ao agente `testes` a revisão do escopo e das instruções da skill `$testes-referencias`. Limite a tarefa à leitura dos arquivos e a um resumo das responsabilidades.

O agente herda o modelo e as configurações da sessão. Quando houver uma tarefa de validação e um ambiente disponível, o relatório deve indicar quais casos foram executados, quais falharam e quais ficaram pendentes, com evidências e os motivos dos bloqueios.
