# Livro de Receitas Colaborativo

Projeto oficial **#28** — catálogo gastronômico colaborativo com autenticação Discord, armazenamento Cloudflare D1 e escalonador de porções.

- **Estudante:** WESLEY DOS SANTOS DE SOUZA
- **Turma informada pelo validador oficial:** 2B
- **Chave Única:** `P26-2B-8983-AF39-E3CF-C0B3`
- **URL_CLOUDFLARE:** https://p26-2b-8983-af39-e3cf-c0b3.pages.dev (publicação atual; Functions ainda precisam ser implantadas e verificadas)
- **Repositório público:** https://github.com/wesleysantos847317-sketch/Avalia2026-2-

## Funcionalidades

- Login OAuth2 exclusivo pelo Discord; o perfil (`user_id`, nome e avatar) é persistido no D1.
- Catálogo compartilhado com busca por nome, ingrediente e tempo máximo de preparo.
- 50 receitas editoriais iniciais, cada uma com ilustração SVG local original; novas receitas recebem uma imagem de fallback.
- Receitas com ingredientes estruturados (quantidade numérica e unidade separada), rendimento e etapas ordenadas.
- Controle de porções que recalcula as quantidades no navegador a partir do rendimento original, sem acumular erros de arredondamento.
- Favoritos privados por usuário, persistidos no Cloudflare D1.
- Interface responsiva em HTML5, CSS3 e JavaScript puro.
- Validação de identidade, payloads, quantidades, etapas e permissões nas Cloudflare Pages Functions.

## Estrutura

- `public/` — interface estática.
- `functions/api/` — rotas serverless e OAuth2.
- `migrations/0001_init.sql` — esquema relacional do D1.
- `migrations/0003_seed_catalog.sql` — 50 receitas iniciais, ingredientes, etapas e caminhos das imagens.
- `public/images/recipes/` — ilustrações locais das receitas.
- `scripts/generate-seed-catalog.mjs` — gerador reproduzível da migração e das ilustrações.
- `wrangler.jsonc` — configuração Pages e binding `DB`.
- `skills/` — instruções utilizadas pelos agentes de backend, frontend e validação.
- `AGENTS.md` — registro dos agentes, harness e responsabilidades.

## Publicação no Cloudflare Pages + D1

O projeto Pages e o banco D1 já existem na conta Cloudflare do estudante. O upload manual de assets pelo painel publica somente o frontend; para ativar as Pages Functions, use Wrangler a partir desta pasta. A autenticação Wrangler disponível neste ambiente ainda não tem acesso à conta desses recursos, então não execute as etapas remotas até confirmar no `wrangler whoami` que a conta correta está selecionada.

1. Confirme no painel que o projeto Pages é `p26-2b-8983-af39-e3cf-c0b3`, com o binding D1 `DB` para `db-p26-2b-8983-af39-e3cf-c0b3`.
2. Aplique as migrações no banco D1 existente:

   ```sh
   npx wrangler@4 d1 migrations apply db-p26-2b-8983-af39-e3cf-c0b3 --remote
   ```

3. Configure `DISCORD_CLIENT_ID` como variável e `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` como secrets de produção no Pages. O segredo de sessão deve ser aleatório e ter pelo menos 32 caracteres. Nunca salve esses valores no repositório.
4. No [Discord Developer Portal](https://discord.com/developers/applications), cadastre exatamente o redirect URI `https://p26-2b-8983-af39-e3cf-c0b3.pages.dev/api/auth/discord/callback`.
5. Publique frontend e Functions com Wrangler (o diretório `functions/` deve estar no projeto):

   ```sh
   npx wrangler@4 pages deploy public --project-name p26-2b-8983-af39-e3cf-c0b3 --branch main
   ```

6. Valide `/api/status`, `/api/recipes`, login Discord e favoritos antes de submeter a URL no AVA.

Para criar a pasta oficial no computador do laboratório, o gerador padrão pode retornar HTTP 403. O endpoint alternativo usado pelo pipeline do curso aceitou esta chave:

```powershell
$env:PROJETOS_API_BASE = ("https:" + "//frank-active-reader.frank-alcantara.workers.dev")
node iniciar.mjs P26-2B-8983-AF39-E3CF-C0B3
```

Valide a entrega a partir da raiz do repositório:

```sh
node --test P26-2B-8983-AF39-E3CF-C0B3/tests/backend.test.mjs
npx wrangler@4 pages functions build P26-2B-8983-AF39-E3CF-C0B3/functions --project-directory P26-2B-8983-AF39-E3CF-C0B3 --build-output-directory P26-2B-8983-AF39-E3CF-C0B3/public --outdir /tmp/p26-pages-build
node validar-local.mjs P26-2B-8983-AF39-E3CF-C0B3
```

A suíte usa o runner nativo do Node.js e cobre busca Unicode, validação de payload, sessão obrigatória em favoritos, state OAuth e resposta do endpoint de status. O login de produção depende de `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` configurados como secrets do Pages.

Neste momento, a suíte local e a compilação das Functions passam, mas o deploy com Functions, as migrações remotas e o OAuth de produção ainda não foram validados. O token Wrangler autenticado não tem autorização para o projeto/D1 configurados; não foi aplicado nenhum comando remoto nem alterado nenhum secret.

As receitas iniciais aparecem como publicadas por **Caderno Panela**, um autor editorial reservado para o conteúdo de demonstração — não é uma conta Discord nem permite login.

## Entrega

- Fork público: https://github.com/wesleysantos847317-sketch/Avalia2026-2-
- Pull request oficial: [#34](https://github.com/frankalcantara/Avalia2026-2/pull/34).
- A URL do projeto e a URL do repositório devem ser submetidas no AVA pelo estudante; este ambiente não possui sessão do AVA.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](./LICENSE).
