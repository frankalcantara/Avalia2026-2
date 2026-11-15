# SoundRoom

**Chave única da atividade:** `P26-2C-E152-ECDE-2C2E-90FE`

- **URL_CLOUDFLARE:** `https://051ce836.soundroom.pages.dev` *(Ambiente Preview publicada e testada; não é Production)*

Plataforma social de recomendações musicais para estudo e programação. Consulte [AGENTES.md](./AGENTES.md) para os agentes, harness e skills versionados; Consulte [ARQUITETURA.md](./ARQUITETURA.md) para decisões e relacionamentos, e [PRODUCAO.md](./PRODUCAO.md) para checklist, configuracao Cloudflare/D1, publicacao e rollback futuros.

## Requisitos

- Node.js 22 ou superior e npm.
- PowerShell no Windows para os testes de D1.
- Para completar o login local com Discord, é necessária uma aplicação no Discord Developer Portal e os valores locais indicados abaixo. Sem eles, a página e as demais rotas continuam iniciando; o endpoint de login informa que a autenticação não está configurada.

## Preparar e executar

Na raiz do projeto:

```powershell
npm ci
npm run db:setup
npm run dev
```

O Wrangler inicia Cloudflare Pages em `http://127.0.0.1:8788`, serve os arquivos de `public/`, carrega Pages Functions de `functions/` e configura o binding local D1 `DB`. O banco local chama-se `soundroom`; a migration versionada é aplicada com `npm run db:setup`.

Verifique a Function:

```powershell
Invoke-RestMethod http://127.0.0.1:8788/api/health
```

A resposta esperada é `status: ok` e `service: soundroom`. A rota confirma apenas a disponibilidade da Function; ela não acessa D1.

## Interface, salas e recomendações musicais

A interface em `public/` usa HTML semântico, CSS responsivo e JavaScript Vanilla. Ela consulta a sessão Discord, lista salas públicas, permite criar e participar de salas, acompanhar participantes, registrar recomendações e votos e consultar o histórico da sala selecionada. Os dados recebidos da API são inseridos como texto; avatar e capas só são carregados de hosts HTTPS permitidos. Não há frameworks de interface nem credenciais Spotify/Discord no navegador.

Com as migrations locais aplicadas, a página lista salas públicas reais do D1. Recomendações de salas abertas também podem ser consultadas por quem ainda não participa; para entrar, recomendar músicas ou votar, é necessário estar autenticado pelo Discord. Na tela da sala, o criador pode encerrá-la. O criador é inscrito automaticamente na própria sala. O autor ou o criador pode remover recomendações enquanto a sala está aberta, mesmo depois de sair; a interface pede confirmação e a remoção lógica preserva recomendações e votos no histórico. Após o encerramento, recomendações não podem ser removidas.

Cada recomendação exige título, artista, gênero e um link HTTPS de conteúdo do YouTube, Spotify ou SoundCloud. O servidor valida o domínio e o formato do link antes de persistir provedor e URL no D1; não consulta o catálogo externo nem exige conta paga ou credenciais dessas plataformas. Participantes ativos podem votar inclusive nas próprias recomendações; cada pessoa tem um voto por recomendação e pode alterá-lo ou removê-lo. A pontuação é calculada dos votos persistidos no D1, ordenada no servidor; as três primeiras recebem destaque. Participantes atualizam a presença por HTTP a cada 30 segundos, e uma participação sem atualização nos últimos 90 segundos aparece offline. Não há WebSocket nem reprodução de áudio na aplicação.

### Endpoints implementados

| Método e rota | Acesso | Descrição |
|---|---|---|
| `GET /api/rooms?limit=20&offset=0` | Público | Lista salas públicas ativas com paginação e contagens |
| `POST /api/rooms` | Autenticado | Cria sala pública e inscreve o criador |
| `GET /api/rooms/:roomId` | Público | Consulta sala ativa ou encerrada |
| `POST /api/rooms/:roomId/join` | Autenticado | Entra em sala ativa; não duplica presença |
| `POST /api/rooms/:roomId/leave` | Participante | Registra saída sem apagar histórico |
| `POST /api/rooms/:roomId/presence` | Participante | Atualiza heartbeat de presença |
| `POST /api/rooms/:roomId/close` | Criador | Encerra sala e presenças ativas |
| `GET /api/rooms/:roomId/participants` | Público | Lista participantes presentes com paginação |
| `GET /api/rooms/:roomId/recommendations` | Público | Lista recomendações ativas, votos e pontuação |
| `POST /api/rooms/:roomId/recommendations` | Participante | Recomenda faixa com título, artista, gênero e link HTTPS de plataforma aceita |
| `DELETE /api/recommendations/:recommendationId` | Autor ou criador, sala aberta | Remove logicamente recomendação e preserva votos no histórico |
| `POST /api/recommendations/:recommendationId/vote` | Participante ativo, inclusive o autor | Define/altera voto `1` ou `-1` |
| `DELETE /api/recommendations/:recommendationId/vote` | Participante | Remove o próprio voto |
| `GET /api/rooms/:roomId/history?limit=20&offset=0` | Público | Consulta recomendações removidas e histórico de participações |
| `GET /api/music/search?q=consulta&limit=10&offset=0` | Autenticado | Endpoint legado/opcional de busca Spotify; não é usado no fluxo principal de recomendações |

As listas no servidor aceitam `limit` de 1 a 50 e `offset` até 10000. As páginas de recomendações incluem `pagination.rankingVersion`; requisições com `offset` maior que zero devem enviar esse valor. Se votos ou recomendações alterarem a ordenação entre requisições, a API responde `409 RANKING_CHANGED` e a interface recomeça pelo placar atual, em vez de continuar com um offset potencialmente incorreto. Isso detecta mudanças observáveis no estado do placar, mas não representa um snapshot persistente do banco. As salas são públicas nesta etapa; criação privada não é oferecida. Alterações exigem sessão, `Origin` igual a `APP_URL` e JSON nos endpoints com corpo.

### Links de plataformas musicais

O fluxo principal não depende da Spotify Web API. O participante informa título, artista, gênero e o link da faixa. O backend aceita exclusivamente HTTPS e valida os hosts suportados: `youtube.com`, `www.youtube.com`, `m.youtube.com`, `youtu.be`, `open.spotify.com`, `soundcloud.com`, `www.soundcloud.com` e `on.soundcloud.com`. São aceitos links de vídeos do YouTube, conteúdos do Spotify (faixas, álbuns, playlists, episódios ou programas) e links do SoundCloud, incluindo links curtos `on.soundcloud.com`. URLs de outros domínios, protocolos inseguros, links com usuário/senha e links sem identificador de conteúdo são rejeitados.

O provedor e a URL validada são persistidos em `music_recommendations`. A migration `0005_external_music_links.sql` adiciona os campos e preserva os metadados Spotify legados existentes. Não são solicitados Client ID, Client Secret ou assinatura Premium para recomendar links. A aplicação não reproduz áudio; o botão abre a plataforma em outra aba.

A rota antiga `/api/music/search` e o provider Spotify permanecem no código como integração opcional/legada, mas a interface e a criação de recomendações não os chamam. Se o Spotify bloquear a Web API, isso não impede o uso de links do Spotify nem as recomendações de YouTube e SoundCloud.

## Testes

```powershell
npm test
```

O comando executa testes unitários, D1 e integração Pages + D1 local. Os testes de D1 e Pages usam diretórios temporários e não acessam produção. Para executar somente um conjunto:

```powershell
npm run test:unit
npm run test:db
npm run test:integration
```

Os testes de API/unitários verificam saúde, cookies/sessões, estado de paginação (offset, deduplicação, troca de sala e invalidação de respostas antigas), disponibilidade/autorização da ação de remoção e o fluxo OAuth Discord completo **com respostas do provider simuladas**: início, troca do código, validação e consumo único de `state`, criação da sessão, cookies e erros. Os testes do provider Spotify também substituem `fetch` para verificar cache do token em memória, renovação após `401`, limite de retry e `429`; eles **não** validam integração ao vivo e não são necessários para o fluxo principal de recomendações. Os testes de banco aplicam as seis migrations em D1 local e verificam a migração de metadados Spotify legados em `0005`, inclusive recomendações sem metadados e preservação dos registros. O teste de integração inicia Wrangler Pages com persistência D1 temporária, sem credenciais Spotify, percorre sessão local, salas, presença (online, offline após 90 segundos e retorno com heartbeat), recomendações com links Spotify/YouTube/SoundCloud, rejeição de domínios externos, votação (inclusive voto próprio), remoção por autor/criador inclusive depois de sair, paginação de participantes/recomendações/histórico, reinício do placar quando a versão muda, rejeições por permissão/sessão/sala encerrada, preservação de votos e histórico, cache, limite por usuário e logout, e descarta os dados ao final:

```powershell
npm run test:integration
```

O teste D1 isolado e o teste de integração cobrem localmente o cache de resultados, o limite por usuário e as migrations. Nenhum teste realiza autenticação ao vivo com Discord ou chamada real à Spotify Web API. Não configure um banco remoto, não aplique migrations remotas e não faça deploy sem autorização explícita.

Para inspecionar as tabelas do banco local, com Wrangler:

```powershell
npx wrangler d1 execute soundroom --local --command "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
```

O teste `tests/database/migrations.test.mjs` aplica e verifica as seis migrations em D1 local. As Functions da aplicação usam consultas SQL parametrizadas.

## Estado e limites da implementação

Etapas 1 a 6 incluem autenticação, salas, presença, recomendações e votação; o catálogo Spotify é uma integração opcional/legada. As seis migrations do SoundRoom ficam em `migrations/soundroom/` e são aplicadas em ordem numérica: `0001_initial_schema.sql` cria o esquema base; `0002_music_rooms.sql` adiciona salas musicais, participações, recomendações e votos; `0003_participant_presence.sql` adiciona o heartbeat; `0004_spotify_catalog.sql` adiciona metadados, cache e limite de buscas Spotify; `0005_external_music_links.sql` adiciona provedor e URL externa às recomendações musicais e preenche esses campos a partir dos metadados legados existentes; `0006_allow_self_votes.sql` permite voto próprio por participantes ativos, mantendo as demais verificações de elegibilidade. O arquivo `migrations/0001_init.sql` pertence ao template do professor, é preservado em seu caminho original e não integra a sequência executada pelo SoundRoom. Recomendações antigas sem metadados continuam com provedor e URL nulos. Datas persistidas são UTC ISO 8601 com milissegundos. Participação duplicada ativa, novas recomendações e votos em salas encerradas continuam impedidos no servidor e, quando apropriado, por triggers D1.

O histórico oferecido pela interface corresponde à sala aberta pelo seu ID, conforme `GET /api/rooms/:roomId/history`; a API atual não oferece uma rota para listar salas encerradas globalmente. Não há requisito de produto confirmado para descoberta global de arquivos nesta etapa; caso isso seja necessário, definir antes política de visibilidade, autorização e paginação. OAuth Discord depende de credenciais próprias e precisa de validação ao vivo; o fluxo principal de links não depende de credenciais Spotify. O estado local e os testes não comprovam prontidão de produção.

### Pendências de Pages e D1 para produção

- Criar/selecionar o projeto Pages e configurar a raiz e o diretório de saída `public/`; como não há etapa de build, deixar o comando vazio (ou usar `exit 0` se a configuração exigir um valor).
- Configurar o binding D1 `DB` em **Preview** e **Production**, apontando cada ambiente ao banco correto. `wrangler.jsonc` declara `database_name`, `migrations_dir` e `database_id` para Preview e Production. Confirmar que os IDs configurados correspondem aos bancos reais e isolados de cada ambiente antes de qualquer deploy; não presumir sua validade sem verificação autorizada.
- Usar D1 separado para Preview/staging e Production. Configurar `APP_URL`, `DISCORD_REDIRECT_URI`, `DISCORD_CLIENT_ID`, `OAUTH_STATE_TTL_SECONDS` e `SESSION_TTL_SECONDS` como variáveis nos ambientes correspondentes; armazenar `DISCORD_CLIENT_SECRET` como secret. Cadastrar a Redirect URI HTTPS exata no Discord Developer Portal. As variáveis Spotify só são necessárias se a integração opcional de busca for reativada.
- Antes da primeira migration remota, conferir o estado e o histórico do banco de destino, fazer backup aprovado, comparar os seis arquivos com os hashes revisados e aplicar a sequência versionada somente após autorização. Validar o schema e as rotas no ambiente designado; não tratar o D1 local como prova de operação remota.
- A documentação oficial atual do [D1 `batch()`](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch) afirma que os statements são executados sequencialmente e que falha em qualquer statement aborta/reverte a sequência. Isso é garantia documentada do serviço, não teste deste projeto em conta remota. Concorrência entre requisições/operações independentes continua sem validação operacional; constraints, índices únicos, triggers e atualizações condicionais mitigam invariantes específicas, mas não substituem teste de carga/race no ambiente autorizado.

Reprodução incorporada, salas privadas e WebSocket continuam planejados. A autenticação OAuth do Discord e os links externos devem ser validados no ambiente publicado. A busca opcional pela Spotify Web API não é requisito do fluxo principal e pode exigir Premium e atender às restrições de quota/allowlist do modo de desenvolvimento. Não aplique migrations remotas nem faça deploy sem autorização explícita.

## Ferramentas

- **Wrangler**: Pages local, Pages Functions e D1 local.
- **Node.js `node:test`**: testes unitários das rotas de saúde e autenticação.
- **PowerShell**: script de validação do D1 local.
- **Node.js + Wrangler Pages local**: integração real com D1 para rotas de autenticação e salas.
- Sem frameworks ou bibliotecas de interface.
