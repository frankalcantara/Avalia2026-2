# Agentes, harness e skills

Chave de auditoria: **P26-2C-DC19-34DD-D6E4-3F3F**

## Harness

Os agentes rodaram no **Claude (modelo Claude Sonnet 5.5, da Anthropic)**, na interface de chat do Claude (claude.ai) com o ambiente agêntico, que fornece shell, ferramentas de arquivo e a ferramenta **Agent**, capaz de disparar subagentes com contexto próprio. O ambiente é construído sobre o Claude Code.

- Os papéis dos agentes estão em `.claude/agents/*.md`. Cada subagente foi iniciado como agente do tipo `general-purpose` e recebeu como primeira instrução a leitura do seu arquivo de papel, das suas skills e do contrato da API.
- As skills estão em `.claude/skills/<nome>/SKILL.md`. Foram escritas pelo orquestrador antes de os subagentes começarem, e cada agente foi instruído a lê-las antes de trabalhar.
- O orquestrador (o próprio Claude da conversa, a partir dos requisitos do aluno) definiu o contrato `docs/CONTRATO-API.md` e o esquema `migrations/0001_init.sql`, dividiu o trabalho, revisou os relatórios e aplicou correções.

## Fluxo

```
Requisitos do aluno
        │
   Orquestrador ──► contrato da API + esquema D1 + skills + papéis
        │
        ├──► Agente 1  arquiteto-backend   ─┐  (em paralelo)
        └──► Agente 2  frontend-vanilla    ─┘
                         │
                         ▼
                Agente 3  qa-validador  (testes e revisão)
                         │
                         ▼
        Orquestrador aplica as correções apontadas e reexecuta os testes
```

## Agentes

| # | Agente | Papel | Skills | Arquivos que produziu |
|---|---|---|---|---|
| 1 | `arquiteto-backend` | Backend serverless | `cloudflare-pages-d1`, `discord-oauth2` | `functions/**`, `package.json`, `.gitignore` (o `wrangler.toml` inicial foi removido depois, pois o deploy é pelo painel) |
| 2 | `frontend-vanilla` | Interface sem frameworks | `vanilla-ui` | `public/index.html`, `public/style.css`, `public/app.js` |
| 3 | `qa-validador` | **Teste e validação** | `qa-node-test` | `tests/api.test.mjs`, `tests/helpers/d1-shim.mjs` |

Definições completas: [`arquiteto-backend`](.claude/agents/arquiteto-backend.md), [`frontend-vanilla`](.claude/agents/frontend-vanilla.md), [`qa-validador`](.claude/agents/qa-validador.md).

## Skills

| Skill | Usada por | Conteúdo |
|---|---|---|
| [`cloudflare-pages-d1`](.claude/skills/cloudflare-pages-d1/SKILL.md) | Agente 1 | Roteamento por arquivo, D1 com `bind`, operações atômicas, checklist |
| [`discord-oauth2`](.claude/skills/discord-oauth2/SKILL.md) | Agente 1 | Fluxo Authorization Code, `state`, sessão com hash no D1, avatar |
| [`vanilla-ui`](.claude/skills/vanilla-ui/SKILL.md) | Agente 2 | DOM seguro, hash routing, renderização de código, CSS acessível |
| [`qa-node-test`](.claude/skills/qa-node-test/SKILL.md) | Agente 3 | Shim de D1 sobre `node:sqlite`, casos obrigatórios, formato do relato |

## Resultado do agente de teste e validação

Execução de `node --test tests/api.test.mjs`: **46 testes, 46 aprovados** após as correções abaixo.

Na primeira execução houve 1 falha: a varredura estática encontrou a palavra `innerHTML` em um **comentário** de `public/app.js` (falso positivo, sem uso real). O comentário foi reescrito.

Riscos apontados pelo agente 3 na revisão estática e o que foi feito:

| Risco | Ação |
|---|---|
| Sessões expiradas nunca eram apagadas | Corrigido: `criarSessao` remove sessões expiradas antes de inserir |
| `Origin` comparado só pelo host | Corrigido: compara origem completa (esquema, host e porta) |
| Contagem de caracteres diferente no cliente (UTF-16) e no servidor (pontos de código) | Corrigido: cliente usa `Array.from(...).length` |
| O `node --test tests/` do Node 22 exigia um `index.js` | Corrigido: script `npm test` aponta direto para `tests/api.test.mjs` |
| Corrida entre leitura e escrita em `accept` | Mitigado pelo `UPDATE` atômico condicionado; sem teste de concorrência |
| Logout aceita `Origin` ausente | Mantido por decisão de projeto (impacto: apenas logout forçado) |
| `style` inline em `app.js` impediria uma CSP restritiva | Registrado, não alterado |

## Limites declarados

Os testes usam `node:sqlite` como substituto do D1 e simulam o Discord; o teste de ponta a ponta com o Discord real e o D1 da Cloudflare só é possível após o deploy (veja `TUTORIAL.md`, seção de verificação).
