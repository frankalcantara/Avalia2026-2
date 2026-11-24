# Livro-caixa pessoal

Aplicação de controle de receitas e despesas com HTML, CSS e JavaScript puros, Cloudflare Pages Functions, Cloudflare D1 e autenticação Discord OAuth2.

**Aluno:** Matheus de Araujo Pinho — Turma 2C

**Chave Única:** `P26-2C-7DDD-9039-3A0D-D491`
**Projeto publicado:** https://financeiro-bj1.pages.dev

## Recursos

- Login Discord e sessão assinada em cookie `HttpOnly`, `Secure` e `SameSite=Lax`.
- Transações vinculadas ao ID do Discord autenticado.
- Criação, consulta, edição e exclusão com validação no servidor.
- Filtros por mês e categoria, saldo líquido e gráfico de despesas construído só com `div` e CSS.
- Interface responsiva sem frameworks no cliente.

## Configuração

1. Crie um banco D1 chamado `financeiro-db` e aplique `schema.sql`.
2. Copie o ID do banco para `database_id` em `wrangler.toml`.
3. Configure os segredos `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` no ambiente Cloudflare. Use um segredo aleatório forte com pelo menos 32 caracteres para `SESSION_SECRET`.
4. No portal de desenvolvedores do Discord, cadastre como Redirect URI `https://financeiro-bj1.pages.dev/api/callback`.
5. Publique o diretório `public` como um projeto Cloudflare Pages com as Functions deste repositório, e configure o binding D1 com nome `DB`.

Exemplo de comandos depois de autenticar o Wrangler:

```powershell
npx wrangler d1 create financeiro-db
npx wrangler d1 execute financeiro-db --remote --file=schema.sql
npx wrangler pages secret put DISCORD_CLIENT_ID --project-name=financeiro
npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name=financeiro
npx wrangler pages secret put SESSION_SECRET --project-name=financeiro
npx wrangler pages deploy public --project-name=financeiro
```

O placeholder de `database_id` em `wrangler.toml` deve ser substituído pelo ID retornado pelo primeiro comando antes do deploy. Não grave segredos no repositório. Para desenvolvimento local, configure os segredos no arquivo `.dev.vars` (não versionado) ou como variáveis de ambiente do Wrangler.

## Rotas

- `GET /api/login`, `GET /api/callback`, `GET /api/me`, `POST /api/logout`
- `GET|POST /api/transactions`
- `PUT|DELETE /api/transactions?id=ID`

O saldo apresentado em `GET /api/transactions` é calculado no servidor e considera todas as transações do usuário, mesmo quando a lista está filtrada.

## Testes locais

```powershell
npx wrangler d1 execute financeiro-db --local --file=schema.sql
npx wrangler pages dev public
```

Consulte [docs/RELATORIO_TESTE.md](docs/RELATORIO_TESTE.md) para os resultados e itens que ainda dependem da publicação e das credenciais dos serviços.
