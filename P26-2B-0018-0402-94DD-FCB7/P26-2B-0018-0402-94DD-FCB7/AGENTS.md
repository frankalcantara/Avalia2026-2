# Documentação de Engenharia de Agentes e Harness (`P26-2B-0018-0402-94DD-FCB7`)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

---

## 1. Ambiente de Orquestração (*Harness* Utilizado)

- **Harness Principal:** **Google Antigravity** (ambiente agêntico com orquestração nativa de subagentes via `define_subagent` e `invoke_subagent`, isolamento de papéis e leitura obrigatória de arquivos `SKILL.md`).
- **Modelo Base:** **Gemini** (família Gemini configurada no Google Antigravity, herdada pelos subagentes especializados).
- **Estratégia de Coordenação:**
  1. Um agente coordenador definiu o contrato JSON de todas as rotas serverless (`/api/status`, `/api/auth/*`, `/api/rooms/*`, `/api/tracks/*`) e escreveu as 3 *skills* especializadas em `skills/*/SKILL.md`.
  2. Os **Agentes 1 e 2** foram definidos com escopos de arquivo disjuntos (`migrations/`, `src/server/`, `functions/` vs. `public/`) e executados **em paralelo**, consumindo cada um sua respectiva `SKILL.md`.
  3. Após a conclusão de ambos, o **Agente 3 (Teste, Segurança e Validação)** realizou auditoria independente de código-fonte, construiu a suíte automatizada com SQLite real (`tests/run-tests.mjs`), apontou divergências de contrato entre frontend e backend, e todos os ajustes foram aplicados e revalidados com `node tests/run-tests.mjs` e `node validar-local.mjs P26-2B-0018-0402-94DD-FCB7`.

---

## 2. Agentes Criados e Responsabilidades (3 Agentes Especializados)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2 (`arquiteto-serverless-d1`)
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), implementação dos helpers modulares de segurança (`src/server/`) e construção de todas as Cloudflare Pages Functions (`functions/api/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Esquema relacional em `migrations/0001_init.sql` com `discord_users`, `sessions`, `rooms`, `tracks`, `track_votes`, chaves estrangeiras, restrições `CHECK`/`UNIQUE` e 6 índices.
  - Fluxo completo **Discord OAuth2** (`/api/auth/discord`, `/api/auth/discord/callback`, `/api/auth/me`, `/api/auth/logout`) com proteção CSRF via `state` em cookie `HttpOnly` comparado em tempo constante (`constantTimeEqual`) e sessões opacas no D1 (`jukebox_session` `HttpOnly; SameSite=Lax; Path=/` + `Secure` em HTTPS).
  - Validação estrita na borda em `src/server/validators.js` para links HTTPS de **YouTube**, **Spotify** e **SoundCloud**, normalização antiduplicidade (`409 Conflict`) e geração segura de `embed_url`.
  - Endpoints serverless completos para salas, faixas, exclusão autorizada e votação democrática (`-1`, `0`, `1`) com cálculo e ordenação (`score DESC, upvotes DESC, created_at ASC, id ASC`) no D1 usando exclusivamente queries parametrizadas (`env.DB.prepare(...).bind(...)`).

### Agente 2: Especialista em Interface Web Vanilla (`especialista-ui-vanilla`)
- **Papel:** Construção da interface web responsiva e acessível em HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks de UI, sem sombras em textos e com manipulação direta e segura do DOM.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - Interface completa em `public/index.html`, `public/styles.css` e `public/app.js` sem frameworks externos, sem `text-shadow`/`drop-shadow` em texto e sem uso de `innerHTML` com dados dinâmicos (100% `document.createElement` + `textContent`).
  - Cabeçalho com indicador de conectividade Cloudflare D1 e autenticação Discord (`user_id`, nome de usuário, avatar e logout).
  - Sidebar de salas temáticas com busca em tempo real, sincronização de URL (`?sala=<slug>`) e criação via `<dialog>` nativo HTML5.
  - Palco de destaque **"★ #1 Mais Aprovada pelo Grupo"** no topo da sala com player embarcado sob demanda (`<iframe>` restrito a hosts HTTPS confiáveis de YouTube, Spotify e SoundCloud).
  - Fila colaborativa com filtro por gênero musical, controles de voto `▲ / saldo / ▼` e **reordenação dinâmica com animação FLIP** em Vanilla JS (`getBoundingClientRect` + `transform` + `requestAnimationFrame`).
  - Rodapé oficial `<footer id="projectFooter">` exibindo explicitamente a Chave Única `P26-2B-0018-0402-94DD-FCB7`, Turma `2B` e Licença MIT.

### Agente 3: Engenheiro de Testes, Auditoria de Segurança e Validação (`engenheiro-teste-validacao`) — Obrigatório
- **Papel:** Auditoria independente de segurança e contratos frontend↔backend, construção da suíte automatizada de testes com banco SQLite real em memória e verificação completa da rubrica de 100 pontos.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - Suíte automatizada zero-dependências em [`tests/run-tests.mjs`](./tests/run-tests.mjs) utilizando `node:test`, `node:assert/strict` e `node:sqlite` (`DatabaseSync(':memory:')`) com adaptador fiel da API do Cloudflare D1 aplicando a migração real `migrations/0001_init.sql`.
  - Auditoria estática e de segurança identificando 4 divergências menores de contrato entre frontend e backend, todas prontamente corrigidas antes da entrega:
    1. Alinhamento da chave de erro OAuth `fetch_user_failed` (e demais códigos de callback) em `public/app.js`.
    2. Alinhamento dos limites de caracteres do formulário (`roomNameInput`: 3–60 chars; `trackArtistInput`: máx. 80 chars) em `public/index.html` e `public/app.js` com `src/server/validators.js`.
    3. Restrição do detector prévio de URL no frontend (`detectProviderFromUrl`) para aceitar apenas `https://` e os mesmos hosts exatos do validador de borda.
    4. Validação conjunta de `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` já na entrada de `GET /api/auth/discord`.

---

## 3. Relatório de Validação e Testes Executados

### 3.1 Suíte Automatizada (`node tests/run-tests.mjs`)
- **Resultado:** **24 de 24 testes aprovados (5 suítes, 0 falhas)**
- **Cobertura Validada:**
  - **Status e Saúde (`GET /api/status`):** 3 testes — conectividade D1, chave oficial, `projectId: 30`, fallback sem `env.DB` e contagens reais.
  - **Discord OAuth2 Completo (`/api/auth/*`):** 6 testes — redirect com `state` CSRF `HttpOnly`, rejeição de `state` inválido, fluxo completo ponta a ponta até sessão no D1 e `/api/auth/logout`, tratamento de sessões expiradas/forjadas e erros da API do Discord.
  - **Anti-Manipulação e Segurança na Borda:** 7 testes — rejeição `401` em todas as rotas de escrita sem sessão válida, anti-spoofing de `user_id`, autorização `403` por autoria/criador da sala, rejeição `400` de payloads/votos inválidos e URLs maliciosas (`http://`, `javascript:`, `data:`, domínios falsos, credenciais na URL, rotas reservadas do SoundCloud), `409 Conflict` para links duplicados (inclusive formatos equivalentes `youtu.be` vs `youtube.com/watch?v=`), e proteção contra SQL Injection.
  - **Votação, Ordenação no Servidor e Cascata:** 2 testes — votos múltiplos (`+1`, `-1`, troca, remoção `0`), unicidade `(track_id, user_id)`, ordenação `score DESC, upvotes DESC, created_at ASC, id ASC`, consulta por `slug` e remoção em cascata ao excluir sala.
  - **Auditoria Estática de Frontend e Rubrica:** 6 testes — ausência de frameworks proibidos, ausência de `innerHTML`, ausência de `text-shadow`/`drop-shadow` em CSS, presença da Chave Única no `README.md` e em `<footer>`, `LICENSE` MIT, `AGENTS.md`, `skills/*/SKILL.md` e checagem de sintaxe (`node --check`) de todos os arquivos `.js`/`.mjs`.

### 3.2 Validação Local da Rubrica (`node validar-local.mjs P26-2B-0018-0402-94DD-FCB7`)
- Todos os **8 critérios estruturais locais** aprovados (`LICENSE` MIT, Chave Única no `README.md`, Chave Única no `<footer>`, `AGENTS.md` com 3 agentes, Agente de Teste e Validação, `skills/*/SKILL.md`, Frontend Vanilla sem frameworks proibidos, Backend Cloudflare Functions + D1 + Discord OAuth2).
- O **item 9 (Deploy Online na Cloudflare)** é ativado automaticamente assim que o deploy público no Cloudflare Pages for publicado e a `URL_CLOUDFLARE` for atualizada no `README.md`.
