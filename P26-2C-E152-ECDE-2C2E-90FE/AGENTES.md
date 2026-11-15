# Agentes, harness e skills do SoundRoom

Este documento descreve os três agentes personalizados versionados no projeto, o ambiente de execução previsto e os skills reutilizáveis associados. As definições dos agentes ficam em `.github/agents/`; as instruções gerais ficam em `.github/copilot-instructions.md`; os skills ficam em `.github/skills/`.

## Agentes personalizados

| Agente | Arquivo | Responsabilidade | Skills relacionados | Evidência produzida esperada |
|---|---|---|---|---|
| Arquiteto e desenvolvedor | `.github/agents/arquiteto-desenvolvedor.agent.md` | Implementar interface HTML/CSS/JavaScript Vanilla e Cloudflare Pages Functions, preservando contratos e documentação. | `frontend-vanilla`, `pages-functions` | Arquivos alterados, decisões técnicas e testes pertinentes. |
| Segurança e banco | `.github/agents/seguranca-banco.agent.md` | Revisar OAuth, sessões, autorização, validação no servidor, SQL parametrizado, migrations e proteção de segredos. | `pages-functions`, `d1-migrations` | Revisão de segurança, riscos encontrados e parecer sobre migrations. |
| QA e validação | `.github/agents/qa-validacao.agent.md` | Transformar requisitos em casos de teste, executar testes automatizados e checklist de Preview/produção. | `qa-cloudflare`, `d1-migrations`, `pages-functions`, `frontend-vanilla` | Comandos executados, resultados, falhas e evidências reproduzíveis. |

## Harness

Os arquivos `.agent.md` seguem o formato de agentes personalizados do GitHub Copilot. O harness previsto é o GitHub Copilot Chat em modo Agent, em editor compatível, com as instruções do repositório em `.github/copilot-instructions.md`. O ambiente técnico de execução e validação é Node.js + npm, `node:test`, Wrangler, Cloudflare Pages Functions e D1 local. O workflow `.github/workflows/ci.yml` automatiza verificações no GitHub Actions.

Os agentes são papéis especializados e separados: desenvolvimento, revisão de segurança/banco e QA. O agente QA deve avaliar o resultado sem mascarar falhas; o agente de segurança revisa alterações sensíveis; o agente desenvolvedor implementa o escopo aprovado. A decisão final e qualquer publicação continuam sob responsabilidade humana.

## Skills versionados

- `frontend-vanilla`: HTML semântico, acessibilidade, CSS responsivo, JavaScript Vanilla e renderização segura de dados.
- `pages-functions`: rotas Pages, bindings, validação no servidor, respostas JSON e SQL parametrizado no backend.
- `d1-migrations`: esquema SQLite/D1, migrations aditivas, integridade referencial e execução exclusivamente local durante testes.
- `qa-cloudflare`: testes de API, Pages e D1 local, smoke tests e checklist de publicação controlada.

## Registro de execução dos agentes

Para comprovar o uso efetivo dos três agentes na realização acadêmica, registre abaixo cada execução real, com data, tarefa e resultado. Não preencha com execuções hipotéticas.

| Data | Agente | Harness/sessão | Tarefa solicitada | Resultado/evidência (PR, commit ou relatório) |
|---|---|---|---|---|
| 2026-11-15 | Arquiteto e desenvolvedor | GitHub Copilot Chat — agente personalizado `arquiteto-desenvolvedor` selecionado | Revisão estática da arquitetura e organização do projeto; somente leitura, sem testes, alterações ou acesso remoto. | Separação entre frontend, Pages Functions e lógica compartilhada considerada adequada; nenhum problema crítico confirmado. Riscos condicionais: configuração de produção, escalabilidade do ranking e ausência de testes de navegador. Relatório desta sessão; sem PR/commit. |
| 2026-11-15 | Segurança e banco | GitHub Copilot Chat — agente personalizado `seguranca-banco` selecionado | Auditoria de OAuth, sessões, autorização, validação, SQL, XSS, origem e integridade D1; somente leitura, sem alterações, testes ou acesso remoto. | Nenhuma vulnerabilidade explorável confirmada; riscos condicionais de produção relacionados às variáveis de ambiente e à confirmação dos IDs D1. Relatório desta sessão; sem PR/commit. |
| 2026-11-15 | QA e validação | GitHub Copilot Chat — agente personalizado `qa-validacao` selecionado | Validação final dos testes, sintaxe, migrations, integridade D1 local, Pages local e documentação; somente leitura, sem alterações ou deploy. | 37 testes aprovados (34 unitários, 2 de banco e 1 de integração); 32 arquivos JS/MJS verificados; seis migrations aplicadas; integridade local aprovada; GET `/api/health` 200 e POST 405. Limitações: sem teste de navegador completo, OAuth/Spotify real, GitHub Actions ou acesso remoto. Relatório desta sessão; sem PR/commit. |

A presença dos arquivos de configuração comprova que os agentes e skills estão definidos e versionados, mas não substitui o registro de suas execuções reais exigido pela rubrica.
