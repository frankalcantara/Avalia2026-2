# Schema do banco D1 (documentação em Markdown)

Este documento é a **referência do banco** usado pelo Entrelinhas. Ele descreve o schema completo em SQL, o significado de cada tabela e como preparar o D1 **pelo painel da Cloudflare**. O projeto não usa Wrangler: não existe `wrangler.jsonc` e nenhum `database_id` fica no repositório.

- **Banco:** `db-p26-2b-4d68-ae13-8030-7d10`
- **Binding usado pelo código:** `DB` (exatamente assim, com maiúsculas)
- **Onde o binding é declarado:** painel da Cloudflare (Pages → Settings → Bindings)
- **Arquivo de schema:** [`../schema.sql`](../schema.sql) — o mesmo SQL está na seção 2
- **Migrações incrementais:** `migrations/0001_init.sql` … `migrations/0006_comunidade.sql` (referência histórica)

> **Por que o Wrangler saiu do projeto:** quando havia um `wrangler.jsonc` declarando `d1_databases` com um `database_id`, o Cloudflare Pages validava esse UUID em **todo deploy** e falhava com `Error 8000022: Invalid database UUID`. Sem esse arquivo, o Pages publica com as configurações de build do painel e o banco é associado em **Settings → Bindings**.

---

## 1. Resumo do que o schema cria

| Grupo | Origem | Tabelas |
| --- | --- | --- |
| Inicial | `0001_init.sql` | `discord_users`, `project_records` |
| Blog e salas | `0002_blog.sql` | `rooms`, `room_members`, `articles`, `comments`, `article_likes` |
| Slug | `0003_article_slug.sql` | coluna `articles.slug` + índice único |
| Política de entrada | `0004_room_join_policy.sql` | coluna `rooms.join_policy` + `room_join_requests` |
| Bloqueios | `0005_room_blocks.sql` | `room_blocks` |
| Comunidade | `0006_comunidade.sql` | `article_tags`, `article_revisions`, `comment_reports` |

Total: **12 tabelas** (11 de domínio + `project_records`) e **9 índices** explícitos.

---

## 2. Schema completo (SQL)

O bloco abaixo é o **estado final** do banco, já com as colunas que nasceram em `ALTER TABLE`. Ele serve para um banco novo: crie o D1 vazio, cole este SQL no Console do D1 e execute. Se o banco já tem parte das tabelas, use os arquivos de `migrations/` para aplicar só o que falta.

```sql
-- 0001_init.sql -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS discord_users (
  user_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  avatar TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS project_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  chave_projeto TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_project_records_user ON project_records(user_id);

-- 0002_blog.sql -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  invite_hash TEXT,
  join_policy TEXT NOT NULL DEFAULT 'open_link'
    CHECK (join_policy IN ('open_link', 'approval')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK ((visibility = 'private' AND invite_hash IS NOT NULL) OR visibility = 'public')
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  slug TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS article_likes (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (article_id, user_id)
);

-- 0005_room_blocks.sql ----------------------------------------------------
CREATE TABLE IF NOT EXISTS room_blocks (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

-- 0004_room_join_policy.sql -----------------------------------------------
CREATE TABLE IF NOT EXISTS room_join_requests (
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES discord_users(user_id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (room_id, user_id)
);

-- 0006_comunidade.sql -----------------------------------------------------
CREATE TABLE IF NOT EXISTS article_tags (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  PRIMARY KEY (article_id, tag)
);

CREATE TABLE IF NOT EXISTS article_revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  room_id INTEGER,
  edited_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comment_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (comment_id, reporter_id)
);

-- Índices -----------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_room ON articles(room_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag ON article_tags(tag);
CREATE INDEX IF NOT EXISTS idx_article_revisions_article
  ON article_revisions(article_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_comment_reports_comment ON comment_reports(comment_id);
```

---

## 3. Descrição tabela por tabela

### `discord_users`
Usuários autenticados via Discord OAuth2. É a tabela referenciada por quase todas as outras.

| Coluna | Tipo | Regras | Uso |
| --- | --- | --- | --- |
| `user_id` | TEXT | PK | ID numérico do Discord (string) |
| `username` | TEXT | NOT NULL | Nome exibido |
| `avatar` | TEXT | aceita NULL | Hash do avatar (monta a URL no front) |
| `updated_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` | Atualizado a cada login |

### `project_records`
Tabela do esquema inicial do projeto #27, mantida para compatibilidade com a validação oficial. O blog atual não a utiliza, mas ela não deve ser removida sem alinhar com o validador.

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT |
| `user_id` | TEXT | NOT NULL (sem FK) |
| `username` | TEXT | NOT NULL |
| `chave_projeto` | TEXT | NOT NULL |
| `conteudo` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` |

### `rooms`
Salas de artigos. A sala é o limite de visibilidade de artigos e comentários.

| Coluna | Tipo | Regras | Observações |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `owner_id` | TEXT | NOT NULL, FK → `discord_users.user_id` `ON DELETE CASCADE` | Quem aprova, remove e exclui |
| `name` | TEXT | NOT NULL | |
| `description` | TEXT | NOT NULL, default `''` | |
| `visibility` | TEXT | NOT NULL, `CHECK IN ('public','private')` | |
| `invite_hash` | TEXT | NULL em sala pública | Código de entrada da sala privada: hash SHA-256 (24 hex) do `id` com nonce aleatório; é exibido ao dono e conferido no login |
| `join_policy` | TEXT | NOT NULL, default `'open_link'` | `open_link` entra com o código da sala; `approval` fica na fila até o dono aprovar |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` | |

Restrição composta: sala `private` **precisa** de `invite_hash`; sala `public` **não pode** ter valor. O app grava em `invite_hash` o código hash da sala privada (24 hex), que é o que o dono compartilha e o que o endpoint de entrada confere. Salas privadas criadas antes desse formato têm um nonce de 36 hex na coluna; ele continua aceito como código, então não é preciso migrar o banco.

### `room_members`
Quem participa de cada sala. A PK composta impede duplicidade.

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `room_id` | INTEGER | FK → `rooms.id` `ON DELETE CASCADE`, parte da PK |
| `user_id` | TEXT | FK → `discord_users.user_id` `ON DELETE CASCADE`, parte da PK |
| `joined_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` |

### `articles`
Artigos do blog e das salas.

| Coluna | Tipo | Regras | Observações |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | Usado nas rotas `/api/articles/:id` |
| `author_id` | TEXT | FK → `discord_users.user_id` `ON DELETE CASCADE` | Só o autor edita/exclui |
| `room_id` | INTEGER | FK → `rooms.id` `ON DELETE SET NULL` | NULL = artigo público |
| `title` | TEXT | NOT NULL | |
| `body` | TEXT | NOT NULL | Markdown, limite de 50.000 caracteres validado na API |
| `slug` | TEXT | NULL no banco, índice **único** | 32 hex gerados na criação; é a URL pública, não é credencial |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` | Ordenação e cursor de paginação |
| `updated_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` | Atualizado no `PUT` |

### `comments`
Comentários de um artigo.

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT |
| `article_id` | INTEGER | FK → `articles.id` `ON DELETE CASCADE` |
| `author_id` | TEXT | FK → `discord_users.user_id` `ON DELETE CASCADE` |
| `body` | TEXT | NOT NULL |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` |

### `article_likes`
Curtida por usuário e artigo (a PK composta garante uma por pessoa).

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `article_id` | INTEGER | FK → `articles.id` `ON DELETE CASCADE`, parte da PK |
| `user_id` | TEXT | FK → `discord_users.user_id` `ON DELETE CASCADE`, parte da PK |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` |

### `room_join_requests`
Fila de pedidos de entrada em salas com `join_policy = 'approval'`.

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `room_id` | INTEGER | FK → `rooms.id` `ON DELETE CASCADE`, parte da PK |
| `user_id` | TEXT | FK → `discord_users.user_id` `ON DELETE CASCADE`, parte da PK |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` |

### `room_blocks`
Bloqueio de entrada. Remover um membro grava aqui, e a pessoa não volta nem pelo código da sala nem pela fila; o dono libera com `DELETE /api/rooms/:id/blocks?userId=…`.

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `room_id` | INTEGER | FK → `rooms.id` `ON DELETE CASCADE`, parte da PK |
| `user_id` | TEXT | FK → `discord_users.user_id` `ON DELETE CASCADE`, parte da PK |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` |

### `article_tags`
Etiquetas do artigo (até 5, normalizadas pela API).

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `article_id` | INTEGER | FK → `articles.id` `ON DELETE CASCADE`, parte da PK |
| `tag` | TEXT | NOT NULL, parte da PK (minúsculas) |

### `article_revisions`
Histórico de edições. Cada `PUT` grava o **snapshot anterior** do artigo.

| Coluna | Tipo | Regras | Observações |
| --- | --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT | |
| `article_id` | INTEGER | FK → `articles.id` `ON DELETE CASCADE` | |
| `title` | TEXT | NOT NULL | Título antes da edição |
| `body` | TEXT | NOT NULL | Corpo antes da edição |
| `room_id` | INTEGER | NULL, **sem FK** | Preserva o valor histórico |
| `edited_by` | TEXT | NOT NULL, **sem FK** | Mantém o histórico se o usuário for removido |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` | |

### `comment_reports`
Denúncia de comentário, uma por usuário e comentário.

| Coluna | Tipo | Regras |
| --- | --- | --- |
| `id` | INTEGER | PK AUTOINCREMENT |
| `comment_id` | INTEGER | FK → `comments.id` `ON DELETE CASCADE` |
| `reporter_id` | TEXT | NOT NULL (sem FK) |
| `reason` | TEXT | NOT NULL, default `''` |
| `created_at` | TEXT | NOT NULL, default `CURRENT_TIMESTAMP` |

Restrição: `UNIQUE (comment_id, reporter_id)`.

### 3.1 Índices criados

| Índice | Tabela | Colunas | Para quê |
| --- | --- | --- | --- |
| `idx_project_records_user` | `project_records` | `user_id` | Consultas do validador |
| `idx_articles_created` | `articles` | `created_at DESC, id DESC` | Feed e cursor de paginação |
| `idx_articles_author` | `articles` | `author_id, created_at DESC` | Página do autor |
| `idx_articles_room` | `articles` | `room_id, created_at DESC` | Artigos por sala |
| `idx_articles_slug` (único) | `articles` | `slug` | Busca por URL e unicidade |
| `idx_comments_article` | `comments` | `article_id, created_at, id` | Lista de comentários |
| `idx_article_tags_tag` | `article_tags` | `tag` | Filtro `?tag=` |
| `idx_article_revisions_article` | `article_revisions` | `article_id, created_at DESC, id DESC` | Histórico |
| `idx_comment_reports_comment` | `comment_reports` | `comment_id` | Moderação |

### 3.2 Relacionamentos

```text
discord_users 1 ── N rooms (owner_id, ON DELETE CASCADE)
discord_users 1 ── N room_members / room_join_requests / room_blocks
discord_users 1 ── N articles (author_id, ON DELETE CASCADE)
discord_users 1 ── N comments (author_id, ON DELETE CASCADE)
discord_users 1 ── N article_likes

rooms 1 ── N articles (room_id, ON DELETE SET NULL)
rooms 1 ── N room_members / room_join_requests / room_blocks (ON DELETE CASCADE)

articles 1 ── N comments (ON DELETE CASCADE)
articles 1 ── N article_likes / article_tags / article_revisions (ON DELETE CASCADE)

comments 1 ── N comment_reports (ON DELETE CASCADE)
```

O D1 aplica chaves estrangeiras, então a ordem de criação importa: usuários → salas → artigos → comentários/curtidas → tabelas da comunidade. O bloco da seção 2 já respeita essa ordem.

### 3.3 Observações importantes

- **`articles.slug` é NULL no banco, mas o código sempre preenche.** O índice único permite vários `NULL`, o que é inofensivo porque a API gera o slug em todo `POST`.
- **`room_id` e `edited_by` em `article_revisions` não têm FK** de propósito: o histórico não deve sumir quando a sala é excluída ou o usuário é apagado.
- **`invite_hash` guarda o código da sala privada** (hash de 24 hex). Não há coluna nova: o código mora nessa coluna e a `CHECK` existente continua válida. Salas antigas com nonce de 36 hex seguem funcionando.
- **Datas são TEXT em UTC** (`CURRENT_TIMESTAMP` do SQLite). Não troque por `INTEGER`/epoch sem ajustar todas as consultas.
- **Não existe tabela de sessões.** A sessão é um cookie assinado com `SESSION_SECRET`.
- **Não existe tabela de anexos e não há bucket R2.**

---

## 4. Preparar o banco pelo painel (sem Wrangler)

1. **Criar o D1:** no painel, **Workers & Pages → D1 → Create database**, nome `db-p26-2b-4d68-ae13-8030-7d10`. Não é preciso copiar o UUID para nenhum arquivo do repositório.
2. **Criar as tabelas:** abra o banco criado → aba **Console** → cole o bloco da seção 2 (ou o conteúdo de [`schema.sql`](../schema.sql)) → **Execute**. Se o Console aceitar apenas um comando por vez, execute os `CREATE TABLE` na ordem do bloco e depois os índices.

   As instruções são independentes: se alguma não for aplicada (o Console pode cortar um script grande), rode aquele `CREATE TABLE` sozinho e depois o índice dele. Cada comando pode ser repetido sem erro, porque todos usam `IF NOT EXISTS`.
3. **Associar o banco ao projeto Pages:** **Workers & Pages → seu projeto Pages → Settings → Bindings → Add → D1 database bindings**.
   - **Variable name:** `DB` (exatamente assim; o código lê `env.DB`).
   - **D1 database:** selecione `db-p26-2b-4d68-ae13-8030-7d10`.
   - Repita em **Production** e em **Preview** se quiser os dois ambientes funcionando.
4. **Fazer o deploy.** Sem arquivo de configuração de Wrangler no projeto, o Cloudflare não tenta validar UUID nenhum. O binding vem do painel e passa a valer no deploy seguinte à sua criação.

Não reintroduza um `wrangler.jsonc` com `database_id` para "resolver" o deploy: é justamente esse valor que o Cloudflare valida e recusa quando não corresponde a um banco real da conta.

---

## 5. Conferir o que foi criado

No **Console** do D1, rode:

```sql
SELECT name, type FROM sqlite_master
WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'
ORDER BY type, name;
```

Esperado: as 12 tabelas da seção 3 e os 9 índices da seção 3.1.

Conferir as colunas de uma tabela:

```sql
PRAGMA table_info(articles);
```

Conferir o binding pelo site: abra `https://SEU-DOMINIO.pages.dev/api/health`. Resposta esperada:

```json
{ "ok": true, "status": "ok", "checks": { "database": "ok" } }
```

Se `checks.database` vier `"missing"`, o binding `DB` não chegou ao deploy (confira o passo 3 da seção 4 e refaça o deploy). Se vier `"error"` com `no such table`, o schema da seção 2 não foi aplicado.

---

## 6. Dados de exemplo (opcional)

`seed/demo-local.sql` é uma referência de dados prontos: usuário demo (`100000000000000001`, Ana Beatriz), a sala pública **Desenvolvimento Web**, a sala privada **Projeto Integrador** (código `9c1d7a4be52f0381c6a4d7e2`) e artigos/comentários/curtidas/etiquetas.

Sem Wrangler, o caminho é o Console do banco: abra o D1 → **Console** → cole o conteúdo de [`../seed/demo-local.sql`](../seed/demo-local.sql) → **Execute**. Use apenas em um banco de desenvolvimento.

**Não aplique o seed no banco de produção.** Em produção, o primeiro usuário nasce no primeiro login via Discord.

---

## 7. Diagnóstico rápido

| Sintoma | Causa provável | Correção |
| --- | --- | --- |
| Deploy falha com `Invalid database UUID` | Alguém reintroduziu um arquivo de configuração de Wrangler com `database_id` | Apagar o arquivo; o binding fica no painel |
| `/api/health` com `database: "missing"` | Binding `DB` não configurado no projeto Pages | Settings → Bindings → Add → D1 database bindings |
| `/api/health` com `no such table: ...` | Schema não aplicado no banco remoto | Executar o bloco da seção 2 no Console do D1 |
| `no such table: main.comment_reports` ao criar um índice | O `CREATE TABLE` daquela tabela não foi aplicado na mesma execução (script grande cortado pelo Console) | Rodar o `CREATE TABLE` da tabela sozinho e depois o índice dela |
| Login responde `auth_not_configured` | Variável/secret ausente ou `SESSION_SECRET` curto | Reconfigurar em Variables and Secrets e redeployar |
| Login volta com erro de redirect | Callback do Discord diferente do domínio real | Cadastrar a URL exata com `https://` e o caminho completo |
| Escrita funciona local e falha em produção | Banco local e remoto são independentes | Aplicar o schema no D1 remoto pelo Console |

---

## 8. Checklist final

- [ ] D1 `db-p26-2b-4d68-ae13-8030-7d10` criado no painel.
- [ ] Schema da seção 2 aplicado no Console do D1 (12 tabelas e 9 índices).
- [ ] Binding `DB` criado em Pages → Settings → Bindings e deploy refeito.
- [ ] Nenhum `wrangler.jsonc` / `database_id` no projeto.
- [ ] `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` configurados em Production.
- [ ] `/api/health` com `status: ok`.
- [ ] Callback do Discord cadastrado com o domínio real.

Referências: [configuracao-cloudflare-discord.md](./configuracao-cloudflare-discord.md) e [ci-e-publicacao.md](./ci-e-publicacao.md).
