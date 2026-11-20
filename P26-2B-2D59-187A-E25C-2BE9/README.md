# Almoxarifado do Laboratório de Hardware

- **Projeto:** #37 — Controle de Inventário de Laboratório de Hardware
- **Chave de auditoria:** `P26-2B-2D59-187A-E25C-2BE9`
- **Repositório:** https://github.com/Giovanemerotto/Avalia2026-2
- **URL pública:** pendente de configuração e deploy no Cloudflare Pages.

Aplicação para controlar materiais de laboratório. É possível entrar pelo Discord ou criar uma conta com e-mail e senha, consultar o estoque, registrar retiradas e devoluções e ver quais itens precisam ser repostos. Usuários autenticados também podem cadastrar materiais com quantidade, código numérico gerado pelo sistema e nome do agente responsável.

O frontend usa HTML, CSS e JavaScript puros; as regras e a persistência ficam nas Cloudflare Pages Functions e no D1.

## Desenvolvimento local

1. Instale Node.js 18+ e Wrangler (`npm.cmd install --global wrangler`).
2. Na pasta deste projeto, aplique a migração no D1 local e inicie as Pages Functions:

   ```powershell
   npx.cmd wrangler d1 migrations apply db-p26-2b-2d59-187a-e25c-2be9 --local
   npx.cmd wrangler pages dev public
   ```

3. Configure `SESSION_SECRET` no arquivo local `.dev.vars` para habilitar sessões. O login com e-mail e senha não depende de credenciais do Discord. Para também testar OAuth, adicione as duas variáveis do Discord e cadastre `http://localhost:8788/api/auth/discord/callback` como Redirect URI no Discord Developer Portal.

Não há usuário de demonstração: tanto o estoque quanto o cadastro de materiais exigem uma sessão autenticada.

## Publicação no Cloudflare Pages e D1

1. No Cloudflare, crie um banco D1 e copie o `database_id` real para `wrangler.jsonc`, substituindo o valor zerado.
2. Aplique o esquema e os dados iniciais:

   ```powershell
   npx.cmd wrangler d1 migrations apply db-p26-2b-2d59-187a-e25c-2be9 --remote
   ```

3. Conecte o fork ao Cloudflare Pages, usando esta pasta como **Root directory**, sem comando de build e `public` como diretório de saída. Associe o banco ao binding `DB`.
4. Crie uma aplicação no [Discord Developer Portal](https://discord.com/developers/applications). Cadastre como Redirect URI `https://SEU-DOMINIO/api/auth/discord/callback`.
5. Configure `DISCORD_CLIENT_ID` como variável e `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` como secrets no ambiente do Pages. Gere um segredo de sessão forte, por exemplo com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Não coloque secrets no Git.
6. Publique o projeto. Substitua a URL pública acima pela URL real e inclua as URLs do projeto e do repositório no AVA da instituição.

Para desenvolvimento local, use os mesmos nomes em `.dev.vars` (arquivo local, nunca versionado):

```dotenv
SESSION_SECRET=seu_segredo_aleatorio_de_32_bytes_ou_mais
DISCORD_CLIENT_ID=seu_client_id
DISCORD_CLIENT_SECRET=seu_client_secret
```

As duas variáveis do Discord são opcionais para o login por e-mail e senha. Nunca compartilhe nem publique valores secretos.

## Validação

Execute os testes automatizados e, na raiz do repositório, o validador estrutural:

```powershell
node --test P26-2B-2D59-187A-E25C-2BE9\tests\*.test.mjs
node validar-local.mjs P26-2B-2D59-187A-E25C-2BE9
```

O teste online do validador só será aprovado depois de o deploy estar público e a URL real ser registrada neste README.
