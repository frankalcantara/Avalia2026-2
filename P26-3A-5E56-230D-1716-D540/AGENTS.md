# Engenharia de Agentes e Harness — P26-3A-5E56-230D-1716-D540

Projeto #34 — **Vitrine de Achados e Perdidos do Campus** · Alexandre Vieira · Turma 3A

Este documento explica **quais agentes foram criados**, **em qual harness rodaram**, **quais skills
cada um usou** e **como trabalharam juntos**. Foram usados **6 agentes** (o orquestrador + 5
especialistas), sendo **1 dedicado exclusivamente a teste e validação**.

---

## 1. Harness utilizado

| Item | Valor |
|---|---|
| **Harness** | **Claude Code** (CLI oficial da Anthropic), executado no terminal Linux (Ubuntu) |
| **Modelo base** | Claude Opus 5.5 (`claude-opus-5-5`) para o orquestrador e os agentes de código, auditoria e teste; Claude Sonnet 5.5 (`claude-sonnet-5-5`) para o agente de publicação |
| **Mecanismo de agentes** | *Subagentes* do Claude Code: cada agente tem um arquivo de definição em [`.claude/agents/`](./.claude/agents/) (frontmatter com `name`, `description`, `tools`, `model` + instruções). A sessão principal (orquestrador) dispara cada subagente com a ferramenta **Agent**, em contexto isolado, e recebe de volta um relatório. |
| **Skills** | Arquivos `SKILL.md` em [`skills/`](./skills/). Cada definição de agente manda ler a(s) sua(s) skill(s) **antes** de começar. |
| **Ferramentas dadas aos agentes** | `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` (o publicador não tem `Write`/`Edit`: só publica, não altera código) |
| **Ambiente de execução** | Node.js 22, Wrangler 4.159.0 (local ao projeto), `wrangler pages dev` com D1 local (Miniflare) para desenvolvimento e testes |

### Como os agentes se coordenaram

```
                    ┌──────────────────────────────┐
                    │ Agente 0 — Orquestrador      │  escreve o contrato (docs/ESPECIFICACAO.md),
                    │ (sessão principal Claude Code)│  as skills e as definições dos agentes
                    └──────────────┬───────────────┘
              em paralelo          │
        ┌──────────────────────────┼──────────────────────────┐
        ▼                          ▼                          │
 Agente 1 — Back-end        Agente 2 — Front-end              │
 functions/ + migrations/   public/                           │
        │  (formatos reais de resposta repassados ao front     │
        │   pelo orquestrador via mensagem)                   │
        └──────────────┬───────────┘                          │
              em paralelo                                     │
        ┌──────────────┴──────────────┐                       │
        ▼                             ▼                       │
 Agente 3 — Auditor de       Agente 4 — Teste e Validação     │
 Segurança (porta 8790,      (porta 8788, D1 local próprio)   │
 D1 isolado) → corrige ───────► re-testa o que mudou          │
        └──────────────┬──────────────┘                       │
                       ▼                                      │
              Agente 5 — Publicador Cloudflare ◄──────────────┘
              (D1 remoto + Pages + verificação pós-deploy)
```

- **Contrato único**: [`docs/ESPECIFICACAO.md`](./docs/ESPECIFICACAO.md). Back-end implementa, front-end
  consome e o testador valida **o mesmo documento**. Decisões tomadas durante a implementação foram
  registradas na seção 6 dele (pelo back-end e pelo auditor), para que os outros agentes vissem.
- **Isolamento**: cada agente tinha escopo de pastas definido (o back-end não tocava `public/`, o front-end
  não tocava `functions/`, o testador só `tests/`). Auditor e testador rodaram ao mesmo tempo em portas e
  bancos D1 locais **separados** para não interferirem.
- **Nada de "porta dos fundos"**: não existe rota de login falso. Os testes criam usuários e sessões
  direto no D1 **local** (hash SHA-256 do token), e só ali.
- **Portões**: só publica depois que o auditor não deixa achado Alta/Média aberto e o testador passa.

---

## 2. Agentes criados

### Agente 0: Orquestrador (sessão principal do Claude Code)
- **Papel:** ler o enunciado e o repositório do professor (`iniciar.mjs`, `validar-local.mjs`, robô do PR),
  fazer o fork, gerar a pasta com `node iniciar.mjs`, criar o projeto Pages e o banco D1, escrever o
  contrato, as skills e as definições dos agentes, disparar os agentes, repassar informações entre eles,
  conferir visualmente a interface (Chrome headless, deslogado e logado, desktop e celular) e abrir o PR.
- **Skills:** todas (escreveu-as) + [`skills/cloudflare-oficial/wrangler`](./skills/cloudflare-oficial/wrangler/SKILL.md).
- **Exemplo de intervenção:** encontrou na conferência visual que o ícone da busca cobria o texto (regra
  `input[type="search"]` sobrescrevendo o `padding` por especificidade) e corrigiu `public/css/estilos.css`.

### Agente 1: Programador Back-end (Serverless + D1 + Discord OAuth2)
- **Definição:** [`.claude/agents/programador-backend.md`](./.claude/agents/programador-backend.md)
- **Skills:** [`skills/serverless-d1-discord`](./skills/serverless-d1-discord/SKILL.md) e
  [`skills/cloudflare-oficial/workers-best-practices`](./skills/cloudflare-oficial/workers-best-practices/SKILL.md)
- **Entregas:** `migrations/0001_init.sql` (4 tabelas com `CHECK`s, índices únicos parciais),
  `functions/_lib/*` (http, sessão, validação pura, Discord, repositório) e todas as rotas de `functions/api/`.
  Sessão com token aleatório de 32 bytes e só o **hash** no banco (o modelo do professor usava JSON em
  base64 sem assinatura, que permitiria se passar por qualquer usuário — foi substituído).
- **Verificação própria:** 72 chamadas `curl` contra `wrangler pages dev`, todas com o status esperado.

### Agente 2: Programador Front-end (HTML5 + CSS3 + Vanilla JS)
- **Definição:** [`.claude/agents/programador-frontend.md`](./.claude/agents/programador-frontend.md)
- **Skills:** [`skills/vanilla-dom-ui`](./skills/vanilla-dom-ui/SKILL.md) e
  [`skills/ui-ux-pro-max`](./skills/ui-ux-pro-max/SKILL.md) (revisão de UI/UX, 2ª rodada)
- **Entregas:** `public/index.html`, `public/css/estilos.css`, `public/js/{api,ui,app,tema}.js`,
  `public/_headers`, `public/favicon.svg`. Filtros cruzados (tipo × categoria × situação × busca × local ×
  datas × ordem) com contadores, sincronizados com a URL; diálogos nativos `<dialog>`; tema claro/escuro;
  mobile-first. **Nenhum** `innerHTML` com dado, nenhum script ou estilo inline (CSP estrita).

### Agente 3: Auditor de Segurança
- **Definição:** [`.claude/agents/auditor-seguranca.md`](./.claude/agents/auditor-seguranca.md)
- **Skills:** [`skills/seguranca-web`](./skills/seguranca-web/SKILL.md) e
  [`skills/cloudflare-oficial/workers-best-practices`](./skills/cloudflare-oficial/workers-best-practices/SKILL.md)
- **Entregas:** [`docs/AUDITORIA-SEGURANCA.md`](./docs/AUDITORIA-SEGURANCA.md). 0 achados Alta, 1 Média
  (abuso de reivindicações em laço criar/cancelar) **corrigida** com limite atômico de 5 por usuário/item,
  7 Baixa documentadas como risco aceito. Verificação dinâmica com mais de 40 checagens (IDOR, CSRF, XSS,
  injeção SQL, corrida, cabeçalhos).

### Agente 4: Agente de Teste e Validação (QA)
- **Definição:** [`.claude/agents/testador-validador.md`](./.claude/agents/testador-validador.md)
- **Skill:** [`skills/teste-validacao`](./skills/teste-validacao/SKILL.md)
- **Entregas:** `tests/` (unitários das validações, testes estáticos do front, testes de API ponta a
  ponta com D1 local zerado e semeado a cada execução) e [`docs/RELATORIO-TESTES.md`](./docs/RELATORIO-TESTES.md).
  Também roda `validar-local.mjs` (rubrica do professor) e confere que o PR só altera a pasta da chave.
- **Regra de ouro:** os casos derivam do **contrato**, não do código; falha é reportada, nunca mascarada.
- **Como rodar:** `npm test` (unitários) e `npm run test:api` (sobe o app local, testa e derruba).

### Agente 5: Publicador Cloudflare (deploy automático)
- **Definição:** [`.claude/agents/publicador-cloudflare.md`](./.claude/agents/publicador-cloudflare.md)
- **Skills:** [`skills/deploy-cloudflare-pages`](./skills/deploy-cloudflare-pages/SKILL.md) e
  [`skills/cloudflare-oficial/wrangler`](./skills/cloudflare-oficial/wrangler/SKILL.md)
- **Entregas:** pré-voo (conta, Client ID, secret presente sem ler o valor) → migrações no D1 remoto →
  `wrangler pages deploy` → verificação pós-deploy, tudo em [`scripts/publicar.sh`](./scripts/publicar.sh).
  Nunca lê nem imprime o `DISCORD_CLIENT_SECRET` (que foi cadastrado pelo dono do projeto direto no prompt
  do `wrangler pages secret put`).

---

## 3. Skills

| Skill | Origem | Usada por |
|---|---|---|
| [`serverless-d1-discord`](./skills/serverless-d1-discord/SKILL.md) | criada para o projeto | Agente 1 |
| [`vanilla-dom-ui`](./skills/vanilla-dom-ui/SKILL.md) | criada para o projeto | Agente 2 |
| [`seguranca-web`](./skills/seguranca-web/SKILL.md) | criada para o projeto | Agente 3 |
| [`teste-validacao`](./skills/teste-validacao/SKILL.md) | criada para o projeto | Agente 4 |
| [`deploy-cloudflare-pages`](./skills/deploy-cloudflare-pages/SKILL.md) | criada para o projeto | Agente 5 |
| [`ui-ux-pro-max`](./skills/ui-ux-pro-max/SKILL.md) | terceiros ([nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), MIT) — inspecionada antes do uso, ver [`ORIGEM.md`](./skills/ui-ux-pro-max/ORIGEM.md) | Agente 2 |
| [`cloudflare-oficial/wrangler`](./skills/cloudflare-oficial/wrangler/SKILL.md) | oficial da Cloudflare ([cloudflare/skills](https://github.com/cloudflare/skills), Apache-2.0) | Agentes 0 e 5 |
| [`cloudflare-oficial/workers-best-practices`](./skills/cloudflare-oficial/workers-best-practices/SKILL.md) | oficial da Cloudflare (Apache-2.0) | Agentes 1 e 3 |

As skills de terceiros foram copiadas sem alteração de conteúdo e mantêm a licença original
([`skills/cloudflare-oficial/LICENSE-APACHE-2.0`](./skills/cloudflare-oficial/LICENSE-APACHE-2.0) e
[`skills/ui-ux-pro-max/LICENSE-MIT-terceiros`](./skills/ui-ux-pro-max/LICENSE-MIT-terceiros)).

---

## 4. Como reproduzir com o mesmo harness

1. Instale o Claude Code e abra o terminal **dentro desta pasta** (`P26-3A-5E56-230D-1716-D540/`).
   Os agentes de `.claude/agents/` passam a aparecer em `/agents`.
2. Peça, por exemplo: *"use o agente testador-validador para rodar a bateria completa"* ou
   *"use o publicador-cloudflare para publicar"*.
3. Cada agente lê o contrato e a sua skill antes de agir, e devolve um relatório com comandos e saídas reais.
