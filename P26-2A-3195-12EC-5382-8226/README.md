# Projeto #10: Rastreador de Hábitos (Habit Tracker)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Henry Augusto Pereira Pupo
- **Turma:** 2A
- **Chave Única:** `P26-2A-3195-12EC-5382-8226`
- **URL_CLOUDFLARE:** https://habitos-p26-2a-3195.pages.dev
- **Licença:** MIT (arquivo [`LICENSE`](./LICENSE))

---

## Especificação do projeto

Painel de acompanhamento de hábitos diários que exibe uma grade matricial com os dias do mês corrente. Após autenticar-se com o Discord, o usuário cadastra metas recorrentes e marca as caixas dos dias em que cumpriu a atividade, com atualização imediata de barras de progresso em CSS.

Os registros de conclusão (data e ID do hábito) são armazenados no Cloudflare D1 por meio de endpoints RESTful nas Cloudflare Pages Functions. O back-end processa e devolve métricas consolidadas (maior sequência de dias seguidos, sequência atual e taxa percentual de cumprimento mensal), exibidas no cliente como indicadores numéricos.

## Funcionalidades

- Login exclusivo pelo **Discord OAuth2**, importando `user_id`, nome de usuário e avatar.
- Cadastro, renomeação, troca de cor e exclusão de hábitos (metas recorrentes diárias).
- **Grade do mês**: uma linha por hábito, uma coluna por dia; hoje destacado, dias futuros bloqueados, fins de semana sombreados.
- **Barra de progresso CSS** por hábito, atualizada no instante do clique e confirmada pelo servidor.
- **Indicadores numéricos** calculados no servidor: taxa de cumprimento do mês, sequência atual, maior sequência e hábitos feitos hoje.
- Navegação entre meses anteriores (meses futuros bloqueados).
- Layout responsivo (desktop e celular), acessível por teclado e leitor de tela.
- Chave Única no rodapé (`<footer>`) da interface.

## Arquitetura

```
Navegador (HTML5 + CSS3 + Vanilla JS)
   │  fetch JSON (cookie de sessão HttpOnly)
   ▼
Cloudflare Pages Functions  (functions/api/**)
   │  _middleware.js: CSRF por Origin, sessão, erros
   │  regras de negócio + métricas (src/lib/**)
   ▼
Cloudflare D1 (SQLite)  ── users · sessions · habits · completions
   ▲
Discord OAuth2 (discord.com/oauth2/authorize → /api/oauth2/token → /api/users/@me)
```

| Camada | Arquivos |
|---|---|
| Interface | `public/index.html`, `public/styles.css`, `public/app.js`, `public/_headers` (CSP) |
| Rotas serverless | `functions/api/**` |
| Regras e métricas | `src/lib/dates.js`, `validate.js`, `metrics.js`, `habits.js`, `session.js`, `discord.js`, `http.js` |
| Banco | `migrations/0001_init.sql`, `wrangler.jsonc` (binding `DB`) |
| Testes | `tests/*.test.mjs` |
| Agentes | `AGENTS.md`, `.claude/agents/*.md`, `skills/*/SKILL.md` |

## API REST

Todas as rotas respondem JSON. Rotas de dados exigem sessão (senão `401`).

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/auth/discord` | Inicia o login OAuth2 (gera `state` e redireciona ao Discord) |
| GET | `/api/auth/discord/callback` | Troca o `code`, importa o perfil para o D1 e cria a sessão |
| POST | `/api/auth/logout` | Encerra a sessão |
| GET | `/api/me` | Usuário logado (`userId`, `username`, `displayName`, `avatarUrl`) |
| GET | `/api/habits?month=AAAA-MM&today=AAAA-MM-DD` | Hábitos, dias marcados no mês e métricas |
| POST | `/api/habits` | Cria hábito `{ name, color }` |
| PATCH | `/api/habits/:id` | Renomeia / troca a cor |
| DELETE | `/api/habits/:id` | Exclui o hábito e suas marcações |
| PUT | `/api/habits/:id/completions/:date` | Marca o dia como cumprido (idempotente) |
| DELETE | `/api/habits/:id/completions/:date` | Desmarca o dia (idempotente) |
| GET | `/api/metrics?month=AAAA-MM` | Apenas as métricas consolidadas |
| GET | `/api/status` | Diagnóstico público: D1 conectado, esquema e OAuth configurados |
| * | `/api/*` inexistente | 404 em JSON |

## Regras de negócio (validadas no servidor)

- Nome do hábito: 1 a 60 caracteres, normalizado (NFC, sem caracteres invisíveis, espaços colapsados), **único por usuário** sem diferenciar maiúsculas/minúsculas, inclusive com acentos (`409`).
- Cor: apenas `azul`, `verde`, `roxo`, `laranja`, `rosa`, `ciano` (`422`).
- Limite de **30 hábitos** por usuário (`409`), garantido por INSERT condicional atômico mesmo com requisições simultâneas.
- Marcação: data `AAAA-MM-DD` válida, **não pode ser futura** e no máximo 366 dias no passado (`422`).
- O "hoje" informado pelo cliente (fuso local) só é aceito se estiver a no máximo 1 dia do UTC; caso contrário o servidor usa o UTC.
- Um usuário nunca acessa hábitos de outro (`404`).
- Requisições que alteram dados vindas de outra origem são recusadas (`403`).

## Métricas (calculadas em `src/lib/metrics.js`)

- **Taxa de cumprimento mensal** = dias marcados no mês ÷ dias elegíveis × 100. Os dias elegíveis vão até hoje no mês corrente, ou até o fim do mês em meses passados. A contagem começa no dia 1, ou no dia de criação se o hábito nasceu no meio do mês, para que um hábito novo não comece "devendo" dias. Se houver marcação retroativa anterior à criação, a contagem começa nela, e a taxa nunca passa de 100%. No painel, a taxa geral soma todos os hábitos.
- **Sequência atual** = dias consecutivos cumpridos terminando hoje. Se hoje ainda não foi marcado, conta até ontem, porque o dia ainda não terminou.
- **Maior sequência (streak máximo)** = maior bloco de dias consecutivos em todo o histórico, atravessando viradas de mês e de ano.

## Rodar localmente

Requer Node.js 22 ou superior.

```powershell
npm.cmd install
npx.cmd wrangler d1 migrations apply DB --local
# crie o arquivo .dev.vars com:
#   DISCORD_CLIENT_ID=...
#   DISCORD_CLIENT_SECRET=...
# e cadastre no Discord o redirect http://localhost:8788/api/auth/discord/callback
npx.cmd wrangler pages dev
```

Abra http://localhost:8788.

## Testes

```powershell
npm.cmd test
```

São 39 testes: unitários (métricas, datas, validações, Discord) e de integração. Os de integração executam o middleware e as rotas reais contra um SQLite com a mesma migration do D1, cobrindo o OAuth2 com o Discord simulado. O passo a passo da entrega está em [`PASSO-A-PASSO.md`](./PASSO-A-PASSO.md).

---

Chave Única: `P26-2A-3195-12EC-5382-8226`
