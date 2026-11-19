# Projeto #41: Acervo de Citações e Notas de Leitura

- **Projeto:** Acervo de Citações e Notas de Leitura: login com Discord, citações públicas ou privadas, busca instantânea por autor ou tema e citação aleatória
- **Estudante:** Paulo Cézar Mendonça Molena
- **Site pessoal:** [paulomendonca.dev](https://paulomendonca.dev)
- **Turma:** 2B
- **Chave Única:** `P26-2B-A8E8-1049-96B9-DA17`
- **URL_CLOUDFLARE:** `https://p26-2b-a8e8-1049-96b9-da17.pages.dev`
---

## Especificação do Projeto

O Acervo permite entrar com Discord (OAuth2), registrar citações com autor, obra, página e reflexão, escolher entre visibilidade Pública (feed da turma) ou Privada, buscar no cliente por autor ou tema e sortear uma citação pública. Front-end em HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks de interface; backend em Cloudflare Pages Functions + D1. O pacote também inclui os agentes (incluindo o de teste e validação), o AGENTS.md, a pasta skills/ e a licença MIT.

## Funcionalidades

- **Login com Discord (OAuth2):** sessão assinada em cookie `HttpOnly`, sem guardar senha.
- **Citações:** autor, obra, página e reflexão; visibilidade pública (feed) ou privada; busca instantânea e citação sorteada.
- **Importação de citações:** envie arquivos `.md` ou `.txt` (ou cole o texto), confira a **prévia editável** e só então salve. Lê 6 formatos (blockquote, "Texto — Autor", Kindle, front matter, campos rotulados e texto livre). Entende rótulos em português e em inglês (Quote, Author, Work, Page, Reflection, Tags e o Kindle "Your Highlight/Your Note"). Tudo entra como privado e duplicatas são puladas.
- **Tags e coleções:** organize as citações com tags (até 8) e coleções próprias, e filtre por elas.
- **Ouvir as citações:** botão "Ouvir" e "Ouvir a lista". Não há seletor de voz: o site usa **uma voz automática** da voz do navegador (Web Speech API) e **ela acompanha o idioma do texto da citação** (pt-BR ou en-US); se o texto for ambíguo, vale o idioma da interface, e a atribuição falada (autor e obra) usa o idioma do texto. Prefere vozes Natural, Neural, Premium, Aprimorada ou Siri, depois Google/Microsoft e outras comuns, sem vozes de novidade e sem usar pt-PT havendo pt-BR; se o navegador não tiver voz no idioma, avisa em vez de falar com voz errada. **Voz em nuvem (inativa):** o código da voz do Google Cloud Text-to-Speech (`POST /api/tts`, login obrigatório, cache no servidor e cotas de uso) está implementado e publicado, mas **inativa**: o autor decidiu não criar a chave `GOOGLE_TTS_API_KEY`, então o site usa a voz do navegador. O áudio real do Google e o cache real da Cloudflare **nunca foram testados**. Se a chave for criada no futuro, o texto lido (inclusive de citações privadas) seria enviado ao Google Cloud, e o site mostraria "Voz natural gerada pelo Google Cloud.". Ainda **não testados**: a fala real depois da última correção de idioma, as telas logadas depois dela, a largura de 390 px e Safari/iOS.
- **Convite ao servidor Discord (opcional):** após o login, o usuário novo vê uma única vez uma janela de convite ("Sim" ou "Agora não") para o servidor https://discord.gg/jkbgdFP7c9; o item "Servidor do Discord" fica no menu. O link vem da variável opcional `DISCORD_INVITE_URL`.
- **Idioma PT | EN:** botão no cabeçalho; na primeira visita usa o idioma do navegador (pt* → português, en* → inglês, outro → português), a escolha fica lembrada no navegador e também vale `?lang=`. A troca é feita sem recarregar a página, interrompe a fala e a voz acompanha o idioma (pt-BR ou en-US). As telas logadas na troca de idioma e a fala com vozes reais em inglês estão **a validar pelo autor**.
- **Acessibilidade e tema:** navegação por teclado, alvos de toque grandes no celular e tema claro/escuro.

## Arquitetura de agentes

O projeto foi construído por uma equipe de subagentes do Claude Code. Cada agente tem uma responsabilidade e um dono por pasta; a sessão principal faz o papel de orquestrador, porque subagentes não criam outros subagentes. Os detalhes (papéis, skills aplicadas, resultados e datas) estão em [`AGENTS.md`](./AGENTS.md), e as definições de cada agente estão em [`agents/`](./agents/).

```
sessão principal (orquestra, conferindo cada entrega)
 ├─ project-goal-executor ── lê o enunciado e monta o checklist
 ├─ web-design-curator ───── design system, paleta e tokens (DESIGN.md)
 ├─ threejs-gsap-web-builder ─ front-end vanilla em public/
 ├─ web-backend-engineer ─── API, D1 e migrations em functions/, migrations/, tests/
 ├─ discord-oauth-integrator ─ login com Discord (functions/api/auth/)
 ├─ code-bug-security-fixer ─ revisão de código, bugs e segredos
 ├─ site-qa-tester ───────── testes funcionais, de segurança e de acessibilidade
 ├─ discord-server-builder ── servidor Discord criado ao vivo (sem token no repositório)
 ├─ cloudflare-pages-deployer ─ deploy no Cloudflare Pages
 └─ terminal-executor ────── comandos de terminal pedidos, com saída real
```

| Agente | Responsabilidade neste projeto |
|---|---|
| `project-goal-executor` | Ler o enunciado e executar só o que ele pede |
| `web-design-curator` | Direção visual e tokens de design |
| `threejs-gsap-web-builder` | Interface (HTML/CSS/JS puro): importação, tags, coleções, áudio e, em 2026-11-19, o botão de idioma PT\|EN (dicionário em `public/i18n-en.js`) |
| `web-backend-engineer` | API serverless, D1, validação e autorização |
| `discord-oauth-integrator` | Login com Discord OAuth2 |
| `code-bug-security-fixer` | Revisão estática, ReDoS, XSS, segredos |
| `site-qa-tester` | QA com login real, segurança, acessibilidade e responsivo |
| `discord-server-builder` | Construiu ao vivo o servidor Discord "Acervo de Citações" (7 categorias, 23 canais, 4 cargos, AutoMod, convite permanente); o token do bot ficou só no `.env` local do autor, fora do repositório |
| `cloudflare-pages-deployer` | Deploy e variáveis de ambiente |
| `terminal-executor` | Execução dos comandos pedidos |

**Fluxo de trabalho:** objetivo → design → front e back em paralelo (com contrato de API combinado) → revisão de código → QA → correções → novo QA → deploy. O deploy e qualquer envio ao GitHub só acontecem com autorização explícita do autor.

**Skills (`skills/`):** `serverless-d1-discord`, `vanilla-dom-ui` e `teste-validacao`, aplicadas em etapas de verificação e registradas com data e resultado no `AGENTS.md`.

> Este README e o `AGENTS.md` são atualizados a cada mudança na equipe de agentes ou nas funcionalidades.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2B-A8E8-1049-96B9-DA17`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2B-A8E8-1049-96B9-DA17
   npx.cmd wrangler d1 create db-p26-2b-a8e8-1049-96b9-da17
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote   # aplica as migrations 0001 a 0005 (a 0005 cria a tabela `tts_usage`, das cotas de voz)
   ```
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2b-a8e8-1049-96b9-da17`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://p26-2b-a8e8-1049-96b9-da17.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Adicione as variáveis de ambiente:
       - `DISCORD_CLIENT_ID`
       - `DISCORD_CLIENT_SECRET`
       - `SESSION_SECRET`
     - Opcional (não é segredo): `DISCORD_INVITE_URL`, com o link do convite (`https://discord.gg/jkbgdFP7c9`). Sem ela, a janela de convite não aparece.
     - Opcional, **voz natural em nuvem** (`GOOGLE_TTS_API_KEY`, cadastrada como *secret*; sem ela a função fica inativa e vale a voz do navegador): no Google Cloud, ative a **Cloud Text-to-Speech API**, crie uma chave de API **restrita a essa API** e configure um **orçamento com alerta de cobrança**. Depois de cadastrar o secret, republique o site. Variáveis opcionais de ajuste: `TTS_DAILY_USER_CHARS` (padrão 30 000 caracteres/dia por usuário), `TTS_MONTHLY_CHARS` (padrão 700 000/mês no total, abaixo do plano gratuito), `TTS_VOICE_PT` (padrão `pt-BR-Neural2-A`) e `TTS_VOICE_EN` (padrão `en-US-Neural2-F`). Cada pedido aceita até 1500 caracteres.
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2B-A8E8-1049-96B9-DA17` para validar todos os critérios antes de fazer o commit.

---

## English

**Quotes Archive and Reading Notes** is a small web app to save, organize and listen to quotes from the books you read. Everything above is in Portuguese; this section summarizes it in English. The site itself has a **PT | EN** button in the header that switches the whole interface instantly.

- **Live site:** https://p26-2b-a8e8-1049-96b9-da17.pages.dev
- **Unique key:** `P26-2B-A8E8-1049-96B9-DA17`
- **Author:** Paulo Cézar Mendonça Molena (class 2B), personal site: [paulomendonca.dev](https://paulomendonca.dev)
- **Stack:** plain HTML5, CSS3 and JavaScript on the front end (no frameworks); Cloudflare Pages Functions and a D1 database on the back end; sign-in with Discord OAuth2 (session in a signed `HttpOnly` cookie).

### Features

- **Quotes:** author, work, page and your own reflection; public (class feed) or private; instant search and a random public quote.
- **Import:** drop `.md` or `.txt` files (or paste text), review an editable preview and only then save. Six formats are recognized (blockquote, "Text — Author", Kindle, front matter, labeled fields and free text), with English and Portuguese labels. Everything is imported as private and duplicates are skipped.
- **Tags and collections:** up to 8 tags per quote and your own collections, with filters.
- **Listen:** "Listen" on a quote or on a whole list, with pause, next, stop and speed. The browser voice follows the language of the quote text (pt-BR or en-US). A natural cloud voice (Google Cloud Text-to-Speech) is implemented but **inactive**, because no API key was created; the site uses the browser voice. If it is ever enabled, the text being read, including private quotes, is sent to Google Cloud to generate the audio.
- **Language:** PT | EN button; the choice is remembered and the browser language is used on the first visit. Quote texts are user content and are not translated.
- **Discord invite:** new users see a single optional prompt to join the community server; the invite also stays in the menu.
- **Accessibility and theme:** keyboard navigation, large touch targets on mobile and a light and dark theme.

### Agent architecture

The project was built by a team of Claude Code subagents: a goal executor, a design curator, a front-end builder, a back-end engineer, a Discord OAuth integrator, a QA tester, a code and security reviewer, a Cloudflare Pages deployer, a terminal executor and a Discord server builder (which created the community server on 2026-11-18). The main session acts as the orchestrator, because subagents cannot start other subagents. Roles, results, dates and what was actually used are in [`AGENTS.md`](./AGENTS.md); the agent definitions are in [`agents/`](./agents/) and the three skills in [`skills/`](./skills/). The `github-project-publisher` agent was not used.

### Run and deploy

1. Create a D1 database and apply the migrations (no build step): `npx wrangler d1 migrations apply DB --remote` (migrations 0001 to 0005).
2. Create a Discord application and add the redirect URI `https://<your-pages-url>/api/auth/discord/callback`. Set `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `SESSION_SECRET` as secrets (locally in `.dev.vars`, which is git-ignored; see `.dev.vars.example`). `DISCORD_INVITE_URL` is optional and not secret.
3. Local development: `npx wrangler pages dev public --port 8788`. Tests: `node --test tests/*.test.mjs` (42 tests).
4. Deploy: `npx wrangler pages deploy public --project-name <your-project> --branch main`.

An English-only copy of this project (code, comments and documentation in English) is kept separately by the author.

### Status

Automated checks pass (42 tests, local pre-validation 9/9). Real speech after the latest voice change, the logged-in screens after it, small mobile widths and Safari/iOS are still to be validated by the author.
