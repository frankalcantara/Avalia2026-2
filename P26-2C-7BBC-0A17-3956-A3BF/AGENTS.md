# Documentação de Engenharia de Agentes e Harness (P26-2C-7BBC-0A17-3956-A3BF)

> **Requisito da Rubrica (25 pontos):** uso de no mínimo **3 agentes diferentes** (sendo **1 dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness principal:** Claude (Anthropic) em conversas na interface web **claude.ai**, com o desenvolvedor humano como orquestrador. Os agentes não rodaram de forma autônoma: cada um foi acionado em uma sessão de chat com um papel e uma skill definidos, e o código gerado foi aplicado manualmente no VS Code.
- **Ferramentas do desenvolvedor:** VS Code, PowerShell, Node.js (via Scoop), Wrangler (Cloudflare), Git/GitHub.
- **Modelo base:** Claude (Anthropic), conforme disponível no claude.ai na data do desenvolvimento (novembro de 2026).
- **Estratégia de coordenação:** os agentes operaram sobre a subpasta `P26-2C-7BBC-0A17-3956-A3BF/`, compartilhando o esquema do D1 (`migrations/`), os contratos JSON das Pages Functions e a verificação automatizada via `validar-local.mjs`.

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** modelagem do esquema no Cloudflare D1, fluxo de autenticação Discord OAuth2 e regras de negócio validadas no servidor (`functions/`).
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas realizadas:**
  - `migrations/0002_eventos.sql`: tabelas `events` e `rsvps` (status `confirmed`/`waitlist`, inscrição única por evento e usuário, índices).
  - `functions/_lib/session.js`: sessão em **cookie assinado com HMAC-SHA256** (`discord_session` + `discord_session_sig`), validada no servidor em todas as rotas protegidas.
  - `functions/api/auth/discord/callback.js` ajustado para gravar a sessão assinada.
  - `functions/api/events/index.js`, `functions/api/events/[id]/index.js` e `functions/api/events/[id]/rsvp.js`: criação de eventos com validação, lotação, fila de espera e promoção automática do primeiro da fila ao cancelar.
  - Decisão de lotação em **uma única instrução SQL** (`INSERT ... SELECT CASE`), e cancelamento com promoção em `DB.batch`.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** interface responsiva com HTML5, CSS3 e JavaScript puro (Vanilla JS), consumindo a API via `fetch`, sem frameworks.
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas realizadas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`: lista de eventos, formulário de criação, confirmação/cancelamento de presença, listas de confirmados e de fila.
  - Cabeçalho com `username` e avatar do Discord (via `/api/me`) e rodapé com a Chave Única `P26-2C-7BBC-0A17-3956-A3BF`.
  - Renderização com `createElement` e `textContent` (sem `innerHTML` com dados de usuário), evitando XSS.

### Agente 3: Agente de Teste, Auditoria e Validação (obrigatório)
- **Papel:** verificação de ponta a ponta do fluxo, conferência de segurança e auditoria da rubrica de 100 pontos.
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas realizadas:**
  - Auditoria do cookie de sessão, que na versão inicial do esqueleto não era assinado e permitia forjar o `user_id`; foi corrigido com a assinatura HMAC descrita acima.
  - Diagnóstico de falhas encontradas nos testes (erro `Cannot read properties of undefined (reading 'prepare')` causado por servidor local sem o binding `DB`; build do Cloudflare criado como Workers em vez de Pages).
  - Execução da bateria de testes abaixo e do validador `validar-local.mjs`.

---

## 3. Casos de Teste Executados

| # | Caso de teste | Resultado esperado |
|---|---|---|
| 1 | Login com Discord (local e em produção) | Nome e avatar aparecem no topo |
| 2 | Criar evento (capacidade 1) logado | Evento aparece com "Vagas: 0/1" |
| 3 | Confirmar presença | "Vagas: 1/1 · LOTADO" e status "Você está confirmado" |
| 4 | Entrar em evento lotado (aluno de teste inserido no D1 local) | Usuário entra na fila de espera |
| 5 | Cancelar inscrição de um confirmado | Primeiro da fila é promovido a confirmado |
| 6 | Chamar `POST /api/events` sem login | Resposta 401 |
| 7 | Cookie `discord_session` adulterado, sem assinatura válida | Sessão rejeitada (401) |
| 8 | Deploy em produção no Cloudflare Pages + D1 | Aplicação publicada e funcional via HTTPS |

---

## 4. Skills (pasta `skills/`)

- `skills/serverless-d1-discord/SKILL.md`: Cloudflare Functions, D1 parametrizado e sessão Discord.
- `skills/vanilla-dom-ui/SKILL.md`: interface em HTML5, CSS3 e Vanilla JS.
- `skills/teste-validacao/SKILL.md`: testes e validação.