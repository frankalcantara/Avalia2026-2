# Configurar o login do Discord

Esta etapa precisa ser feita pelo titular da conta. Não envie o Client Secret no chat nem publique esse valor no GitHub.

1. Entre em https://discord.com/developers/applications com sua conta Discord.
2. Clique em **New Application**, use o nome **EntreLivros — Projeto 24** e conclua a criação. Leia e aceite pessoalmente os termos apresentados.
3. Abra **OAuth2**. Em **Redirects**, adicione estas duas URLs exatas e salve:
   - `http://127.0.0.1:8788/api/auth/discord/callback`
   - `https://entrelivros-rennan.pages.dev/api/auth/discord/callback`.
4. Copie o **Client ID**. Gere/copie o **Client Secret** na área OAuth2. Não é necessário criar bot, adicionar bot em servidor ou solicitar escopo de e-mail.
5. Abra o arquivo `.dev.vars` na pasta do projeto (mesmo nível do README) e preencha:

   ```dotenv
   DISCORD_CLIENT_ID=valor_do_client_id
   DISCORD_CLIENT_SECRET=valor_do_client_secret
   ```

6. Salve o arquivo. Ele está excluído do Git pelo `.gitignore`. Avise no chat apenas que o arquivo foi preenchido, sem copiar os valores.
7. As mesmas credenciais precisam ser cadastradas como segredos no Cloudflare Pages. Essa configuração poderá ser realizada pela ferramenta de publicação sem mostrar os valores.

O login só estará validado após um acesso real pelo Discord no endereço publicado. Para testar empréstimos e trocas, use duas contas Discord distintas, por exemplo a sua e a de um colega que concorde em participar.
