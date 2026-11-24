# Agentes, harness e skills

**Projeto #10 — Rastreador de Hábitos** · Chave única: `P26-2C-7195-ACC2-3B49-1AE1`

## Harness

Os agentes operam no **Claude Code** (CLI da Anthropic), que carrega *subagents* definidos em Markdown na pasta `.claude/agents/`. Cada arquivo tem um cabeçalho (nome, descrição, ferramentas permitidas, modelo) e um prompt de sistema próprio. O agente principal delega tarefas a eles pelo nome, e cada subagente trabalha com contexto isolado.

Os **skills** ficam em `skills/<nome>/SKILL.md`. Cada agente tem, no seu prompt, a instrução de ler o skill correspondente antes de agir.

```
.claude/agents/
├── arquiteto-backend.md
├── dev-frontend.md
└── qa-validador.md
skills/
├── serverless-d1-discord/SKILL.md
├── vanilla-dom-ui/SKILL.md
└── teste-validacao/SKILL.md
```

## Os três agentes

| Agente | Papel | Pode escrever em | Skill usado |
|---|---|---|---|
| `arquiteto-backend` | Esquema D1, login Discord OAuth2, endpoints REST, regras de negócio e métricas (streaks, taxa mensal) | `functions/`, `lib/`, `migrations/`, `wrangler.jsonc` | `serverless-d1-discord` |
| `dev-frontend` | Interface em HTML5/CSS3/JS puro: grade mensal, barras de progresso, indicadores, login, responsividade | `public/` | `vanilla-dom-ui` |
| `qa-validador` | **Teste e validação**: roda a suíte, cria testes, audita segurança, confere a rubrica. Não corrige código-fonte, apenas reporta | `tests/` | `teste-validacao` |

### Agente 1 — arquiteto-backend (backend serverless)

Definição: [`.claude/agents/arquiteto-backend.md`](.claude/agents/arquiteto-backend.md) · Skill: [`serverless-d1-discord`](skills/serverless-d1-discord/SKILL.md).
Modela o esquema no D1 por migrations, implementa o login Discord OAuth2 e os endpoints REST, e concentra todas as regras de negócio no servidor (validação, propriedade dos dados, bloqueio de datas futuras, métricas).

### Agente 2 — dev-frontend (interface em Vanilla JS)

Definição: [`.claude/agents/dev-frontend.md`](.claude/agents/dev-frontend.md) · Skill: [`vanilla-dom-ui`](skills/vanilla-dom-ui/SKILL.md).
Constrói a grade mensal, as barras de progresso em CSS, os indicadores numéricos e o login, em HTML5/CSS3/JS puro, consumindo o contrato de API do `README.md`.

### Agente 3 — qa-validador (teste e validação)

Definição: [`.claude/agents/qa-validador.md`](.claude/agents/qa-validador.md) · Skill: [`teste-validacao`](skills/teste-validacao/SKILL.md).
Agente dedicado a **teste e validação**: executa `npm test`, escreve novos testes, audita segurança e confere a rubrica. Não corrige o código-fonte: reporta o defeito ao agente dono.

### Por que essa separação
- Cada agente tem **escopo de escrita restrito**, o que evita que um agente desfaça o trabalho do outro.
- O `qa-validador` não conserta o que testa: ele reporta e o agente dono corrige. Assim quem valida não é quem produziu o código.
- O contrato entre front e back é a seção **API** do `README.md`.

## Fluxo de trabalho

```
arquiteto-backend ──(contrato de API no README)──► dev-frontend
        │                                              │
        └──────────────► qa-validador ◄────────────────┘
                              │
              relatório de defeitos (arquivo, passos, esperado × obtido)
                              │
                 volta ao agente dono → correção → nova validação
```

1. `arquiteto-backend` cria migration, Functions e `lib/`, e documenta o contrato.
2. `dev-frontend` constrói a interface sobre esse contrato.
3. `qa-validador` executa `npm test`, audita e valida; defeitos voltam ao agente dono.
4. Só depois de a suíte passar e o relatório estar limpo é feito o deploy.

## Skills

| Skill | Conteúdo |
|---|---|
| [`serverless-d1-discord`](skills/serverless-d1-discord/SKILL.md) | Roteamento das Pages Functions, uso do D1 (SQL parametrizado, batch, migrations), regras de negócio no servidor, fluxo OAuth2 do Discord, checklist de segurança |
| [`vanilla-dom-ui`](skills/vanilla-dom-ui/SKILL.md) | Regras de DOM sem framework, atualização otimista com o servidor como fonte da verdade, barras de progresso em CSS, acessibilidade, responsividade |
| [`teste-validacao`](skills/teste-validacao/SKILL.md) | Comandos de teste, cobertura da suíte, regras do validador, auditoria de segurança, checklist da rubrica, formato do relatório |

## Como executar os agentes

Na raiz desta pasta, com o Claude Code instalado:

```bash
claude
```

Dentro da sessão, peça a delegação pelo nome do agente, por exemplo:

```text
Use o agente arquiteto-backend para revisar functions/api/habits e confirmar que toda rota valida o dono do hábito.
Use o agente dev-frontend para ajustar a grade para telas de 360px.
Use o agente qa-validador para rodar a suíte e auditar segurança antes do deploy.
```

O comando `/agents` lista os agentes carregados de `.claude/agents/`.

## Registro de execução

**Como foram executados:** em 18 e 19/11/2026, na sessão do Claude (ambiente Claude Code), cada agente rodou como subagente isolado, iniciado com o prompt da sua definição em `.claude/agents/` e instruído a ler o skill correspondente antes de agir. Respeitaram o escopo de escrita descrito acima. Os relatórios abaixo resumem o que cada um devolveu; nada foi verificado em produção (Discord real e D1 remoto ficaram fora do alcance dos agentes).

| Data | Agente | Pedido resumido | Resultado / achados |
|---|---|---|---|
| 18/11/2026 | `arquiteto-backend` | Auditar `functions/` e `lib/` pelo checklist do skill e procurar diferenças entre o D1 simulado e o runtime real que afetem streaks e taxa mensal | Checklist OK: SQL parametrizado, filtro por `user_id`, Origin/CSRF, cookies, segredos fora do repositório. Cálculo das sequências correto. **Defeito preventivo corrigido** em `lib/stats.js`: `todayInTimeZone` dependia do formato textual do locale `en-CA`; passou a montar a data com `formatToParts`. Apontou que `.dev.vars.example` citava a rota antiga de callback (corrigido depois). Sem verificação: Workers/D1 reais |
| 18/11/2026 | `qa-validador` | Rodar a suíte, auditar segurança, conferir a rubrica offline e escrever testes de borda para as sequências | Suíte original 33/33. Auditoria de segurança sem achados. Criou `tests/streak-bordas.test.mjs` (16 testes: meia-noite em America/Sao_Paulo, virada de mês e ano, sequência de 444 dias, vários hábitos, marcar/desmarcar repetido, PUT x GET idênticos). Total **49/49**. Teste ponta a ponta no Chromium com cliques rápidos: estado igual após recarregar. Reportou 2 melhorias de UX (rótulo das sequências em mês passado; indicadores de sequência atrasados em relação às barras). Sem verificação: login real e deploy |
| 19/11/2026 | `dev-frontend` | Revisar `public/` (teclado, 360px, indicadores e barras, rodapé com a chave, CSP) e avaliar os 2 achados de UX do QA | A 1ª tentativa foi interrompida por limite de uso da conta e foi refeita. Teclado, 360px, rodapé e CSP OK. **Melhorias aplicadas:** rótulos "Sequência atual" e "Maior sequência" com explicação de que não dependem do mês exibido; cards de sequência sinalizados como "atualizando" (`aria-busy` e opacidade) até o servidor responder; descarte de respostas de navegação antiga; foco devolvido ao título do mês. Números continuam vindo só do servidor |

Fluxo entre os agentes: o `qa-validador` reportou à parte de interface (`dev-frontend`) os dois achados de UX, e o `dev-frontend` os tratou. O `arquiteto-backend` sugeriu testes para o `qa-validador`, que os incluiu.

## Resultado de validação (suíte automatizada)

`npm test` executa 49 testes (`tests/stats.test.mjs`, `tests/api.test.mjs` e `tests/streak-bordas.test.mjs`): 49 passaram, 0 falharam em 19/11/2026. Re-execute localmente e atualize esta linha após cada mudança.
