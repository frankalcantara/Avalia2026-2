# Checklist de entrega e rastreabilidade

## Infra
- [ ] D1 `db-p26-2a-557f-d130-1422-da84` criado; `0001_init.sql` e depois `0002_shared_todo.sql` executados no Console
- [ ] `database_id` real no `wrangler.jsonc` (commit feito)
- [ ] Projeto Pages com o nome `p26-2a-557f-d130-1422-da84`, Root directory = `P26-2A-557F-D130-1422-DA84`, output = `public`
- [ ] Binding `DB` ativo
- [ ] Secrets: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `SESSION_SECRET`; novo deploy depois
- [ ] Redirect no Discord: `https://avalia2026-2-cz9.pages.dev/api/auth/discord/callback`
- [ ] `/api/status` mostra tudo `true`

## Testes
- [ ] Login com Discord mostra seu nome e avatar
- [ ] Com 2 contas: A cria lista, B entra com o código, A atribui tarefa a B (avatar aparece), B conclui
- [ ] Sem login, `/api/lists` responde 401; não-membro abrindo uma lista recebe 404
- [ ] Celular ok
- [ ] `node validar-local.mjs P26-2A-557F-D130-1422-DA84` (na raiz do repo) sem pendências
- [ ] `node skills/teste-validacao/scripts/auditar.mjs https://avalia2026-2-cz9.pages.dev` sem falhas

## Agentes (25 pts)
- [ ] Os 3 agentes realmente usados no harness
- [ ] Prints/logs e relatório do agente de teste em `docs/evidencias/`
- [ ] `AGENTS.md` sem nenhum `<<PREENCHER`

## Rastreabilidade (10 pts)
- [ ] Chave no README e no rodapé do site
- [ ] Repositório público (abrir em janela anônima) e LICENSE MIT
- [ ] README com estudante e URL reais
- [ ] Pull Request para `frankalcantara/Avalia2026-2`, título: `Projeto #15 — Leonardo Ceratti dos Santos — RA 2026107850 — P26-2A-557F-D130-1422-DA84`
- [ ] URLs do site e do repositório no AVA + print do comprovante
- [ ] Confirmado com o professor que a pasta gerada com `--offline` vale
