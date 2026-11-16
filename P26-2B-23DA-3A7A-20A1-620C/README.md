# Projeto #7: Jogo da Memória Temático (Código ↔ Saída)

- **Estudante:** Julio Cesar dos Santos Ventura (Turma 2B)
- **Chave Única:** `P26-2B-23DA-3A7A-20A1-620C`
- **URL_CLOUDFLARE:** `https://p26-2b-23da-3a7a-20a1-620c.pages.dev`
- **Site em execução:** [Abrir o jogo](https://p26-2b-23da-3a7a-20a1-620c.pages.dev)
- **Licença:** MIT

## O jogo

Jogo da memória em que cada trecho de código JavaScript combina com a saída que ele produz. O jogador faz login com o Discord, vira duas cartas por jogada e o servidor confirma se formam um par.

## Arquitetura

- **Frontend:** HTML5, CSS3 e JavaScript puro, sem frameworks. As cartas giram com `transform-style: preserve-3d` e `rotateY`, acionadas por JavaScript.
- **Backend:** Cloudflare Pages Functions em `functions/`.
- **Banco:** Cloudflare D1, com migrations em `migrations/`.
- **Autenticação:** exclusivamente Discord OAuth2 (escopo `identify`), importando `user_id`, nome e avatar.

## Rotas

| Rota | Função |
|---|---|
| `GET /api/auth/discord` | Inicia o login (com `state` anti-CSRF) |
| `GET /api/auth/discord/callback` | Conclui o login e cria a sessão |
| `POST /api/auth/logout` | Encerra a sessão |
| `GET /api/me` | Usuário logado |
| `POST /api/game/start` | Embaralha no servidor e devolve só IDs opacos |
| `POST /api/game/reveal` | Revela uma carta (máximo de 2 por turno) |
| `POST /api/game/check` | Valida o par, incrementa movimentos e fecha a partida |
| `GET /api/game/state` | Retoma a partida ativa |

## Anti-manipulação (validado no servidor)

- O `pair_key` e o conteúdo das cartas ocultas nunca chegam ao navegador.
- O embaralhamento usa `crypto.getRandomValues`.
- O token de sessão fica só no cookie `HttpOnly`; no D1 é guardado apenas o hash SHA-256.
- O servidor só compara as cartas que ele mesmo registrou como viradas.
- Tempo oficial e eficiência (`pares / movimentos`) são calculados no servidor.

## Executar localmente

```powershell
npm.cmd install
# crie .dev.vars com DISCORD_CLIENT_ID e DISCORD_CLIENT_SECRET (nunca versionar)
npx.cmd wrangler d1 migrations apply db-p26-2b-23da-3a7a-20a1-620c --local
npx.cmd wrangler pages dev
```

Acesse `http://localhost:8788` (o redirect do Discord usa `localhost`).

## Agentes e harness

Veja [`AGENTS.md`](./AGENTS.md) e a pasta [`skills/`](./skills/).

## Licença

MIT (veja `LICENSE`).