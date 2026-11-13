# Guia de Deploy — Achados e Perdidos (P26-2B-DEE2-E5F5-044F-D681)

Passo a passo para colocar o projeto no ar no **Cloudflare Pages + D1** com login **Discord** e fazer a entrega.
Tempo estimado: 30–40 minutos.

> **Windows (laboratório ou casa):** no PowerShell use `npx.cmd` e `npm.cmd` no lugar de `npx`/`npm`.
> No laboratório com Scoop, se `node` não for reconhecido: `$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"`

## 0. Pré-requisitos
- Contas: **GitHub**, **Cloudflare** (plano gratuito) e **Discord**.
- **Node.js 18+** e **Git** instalados (`node -v`, `git --version`).

---

## 1. Fork e pasta do projeto

1. Abra https://github.com/frankalcantara/Avalia2026-2 e clique em **Fork** (deixe o fork **público**).
2. Clone o seu fork e gere a pasta oficial (exigência do professor):
   ```powershell
   git clone https://github.com/SEU-USUARIO/Avalia2026-2.git
   cd Avalia2026-2
   node iniciar.mjs P26-2B-DEE2-E5F5-044F-D681
   ```
3. **Extraia o zip do projeto por cima** da pasta `P26-2B-DEE2-E5F5-044F-D681/` que o script criou, substituindo todos os arquivos.
   Os arquivos têm os mesmos nomes, então tudo o que o script gerou é trocado pela versão completa.

## 2. Banco de dados D1

Dentro da pasta do projeto:
```powershell
cd P26-2B-DEE2-E5F5-044F-D681
npx.cmd wrangler login
npx.cmd wrangler d1 create db-p26-2b-dee2-e5f5-044f-d681
```
1. O `wrangler login` abre o navegador para você autorizar a sua conta Cloudflare.
2. O `d1 create` mostra um `database_id` (algo como `a1b2c3d4-...`). Copie esse valor.
   Se o wrangler perguntar se quer adicionar ao arquivo de configuração, pode responder **não**, porque você vai colar manualmente.
3. Abra `wrangler.jsonc` e troque `00000000-0000-0000-0000-000000000000` pelo seu `database_id`.
4. Crie as tabelas no banco remoto:
   ```powershell
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
   Confirme com `y`. Devem aparecer ✅ em `0001_init.sql`.

## 3. Primeiro push

Na raiz do repositório:
```powershell
cd ..
git add P26-2B-DEE2-E5F5-044F-D681
git commit -m "Projeto #34 - Achados e Perdidos (P26-2B-DEE2-E5F5-044F-D681)"
git push origin main
```

## 4. Criar o projeto no Cloudflare Pages

1. No painel da Cloudflare: **Workers & Pages → Create**. Na tela de criação, escolha a aba/opção **Pages**.
   Se só aparecer Workers, procure o link "Looking to deploy Pages? Get started".
2. Selecione **Import an existing Git repository** e conecte o GitHub. Depois escolha o repositório `Avalia2026-2` do seu fork.
3. Preencha:
   - **Project name:** `achados-perdidos-p26-2b`
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** *(deixe vazio)*
   - **Build output directory:** `public`
   - **Root directory (Advanced):** `P26-2B-DEE2-E5F5-044F-D681`
4. Clique em **Save and Deploy**. Ao final, anote a URL do projeto (ex.: `https://achados-perdidos-p26-2b.pages.dev`).
5. Confira **Settings → Bindings**: deve aparecer o banco D1 com o nome `DB`, que vem do `wrangler.jsonc`.
   Se não aparecer, clique em **Add → D1 database**, use **Variable name** `DB` e selecione `db-p26-2b-dee2-e5f5-044f-d681`.

## 5. Aplicativo no Discord (OAuth2)

1. Abra https://discord.com/developers/applications → **New Application** (ex.: "Achados e Perdidos Campus").
2. Na aba **OAuth2**:
   - Copie o **Client ID**.
   - Clique em **Reset Secret** e copie o **Client Secret**. Guarde esse valor e **nunca** coloque no GitHub.
   - Em **Redirects → Add Redirect**, cole exatamente:
     `https://SUA-URL.pages.dev/api/auth/discord/callback`
     (troque pela URL do passo 4). Depois clique em **Save Changes**.

## 6. Secrets na Cloudflare

1. No projeto Pages: **Settings → Variables and Secrets → Add**.
2. Crie dois itens do tipo **Secret** no ambiente **Production**:
   - `DISCORD_CLIENT_ID` = Client ID
   - `DISCORD_CLIENT_SECRET` = Client Secret
3. As variáveis só valem a partir do próximo deploy. Vá em **Deployments**, abra o último deploy e use **⋯ → Retry deployment**.
   Outra opção é fazer qualquer commit e `git push`.

## 7. Testar online

1. Abra `https://SUA-URL.pages.dev/api/status`. Deve aparecer `"ok": true`, `"d1Conectado": true`, as 4 tabelas e `"discordConfigurado": true`.
2. Abra a página inicial, clique em **Entrar com Discord** e autorize. O seu avatar e o seu nome devem aparecer no topo.
3. Cadastre um item. Peça para um colega (ou use uma segunda conta do Discord numa janela anônima) reivindicar o item.
   Depois aceite a reivindicação, confira os contatos em "Minhas reivindicações" e marque como devolvido.

> O login só funciona na URL **de produção** cadastrada no Discord. As URLs de preview (`abc123.achados-...pages.dev`) não estão na lista de redirects.

### Problemas comuns
| Sintoma | Causa provável |
|---|---|
| `/api/status` com `d1_nao_configurado` | binding `DB` ausente (passo 4.5) |
| `d1_erro` / tabelas vazias | faltou `migrations apply DB --remote` ou `database_id` errado no `wrangler.jsonc` |
| `discord_nao_configurado` | secrets não criados ou deploy não refeito (passo 6) |
| Discord diz "Invalid OAuth2 redirect_uri" | redirect no Discord diferente da URL usada (confira `https`, domínio e `/api/auth/discord/callback`) |
| Volta com `?auth_error=troca_token_falhou` | Client Secret errado (gere outro e atualize o secret) |

## 8. Entrega

1. Se a sua URL for diferente de `https://achados-perdidos-p26-2b.pages.dev`, atualize a linha `URL_CLOUDFLARE` no `README.md` e o redirect no Discord.
2. Valide na raiz do repositório:
   ```powershell
   node validar-local.mjs P26-2B-DEE2-E5F5-044F-D681
   ```
   Os 9 itens devem ficar ✅.
3. Faça commit e push:
   ```powershell
   git add P26-2B-DEE2-E5F5-044F-D681
   git commit -m "Atualiza URL Cloudflare"
   git push origin main
   ```
4. No GitHub, abra um **Pull Request** do seu fork para `frankalcantara/Avalia2026-2`, alterando apenas a sua pasta.
5. No **AVA**, poste a URL do projeto online e a URL do seu repositório GitHub (o fork). O prazo é **20/11/2026 às 20:30**.
