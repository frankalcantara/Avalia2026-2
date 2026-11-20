# Almoxarifado de Eletrônica

- **Chave Única:** `P26-2A-0230-5AEE-4FAA-3480`
- **Turma:** `2A`
- **URL_CLOUDFLARE:** Preencher com a URL pública real depois da publicação.

Sistema para acompanhar o estoque de placas, sensores, componentes e ferramentas de um laboratório acadêmico. Após a autenticação com Discord, o usuário pode consultar o saldo disponível, registrar retiradas e devoluções e acompanhar as últimas movimentações. A aba **Estoque Crítico** sinaliza itens cujo saldo é menor ou igual ao limite mínimo configurado, inclusive quando chega a zero.

## Como funciona

- `public/` contém a interface em HTML, CSS e JavaScript puro.
- `functions/` contém as rotas de autenticação Discord OAuth2 e a API de estoque. A identidade de cada movimentação vem da sessão do servidor.
- `migrations/` cria as tabelas no Cloudflare D1 e carrega um catálogo inicial demonstrativo. Os nomes, localizações, saldos iniciais e limites mínimos são dados de exemplo. O limite de cada item fica na coluna `minimum_quantity` da tabela `items`.
- Uma retirada reduz o saldo e uma devolução aumenta o saldo. O D1 registra o ID do item, o tipo, a quantidade, o `user_id` do Discord e a data e hora UTC. A atualização do saldo e a gravação da movimentação ocorrem de forma atômica. Uma retirada acima do saldo é recusada, e repetir a mesma solicitação com o mesmo identificador mantém apenas um registro.
- `AGENTS.md` e `skills/` documentam o trabalho dos agentes e as instruções utilizadas. `LICENSE` contém a licença MIT.

## 1. Preparar o fork no computador do laboratório

No [repositório oficial](https://github.com/frankalcantara/Avalia2026-2), clique em **Fork** e mantenha o fork público. No PowerShell, substitua `SEU-USUARIO` pelo seu usuário do GitHub e execute os comandos abaixo.

```powershell
node -v
git --version
git clone https://github.com/SEU-USUARIO/Avalia2026-2.git
cd Avalia2026-2
node iniciar.mjs P26-2A-0230-5AEE-4FAA-3480
```

Se `node` não estiver no PATH do PowerShell do laboratório, execute `$env:PATH = "$env:USERPROFILE\scoop\shims;$env:PATH"` e repita `node -v`. Se o gerador solicitar confirmação do sorteio, siga o link oficial recebido por e-mail e execute o comando novamente.

Se recebeu o projeto em ZIP, extraia-o e copie o **conteúdo** da pasta `P26-2A-0230-5AEE-4FAA-3480` extraída para o **interior** da pasta de mesmo nome que o gerador criou no fork. Substitua os arquivos de exemplo e mantenha o `LICENSE` criado pelo gerador, que inclui a identificação oficial do estudante. Ao final, o caminho de `index.html` deve ser `Avalia2026-2/P26-2A-0230-5AEE-4FAA-3480/public/index.html`.

## 2. Verificar localmente

Na pasta do projeto, use Node.js 22.13 ou mais recente e execute os comandos abaixo.

```powershell
cd P26-2A-0230-5AEE-4FAA-3480
node --test
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler pages dev public --port 8788
```

Abra `http://localhost:8788`. Para testar login real localmente, crie um aplicativo no [Discord Developer Portal](https://discord.com/developers/applications), cadastre `http://localhost:8788/api/auth/discord/callback` em **OAuth2 → Redirects** e crie um arquivo `.dev.vars` na pasta do projeto com os campos abaixo. Reinicie o Wrangler depois de criá-lo.

```dotenv
DISCORD_CLIENT_ID=ID_DO_APLICATIVO
DISCORD_CLIENT_SECRET=SEGREDO_DO_APLICATIVO
SESSION_SECRET=CHAVE_ALEATORIA_PARA_ASSINAR_A_SESSAO
```

Gere o `SESSION_SECRET` com o comando abaixo. Mantenha `.dev.vars`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` fora do GitHub.

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

## 3. Criar o D1 e publicar no Cloudflare Pages

Dentro da pasta do projeto, autentique-se no Cloudflare e crie o banco com os comandos abaixo.

```powershell
npx.cmd wrangler login
npx.cmd wrangler d1 create db-p26-2a-0230-5aee-4faa-3480
```

Copie somente o `database_id` retornado e substitua o UUID zerado em `wrangler.jsonc`. O binding deve ficar com o nome `DB`. Em seguida, aplique as migrações remotas e envie os arquivos ao fork.

```powershell
npx.cmd wrangler d1 migrations apply DB --remote
cd ..
git add P26-2A-0230-5AEE-4FAA-3480
git commit -m "Implementa almoxarifado de eletrônica"
git push origin main
```

No [painel da Cloudflare](https://dash.cloudflare.com/), entre em **Workers & Pages**, escolha **Pages → Connect to Git** e selecione seu fork. Preencha os campos conforme a tabela.

| Campo | Valor |
| --- | --- |
| Project name | `p26-2a-0230-5aee-4faa-3480` |
| Production branch | `main` |
| Framework preset | `None` |
| Root directory | `P26-2A-0230-5AEE-4FAA-3480` |
| Build command | Deixe em branco |
| Build output directory | `public` |

O `wrangler.jsonc` versionado configura o binding `DB`. Depois de publicar, confira em **Settings → Bindings** se ele aponta para o D1 criado. Caso precise escolher outro nome para o projeto Pages, atualize também o campo `name` no `wrangler.jsonc`.

No aplicativo do Discord, adicione o redirecionamento público em **OAuth2 → Redirects**. Use o endereço escolhido pelo Cloudflare, seguido exatamente de `/api/auth/discord/callback`. Use o formato do exemplo abaixo.

```text
https://<projeto>.pages.dev/api/auth/discord/callback
```

Em **Settings → Variables and Secrets** do Cloudflare Pages, configure `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e um `SESSION_SECRET` aleatório próprio para produção. Marque os dois segredos como **Secret**. Faça um novo deploy após salvar e use o endereço de produção para o teste de login.

## 4. Demonstrar e entregar

1. Entre pelo Discord e confirme que aparecem o nome de usuário, o avatar e o ID. No catálogo inicial, o **ESP32 DevKit V1** tem saldo de 12 unidades e limite mínimo de 4.
2. Retire 8 unidades do ESP32 e confira o saldo de 4. O item deverá aparecer na aba **Estoque Crítico** e a retirada deverá aparecer no histórico. Devolva as 8 unidades e confira se o saldo voltou a 12 e se a devolução consta no histórico. A auditoria completa fica no D1 e a interface exibe as últimas 50 operações.
3. Substitua o campo `URL_CLOUDFLARE` deste README pelo endereço público efetivo, começando com `https://`.
4. Na raiz do fork, rode o validador e envie a atualização com os comandos abaixo.

```powershell
node validar-local.mjs P26-2A-0230-5AEE-4FAA-3480
git add P26-2A-0230-5AEE-4FAA-3480
git commit -m "Atualiza URL pública do projeto"
git push origin main
```

5. Abra o Pull Request com destino a `frankalcantara/Avalia2026-2:main` e com origem no `main` do seu fork. Em **Files changed**, confirme que a única pasta alterada é `P26-2A-0230-5AEE-4FAA-3480`.
6. Poste no AVA a URL pública do Cloudflare Pages e a URL do seu repositório no GitHub.

## Referências

- [Instruções e rubrica da disciplina](https://github.com/frankalcantara/Avalia2026-2)
- [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/get-started/)
- [Migrações D1](https://developers.cloudflare.com/d1/reference/migrations/)
- [Discord OAuth2](https://discord.com/developers/docs/topics/oauth2)
