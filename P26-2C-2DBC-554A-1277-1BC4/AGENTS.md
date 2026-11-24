# Documentação de Engenharia de Agentes e Harness (P26-2C-2DBC-554A-1277-1BC4)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Ambiente de desenvolvimento interativo com assistente de engenharia de software + Visual Studio Code (PowerShell / terminal integrado).
- **Modelo(s) Base:** Gemini (modelo base de colaboração e engenharia de software).
- **Estratégia de Coordenação:** Os agentes operaram de forma modular sobre a subpasta `P26-2C-2DBC-554A-1277-1BC4/`, separando responsabilidades entre persistência/validação serverless na borda (`functions/` e `migrations/`), interface em HTML5/CSS3/JS puro (`public/`) e auditoria/validação (`skills/teste-validacao/SKILL.md`).

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), integração com o fluxo Discord OAuth2 (`functions/api/auth/discord.js` e `callback.js`) e validação das regras de negócio, turnos, vitória e ranking nas Cloudflare Pages Functions (`functions/api/matches.js` e `functions/api/matches/[id]/move.js`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Tabelas `discord_users`, `matches`, `match_history` e `project_records` com queries parametrizadas (`.bind(...)`).
  - Validação no servidor de turno, índice de jogada (`0` a `8`), casas ocupadas, partidas encerradas e cálculo de ranking/histórico.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** Construção da interface responsiva utilizando exclusivamente HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks de UI, sem sombras em textos (`text-shadow: none` / `filter: none`), exibindo perfil Discord (`user_id`, nome e avatar) e a Chave Única `P26-2C-2DBC-554A-1277-1BC4` no rodapé.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - Tabuleiro 3x3 interativo com algoritmo **Minimax**, modo assíncrono com colega do Discord, retomada de partidas em andamento, histórico e ranking em `public/index.html`, `public/styles.css` e `public/app.js`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** Verificação independente de contratos HTTP, tentativas de manipulação no cliente, checagem da estrutura na subpasta `P26-2C-2DBC-554A-1277-1BC4/`, conformidade com a rubrica de 100 pontos e execução da validação local/Cloudflare.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - Conferência de rotas de erro (`400`, `401`, `403`, `404`, `409`), verificação de ausência de frameworks de UI e auditoria da chave `P26-2C-2DBC-554A-1277-1BC4` e licença MIT.