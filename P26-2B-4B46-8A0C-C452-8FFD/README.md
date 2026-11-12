# Projeto #2 — Termo Diário

- **Estudante:** Pedro Alexandre Zanetti, turma 2B
- **Chave Única:** `P26-2B-4B46-8A0C-C452-8FFD`
- **URL_CLOUDFLARE:** pendente de publicação

Descubra a palavra de cinco letras em até seis tentativas. A partida abre após o login com Discord e vira à meia-noite de São Paulo. O servidor valida cada palpite e usa o D1 para restaurar o tabuleiro ao recarregar e calcular as estatísticas.

## Rodar e publicar

Use Node.js e execute os comandos a partir desta pasta. No PowerShell do laboratório, use `npx.cmd` se o PowerShell bloquear `npx`.

1. Rode `npx wrangler login` e autorize no navegador.
2. Crie o banco com `npx wrangler d1 create db-p26-2b-4b46-8a0c-c452-8ffd`. Copie o UUID devolvido para `database_id` no `wrangler.jsonc`.
3. Aplique o esquema com `npx wrangler d1 migrations apply DB --remote`. Para desenvolvimento local, use `--local` no lugar de `--remote` e inicie com `npx wrangler pages dev public`.
4. No Cloudflare Pages, conecte o fork ao GitHub, escolha a branch com o projeto, informe `P26-2B-4B46-8A0C-C452-8FFD` como diretório raiz e `public` como diretório de saída. Deixe vazio o comando de build. Use o nome `termo-pedro-8ffd` ou atualize `name` no Wrangler para corresponder ao nome escolhido.
5. No [Discord Developer Portal](https://discord.com/developers/applications), crie uma aplicação e, em **OAuth2 → Redirects**, cadastre o endereço público do Pages seguido de `/api/auth/discord/callback`. Para testar localmente, cadastre também `http://localhost:8788/api/auth/discord/callback`.
6. Nas configurações do Pages, defina `DISCORD_CLIENT_ID` (Client ID) e `APP_ORIGIN` (origem HTTPS da aplicação, sem caminho). Adicione os segredos `DISCORD_CLIENT_SECRET`, `SESSION_SECRET` e `DAILY_WORD_SECRET`. Para os dois últimos, execute duas vezes `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` para gerar valores independentes. Para uso local, configure os valores em `.dev.vars`, ignorado pelo Git.
7. Faça um novo deploy, verifique o login e uma partida real, e preencha `URL_CLOUDFLARE` acima com o endereço verificado.

## Testes

Com Node.js 22.13 ou superior, rode `node --test tests/termo.test.mjs`. Os testes usam SQLite local e simulam a resposta do Discord. O login real deve ser conferido também no endereço publicado.

## Entrega

Da raiz do fork, rode `node validar-local.mjs P26-2B-4B46-8A0C-C452-8FFD`. Abra o pull request para `frankalcantara/Avalia2026-2` com alterações apenas nesta pasta. Publique no AVA a URL do jogo e a URL do repositório público.

Consulte [AGENTS.md](AGENTS.md) para a descrição do trabalho dos agentes. Licença [MIT](LICENSE).
