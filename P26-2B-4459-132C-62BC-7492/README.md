# Quiz Competitivo Temporizado

> **Chave Única:** `P26-2B-4459-132C-62BC-7492`
> Aluno: Bernardo Lopes de Araujo · Turma 2B · Projeto #5

Plataforma de perguntas de múltipla escolha para revisão de conteúdos acadêmicos. Login exclusivo via **Discord OAuth2**, escolha de categoria e uma bateria de 10 perguntas com **barra de progresso regressiva**. O servidor entrega uma pergunta por vez **sem o gabarito**, mede o tempo no **Cloudflare D1** e pontua pela velocidade e precisão; respostas fora do prazo são bloqueadas.

- **URL do projeto:** _(preencher após o deploy: `https://p26-2b-4459-132c-62bc-7492.pages.dev`)_
- **Repositório:** _(preencher: URL do GitHub: `https://github.com/Bernardo-Lop-Ar/Avalia2026-2`)_
- **Licença:** MIT (`LICENSE`)

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript puro (sem frameworks nem bibliotecas) |
| Backend | Cloudflare Pages Functions (`functions/`) |
| Banco | Cloudflare D1 (`schema.sql`, `db/seed.sql`) |
| Login | Discord OAuth2 (scope `identify`): importa `user_id`, nome e avatar |

## Regras anti-manipulação (todas no servidor)

- **Cronômetro oficial no D1:** `sent_at` é gravado quando a pergunta é entregue; `answered_at` quando a resposta chega. A diferença é calculada no servidor. O tempo do navegador é só visual.
- **Sem gabarito no payload:** a pergunta traz apenas texto e 4 alternativas. A correta só é revelada após responder (`correct`/`wrong`) e na revisão final.
- **Respostas tardias bloqueadas:** depois de `limite + 500 ms` (tolerância de rede) a resposta vale 0 ponto (HTTP 408).
- **Pontuação proporcional:** acerto vale de 1000 (instantâneo) a 100 (no último instante); erro, pulo e timeout valem 0.
- **Uma resposta por pergunta:** `UPDATE ... WHERE answered_at IS NULL` impede duplo envio e corridas; a pontuação do quiz é sempre `SUM(points)` dos itens.
- **Alternativas embaralhadas no servidor** por quiz (`crypto.getRandomValues`).
- **Autoria:** todo quiz é carregado com `WHERE id = ? AND user_id = ?`.
- **Sessão e CSRF:** cookie `HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS, só o hash do token no D1; POSTs exigem `Origin` igual ao do site; `state` do OAuth vale uma única vez.
- **Limites:** um quiz ativo por usuário (índice único parcial) e no máximo 6 quizzes iniciados por minuto.
- **CSP restritiva** (`public/_headers`), sem scripts ou estilos inline, e texto do servidor sempre inserido com `textContent`.

Contrato completo da API: [`docs/API.md`](docs/API.md).

## Como publicar na Cloudflare

Pré-requisitos: conta Cloudflare, Node 20+ e um aplicativo no [Discord Developer Portal](https://discord.com/developers/applications).

1. **Instalar:** `npm install`
2. **Entrar:** `npx wrangler login`
3. **Criar o D1:** `npx wrangler d1 create quiz-competitivo-db` e colar o `database_id` retornado em `wrangler.toml`.
4. **Gerar e carregar dados:** `npm run seed:gen` e depois `npm run db:init:remote`.
5. **Criar o projeto Pages e publicar:**
   ```bash
   npx wrangler pages project create p26-2b-4459-132c-62bc-7492 --production-branch main
   npx wrangler pages deploy public --project-name p26-2b-4459-132c-62bc-7492
   ```
   Na primeira publicação o Wrangler envia também a pasta `functions/` e o binding `DB` do `wrangler.toml`.
6. **Segredos:**
   ```bash
   npx wrangler pages secret put DISCORD_CLIENT_ID --project-name p26-2b-4459-132c-62bc-7492
   npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name p26-2b-4459-132c-62bc-7492
   ```
7. **Discord:** em *OAuth2 → Redirects*, cadastrar `https://p26-2b-4459-132c-62bc-7492.pages.dev/api/auth/callback`.
8. Acessar a URL, entrar com o Discord e jogar.

Se o domínio ficar diferente do esperado, defina o segredo `DISCORD_REDIRECT_URI` com a URL exata cadastrada no Discord.

### Desenvolvimento local

```bash
cp .dev.vars.example .dev.vars        # preencha com as credenciais do Discord
npm run db:init:local
npm run dev                           # http://localhost:8788
```
Cadastre `http://localhost:8788/api/auth/callback` como redirect no Discord.

## Testes

```bash
npm test                              # 21 testes de integração do backend (Node >= 22)
node tests/e2e/frontend.e2e.mjs       # 19 verificações de interface com Playwright (API simulada)
```

## Engenharia de agentes

Veja [`AGENTS.md`](AGENTS.md): harness, quatro agentes (orquestrador/backend, arquiteto, frontend e **teste e validação**) e os skills versionados em [`skills/`](skills/).

## Estrutura

```
P26-2B-4459-132C-62BC-7492/
├── public/            frontend (index.html, css/, js/, _headers, _routes.json)
├── functions/         Pages Functions (api/, _lib/)
├── db/                banco de questões e seed gerado
├── scripts/           gerador do seed
├── tests/             integração (api.test.mjs) e e2e (e2e/)
├── skills/            skills usados pelos agentes
├── docs/API.md        contrato da API
├── schema.sql  wrangler.toml  package.json
├── AGENTS.md  LICENSE  README.md
```

---
Chave Única: `P26-2B-4459-132C-62BC-7492`
