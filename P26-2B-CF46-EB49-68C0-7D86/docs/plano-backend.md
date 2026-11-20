# Plano de backend do Projeto #23

O plano propõe Cloudflare Pages Functions e Cloudflare D1 para a API e Discord OAuth2 para a identidade. As seções de contrato e OAuth2 descrevem o comportamento implementado nas etapas 3 e 4. As seções de planejamento registram a proposta de arquitetura e o trabalho futuro.

## Contrato implementado na etapa 3

- `GET /api/projects/{projectId}/bibliography` exige sessão válida e propriedade do projeto. A resposta tem `style` (`abnt` ou `ieee`), `entries` na ordem compilada e `text` para cópia. Cada item de `entries` contém `id`, `parts` (segmentos com `text` e `italic`) e `text` em texto simples. O texto integral une as referências com uma quebra LF e preserva a pontuação. O grifo está nos segmentos usados pela interface e é omitido na cópia em texto simples. Um projeto vazio retorna `entries: []` e `text: ""`. Sessão ausente retorna `401` e projeto ausente ou de outro proprietário retorna `404`.
- O compilador ordena em pt-BR pelo sobrenome do primeiro autor ou pelo título quando a autoria estiver ausente. Aplica ordem por letra-base, acento e caixa com minúsculas primeiro. Desempata pelo título e pelo ID. O IEEE recebe a numeração depois dessa ordenação, conforme a regra alfabética do projeto. O sistema não recebe a ordem de citação no corpo do trabalho.
- `PATCH` mescla campos sobre o registro lido e verifica no banco se o conteúdo de partida ainda corresponde ao registro atual. Quando outro pedido alterou esse conteúdo, retorna `409` com `error.code: "concurrent_update"`. O cliente pode recarregar os dados e reenviar a alteração. A troca de estilo do projeto mantém os campos das fontes e afeta somente a compilação.
- `GET /api/session` retorna `{ user: null }` quando a sessão estiver ausente, inválida, expirada ou revogada. Com sessão válida, retorna `{ user: { id, displayName, avatarUrl } }`. O callback OAuth emite um token aleatório de 32 bytes em base64url sem padding no cookie `__Host-p23_session`, com `Path=/; HttpOnly; Secure; SameSite=Lax` e sem `Domain`. O D1 armazena apenas o hash SHA-256 em hexadecimal minúsculo, o ID local, a expiração em Unix epoch segundos e a revogação opcional. As mutações exigem `Origin` igual à origem da API. `POST /api/auth/logout` revoga o registro e limpa o cookie.

## OAuth2 e execução local na etapa 4

A página inicia o login com `GET /api/auth/discord`. A Function cria uma tentativa de dez minutos no D1 e redireciona para o Discord com o escopo `identify` e PKCE S256. O retorno em `GET /api/auth/discord/callback` confere o estado, o cookie do navegador, a expiração e, quando presente, o emissor do Discord. Uma única operação do D1 consome a tentativa. O servidor troca o código, consulta o perfil e grava usuário e sessão atomicamente. Tokens do Discord são usados apenas para obter o perfil. [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2) e [perfil do usuário no Discord](https://docs.discord.com/developers/resources/user#get-current-user).

O aplicativo retorna `303` para `/` no sucesso ou para `/?auth=cancelled`, `/?auth=invalid`, `/?auth=failed` ou `/?auth=unavailable`. A sessão dura sete dias, usa o cookie `__Host-p23_session` e mantém somente o hash do token no D1. O nome de usuário é armazenado em `users.discord_username`. O nome de exibição usa o nome global ou, quando ausente, o nome de usuário. O avatar vem do perfil do Discord. O identificador do Discord é armazenado em `users.discord_id`, enquanto a API expõe o identificador local. O logout revoga a sessão e limpa o cookie.

### Binding e migrações

O arquivo [wrangler.jsonc](../wrangler.jsonc) usa os assets em `public/` e o binding `DB`. Para desenvolvimento local, execute:

```powershell
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler pages dev public --local-protocol https
```

Em uma etapa de publicação autorizada, revise o arquivo para usar o nome do projeto Pages e o banco D1 reais de cada ambiente, e aplique as migrações ao banco correto. Como a configuração inclui `pages_build_output_dir`, a Cloudflare Pages pode adotá-la como fonte de verdade para o deploy. Inclua o identificador real do D1 no arquivo antes de publicar. [Configuração do Wrangler para Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) e [migrações do D1](https://developers.cloudflare.com/d1/reference/migrations/).

### Configuração do Discord

Registre no Discord o URI exato de retorno, com origem HTTPS igual à origem do aplicativo e caminho `/api/auth/discord/callback`. Forneça `DISCORD_CLIENT_ID` e `DISCORD_REDIRECT_URI` como variáveis do ambiente, e `DISCORD_CLIENT_SECRET` como secret do Pages. Em um teste local com uma aplicação Discord autorizada, forneça os valores em `.dev.vars` fora do versionamento e use a mesma origem HTTPS ao abrir a página. Sem essas configurações válidas, o início e o retorno do login redirecionam para `/?auth=unavailable`. [Bindings e secrets de Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/).

## Cloudflare Pages Functions

Organizar os handlers em `functions/api/` na raiz do projeto. Usar middleware sob esse diretório para normalizar erros e identificar a sessão. Exigir autenticação nas rotas protegidas e verificar a propriedade do projeto na operação de dados. Manter a validação bibliográfica, a formatação e a persistência em módulos separados dos handlers. As Functions têm roteamento por arquivo e recebem o binding D1 por `context.env.DB`. [Roteamento das Pages Functions](https://developers.cloudflare.com/pages/functions/routing/) e [bindings das Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/).

| Método e rota | Acesso | Contrato proposto |
| --- | --- | --- |
| `GET /api/auth/discord` | Público | Inicia o fluxo e redireciona ao Discord. |
| `GET /api/auth/discord/callback` | Público | Valida o retorno e redireciona para um caminho fixo do site. |
| `GET /api/session` | Público | Retorna `{ user: null }` ou apenas os dados públicos do usuário atual. |
| `POST /api/auth/logout` | Autenticado | Revoga a sessão atual, limpa o cookie e retorna `204`. |
| `POST /api/preview` | Público | Recebe `style`, `sourceType` e `fields`, valida e retorna `{ text }` sem persistir. |
| `GET /api/projects` e `POST /api/projects` | Autenticado | Lista os projetos do usuário ou cria um com `name` e `style`. |
| `GET`, `PATCH` e `DELETE /api/projects/{projectId}` | Proprietário | Consulta, atualiza ou exclui um projeto. |
| `GET` e `POST /api/projects/{projectId}/references` | Proprietário | Lista em uma ordem acordada ou cria uma referência com `sourceType` e `fields`. |
| `PATCH` e `DELETE /api/projects/{projectId}/references/{referenceId}` | Proprietário | Atualiza ou exclui uma referência do projeto indicado. |

Receber JSON nas requisições com corpo. Padronizar `201` para criação e `204` para remoção. Retornar `400` para JSON malformado, `422` para campos inválidos e `401` para sessão ausente nas rotas protegidas. Responder com `404` quando o recurso estiver ausente ou fora do escopo do usuário. Usar `{ error: { code, message, fields? } }` e devolver erros de campo com chaves que o frontend consiga associar aos controles do formulário. Reservar `429` para requisições limitadas e `5xx` para falhas internas, com mensagem pública genérica.

O servidor deve validar estilos permitidos, campos exigidos por tipo de fonte, comprimentos, valores vazios após limpeza e formatos de data, ano e URL quando aplicáveis. Derivar a propriedade da sessão, ignorando qualquer identidade declarada pelo cliente. Definir limites de corpo e de paginação antes da implementação. Alinhar tipos, nomes de campos e exemplos esperados de ABNT e IEEE com frontend e testes. Guardar os campos estruturados para permitir reformatação quando o estilo mudar e retornar conteúdo formatado como texto.

A interface inicial usa os tipos `book` e `website`, com `author`, `title` e `year`; o livro inclui `publisher` e a página web inclui `url` HTTP(S). Esses controles servem como ponto de partida para revisar o contrato, sobretudo a autoria institucional ou ausente e a data de acesso quando exigida. Antes de integrar, definir a representação de autores e os campos obrigatórios para cada combinação de tipo e estilo.

A interface poderá listar referências alfabeticamente por autoria, com desempate por título e ID. O contrato deverá fixar a localidade, o tratamento de acentos e a alternativa para fontes sem autoria. Separar essa ordem de consulta da ordem normativa de exportação. Para IEEE, a numeração deve acompanhar a ordem de citação quando houver contexto suficiente para determiná-la.

## Cloudflare D1

| Tabela | Campos e restrições principais |
| --- | --- |
| `users` | `id` como chave primária, `discord_id` como texto único e obrigatório, nome de exibição e datas de criação e atualização. |
| `projects` | `id`, `owner_id` obrigatório com chave estrangeira para `users`, `name`, `style` restrito a ABNT ou IEEE e datas de criação e atualização. |
| `bibliographic_references` | `id`, `project_id` obrigatório com chave estrangeira para `projects`, `source_type`, `fields_json` validado no servidor e datas de criação e atualização. |
| `sessions` | Hash único do identificador de sessão, `user_id` com chave estrangeira, validade e data de revogação opcional. |
| `oauth_attempts` | Hash único de `state`, hash do identificador temporário do navegador, verificador PKCE e expiração. O consumo exclui a tentativa. |

Indexar `projects(owner_id, id)`, `bibliographic_references(project_id, id)` e a expiração de sessões e tentativas OAuth. Prever exclusão em cascata de referências quando o proprietário confirmar a exclusão do projeto. Manter a política de exclusão de conta pendente até a definição do ciclo de vida dos dados. Autorizar operações sobre referências pelo vínculo entre referência, projeto e usuário na própria consulta de leitura ou escrita. Usar consultas preparadas com parâmetros e `D1Database.batch()` quando várias escritas precisarem ser confirmadas ou revertidas juntas. [Chaves estrangeiras no D1](https://developers.cloudflare.com/d1/sql-api/foreign-keys/) e [API D1Database](https://developers.cloudflare.com/d1/worker-api/d1-database/).

Propor migrações versionadas em `migrations/`: primeiro usuários e sessões, depois projetos e referências. Ensaiar a aplicação desde um banco vazio e sobre dados existentes em D1 local, conferir restrições e índices e repetir em ambiente de teste isolado. Antes de futuras migrações remotas, confirmar o banco por nome e revisar a estratégia de recuperação. [Migrações do Cloudflare D1](https://developers.cloudflare.com/d1/reference/migrations/).

## Discord OAuth2 e segurança

1. Registrar uma aplicação Discord por ambiente quando necessário e autorizar o URI de retorno exato. Configurar o identificador e manter o segredo em um secret da Cloudflare. Iniciar o fluxo Authorization Code com o escopo mínimo `identify`, um `state` aleatório de curta duração e um cookie temporário que vincule o fluxo ao navegador. [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2) e [bindings e secrets das Pages Functions](https://developers.cloudflare.com/pages/functions/bindings/).
2. No callback, conferir `state`, vínculo com o navegador e expiração, e consumir a tentativa atomicamente uma única vez. Tratar cancelamento e respostas inválidas sem criar sessão. Trocar o código no servidor, consultar `/users/@me`, atualizar ou criar o usuário pelo identificador do Discord e descartar os tokens depois da consulta de identidade. [Identidade do usuário no Discord](https://docs.discord.com/developers/resources/user#get-current-user).
3. Emitir um identificador opaco novo depois do login, guardar somente seu hash no D1 e enviar o valor ao navegador em cookie de sessão `HttpOnly`, `Secure`, `SameSite=Lax` e sem atributo `Domain`. Aplicar expiração no servidor e revogar a sessão no logout. Validar a origem das operações que alteram dados e manter a API no mesmo domínio da interface.
4. Limitar requisições a rotas públicas e de autenticação, desabilitar cache nas rotas de sessão e dados privados e evitar registrar cookies, códigos OAuth, tokens, segredos e conteúdos bibliográficos. Expor um identificador de requisição nos erros internos para correlação com logs sem dados pessoais.

## Próximas etapas

1. Aprovar com frontend e testes os tipos de fonte iniciais, os exemplos ABNT e IEEE, o comportamento de ordenação e o contrato HTTP.
2. Implementar em ambiente local as migrações, o validador bibliográfico e as funções de prévia e persistência. Exercitar sessões e operações protegidas com identidades de teste isoladas.
3. Validar a integração Discord com uma aplicação e um banco de teste autorizados. Validar sucesso, cancelamento, expiração, logout e rejeição de callbacks inválidos. Cobrir ainda isolamento entre projetos de contas de teste, persistência após nova requisição e contrato de erros.
