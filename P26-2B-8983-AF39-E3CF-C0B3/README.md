# Livro de Receitas Colaborativo

Projeto oficial **#28** — catálogo gastronômico colaborativo com autenticação Discord, armazenamento Cloudflare D1 e escalonador de porções.

- **Estudante:** WESLEY DOS SANTOS DE SOUZA
- **Turma informada pelo validador oficial:** 2B
- **Chave Única:** `P26-2B-8983-AF39-E3CF-C0B3`
- **URL_CLOUDFLARE:** pendente de configuração e publicação no Cloudflare Pages
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

O deploy ainda depende de credenciais e recursos das contas Cloudflare e Discord do estudante. Configure-os antes de divulgar uma URL pública; não use os valores de exemplo abaixo como se fossem um deploy concluído.

1. Conecte o fork público ao Cloudflare Pages. Configure o diretório raiz como `P26-2B-8983-AF39-E3CF-C0B3`, deixe o comando de build vazio e use `public` como diretório de saída.
2. Crie o banco D1 e aplique a migração:

   ```sh
   npx wrangler d1 create db-p26-2b-8983-af39-e3cf-c0b3
   ```

   Copie o `database_id` retornado para `d1_databases[0].database_id` em `wrangler.jsonc` e execute:

   ```sh
   npx wrangler d1 migrations apply DB --remote
   ```

3. No Cloudflare Pages, crie o binding D1 com nome `DB` e selecione esse banco.
4. Crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications). Cadastre o redirect URI `https://<seu-projeto>.pages.dev/api/auth/discord/callback`.
5. Configure os secrets/variáveis do projeto Pages: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` (segredo aleatório forte, com pelo menos 32 bytes). Nunca salve esses valores no repositório.
6. Após o deploy e teste do login, atualize `URL_CLOUDFLARE` neste README com a URL real.

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

A suíte usa o runner nativo do Node.js e cobre busca Unicode, validação de payload, sessão obrigatória em favoritos, state OAuth e resposta do endpoint de status. A validação online permanecerá pendente até haver um deploy real e acessível; o fluxo OAuth real também requer as credenciais do Discord.

As receitas iniciais aparecem como publicadas por **Caderno Panela**, um autor editorial reservado para o conteúdo de demonstração — não é uma conta Discord nem permite login.

## Entrega

- Fork público: https://github.com/wesleysantos847317-sketch/Avalia2026-2-
- Pull request oficial: [#34](https://github.com/frankalcantara/Avalia2026-2/pull/34).
- A URL do projeto e a URL do repositório devem ser submetidas no AVA pelo estudante; este ambiente não possui sessão do AVA.

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](./LICENSE).
