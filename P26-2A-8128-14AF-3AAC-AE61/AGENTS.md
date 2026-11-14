# Engenharia de agentes — EntreLivros

Chave: **P26-2A-8128-14AF-3AAC-AE61**. Projeto 24, Rennan Raposo, turma 2A.

## Harness e organização

O trabalho foi desenvolvido no **Codex desktop**, com terminal PowerShell/Node.js e três agentes distintos criados pela ferramenta de colaboração do harness. Eles compartilharam a mesma pasta, com responsabilidades separadas, e receberam o contrato `docs/CONTRATO-API.md`. O agente principal coordenou integração, revisão, correções e publicação. Família de modelo disponibilizada no ambiente: GPT-6; os agentes herdaram o modelo do principal, sem seleção manual de outra variante.

Os agentes abaixo foram efetivamente iniciados em 13/11/2026. Não representam apenas papéis hipotéticos. A execução dos subagentes foi interrompida por limite de uso do ambiente após a gravação das implementações e da suíte de testes. O agente principal continuou a revisão, ajustou a compatibilidade do ambiente de teste, executou os testes e registrou os resultados. Esta limitação não deve ser confundida com uma validação independente concluída integralmente pelos subagentes.

## Agente 1 — Backend, persistência e Discord

- **Identificador no harness:** `/root/backend_d1_discord`.
- **Escopo:** `functions/`, `lib/`, `migrations/` e `docs/BACKEND.md`.
- **Skill aplicada:** [serverless-d1-discord](skills/serverless-d1-discord/SKILL.md).
- **Trabalho efetivo:** modelo D1 relacional, OAuth2 Discord, sessão opaca com hash no banco, cookies HttpOnly, validação de origem, catálogo, painel, empréstimos, trocas e reserva exclusiva dos exemplares por triggers.
- **Integração:** informou ao agente de teste o esquema de usuários, sessões e contratos HTTP. O principal revisou e corrigiu a regra de datas para São Paulo.

## Agente 2 — Interface HTML, CSS e JavaScript puro

- **Identificador no harness:** `/root/frontend_vanilla`.
- **Escopo:** `public/` e `docs/DESIGN.md`.
- **Skills aplicadas:** [vanilla-dom-ui](skills/vanilla-dom-ui/SKILL.md) e [frontend-design](skills/frontend-design/SKILL.md).
- **Trabalho efetivo:** plano visual, catálogo com filtros, formulários de cadastro/edição, identificação Discord, painel de pedidos recebidos/enviados, aprovação com data, devolução e troca. Uso de DOM nativo e `textContent`, diálogos nativos e estilos responsivos.
- **Rastreabilidade:** chave literal no rodapé HTML e identidade visual EntreLivros. Sem acervo fictício em produção.

## Agente 3 — Teste e validação independente

- **Identificador no harness:** `/root/teste_validacao`.
- **Escopo:** `tests/` e `docs/VALIDACAO.md`.
- **Skill aplicada:** [teste-validacao](skills/teste-validacao/SKILL.md).
- **Trabalho efetivo:** estratégia e 25 cenários de API cobrindo autenticação, autorização, validação, persistência, empréstimo, troca, concorrência e OAuth simulado. Preparou um runtime Cloudflare local com banco isolado.
- **Continuação pelo principal:** correção da inicialização do Miniflare 5 com empacotamento ES Module, ajuste do teste DELETE ao contrato JSON e dois testes de calendário. O relatório informa a execução efetiva e as verificações ainda pendentes.

## Coordenação, decisões e evidências

- O inicializador oficial `node iniciar.mjs P26-2A-8128-14AF-3AAC-AE61` foi executado e validou a chave pela API oficial do professor.
- O scaffold de diagnóstico foi substituído pelo domínio de livros. Cookies contendo apenas um perfil serializado não foram usados como autenticação.
- As permissões e transições de estado são verificadas no servidor. Nenhum login de teste foi adicionado à aplicação publicada.
- D1 usa queries parametrizadas, chaves estrangeiras, restrições e triggers. A reserva dos dois livros de uma troca é atômica.
- [Contrato da API](docs/CONTRATO-API.md), [arquitetura](docs/BACKEND.md), [design](docs/DESIGN.md) e [relatório de testes](docs/VALIDACAO.md) registram os entregáveis.
- Skills adicionais usadas pela coordenação constam em `skills/`. Credenciais pessoais e configurações privadas do harness não integram a entrega.

## Regras para manutenção

1. Todas as alterações desta entrega ficam nesta subpasta, sem editar os scripts do professor.
2. Cliente em HTML5/CSS3/JavaScript puro, sem frameworks de interface.
3. Regras e autorização em Pages Functions; persistência relacional D1; identidade exclusiva Discord.
4. Não versionar `.dev.vars`, tokens, cookies ou credenciais. Não publicar fixtures como usuários reais.
5. Executar `npm test`, `npm run build:check` e o validador oficial após mudanças pertinentes. Relatar pendências; aprovação estrutural não é garantia de nota.
