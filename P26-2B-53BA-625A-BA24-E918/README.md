# Projeto #18 — Mural de Avisos Departamental por Disciplina

- **Estudante:** Alexandre Salvario Sontag
- **Turma:** 2B
- **Chave Única Oficial:** `P26-2B-53BA-625A-BA24-E918`
- **URL_CLOUDFLARE:** https://projeto-p26-2b-53ba-625a-ba24-e918.pages.dev

## Sobre

Mural digital para estudantes autenticados pelo Discord. Cada pessoa escolhe as disciplinas de interesse, acompanha um feed dessas disciplinas e pode publicar avisos, lembretes de entrega e links úteis. O autor pode editar e excluir suas próprias publicações; cada usuário mantém suas próprias marcações de lido e fixado.

O cliente usa HTML5, CSS3 e JavaScript puro. A autenticação, as permissões e as validações são executadas nas Cloudflare Pages Functions. Os perfis, disciplinas, inscrições, avisos e estados individuais são persistidos no Cloudflare D1.

## Estrutura

- `public/` — interface web responsiva e acessível.
- `functions/api/` — OAuth2 Discord e API do mural.
- `functions/_lib/` — sessão assinada e utilitários HTTP.
- `migrations/0001_init.sql` — esquema relacional e disciplinas iniciais.
- `wrangler.jsonc` — configuração de Pages e binding D1.
- `AGENTS.md` e `skills/` — registro do harness, agentes e práticas utilizadas.

## Configuração local

Execute os comandos a seguir no PowerShell, na raiz desta pasta. É necessário ter Node.js/npm instalado; o `npx.cmd` executa o Wrangler sem exigir instalação global.

1. Crie manualmente um arquivo `.dev.vars` nesta pasta, somente na sua máquina:

   ```dotenv
   DISCORD_CLIENT_ID="seu-client-id"
   DISCORD_CLIENT_SECRET="seu-client-secret"
   SESSION_SECRET="seu-segredo-aleatorio"
   DISCORD_REDIRECT_URI="http://localhost:8788/api/auth/discord/callback"
   ```

   Gere o `SESSION_SECRET` localmente com `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"` e copie o resultado para o arquivo. Não compartilhe nem faça commit desses valores. O `.dev.vars` está listado no `.gitignore`.
2. No Discord Developer Portal, registre exatamente `http://localhost:8788/api/auth/discord/callback` como redirect URI da aplicação OAuth2. Use o client ID e o client secret dessa aplicação somente no `.dev.vars`.
3. Inicialize o D1 local e aplique a migração:

   ```powershell
   npx.cmd wrangler d1 migrations apply DB --local --persist-to .wrangler/state
   ```

   O armazenamento local do D1 é gerenciado pelo Wrangler; isso não cria nem publica um banco remoto.
4. Inicie Pages localmente (usando a mesma pasta de estado da migração) e abra `http://localhost:8788`:

   ```powershell
   npx.cmd wrangler pages dev public --port 8788 --persist-to .wrangler/state
   ```

## Deploy Cloudflare

O projeto está publicado no Cloudflare Pages em https://projeto-p26-2b-53ba-625a-ba24-e918.pages.dev, usando esta subpasta como diretório raiz, sem comando de build e com diretório de saída `public`.

- **Banco:** Cloudflare D1 `db-p26-2b-53ba-625a-ba24-e918`, vinculado ao binding `DB` (declarado em `wrangler.jsonc`). A migração `migrations/0001_init.sql` foi aplicada com `npx.cmd wrangler d1 migrations apply DB --remote`.
- **Login:** Discord OAuth2, com o redirect de produção `https://projeto-p26-2b-53ba-625a-ba24-e918.pages.dev/api/auth/discord/callback` cadastrado no Discord Developer Portal.
- **Segredos de produção:** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` e `DISCORD_REDIRECT_URI` ficam como secrets no painel do Pages e nunca no repositório.
- **Verificação:** `node validar-local.mjs P26-2B-53BA-625A-BA24-E918` (na raiz do repositório) confirma os critérios da rubrica e a disponibilidade da URL pública.

Os agentes, o harness e os skills usados estão descritos em `AGENTS.md` e `skills/`.

## API

- `GET /api/auth/me` — sessão do Discord atual.
- `GET /api/auth/discord` e `GET /api/auth/discord/callback` — login OAuth2.
- `POST /api/auth/logout` — encerra a sessão.
- `GET /api/courses` — catálogo de disciplinas.
- `GET|POST|DELETE /api/subscriptions` — consulta, inscrição e remoção de inscrição.
- `GET|POST /api/posts` — feed personalizado e criação de avisos.
- `PATCH|DELETE /api/posts/:id` — edição e exclusão pelo próprio autor.
- `PATCH /api/posts/:id/state` — estados individuais de lido e fixado.

Todos os endpoints de conteúdo exigem uma sessão Discord válida; o servidor deriva a identidade do autor da sessão assinada, nunca do payload do navegador.

## Chave de auditoria

`P26-2B-53BA-625A-BA24-E918`