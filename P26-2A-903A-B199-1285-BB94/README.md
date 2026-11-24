# Projeto #32: Gerenciador de Eventos e Controle de Presença (RSVP)

- **Aluno:** Jose Mario Gonzaga Junior
- **RA (Matrícula):** 2026107610
- **Turma:** 2A
- **Chave Única (Hash):** `P26-2A-903A-B199-1285-BB94`
- **URL do Projeto Online (Cloudflare Pages):** https://p26-2a-903a-b199-1285-bb94.pages.dev
- **Repositório GitHub:** https://github.com/Zmarioo/Avalia2026-2

---

## Sobre o Projeto

Plataforma web full-stack para organização de palestras, grupos de estudo e encontros acadêmicos, desenvolvida com arquitetura serverless na Cloudflare e autenticação via Discord OAuth2.

### Funcionalidades Implementadas
- **Autenticação Discord OAuth2:** Login obrigatório via Discord importando `user_id`, nome de usuário e avatar, com sessão assinada em cookie `HttpOnly`.
- **Criação e Listagem de Eventos:** Usuários autenticados podem criar eventos definindo título, local, data, horário e capacidade máxima de participantes.
- **Controle de Presença e Fila de Espera (FIFO):** O backend nas Cloudflare Pages Functions verifica no banco Cloudflare D1 se a capacidade máxima foi atingida. Quando lotado, novos inscritos entram automaticamente na fila de espera ordenada por horário de solicitação e são promovidos automaticamente caso um participante confirmado cancele sua vaga.
- **Frontend 100% Vanilla:** Interface responsiva construída exclusivamente com HTML5, CSS3 puro (sem sombras em textos) e JavaScript puro (`public/index.html`, `public/styles.css` e `public/app.js`), sem frameworks externos.

---

## Estrutura do Projeto

- `functions/api/auth/` — Rotas serverless para login, callback OAuth2 do Discord e verificação de sessão (`/api/auth/me`).
- `functions/api/eventos/` — Endpoints para listagem, criação de eventos e gestão de inscrições/fila de espera (`/api/eventos` e `/api/eventos/rsvp`).
- `migrations/0001_init.sql` — Esquema relacional SQLite no Cloudflare D1 (`usuarios`, `eventos` e `inscricoes`).
- `public/` — Interface web em HTML5, CSS3 e Vanilla JS com rastreabilidade da chave `P26-2A-903A-B199-1285-BB94` no rodapé.
- `skills/` — Diretórios de instruções utilizadas pelos agentes (`serverless-d1-discord`, `vanilla-dom-ui` e `teste-validacao`).
- `AGENTS.md` — Documentação da engenharia de agentes, harness utilizado e casos de teste auditados.
- `LICENSE` — Licença MIT.

---

## Como Executar Localmente e Publicar

1. **Instalar dependências:**
   ```bash
   npm install