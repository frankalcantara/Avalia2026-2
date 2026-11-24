# Testes da etapa 4

Execução local em 20 de novembro de 2026 pelo subagente `testes`, com a skill `testes-referencias` e a orientação de prévia local de `sites:sites`. Ambiente Windows, Node.js 26.13.1, SQLite de teste e Chrome headless 157.0.8103.79.

```powershell
node --test tests/*.test.mjs
```

Resultado observado — **26 aprovações e zero falhas**. A contagem inclui quatro casos diretos de OAuth e migração, um cenário OAuth em navegador e 21 casos de regressão da etapa 3. Os prefixos SHA-256 da versão testada são `1175279B0C94` (HTML), `58DD9A6D2245` (app), `4C0D0E7A86E4` (handler), `6AE0C7AD4EEB` (OAuth), `7962F13742C4` (sessão) e `2E7B68F1CB63` (migração OAuth).

| Verificação | Resultado esperado | Resultado observado |
| --- | --- | --- |
| Início e callback | O início redireciona para o Discord com Authorization Code, `identify`, `state` e PKCE S256. O callback usa o verifier correspondente. | O handler respondeu `302`, o hash do verifier coincidiu com o challenge e o callback autorizou o usuário com `303` para a página inicial. |
| Identidade Discord | Guardar ID, username e avatar, com ID local estável. Atualizar o perfil quando o mesmo usuário voltar. | O SQLite guardou `discord_id` e `discord_username`. O perfil usou nome global ou username e a URL de avatar ou o avatar padrão. Novos dados da mesma conta atualizaram o perfil sem criar outro usuário nem separar seus projetos. |
| Sessão e rotação | Emitir cookie protegido, guardar o hash, revogar a sessão anterior no novo login e recusar sessões expirada ou revogada. | Os cookies apresentaram `HttpOnly`, `Secure`, `SameSite=Lax` e `Path=/`, sem `Domain`. O token permaneceu no cookie e o SQLite guardou seu hash. A rotação invalidou a sessão anterior. Após logout, projeto protegido retornou `401`. A consulta de sessão expirada retornou `{ user: null }`. |
| Cancelamento e validade da tentativa | Rejeitar tentativa expirada, consumida ou sem cookie de vínculo. Cancelamento volta sem criar sessão. | As tentativas expiradas, repetidas e sem vínculo voltaram como inválidas sem chamar o provedor. O cancelamento retornou `auth=cancelled` e nenhuma sessão foi criada. |
| Configuração e falha do provedor | O app continua anônimo quando o ambiente está incompleto ou a troca do código falha. | Segredo ausente, origem de callback divergente e HTTP resultaram em `auth=unavailable`, sem tentativa criada. A falha simulada na troca do código retornou `auth=failed` sem criar sessão. |
| Migração de base existente | A migração OAuth preserva usuário e sessão criados antes da nova coluna. | Um usuário e uma sessão inseridos antes da migração continuaram válidos. A coluna `discord_username` começou vazia para o usuário preexistente. |
| Login e proteção no navegador | A interface deixa a área de trabalho oculta sem sessão, exibe perfil após o login e permite criar projeto. Outra conta não tem acesso ao projeto. | O Chrome em HTTPS local percorreu a ida e o retorno do login, recebeu os cookies da aplicação, mostrou nome e avatar e criou um projeto pelo formulário. A segunda conta recebeu lista vazia e `404` ao tentar abrir o projeto da primeira. Logout e expiração voltaram a ocultar o workspace. O cancelamento e a configuração ausente mostraram o feedback esperado. |

O teste em navegador usa certificado temporário local do OpenSSL e aceita somente a chave pública desse certificado no perfil de teste. Para instalações fora dos caminhos usuais do Windows, indique o executável do Chromium com `CHROME_PATH` e o OpenSSL com `OPENSSL_PATH`. O mock substitui autorização, token, identidade e avatar do Discord. As requisições ao app passam pelo código real e pelo adaptador SQLite, que aplica as duas migrações. O navegador recebe a sessão do callback. Credenciais reais e deploy ficaram fora desta execução.

## Roteiro manual pendente com Discord e Cloudflare

1. Em um ambiente de teste autorizado, use uma aplicação Discord de teste e registre exatamente a URL HTTPS do ambiente seguida de `/api/auth/discord/callback`. Configure o identificador e a URI de retorno no ambiente e o segredo OAuth no armazenamento privado de secrets. Aponte o binding `DB` para o banco de teste e aplique as migrações nesse banco. Para executar com Wrangler local, consulte a configuração do projeto. [Configuração do projeto](plano-backend.md) · [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2) · [Bindings das Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/).
2. Em perfil anônimo, confirme que a tela oferece **Entrar com Discord** e oculta a área de trabalho. Cancele na página do Discord e confira que o app retorna à tela pública com a mensagem correspondente.
3. Autorize com a primeira conta de teste. Confira nome e avatar, crie um projeto e uma referência e recarregue a página. Confirme o acesso ao projeto e a persistência da referência.
4. Saia pelo botão **Sair** e confirme que a listagem protegida retorna `401`. Entre com a segunda conta em perfil separado e confira que ela vê somente seus projetos. Ao consultar o ID do projeto de teste da primeira conta, a API deve responder `404`.
5. Registre data, ambiente e resultado observado de cada passo, omitindo cookies, códigos, tokens e segredos. Esse roteiro cobre as verificações pendentes no Discord real e no runtime Pages/D1.
