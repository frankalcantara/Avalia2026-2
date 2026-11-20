# TechBlog Turma

Plataforma acadêmica de publicação de artigos técnicos com autenticação Discord OAuth2, Cloudflare Pages Functions e Cloudflare D1.

**Chave de auditoria:** `P26-2A-2B64-C206-BDAC-5A67`

## Tecnologias
- Cliente: HTML5, CSS3 e JavaScript vanilla (sem framework de interface).
- Backend: Cloudflare Pages Functions.
- Banco: Cloudflare D1 (SQLite).
- Login: Discord OAuth2 com escopo `identify` e sessão assinada em cookie HttpOnly.

## Funcionalidades
- Listagem pública dos artigos mais recentes.
- Login pelo Discord e importação de ID, nome e avatar.
- Criação de artigos por usuários autenticados.
- Edição e exclusão verificadas no servidor por `author_id`.
- Página de artigo, comentários cronológicos e curtidas.
- Página de autor.

## Requisitos
- Node.js LTS e npm.
- Conta Cloudflare com Pages e D1 habilitados.
- Aplicação criada no Discord Developer Portal.
- Repositório GitHub público para a entrega.

## Configuração local
1. Instale dependências: `npm install`.
2. Crie o banco: `npx wrangler d1 create techblog-turma-db`.
3. Copie o `database_id` retornado para `wrangler.toml` no lugar de `COLOQUE_O_ID_DO_SEU_D1_AQUI`.
4. Crie as tabelas: `npx wrangler d1 execute techblog-turma-db --local --file=./schema.sql`.
5. Copie `.dev.vars.example` para `.dev.vars` e preencha os valores localmente. Nunca publique `.dev.vars`.
6. No Discord Developer Portal, configure OAuth2 Redirect URL como `http://localhost:8788/api/auth/callback` para desenvolvimento local.
7. Execute `npm run dev` e abra o endereço informado pelo Wrangler (normalmente `http://localhost:8788`).

## Configuração OAuth2 do Discord
Crie uma aplicação no Discord Developer Portal e obtenha Client ID e Client Secret. Cadastre como Redirect URL exatamente o callback do ambiente. O escopo usado é `identify`. Em produção, a URL de callback será `https://SEU-DOMINIO/api/auth/callback`.

## Publicação no Cloudflare Pages
1. Crie o banco D1 no painel ou com Wrangler e aplique `schema.sql` em produção:
   `npx wrangler d1 execute techblog-turma-db --remote --file=./schema.sql`
2. Atualize `database_id` em `wrangler.toml`.
3. Publique o projeto pelo Cloudflare Pages (conectando o repositório GitHub ou usando `npm run deploy`).
4. Em Pages > Settings > Variables and Secrets, configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` e `SESSION_SECRET` como secrets/variáveis de ambiente de produção.
5. Em Settings > Functions > D1 database bindings, vincule o banco ao binding `DB` (ou confirme a configuração do `wrangler.toml`).
6. Atualize o Redirect URL no Discord para `https://SEU-DOMINIO/api/auth/callback` e ajuste `DISCORD_REDIRECT_URI` para o mesmo valor.
7. Faça novo deploy e teste login, publicação, edição, exclusão, comentários e curtidas.

Gere um segredo aleatório forte para `SESSION_SECRET` (pelo menos 32 caracteres). Não compartilhe nem versione segredos, tokens ou `.dev.vars`.

## Testes
Execute `npm test`. Os testes automatizados verificam estrutura do cliente, rotas, chave de auditoria, schema e proteção de propriedade no SQL. Eles não substituem testes de integração no ambiente Cloudflare/Discord.

## Agentes, harnesses e skills
A documentação está em [`docs/AGENTS.md`](docs/AGENTS.md), com os três papéis de agente, harnesses e skills incluídos em `agents/skills/`.

## Entrega acadêmica
Faça o fork do repositório oficial `frankalcantara/Avalia2026-2`, execute o comando de inicialização solicitado no computador do laboratório e coloque esta pasta dentro da estrutura criada pelo script. Abra um Pull Request para o repositório oficial. Publique as URLs do site e do repositório público no AVA.

## Licença
MIT. Consulte [`LICENSE`](LICENSE).
