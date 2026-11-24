# Documentação de Engenharia de Agentes e Harness (P26-2B-A8E8-1049-96B9-DA17)

> **Requisito da Rubrica (25 pontos):** no mínimo **3 agentes diferentes** (sendo **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

Projeto: **Acervo de Citações e Notas de Leitura** (projeto #41).

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** **Claude Code** (CLI da Anthropic), com **subagentes** definidos como arquivos Markdown (`~/.claude/agents/*.md`, com `name`, `description` e `model: inherit`). Cada subagente roda em contexto isolado e recebe um *brief* completo da sessão principal.
- **Modelo(s) Base:** família **Claude** (sessão principal em Claude Sonnet 5.5). Os subagentes usam `model: inherit`, ou seja, o mesmo modelo da sessão que os chamou.
- **Estratégia de Coordenação:** a sessão principal despacha os agentes seguindo o protocolo do agente `agent-orchestrator` (roster, ordem das etapas, *briefs* completos, conferência do resultado). Etapas dependentes rodam em sequência (leitura da rubrica → design → front e back em paralelo, após fixar o contrato da API → QA → correções → reteste). Front e back foram desenvolvidos em paralelo sobre um **contrato de API JSON único** (`{ok:true,...}` / `{ok:false,error,fields?}`). Regras de contenção: cada agente toca só na sua camada (UI x servidor), nada de commit, deploy ou PR sem pedido explícito do usuário, e segredos nunca entram em arquivos do repositório (`.dev.vars` está no `.gitignore`).
- **Verificação automatizada:** `validar-local.mjs` (pré-validação da rubrica) e `node --test tests/*.test.mjs` (testes do backend).

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Executor de Objetivo (`project-goal-executor`)
- **Papel:** ler a rubrica e o passo a passo da disciplina e transformá-los em checklist de entregas, restrições (stack obrigatória, "sem frameworks de UI") e itens fora de escopo.
- **Entregas:** checklist rastreável à rubrica; decisão de delegar cada item ao especialista dono dele.

### Agente 2: Curador de Design (`web-design-curator`)
- **Papel:** definir a direção visual (paleta com contraste medido, tipografia, tokens claro/escuro) e produzir o design de referência.
- **Skills:** nenhuma skill foi carregada; o agente seguiu a própria definição (`web-design-curator.md`).
- **Entregas:** `DESIGN.md` com tokens e mockups desktop/mobile (FigCraft) que o front seguiu.

### Agente 3: Construtor de Interface Web Vanilla (`threejs-gsap-web-builder`, restrito a HTML5/CSS3/JS puro)
- **Papel:** construir a interface em HTML5 semântico, CSS3 e JavaScript puro (sem frameworks de UI e, neste projeto, sem three.js/GSAP), consumindo a API via `fetch` e escrevendo no DOM só com `textContent`.
- **Skill aplicada em revisão (2026-11-08):** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md). Na construção, o agente seguiu a própria definição e o `DESIGN.md`. Depois, o agente foi chamado de novo, leu a skill e verificou `public/` regra por regra: regra 1 (sem frameworks) CUMPRE; regra 2 (tipografia) PARCIAL, sem `text-shadow`/`drop-shadow`, mas sem peso 700/800 (desvio declarado na skill); regra 3 (chave no `<footer>`) CUMPRE em `index.html` e passou a valer também em `404.html`. Medições: sem rolagem horizontal em 390 e 1440 px; console com só o 401 esperado de visitante.
- **Entregas:** `public/index.html`, `public/styles.css`, `public/app.js`, `public/theme.js`, `public/404.html`, `public/_headers`; rodapé com a Chave Única `P26-2B-A8E8-1049-96B9-DA17`.

### Agente 4: Engenheiro de Backend Serverless (`web-backend-engineer`)
- **Papel:** esquema relacional no Cloudflare D1 (`migrations/`), Pages Functions (`functions/`), validação de negócio e autorização no servidor (só o dono edita ou exclui a própria citação) e contrato JSON para o front.
- **Skill aplicada em revisão (2026-11-08):** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md). Na construção, o agente seguiu a própria definição. Depois, o agente foi chamado de novo, leu a skill e verificou `functions/`, `migrations/` e `tests/` regra por regra: as 3 regras (validação na borda, SQL parametrizado, sessão Discord assinada em cookie `HttpOnly`) CUMPREM, com 14 de 14 testes passando na data (hoje são 42 de 42). As 8 sugestões dele foram incorporadas à skill (contrato `{ok,error,fields}`, checagem de `Origin`, `state` em tempo constante, limites, catch-all 404).
- **Entregas:** CRUD de citações com SQL parametrizado, paginação, sorteio, testes automatizados (`tests/backend.test.mjs`).

### Agente 5: Integrador Discord OAuth2 (`discord-oauth-integrator`)
- **Papel:** login exclusivo via Discord OAuth2: `/api/auth/discord`, `/api/auth/discord/callback`, cookie `state` anti-CSRF, sessão assinada com HMAC-SHA256 e logout.
- **Entregas:** `functions/api/auth/*` e `functions/_lib/session.js`; credenciais apenas em variáveis de ambiente (`.dev.vars` local, painel da Cloudflare em produção).

### Agente 6: Agente de Teste, Auditoria de Segurança e Validação (obrigatório) (`site-qa-tester`)
- **Papel:** testar o site de ponta a ponta de forma independente: funcional (rotas, CRUD, busca, sorteio, login), fuzzing de formulários, segurança (XSS, autorização, CSRF, cookies, cabeçalhos, exposição de arquivos), acessibilidade, responsivo (320/390/1440 px), temas claro/escuro, console e rede.
- **Skill aplicada (2026-11-08):** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md). O agente leu a skill e executou o checklist: (1) isolamento de subpasta PASSOU (`git status` só com a pasta do projeto); (2) anti-manipulação PASSOU (em produção sem sessão: 401, `PATCH` 405, rota inexistente 404; em servidor isolado, 25 de 25 casos com os códigos 400/401/403/404/405/413/415 esperados; o 409 não se aplica); (3) conformidade PASSOU (`validar-local` 9 de 9 e 14 de 14 testes, números de 2026-11-08; hoje são 42 de 42). Antes disso, rodadas anteriores do mesmo agente já tinham feito o QA completo e o reteste das correções.
- **Entregas:** relatório com severidade e evidência por achado (0 críticos/altos; 3 médios e 7 baixos), seguido de reteste após as correções, em que todos os itens passaram.

### Agente 7: Revisor de Código e Segredos (`code-bug-security-fixer`)
- **Papel:** revisão estática do código em busca de bugs e de segredos/dados sensíveis perdidos; só reporta ou corrige com aprovação.
- **Entregas:** confirmação de que `.dev.vars` e `.wrangler/` estão ignorados pelo git e de que não há segredos nos arquivos rastreáveis; achados de lógica de baixa severidade, aplicados depois.

### Rodada de 2026-11-12: importação, tags, coleções e áudio

Novas funções, feitas pelos mesmos agentes (cada um só na sua parte) e conferidas pelo QA:
- `web-backend-engineer`: migration `0003` (tags e coleções), importação em lote (`/api/quotes/import`, tudo entra privado, duplicatas puladas, até 200 itens e 1 MB), `/api/tags` e `/api/collections`; testes foram de 14 para 22 (30 em 2026-11-18; 42 em 2026-11-19).
- `threejs-gsap-web-builder`: tela de importação de `.md` e `.txt` com prévia antes de salvar (6 formatos), tags, coleções e botão "Ouvir" (Web Speech API do navegador, sem dependências).
- `code-bug-security-fixer`: achou e corrigiu 3 regex lentas no parser (ReDoS) e limites do cliente diferentes dos do servidor; sem XSS, SQL injection ou vazamento de citação privada.
- `site-qa-tester`: QA sem login (parser, backend em SQLite real, UI com API simulada) e QA com login real no navegador contra o banco local; achou 1 bug médio e 7 baixos, todos de front, corrigidos em seguida pelo construtor (a revalidação logada das correções finais ainda não foi repetida).

### Rodada de 2026-11-18: convite ao servidor Discord e seletor de voz

- `discord-server-builder`: criou **ao vivo** o servidor Discord "Acervo de Citações" por um script idempotente com bot (7 categorias, 23 canais, 4 cargos, AutoMod e convite permanente https://discord.gg/jkbgdFP7c9). O usuário criou o servidor vazio e o bot, colou o token no `.env` dele (fora do repositório) e configurou o Onboarding manualmente.
- `web-backend-engineer`: migration `0004` (`invite_prompt_seen_at`, com backfill), `GET /api/me` com `invitePrompt{show,url}`, `POST /api/discord/invite-prompt` (204) e a variável opcional `DISCORD_INVITE_URL`, validada no servidor.
- `threejs-gsap-web-builder`: janela de convite (`<dialog>`) mostrada uma vez ao usuário novo depois do login ("Sim" / "Agora não"), item permanente "Servidor do Discord" no menu e seletor de voz do botão "Ouvir" (prefere vozes Natural, Premium ou Aprimorada, com dica).
- `code-bug-security-fixer`: revisou o código novo, varreu segredos nos 3 projetos e fez 1 endurecimento da validação da URL do convite no cliente.
- `cloudflare-pages-deployer`: em 2026-11-18 fez backup do D1, aplicou a migration `0003` remota, redeployou e recriou os secrets `DISCORD_CLIENT_ID`/`DISCORD_CLIENT_SECRET`. Depois da aprovação do QA, ainda em 2026-11-18, fez novo backup do D1, aplicou a migration `0004` remota (as 8 citações continuaram intactas e o usuário existente foi marcado como "já viu o convite"), criou `DISCORD_INVITE_URL` e redeployou, publicando o seletor de voz e a janela de convite; a verificação em produção (sem login) passou.

### Rodada de 2026-11-19: idioma PT | EN e redeploy

- `threejs-gsap-web-builder`: implementou o botão PT|EN no cabeçalho. Dicionário em inglês em `public/i18n-en.js` (373 chaves, paridade com o português provada por script); idioma lembrado em `localStorage` (`acervo-lang`); padrão pelo idioma do navegador (pt* → pt, en* → en, outro → pt) e `?lang=`; troca sem recarregar a página, que cancela a fala e recalcula a voz (pt-BR/en-US). As mensagens do servidor em português são traduzidas no navegador por um mapa. O importador de citações passou a reconhecer também rótulos em inglês (Quote, Author, Work, Page, Reflection, Tags, Kindle "Your Highlight/Your Note"); `404.html` e `<noscript>` ficaram bilíngues.
- Verificação feita: `node --check`, paridade de chaves, 13 casos de detecção de idioma, 6 formatos do parser em português e inglês, ReDoS em entradas de 50 mil caracteres (o mais lento levou 8 ms) e navegador sem login (idioma, rodapé, 404).
- **A validar pelo autor:** as telas logadas na troca de idioma (feed, minhas, formulário, coleções, importação, janela de convite) e a fala com vozes reais em inglês ainda não foram testadas.
- `cloudflare-pages-deployer`: redeploy da pasta `public/` (sem migration, sem alteração de secrets ou do D1; as 8 citações continuaram intactas), verificado em produção sem login. Deployment https://67e8180a.p26-2b-a8e8-1049-96b9-da17.pages.dev; o deploy anterior (`647e2118`) foi guardado para reversão.
- Continuam valendo: `github-project-publisher` não foi usado, 30 testes (nessa etapa) e 3 skills inalteradas.

### Rodada de 2026-11-19 (voz): voz automática e voz em nuvem

- Motivo: o usuário achou a voz do navegador ruim. Diagnóstico: o seletor de voz tinha salvo `Joana` (voz de Portugal) e a voz padrão do macOS é em inglês.
- `threejs-gsap-web-builder`: **removeu o seletor de voz**. Agora há uma voz automática por idioma (pt-BR/en-US), que prefere vozes Natural/Neural/Premium/Aprimorada/Siri, depois Google/Microsoft/Felipe/Luciana, exclui vozes de novidade e nunca usa pt-PT havendo pt-BR; escolhas antigas são apagadas; sem voz no idioma, avisa em vez de falar com voz errada; espera o evento `voiceschanged` por até 1,5 s.
- `web-backend-engineer`: criou a voz em nuvem com o Google Cloud Text-to-Speech: `POST /api/tts` (login obrigatório, mesma origem, texto até 1500 caracteres, idiomas pt/en, velocidade 0,75 a 1,5), vozes `pt-BR-Neural2-A` e `en-US-Neural2-F`, cache no servidor (`caches.default`), cotas (30 000 caracteres/dia por usuário e 700 000/mês no total, abaixo do plano gratuito), migration `0005` (tabela `tts_usage`), `GET /api/me` com o campo `tts` e variáveis opcionais `TTS_DAILY_USER_CHARS`, `TTS_MONTHLY_CHARS`, `TTS_VOICE_PT`, `TTS_VOICE_EN`. Os testes foram de 30 para 42.
- `threejs-gsap-web-builder`: lado do navegador. Toca o áudio em nuvem (pré-carrega a próxima citação, mesmos controles), com retorno automático à voz do navegador e aviso uma vez; a CSP só ganhou `media-src 'self' blob:`.
- `cloudflare-pages-deployer`: backup do D1, migration `0005` remota (as 8 citações e o 1 usuário continuaram intactos) e redeploy; a verificação em produção sem login passou e os hashes dos arquivos públicos coincidem com os locais. Deployment https://2ef83217.p26-2b-a8e8-1049-96b9-da17.pages.dev; o anterior (`67e8180a`) foi guardado para reversão.
- **Honestidade: a voz em nuvem está implementada e publicada, mas INATIVA.** A chave `GOOGLE_TTS_API_KEY` não existe; o autor decidiu não criá-la (ver a rodada de verificação final), então o site usa a voz do navegador.
- **A validar pelo autor:** o áudio real do Google e o cache real da Cloudflare (não testados) e as telas logadas. Privacidade: com a nuvem ativa, o texto lido (inclusive de citações privadas) vai para o Google Cloud, e o site avisa "Voz natural gerada pelo Google Cloud.".
- Continuam valendo: `github-project-publisher` não foi usado, 3 skills inalteradas e **42 testes** hoje (14, 22, 30 e 42; `node --test tests/*.test.mjs`).

### Rodada de 2026-11-19 (verificação final)

Quatro agentes fizeram a verificação final; foram somente leitura, exceto onde indicado.

- `cloudflare-pages-deployer`: conferiu a produção (deploy `2ef83217`; arquivos idênticos aos locais por hash; secrets `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` e `DISCORD_INVITE_URL`, **sem** `GOOGLE_TTS_API_KEY`; migrations 0001 a 0005 sem pendências; 8 citações e 1 usuário; convite https://discord.gg/jkbgdFP7c9 válido e sem expiração). Depois da correção abaixo, fez o deploy final (só `public/`, sem migration).
- `code-bug-security-fixer`: revisou o código novo e o conteúdo do commit: sem achados críticos ou altos e sem segredos; só a subpasta entraria (cerca de 592 KB).
- `project-goal-executor`: comparou o projeto com o enunciado e a rubrica e simulou o robô do professor (5 itens esperados OK).
- `site-qa-tester`: testou com gravação real no navegador do autor, logado, em produção (somente leitura) e no local (escritas com dados `[QA]`, depois removidos). A voz muda com o idioma da interface (pt-BR: Luciana; en-US: Samantha), a troca PT | EN não mistura idiomas em nenhuma tela, sem erros no console e sem XSS. Achou 1 bug médio (importação com formatos misturados fundia citações em silêncio) e 2 baixos (numeração e contador da prévia).
- `threejs-gsap-web-builder`: corrigiu os três e fez a voz seguir o **idioma do texto da citação** (`detectTextLang`; texto ambíguo cai no idioma da interface; a atribuição falada usa o idioma do texto). A causa provável da queixa do autor era uma citação em português lida por voz inglesa com a interface em EN. Verificado em Node: 21 casos do parser, 31 de idioma/voz e ReDoS abaixo de 10 ms; o site publicado tem o mesmo `app.js` e `import-parser.js` do disco.
- **Decisão do autor:** não criar a chave do Google. A voz em nuvem fica implementada e **inativa**; o site usa a voz do navegador.
- **A validar pelo autor (NÃO testado):** a fala real depois desta correção, as telas logadas depois dela, a largura de 390 px e Safari/iOS; também seguem sem teste o áudio real do Google e o cache real da Cloudflare.
- Continuam valendo: `github-project-publisher` **não foi usado**, 3 skills inalteradas e **42 testes** (`node --test tests/*.test.mjs`).

### Agente de apoio: Executor de Terminal (`terminal-executor`)
- **Papel:** rodar apenas os comandos pedidos (clone do fork, `iniciar.mjs`, geração do `SESSION_SECRET`, servidor `wrangler pages dev`) e reportar a saída real, mascarando segredos.

---

## 3. Skills (`skills/`)

Durante a construção, os agentes seguiram as próprias definições (arquivos `.md` de subagente, copiados em [`agents/`](./agents/)); as skills abaixo são o modelo da disciplina e **não foram carregadas nessa fase**. Em **2026-11-08**, cada skill foi aplicada de verdade numa etapa de verificação: o agente correspondente foi chamado com o brief "leia a skill e confira o projeto regra por regra", e os resultados estão nos itens dos agentes acima. Os `SKILL.md` foram então reforçados com os padrões que o código realmente cumpre, e declaram os desvios (por exemplo, peso 700/800 não usado, `409` não aplicável).

| Skill | Agente que a aplicou | Resultado em 2026-11-08 |
|---|---|---|
| [`serverless-d1-discord`](./skills/serverless-d1-discord/SKILL.md) | Engenheiro de Backend Serverless | 3 de 3 regras CUMPREM |
| [`vanilla-dom-ui`](./skills/vanilla-dom-ui/SKILL.md) | Construtor de Interface Vanilla | 2 CUMPREM, 1 PARCIAL (peso 700/800) |
| [`teste-validacao`](./skills/teste-validacao/SKILL.md) | Agente de Teste e Validação | 3 de 3 itens PASSARAM (409 não se aplica) |

Além dessas, a definição do `web-design-curator` manda carregar a skill `frontend-design` do harness; **não há registro de que ela tenha sido carregada**, por isso não é listada como usada.

## 3.1. Definições dos agentes (`agents/`)

A pasta [`agents/`](./agents/) traz os arquivos `.md` dos 11 subagentes usados: `agent-orchestrator`, `project-goal-executor`, `web-design-curator`, `threejs-gsap-web-builder`, `web-backend-engineer`, `discord-oauth-integrator`, `discord-server-builder`, `site-qa-tester`, `code-bug-security-fixer`, `terminal-executor` e `cloudflare-pages-deployer`. O `discord-server-builder` foi usado em 2026-11-17/18 para criar ao vivo o servidor Discord "Acervo de Citações" (ver a rodada de 2026-11-18); `discord-server-builder` e `discord-oauth-integrator` não têm skill registrada. O `github-project-publisher` **não foi usado** neste projeto e por isso não está em `agents/`. O `cloudflare-pages-deployer` fez o deploy no Cloudflare Pages (upload direto com o Wrangler), a criação do banco D1, o cadastro dos secrets e, em 2026-11-18, backup do D1, migration `0003` remota e redeploy; em 2026-11-19, backup do D1, migration `0005` remota e dois redeploys (idioma e voz).

## 4. Como reproduzir a verificação

```bash
node validar-local.mjs P26-2B-A8E8-1049-96B9-DA17   # na raiz do repositório
node --test tests/*.test.mjs                        # na subpasta do projeto
npx wrangler pages dev public --port 8788           # site local com D1 e OAuth
```
