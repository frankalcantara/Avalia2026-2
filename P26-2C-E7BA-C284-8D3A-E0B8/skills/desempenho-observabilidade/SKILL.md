---
name: desempenho-observabilidade
description: Medição e revisão de desempenho e comportamento em execução do Clube de Leitura sem alterar regras de negócio.
---

# Skill: Desempenho e Observabilidade

## Regras Obrigatórias
1. **Medir antes de otimizar:** registrar ambiente, método e resultados observados; não inventar números nem afirmar melhorias sem comparar medições.
2. **Escopo de desempenho:** avaliar carregamento da página, tamanho e quantidade de recursos, requisições externas de avatares e latência percebida das chamadas da aplicação.
3. **Preservar arquitetura e comportamento:** manter HTML, CSS e JavaScript puros; não adicionar frameworks nem alterar regras de autenticação, progresso ou anti-spoiler.
4. **Cache seguro:** não recomendar cache compartilhado para respostas personalizadas por usuário, sessão ou progresso de leitura.
5. **Segredos e produção:** não solicitar, ler ou registrar Secrets; não alterar configurações Cloudflare nem iniciar deploy sem autorização explícita.
6. **Relatório verificável:** separar medições realizadas, limitações do ambiente e recomendações ainda não testadas.
