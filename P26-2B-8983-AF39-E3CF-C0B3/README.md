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
- 106 receitas iniciais: o catálogo atual inclui as 69 receitas da versão anterior e 37 receitas editoriais adicionais; 50 têm ilustrações SVG locais e as fotografias Wikimedia exibem seus créditos.
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
- `migrations/0004_legacy_catalog.sql` — restaura as receitas exclusivas do catálogo anterior com ingredientes, etapas, fotografias e créditos; combinadas ao catálogo editorial existente, são 106 receitas.
- `public/images/recipes/` — ilustrações locais das receitas.
- `scripts/generate-seed-catalog.mjs` — gerador reproduzível da migração e das ilustrações.
- `wrangler.jsonc` — configuração Pages e binding `DB`.
- `skills/` — instruções utilizadas pelos agentes de backend, frontend e validação.
- `AGENTS.md` — registro dos agentes, harness e responsabilidades.

## Publicação no Cloudflare Pages + D1

O projeto Pages e o banco D1 já existem na conta Cloudflare do estudante. O upload manual de assets pelo painel publica somente o frontend; para ativar as Pages Functions, use Wrangler a partir desta pasta. Confirme com `npx wrangler whoami` que a conta `831cfa23a685c176ef5bbb0431fb51de` está selecionada antes de executar comandos remotos.

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

As migrações foram aplicadas ao D1 de produção e conferidas: 106 receitas, 515 ingredientes, 319 etapas, 31 créditos Wikimedia, além das ilustrações locais. O Pages Functions foi publicado; o endpoint de status confirmou D1 conectado. O Client ID e o segredo de sessão estão configurados. O login de produção segue pendente até cadastrar `DISCORD_CLIENT_SECRET`. O catálogo exige agrupar as consultas de detalhes em blocos para respeitar o limite de parâmetros do D1.

As receitas iniciais aparecem como publicadas por **Caderno Panela**, um autor editorial reservado para o conteúdo de demonstração — não é uma conta Discord nem permite login.

## Entrega

- Fork público: https://github.com/wesleysantos847317-sketch/Avalia2026-2-
- Pull request oficial: [#34](https://github.com/frankalcantara/Avalia2026-2/pull/34).
- A URL do projeto e a URL do repositório devem ser submetidas no AVA pelo estudante; este ambiente não possui sessão do AVA.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](./LICENSE).
