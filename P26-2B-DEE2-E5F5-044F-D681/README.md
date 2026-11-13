# Projeto #34: Vitrine de Achados e Perdidos do Campus

- **Modalidade:** Projeto Oficial Sorteado (valendo 100 pontos)
- **Estudante:** Artur de Souza Tereza
- **Turma:** 2B
- **Chave Única:** `P26-2B-DEE2-E5F5-044F-D681`
- **URL_CLOUDFLARE:** https://achados-perdidos-p26-2b.pages.dev
- **Licença:** MIT (ver [LICENSE](./LICENSE))

> ⚠️ Se a Cloudflare gerar outro endereço para o seu projeto, troque a linha `URL_CLOUDFLARE` acima pela URL real antes do Pull Request.

---

## O que o sistema faz

Um catálogo central de objetos **perdidos** e **encontrados** nas dependências da universidade.

- **Login exclusivo pelo Discord (OAuth2)** — importa `user_id`, nome de usuário e avatar.
- **Cadastro de itens** em dois tipos — **Perdi** e **Encontrei** — com categoria (eletrônicos, documentos, garrafas, vestuário), local exato, data e descrição detalhada.
- **Filtros cruzados rápidos** (tipo × categoria × status × busca × "só meus"), aplicados na hora, com a contagem de cada opção.
- **Reivindicações:** qualquer estudante logado pode reivindicar um item de outra pessoa ("É meu!" num item encontrado, "Eu encontrei" num item perdido). O D1 grava o **contato do Discord das duas partes**.
- **Fluxo de devolução:** quem publicou aceita ou recusa → as partes combinam pelo Discord → qualquer uma marca como devolvido → o caso fica **encerrado**.

### Regras validadas no servidor (Pages Functions)
| Regra | Resposta |
|---|---|
| Escrever sem login | 401 |
| Campos fora do padrão (tipo, categoria, tamanhos, data futura ou com mais de 1 ano) | 400 com erro por campo |
| Reivindicar o próprio item | 403 |
| Reivindicar item em devolução/encerrado ou repetir reivindicação ativa | 409 |
| Aceitar/recusar sem ser o dono; cancelar sem ser o reivindicante; agir numa reivindicação de terceiros | 403 |
| Transição de status inválida (ex.: concluir uma pendente) | 409 |
| POST sem `application/json` ou vindo de outra origem (CSRF) | 415 / 403 |
| Mais de 20 cadastros em 24 h | 429 |

## Arquitetura

```
public/                 → HTML5 + CSS3 + JavaScript puro (sem frameworks)
functions/
  _lib/                 → utilitários (http, sessão, avatar)
  api/_middleware.js    → carrega a sessão e exige login nas rotas privadas
  api/auth/discord.js           GET  inicia o OAuth2 (com state anti-CSRF)
  api/auth/discord/callback.js  GET  troca o code, salva usuário no D1, cria sessão
  api/auth/logout.js            POST
  api/me.js                     GET  usuário logado
  api/status.js                 GET  diagnóstico (D1 + Discord)
  api/items/index.js            GET lista · POST cadastra
  api/items/[id].js             PATCH {acao:"encerrar"}
  api/items/[id]/claims.js      POST abre reivindicação
  api/claims/index.js           GET minhas reivindicações (com contatos)
  api/claims/[id].js            PATCH {acao: aceitar|recusar|cancelar|concluir}
migrations/0001_init.sql → tabelas discord_users, sessions, items, claims
tests/                   → testes automatizados da API + relatório do agente de testes
skills/                  → skills usados pelos agentes (ver AGENTS.md)
```

**Modelo de dados (D1):** `discord_users` (1) ─< `items` (1) ─< `claims` >─ (1) `discord_users`. Sessões ficam em `sessions` guardando apenas o SHA-256 do token do cookie. Há `CHECK` nos enums e tamanhos e um índice `UNIQUE` parcial que impede duas reivindicações ativas da mesma pessoa no mesmo item.

## Como publicar

O passo a passo completo (Discord, D1, Cloudflare Pages e Pull Request) está em **[DEPLOY.md](./DEPLOY.md)**.

Resumo da configuração no Cloudflare Pages:
- **Root directory:** `P26-2B-DEE2-E5F5-044F-D681`
- **Build command:** *(vazio)*
- **Build output directory:** `public`
- **Binding D1:** `DB` → banco `db-p26-2b-dee2-e5f5-044f-d681` (definido no `wrangler.jsonc`)
- **Secrets:** `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET`
- **Redirect no Discord:** `https://achados-perdidos-p26-2b.pages.dev/api/auth/discord/callback`

## Rodar localmente

```bash
cd P26-2B-DEE2-E5F5-044F-D681
npx wrangler d1 migrations apply DB --local
# crie um .dev.vars com DISCORD_CLIENT_ID=... e DISCORD_CLIENT_SECRET=...
npx wrangler pages dev
```

Testes automatizados: ver [tests/README.md](./tests/README.md).

## Agentes de IA

O desenvolvimento usou 3 agentes (arquitetura serverless, interface vanilla e teste/validação). Os detalhes estão em **[AGENTS.md](./AGENTS.md)** e os skills deles estão em [`skills/`](./skills).

---
Chave Única: **P26-2B-DEE2-E5F5-044F-D681** · Licença MIT
