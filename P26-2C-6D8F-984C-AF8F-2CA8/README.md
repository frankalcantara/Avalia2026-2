# Projeto #17: Calculadora e Simulador de Desempenho Acadêmico

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Victor Gabriel Kovalski de Barros
- **Turma:** 2C
- **Chave Única:** `P26-2C-6D8F-984C-AF8F-2CA8`
- **URL_CLOUDFLARE:** https://notas-p26-2c.pages.dev
- **Licença:** MIT (`LICENSE`)

## O que faz

O estudante entra com o **Discord (OAuth2)**, cadastra as disciplinas do semestre e define a fórmula de média de cada uma: avaliações do tipo **prova**, **trabalho** ou **lista**, cada uma com seu **peso**, mais as regras da instituição (média de aprovação direta, média mínima para ter direito ao exame e média final pós-exame).

Ao digitar uma nota, o JavaScript do cliente recalcula **instantaneamente**:

- **Média parcial** sobre as avaliações já feitas, além da média garantida (restantes valendo 0) e da média máxima possível (restantes valendo a nota máxima);
- **Nota mínima em cada avaliação restante** para a **aprovação direta** (evitar o exame) e para **não reprovar direto** (garantir o exame), indicando "já garantido" ou "impossível";
- Com todas as notas lançadas: situação final e **nota necessária no exame** ((média + exame) / 2 ≥ média final).

As notas são salvas automaticamente no **Cloudflare D1** (PUT com debounce), e o servidor revalida tudo e recalcula o resumo.

## Arquitetura

```
public/            HTML5 + CSS3 + Vanilla JS (módulos ES nativos, sem frameworks)
  js/calculo.js    regra de negócio única: calcular() e validarDisciplina() — usada no navegador E no servidor
functions/         Cloudflare Pages Functions
  api/_middleware.js        sessão opaca (cookie sid → tabela sessions); 401 sem sessão
  api/auth/discord*.js      OAuth2 com state anti-CSRF; importa user_id, nome e avatar
  api/me.js, api/auth/logout.js
  api/disciplinas/          GET/POST e PUT/DELETE por id, isolados por usuário
migrations/0001_init.sql    discord_users, sessions, disciplinas, avaliacoes (FKs + CHECKs)
tests/             node:test — cálculo e API
docs/              contrato da API e relatório de testes
skills/            SKILL.md usados pelos agentes
.claude/agents/    definição dos 3 agentes (ver AGENTS.md)
```

Segurança: o `user_id` nunca vem do cliente (só da tabela `sessions`), toda query é parametrizada e filtrada pelo dono, recurso de outro usuário responde 404, os segredos do Discord ficam como *secrets* do Pages e o cookie é `HttpOnly; Secure; SameSite=Lax`.

## Rodar localmente

```powershell
cd P26-2C-6D8F-984C-AF8F-2CA8
npx.cmd wrangler d1 migrations apply DB --local
# crie .dev.vars com DISCORD_CLIENT_ID=... e DISCORD_CLIENT_SECRET=... (não versionado)
npx.cmd wrangler pages dev --port 8788
node --test tests/calculo.test.mjs
```

## Deploy (Cloudflare Pages + D1)

```powershell
npx.cmd wrangler d1 create db-p26-2c-6d8f-984c-af8f-2ca8      # database_id vai no wrangler.jsonc
npx.cmd wrangler d1 migrations apply DB --remote
npx.cmd wrangler pages project create notas-p26-2c --production-branch main
npx.cmd wrangler pages secret put DISCORD_CLIENT_ID --project-name notas-p26-2c
npx.cmd wrangler pages secret put DISCORD_CLIENT_SECRET --project-name notas-p26-2c
npx.cmd wrangler pages deploy --project-name notas-p26-2c --branch main
```

O binding `DB` é lido do `wrangler.jsonc`. No Discord Developer Portal → OAuth2 → Redirects: `https://notas-p26-2c.pages.dev/api/auth/discord/callback`.

## Agentes

Veja [`AGENTS.md`](./AGENTS.md): 3 agentes (backend, frontend e teste/validação) no harness Claude Code, com as skills em [`skills/`](./skills).
