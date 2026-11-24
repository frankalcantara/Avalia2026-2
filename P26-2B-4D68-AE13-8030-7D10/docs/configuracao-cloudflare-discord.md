# Configuração Cloudflare, D1 e Discord

> **Schema e comandos:** o projeto não tem dependências, scripts de banco nem Wrangler. O schema completo do D1, tabela por tabela, está em [schema-d1-e-orientacoes.md](./schema-d1-e-orientacoes.md) e em [`../schema.sql`](../schema.sql). O banco é criado e vinculado pelo painel da Cloudflare.

Siga os passos na ordem. Eles indicam quais valores são necessários e exatamente onde configurá-los para publicar o blog.

## 1. Criar o projeto Cloudflare Pages

1. Abra o painel da Cloudflare e acesse **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Selecione o repositório Git onde está o projeto.
3. Configure o build:
   - **Project name:** escolha o nome do seu projeto Cloudflare Pages.
   - **Production branch:** selecione a branch que será publicada.
   - **Root directory (advanced):** `P26-2B-4D68-AE13-8030-7D10`
   - **Build command:** deixe em branco.
   - **Build output directory:** `public`
4. Salve a configuração do projeto. O deploy já pode ser feito: sem arquivo de configuração de Wrangler, o Pages usa exatamente os valores acima e não há UUID de banco para validar. O site sobe, e o banco é associado no passo 4.
5. Se o painel ainda não mostrar a URL `pages.dev`, tudo bem: você poderá encontrá-la após o primeiro deploy. Não é necessário ter a URL nem cadastrar o callback do Discord para publicar pela primeira vez.

## 2. Criar o banco D1

1. No painel, abra **Workers & Pages** → **D1** → **Create database**.
2. Use o nome `db-p26-2b-4d68-ae13-8030-7d10` e confirme na **mesma conta Cloudflare** que hospeda o projeto Pages.
3. **Não** copie o UUID do banco para o repositório. Ele não é usado por nenhum arquivo do projeto e era justamente o valor que derrubava o deploy com `Error 8000022`.

## 3. Criar as tabelas pelo Console do D1

1. Abra o banco criado → aba **Console**.
2. Cole o conteúdo de [`../schema.sql`](../schema.sql) (ou o bloco da seção 2 de [schema-d1-e-orientacoes.md](./schema-d1-e-orientacoes.md)) e clique em **Execute**.
3. Se o Console aceitar apenas um comando por vez, execute os `CREATE TABLE` na ordem do arquivo (usuários → salas → artigos → comentários → comunidade) e depois os índices.
4. Confira com:

   ```sql
   SELECT name, type FROM sqlite_master
   WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'
   ORDER BY type, name;
   ```

   Esperado: 12 tabelas e 9 índices.

Não há comando de terminal envolvido: o schema está documentado e é aplicado direto no Console do D1.

## 4. Associar o banco ao projeto Pages

1. **Workers & Pages** → selecione seu projeto Pages → **Settings** → **Bindings** → **Add** → **D1 database bindings**.
2. **Variable name:** `DB` (o nome diferencia maiúsculas de minúsculas; o código lê `env.DB`).
3. **D1 database:** selecione `db-p26-2b-4d68-ae13-8030-7d10`.
4. Salve e **refaça o deploy** para o binding valer em produção. Repita em **Preview** se quiser que os previews também usem o banco.

O binding vive no painel; o projeto não tem arquivo de configuração de Wrangler. Se algum arquivo com `database_id` for reintroduzido, o Pages volta a validar o UUID em cada deploy.

## 5. Criar a aplicação OAuth2 no Discord

1. Abra o [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique em **New Application**, dê um nome e crie a aplicação.
3. Abra **OAuth2** e copie o **Client ID**.
4. Ainda em **OAuth2**, procure o **Client Secret** e copie-o. Se ainda não houver um, use a opção para gerar/redefinir o secret. Trate-o como senha; não o publique.
5. Salve a aplicação. **Não precisa cadastrar o Redirect URL agora** se ainda não conhece o domínio Pages; isso não impede o primeiro deploy.

## 6. Gerar o segredo da sessão

No PowerShell, execute:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Copie o valor aleatório impresso. Ele será o `SESSION_SECRET`. Gere um valor próprio; não reutilize o exemplo de outra pessoa, não o envie no chat e não o coloque em arquivos versionados.

## 7. Configurar as credenciais do Discord

O projeto usa três valores de autenticação. O código os lê de `env.DISCORD_CLIENT_ID`, `env.DISCORD_CLIENT_SECRET` e `env.SESSION_SECRET`.

| Nome | Para que serve | É secreto? |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | Identifica a aplicação Discord no início do OAuth2 | Não, mas configure-o como variável |
| `DISCORD_CLIENT_SECRET` | Permite trocar o código OAuth2 por um token | Sim; configure-o como Secret |
| `SESSION_SECRET` | Assina e valida os cookies de sessão | Sim; configure-o como Secret |

**Atenção:** o **Client Secret** não é a **Public Key**. A Public Key serve para validar assinaturas de interações enviadas pelo Discord; este blog usa OAuth2 para login e precisa do Client Secret para trocar o código de autorização por um token. Portanto, não cole a Public Key no campo `DISCORD_CLIENT_SECRET`.

### Testes locais

O projeto não tem Wrangler nem servidor local de Pages: as Functions só rodam no runtime da Cloudflare. O que roda na sua máquina são os testes unitários, que simulam o D1 e não precisam de banco, nem de variáveis:

```powershell
npm test
```

Se quiser rodar `npm run test:e2e` (opcional), ele precisa de um servidor de Pages local e de um `SESSION_SECRET` no `.env` (copie `.env.example` e preencha os três valores). O `.env` está ignorado pelo Git, é apenas local e não configura o site publicado. Para o login real, use o site publicado no Cloudflare Pages.

### Para publicar no Cloudflare Pages

O `.env` **não é enviado ao Cloudflare e não configura o site publicado**. Configure os mesmos valores separadamente no painel:

1. Acesse **Workers & Pages** → selecione seu projeto Pages → **Settings** → **Variables and Secrets**.
2. Selecione o ambiente **Production** e adicione:
   - `DISCORD_CLIENT_ID` como **Variable / texto**.
   - `DISCORD_CLIENT_SECRET` como **Secret**, copiando o Client Secret do Discord.
   - `SESSION_SECRET` como **Secret**, copiando o segredo gerado no passo 6.
3. Salve. Depois de concluir a configuração, faça o primeiro deploy ou publique novamente para aplicar os valores.

Para autenticação em **Preview deployments**, repita a configuração no ambiente **Preview** e autorize no Discord a URL exata do callback daquele domínio.

**Nunca** coloque `DISCORD_CLIENT_SECRET` ou `SESSION_SECRET` em `public/`, em JavaScript/HTML, em commits ou em mensagens públicas. O binding do banco (`DB`) é configurado nas **Bindings** do painel, não no `.env`.

## 8. Conferir os endereços e testar

1. Depois do primeiro deploy, encontre a URL em **Cloudflare → Workers & Pages → seu projeto Pages → Overview** ou abra o domínio `pages.dev` indicado na página do deploy. Copie o domínio exato, por exemplo `https://nome-real-do-projeto.pages.dev`.
2. No Discord Developer Portal, abra sua aplicação → **OAuth2** → **Redirects** e adicione o callback usando o domínio copiado:

   ```text
   https://SEU-DOMINIO-PAGES.pages.dev/api/auth/discord/callback
   ```

   Salve a alteração no Discord. O domínio, o `https://` e o caminho `/api/auth/discord/callback` precisam corresponder exatamente. O código monta esse endereço a partir do domínio que recebeu a solicitação, então não invente uma URL. Cadastrar o callback depois do deploy não exige publicar o Pages novamente.
3. Abra a URL Pages e clique em **Entrar com Discord**. Autorize o acesso básico de identidade.
4. Entre com Discord, publique um artigo e, se necessário, teste comentários, curtidas e criação de sala.
5. Atualize o campo `URL_CLOUDFLARE` no início do `README.md` se o domínio real for diferente do exemplo registrado nele.
6. Na raiz do repositório (a pasta que contém `P26-2B-4D68-AE13-8030-7D10/`), rode a pré-validação local:

   ```powershell
   node validar-local.mjs P26-2B-4D68-AE13-8030-7D10
   ```

## Se algo falhar no deploy

- `Error 8000022: Invalid database UUID` — alguém adicionou um arquivo de configuração de Wrangler com `database_id`. Apague o arquivo e configure o binding apenas em **Settings → Bindings**. Depois, refaça o deploy.
- `Functions published` falhou por outro motivo — leia o primeiro erro do log; assets publicados com funções falhando são problemas diferentes.
- `/api/health` responde `database: "missing"` — o binding `DB` não foi criado ou o deploy não foi refeito depois de criá-lo.
- `/api/health` responde `no such table` — o schema do passo 3 não foi aplicado no banco remoto.
- `no such table: main.<tabela>` ao criar um índice no Console — o `CREATE TABLE` daquela tabela não foi aplicado na mesma execução (script grande cortado). Rode o `CREATE TABLE` sozinho e depois o índice dele; os comandos usam `IF NOT EXISTS` e podem ser repetidos.

## Valores a configurar — resumo

- **No painel Cloudflare → D1:** o banco `db-p26-2b-4d68-ae13-8030-7d10` com o schema de [`../schema.sql`](../schema.sql) aplicado pelo Console.
- **No painel Cloudflare → Pages → Settings → Bindings:** binding D1 `DB` apontando para esse banco.
- **No Discord Developer Portal → OAuth2 → Redirects, depois do primeiro deploy:** a URL Pages real com `/api/auth/discord/callback`.
- **No Cloudflare Pages → Settings → Variables and Secrets → Production (e Preview, se usar):**
  - `DISCORD_CLIENT_ID` como variável.
  - `DISCORD_CLIENT_SECRET` como secret.
  - `SESSION_SECRET` como secret aleatório com pelo menos 32 caracteres.
- **No Cloudflare Pages → Build configuration:** root `P26-2B-4D68-AE13-8030-7D10`, build command vazio e output `public`.
