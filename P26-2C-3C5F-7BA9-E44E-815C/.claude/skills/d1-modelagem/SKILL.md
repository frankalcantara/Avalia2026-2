---
name: d1-modelagem
description: Modelagem relacional no Cloudflare D1 para receitas, ingredientes, passos e favoritos, com migrations em SQL.
---
- Migrations ficam em `migrations/` e rodam com `wrangler d1 execute recipes-db --remote --file=...`.
- Tabelas: `users`, `sessions`, `recipes`, `ingredients` (amount REAL, unit TEXT, name TEXT, position), `steps` (position, text), `favorites` (PK composta user_id + recipe_id).
- Use `ON DELETE CASCADE` nos filhos de `recipes` e índices nas chaves de busca.
- Inserção com filhos: `INSERT ... RETURNING id` e depois `env.DB.batch([...])`.
- Buscas: `LIKE ? ESCAPE '\'` com padrão escapado; filtro por ingrediente via `EXISTS`.
