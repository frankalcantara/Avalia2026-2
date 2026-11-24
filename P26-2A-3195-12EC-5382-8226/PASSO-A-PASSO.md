# Passo a passo da entrega (Windows)

Chave: `P26-2A-3195-12EC-5382-8226`. Nome sugerido do projeto na Cloudflare: `habitos-p26-2a-3195`.

Os passos abaixo só você pode fazer, porque usam as suas contas. Leva cerca de 40 minutos. No laboratório, Node e Git já estão instalados: pule a etapa 0. No PowerShell, use sempre `npm.cmd` e `npx.cmd`.

---

## 0. Instalar Node.js e Git no seu computador (Scoop, sem precisar de administrador)

Abra o **PowerShell** (não precisa ser como administrador) e rode:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
scoop install git nodejs-lts
```

Feche e abra o PowerShell de novo e confira:

```powershell
node -v      # deve mostrar v22 ou maior
git --version
```

Se o comando `node` não for reconhecido: `$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"`.

## 1. Fork e clone

1. Entre em https://github.com/frankalcantara/Avalia2026-2 e clique em **Fork**. Mantenha o fork **público**.
2. Clone o seu fork. Troque `SEU-USUARIO` pelo seu usuário do GitHub:

```powershell
cd $HOME\Documents
git clone https://github.com/SEU-USUARIO/Avalia2026-2.git
cd Avalia2026-2
node iniciar.mjs P26-2A-3195-12EC-5382-8226
```

Isso cria a pasta `P26-2A-3195-12EC-5382-8226\` com o modelo do professor.

## 2. Colocar o projeto pronto na pasta

1. Extraia o `.zip` que você recebeu **dentro de `Avalia2026-2\`**. Ele já contém a pasta `P26-2A-3195-12EC-5382-8226\`.
2. Quando o Windows perguntar, escolha **Substituir os arquivos no destino**.
3. Instale as dependências e rode os testes:

```powershell
cd P26-2A-3195-12EC-5382-8226
npm.cmd install
npm.cmd test        # deve terminar com: pass 39, fail 0
```

## 3. Cloudflare: conta e banco D1

1. Crie uma conta gratuita em https://dash.cloudflare.com/sign-up.
2. Ainda dentro da pasta `P26-2A-3195-12EC-5382-8226`:

```powershell
npx.cmd wrangler login
npx.cmd wrangler d1 create db-p26-2a-3195-12ec-5382-8226
```

3. O comando mostra um `database_id`, parecido com `a1b2c3d4-...`. Abra `wrangler.jsonc` e troque `00000000-0000-0000-0000-000000000000` por esse ID.
4. Crie as tabelas no banco de produção:

```powershell
npx.cmd wrangler d1 migrations apply DB --remote
```

## 4. Enviar para o seu fork

```powershell
cd ..
git add P26-2A-3195-12EC-5382-8226
git commit -m "Entrega P26-2A-3195-12EC-5382-8226 - Projeto 10 Rastreador de Habitos"
git push origin main
```

Se o Git pedir seu nome e e-mail, rode `git config --global user.name "Seu Nome"` e `git config --global user.email "seu@email"` e repita o commit.

## 5. Publicar no Cloudflare Pages

1. No painel da Cloudflare, vá em **Workers & Pages → Create → Pages → Connect to Git** e autorize o GitHub.
2. Escolha o repositório `Avalia2026-2` e preencha:
   - **Project name:** `habitos-p26-2a-3195`
   - **Production branch:** `main`
   - **Root directory:** `P26-2A-3195-12EC-5382-8226`
   - **Build command:** deixe vazio
   - **Build output directory:** `public`
3. Clique em **Save and Deploy**. A URL será `https://habitos-p26-2a-3195.pages.dev`. Se o nome já estiver em uso, a Cloudflare mostra outro endereço: anote-o.
4. O banco D1 é ligado automaticamente pelo `wrangler.jsonc` (binding `DB`). Para conferir, abra `https://SUA-URL/api/status`: deve aparecer `"d1Connected": true` e `"schemaReady": true`.

## 6. Discord OAuth2

1. Acesse https://discord.com/developers/applications, clique em **New Application** e dê um nome, por exemplo "Rastreador de Hábitos".
2. Abra a aba **OAuth2**:
   - Copie o **Client ID**.
   - Clique em **Reset Secret** e copie o **Client Secret**. Não compartilhe esse segredo com ninguém, nem cole em arquivos do repositório.
   - Em **Redirects**, clique em **Add Redirect** e cole exatamente a URL abaixo, depois clique em **Save Changes**:
     `https://habitos-p26-2a-3195.pages.dev/api/auth/discord/callback`
     (troque pelo seu endereço se a Cloudflare tiver gerado outro).
3. No Cloudflare, abra o projeto Pages e vá em **Settings → Variables and Secrets → Add**. Crie as duas variáveis abaixo, do tipo **Secret**, para **Production**:
   - `DISCORD_CLIENT_ID` = o Client ID
   - `DISCORD_CLIENT_SECRET` = o Client Secret
4. Vá em **Deployments**, abra o último deploy e clique em **Retry deployment** (ou faça um novo push) para as variáveis passarem a valer.
5. Abra a URL, clique em **Entrar com Discord**, autorize, crie um hábito e marque uma caixa. Se `/api/status` mostrar `"discordOAuthConfigured": true`, está tudo certo.

## 7. Validar e abrir o Pull Request

1. Se a sua URL for diferente de `https://habitos-p26-2a-3195.pages.dev`, corrija a linha `URL_CLOUDFLARE` no `README.md`.
2. Na raiz do repositório (`Avalia2026-2`), rode:

```powershell
node validar-local.mjs P26-2A-3195-12EC-5382-8226
git add P26-2A-3195-12EC-5382-8226
git commit -m "Atualiza URL e validacao"
git push origin main
```

Os 9 itens devem aparecer como `[OK]`.

3. No GitHub, abra o seu fork e clique em **Contribute → Open pull request** para `frankalcantara/Avalia2026-2`. O PR deve conter **somente** a pasta `P26-2A-3195-12EC-5382-8226/`; arquivos fora dela invalidam a entrega.
4. No **AVA**, poste:
   - URL do projeto: `https://habitos-p26-2a-3195.pages.dev` (ou a sua)
   - URL do repositório: `https://github.com/SEU-USUARIO/Avalia2026-2`

---

## Problemas comuns

| Sintoma | Causa provável e solução |
|---|---|
| Login volta com "O login ainda não foi configurado" | As variáveis do Discord não estão no Pages, ou o deploy não foi refeito depois de criá-las (etapa 6.3 e 6.4). |
| Discord mostra "Invalid OAuth2 redirect_uri" | O redirect cadastrado no Discord não é idêntico à URL do site + `/api/auth/discord/callback`. |
| `/api/status` mostra `d1_not_configured` ou `schemaReady: false` | O `database_id` do `wrangler.jsonc` não foi trocado, ou faltou rodar `migrations apply DB --remote`. |
| Deploy falha logo no início | Confira Root directory = `P26-2A-3195-12EC-5382-8226` e Build output = `public`. |
| PowerShell bloqueia `npm`/`npx` | Use `npm.cmd` e `npx.cmd`. |
