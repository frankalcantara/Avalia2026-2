# Engenharia de Agentes, Harness e Skills — P26-2B-86B9-E260-A00B-F564

Documento de rastreabilidade do requisito de **Engenharia de Agentes (25 pontos)**: no mínimo **3 agentes diferentes**, sendo **1 agente dedicado a teste e validação**, com registro do *harness* utilizado e dos *skills* que cada agente operou.

---

## 1. Harness utilizado

- **Harness principal:** `opencode` (CLI agent harness — https://opencode.ai), operando no terminal do laboratório sobre a subpasta `P26-2B-86B9-E260-A00B-F564/`.
- **Modelo base:** `opencode/big-pickle`.
- **Estratégia de coordenação:** trabalho modular com contexto compartilhado. O Agente 1 definiu o schema D1 e os contratos JSON das Functions; o Agente 2 consumiu esses contratos via `fetch` no frontend vanilla; o Agente 3 auditou os dois artefatos de forma independente e executou a validação determinística (`validar-local.mjs`) e a revisão manual dos fluxos.
- **Artefatos de coordenação:** `migrations/0001_init.sql`, `functions/api/*`, `public/*`, `AGENTS.md`, `skills/*/SKILL.md` e o validador da raiz do repositório (`validar-local.mjs`).
- **Critério de pronto:** cada agente só encerrou sua etapa após o Agente 3 confirmar a aderência à rubrica e a ausência de erros de sintaxe/contrato.

### Fluxo de execução

1. **Agente 1** modelou o banco, implementou OAuth2 assinado, criação de enquetes e votação verificada.
2. **Agente 2** construiu a interface HTML5/CSS3/JS puro consumindo as rotas serverless.
3. **Agente 3** revisou segurança, testou contratos de API, executou o validador e reportou as pendências manuais de deploy.

---

## 2. Agentes criados e responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2

- **Papel:** modelagem relacional no Cloudflare D1, fluxo OAuth2 do Discord e implementação das regras de negócio nas Cloudflare Pages Functions.
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas:**
  - `migrations/0001_init.sql` com `discord_users`, `polls`, `poll_options`, `votes` e `UNIQUE (poll_id, user_id)`.
  - `functions/api/auth/discord.js`, `functions/api/auth/discord/callback.js` e `functions/api/auth/logout.js` com `state` anti-CSRF e cookie assinado em HMAC-SHA-256.
  - `functions/api/polls.js` e `functions/api/vote.js` validando prazo, opção pertencente à enquete e voto duplicado **no servidor**.
  - `functions/api/_lib.js` com sessão assinada, schema defensivo e consolidação de resultados.
- **Critérios de aceite:** nenhuma regra de negócio depende do cliente; `user_id`, nome e avatar vêm do `/users/@me` do Discord.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)

- **Papel:** construir a experiência responsiva com HTML5 semântico, CSS3 e JavaScript puro, sem frameworks de UI.
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`.
  - Cabeçalho com avatar, nome e `user_id` do Discord após o OAuth2.
  - Formulário de criação com título, descrição, prazo (`datetime-local`) e 2 a 10 opções dinâmicas.
  - Renderização de resultados em barras horizontais proporcionais, com destaque do voto do usuário.
  - Rodapé com a Chave Única `P26-2B-86B9-E260-A00B-F564`.
- **Critérios de aceite:** zero React/Vue/Angular/Svelte; toda manipulação de DOM via APIs nativas; layout responsivo; conteúdo dinâmico inserido com `textContent` (proteção contra XSS).

### Agente 3: Teste, Auditoria de Segurança e Validação (obrigatório)

- **Papel:** verificação independente de ponta a ponta, auditoria de segurança das Functions e conferência da rubrica de 100 pontos.
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas:**
  - Revisão dos contratos de API e dos códigos de status HTTP.
  - Testes manuais dos cenários: voto sem login, voto após o prazo, voto duplicado, opção de outra enquete e payload inválido.
  - Execução de `node validar-local.mjs P26-2B-86B9-E260-A00B-F564`.
  - Conferência de ausência de frameworks proibidos, presença da licença MIT e da Chave Única no README e no rodapé.
- **Critérios de aceite:** todos os itens determinísticos aprovados; itens dependentes de deploy/credenciais reportados explicitamente como pendências manuais.

---

## 3. Matriz de testes do Agente 3

| Cenário | Entrada | Resultado esperado | Cobertura |
| --- | --- | --- | --- |
| Criar enquete sem sessão | `POST /api/polls` sem cookie | `401 unauthorized` | `functions/api/polls.js` |
| Criar enquete com prazo passado | `closesAt` anterior a agora | `400 deadline_past` | `functions/api/polls.js` |
| Criar enquete com 1 opção | `options: ["A"]` | `400 options_minimum` | `functions/api/polls.js` |
| Criar enquete com opções repetidas | `options: ["A", "a"]` | `400 options_duplicated` | `functions/api/polls.js` |
| Votar sem sessão | `POST /api/vote` sem cookie | `401 unauthorized` | `functions/api/vote.js` |
| Votar após o prazo | enquete com `closes_at` no passado | `409 poll_closed` | `functions/api/vote.js` |
| Votar duas vezes | mesmo `user_id` e mesma enquete | `409 already_voted` | `functions/api/vote.js` |
| Votar em opção de outra enquete | `optionId` de outro `poll_id` | `404 option_not_found` | `functions/api/vote.js` |
| Sessão forjada | cookie alterado sem HMAC válido | Sessão descartada | `functions/api/_lib.js` |
| Resultado consolidado | voto válido | `poll.options[].percentage` e `totalVotes` | `functions/api/_lib.js` |

---

## 4. Skills utilizadas

| Skill | Caminho | Agente |
| --- | --- | --- |
| `serverless-d1-discord` | `skills/serverless-d1-discord/SKILL.md` | Agente 1 |
| `vanilla-dom-ui` | `skills/vanilla-dom-ui/SKILL.md` | Agente 2 |
| `teste-validacao` | `skills/teste-validacao/SKILL.md` | Agente 3 |

Os arquivos de skill contêm regras obrigatórias, checklists e anti-padrões que orientaram a implementação e a auditoria.

---

## 5. Relatório de validação

Execução local:

```powershell
node validar-local.mjs P26-2B-86B9-E260-A00B-F564
```

Resultado esperado após o deploy:

- [x] Arquivo `LICENSE` (MIT)
- [x] Chave Única no `README.md`
- [x] Chave Única no rodapé do HTML
- [x] `AGENTS.md` com no mínimo 3 agentes
- [x] Agente de Teste e Validação documentado
- [x] Arquivos de skills em `skills/`
- [x] Frontend HTML/CSS/JS puro sem frameworks proibidos
- [x] Cloudflare Functions + D1 + Discord OAuth2
- [ ] Deploy online na Cloudflare — **pendência manual**: publicar no Cloudflare Pages, configurar o binding `DB`, as variáveis do Discord e atualizar a URL no README.

### Pendências manuais (fora do alcance dos agentes)

1. Criar o banco D1 e preencher o `database_id` real em `wrangler.jsonc`.
2. Configurar `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` no Cloudflare Pages.
3. Publicar o repositório no GitHub e informar as URLs no AVA.
