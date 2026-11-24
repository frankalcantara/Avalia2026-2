# Projeto #15: Lista de Tarefas Colaborativa (Shared To-Do)

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Leonardo Ceratti dos Santos · RA 2026107850
- **Turma:** 2A
- **Chave Única:** `P26-2A-557F-D130-1422-DA84`
- **URL_CLOUDFLARE:** `https://avalia2026-2-cz9.pages.dev`

---

## Especificação do Projeto

Gerenciador de tarefas voltado para pequenas equipes de trabalho acadêmico. Após o
login via Discord, o usuário pode criar listas de tarefas e compartilhar o código de
acesso da lista com colegas de turma, permitindo que múltiplos usuários autenticados
visualizem e interajam com os mesmos itens.

No Cloudflare D1, o esquema relacional contempla tabelas para usuários, listas,
membros da lista e tarefas. Com JavaScript vanilla, os integrantes podem criar
subtarefas, atribuir um responsável (exibindo o avatar do Discord do colega no item)
e alterar o status de conclusão, sincronizando o estado com o servidor a cada interação.

## Como funciona

| Camada | Arquivos |
|---|---|
| Interface (HTML5, CSS3, JS puro) | `public/index.html`, `public/styles.css`, `public/app.js` |
| Login Discord OAuth2 (user_id, nome, avatar) | `functions/api/auth/discord.js`, `functions/api/auth/discord/callback.js`, `functions/api/auth/logout.js`, `functions/api/me.js` |
| Listas e tarefas | `functions/api/lists/`, `functions/api/tasks/` |
| Sessão assinada e validações | `lib/util.js` |
| Banco (Cloudflare D1) | `migrations/0001_init.sql`, `migrations/0002_shared_todo.sql` |
| Agentes, harness e skills | `AGENTS.md`, `skills/` |

Tabelas: `discord_users` (usuários), `lists` (listas, com `code` de acesso),
`list_members` (membros) e `tasks` (tarefas e subtarefas, com `assignee_id` e `done`).

### Regras validadas no servidor

- Sem sessão válida (cookie assinado com HMAC), toda rota da API responde 401.
- Quem não é membro da lista recebe 404 (a lista não é revelada).
- O responsável de uma tarefa precisa ser membro da mesma lista.
- Subtarefas só existem sob tarefas da mesma lista (um nível).
- Mutações só são aceitas com a origem do próprio site (defesa contra CSRF).
- O fluxo OAuth confere o `state` guardado em cookie.

## Como publicar esta subpasta no Cloudflare Pages + D1 + Discord OAuth2

1. **Pages:** em *Workers & Pages → Create → Pages → Connect to Git*, escolha o fork e
   o projeto ficou com o nome `avalia2026-2` (URL `avalia2026-2-cz9.pages.dev`). Configure:
   - **Root directory:** `P26-2A-557F-D130-1422-DA84`
   - **Build command:** vazio
   - **Build output directory:** `public`
2. **Banco D1:** crie `db-p26-2a-557f-d130-1422-da84`, coloque o `database_id` no
   `wrangler.jsonc` e execute no *Console* do banco, nesta ordem, o conteúdo de
   `migrations/0001_init.sql` e depois o de `migrations/0002_shared_todo.sql`.
3. **Binding:** variável `DB` apontando para esse banco (já declarado no `wrangler.jsonc`;
   se o painel não mostrar o binding, ele vem do arquivo).
4. **Discord:** em *Developer Portal → OAuth2 → Redirects* cadastre
   `https://avalia2026-2-cz9.pages.dev/api/auth/discord/callback`.
5. **Variáveis (como Secret):** `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e
   `SESSION_SECRET` (texto longo e aleatório, 40+ caracteres). Faça um novo deploy
   depois de criá-las.
6. Confira `https://avalia2026-2-cz9.pages.dev/api/status`: deve mostrar
   `d1Conectado`, `discordConfigurado` e `sessaoConfigurada` como `true`.
7. Na raiz do repositório, rode `node validar-local.mjs P26-2A-557F-D130-1422-DA84`.

## Testes

```
node --no-warnings tests/api.test.mjs                                 # API (Node 22+)
node skills/teste-validacao/scripts/auditar.mjs https://avalia2026-2-cz9.pages.dev
```

Licença: MIT (arquivo `LICENSE`).
