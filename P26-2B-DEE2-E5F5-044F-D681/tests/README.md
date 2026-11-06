# Testes automatizados — Projeto #34 (P26-2B-DEE2-E5F5-044F-D681)

Testes de API, regras de negócio e segurança feitos pelo **Agente 3 (Teste e Validação)**.
Rodam contra um D1 **local** real; o login do Discord é simulado com sessões criadas pelo
`seed-local.sql` (3 usuários fictícios: ana, bruno e carla, mais 1 sessão expirada).

| Arquivo | Para que serve |
|---|---|
| `seed-local.sql` | cria/zera os usuários e sessões de teste (nunca rode com `--remote`) |
| `api.test.mjs` | 81 testes em Node puro (`node:test` + `fetch`, sem dependências) |
| `RELATORIO.md` | resultado da última validação |

## Como rodar (na pasta do projeto)

Precisa de Node 20+ e do `.dev.vars` com `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` (podem ser falsos).
No seu PC use `npx wrangler`; aqui está escrito só `wrangler`.

```bash
# 1. banco local separado só para teste (.wrangler/ é ignorado pelo git)
wrangler d1 migrations apply DB --local --persist-to .wrangler/test-state
wrangler d1 execute DB --local --persist-to .wrangler/test-state --file tests/seed-local.sql

# 2. servidor (deixe aberto em outro terminal)
wrangler pages dev --port 8790 --persist-to .wrangler/test-state

# 3. testes
node --test tests/api.test.mjs
# outra URL: BASE_URL=http://localhost:8788 node --test tests/api.test.mjs
```

Cada execução cria seus próprios itens (marcados com uma etiqueta única), então dá para rodar
várias vezes. Como a API limita 20 cadastros por dia por usuário, depois de ~4 execuções no mesmo
dia aparece a mensagem "Limite diário atingido": rode o passo do `seed-local.sql` de novo, que ele
zera os dados dos usuários de teste.
