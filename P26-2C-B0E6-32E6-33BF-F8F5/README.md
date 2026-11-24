# Projeto #21: Sistema de Agendamento de Monitoria

- **Modalidade:** Projeto Oficial Sorteado
- **Estudante:** Ana Júlia Arrelias de Oliveira (RA 2026108221) · Turma 2C
- **Chave Única:** `P26-2C-B0E6-32E6-33BF-F8F5`
- **URL_CLOUDFLARE:** https://p26-2c-b0e6-32e6-33bf-f8f5.pages.dev
- **Repositório:** https://github.com/juliarrelias/Avalia2026-2 (pasta `P26-2C-B0E6-32E6-33BF-F8F5/`)
- **Licença:** MIT

## O que é

Aplicação de reserva de horários para atendimento de alunos por monitores acadêmicos. Quem entra com o Discord pode atuar como **monitor** (abre janelas de horários livres na semana) ou como **aluno** (reserva um horário informando o tema da dúvida). A grade semanal é atualizada automaticamente e permite o cancelamento prévio.

## Arquitetura

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3 e JavaScript vanilla (`public/`), sem frameworks |
| Backend | Cloudflare Pages Functions (`functions/api/`) |
| Banco | Cloudflare D1 (`migrations/`) |
| Autenticação | Discord OAuth2 (escopo `identify`), cookie de sessão `HttpOnly` assinado com HMAC-SHA256 e `state` anti-CSRF |

### Integridade transacional (HTTP 409)

`POST /api/bookings` executa **uma única instrução** `INSERT ... SELECT ... WHERE NOT EXISTS`, e a tabela tem `UNIQUE(slot_id)`. Se dois alunos tentarem o mesmo horário ao mesmo tempo, só um insert tem efeito e o outro recebe **409 Conflict**.

### Regras validadas no servidor

- Autoria vem da sessão, nunca do corpo da requisição; só o monitor remove o próprio horário; só o aluno ou o monitor do horário cancela a reserva.
- Só é possível reservar ou cancelar antes do início do horário.
- O monitor não reserva o próprio horário; o aluno não reserva dois horários sobrepostos e tem no máximo 10 reservas futuras.
- Horário com aluno agendado não pode ser removido (409).
- Horários em múltiplos de 30 minutos, janela de até 8 h, até 60 dias de antecedência e no máximo 200 horários futuros por monitor.
- O tema da dúvida só é visível ao aluno e ao monitor daquele horário.
- Requisições que alteram dados exigem o header `Origin` da própria aplicação.

### Rotas

`GET /api/auth/discord` · `GET /api/auth/discord/callback` · `POST /api/auth/logout` · `GET /api/me` ·
`GET /api/slots?from&to` · `POST /api/slots` · `DELETE /api/slots/:id` ·
`GET /api/bookings` · `POST /api/bookings` · `DELETE /api/bookings/:id`

## Como rodar localmente

1. Crie o arquivo `.dev.vars` (ignorado pelo Git) com as variáveis `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` (qualquer texto longo).
2. No Discord Developer Portal, em OAuth2, cadastre o redirect `http://localhost:8788/api/auth/discord/callback`.
3. Crie o banco local e suba o servidor:
   ```powershell
   npx.cmd wrangler d1 migrations apply db-p26-2c-b0e6-32e6-33bf-f8f5 --local
   npx.cmd wrangler pages dev
   ```
4. Abra `http://localhost:8788`.

## Como publicar

1. Cloudflare Pages conectado ao fork, com **Root directory** `P26-2C-B0E6-32E6-33BF-F8F5` e **Build output directory** `public`.
2. Banco D1 criado com `npx.cmd wrangler d1 create db-p26-2c-b0e6-32e6-33bf-f8f5`, `database_id` no `wrangler.jsonc` e migrações aplicadas com `--remote`.
3. Binding `DB` ligado ao banco em Settings, Functions, D1 database bindings.
4. Segredos `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` cadastrados com `wrangler pages secret put`.
5. Redirect de produção no Discord: `https://p26-2c-b0e6-32e6-33bf-f8f5.pages.dev/api/auth/discord/callback`.

## Testes

Com o servidor local rodando (`npx.cmd wrangler pages dev`) e o banco local migrado:

```powershell
node tests\validar-api.mjs
```

O script cria usuários de teste no banco local e executa 70 verificações (autenticação, validações, corrida de reservas, limites). Resultado em `tests/resultado-validacao.md` e relatório do agente de validação em `tests/RELATORIO-AGENTE3.md`.

## Engenharia de agentes

Três agentes (backend, frontend e teste e validação), o harness usado e os skills estão em [`AGENTS.md`](AGENTS.md) e em [`skills/`](skills/).
