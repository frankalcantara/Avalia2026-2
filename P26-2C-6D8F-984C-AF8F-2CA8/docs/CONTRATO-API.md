# Contrato da API (fonte única entre os agentes)

Todas as rotas respondem JSON. Rotas de dados exigem sessão (cookie `sid`, HttpOnly) e respondem `401 {"erro":"nao_autenticado"}` sem ela.
Regras de negócio e validação ficam em `public/js/calculo.js` (`validarDisciplina`, `calcular`), importado **também** pelas Functions — o servidor nunca confia no cliente.

## Autenticação (Discord OAuth2, escopo `identify`)

| Método | Rota | Comportamento |
|---|---|---|
| GET | `/api/auth/discord` | Gera `state` aleatório (cookie `oauth_state`, 10 min) e redireciona para `discord.com/oauth2/authorize`. |
| GET | `/api/auth/discord/callback` | Confere `state`, troca `code` por token, lê `/users/@me`, faz upsert em `discord_users` (user_id, username, avatar), cria linha em `sessions` (token aleatório 32 bytes, 30 dias) e grava cookie `sid`. Redireciona para `/`. Erros → `/?auth_error=<motivo>`. |
| POST | `/api/auth/logout` | Apaga a sessão no D1 e expira o cookie. `200 {"ok":true}` |
| GET | `/api/me` | `200 {"user":{"userId","username","avatar"}}` ou 401. `avatar` é a **URL completa** do CDN do Discord. |

## Disciplinas

Formato de uma disciplina na resposta:

```json
{
  "id": 1, "nome": "Cálculo I", "notaMax": 10,
  "mediaAprovacao": 7, "mediaExame": 4, "mediaFinal": 5,
  "avaliacoes": [{ "id": 3, "nome": "P1", "tipo": "prova", "peso": 4, "nota": 6.5 }],
  "resumo": { /* saída de calcular() — calculada no servidor */ },
  "updatedAt": "2026-11-10 12:00:00"
}
```

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/api/disciplinas` | — | `200 {"disciplinas":[...]}` só do usuário da sessão |
| POST | `/api/disciplinas` | disciplina sem `id` | `201 {"disciplina":{...}}` · `400 {"erro":"<mensagem>"}` · `409` se já tiver 20 disciplinas |
| PUT | `/api/disciplinas/:id` | disciplina completa (nome, regras, avaliações com notas) | `200 {"disciplina":{...}}` · `400` · `404` se não existir **ou for de outro usuário** |
| DELETE | `/api/disciplinas/:id` | — | `200 {"ok":true}` · `404` |

`PUT` substitui as avaliações inteiras (delete + insert num `DB.batch`, atômico). Notas `null` = avaliação ainda não realizada.
O `:id` precisa ser inteiro positivo; caso contrário `400`.

## Cálculo (cliente e servidor)

- Média parcial = Σ(peso·nota) / Σ(peso lançado)
- Nota mínima uniforme nas restantes para atingir a meta M = (M·Σpeso − Σ(peso·nota)) / Σpeso restante
- Metas: **aprovação direta** (`mediaAprovacao`, sem exame) e **direito ao exame** (`mediaExame`, evita reprovação direta)
- Após o exame: (média + exame) / 2 ≥ `mediaFinal` ⇒ exame ≥ 2·`mediaFinal` − média
