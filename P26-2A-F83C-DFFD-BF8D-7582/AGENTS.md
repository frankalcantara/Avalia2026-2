# Documentação de Engenharia de Agentes — Projeto #14

**Projeto:** #14 — Diário de Bordo de Projetos
**Chave Única:** `P26-2A-F83C-DFFD-BF8D-7582`
**Harness:** OpenCode Desktop (agentes customizados em `.opencode/agent/*.md` + skills em `.opencode/skill/*/SKILL.md`)
**Modelo Base:** Nemotron 3 Ultra (`nvidia/nemotron-3-ultra-550b-a55b:free` via OpenRouter)
**Skills versionadas na entrega:** `skills/cloudflare-backend/SKILL.md`, `skills/vanilla-frontend/SKILL.md`, `skills/auditoria-qa/SKILL.md`, `skills/design-system/SKILL.md`

> **Requisito da Rubrica (25 pontos):** mínimo de **3 agentes diferentes**, sendo obrigatoriamente **1 agente dedicado a teste e validação**, com harness documentado e skills relacionadas.

---

## 1. Ambiente de Orquestração (Harness)

- **Harness principal:** OpenCode Desktop, operando com quatro agentes especializados declarados em `.opencode/agent/`.
- **Estratégia de coordenação:** os agentes trabalharam de forma modular sobre a subpasta `P26-2A-F83C-DFFD-BF8D-7582/`, compartilhando o contrato JSON da API, o schema D1 e a bateria de testes automatizados (`tests/api.test.mjs`).
- **Fluxo:** Backend define schema/rotas → Frontend consome o contrato → Validador audita segurança, integridade e rubrica, retroalimentando os dois primeiros.

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: Backend Specialist (`cloudflare-backend`)

- **Função:** modelar o schema relacional no Cloudflare D1, implementar as Cloudflare Pages Functions (`/api/auth/*` e `/api/logs`) e garantir integridade de dados com timestamp UTC gerado exclusivamente no servidor.
- **Harness:** *"Atuas como engenheiro backend serverless. Usa apenas Cloudflare Pages Functions com o binding `env.DB` e queries parametrizadas. Nunca aceites datas vindas do frontend: gera `new Date().toISOString()` no servidor. Autentica exclusivamente via Discord OAuth2 e isola os dados por `user_id`."*
- **Skill utilizada:** [`skills/cloudflare-backend/SKILL.md`](./skills/cloudflare-backend/SKILL.md)
- **Entregáveis:**
  - `migrations/0001_init.sql` (espelhado em `schema.sql`) — tabela `logs` (`id`, `user_id`, `username`, `avatar`, `conteudo`, `impedimento`, `criado_em`) + índice `idx_logs_user_criado`.
  - `lib/session.js` — sessão assinada com HMAC-SHA256 (Web Crypto) e expiração, cookie `HttpOnly`/`SameSite=Lax`/`Secure` em HTTPS.
  - `functions/api/auth/login.js` — inicia OAuth2 com `scope=identify` e parâmetro `state` anti-CSRF.
  - `functions/api/auth/discord.js` — alias oficial que encaminha para `/api/auth/login`.
  - `functions/api/auth/callback.js` — valida `state`, troca `code` por token, consulta `/users/@me` e cria a sessão assinada.
  - `functions/api/auth/discord/callback.js` — alias oficial que preserva `code`/`state` e encaminha para `/api/auth/callback`.
  - `functions/api/auth/me.js` — valida a sessão, retorna o perfil e implementa logout real (`?logout=1`).
  - `functions/api/logs.js` — `POST` valida payload e gera `criado_em` UTC no servidor; `GET` isola por `user_id` e filtra por `busca`, `impedimento`, `inicio` e `fim`.

### Agente 2: Frontend Specialist (`vanilla-frontend`)

- **Função:** construir a interface completa em HTML5 semântico, CSS3 moderno e JavaScript puro, com timeline vertical, formulário de registro, filtros e estados de autenticação.
- **Harness:** *"É proibido usar React, Tailwind, Bootstrap ou qualquer framework CSS/JS. Usa apenas HTML5, CSS3 (Custom Properties, Flexbox, animações com `prefers-reduced-motion`) e manipulação direta do DOM com `createElement`/`textContent` e `fetch`."*
- **Skill utilizada:** [`skills/vanilla-frontend/SKILL.md`](./skills/vanilla-frontend/SKILL.md)
- **Entregáveis:**
  - `public/index.html` — estrutura semântica, formulário acessível com contador de caracteres, filtros e `<footer>` com a Chave Única.
  - `public/style.css` — design system com tokens claro/escuro, componentes, timeline vertical alinhada, badges de impedimento e responsividade.
  - `public/script.js` — estado centralizado, módulo `api`, `checkAuth`/`renderAuthArea`/logout, `loadLogs` (com query params), `renderTimeline` e feedback inline (sem `alert`).

### Agente 3: Validation Auditor (`auditoria-qa`) — Obrigatório

- **Função:** auditoria independente de segurança, contratos de API, integridade do banco e conformidade com a rubrica de 100 pontos.
- **Harness:** *"Valida que rotas protegidas retornam 401 sem sessão e que cookies adulterados são rejeitados. Confirma que `POST /api/logs` ignora `criado_em` do cliente e gera UTC no servidor. Verifica isolamento por `user_id`, validação de `impedimento`, filtro de data final inclusivo, ausência de frameworks, licença MIT, chave no README e no `<footer>`."*
- **Skill utilizada:** [`skills/auditoria-qa/SKILL.md`](./skills/auditoria-qa/SKILL.md)
- **Entregáveis:**
  - `tests/api.test.mjs` — suíte com `node:test` cobrindo adulteração de sessão, 401 sem sessão, validação de payload, timestamp UTC server-side, isolamento por usuário, busca e intervalo de datas, logout e aliases oficiais do Discord.
  - Relatório de auditoria abaixo (seção 4).

### Agente 4: Design System Specialist (`design-system`)

- **Função:** manter o design system em CSS puro, garantindo consistência de tokens, dark mode, tipografia, componentes, foco visível, contraste, movimento e responsividade.
- **Harness:** *"Atuas como guardião do design system. Usa exclusivamente Custom Properties, CSS3 e HTML5 sem frameworks. Nenhuma cor, sombra ou raio fora dos tokens. Garantes foco visível, contraste AA, alvos de 44px e `prefers-reduced-motion`. Preservas o contrato de IDs/classes do `script.js` e a Chave Única no rodapé."*
- **Skill utilizada:** [`skills/design-system/SKILL.md`](./skills/design-system/SKILL.md)
- **Entregáveis:**
  - `public/style.css` — tokens claro/escuro, componentes (botões, formulários, painéis, badges, feedback), timeline com geometria exata, rodapé e breakpoints.
  - `public/index.html` — marca com SVG inline, headings de seção, badges de contexto e rodapé com a Chave Única.
  - Revisão visual documentada (claro/escuro, 360/768/1280px, teclado e movimento reduzido).

---

## 3. Skills Versionadas

| Skill | Caminho | Uso |
|-------|---------|-----|
| `cloudflare-backend` | `skills/cloudflare-backend/SKILL.md` | Regras de Functions, D1, OAuth2, sessão assinada e UTC no servidor |
| `vanilla-frontend` | `skills/vanilla-frontend/SKILL.md` | Regras de HTML/CSS/JS puro, timeline e integração com a API |
| `auditoria-qa` | `skills/auditoria-qa/SKILL.md` | Checklist de segurança, testes e conformidade com a rubrica |
| `design-system` | `skills/design-system/SKILL.md` | Tokens, dark mode, componentes, acessibilidade e responsividade |

*As mesmas skills também estão disponíveis em `.opencode/skill/*/SKILL.md` para uso direto pelo harness durante o desenvolvimento.*

---

## 4. Evidências de Validação (Agente 3)

Comando executado:

```bash
node --test tests/api.test.mjs
```

Resultado:

```text
✔ signSession e verifySession rejeitam token adulterado
✔ GET /api/logs e POST /api/logs retornam 401 sem sessão válida
✔ POST /api/logs valida payload e força timestamp UTC do servidor
✔ GET /api/logs isola registros por user_id e filtra corretamente busca e intervalo de datas
✔ GET /api/auth/me valida sessão e limpa cookie no logout
✔ aliases oficiais /api/auth/discord encaminham para o fluxo canônico preservando a query

tests 6 | pass 6 | fail 0
```

| Critério Auditado | Status |
|-------------------|--------|
| Cookie de sessão assinado (HMAC-SHA256) e expiração | ✅ |
| `state` anti-CSRF no fluxo OAuth2 | ✅ |
| `POST /api/logs` exige sessão e valida `conteudo`/`impedimento` | ✅ |
| `criado_em` gerado apenas no servidor (UTC) | ✅ |
| `GET /api/logs` isolado por `user_id` + busca e datas inclusivas | ✅ |
| Frontend sem frameworks (HTML/CSS/JS puro) | ✅ |
| Design system com tokens, dark mode, foco visível e responsividade | ✅ |
| Acessibilidade, boas práticas e SEO (Lighthouse) | ✅ 100 / 100 / 100 |
| Chave Única no `README.md` e no `<footer>` | ✅ |
| Licença MIT e 4 skills na pasta `skills/` | ✅ |

---

## 5. Observações de Entrega

- A pasta do projeto mantém o nome exato da Chave Única emitida: `P26-2A-F83C-DFFD-BF8D-7582/`.
- O arquivo `AGENTES.md` é mantido apenas como compatibilidade; a documentação oficial passou a ser este `AGENTS.md`, conforme a rubrica.