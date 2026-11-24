# Projeto #9: Quadro Kanban Pessoal

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Marcos Vinicius Fagundes Ricardo
- **Turma:** 2A
- **Chave Única:** `P26-2A-86CE-58AE-853D-C5AB`

- **URL_CLOUDFLARE:** `https://projeto-p26-2a-86ce-58ae-853d-c5ab.pages.dev`
---

## Especificação do Projeto

Construa uma ferramenta de gestão de tarefas baseada no método Kanban, estruturada nas colunas "A Fazer", "Em Execução" e "Concluído". O cliente deve ser programado em JavaScript vanilla utilizando a HTML5 Drag and Drop API nativa para permitir a movimentação fluida dos cartões entre as colunas, sem uso de bibliotecas externas.

O isolamento dos dados é garantido pelo fluxo OAuth2 do Discord: ao carregar a página, o frontend busca nas Cloudflare Pages Functions apenas os cartões pertencentes àquele user_id. Cada movimentação de coluna, edição de texto ou alteração de prioridade dispara uma chamada assíncrona (PATCH/PUT) que atualiza a posição e o estado do cartão diretamente nas tabelas do Cloudflare D1.

---

## Funcionalidades

O usuário entra com a conta Discord, cria cartões em “A Fazer”, informa título, descrição e prioridade, edita ou exclui seus cartões e move-os entre “A Fazer”, “Em Execução” e “Concluído”. Cada mudança é salva na hora no D1, então o quadro continua igual depois de recarregar a página, e o botão Sair encerra a sessão.

## Como foi construído

**Frontend:** HTML, CSS e JavaScript puro, sem framework. O quadro usa a HTML5 Drag and Drop API com `draggable`, `dragstart`, `dragover`, `drop` e `dragend`. Ao soltar, a nova posição é a média entre o cartão anterior e o seguinte; no topo, a do primeiro - 1; no fim, a do último + 1. A mudança é enviada imediatamente por PATCH; os dados do usuário são exibidos com `textContent`. Há botões acessíveis para mover cartões, layout responsivo e `<footer>` com a chave `P26-2A-86CE-58AE-853D-C5AB`.

**Backend:** Cloudflare Pages Functions implementam as rotas. O D1 guarda usuários, sessões e cartões. OAuth2 do Discord usa `state`; o callback cria ou atualiza o perfil, guarda apenas um token aleatório de sessão em cookie `HttpOnly` e registra o token no D1. Consultas e alterações são isoladas por `user_id`, e títulos, descrições, prioridade, coluna, posição e identificadores são validados no servidor.

## API

| Método | Rota | Função |
|---|---|---|
| GET | `/api/auth/discord` | Inicia OAuth2 do Discord e gera `state` |
| GET | `/api/auth/discord/callback` | Valida o callback, troca o código e cria a sessão |
| GET | `/api/sessao` | Retorna o perfil da sessão autenticada |
| DELETE | `/api/sessao` | Remove a sessão e limpa os cookies |
| GET | `/api/cartoes` | Lista os cartões do usuário autenticado |
| POST | `/api/cartoes` | Cria um cartão para o usuário da sessão |
| PATCH | `/api/cartoes/:id` | Atualiza campos, coluna ou posição do cartão próprio |
| DELETE | `/api/cartoes/:id` | Exclui o cartão próprio |

## Banco de dados

As migrações em `migrations/0001_init.sql` e `migrations/0002_kanban.sql` criam `discord_users`, `project_records`, `sessoes` e `cartoes`, além dos índices por usuário e por coluna/posição.

## Como rodar localmente e testar

Dentro da pasta `P26-2A-86CE-58AE-853D-C5AB`, aplique as migrações e os dados locais, depois inicie na porta 8788:

```powershell
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler d1 execute DB --local --file tests/seed.sql
npx.cmd wrangler pages dev --port 8788
```

Crie um `.dev.vars` (ele fica fora do git) com o `DISCORD_CLIENT_ID` e o `DISCORD_CLIENT_SECRET` da aplicação no Discord, e cadastre estes redirects de OAuth2:

- `http://localhost:8788/api/auth/discord/callback`
- `https://projeto-p26-2a-86ce-58ae-853d-c5ab.pages.dev/api/auth/discord/callback`

Os testes da API estão em `tests/api.test.mjs`, com dados fictícios em `tests/seed.sql`, e o relatório das duas rodadas está em `docs/relatorio-testes.md`. Na execução registrada foram usados `npx.cmd wrangler d1 migrations apply DB --local`, `npx.cmd wrangler d1 execute DB --local --file tests/seed.sql`, `npx.cmd wrangler pages dev --binding DISCORD_CLIENT_ID=test-client-id`, `node --test tests/api.test.mjs` e `node validar-local.mjs P26-2A-86CE-58AE-853D-C5AB`.

## Publicação

Cada push no `main` do fork publica o site no Cloudflare Pages, com a pasta raiz `P26-2A-86CE-58AE-853D-C5AB` e a saída `public` definida no `wrangler.jsonc`. O banco D1 `db-p26-2a-86ce-58ae-853d-c5ab` entra pelo binding `DB` do mesmo arquivo, as migrações foram aplicadas com `npx.cmd wrangler d1 migrations apply DB --remote`, e `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` estão nas variáveis do projeto no painel da Cloudflare.

## Agentes

A divisão dos agentes e do harness está em [`AGENTS.md`](./AGENTS.md); evidências e resultados das duas rodadas estão em [`docs/relatorio-testes.md`](./docs/relatorio-testes.md).

## Licença

MIT.
