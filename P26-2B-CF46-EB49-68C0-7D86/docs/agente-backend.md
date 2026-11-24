# Agente Backend do Projeto #23

O agente `backend` é responsável pelo backend serverless do gerador de referências bibliográficas. Seu escopo inclui segurança, validação no servidor, autenticação e operações de usuários, projetos e referências. A implementação usa Cloudflare Pages Functions para endpoints, Cloudflare D1 para persistência e Discord OAuth2 para autenticação.

O agente mantém o contrato da API para integração com o agente `frontend`, que cuida da interface.

## Arquivos

- [Configuração do agente](../.codex/agents/backend.toml) define seu papel e suas instruções no Codex.
- [Skill backend-referencias](../skills/backend-referencias/SKILL.md) orienta o trabalho com endpoints, validação, autenticação, autorização e persistência.

## Uso

Em uma sessão do Codex aberta na raiz do projeto, peça explicitamente a delegação ao agente `backend`. Este pedido pode ser usado para conferir a configuração durante a fase de preparação.

> Delegue ao agente `backend` a revisão do escopo e das instruções da skill `$backend-referencias`. Limite a tarefa à leitura dos arquivos e a um resumo das responsabilidades.

O agente herda o modelo e as configurações da sessão. A implementação do backend começa quando houver uma tarefa específica para essa etapa.
