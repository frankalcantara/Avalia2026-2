# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

Usada pelo **Agente Backend** no projeto #34 (Vitrine de Achados e Perdidos do Campus).
Chave: P26-2C-D74F-99D3-3096-8A00

## Regras Obrigatórias
1. **Validação na Borda:** Toda regra de negócio, verificação de permissão e validação de dados deve executar nas Cloudflare Pages Functions (`functions/api/*`). O cliente nunca é fonte de verdade.
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection. Nunca concatenar strings no SQL.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.

## Convenções aplicadas neste projeto

### Autenticação
- Escopo OAuth2: apenas `identify`.
- `/api/auth/discord` gera um `state` aleatório e o guarda em cookie `HttpOnly`; o callback recusa se `state` da URL e do cookie diferirem (proteção CSRF).
- O callback troca o `code` por token, busca `/users/@me` e faz upsert em `discord_users` (`user_id`, `username`, `avatar`).
- Sessão: cookie `session` com payload JSON assinado por HMAC-SHA256 (`SESSION_SECRET`), validade de 7 dias, flags `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS.
- Identidade do usuário vem **sempre** da sessão assinada (`readSession`), nunca do corpo da requisição.

### Banco (D1, binding `DB`)
- Schema só via migrations (`migrations/0001_init.sql`, `0002_itens_e_reivindicacoes.sql`).
- Tabelas: `discord_users`, `items` (tipo perdi/encontrei, categoria, local, data, descrição, status), `claims`.
- Constraints `CHECK` para tipo, categoria e status; índice único parcial impede duas reivindicações pendentes do mesmo usuário no mesmo item.
- Transições de estado em dois passos usam `env.DB.batch([...])` para ficarem atômicas.

### Regras de negócio validadas no servidor
- Escrita exige sessão válida (401 sem login).
- `type` em {perdi, encontrei}; `category` em {eletronicos, documentos, garrafas, vestuario}.
- Título 3 a 80 caracteres, local obrigatório, descrição 10 a 1000.
- Data válida (AAAA-MM-DD) e não futura.
- Não se reivindica o próprio item (403); item encerrado não aceita reivindicação (409).
- Só o dono do item aceita ou recusa; só dono ou reivindicante encerram (403 para terceiros).
- Ao aceitar, `owner_contact` vem da sessão do dono e o item vira `em_andamento`; ao encerrar, a claim vira `encerrada` e o item `encerrado`.
- `owner_contact` não é exposto enquanto a claim está pendente ou recusada.

### Rotas
| Rota | Função |
|---|---|
| `GET /api/auth/discord`, `/api/auth/discord/callback`, `POST /api/auth/logout` | Login e logout |
| `GET /api/me` | Usuário da sessão (401 sem login) |
| `GET/POST /api/items` | Listar com filtros cruzados / criar |
| `GET /api/items/:id` | Detalhe |
| `POST /api/items/:id/claims` | Abrir reivindicação |
| `GET /api/claims` | Minhas e recebidas |
| `POST /api/claims/:id/accept\|reject\|close` | Responder e encerrar |

### Segredos
`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` e `SESSION_SECRET` ficam em `.dev.vars` (fora do Git) e em `wrangler pages secret` na produção.

## Checklist antes de entregar
- [ ] Nenhuma rota de escrita sem `readSession`.
- [ ] Nenhum SQL por concatenação.
- [ ] Nenhum segredo no repositório.
- [ ] Migrations aplicadas com `--local` e `--remote`.