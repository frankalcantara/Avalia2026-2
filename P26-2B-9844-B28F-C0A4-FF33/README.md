# Projeto #22: Fórum de Dúvidas em Formato Pergunta-Resposta

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Sophia Costa da Silva
- **Turma:** 2B
- **Chave Única:** `P26-2B-9844-B28F-C0A4-FF33`
- **URL_CLOUDFLARE:** `https://projeto-p26-2b-9844-b28f-c0a4-ff33.pages.dev`

---

## Especificação do Projeto

O fórum permite consultar perguntas, criar tópicos, publicar respostas e marcar uma resposta como solução. Somente a pessoa autenticada que abriu a pergunta pode aceitar uma resposta. Tópicos e respostas são armazenados no Cloudflare D1; a verificação de identidade e autorização acontece nas Pages Functions.

## Executar localmente

Requisitos: Node.js 22 ou superior. A instalação de dependências usa o Wrangler, ferramenta local de desenvolvimento Cloudflare.

1. Abra um terminal nesta pasta do projeto.
2. Instale o Wrangler:

   ```powershell
   npm install
   ```

3. Crie o banco D1 local e aplique as migrations:

   ```powershell
   npm run db:migrate:local
   ```

4. Inicie o Pages Functions:

   ```powershell
   npm run dev
   ```

5. Abra **http://127.0.0.1:8788** no navegador.

O frontend e as Pages Functions iniciam localmente pelo Wrangler. O login Discord fica desativado até configurar as credenciais reais; não existe usuário ou login simulado. As operações do fórum precisam que o D1 local esteja respondendo.

**Limitação observada neste ambiente Windows:** o Wrangler inicia Pages, mas as operações D1 locais retornam `internal error` mesmo para `SELECT 1`. Há um relato upstream de falha semelhante em D1 local no Windows ([workers-sdk #16671](https://github.com/cloudflare/workers-sdk/issues/16671)). A validação SQLite em memória não substitui a execução real no D1; confirme o banco local após uma correção do runtime ou valide contra um D1 remoto configurado.

### Habilitar Discord OAuth2 local

1. Copie `.dev.vars.example` para `.dev.vars`.
2. Preencha `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` com valores da sua aplicação no Discord Developer Portal.
3. Gere um secret aleatório com Node.js e salve em `SESSION_SECRET`:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
   ```

4. No Discord Developer Portal, registre o redirect exato:

   ```text
   http://127.0.0.1:8788/api/auth/discord/callback
   ```

5. Reinicie `npm run dev`.

O arquivo `.dev.vars` é local e ignorado pelo Git. Não publique Client Secret nem SESSION_SECRET.

## API do fórum

- Páginas públicas, acessíveis sem login: `/termos` e `/privacidade`.
- `GET /api/questions` e `GET /api/questions?status=open|resolved`: lista perguntas.
- `GET /api/questions/:questionId`: retorna pergunta e respostas, com solução aceita primeiro.
- `POST /api/questions`: cria uma pergunta autenticada.
- `POST /api/questions/:questionId/answers`: cria uma resposta autenticada.
- `PUT /api/questions/:questionId/accepted-answer`: permite ao autor da pergunta aceitar uma resposta daquele tópico.
- `GET /api/auth/session` e `POST /api/auth/logout`: consulta e encerra a sessão.

As sessões são assinadas com HMAC e armazenadas em cookie `HttpOnly`; o fluxo OAuth valida `state`. As rotas de escrita obtêm a identidade da sessão, nunca dos campos de usuário enviados pelo navegador.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-2B-9844-B28F-C0A4-FF33`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique as migrations (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-2B-9844-B28F-C0A4-FF33
   npx.cmd wrangler d1 create db-p26-2b-9844-b28f-c0a4-ff33
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
   A migration `0001_init.sql` é preservada; `0002_forum.sql` cria as tabelas relacionais do fórum.
4. **Vincule o Banco D1 ao seu Cloudflare Pages (Obrigatório para ativar env.DB):**
   - No painel da Cloudflare: acesse seu projeto Pages → **Settings** → **Functions** → **D1 database bindings**.
   - Clique em **Add binding**:
     - **Variable name:** `DB`
     - **D1 database:** selecione o banco que você criou (`db-p26-2b-9844-b28f-c0a4-ff33`).
5. **Configuração do Discord OAuth2 (Obrigatório para autenticação real):**
   - Acesse o **Discord Developer Portal** (https://discord.com/developers/applications) e crie uma nova Application.
   - Na aba **OAuth2**:
     - Copie o **Client ID** e gere o **Client Secret**.
     - Em **Redirects**, adicione a URL exata do deploy:
       `https://projeto-p26-2b-9844-b28f-c0a4-ff33.pages.dev/api/auth/discord/callback`
   - No painel do seu projeto no Cloudflare Pages:
     - Acesse **Settings** → **Environment variables**.
     - Configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` (como secret) e `SESSION_SECRET` (como secret).
     - Configure `DISCORD_REDIRECT_URI` somente se o callback público não corresponder ao domínio atual:
       `https://projeto-p26-2b-9844-b28f-c0a4-ff33.pages.dev/api/auth/discord/callback`
6. Atualize o campo **URL_CLOUDFLARE** no topo deste `README.md` com o endereço público gerado pela Cloudflare.
7. Na raiz do repositório, execute `node validar-local.mjs P26-2B-9844-B28F-C0A4-FF33` para validar todos os critérios antes de fazer o commit e abrir o Pull Request.
