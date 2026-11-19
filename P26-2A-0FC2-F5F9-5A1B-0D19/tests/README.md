# Testes (Agente 3: Teste e Validação)

Projeto #26 · Chave `P26-2A-0FC2-F5F9-5A1B-0D19`. Todos os testes usam apenas `node:test` (zero dependências). O wrangler e o Playwright ficam **fora** da pasta do projeto.

| Arquivo | O que cobre | Precisa de servidor? |
|---|---|---|
| `unit.test.mjs` | `validatePollInput` e `buildResults` (limites e percentuais) | não |
| `api.test.mjs` | Rotas da API, sessão, voto duplo/simultâneo, prazo, Origin, OAuth | sim |
| `e2e.mjs` | Interface no Chromium (Playwright): login, criar, votar, barras, footer | sim |

## 1. Preparar o ambiente (uma vez)

```bash
mkdir -p ~/wr && cd ~/wr && npm init -y && npm i wrangler   # wrangler fora do projeto
export W=~/wr/node_modules/.bin/wrangler
export ST=~/wr/state                                         # estado do D1 local fora do projeto
cd <pasta do projeto>
$W d1 migrations apply DB --local --persist-to $ST
```

## 2. Subir os servidores locais

```bash
# servidor principal, sem variáveis do Discord
$W pages dev public --port 8788 --inspector-port 9230 --persist-to $ST &
# servidor auxiliar com credenciais FALSAS, só para testar o redirecionamento OAuth
$W pages dev public --port 8789 --inspector-port 9231 --persist-to $ST \
  --binding DISCORD_CLIENT_ID=123456789012345678 --binding DISCORD_CLIENT_SECRET=segredo-falso-teste &
```

Se o servidor da porta 8789 não estiver no ar, os 3 testes de OAuth que dependem dele são marcados como `skipped`.

## 3. Rodar

```bash
node --test tests/unit.test.mjs
WRANGLER=$W PERSIST_TO=$ST node --test tests/api.test.mjs
WRANGLER=$W PERSIST_TO=$ST SCREENS_DIR=../screens node tests/e2e.mjs   # rodar de onde o pacote playwright seja resolvido
```

Variáveis: `BASE_URL` (padrão `http://localhost:8788`), `OAUTH_BASE_URL` (padrão `http://localhost:8789`), `WRANGLER` (padrão `npx wrangler`), `PERSIST_TO` (o mesmo `--persist-to` do `pages dev`; omita se usou o padrão `.wrangler/`), `SCREENS_DIR` (padrão `../screens`).

Os testes criam usuários e sessões direto no D1 local (gravando o SHA-256 do token, como faz o callback do OAuth) e enviam o cookie `sessao`. Não existe porta dos fundos no código de produção. Cada execução usa IDs novos, então pode ser repetida sem limpar o banco.

## 4. Depois

Encerre os servidores e apague `.wrangler/` se ele tiver sido criado dentro do projeto. Resultado da última validação: [`RELATORIO-VALIDACAO.md`](./RELATORIO-VALIDACAO.md).
