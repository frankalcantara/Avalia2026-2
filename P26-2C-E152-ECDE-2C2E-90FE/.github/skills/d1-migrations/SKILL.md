---
name: d1-migrations
description: Padrões de consulta e migração Cloudflare D1 do SoundRoom.
---

- Preserve migrations já aprovadas; mudanças de esquema devem ser aditivas e revisadas.
- Execute validações com Wrangler e `--local`.
- Mantenha integridade referencial, histórico, timestamps UTC e votos únicos.
- Não invente `database_id`, não use produção e não concatene valores em SQL.
