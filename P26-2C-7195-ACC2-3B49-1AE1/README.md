# Projeto #10: Rastreador de Hábitos (Habit Tracker)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Lorenzzo Oliveira Figueiredo de Freitas
- **Turma:** 2C
- **Chave Única:** `P26-2C-7195-ACC2-3B49-1AE1`
- **URL_CLOUDFLARE:** `https://p26-2c-7195-acc2-3b49-1ae1.pages.dev` *(Atualize com a URL pública real do seu deploy na Cloudflare antes de abrir o Pull Request)*
- **Licença:** [MIT](LICENSE)
- **Agentes, harness e skills:** [AGENTS.md](AGENTS.md) · [skills/](skills/)

---

## O que é

Painel de acompanhamento de hábitos diários com uma grade matricial dos dias do mês corrente. Depois de entrar com o Discord, o usuário cadastra metas recorrentes e marca os dias em que as cumpriu; as barras de progresso em CSS atualizam na hora. As conclusões ficam no **Cloudflare D1** e o backend devolve as métricas consolidadas: **maior sequência (streak máximo)**, **sequência atual** e **taxa percentual de cumprimento mensal**.

## Stack

- **Cliente:** HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks de interface.
- **Backend:** Cloudflare Pages Functions (serverless).
- **Banco:** Cloudflare D1 (SQLite).
- **Autenticação:** OAuth2 do Discord (escopo `identify`): importa `user_id`, nome de usuário e avatar.

## Estrutura

```
public/                   interface (index.html, styles.css, app.js, _headers)
functions/api/            rotas: auth/*, me, dashboard, habits/*, status
lib/                      regras de negócio e utilitários (stats, sessão, Discord, HTTP)
migrations/                esquema do D1 (0001 do scaffold + 0002 do app)
tests/                    testes (node --test)
skills/                   skills usados pelos agentes
.claude/agents/           definição dos 3 agentes
wrangler.jsonc            configuração do Pages + binding do D1
```

## API

Todas as respostas são JSON. Erros: `{ "error": { "code", "message" } }`. As rotas que alteram dados exigem sessão, `Origin` igual à origem do site e `Content-Type: application/json`.

| Método e rota | Descrição |
|---|---|
| `GET /api/auth/discord` | Inicia o OAuth2 do Discord (redireciona) |
| `GET /api/auth/discord/callback` | Conclui o login, grava o usuário no D1 e abre a sessão |
| `POST /api/auth/logout` | Encerra a sessão |
| `GET /api/me` | Usuário logado: `{ user: { id, username, displayName, avatarUrl } }` |
| `GET /api/dashboard?month=YYYY-MM` | Painel do mês (padrão: mês atual): hábitos, dias concluídos e métricas |
| `POST /api/habits` | Cria hábito `{ name, color? }` → `201 { habit }` |
| `DELETE /api/habits/:id` | Exclui o hábito e suas conclusões |
| `PUT /api/habits/:id/completions` | Marca/desmarca um dia `{ date: "YYYY-MM-DD", done: boolean }` → painel do mês recalculado |
| `GET /api/status` | Verificação de saúde (Functions + D1) |

Formato de `GET /api/dashboard`:

```json
{
  "month": "2026-11", "today": "2026-11-12", "daysInMonth": 30,
  "user": { "id": "…", "username": "…", "displayName": "…", "avatarUrl": "…" },
  "habits": [{
    "id": 1, "name": "Meditar", "color": "#5eead4",
    "completedDates": ["2026-11-10", "2026-11-11", "2026-11-12"],
    "stats": { "currentStreak": 3, "maxStreak": 7, "monthCompleted": 3, "monthEligible": 12, "monthRate": 25 }
  }],
  "overall": { "currentStreak": 3, "maxStreak": 7, "monthCompleted": 3, "monthEligible": 12, "monthRate": 25 }
}
```

### Regras de negócio (validadas no servidor)

- Sessão em cookie `HttpOnly` assinado com HMAC-SHA256; o `state` do OAuth2 é conferido no retorno.
- Cada usuário só acessa os próprios hábitos (hábito alheio responde `404`).
- Nome do hábito de 1 a 60 caracteres, único por usuário (sem diferenciar maiúsculas), até 30 hábitos; cor `#RRGGBB`.
- Datas precisam ser reais (`YYYY-MM-DD`) e **não podem ser futuras** (o "hoje" é calculado no fuso `APP_TZ`, padrão `America/Sao_Paulo`).
- **Streak máximo:** maior sequência de dias consecutivos já registrada.
- **Streak atual:** sequência que termina hoje; se hoje ainda não foi marcado, vale a que termina ontem.
- **Taxa mensal:** dias concluídos ÷ dias do mês já decorridos (mês passado = mês inteiro; mês futuro = 0%).
- **Indicadores gerais** (topo da tela): streaks = o melhor entre os hábitos; taxa = soma das conclusões ÷ soma dos dias elegíveis.

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Project name:** `p26-2c-7195-acc2-3b49-1ae1` (define a URL `https://p26-2c-7195-acc2-3b49-1ae1.pages.dev`; se usar outro nome, atualize a URL acima e o redirect do Discord)
   - **Root directory (Diretório raiz):** `P26-2C-7195-ACC2-3B49-1AE1`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. O banco D1 `db-p26-2c-7195-acc2-3b49-1ae1` já está declarado em `wrangler.jsonc` (binding `DB`). Aplique o esquema no terminal do laboratório (Scoop):
   ```powershell
   cd P26-2C-7195-ACC2-3B49-1AE1
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Confira o binding do D1** em Settings → Functions → **D1 database bindings**: deve existir `DB` apontando para o banco acima. Se não aparecer, adicione manualmente (Variable name `DB`).
5. **Discord OAuth2:**
   - No [Discord Developer Portal](https://discord.com/developers/applications), crie uma Application.
   - Na aba **OAuth2**, copie o **Client ID** e gere o **Client Secret**.
   - Em **Redirects**, adicione exatamente:
     - `https://p26-2c-7195-acc2-3b49-1ae1.pages.dev/api/auth/discord/callback`
     - `http://localhost:8788/api/auth/discord/callback` (somente para desenvolvimento local)
6. No projeto Pages: **Settings** → **Variables and Secrets** (ambiente *Production*). Crie como **Secret** (criptografado):
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `SESSION_SECRET` — string aleatória com 32+ caracteres. Para gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - *(Opcional)* `APP_TZ` — fuso usado para decidir "hoje" (padrão `America/Sao_Paulo`).
   
   Depois de criar ou alterar variáveis, faça um novo deploy (ou **Retry deployment**) para elas valerem.
7. Abra a URL pública, confira `/api/status` (deve mostrar `"db": "ok"`) e faça login com o Discord.
8. Atualize **URL_CLOUDFLARE** no topo deste README, se necessário, e execute na raiz do repositório:
   `node validar-local.mjs P26-2C-7195-ACC2-3B49-1AE1`
9. Faça commit, push no seu fork e abra o Pull Request. Poste as URLs do projeto e do repositório no AVA.

### Desenvolvimento local

```powershell
copy .dev.vars.example .dev.vars        # preencha os 3 valores
npm run db:migrate:local
npm run dev                             # http://localhost:8788
```

## Testes

```bash
npm test
```

33 testes: regras de streak e taxa (`tests/stats.test.mjs`) e ponta a ponta das Functions com D1 simulado e Discord mockado (`tests/api.test.mjs`). Exige Node 22.13+. Detalhes em [skills/teste-validacao](skills/teste-validacao/SKILL.md).

## Agentes e skills

Três agentes no Claude Code — `arquiteto-backend`, `dev-frontend` e `qa-validador` (teste e validação) — documentados em [AGENTS.md](AGENTS.md), com seus skills em [skills/](skills/).

## Licença

[MIT](LICENSE) © 2026 Lorenzzo Oliveira Figueiredo de Freitas
