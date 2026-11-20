# Projeto #32: Gerenciador de Eventos e Controle de Presença (RSVP)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Gabriel Fortunato
- **Turma:** 3A
- **Chave Única:** `P26-3A-DAD6-042E-642E-9A58`
- **URL_CLOUDFLARE:** https://p26-3a-dad6-042e-642e-9a58.pages.dev
- **Licença:** MIT ([LICENSE](LICENSE))

---

## Especificação do Projeto

Construa uma plataforma para organização de palestras, grupos de estudo e encontros acadêmicos. O criador do evento (autenticado via Discord) define título, local, data, horário e capacidade máxima de participantes do auditório ou sala.

Quando outros estudantes acessam a página do evento e confirmam presença, o backend na Cloudflare verifica no banco D1 se a lotação máxima já foi atingida. Caso as vagas estejam esgotadas, o sistema insere automaticamente o usuário em uma fila de espera ordenada por horário de solicitação, promovendo o primeiro da fila caso algum participante confirmado cancele sua inscrição.

---

## O que o sistema faz

- **Login exclusivo via Discord OAuth2** (escopo `identify`): importa `user_id`, nome de usuário e avatar.
- **Criar evento** com título, descrição, local, data, horário e capacidade máxima.
- **Lista de próximos eventos** com vagas restantes, além de um filtro "Meus eventos".
- **Página do evento** com confirmados, fila de espera numerada e link para compartilhar.
- **Confirmar presença:** se houver vaga, a inscrição é confirmada; se o evento estiver lotado, o estudante entra na fila de espera, ordenada pelo horário da solicitação.
- **Cancelar inscrição:** se quem cancela estava confirmado, o primeiro da fila é promovido automaticamente.
- **Excluir evento:** só o criador pode.

## Arquitetura

```
Navegador (HTML5 + CSS3 + Vanilla JS)          Cloudflare
┌──────────────────────────┐   fetch    ┌───────────────────────────────┐
│ public/index.html        │ ─────────▶ │ Pages Functions (functions/)  │
│ public/app.js  (SPA hash)│ ◀───────── │  validação + regras de negócio│
│ public/styles.css        │    JSON    └──────────────┬────────────────┘
└──────────────────────────┘                           │ SQL parametrizado
        │ login                                        ▼
        ▼                                    ┌──────────────────┐
  discord.com/oauth2 ──── code ────▶ callback│  Cloudflare D1   │
                                             │  (SQLite)        │
                                             └──────────────────┘
```

| Pasta | Conteúdo |
|---|---|
| `public/` | Interface em HTML5, CSS3 e JavaScript puro, sem frameworks |
| `functions/` | Cloudflare Pages Functions (API e OAuth2 do Discord) |
| `migrations/` | Esquema SQLite do D1 |
| `tests/` | Testes automatizados (`node:test` com D1 simulado em `sql.js`) |
| `docs/contrato-api.md` | Contrato da API: rotas, JSON, erros e regra da fila |
| `AGENTS.md`, `agents/`, `skills/` | Engenharia de agentes: harness, agentes e skills |

### Regras de negócio no servidor

O cliente nunca decide o status da inscrição. O backend:

1. Valida tudo o que chega: tamanhos, data AAAA-MM-DD não passada no fuso de
   Brasília, hora HH:MM e capacidade inteira de 1 a 10000.
2. Decide entre **confirmado** e **fila** e grava a inscrição **numa única
   instrução SQL** (`INSERT … SELECT … CASE WHEN confirmados < capacidade`).
   Assim, inscrições simultâneas nunca passam da lotação.
3. No cancelamento, apaga a inscrição e promove o primeiro da fila (menor
   `requested_at`) **na mesma transação** (`DB.batch`). A promoção só acontece
   se houver vaga, então quem sai da fila não promove ninguém.

### Segurança

- Sessão com cookie opaco `__Host-session` (`HttpOnly`, `Secure`,
  `SameSite=Lax`). O D1 guarda só o hash SHA-256 do cookie.
- `state` do OAuth2 aleatório e de uso único, para evitar CSRF no login.
- O access token do Discord é revogado logo depois de ler o perfil.
- Toda requisição que altera dados (`POST`/`DELETE`) exige `Origin` igual ao
  do site.
- SQL sempre parametrizado (`prepare().bind()`).
- A interface monta o DOM só com `textContent`, o que evita XSS.

## API

| Método | Rota | Descrição |
|---|---|---|
| GET | `/api/auth/discord` | Inicia o login Discord OAuth2 |
| GET | `/api/auth/discord/callback` | Retorno do Discord; cria a sessão |
| POST | `/api/auth/logout` | Encerra a sessão |
| GET | `/api/me` | Usuário logado (`user_id`, nome e avatar) |
| GET / POST | `/api/events` | Lista ou cria eventos |
| GET / DELETE | `/api/events/:id` | Detalhe do evento (confirmados e fila) ou exclusão pelo criador |
| POST / DELETE | `/api/events/:id/rsvp` | Confirma presença (ou entra na fila) e cancela |

Os detalhes estão em [`docs/contrato-api.md`](docs/contrato-api.md).

## Testes

```bash
cd tests
npm install
npm test
```

São 79 testes. Eles executam os handlers reais de `functions/` contra um
SQLite em memória e cobrem lotação, ordem e promoção da fila, inscrições
concorrentes, autorização, validação, OAuth2 e os requisitos de entrega.
Veja [`AGENTS.md`](AGENTS.md).

## Engenharia de agentes

O projeto foi construído com **3 agentes** no harness **Claude Code**:
Serverless/D1/Discord, Interface Vanilla e Teste e Validação. Cada agente
seguiu uma skill própria. O documento completo está em [`AGENTS.md`](AGENTS.md).

## Publicação (Cloudflare Pages + D1 + Discord)

1. **D1:** crie o banco e aplique a migração:
   ```bash
   npx wrangler d1 create db-p26-3a-dad6-042e-642e-9a58
   # copie o database_id para wrangler.jsonc
   npx wrangler d1 migrations apply db-p26-3a-dad6-042e-642e-9a58 --remote
   ```
2. **Discord:** no [Developer Portal](https://discord.com/developers/applications),
   crie a aplicação e cadastre o redirect
   `https://p26-3a-dad6-042e-642e-9a58.pages.dev/api/auth/discord/callback`.
   Coloque o Client ID em `vars.DISCORD_CLIENT_ID` no `wrangler.jsonc`.
3. **Segredo:**
   ```bash
   npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name p26-3a-dad6-042e-642e-9a58
   ```
4. **Deploy:** rode a partir desta pasta:
   ```bash
   npx wrangler pages deploy
   ```
   O `wrangler.jsonc` define a pasta `public`, o binding `DB` e as variáveis
   `PUBLIC_BASE_URL` e `DISCORD_CLIENT_ID`. A pasta `functions/` é publicada
   junto automaticamente.

## Licença

Distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
