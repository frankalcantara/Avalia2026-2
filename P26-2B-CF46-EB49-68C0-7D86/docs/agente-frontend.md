# Agente Frontend do Projeto #23

O agente `frontend` é responsável pela interface do gerador de referências bibliográficas. Seu escopo inclui formulários, interações no navegador, acessibilidade, responsividade e apresentação do resultado. A implementação usa HTML5, CSS3 e JavaScript puro, sem frameworks.

As regras de formatação bibliográfica, a API, a persistência e a infraestrutura ficam fora do escopo do agente. O frontend consome o contrato do gerador e registra qualquer dependência que ainda precise ser definida.

## Arquivos

- [Configuração do agente](../.codex/agents/frontend.toml) define seu papel e suas instruções no Codex.
- [Skill frontend-referencias](../skills/frontend-referencias/SKILL.md) orienta o trabalho com os campos bibliográficos, a validação e o resultado.

## Uso

Em uma sessão do Codex aberta na raiz do projeto, peça explicitamente a delegação ao agente `frontend`. Este pedido pode ser usado para conferir a configuração durante a fase de preparação.

> Delegue ao agente `frontend` a revisão do escopo e das instruções da skill `$frontend-referencias`. Limite a tarefa à leitura dos arquivos e a um resumo das responsabilidades.

O agente herda o modelo e as configurações da sessão. A implementação do site começa quando houver uma tarefa específica para essa etapa.
