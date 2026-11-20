# Projeto #30: Jukebox e Playlists Colaborativas de Links (`CodeJukebox`)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** João Pedro Sehnem Scheuer
- **RA:** `2026108288`
- **Turma:** `2ESBN`
- **Chave Única:** `P26-2B-0018-0402-94DD-FCB7`
- **URL_CLOUDFLARE:** `https://p26-2b-0018-0402-94dd-fcb7.pages.dev` *(Atualize com a URL pública real gerada pela Cloudflare após o deploy)*

---

## Especificação do Projeto

Agregador social de recomendações musicais para programar ou estudar. Usuários autenticados exclusivamente com **Discord OAuth2** podem criar salas temáticas (ex.: *"Synthwave para Codar"*, *"Clássicos de Rock"*) e submeter links de faixas (**YouTube**, **Spotify** ou **SoundCloud**) acompanhados de título, artista (opcional) e gênero musical.

Cada faixa sugerida fica armazenada no **Cloudflare D1** vinculada à sala e ao autor da sugestão. Os participantes podem votar positivamente (`+1`), negativamente (`-1`) ou retirar seu voto (`0`); a interface em **HTML5, CSS3 e JavaScript puro (Vanilla JS)** reordena os itens dinamicamente com animação FLIP conforme o saldo de votos calculado no servidor, destacando no topo da sala a faixa mais aprovada pelo grupo com player embarcado sob demanda.

---

## Arquitetura e Estrutura da Subpasta

```text
P26-2B-0018-0402-94DD-FCB7/
├── LICENSE                             # Licença MIT
├── README.md                           # Documentação do projeto, chave única e guia de deploy
├── AGENTS.md                           # Documentação do harness, 3 agentes e relatório de testes
├── wrangler.jsonc                      # Configuração Cloudflare Pages + binding D1 (DB)
├── migrations/
│   └── 0001_init.sql                   # Esquema relacional D1 (discord_users, sessions, rooms, tracks, track_votes)
├── src/server/
│   ├── auth.js                         # Sessões opacas no D1, cookies HttpOnly e proteção CSRF
│   ├── db.js                           # Helpers D1 e bootstrap idempotente de esquema
│   ├── http.js                         # Respostas JSON, erros padronizados e parser de cookies
│   └── validators.js                   # Validação estrita na borda (salas, votos e URLs YouTube/Spotify/SoundCloud)
├── functions/api/
│   ├── status.js                       # GET /api/status
│   ├── auth/
│   │   ├── discord.js                  # GET /api/auth/discord
│   │   ├── discord/callback.js         # GET /api/auth/discord/callback
│   │   ├── me.js                       # GET /api/auth/me
│   │   └── logout.js                   # POST /api/auth/logout
│   ├── rooms/
│   │   ├── index.js                    # GET /api/rooms, POST /api/rooms
│   │   └── [id]/
│   │       ├── index.js                # GET /api/rooms/:id, DELETE /api/rooms/:id
│   │       └── tracks.js               # POST /api/rooms/:id/tracks
│   └── tracks/
│       └── [id]/
│           ├── index.js                # DELETE /api/tracks/:id
│           └── vote.js                 # POST /api/tracks/:id/vote
├── public/
│   ├── index.html                      # Interface HTML5 semântica + rodapé oficial com a Chave Única
│   ├── styles.css                      # CSS3 puro responsivo (zero frameworks, zero sombras em texto)
│   └── app.js                          # Vanilla JS puro (DOM seguro sem innerHTML + FLIP + embeds)
├── skills/
│   ├── serverless-d1-discord/SKILL.md  # Skill do Agente 1 (Backend Serverless + D1 + Discord OAuth2)
│   ├── vanilla-dom-ui/SKILL.md         # Skill do Agente 2 (Interface Web Vanilla)
│   └── teste-validacao/SKILL.md        # Skill do Agente 3 (Teste, Segurança e Validação)
└── tests/
    └── run-tests.mjs                   # Suíte automatizada zero-dependências (24 testes com SQLite real)
```

---

## Como Testar Localmente (Zero Dependências)

### 1. Executar a Suíte Automatizada de Testes e Segurança (24 testes)
Na pasta `P26-2B-0018-0402-94DD-FCB7`:
```powershell
node tests/run-tests.mjs
```

### 2. Executar o Validador Oficial da Disciplina
Na raiz do repositório `Avalia2026-2`:
```powershell
node validar-local.mjs P26-2B-0018-0402-94DD-FCB7
```

### 3. Rodar Localmente com Cloudflare Wrangler (Opcional)
1. Crie um arquivo `.dev.vars` (já listado no `.gitignore` — **nunca** faça commit dele!) dentro de `P26-2B-0018-0402-94DD-FCB7/`:
   ```env
   DISCORD_CLIENT_ID=seu_client_id_aqui
   DISCORD_CLIENT_SECRET=seu_client_secret_aqui
   ```
2. No Discord Developer Portal, adicione `http://127.0.0.1:8788/api/auth/discord/callback` em **OAuth2 → Redirects**.
3. Aplique a migração no banco D1 local e inicie o servidor:
   ```powershell
   cd P26-2B-0018-0402-94DD-FCB7
   npx.cmd wrangler d1 migrations apply DB --local
   npx.cmd wrangler pages dev ./public --d1=DB
   ```

---

## Como Publicar no Cloudflare Pages + D1 + Discord OAuth2 e Entregar o PR

### Passo 1 — Fork no GitHub e Envio da Subpasta
1. Acesse [`https://github.com/frankalcantara/Avalia2026-2`](https://github.com/frankalcantara/Avalia2026-2) e clique em **Fork** (mantenha o fork **Público**).
2. Aponte seu repositório local para o seu fork (ou copie a pasta `P26-2B-0018-0402-94DD-FCB7/` para dentro do seu fork):
   ```powershell
   git remote set-url origin https://github.com/SEU-USUARIO/Avalia2026-2.git
   git add P26-2B-0018-0402-94DD-FCB7
   git commit -m "Entrega Projeto #30 — P26-2B-0018-0402-94DD-FCB7"
   git push origin main
   ```

### Passo 2 — Criar o Banco Cloudflare D1 e Aplicar a Migração
```powershell
cd P26-2B-0018-0402-94DD-FCB7
npx.cmd wrangler login
npx.cmd wrangler d1 create db-p26-2b-0018-0402-94dd-fcb7
```
Copie o `database_id` retornado para o campo `"database_id"` em `wrangler.jsonc` e aplique a migração remota:
```powershell
npx.cmd wrangler d1 migrations apply DB --remote
```

### Passo 3 — Publicar no Cloudflare Pages
1. No painel da Cloudflare: **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → selecione o seu fork de `Avalia2026-2`.
2. Configure o build apontando para a subpasta:
   - **Root directory:** `P26-2B-0018-0402-94DD-FCB7`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Vincule o banco D1 ao projeto Pages (**Settings** → **Functions** → **D1 database bindings** → **Add binding**):
   - **Variable name:** `DB`
   - **D1 database:** `db-p26-2b-0018-0402-94dd-fcb7`

### Passo 4 — Configurar o Discord OAuth2
1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications) e crie uma nova Application.
2. Em **OAuth2**:
   - Copie o **Client ID** e gere/copie o **Client Secret**.
   - Em **Redirects**, adicione a URL exata do seu deploy na Cloudflare:
     `https://<sua-url-real>.pages.dev/api/auth/discord/callback`
3. No painel do Cloudflare Pages (**Settings** → **Environment variables**), adicione para **Production** (e **Preview**, se desejar):
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
4. Faça um novo deploy (Retry deployment) para ativar o binding `DB` e as variáveis de ambiente.

### Passo 5 — Validação Final, Pull Request e AVA
1. Atualize o campo `URL_CLOUDFLARE` no topo deste `README.md` com a URL pública real gerada pela Cloudflare.
2. Na raiz do repositório, valide os **9 de 9 itens**:
   ```powershell
   node validar-local.mjs P26-2B-0018-0402-94DD-FCB7
   ```
3. Faça `commit` e `push` das alterações (`wrangler.jsonc` e `README.md`), abra o **Pull Request** para `frankalcantara/Avalia2026-2` e poste as URLs do projeto online e do repositório GitHub no **AVA da instituição**.
