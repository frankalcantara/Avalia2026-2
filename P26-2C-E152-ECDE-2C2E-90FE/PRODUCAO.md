# Preparacao para producao — SoundRoom

Este documento e um procedimento futuro, nao uma autorizacao para executar operacoes Cloudflare. Esta revisao nao acessou nem alterou recursos remotos, bancos D1 remotos, secrets ou deployments. Antes de qualquer operacao, obtenha autorizacao explicita da pessoa responsavel.

## Estado atual

- Pages Functions estao em `functions/api/`; os arquivos estaticos estao em `public/`.
- `wrangler.jsonc` declara `pages_build_output_dir: "./public"`, o binding local `DB`, o nome logico `soundroom`, `migrations_dir: "migrations/soundroom"` e bindings com `database_id` para Preview e Production.
- O Wrangler e dependencia de desenvolvimento fixada em `4.159.0`.
- Os `database_id` ja declarados em `wrangler.jsonc` nao foram verificados contra recursos Cloudflare nem associados a bancos reais nesta revisao. Como o arquivo inclui `pages_build_output_dir`, a documentacao de Pages diz que ele se torna a fonte de verdade de configuracao quando usado em um deploy. Portanto, **nao publique usando a configuracao atual** antes de confirmar a propriedade, validade e isolamento dos bindings.
- O arquivo declara `APP_URL` e `DISCORD_REDIRECT_URI` em Preview, mas nao declara essas variaveis em Production. Confirme e configure os valores de Production antes de habilitar OAuth.
- O projeto nao tem `.dev.vars`; `.dev.vars.example` contem apenas nomes e placeholders. Nunca use esses placeholders como credenciais.
- Nenhuma integracao OAuth Discord ou Spotify foi testada ao vivo.

## 1. Discord OAuth

### Valores necessarios por ambiente

| Nome | Tipo | Valor/origem |
|---|---|---|
| `APP_URL` | Variavel | Origem HTTPS canonica do ambiente, sem caminho |
| `DISCORD_REDIRECT_URI` | Variavel | `APP_URL` + `/api/auth/callback` |
| `DISCORD_CLIENT_ID` | Variavel | Client ID da aplicacao Discord real |
| `DISCORD_CLIENT_SECRET` | Secret | Client Secret da aplicacao Discord real |
| `OAUTH_STATE_TTL_SECONDS` | Variavel opcional | Padrao 600; permitido de 60 a 900 |
| `SESSION_TTL_SECONDS` | Variavel opcional | Padrao 604800; permitido de 300 a 2592000 |
| `DB` | Binding | D1 daquele ambiente |

### Configuracao no Discord Developer Portal

1. A pessoa mantenedora cria ou seleciona a aplicacao correta no [Discord Developer Portal](https://discord.com/developers/applications).
2. Na configuracao OAuth2, registra a URL de callback HTTPS exatamente como `https://<DOMINIO-REAL>/api/auth/callback`. O texto entre `<...>` e um marcador, nao um endereco para copiar.
3. Configura no Pages a mesma origem em `APP_URL`, a URI exata em `DISCORD_REDIRECT_URI`, e o Client ID correspondente.
4. Cadastra `DISCORD_CLIENT_SECRET` exclusivamente como Secret no ambiente Pages. Nunca em `wrangler.jsonc`, `.dev.vars.example`, HTML, JavaScript do navegador, logs ou commits.

O codigo inicia `GET /api/auth/discord`, solicita somente `identify`, gera `state` aleatorio, armazena somente seu hash no D1 e o vincula a cookie HttpOnly/SameSite=Lax. `GET /api/auth/callback` valida e consome o state uma unica vez, troca o codigo server-side, valida o perfil e cria uma sessao opaca; apenas o hash da sessao fica no D1. A URI e a origem sao validadas contra `APP_URL`; em HTTPS, cookies recebem `Secure`. Logout e mutacoes autenticadas exigem a origem configurada. O callback espera que as migrations que criam `oauth_states`, `sessions` e `users` estejam aplicadas.

### Validacao humana futura

Com credenciais e URI cadastradas por quem administra a aplicacao, testar login, cancelamento, callback, expiracao de state, consulta de sessao e logout no ambiente nao produtivo autorizado. Confirmar no navegador que cookies sao HttpOnly, SameSite=Lax e Secure em HTTPS. Testes automatizados com fetch/D1 simulados nao substituem este teste.

## 2. Spotify Web API

| Nome | Tipo | Uso |
|---|---|---|
| `SPOTIFY_CLIENT_ID` | Variavel | Identificador da aplicacao Spotify |
| `SPOTIFY_CLIENT_SECRET` | Secret | Segredo usado somente no servidor |
| `DB` | Binding | Cache de catalogo e limite de buscas |

Uma aplicacao real deve ser criada/selecionada no [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). Configure o Client ID como variavel e o Client Secret como Secret no ambiente para usar a busca opcional/legada. O fluxo usado e Client Credentials: nao ha login de usuario Spotify nem Redirect URI para esse fluxo. O token fica em memoria do isolate e nao e persistido no D1. A recomendacao principal usa links HTTPS validados e nao depende da API Spotify.

O endpoint de busca limita consultas a 12 por usuario por janela de 60 s, usa cache D1 de resultados de 120 s, timeout de seis segundos, renova o token apos `401` e nao repete automaticamente `429` do catalogo. A resposta traduz a indisponibilidade para `503` e limita `Retry-After`. Esse endpoint nao e usado pela interface atual nem cria recomendacoes.

**Ainda pendente:** testar autenticacao Client Credentials e busca/faixa real no ambiente autorizado, confirmar acesso/quota e modo da aplicacao no painel e revalidar as politicas oficiais vigentes, incluindo atribuicao, capas, retencao de metadados e limites de uso. Os testes existentes mockam `fetch`; nao afirmam que as credenciais ou a quota estao funcionais.

## 3. Cloudflare Pages e ambientes

### Recursos e configuracao

1. Escolher o nome real do projeto Pages, dominio, branch de producao e politica de Preview. Nao ha nome de projeto remoto confirmado pelo repositorio.
2. Para Pages sem processo de build, deixar Build command vazio; se a interface exigir um comando, a documentacao Pages recomenda `exit 0`. Configurar output directory `public/` e raiz do repositorio correta.
3. Usar D1 **separado** para Preview/staging e Production. Cada ambiente deve ter o binding `DB` apontando para seu proprio banco.
4. Criar os bancos com autorizacao e registrar os nomes e `database_id` retornados pelo Cloudflare. O ID e um UUID real emitido pelo servico; nao preencher com exemplo ou placeholder.
5. Confirmar se os `database_id` ja presentes em `wrangler.jsonc` correspondem aos bancos corretos e distintos de Preview e Production. A configuracao Wrangler de Pages suporta overrides `env.preview` e `env.production`; verifique a heranca dos campos e garanta que Preview nao aponte para o banco Production. A configuracao versionada e fonte de verdade ao publica-la, portanto nao mantenha valores divergentes no Dashboard.
6. Configurar `APP_URL`, `DISCORD_REDIRECT_URI`, `DISCORD_CLIENT_ID`, `OAUTH_STATE_TTL_SECONDS`, `SESSION_TTL_SECONDS` e `SPOTIFY_CLIENT_ID` por ambiente. Configurar `DISCORD_CLIENT_SECRET` e `SPOTIFY_CLIENT_SECRET` como secrets. Nunca guardar secrets em `vars`.
7. Cadastre no Discord Developer Portal a callback HTTPS exata de cada ambiente que usara login. Esta configuracao Spotify nao exige Redirect URI.

O `wrangler.jsonc` foi ajustado para apontar `migrations_dir` para `migrations/soundroom` em raiz, Preview e Production. Os IDs nele presentes nao foram validados nem usados nesta revisao.

## 4. D1 e migrations

### Ordem versionada

O binding D1 do SoundRoom usa `migrations_dir: "migrations/soundroom"` em raiz, Preview e Production. O arquivo `migrations/0001_init.sql` pertence ao template do professor: deve permanecer intacto nesse caminho e nao integra as migrations SoundRoom. Wrangler descobre os SQL dentro do diretorio configurado, ordena o prefixo numerico e registra cada nome relativo a `migrations_dir`; assim, os seis nomes SoundRoom permanecem os mesmos mesmo estando em subdiretorio.

Wrangler aplica as seis migrations SoundRoom pendentes na ordem numerica:

1. `0001_initial_schema.sql` — esquema base de usuarios, salas, recomendacoes e votos legados, sessoes e estados OAuth.
2. `0002_music_rooms.sql` — salas publicas, participacoes, recomendacoes musicais e votos com integridade e historico.
3. `0003_participant_presence.sql` — adiciona `last_seen_at` e inicializa presencas ativas existentes com `joined_at`.
4. `0004_spotify_catalog.sql` — metadados Spotify, cache de busca e limite de consultas.
5. `0005_external_music_links.sql` — adiciona provedor e URL externa as recomendacoes musicais e preenche valores a partir dos metadados existentes.
6. `0006_allow_self_votes.sql` — permite que participantes ativos votem nas proprias recomendacoes, preservando as demais regras de elegibilidade.

Migrations nao devem ser editadas depois de aprovadas. Antes de qualquer mudanca de esquema, criar uma nova migration aditiva em `migrations/soundroom/`, revisar compatibilidade e testar em D1 local e Preview.

Hashes SHA-256 calculados diretamente dos seis arquivos em `migrations/soundroom/`:

| Migration | SHA-256 |
|---|---|
| `migrations/soundroom/0001_initial_schema.sql` | `1D6C31225B71C0E0EA7F413B617CF9FDB4FB09731FA2AD85FE2F4C4C56D2C444` |
| `migrations/soundroom/0002_music_rooms.sql` | `9A78349244FF392C1B5E9D5B5AB6531271D75EB7C71507A06EABA1A2B714AEBE` |
| `migrations/soundroom/0003_participant_presence.sql` | `67067FAAFF7EFDDD7A3B48A41C1FDA934C6E3E07E12F8C5C4FB6E2AED7AEEEC6` |
| `migrations/soundroom/0004_spotify_catalog.sql` | `4536CD656AC79F6882D6E8F8E12934C8939A25E5E1BF0839190E354D7D1DFBA6` |
| `migrations/soundroom/0005_external_music_links.sql` | `8BB84957ECC0D10BBC6A04A8D1A43533B5520A8981166D14A9EFF24E295CA643` |
| `migrations/soundroom/0006_allow_self_votes.sql` | `73A60593FC759F4B4984593A89D2487817B58048E27D19D0F238D2C903924D06` |

### Comandos de referencia — executar somente com autorizacao expressa

Criar recursos remotos e uma operacao mutavel; nao executar sem autorizacao:

```powershell
npx wrangler d1 create <NOME_REAL_PREVIEW>
npx wrangler d1 create <NOME_REAL_PRODUCTION>
```

Depois de criar ou confirmar os bancos com autorizacao, registrar os nomes e IDs reais na configuracao revisada. Antes de publicar, usar o nome/binding correto e confirmar visualmente o ambiente selecionado. Os comandos abaixo sao exemplos de procedimento futuro e **nao foram executados**:

```powershell
npx wrangler d1 migrations list <NOME_REAL_PREVIEW> --remote
npx wrangler d1 migrations apply <NOME_REAL_PREVIEW> --remote
npx wrangler d1 migrations list <NOME_REAL_PRODUCTION> --remote
npx wrangler d1 migrations apply <NOME_REAL_PRODUCTION> --remote
```

Wrangler documenta que `migrations apply` solicita confirmacao interativa e captura backup ao aplicar; em CI, a confirmacao pode ser omitida, ainda com backup capturado. Isso nao substitui backup independente, aprovacao, identificacao do banco ou plano de recuperacao.

Verificacao local sem remoto:

```powershell
npm run db:setup
npx wrangler d1 migrations list soundroom --local
npx wrangler d1 execute soundroom --local --command "PRAGMA foreign_key_check"
Get-FileHash migrations\soundroom\0001_initial_schema.sql,migrations\soundroom\0002_music_rooms.sql,migrations\soundroom\0003_participant_presence.sql,migrations\soundroom\0004_spotify_catalog.sql,migrations\soundroom\0005_external_music_links.sql,migrations\soundroom\0006_allow_self_votes.sql -Algorithm SHA256
```

Antes de cada migration remota: validar nome e ambiente do banco, conferir estado aplicado, confirmar os hashes, verificar backup acessivel e testar a mesma sequencia em banco nao produtivo. Aplicar migrations uma vez por ambiente e validar tabela `d1_migrations`, `PRAGMA foreign_key_check` e endpoints que dependem do esquema. Nunca usar `--remote` ou `--preview` sem autorizacao correspondente.

## 5. Seguranca — revisao do codigo atual

Na revisao local desta etapa, nao foi identificado defeito comprovado que justifique alterar o codigo de autenticacao ou das rotas:

- OAuth valida origem/callback, state de uso unico, perfil Discord e prazos; tokens de sessao sao aleatorios e somente hashes sao armazenados.
- Cookies da sessao sao HttpOnly, SameSite=Lax e Secure quando `APP_URL` usa HTTPS; logout verifica `Origin`.
- Mutacoes das salas validam sessao, origem, tipo/tamanho/campos dos corpos e autorizacao no servidor. As consultas D1 verificadas usam prepared statements/`.bind()`.
- O frontend construi elementos via APIs DOM/texto; nao foi encontrado uso de `innerHTML`. URLs de avatar/capa/link passam por validacao de host/protocolo.
- A pesquisa Spotify tem limite persistido por usuario. Esse limite nao e um rate limit global para todas as rotas; monitorar abuso de endpoints publicos/de mutacao e definir limites adicionais se requisito/carga justificar.
- Erros de provider nao devolvem respostas brutas ao cliente; falhas inesperadas usam mensagens genericas e logs reduzidos.

Isto e revisao estatica e testes locais, nao uma garantia de seguranca ou um pentest do runtime Cloudflare. Antes da publicacao, revisar CSP/headers do ambiente, observabilidade sem PII/secrets e protecoes de abuso. O OAuth real, isolamento de Preview e comportamento concorrente sob carga ainda nao foram verificados.

## 6. Checklist pre-deploy

- [ ] Revisao aprovada do commit, testes completos verdes e `node --check`.
- [ ] Dominios/origens de Preview e Production confirmados em HTTPS.
- [ ] Projeto Pages, branch de producao, build/output e configuracao versionada revisados.
- [ ] Binding `DB` do Preview aponta apenas para o banco Preview; Production aponta apenas ao banco Production.
- [ ] Secrets e variaveis estao configurados nos ambientes corretos e nao aparecem no bundle, logs ou Git.
- [ ] Redirect URI Discord coincide byte a byte com `DISCORD_REDIRECT_URI` e `APP_URL`.
- [ ] Teste OAuth e Spotify concluido em Preview com credenciais reais autorizadas, ou a funcionalidade externa desabilitada/documentada.
- [ ] Backup recuperavel verificado e plano de rollback aprovado.
- [ ] Hashes da migration conferidos; estado remoto e ordem pendente revisados por pessoa autorizada.
- [ ] Janela, responsavel, criterio de sucesso e criterio de parada definidos.

## 7. Sequencia futura de publicacao

Esta sequencia e um runbook; nenhum passo foi executado nesta etapa.

1. Revisar configuracao Pages/Wrangler e recursos de Preview/Production com `database_id` reais.
2. Fazer backup aprovado do banco de destino e verificar que o arquivo/restore de teste esta acessivel.
3. Validar `wrangler d1 migrations list` no ambiente autorizado; confirmar banco, migracoes pendentes e hashes.
4. Aplicar migrations aprovadas no Preview; executar verificacoes de integridade e smoke tests.
5. Publicar Preview e testar health, login/logout, salas, recomendacoes manuais e Spotify, autorizacoes, headers/cookies e erros.
6. Obter aprovacao explicita antes de qualquer alteracao Production.
7. Fazer backup e repetir a verificacao do banco Production; aplicar migrations compativeis aprovadas antes do codigo que as requer.
8. Publicar pelo fluxo Pages aprovado (Git integration ou Wrangler Pages deploy) e registrar commit/deployment, migrations e responsavel.
9. Executar checklist pos-deploy e monitorar erros/latencia/limites antes de anunciar disponibilidade.

## 8. Pos-deploy e rollback

### Verificacao pos-deploy

- `GET /api/health` retorna 200. Esta rota confirma a Function, mas nao a conectividade D1.
- Confirmar sessao anonima, inicio OAuth, callback, usuario, logout e atributos dos cookies em HTTPS.
- Criar/entrar/sair/encerrar sala e testar participante/presenca; verificar recomendacoes manuais com links de YouTube, Spotify e SoundCloud, votos e historico. Testar a busca Spotify apenas se o endpoint opcional estiver habilitado.
- Confirmar no banco de cada ambiente que as migrations esperadas foram aplicadas e que `PRAGMA foreign_key_check` nao aponta problemas, usando acesso e comandos autorizados.
- Conferir erros 401/429 do provider, `Retry-After`, limites da aplicacao, logs sem secrets/PII desnecessaria e ausencia de problemas de interface.

### Recuo de aplicacao

1. Interromper a publicacao/ativacao e registrar erros e deployment.
2. Se o problema for somente o bundle Pages e o esquema continuar compativel, reverter ao deployment Production anterior pela tela **Deployments → Rollback to this deployment** (somente com autorizacao).
3. Repetir smoke checks e monitorar. Um rollback Pages nao reverte schema nem dados D1.
4. Nao apagar/alterar manualmente tabelas ou migrations para "voltar" o banco. Migrations aditivas devem ser compativeis com a versao anterior. Se houver migration defeituosa, pausar escritas conforme impacto e elaborar migration corretiva/forward fix revisada.

### Recuperacao de dados

Antes da publicacao, definir responsavel, frequencia, retencao e local seguro do backup. Wrangler `d1 export <DATABASE> --remote --output <ARQUIVO>` e uma opcao documentada para exportar D1, mas e uma leitura remota e requer autorizacao; proteger o arquivo como dado sensivel. Verificar a exportacao e testar recuperacao em banco isolado antes de depender dela.

Time Travel/restauracao ou importacao podem alterar dados remotos. Em incidente, preservar logs e export, evitar novas escritas se houver risco de dano, estimar perda/impacto e obter aprovacao antes de restaurar. Preferir recuperar primeiro em banco separado e validar integridade antes de qualquer troca de binding.

## Fontes oficiais consultadas

- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages Functions Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/)
- [Cloudflare Pages bindings](https://developers.cloudflare.com/pages/functions/bindings/)
- [Cloudflare D1 Wrangler commands](https://developers.cloudflare.com/d1/wrangler-commands/)
- [Cloudflare D1 database API — batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- [Cloudflare Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/)
- [Discord OAuth2](https://docs.discord.com/developers/topics/oauth2)
- [Spotify Client Credentials](https://developer.spotify.com/documentation/web-api/tutorials/client-credentials-flow)
- [Spotify Web API policy](https://developer.spotify.com/policy)
