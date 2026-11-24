# Projeto #1 — Jogo da Velha Assíncrono com Ranking

- **Aluno:** Davi Alves de Siqueira
- **RA:** 2026108955
- **Turma:** 2C
- **Chave Única Oficial (Hash):** `P26-2C-2DBC-554A-1277-1BC4`
- **Licença:** MIT (`LICENSE`) 
- **URL_CLOUDFLARE:** https://projeto-p26-2c-2dbc-554a-1277-1bc4.pages.dev

## Visão Geral da Arquitetura

- **Frontend (Vanilla JS):** `public/index.html`, `public/styles.css` e `public/app.js` (HTML5, CSS3 e JavaScript puro, sem frameworks de UI).
- **Backend Serverless:** Cloudflare Pages Functions em `functions/api/` (`/api/status`, `/api/auth/discord`, `/api/auth/discord/callback`, `/api/matches` e `/api/matches/[id]/move`).
- **Banco de Dados Relacional:** Cloudflare D1 (`migrations/0001_init.sql`), armazenando usuários Discord, partidas em andamento/concluídas, histórico e ranking.
- **Engenharia de Agentes:** Documentada em `AGENTS.md` e nas *skills* em `skills/serverless-d1-discord/SKILL.md`, `skills/vanilla-dom-ui/SKILL.md` e `skills/teste-validacao/SKILL.md`.