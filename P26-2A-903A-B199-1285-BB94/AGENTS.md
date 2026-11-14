# Documentação de Engenharia de Agentes e Harness (P26-2A-903A-B199-1285-BB94)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Visual Studio Code com GitHub Copilot Chat / Agent Mode integrado ao terminal PowerShell e CLI `wrangler`.
- **Modelo(s) Base:** Gemini 2.5 Pro / Claude Sonnet (via Copilot Fusion) e Gemini CLI para orquestração de arquivos e validação de contratos.
- **Estratégia de Coordenação:** Os agentes operaram de forma modular sobre a subpasta `P26-2A-903A-B199-1285-BB94/`, compartilhando especificações de banco de dados D1, contratos JSON das Cloudflare Pages Functions e verificação automatizada via `validar-local.mjs`.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), implementação do fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (`functions/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Estruturação das tabelas `usuarios`, `eventos` e `inscricoes` com chaves estrangeiras, `CHECK` constraints e índices no Cloudflare D1 (`0001_init.sql`).
  - Implementação das rotas `functions/api/auth/discord.js`, `functions/api/auth/discord/callback.js` e `functions/api/auth/me.js` com cookies `HttpOnly` e queries parametrizadas (`.bind()`).
  - Lógica de capacidade máxima e promoção automática (FIFO) da fila de espera em `functions/api/eventos/index.js` e `functions/api/eventos/rsvp.js`.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** Construção da interface responsiva e acessível utilizando exclusivamente HTML5 semântico, CSS3 moderno (sem sombras em fontes) e JavaScript puro (Vanilla JS), consumindo as rotas serverless via `fetch`.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - Componentes visuais desacoplados em `public/index.html`, `public/styles.css` e `public/app.js`, com zero dependências de frameworks externos.
  - Cabeçalho dinâmico exibindo avatar, nome e ID do Discord autenticado, além do rodapé oficial contendo a Chave Única `P26-2A-903A-B199-1285-BB94`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** Verificação independente de ponta a ponta: inspeção de contratos de API, tentativa de contorno das validações do servidor, auditoria da rubrica de 100 pontos e execução de testes funcionais.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - Bateria de verificação de integridade dos endpoints e conformidade com a rubrica via `node validar-local.mjs P26-2A-903A-B199-1285-BB94`.
  - Auditoria confirmando rejeição `401 Unauthorized` em tentativas de criação de evento ou RSVP sem sessão autenticada, isolamento total na subpasta `P26-2A-903A-B199-1285-BB94/`, ausência de `text-shadow`/`drop-shadow` e presença da licença MIT.

---

## 3. Evidências de Testes e Auditoria (Agente 3)

| Caso de Teste | Endpoint / Alvo | Comportamento Esperado | Resultado |
| :--- | :--- | :--- | :--- |
| **CT-01: Autenticação OAuth2** | `GET /api/auth/discord` e `callback` | Redireciona ao Discord, persiste usuário no D1 e grava cookie `HttpOnly`. | Aprovado (`302` -> `200`) |
| **CT-02: Anti-Manipulação (Sem Sessão)** | `POST /api/eventos` e `POST /api/eventos/rsvp` | Rejeita requisições não autenticadas com HTTP `401`. | Aprovado (`401`) |
| **CT-03: Lotação e Fila de Espera** | `POST /api/eventos/rsvp` (`inscrever`) | Confirma até `capacidade_maxima` e coloca excedentes em `espera`. | Aprovado |
| **CT-04: Promoção FIFO** | `POST /api/eventos/rsvp` (`cancelar`) | Ao cancelar confirmado, promove automaticamente o mais antigo em `espera`. | Aprovado |
| **CT-05: Conformidade UI & Rubrica** | `public/*` e `validar-local.mjs` | Zero frameworks externos, sem `text-shadow`, chave única no `<footer>`. | Aprovado |