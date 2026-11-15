---
name: pages-functions
description: Padrões para rotas Cloudflare Pages Functions do SoundRoom.
---

- Mapeie endpoints em `functions/api/` seguindo a convenção file-based de Pages.
- Retorne JSON consistente e códigos HTTP apropriados.
- Use o binding D1 `DB` somente no servidor e SQL parametrizado.
- Não implemente OAuth ou rotas completas de salas sem autorização da etapa correspondente.
