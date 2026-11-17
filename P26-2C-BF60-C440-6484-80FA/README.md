# Projeto #24: Plataforma de Empréstimo e Troca de Livros Físicos

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Roger Costa Moreira
- **Turma:** 2C
- **Chave Única:** `P26-2C-BF60-C440-6484-80FA`
- **URL_CLOUDFLARE:** `https://p26-2c-bf60-c440-6484-80fa.pages.dev`
- **Licença:** [MIT](./LICENSE)

Catálogo comunitário em que estudantes listam livros técnicos ou literários do acervo pessoal que
aceitam **emprestar** ou **trocar** com colegas. O login é feito **exclusivamente com Discord OAuth2**,
que identifica o dono do exemplar e expõe o handle (`@usuario`) para combinar a entrega presencial.

---

## Funcionalidades

- **Login via Discord OAuth2** (`scope=identify`): importa `user_id`, nome (`global_name`), handle e avatar.
  Proteção CSRF com `state`; sessão opaca guardada no D1 (o cookie leva só um token aleatório).
- **Catálogo público** com busca por título/autor e filtros por categoria, status e modalidade.
- **Cadastro de livros** (título, autor, categoria, modalidade, estado de conservação, ISBN, descrição).
- **Pedidos de empréstimo ou troca**: o livro passa a **Reservado** enquanto o pedido está pendente.
- **Painel do dono**: aprova (registrando **quem está com o exemplar** e a **data prevista de devolução**),
  recusa ou registra a devolução. Em trocas, a aprovação transfere a posse dos livros.
- **Status do inventário** no D1: `Disponível` → `Reservado` → `Emprestado` → `Disponível`.

## Regras de negócio validadas no servidor (anti-manipulação)

Toda regra roda nas Pages Functions; o frontend só exibe o que o servidor devolve.

| Regra | Resposta |
|---|---|
| Escrita sem sessão válida | `401` |
| Editar/excluir/aprovar recurso de outra pessoa | `403` |
| Pedir o próprio livro, ou modalidade não aceita pelo livro | `400` |
| Pedir livro que não está `Disponível` (inclusive corrida entre dois pedidos) | `409` |
| Mais de 3 pedidos pendentes por usuário / 100 livros por dono | `429` |
| Data de devolução no passado ou além de 90 dias | `400` |
| Excluir livro reservado ou emprestado | `409` |
| `status`, `owner_id`, `holder_id` enviados pelo cliente | ignorados |
| POST/PATCH sem `Content-Type: application/json` | `415` |

Transições usam `D1.batch()` com `UPDATE ... WHERE status = ?` e conferência de `meta.changes`, e um
índice único parcial garante no máximo um pedido pendente por livro.

## Estrutura

```
P26-2C-BF60-C440-6484-80FA/
├── public/            Frontend HTML5 + CSS3 + JavaScript puro (sem frameworks)
├── functions/api/     Cloudflare Pages Functions (rotas da API)
├── src/               Código compartilhado do backend (sessão, validação, respostas)
├── migrations/        Esquema SQL do Cloudflare D1
├── docs/API.md        Contrato da API (fonte de verdade entre os agentes)
├── tests/             Suíte e2e do agente de teste + relatório
├── agents/            Definições dos 3 agentes
├── skills/            SKILL.md usados pelos agentes
├── AGENTS.md          Documentação dos agentes e do harness
├── wrangler.jsonc     Configuração Pages + binding D1
└── LICENSE            MIT
```

## Rodando localmente

```powershell
cd P26-2C-BF60-C440-6484-80FA
npx.cmd wrangler d1 migrations apply DB --local
# Crie .dev.vars com DISCORD_CLIENT_ID=... e DISCORD_CLIENT_SECRET=...
npx.cmd wrangler pages dev public --port 8788
```

Adicione `http://localhost:8788/api/auth/discord/callback` aos Redirects do app no Discord para testar o login local.
Testes de ponta a ponta (com o servidor local rodando):

```powershell
node tests/e2e.mjs http://localhost:8788
```

## Publicação no Cloudflare Pages + D1 + Discord OAuth2

1. **Workers & Pages → Create → Pages → Connect to Git**, selecione o fork `Avalia2026-2`.
   - **Root directory:** `P26-2C-BF60-C440-6484-80FA`
   - **Build command:** *(em branco)*
   - **Build output directory:** `public`
2. Crie o D1 e aplique o esquema:
   ```powershell
   npx.cmd wrangler d1 create db-p26-2c-bf60-c440-6484-80fa
   # copie o database_id para wrangler.jsonc
   npx.cmd wrangler d1 migrations apply DB --remote
   ```
3. No projeto Pages → **Settings → Bindings**: D1 database, nome `DB`.
4. No [Discord Developer Portal](https://discord.com/developers/applications): crie a aplicação, copie
   **Client ID** / **Client Secret** e adicione o Redirect
   `https://p26-2c-bf60-c440-6484-80fa.pages.dev/api/auth/discord/callback`.
5. No projeto Pages → **Settings → Variables and Secrets**: `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (secret).
6. Refaça o deploy e confira `https://p26-2c-bf60-c440-6484-80fa.pages.dev/api/status` (`d1: true`, `discord_configured: true`).
7. Na raiz do repositório: `node validar-local.mjs P26-2C-BF60-C440-6484-80FA`.

## Engenharia de agentes

Desenvolvido com 3 agentes (Backend, Frontend e Teste/Validação) orquestrados no Claude Code.
Detalhes em [AGENTS.md](./AGENTS.md); skills em [`skills/`](./skills).
