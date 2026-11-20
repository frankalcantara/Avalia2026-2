# Projeto #13: Temporizador Pomodoro com Métricas de Estudo

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** João Vytor Kruger
- **Turma:** 2B
- **RA:** 2026108220
- **Chave Única:** `P26-2B-6518-18DF-1E0D-2810`
- **URL_CLOUDFLARE:** https://focusflow-p26-2b-6518-18df-1e0d-2810.pages.dev/

---

## Especificação do Projeto

Projete um gerenciador de tempo baseado na técnica Pomodoro, alternando ciclos configuráveis de foco e descanso.

O relógio regressivo deve ser controlado no frontend via setInterval e cálculo de deltas de Date.now() para evitar atrasos quando a aba do navegador estiver em segundo plano.

Cada ciclo de foco concluído por um usuário autenticado via Discord deve ser registrado no Cloudflare D1 através de uma requisição POST, vinculando o tempo estudado a uma disciplina ou projeto específico escolhido pelo aluno.

A interface deve consultar o histórico no servidor para exibir o total de horas acumuladas na semana e a distribuição de esforço entre as disciplinas cadastradas.

---


## Contratos da API

Todas as rotas privadas exigem o cookie de sessão emitido pelo OAuth Discord. Requisições `POST`, `PATCH` e `DELETE` também exigem `Origin` igual à origem da aplicação. Erros usam `{ "ok": false, "error": "codigo", "message": "descrição" }`. Datas são ISO 8601 UTC.

| Método e rota | Entrada | Resposta de sucesso |
|---|---|---|
| `GET /api/auth/discord` | Nenhuma | Redireciona ao Discord OAuth2; erro de configuração: `503` JSON. |
| `GET /api/auth/discord/callback` | `code` e `state` OAuth2 | Redireciona para `/?login=success` e grava cookies HttpOnly. Falhas redirecionam com `?auth_error=...`. |
| `GET /api/auth/me` | Cookie de sessão | `200 { "ok": true, "user": { "user_id", "username", "global_name", "avatar" } }`; sem sessão: `401`. |
| `POST /api/auth/logout` | Cookie de sessão e `Origin` | `200 { "ok": true }`; revoga a sessão e expira o cookie. |
| `GET /api/subjects` | Nenhuma | `200 { "ok": true, "subjects": [{ "id", "name", "created_at", "updated_at", "archived_at" }] }`; lista apenas disciplinas ativas do usuário. |
| `POST /api/subjects` | `{ "name": "Física" }` | `201 { "ok": true, "subject": { ... } }`. Nome: 1 a 80 caracteres. |
| `PATCH /api/subjects/:id` | `{ "name": "Física II" }` | `200 { "ok": true, "subject": { ... } }`. |
| `DELETE /api/subjects/:id` | Nenhuma | `200 { "ok": true, "subject": { ..., "archived_at": "..." } }`; arquiva, não apaga. |
| `POST /api/pomodoro/cycles` | `{ "subject_id": 1, "duration_seconds": 1500 }` e `Idempotency-Key` (1 a 128 caracteres) | `201 { "ok": true, "cycle": { "id", "subject_id", "duration_seconds", "status", "started_at", "completed_at", "cancelled_at" }, "replayed": false }`; replay idempotente: `200`, `replayed: true`. |
| `GET /api/pomodoro/active` | Nenhuma | `200 { "ok": true, "cycle": null }` ou objeto `{ "id", "subject_id", "subject_name", "duration_seconds", "status", "started_at" }`. |
| `POST /api/pomodoro/cycles/:id/complete` | Nenhuma | Primeira conclusão: `200 { "ok": true, "cycle": { "id", "subject_id", "duration_seconds", "status", "started_at", "completed_at" }, "replayed": false }`; repetição após conclusão: mesmo ciclo e `replayed: true`. Conclusão antecipada ou de ciclo cancelado: `409`. |
| `POST /api/pomodoro/cycles/:id/cancel` | Nenhuma | `200 { "ok": true, "cycle": { "id", "subject_id", "duration_seconds", "status", "started_at", "cancelled_at" } }`; só ciclos em execução podem ser cancelados. |
| `GET /api/metrics/weekly` | Nenhuma | `200 { "ok": true, "week": { "starts_on", "ends_on", "time_zone" }, "total_seconds", "total_hours", "completed_cycles", "subjects": [{ "subject_id", "name", "total_seconds", "total_hours", "completed_cycles" }] }`. `ends_on` é exclusivo. |
| `GET /api/status` | Nenhuma | `200 { "ok": true, "chave", "d1Connected", "discordOAuthConfigured", "serverTimestamp" }`; não autentica nem grava dados. |

`duration_seconds` aceita inteiros de 60 a 7200. As métricas contam a duração configurada de ciclos concluídos dentro da semana de segunda-feira a segunda-feira no fuso `America/Sao_Paulo`; cancelamentos são excluídos. Respostas `404` indicam recurso inexistente ou pertencente a outro usuário; conflitos de estado/idempotência usam `409`. A conclusão é idempotente: reenvios, inclusive após perda da resposta HTTP, retornam a conclusão já gravada com `replayed: true` sem alterar `completed_at` nem contabilizar o ciclo novamente.

## Testes locais

Requer Node.js 22.13 ou superior (SQLite integrado ao Node):

```sh
cd P26-2B-6518-18DF-1E0D-2810
npm test
```

Os testes exercitam as Functions com SQLite local e respostas Discord controladas. Eles verificam regras e consultas locais, mas não comprovam execução, bindings, cookies ou OAuth no ambiente Cloudflare remoto.

## Publicação no Cloudflare Pages + D1 + Discord OAuth2

1. No painel Cloudflare (**Workers & Pages** → **Create** → **Pages** → **Connect to Git**), selecione o fork e configure **Root directory** como `P26-2B-6518-18DF-1E0D-2810`, **Build command** em branco e **Build output directory** como `public`.
2. Crie o banco D1 na subpasta oficial:

   ```sh
   cd P26-2B-6518-18DF-1E0D-2810
   npx wrangler d1 create db-p26-2b-6518-18df-1e0d-2810
   ```

3. Copie o `database_id` retornado pelo Wrangler para o campo `database_id` em `wrangler.jsonc`, substituindo o texto `SUBSTITUA_PELO_ID_GERADO_PELA_CLOUDFLARE`. O repositório não contém nem inventa um ID de banco.
4. Aplique todas as migrações preservadas e incrementais:

   ```sh
   npx wrangler d1 migrations apply db-p26-2b-6518-18df-1e0d-2810 --remote
   ```

5. Vincule o D1 ao Pages em **Settings** → **Functions** → **D1 database bindings**, com variável `DB` apontando para o banco criado.
6. Crie uma aplicação no Discord Developer Portal e cadastre como Redirect URL a URL exata `https://<seu-projeto>.pages.dev/api/auth/discord/callback`. Configure `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` como secrets no Pages, ou pelo Wrangler:

   ```sh
   npx wrangler pages secret put DISCORD_CLIENT_ID
   npx wrangler pages secret put DISCORD_CLIENT_SECRET
   ```

7. A URL de produção está registrada no início deste README. Caso o domínio ou projeto seja alterado, atualize o campo URL_CLOUDFLARE.
8. Na raiz do repositório, execute `node validar-local.mjs P26-2B-6518-18DF-1E0D-2810` para a pré-validação estrutural.
