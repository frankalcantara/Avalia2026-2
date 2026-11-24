# Projeto #26 — Sistema de Enquetes e Votação Verificada

- **Modalidade:** Projeto Oficial Sorteado (valendo 100 pontos)
- **Estudante:** Cleinaldo Ferreira Bretas
- **Turma:** 2B
- **Chave Única:** `P26-2B-86B9-E260-A00B-F564`
- **URL Cloudflare:** `https://p26-2b-86b9-e260-a00b-f564.pages.dev`
- **Repositório GitHub:** [`https://github.com/CleinaldoBretas/Avalia2026-2`](https://github.com/CleinaldoBretas/Avalia2026-2)
- **Licença:** MIT (arquivo [`LICENSE`](./LICENSE))

---

## 1. Especificação atendida

Plataforma de enquetes para decisão coletiva. Qualquer usuário autenticado via **Discord OAuth2** pode criar uma enquete informando título, descrição, prazo de encerramento e múltiplas opções de escolha. O servidor (Cloudflare Pages Functions + D1) é a autoridade do escrutínio:

- valida a sessão assinada do Discord (`user_id`, nome e avatar);
- verifica se a enquete ainda está dentro do prazo (`closes_at`);
- bloqueia voto duplicado do mesmo `user_id` na mesma enquete;
- valida se a opção escolhida pertence à enquete;
- devolve os dados consolidados para o cliente renderizar **barras horizontais proporcionais** à porcentagem de cada opção.

### Regras de negócio validadas no servidor

| Regra | Onde é validada | Resposta |
| --- | --- | --- |
| Autenticação obrigatória | `functions/api/polls.js` e `functions/api/vote.js` | `401 unauthorized` |
| Título entre 3 e 120 caracteres | `functions/api/polls.js` | `400 title_invalid` |
| Prazo válido e futuro | `functions/api/polls.js` | `400 deadline_invalid` / `deadline_past` |
| Entre 2 e 10 opções sem duplicidade | `functions/api/polls.js` | `400 options_minimum` / `options_maximum` / `options_duplicated` |
| Enquete dentro do prazo | `functions/api/vote.js` | `409 poll_closed` |
| Opção pertencente à enquete | `functions/api/vote.js` | `404 option_not_found` |
| Um voto por `user_id` por enquete | `functions/api/vote.js` + `UNIQUE (poll_id, user_id)` | `409 already_voted` |
| Sessão não pode ser forjada | Cookie assinado com HMAC-SHA-256 | Sessão inválida é descartada |

---

## 2. Arquitetura

```
P26-2B-86B9-E260-A00B-F564/
├── functions/
│   └── api/
│       ├── _lib.js                  # sessão HMAC, schema defensivo, consolidação
│       ├── auth/
│       │   ├── discord.js           # inicia OAuth2 com state (CSRF)
│       │   ├── logout.js            # encerra sessão
│       │   └── discord/
│       │       └── callback.js      # troca code, importa perfil, grava no D1
│       ├── me.js                    # usuário autenticado
│       ├── polls.js                 # GET lista / POST cria enquete
│       ├── vote.js                  # POST registra voto verificado
│       └── status.js                # diagnóstico de deploy
├── migrations/
│   └── 0001_init.sql                # schema D1
├── public/
│   ├── index.html                   # HTML5 semântico
│   ├── styles.css                   # CSS3 responsivo
│   └── app.js                       # JavaScript puro (DOM)
├── skills/
│   ├── serverless-d1-discord/SKILL.md
│   ├── vanilla-dom-ui/SKILL.md
│   └── teste-validacao/SKILL.md
├── AGENTS.md                        # engenharia de agentes e harness
├── LICENSE                          # MIT
├── README.md
└── wrangler.jsonc
```

### Rotas serverless

| Método | Rota | Função |
| --- | --- | --- |
| `GET` | `/api/auth/discord` | Redireciona para o Discord OAuth2 com `state` |
| `GET` | `/api/auth/discord/callback` | Troca o code, importa o perfil e emite sessão |
| `POST` | `/api/auth/logout` | Remove o cookie de sessão |
| `GET` | `/api/me` | Retorna o usuário autenticado |
| `GET` | `/api/polls` | Lista enquetes com resultados consolidados |
| `POST` | `/api/polls` | Cria enquete autenticada |
| `POST` | `/api/vote` | Registra voto com validação de prazo e duplicidade |
| `GET` | `/api/status` | Diagnóstico de D1, OAuth2 e totais |

### Modelo de dados (Cloudflare D1)

- `discord_users` — `user_id` (PK), `username`, `avatar`.
- `polls` — `id`, `owner_id`, `owner_name`, `title`, `description`, `closes_at`.
- `poll_options` — `id`, `poll_id`, `label`, `position`.
- `votes` — `id`, `poll_id`, `option_id`, `user_id`, com `UNIQUE (poll_id, user_id)`.

---

## 3. Deploy no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare, acesse **Workers & Pages → Create → Pages → Connect to Git** e selecione o fork do repositório `Avalia2026-2`.
2. Configure o build apontando para esta subpasta:
   - **Root directory:** `P26-2B-86B9-E260-A00B-F564`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco D1 e aplique a migração:
   ```powershell
   cd P26-2B-86B9-E260-A00B-F564
   npx.cmd wrangler d1 create db-p26-2b-86b9-e260-a00b-f564
   # Copie o database_id retornado para wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o D1 ao projeto Pages** (obrigatório para ativar `env.DB`):
   - Cloudflare Pages → seu projeto → **Settings → Functions → D1 database bindings**.
   - **Variable name:** `DB`
   - **D1 database:** `db-p26-2b-86b9-e260-a00b-f564`
5. **Crie a aplicação no Discord Developer Portal** (https://discord.com/developers/applications):
   - Copie **Client ID** e **Client Secret** na aba OAuth2.
   - Em **Redirects**, cadastre exatamente:
     `https://p26-2b-86b9-e260-a00b-f564.pages.dev/api/auth/discord/callback`
6. **Variáveis de ambiente no Cloudflare Pages** (**Settings → Environment variables**):
   - `DISCORD_CLIENT_ID`
   - `DISCORD_CLIENT_SECRET`
   - `SESSION_SECRET` *(recomendado: string aleatória longa para assinar o cookie)*
7. Faça o deploy e substitua a **URL Cloudflare** no topo deste README pela URL real.
8. Valide a entrega localmente:
   ```powershell
   node validar-local.mjs P26-2B-86B9-E260-A00B-F564
   ```

> Sem `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`, a interface exibe o aviso de OAuth2 não configurado. Sem o binding `DB`, as rotas retornam `d1_unavailable`.

---

## 4. Desenvolvimento local (opcional)

```powershell
cd P26-2B-86B9-E260-A00B-F564
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler pages dev public --d1 DB=db-p26-2b-86b9-e260-a00b-f564
```

Para testar o login real em `http://localhost:8788`, cadastre também o redirect local no Discord Developer Portal e defina as variáveis de ambiente no seu shell.

---

## 5. Engenharia de agentes, harness e skills

A documentação completa está em [`AGENTS.md`](./AGENTS.md). Foram utilizados **3 agentes** no harness **opencode CLI**:

1. **Agente 1 — Arquiteto Serverless, D1 e Segurança Discord OAuth2**
   - Skill: [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
2. **Agente 2 — Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)**
   - Skill: [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
3. **Agente 3 — Teste, Auditoria de Segurança e Validação (obrigatório)**
   - Skill: [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)

---

## 6. Rastreabilidade

- **Chave Única:** `P26-2B-86B9-E260-A00B-F564` (presente neste README e no rodapé da interface).
- **Licença:** MIT.
- **Entrega no AVA:** informar a URL pública do projeto e a URL do repositório GitHub.

Copyright (c) 2026 Cleinaldo Ferreira Bretas — P26-2B-86B9-E260-A00B-F564.
