# Cypher — Contrato de Arquitetura e API

Documento compartilhado entre os agentes. Toda rota, tabela e formato de dado do projeto segue este contrato.

## 1. Visão geral

- **Jogo:** Cypher, adivinhação de palavras de 5 letras em português (estilo Termo/Wordle) com identidade visual de cofre.
- **Chave do projeto:** `P26-3A-0CED-4ACD-47F7-EDA9` (rodapé de todas as telas e README).
- **Stack:** HTML5 + CSS3 + JavaScript puro (ES modules, sem build) em `public/`; Cloudflare Pages Functions em `functions/`; código compartilhado do servidor em `src/`; Cloudflare D1 (binding `DB`).
- **Fuso:** todas as datas de jogo são `YYYY-MM-DD` no fuso `America/Sao_Paulo`.
- **Lançamento:** `LAUNCH_DATE = "2026-11-01"`. Não existe jogo antes dessa data.
- **Variáveis de ambiente (secrets no Cloudflare / `.dev.vars` local):** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `WORD_SECRET`.

## 2. Modos

| mode | Tentativas | Feedback | Palavra |
|---|---|---|---|
| `classico` | 6 | por letra: `correct` / `present` / `absent` | 1 por dia, sorteada no servidor |
| `sombra` | 10 | por linha: `{ "exact": n, "misplaced": n }` | 1 por dia, diferente da do clássico |
| desafio | 6 | igual ao clássico | escolhida por um jogador, compartilhada por link |

Regras comuns:
- Chute normalizado: remove acentos (NFD), `Ç→C`, caixa alta, somente `A-Z`, exatamente 5 letras.
- O chute precisa existir no conjunto `ANSWERS ∪ VALID` (senão `422 not_a_word`).
- Feedback com tratamento correto de letras repetidas (primeiro marca `correct`, depois distribui `present` pelas ocorrências restantes da resposta).
- A resposta **nunca** é enviada ao navegador enquanto o jogo está em andamento. Só vai em `answer` quando `status` é `won` ou `lost`.
- **Cofres antigos:** qualquer dia entre `LAUNCH_DATE` e hoje pode ser jogado. Data futura → `403 future_date`. Data antes do lançamento → `400 before_launch`.
- Uma partida criada em um dia anterior a hoje é `is_archive = 1`. Partidas de arquivo **não** contam para streak nem ranking; contam em `archive.played/wins` das estatísticas.

## 3. Sorteio da palavra diária (`src/words.js`)

- `src/data/answers.js` exporta `ANSWERS`: array de palavras **na forma de exibição** (com acento, caixa alta), ex.: `"LIMÃO"`, `"CARRO"`. Todas normalizam para 5 letras A-Z.
- `src/data/valid.js` exporta `VALID`: string com palavras normalizadas separadas por espaço (chutes aceitos; inclui plurais e conjugações).
- Slot do dia: `n = diasEntre(LAUNCH_DATE, date)`; `slot = 2n` para `classico` e `2n + 1` para `sombra`.
- Ordenação secreta por ciclo: semente de 128 bits `HMAC-SHA256(WORD_SECRET, "ciclo:" + cycle)` alimentando um embaralhamento Fisher-Yates determinístico (um único HMAC por ciclo, para caber no limite de CPU do plano gratuito).
- Materialização sequencial na tabela `daily_words`: para obter o slot alvo, preenche todos os slots faltantes em ordem, até o alvo (nunca além). Cada slot recebe a primeira palavra da ordenação do ciclo atual que ainda não foi usada nesse ciclo e que não saiu nos últimos 30 slots. Quando o ciclo esgota, começa `cycle + 1`.
- `INSERT OR IGNORE` + releitura garantem consistência em requisições concorrentes.
- Só é chamado para datas `<= hoje`. Sem `WORD_SECRET` → `500 server_misconfigured`.
- A palavra de demonstração da tela de entrada (`COFRE`) não pode estar em `ANSWERS`.

## 4. Banco D1 (`migrations/0001_init.sql`)

```
users(user_id TEXT PK, username TEXT NOT NULL, global_name TEXT, avatar_url TEXT, created_at TEXT, updated_at TEXT)
sessions(token_hash TEXT PK, user_id TEXT NOT NULL, created_at TEXT, expires_at INTEGER NOT NULL)   -- guarda SHA-256 do token, nunca o token
user_guilds(user_id TEXT, guild_id TEXT, guild_name TEXT, guild_icon TEXT, PK(user_id, guild_id))   -- índice em guild_id
daily_words(slot INTEGER PK, mode TEXT, day TEXT, word_key TEXT, cycle INTEGER, created_at TEXT, UNIQUE(mode, day))
games(id INTEGER PK AUTOINCREMENT, user_id TEXT, mode TEXT, day TEXT, status TEXT CHECK(status IN ('playing','won','lost')),
      attempts INTEGER DEFAULT 0, is_archive INTEGER DEFAULT 0, started_at TEXT, finished_at TEXT, UNIQUE(user_id, mode, day))
guesses(game_id INTEGER, attempt_no INTEGER, guess TEXT, feedback TEXT /* JSON */, created_at TEXT, PK(game_id, attempt_no))
user_stats(user_id TEXT, mode TEXT, played INTEGER, wins INTEGER, current_streak INTEGER, max_streak INTEGER,
           last_win_day TEXT, distribution TEXT /* JSON array tamanho maxAttempts */, win_attempts_total INTEGER,
           archive_played INTEGER, archive_wins INTEGER, PK(user_id, mode))
challenges(id TEXT PK, creator_id TEXT, word_key TEXT, created_at TEXT)
challenge_games(challenge_id TEXT, user_id TEXT, status TEXT, attempts INTEGER, started_at TEXT, finished_at TEXT, PK(challenge_id, user_id))
challenge_guesses(challenge_id TEXT, user_id TEXT, attempt_no INTEGER, guess TEXT, feedback TEXT, created_at TEXT, PK(challenge_id, user_id, attempt_no))
```

Streak (somente partidas do próprio dia): vitória com `last_win_day == day - 1` → `current_streak + 1`; senão `1`. Derrota → `0`. Na leitura, se `last_win_day < ontem`, o streak exibido é `0`.

## 5. Sessão e autenticação

- Cookie `cypher_session` = token aleatório de 32 bytes (hex), `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000`. No D1 fica só o SHA-256 do token.
- Todas as rotas `/api/*` (exceto auth) exigem sessão válida → senão `401 { "error": "unauthorized" }`.
- OAuth2 Discord com escopos `identify guilds` e parâmetro `state` (cookie `cypher_oauth`, HttpOnly, 10 min) contra CSRF. O cookie também guarda `returnTo` (somente caminhos que começam com `/` e não com `//`).

## 6. Formato de erro

Sempre JSON: `{ "error": "<codigo>", "message": "<texto em pt-BR>" }`.
Códigos: `unauthorized` 401, `invalid_mode` 400, `invalid_date` 400, `before_launch` 400, `future_date` 403, `invalid_format` 400, `not_a_word` 422, `game_over` 409, `not_found` 404, `own_challenge` 403, `forbidden` 403, `rate_limited` 429, `conflict` 409 (chutes simultâneos), `method_not_allowed` 405, `server_misconfigured` 500, `internal_error` 500.

## 7. Rotas

### Autenticação
| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/auth/discord?returnTo=/caminho` | Redireciona ao Discord (scope `identify guilds`, `state`) |
| GET | `/api/auth/discord/callback` | Valida `state`, troca o code, busca `@me` e `@me/guilds`, grava `users`/`user_guilds`, cria sessão, redireciona para `returnTo` ou `/` |
| POST | `/api/auth/logout` | Apaga a sessão e o cookie → `{ "ok": true }` |
| GET | `/api/me` | `{ user: { id, username, avatar }, guilds: [{ id, name, icon }], today, launchDate }` |

### Jogo diário
**GET `/api/game?mode=classico&date=2026-11-03`** (`date` opcional = hoje)
```json
{
  "mode": "classico", "date": "2026-11-03", "today": "2026-11-15", "isToday": false, "isArchive": true,
  "maxAttempts": 6, "wordLength": 5, "status": "playing",
  "attempts": [ { "guess": "CARRO", "feedback": ["absent","correct","present","absent","absent"] } ],
  "answer": null
}
```
No sombra, `feedback` é `{ "exact": 1, "misplaced": 2 }`. GET não cria partida.

**POST `/api/guess`** body `{ "mode": "classico", "date": "2026-11-15", "guess": "carro" }` → mesmo formato do GET, com o estado atualizado. Ao terminar, `answer` vem na forma de exibição (com acento).

**GET `/api/vaults?mode=classico`**
```json
{ "mode": "classico", "launchDate": "2026-11-01", "today": "2026-11-15",
  "days": [ { "date": "2026-11-15", "status": "untouched", "attempts": 0, "isArchive": false } ] }
```
`status`: `won` | `lost` | `playing` | `untouched`. Ordem decrescente de data.

**GET `/api/stats?mode=classico`**
```json
{ "mode": "classico", "played": 10, "wins": 8, "winRate": 80, "currentStreak": 3, "maxStreak": 5,
  "distribution": [0,1,3,2,2,0], "archive": { "played": 4, "wins": 3 } }
```

**GET `/api/ranking?mode=classico&scope=global|guild&guild=<id>&sort=wins|streak`**
```json
{ "mode": "classico", "scope": "guild", "guild": { "id": "1", "name": "Turma 3A" }, "sort": "wins",
  "entries": [ { "rank": 1, "userId": "1", "username": "joao", "avatar": "https://...", "wins": 8, "played": 10,
                 "avgAttempts": 3.6, "currentStreak": 3, "maxStreak": 5, "isMe": true } ],
  "me": null }
```
Somente partidas do próprio dia. `scope=guild` exige que o usuário seja membro da guild (senão `403 forbidden`). Top 50; `me` traz a posição do usuário quando ele não está no top.

### Desafio
| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/challenge` | body `{ "word": "praia" }` → valida no dicionário, máx. 20 por usuário por dia → `{ "id": "aB3dE9xYz1", "url": "/d/aB3dE9xYz1" }` |
| GET | `/api/challenge` | Desafios criados pelo usuário: `{ "challenges": [ { "id", "word", "createdAt", "plays", "wins" } ] }` |
| GET | `/api/challenge/:id` | Criador: `{ id, isCreator: true, word, creator, plays: [ { username, avatar, status, attempts } ] }`. Jogador: `{ id, isCreator: false, creator: { username, avatar }, maxAttempts: 6, wordLength: 5, status, attempts, answer }` |
| POST | `/api/challenge/:id/guess` | body `{ "guess": "..." }` → estado do jogador. Criador → `403 own_challenge` |
| GET | `/d/:id` | Página pública (sem login) com meta tags Open Graph ("<criador> te desafiou a abrir um cofre no Cypher") que redireciona para `/?desafio=<id>`. Não revela a palavra |

### Open Graph
- `public/og.png` (1200×630) e `public/og-desafio.png` (1200×630).
- `public/index.html` tem `og:title`, `og:description`, `og:image` (`/og.png`), `twitter:card=summary_large_image`.
- `functions/_middleware.js` reescreve as URLs relativas de `og:image` e `og:url` para absolutas (origin da requisição) com `HTMLRewriter`, somente em respostas `text/html`.

## 8. Estrutura de pastas

```
functions/_middleware.js
functions/api/auth/discord.js
functions/api/auth/discord/callback.js
functions/api/auth/logout.js
functions/api/me.js
functions/api/game.js
functions/api/guess.js
functions/api/vaults.js
functions/api/stats.js
functions/api/ranking.js
functions/api/challenge/index.js
functions/api/challenge/[id].js
functions/api/challenge/[id]/guess.js
functions/d/[id].js
src/config.js       constantes (LAUNCH_DATE, modos, limites)
src/http.js         json(), erro(), leitura de body
src/session.js      criação/validação de sessão, requireUser()
src/dates.js        hoje em America/Sao_Paulo, diferença de dias, validação
src/normalize.js    normalização de palavras
src/feedback.js     cálculo de feedback (clássico e sombra)
src/dictionary.js   conjunto de palavras válidas e mapa chave→exibição
src/words.js        sorteio/materialização da palavra diária
src/game.js         regras de jogo compartilhadas (estado, chute, estatísticas)
src/data/answers.js
src/data/valid.js
src/data/FONTES.md  origem e licença das listas
public/index.html, public/styles.css, public/js/*.js, public/og.png, public/og-desafio.png, public/favicon.svg
migrations/0001_init.sql
tests/
```
