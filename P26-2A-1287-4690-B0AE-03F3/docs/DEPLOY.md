# Guia de deploy (Cloudflare Pages + D1 + Discord)

Pré-requisitos: conta Cloudflare, conta Discord, Node.js, repositório no GitHub.

## 1. Aplicação no Discord
1. https://discord.com/developers/applications → **New Application**.
2. Em **OAuth2**, copie **Client ID** e **Client Secret**.
3. Em **Redirects** adicione (um por ambiente):
   - `https://SEU-PROJETO.pages.dev/api/auth/callback`
   - `http://localhost:8788/api/auth/callback` (desenvolvimento)

## 2. Banco D1
```bash
npx wrangler login
npx wrangler d1 create kudos-board-db
```
Copie o `database_id` impresso para `wrangler.toml`. Depois:
```bash
npx wrangler d1 migrations apply kudos-board-db --remote
```

## 3. Cloudflare Pages
**Pelo painel (recomendado):** Workers & Pages → Create → Pages → Connect to Git → escolha o repositório.
- **Nome do projeto:** `p26-2a-1287-4690-b0ae-03f3` (gera a URL `https://p26-2a-1287-4690-b0ae-03f3.pages.dev`)
- **Root directory:** `P26-2A-1287-4690-B0AE-03F3` · Build command: _(vazio)_ · Build output directory: `public`
- Settings → Bindings → **D1 database**: variável `DB` → `kudos-board-db`
- Settings → Variables and Secrets: `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (secret)

**Ou pela CLI:**
```bash
npx wrangler pages deploy public --project-name p26-2a-1287-4690-b0ae-03f3
npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name p26-2a-1287-4690-b0ae-03f3
```
(`DISCORD_CLIENT_ID` e o binding `DB` ficam no painel.)

Atualize o redirect do Discord com a URL final `*.pages.dev`.

## 4. Desenvolvimento local
Crie `.dev.vars` (não versionar):
```
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```
```bash
npx wrangler d1 migrations apply kudos-board-db --local
npx wrangler pages dev public --d1 DB=kudos-board-db
```
Abra http://localhost:8788. Como o login só cadastra quem já entrou, use duas contas Discord para ver um kudo.

## 5. Entrega (checklist)
- [ ] Projeto online em HTTPS e funcionando com 2 contas Discord
- [ ] Repositório **público**, com `LICENSE` MIT, README com a chave e URLs
- [ ] Fork de `frankalcantara/Avalia2026-2` com esta pasta (`P26-2A-1287-4690-B0AE-03F3/`) na raiz; rodar `node validar-local.mjs P26-2A-1287-4690-B0AE-03F3`; (opcional) rodar no computador do laboratório `node iniciar.mjs P26-2A-1287-4690-B0AE-03F3`, copiar o projeto para a pasta criada e abrir o Pull Request
- [ ] Postar no AVA: URL do projeto + URL do repositório
