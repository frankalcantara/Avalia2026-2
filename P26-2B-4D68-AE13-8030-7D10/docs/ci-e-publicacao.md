# CI e publicação

## 1. CI no GitHub Actions

O workflow precisa ficar em `.github/workflows/` na **raiz do repositório** (fora desta subpasta), porque o GitHub só lê esse caminho. Copie o arquivo abaixo para `.github/workflows/validacao.yml` na raiz:

```yaml
name: Validação
on:
  push:
    branches: [main]
  pull_request:
jobs:
  validar:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: P26-2B-4D68-AE13-8030-7D10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm test
      - name: Validação oficial
        run: node validar-local.mjs P26-2B-4D68-AE13-8030-7D10
        working-directory: .
```

Não há `npm ci`: o projeto não tem dependências. O validador roda na raiz do repositório; ajuste o caminho se ele estiver em outro lugar. O mesmo comando pode ser rodado localmente:

```powershell
npm run validate
```

A CI não toca no banco: ela só roda os testes unitários, que usam um D1 falso.

## 2. Checklist de publicação (Cloudflare Pages + D1)

1. Criar o banco no painel: **Workers & Pages → D1 → Create database**, nome `db-p26-2b-4d68-ae13-8030-7d10`. Nenhum UUID vai para o repositório.
2. Aplicar o schema: abrir o banco → **Console** → colar o SQL de [`../schema.sql`](../schema.sql) (ou o bloco de [schema-d1-e-orientacoes.md](./schema-d1-e-orientacoes.md)) → **Execute**.
3. No projeto Pages, configurar: root directory `P26-2B-4D68-AE13-8030-7D10`, build command **em branco**, build output `public`.
4. Em **Settings → Bindings → Add → D1 database bindings**, criar a variável `DB` apontando para o banco criado.
5. Variáveis no Pages → **Settings → Variables and Secrets**: `DISCORD_CLIENT_ID` (variável), `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` (secrets).
6. Deploy.
7. Conferir `GET /api/health` → `status: ok`.
8. Cadastrar o callback `https://SEU-DOMINIO.pages.dev/api/auth/discord/callback` no Discord e testar o login completo.
9. Rodar `node validar-local.mjs P26-2B-4D68-AE13-8030-7D10` na raiz e atualizar `URL_CLOUDFLARE` no `README.md`.

Não há bucket R2 nem etapa de storage: os dados ficam apenas no D1 e o schema documentado cobre todas as tabelas usadas.

O projeto não tem arquivo de configuração de Wrangler: o Pages lê tudo das configurações de build do painel (root directory, build command vazio, output `public`). Não crie um `wrangler.jsonc` com `d1_databases`: o Pages passa a validar aquele UUID em cada deploy e recusa com `Error 8000022: Invalid database UUID`.
