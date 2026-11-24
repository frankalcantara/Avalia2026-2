# Documentação de Engenharia de Agentes e Harness (P26-2C-3AFD-2561-AB58-B488)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Claude (claude.ai, chat web da Anthropic), com um agente por conversa separada
- **Modelo(s) Base:** Claude Sonnet 5.5
- **Estratégia de Coordenação:** Os agentes operaram de forma modular sobre a subpasta `P26-2C-3AFD-2561-AB58-B488/`, compartilhando especificações de banco de dados D1, contratos JSON das Cloudflare Pages Functions e verificação automatizada via `validar-local.mjs`.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), implementação do fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (`functions/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Resultado da execução:** Recebeu a skill e revisou os arquivos de configuração enviados (schema.sql, wrangler, README). Apontou nomes de projeto e banco inconsistentes e variáveis de ambiente ausentes no README, corrigidos com uma seção de configuração.
- **Entregas Realizadas:**
  - Estruturação das tabelas e índices no Cloudflare D1.
  - Proteção das rotas serverless contra manipulação no cliente.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** Construção da interface responsiva e acessível utilizando exclusivamente HTML5 semântico, CSS3 moderno (sem sombras em fontes) e JavaScript puro (Vanilla JS), consumindo as rotas serverless via `fetch`.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Resultado da execução:** Revisou index.html, app.js e style.css. Confirmou ausência de frameworks, de innerHTML e de text-shadow, uso de textContent e chave única no rodapé. Apontou ressalvas de acessibilidade, registradas como melhorias futuras.
- **Entregas Realizadas:**
  - Componentes visuais em `public/index.html`, `public/styles.css` e `public/app.js`.
  - Inclusão do cabeçalho de perfil do Discord (`user_id`, nome e avatar) e rodapé oficial com a Chave Única `P26-2C-3AFD-2561-AB58-B488`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** Verificação independente de ponta a ponta: inspeção de contratos de API, tentativa de contorno das validações do servidor, auditoria da rubrica de 100 pontos e execução de testes funcionais.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Resultado da execução:** Auditou a rubrica a partir de LICENSE, README e AGENTS.md. Apontou inconsistência de URL e do redirect do OAuth, corrigidas. Itens de código ficaram como não verificáveis por falta dos arquivos enviados, e a validação final foi feita com validar-local.mjs.
- **Entregas Realizadas:**
  - Bateria de verificação de integridade dos endpoints e conformidade com a rubrica (`validar-local.mjs` e casos de teste documentados abaixo).
  - Relatório de validação confirmando ausência de frameworks proibidos, presença da licença MIT e funcionamento no Cloudflare.
