# 🎬 Sessão da Turma: Catálogo de Filmes e Séries com Avaliações da Turma

- **Projeto:** #25 (Projeto Oficial Sorteado, valendo 100 pontos)
- **Estudante:** Sophia Vitoria Kramer de Liz
- **Turma:** 2A
- **Chave Única:** `P26-2A-52D1-7EC2-3200-758A`
- **URL_CLOUDFLARE:** https://projeto-p26-2a-52d1-7ec2-3200-758a.pages.dev
- **Licença:** [MIT](./LICENSE)

---

## O que o projeto faz

Agregador de críticas audiovisuais para a turma. Quem entra com o **Discord** pode:

- escolher um filme ou série da **lista base** (12 títulos) ou **cadastrar um novo**;
- dar uma nota de **1 a 5 estrelas** e escrever uma **resenha curta** (até 500 caracteres);
- **editar** ou **remover** a própria avaliação depois. Cada pessoa tem **uma única nota por obra**.

A **galeria** mostra a **média aritmética** e o **total de avaliações** de cada título, calculados no servidor, e pode ser
ordenada por **⭐ melhor nota**, **🔥 popularidade (mais avaliados)** ou **🆕 lançamentos recentes**, com filtro por tipo e busca.

## Arquitetura

| Camada | Tecnologia | Onde |
| :--- | :--- | :--- |
| Interface | HTML5, CSS3 e JavaScript puro (sem frameworks) | [`public/`](./public) |
| Backend serverless | Cloudflare Pages Functions | [`functions/api/`](./functions/api), [`lib/servidor.js`](./lib/servidor.js) |
| Banco de dados | Cloudflare D1 (SQLite) | [`migrations/0001_init.sql`](./migrations/0001_init.sql) |
| Login | Discord OAuth2 (importa `user_id`, nome e avatar) | [`functions/api/auth/`](./functions/api/auth) |

### Banco de dados (D1)

- `discord_users`: `user_id`, `username`, `avatar` importados do Discord.
- `sessoes`: sessões de login no servidor (o cookie guarda só um token aleatório).
- `titulos`: filmes e séries (`nome`, `tipo`, `ano_lancamento`, `genero`).
- `avaliacoes`: **chave primária composta `(user_id, filme_id)`**, `nota` com `CHECK` de 1 a 5 e `resenha`.
  A gravação usa `ON CONFLICT ... DO UPDATE`, então avaliar de novo **edita** a nota em vez de duplicar.

### Regras validadas no servidor (sem confiar no navegador)

- Só quem está logado pode cadastrar, avaliar ou remover (senão `401`).
- O `user_id` vem sempre da sessão no D1: ninguém consegue avaliar no nome de outra pessoa.
- Nota inteira de 1 a 5, resenha até 500 caracteres, tipo `filme`/`serie`, ano válido (senão `400`).
- Título duplicado é recusado (`409`).
- Login com `state` anti-CSRF; consultas SQL sempre parametrizadas.

### API

| Método | Rota | Login | Descrição |
| :--- | :--- | :---: | :--- |
| GET | `/api/titulos?ordem=media\|popularidade\|recentes&tipo=&busca=` | – | Galeria com média e total |
| POST | `/api/titulos` | ✔ | Cadastra um título |
| GET | `/api/titulos/:id` | – | Detalhes, distribuição das notas e resenhas |
| PUT | `/api/titulos/:id/avaliacao` | ✔ | Cria ou edita a sua avaliação |
| DELETE | `/api/titulos/:id/avaliacao` | ✔ | Remove a sua avaliação |
| GET | `/api/me` | – | Usuário logado |
| GET | `/api/auth/discord` · `/callback` | – | Login OAuth2 do Discord |
| POST | `/api/auth/logout` | – | Sair |
| GET | `/api/status` | – | Diagnóstico (D1 e Discord) |

## Agentes, harness e skills

O projeto foi desenvolvido com **3 agentes** (Arquiteto Serverless, Interface Vanilla e **Teste e Validação**) no harness do
**Claude** com o modelo **Claude Opus 5.5**. Os detalhes estão em [`AGENTS.md`](./AGENTS.md) e as skills em [`skills/`](./skills).

## Testes

```powershell
node testes/testar-api.mjs https://projeto-p26-2a-52d1-7ec2-3200-758a.pages.dev
```

A bateria completa (22 testes, incluindo as regras com login) está descrita em [`AGENTS.md`](./AGENTS.md#agente-3-teste-e-validação-obrigatório).

## Como publicar (Cloudflare Pages + D1 + Discord)

Nos computadores do laboratório, use `npx.cmd` no PowerShell.

1. **Autenticar o wrangler** com um token de API da Cloudflare (permissões *D1: Edit* e *Cloudflare Pages: Edit*):
   ```powershell
   $env:CLOUDFLARE_API_TOKEN = "seu-token"
   ```
2. **Banco D1** (o `database_id` já está em `wrangler.jsonc`, com o binding `DB`):
   ```powershell
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
3. **Publicar** (o projeto Pages foi criado com `wrangler pages project create projeto-p26-2a-52d1-7ec2-3200-758a --production-branch main`):
   ```powershell
   npx.cmd wrangler pages deploy
   ```
4. **Discord OAuth2:** no [Discord Developer Portal](https://discord.com/developers/applications), no app, em **OAuth2 → Redirects**:
   `https://projeto-p26-2a-52d1-7ec2-3200-758a.pages.dev/api/auth/discord/callback`. Depois, salvar as credenciais como segredos:
   ```powershell
   npx.cmd wrangler pages secret put DISCORD_CLIENT_ID
   npx.cmd wrangler pages secret put DISCORD_CLIENT_SECRET
   ```
5. **Validar antes do Pull Request** (na raiz do repositório):
   ```powershell
   node validar-local.mjs P26-2A-52D1-7EC2-3200-758A
   ```
