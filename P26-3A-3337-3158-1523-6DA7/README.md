# Projeto #20: Gerenciador de Horas Complementares

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Lucas Oliveira Pires
- **Turma:** 3A
- **Chave Única:** `P26-3A-3337-3158-1523-6DA7`
- **URL_CLOUDFLARE:** `https://p26-3a-3337-3158-1523-6da7.pages.dev/`
- **Repositório:** https://github.com/LucasPiresGit/Avalia2026-2 (pasta `P26-3A-3337-3158-1523-6DA7/`)
- **Licença:** [MIT](./LICENSE)

---

## Especificação do Projeto

Sistema de controle das atividades formativas exigidas para a graduação. Após autenticar-se com o Discord, o estudante registra eventos, cursos ou projetos de extensão realizados, informando a categoria (ensino, pesquisa, extensão), a carga horária total e o link externo para o certificado digital.

A lógica de negócios, validada nas Cloudflare Pages Functions antes da gravação no D1, aplica a regra de teto máximo de horas por categoria (60 horas por modalidade). O painel principal em HTML/CSS exibe barras de progresso com as horas já validadas em cada eixo e quanto falta para integralizar a exigência curricular.

> **Premissa da exigência curricular:** o enunciado fala em "ex: máximo de 60 horas em uma única modalidade". Adotamos 60 h por categoria e 3 categorias, ou seja, **180 h** para integralizar. Os valores estão centralizados em `functions/_utils.js` (`CAP_PER_CATEGORY`, `TOTAL_REQUIRED`) e a interface os lê da API, então ajustar a regra exige mudar um único arquivo.

---

## Stack

| Camada | Tecnologia |
| :--- | :--- |
| Cliente | HTML5, CSS3 e JavaScript puro (Vanilla JS), sem frameworks e sem CDNs |
| Backend | Cloudflare Pages Functions (`functions/`) |
| Banco | Cloudflare D1 (SQLite) — `migrations/0001_init.sql` |
| Autenticação | Discord OAuth2 (authorization code, escopo `identify`) — importa `user_id`, nome e avatar |
| Testes | `node --test` (Node ≥ 22), sem dependências |

## Funcionalidades

- Login **exclusivo** via Discord (não existe login alternativo ou modo demonstração).
- Registro de atividade: categoria (ensino / pesquisa / extensão), título, carga horária e link do certificado (http/https).
- **Teto de 60 h por categoria**, aplicado no servidor de forma atômica (um único `INSERT ... SELECT ... WHERE soma + novas horas <= 60`), inclusive sob requisições concorrentes. Excedente → HTTP `409` com as horas ainda disponíveis.
- Painel com barras de progresso por eixo e total (horas validadas, teto e quanto falta), com `role="progressbar"`.
- Listagem das atividades do próprio estudante, com link do certificado e remoção.
- Interface responsiva e acessível; rodapé com a Chave Única de auditoria.

## Segurança (validação no servidor, sem confiar no cliente)

- **Sessão assinada:** cookie `HttpOnly; Secure; SameSite=Lax` no formato `payload.assinatura` (HMAC-SHA256 via Web Crypto) com expiração de 24 h. Cookies forjados, adulterados ou expirados resultam em `401`.
- **OAuth2 com `state`:** valor aleatório em cookie `HttpOnly`, conferido no callback (proteção contra CSRF de login).
- **Identidade só da sessão:** `user_id`/`username` nunca vêm do corpo da requisição; cada estudante só enxerga e remove os próprios registros.
- **Queries parametrizadas** (`prepare().bind()`), validação de categoria, horas (número positivo, 2 casas) e URL (somente http/https), checagem de `Origin` nas escritas.
- Segredo de assinatura: `SESSION_SECRET` (opcional); se não existir, usa `DISCORD_CLIENT_SECRET`.

## Estrutura

```
P26-3A-3337-3158-1523-6DA7/
├── public/                  # Frontend: index.html, styles.css, app.js
├── functions/
│   ├── _utils.js            # sessão assinada, validações, regras e esquema
│   └── api/
│       ├── activities.js    # GET / POST / DELETE  (regra de teto aqui)
│       ├── summary.js       # horas por eixo e quanto falta
│       ├── status.js        # saúde da API / D1 / sessão
│       └── auth/
│           ├── discord.js           # inicia OAuth2 (state)
│           ├── logout.js
│           └── discord/callback.js  # troca code, lê @me, cria sessão
├── migrations/0001_init.sql # discord_users e activities
├── tests/                   # node --test (API, segurança, rubrica)
├── skills/                  # SKILL.md dos agentes
├── AGENTS.md                # agentes, harness e resultados de teste
├── wrangler.jsonc
├── LICENSE
└── README.md
```

## API

| Método e rota | Auth | Descrição |
| :--- | :---: | :--- |
| `GET /api/auth/discord` | — | Redireciona ao Discord (gera `state`). `503` se o OAuth não estiver configurado. |
| `GET /api/auth/discord/callback` | — | Valida `state`, troca o `code`, grava o usuário no D1 e cria a sessão. |
| `GET /api/auth/logout` | — | Remove o cookie de sessão. |
| `GET /api/status` | opcional | Saúde da API, D1 e usuário da sessão. |
| `GET /api/summary` | ✅ | Horas por eixo, quanto falta por eixo e no total. |
| `GET /api/activities` | ✅ | Atividades do usuário. |
| `POST /api/activities` | ✅ | Registra atividade. `400` inválido · `409` teto excedido. |
| `DELETE /api/activities?id=` | ✅ | Remove atividade do próprio usuário (`404` se não for dele). |

---

## Como Publicar esta Subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. No painel da Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o seu fork do repositório `Avalia2026-2`.
2. Configure os parâmetros de build apontando para esta subpasta:
   - **Root directory (Diretório raiz):** `P26-3A-3337-3158-1523-6DA7`
   - **Build command:** *(deixe em branco — HTML/CSS/JS puro)*
   - **Build output directory:** `public`
3. Crie o banco de dados D1 e aplique a migração inicial (no terminal do laboratório usando Scoop):
   ```powershell
   cd P26-3A-3337-3158-1523-6DA7
   npx.cmd wrangler d1 create db-p26-3a-3337-3158-1523-6da7
   # Copie o database_id gerado para o arquivo wrangler.jsonc e execute:
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
4. **Vincule o Banco D1 (binding `DB`):** o `wrangler.jsonc` já declara o binding `DB`; confira em **Settings → Functions → D1 database bindings** que ele aponta para `db-p26-3a-3337-3158-1523-6da7`.
5. **Configuração do Discord OAuth2:**
   - No [Discord Developer Portal](https://discord.com/developers/applications), crie uma Application e, na aba **OAuth2**, copie o **Client ID** e gere o **Client Secret**.
   - Em **Redirects**, adicione a URL exata do deploy:
     `https://p26-3a-3337-3158-1523-6da7.pages.dev/api/auth/discord/callback`
   - No projeto do Cloudflare Pages, em **Settings → Variables and Secrets**, defina `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (e, opcionalmente, `SESSION_SECRET` com um valor aleatório longo).
6. Faça um novo deploy (**Retry deployment** ou novo `git push`) para que as variáveis passem a valer.
7. Na raiz do repositório, execute `node validar-local.mjs P26-3A-3337-3158-1523-6DA7` e, dentro da subpasta, `node --test` antes de abrir o Pull Request.

## Testes

```powershell
cd P26-3A-3337-3158-1523-6DA7
node --test
```

Os testes executam as Functions de verdade sobre um D1 simulado em SQLite (`tests/d1-shim.mjs`) e cobrem autenticação/sessão forjada, validações, teto por categoria (inclusive concorrência), isolamento entre usuários, fluxo OAuth2 com `state` e conformidade da entrega (chave no rodapé/README, licença MIT, sem frameworks, agentes e skills).

## Engenharia de Agentes

Veja [`AGENTS.md`](./AGENTS.md) (agentes, harness, skills e resultados de teste) e a pasta [`skills/`](./skills).

## Licença

[MIT](./LICENSE) © 2026 Lucas Oliveira Pires (`P26-3A-3337-3158-1523-6DA7`)
