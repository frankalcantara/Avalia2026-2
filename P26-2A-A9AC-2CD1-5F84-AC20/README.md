# Projeto #11: Controle Financeiro Pessoal

- **Modalidade:** Projeto Oficial Sorteado (Valendo 100 pontos)
- **Estudante:** Gabriel Teixeira Scholles
- **Turma:** 2A
- **Chave Única:** `P26-2A-A9AC-2CD1-5F84-AC20`
- **URL_CLOUDFLARE:** https://trabalho-financeiro-pessoal.pages.dev

---

## Especificação do Projeto

Desenvolva uma aplicação de livro-caixa para registro de receitas e despesas categorizadas. A interface em HTML e JavaScript puro deve apresentar formulários com validação de tipos monetários, filtros por mês/categoria e um painel superior que resume o saldo líquido atual do usuário autenticado via Discord.

Todas as transações financeiras são gravadas no banco de dados Cloudflare D1 associadas à credencial OAuth2 do estudante. Além das operações básicas de criação, leitura, atualização e exclusão (CRUD), o código JavaScript no cliente deve construir gráficos de barras horizontais ou colunas utilizando exclusivamente elementos <div> e estilização CSS proporcional aos percentuais gastos em cada categoria.

---

## O que a aplicação faz

- Login obrigatório com Discord (OAuth2), importando `user_id`, nome de usuário e avatar.
- Cadastro, edição e exclusão de receitas e despesas, com categoria, data e descrição.
- Painel superior com saldo líquido, total de receitas e total de despesas.
- Filtros por mês (AAAA-MM) e por categoria.
- Gráfico de barras horizontais feito só com `<div>`, com largura proporcional ao percentual gasto em cada categoria.
- Valores aceitos como `25,90`, `25.90` ou `1.234,56`, guardados em centavos inteiros.

## Tecnologias

- **Cliente:** HTML5, CSS3 e JavaScript puro (sem frameworks).
- **Servidor:** Cloudflare Pages Functions (`functions/`), com toda a validação no servidor.
- **Banco:** Cloudflare D1 (`migrations/0001_init.sql`).
- **Autenticação:** Discord OAuth2, com sessão em cookie `HttpOnly` e token guardado como hash no D1.

## Estrutura

```
public/       interface (index.html, styles.css, app.js, _headers)
functions/    API: auth, me, transactions, status
migrations/   esquema do banco D1
skills/       skills usadas pelos agentes
tests/        testes automatizados
AGENTS.md     agentes, harness e casos de teste
```

## Como publicar

Dentro desta pasta:

1. `npx.cmd wrangler login`
2. `npx.cmd wrangler d1 create financeiro-db` e copiar o `database_id` para o `wrangler.jsonc` (o binding `DB` já está declarado lá).
3. `npx.cmd wrangler d1 migrations apply financeiro-db --remote`
4. No Discord Developer Portal, criar a aplicação e cadastrar em OAuth2 → Redirects:
   `https://trabalho-financeiro-pessoal.pages.dev/api/auth/discord/callback`
5. Guardar as credenciais como secrets:
   - `npx.cmd wrangler pages secret put DISCORD_CLIENT_ID --project-name trabalho-financeiro-pessoal`
   - `npx.cmd wrangler pages secret put DISCORD_CLIENT_SECRET --project-name trabalho-financeiro-pessoal`
6. `npx.cmd wrangler pages deploy public --project-name trabalho-financeiro-pessoal --branch main`

## Testes

Requer Node 22.5 ou superior:

```
node tests/backend.test.mjs
node tests/ui.test.mjs
```

Na raiz do repositório: `node validar-local.mjs P26-2A-A9AC-2CD1-5F84-AC20`.

## Agentes

Três agentes (arquiteto serverless, interface e teste/validação), o harness e os casos de teste estão descritos em [AGENTS.md](./AGENTS.md).

## Licença

MIT, veja o arquivo [LICENSE](./LICENSE).
