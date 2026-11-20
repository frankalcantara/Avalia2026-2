# Testes da API — Shared To-Do (P26-3A-8F79-F6CA-8535-422A)

Sem dependências npm: `node:test`, `node:assert` e `fetch` nativos (Node 20+). Contrato em `docs/API.md`.

Na pasta do projeto (Windows/PowerShell; no Bash troque `npx.cmd` por `npx`):

```powershell
# 1. .dev.vars de teste (NÃO commitar). SESSION_SECRET aleatório; Discord com valores falsos basta.
#    DISCORD_CLIENT_ID=teste-local / DISCORD_CLIENT_SECRET=teste-local / SESSION_SECRET=<aleatório>
# 2. banco local + usuários de teste
npx.cmd wrangler d1 migrations apply DB --local
npx.cmd wrangler d1 execute DB --local --file tests/seed.sql
# 3. servidor (outro terminal)
npx.cmd wrangler pages dev --port 8788
# 4. testes
$env:SESSION_SECRET = "<o mesmo do .dev.vars>"; node --test tests/
```

Variáveis: `BASE_URL` (padrão `http://127.0.0.1:8788`) e `SESSION_SECRET` (obrigatória; os cookies de
sessão dos usuários de teste são assinados com ela). A suíte cria listas novas a cada execução, então pode
ser repetida sem limpar o banco. Para não misturar com dados de desenvolvimento, use o mesmo
`--persist-to <pasta>` nos três comandos do wrangler.

Cobre: sessão ausente/adulterada/expirada/malformada, isolamento entre listas, entrada por código
(inválido, repetido, concorrente), responsável não membro, subtarefa de outra lista e sub-subtarefa,
limites de título/nome, `done` booleano, fluxo com dois usuários, DELETE em cascata, 405, injeção SQL/HTML
armazenada literalmente, início do OAuth (302 + `state`) e nenhuma resposta 5xx.

Também cobre (58 testes no total) a edição de título (`PATCH title`: trim, vazio, 201 caracteres, falha sem gravar
parcialmente, novo título visto pelo outro membro) e `DELETE /api/lists/:id/members/:userId`: 401, ids inválidos,
405, não membro 404, membro removendo outro ou o dono 403, dono saindo 409, alvo não membro 404, saída e remoção
204 com perda imediata de acesso, tarefas do removido com `assignee: null` (demais e outras listas intactas),
atribuir ao removido 400 e reentrada pelo código. O seed inclui um quinto usuário (`teste_carla`).

Observação: para adulterar a assinatura troque um caractere do meio. O último caractere de uma assinatura
base64url de 32 bytes tem 2 bits de preenchimento que `atob()` ignora; trocar A por B ali gera a mesma assinatura.
