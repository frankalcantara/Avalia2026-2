# Documentação de Engenharia de Agentes e Harness (P26-3A-5053-EAAE-A024-A246)

Projeto #24: Plataforma de Empréstimo e Troca de Livros Físicos.
Este documento registra o que cada agente realmente fez.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Agente do VS Code**, modelo: GitHub Copilot Workspace. Executou o login Discord, a sessão assinada e o schema inicial.
- **ChatGPT (chat web)**, modelo: GPT-6. Executou as regras de empréstimos, mensagens e trocas, as migrations seguintes e a interface.
- **Gemini (chat web)**, modelo: auto. Executou o Agente 3.
- **Claude (chat)**: apoio de planejamento, revisão de roteiros e redação do prompt de login usado pelo agente do VS Code. Não é contado como agente.
- **Estratégia de Coordenação:** cada agente recebeu um skill de `skills/` e um escopo de pastas. A integração foi feita via Git (branch `main`) e Cloudflare Pages, com verificação por `validar-local.mjs`.

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), implementação do fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (`functions/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Estruturação das tabelas e índices no Cloudflare D1.
  - Proteção das rotas serverless contra manipulação no cliente.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** Construção da interface responsiva e acessível utilizando exclusivamente HTML5 semântico, CSS3 moderno (sem sombras em fontes) e JavaScript puro (Vanilla JS), consumindo as rotas serverless via `fetch`.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - Componentes visuais em `public/index.html`, `public/styles.css` e `public/app.js`.
  - Inclusão do cabeçalho de perfil do Discord (`user_id`, nome e avatar) e rodapé oficial com a Chave Única `P26-3A-5053-EAAE-A024-A246`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** Verificação independente de ponta a ponta: inspeção de contratos de API, tentativa de contorno das validações do servidor, auditoria da rubrica de 100 pontos e execução de testes funcionais.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - Bateria de verificação de integridade dos endpoints e conformidade com a rubrica (`validar-local.mjs` e casos de teste documentados abaixo).
  - Relatório de validação confirmando ausência de frameworks proibidos, presença da licença MIT e funcionamento no Cloudflare.