# Projeto #39: Construtor de Portfólio e Currículo Acadêmico

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Eduardo Augusto Teresin Ferreira
- **Turma:** 2B
- **Chave Única:** `P26-2B-924C-3BB5-F4E1-8DAC`
- **URL_CLOUDFLARE:** https://projeto-p26-2b-924c-3bb5-f4e1-8dac.pages.dev

---

## Especificação do Projeto

Desenvolva uma aplicação na qual o estudante preenche seus dados profissionais, formação, projetos desenvolvidos, habilidades técnicas e links de repositórios em formulários estruturados. O login via OAuth2 do Discord garante que o aluno possa editar e manter suas informações atualizadas no banco Cloudflare D1 ao longo do curso.

O diferencial do projeto no frontend é um motor de visualização em tempo real com seletor de temas CSS (ex: layout Clássico, Moderno em duas colunas, ou Minimalista). Além de gerar uma rota pública compartilhável (seu-app.pages.dev/?user=id) que renderiza o currículo lendo os dados da API, o sistema deve configurar regras CSS @media print para exportação direta em PDF nativo pelo navegador.

---

## Executar localmente

Use Node.js 22.13 ou superior. Os comandos abaixo executam a versão 4.165.0 do Wrangler e usam o banco D1 local. No PowerShell do laboratório, use `npx.cmd` no lugar de `npx`. [Desenvolvimento local no Pages](https://developers.cloudflare.com/pages/functions/local-development/)

```sh
cd P26-2B-924C-3BB5-F4E1-8DAC
npx --yes wrangler@4.165.0 d1 migrations apply DB --local
npx --yes wrangler@4.165.0 pages dev public --port 8788
```

Abra `http://localhost:8788`. Para testar o login real, crie uma aplicação no Discord, permita o redirecionamento exato `http://localhost:8788/api/auth/discord/callback` e preencha o arquivo local `.dev.vars` antes de iniciar o Wrangler. Mantenha o segredo fora do Git. Para testar a autenticação no ambiente publicado, use um callback registrado no domínio final com HTTPS. [Portal de Desenvolvedores do Discord](https://discord.com/developers/applications)

```dotenv
DISCORD_CLIENT_ID="ID_DA_APLICACAO"
DISCORD_CLIENT_SECRET="SEGREDO_DA_APLICACAO"
```

A aplicação usa o Discord para autenticar o proprietário do currículo. Preencha as seções, ajuste o tema e confira a prévia enquanto edita. Para compartilhar, habilite a publicação, salve o currículo e copie o link `/?user=id`. Para exportar, clique em **Exportar PDF** e selecione **Salvar como PDF** na janela de impressão do navegador.

## Testes

Na pasta P26, execute os testes dos endpoints e do navegador. A suíte de API usa SQLite em memória e simula as respostas do Discord. A suíte do navegador usa Playwright com uma instalação de Chromium e verifica a edição e a publicação completas, incluindo a impressão.

```sh
node --test tests/api.test.mjs tests/browser.test.mjs
```

No Codex Cloud, Playwright e Chromium já estão disponíveis. Em outro ambiente Linux, se Playwright não estiver disponível, instale-o localmente e ajuste o caminho do Chromium antes de executar a suíte do navegador.

```sh
npm_config_cache="$PWD/.npm-cache" npm install --prefix .local --no-save --no-package-lock playwright@1.62.1
NODE_PATH="$PWD/.local/node_modules" CHROMIUM_PATH=/caminho/do/chromium node --test tests/browser.test.mjs
```

Na raiz do repositório, o verificador oficial checa a estrutura exigida e a URL pública quando ela estiver cadastrada.

```sh
node validar-local.mjs P26-2B-924C-3BB5-F4E1-8DAC
```

## Configurar a publicação

A publicação e o push dependem de autorização explícita do proprietário. Para o PR final, siga a [política de autorização exclusiva do proprietário](AGENTS.md#autorização-exclusiva-do-proprietário).

1. No Cloudflare Pages, selecione o fork `Avalia2026-2` via **Workers & Pages → Create → Pages → Connect to Git**. Configure a raiz como `P26-2B-924C-3BB5-F4E1-8DAC`, deixe o comando de build vazio e use `public` como diretório de saída.
2. A partir da subpasta do projeto, crie o banco D1. Copie o ID retornado para `database_id` no `wrangler.jsonc`. Use no arquivo o nome do projeto que você cadastrou no Pages.

   ```sh
   npx --yes wrangler@4.165.0 d1 create db-p26-2b-924c-3bb5-f4e1-8dac
   npx --yes wrangler@4.165.0 d1 migrations apply DB --remote
   ```
3. Confira no painel do Pages que o binding `DB` aponta para o banco correto. Confira também a configuração de produção no `wrangler.jsonc`. [Configuração do Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
4. No Discord, registre o endereço HTTPS de produção seguido de `/api/auth/discord/callback`. Nas configurações do Pages, defina `DISCORD_CLIENT_ID` e adicione `DISCORD_CLIENT_SECRET` como segredo.
5. Após confirmar o funcionamento público, preencha `URL_CLOUDFLARE` acima e execute o validador oficial outra vez. O requisito de publicação da rubrica depende de um endereço funcionando.
