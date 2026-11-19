# Engenharia de Agentes e Harness — P26-2C-DA71-C3BA-A1AC-470B

Projeto #35 — Simulador de E-Commerce com Carteira de Créditos Fictícios.

Este documento descreve os **4 agentes** usados no desenvolvimento (mínimo
exigido: 3, sendo 1 de teste e validação), o **harness** em que operaram e
as **skills** que cada um usou. As skills estão em [`skills/`](./skills).

## 1. Harness

| Item | Valor |
| --- | --- |
| Harness | **Claude Code** (app desktop da Anthropic, aba Code, Windows 11) |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`) em todos os agentes |
| Mecanismo de agentes | Ferramenta `Agent` do Claude Code: o agente principal (orquestrador) cria subagentes do tipo `general-purpose`, cada um com contexto próprio, rodando em segundo plano e devolvendo um relatório final ao orquestrador |
| Ferramentas disponíveis aos agentes | leitura/escrita de arquivos, shell (Bash/PowerShell), `wrangler` (D1 local e `pages dev`), navegador embutido do app (para o teste de interface) |
| Comunicação entre agentes | Arquivos no repositório: `docs/CONTRATO-API.md` (contrato), `skills/*/SKILL.md` (regras) e relatórios de retorno. Nenhum agente vê o contexto do outro |

### Fluxo de coordenação

```
             ┌──────────────────────────────┐
             │ Agente 1 · Orquestrador       │
             │ esquema D1 + contrato da API  │
             └──────┬───────────────┬───────┘
         (paralelo) │               │ (paralelo)
     ┌──────────────▼───┐   ┌───────▼──────────────┐
     │ Agente 2 · Backend│   │ Agente 3 · Frontend  │
     │ functions/        │   │ public/              │
     └──────────────┬───┘   └───────┬──────────────┘
                    └──────┬────────┘
             ┌─────────────▼────────────────┐
             │ Orquestrador: integração      │
             └─────────────┬────────────────┘
             ┌─────────────▼────────────────┐
             │ Agente 4 · Teste e Validação  │
             │ tests/ + relatório            │
             └──────────────────────────────┘
```

Regra central: **escopos de arquivo disjuntos**. Backend só escreveu em
`functions/`, frontend só em `public/`, teste só em `tests/`. Assim os dois
primeiros puderam rodar em paralelo sem conflito, e o único ponto de
acoplamento foi o contrato escrito antes do código.

---

## 2. Agentes

### Agente 1 — Orquestrador (Arquiteto e Integrador)
- **Skill:** [`skills/orquestracao-contrato/SKILL.md`](./skills/orquestracao-contrato/SKILL.md)
- **Papel:** transformar o enunciado em artefatos verificáveis antes de
  qualquer código, delegar e integrar.
- **Entregas:**
  - `migrations/0001_init.sql` — esquema com `CHECK (balance >= 0)` e
    `CHECK (stock >= 0)` como trava de banco contra saldo/estoque negativos.
  - `migrations/0002_seed_products.sql` — catálogo de 18 itens fictícios.
  - `docs/CONTRATO-API.md` — todas as rotas, formatos e códigos de erro.
  - As outras três skills (`serverless-d1-discord`, `vanilla-dom-ui`,
    `teste-validacao`), `wrangler.jsonc`, `package.json`, `README.md`.
  - Integração: revisou o código entregue, aceitou as divergências
    justificadas (ex.: 405 com corpo JSON) e corrigiu o único desalinhamento
    entre backend e frontend (código `fetch_user_failed` no mapa de erros
    de login do frontend).

### Agente 2 — Backend Serverless (Cloudflare Pages Functions + D1 + Discord)
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Papel:** implementar o contrato no servidor, com todas as regras de
  negócio validadas no backend.
- **Entregas (`functions/`):**
  - `_lib/` — respostas JSON, cookies, sessões (token aleatório no cookie
    `sid`, só o SHA-256 no D1, expiração de 7 dias) e checagem de `Origin`.
  - OAuth2 do Discord com `state` anti-CSRF; upsert do usuário importando
    `user_id`, nome e avatar; saldo inicial de 5000 créditos só no primeiro
    login.
  - `checkout.js` — agrega itens, lê preço e estoque do D1 (o cliente nunca
    envia preço/total), devolve 409 para estoque ou saldo insuficiente e
    grava débito + baixa de estoque + pedido + itens num único
    `env.DB.batch()` (transação). Se uma corrida violar um `CHECK`, o lote
    inteiro é desfeito e a API responde 409 `conflict_retry`.
  - `products`, `me`, `orders`, `orders/[id]`, `status`, `logout` e um
    `_middleware.js` que dá 404 JSON para `/api/*` desconhecido sem quebrar
    o 405 automático.
- **Verificação própria:** smoke test com `curl` contra `wrangler pages dev`
  e D1 local (status, filtros, 401/403/404/405/409, checkout feliz,
  histórico, logout).

### Agente 3 — Frontend Vanilla (HTML5 + CSS3 + JavaScript puro)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Papel:** construir a loja "Bazar Pixel" consumindo só o contrato, sem
  nenhum framework, biblioteca ou CDN.
- **Entregas (`public/`):**
  - Estado único (`state`) + funções `render*()`; nenhum dado da API entra
    no DOM por `innerHTML` (só `createElement` + `textContent`).
  - Catálogo com busca, categoria, preço mínimo/máximo (campos + sliders),
    ordenação, contador e "limpar filtros".
  - Carrinho persistido em `localStorage` por usuário, limitado pelo
    estoque; total e saldo restante estimados.
  - Checkout, recibo em `<dialog>` com impressão, aba "Meus pedidos".
  - Perfil do Discord (avatar, nome, `user_id`, saldo) no cabeçalho;
    rodapé com a Chave Única; modo claro/escuro; responsivo até 360 px.
- **Verificação própria:** `node --check`, varredura estática contra
  `innerHTML`/CDN/frameworks e teste no navegador contra um servidor falso
  que imita o contrato.

### Agente 4 — Teste e Validação (obrigatório)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Papel:** verificação independente de ponta a ponta. Não escreve código
  de produção: só testes e relatório.
- **Entregas (`tests/`):**
  - `api.test.mjs` — suíte em Node puro contra o servidor local: contrato,
    autenticação, filtros, checkout, **anti-manipulação** (preço/total/
    user_id forjados no corpo, quantidades inválidas, Origin estranho),
    **atomicidade** (após um 409 nada muda no banco), **concorrência**
    (checkouts simultâneos não deixam saldo negativo e conservam créditos e
    estoque) e isolamento entre usuários.
  - Teste da interface no navegador embutido (desktop e 375 px).
  - `RELATORIO-VALIDACAO.md` — comandos, resultados reais, defeitos e a
    saída de `node validar-local.mjs`.

---

## 3. Skills

| Skill | Arquivo | Usada por |
| --- | --- | --- |
| Orquestração por contrato | [`skills/orquestracao-contrato/SKILL.md`](./skills/orquestracao-contrato/SKILL.md) | Agente 1 |
| Backend serverless D1 + Discord | [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md) | Agente 2 |
| Interface vanilla | [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md) | Agente 3 |
| Teste e validação | [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md) | Agente 4 |

Cada skill segue o formato `SKILL.md` (front-matter YAML com `name` e
`description` + instruções). Os agentes receberam no briefing o caminho da
sua skill e a instrução de segui-la à risca.

## 4. O que ficou com o humano

Ações que exigem credenciais pessoais não foram feitas por agentes: criar a
Application no Discord Developer Portal, cadastrar os redirects, gerar o
Client Secret e configurá-lo no Cloudflare, e o login do `wrangler`.
