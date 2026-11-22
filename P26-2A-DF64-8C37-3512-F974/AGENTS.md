# Engenharia de Agentes · Memorize

**Chave:** `P26-2A-DF64-8C37-3512-F974`

## Harness utilizado

**Claude Code** (Anthropic), usado pela extensão do VS Code no Windows, com o modelo Claude Opus 5.5.

- **Sessão principal (orquestrador):** recebeu o enunciado e escreveu o código seguindo as skills do projeto.
  Também disparou os agentes, consolidou os relatórios e aplicou as correções.
- **Subagentes:** os agentes do projeto estão definidos como *subagents* do Claude Code em
  [`.claude/agents/`](.claude/agents/). Cada um é um arquivo Markdown com front matter (`name`,
  `description`, `tools`, `model`) e um prompt de sistema que manda ler as suas skills antes de agir.
- **Skills:** ficam em [`skills/<nome>/SKILL.md`](skills/), no formato de skills do Claude Code (front matter
  `name`/`description` + instruções). Para carregá-las como skills nativas, copie a pasta para `.claude/skills/`.
- **Execução:** os três agentes rodaram **em paralelo, em segundo plano**, pela ferramenta *Agent* do Claude Code.
  Cada um tinha contexto próprio e isolado e devolveu um relatório à sessão principal.
- **Restrição do ambiente:** a máquina de desenvolvimento não tinha Node.js. Por isso, nesta rodada, o agente de
  teste rastreou os testes manualmente. Os comandos reais ficam documentados para o laboratório (ver Agente 3).

| Agente | Arquivo | Skills | Ferramentas | Escopo |
|---|---|---|---|---|
| 1 · Arquiteto Serverless | [`.claude/agents/arquiteto-serverless.md`](.claude/agents/arquiteto-serverless.md) | `serverless-d1-discord`, `sm2-repeticao-espacada` | Read, Grep, Glob, Edit, Write | `functions/`, `migrations/`, `wrangler.jsonc` |
| 2 · UI Vanilla | [`.claude/agents/ui-vanilla.md`](.claude/agents/ui-vanilla.md) | `vanilla-dom-ui` | Read, Grep, Glob, Edit, Write | `public/` |
| 3 · Testador e Validador | [`.claude/agents/testador-validador.md`](.claude/agents/testador-validador.md) | `teste-validacao`, `sm2-repeticao-espacada` | Read, Grep, Glob, Bash (sem edição) | `tests/`, auditoria geral |

Além desses três, a sessão principal usou o subagente nativo **web-fetch** do Claude Code. Ele leu o repositório
oficial `frankalcantara/Avalia2026-2` (`README`, `iniciar.mjs` e `validar-local.mjs`) para descobrir a
estrutura de pasta e as verificações exigidas.

---

## Agente 1 — Arquiteto Serverless (D1 + Pages Functions + Discord OAuth2)

**Missão:** modelar o D1, implementar o OAuth2 do Discord e garantir que toda regra de negócio
(dono do recurso, fila diária, SM-2, limites, concorrência) roda no servidor.

**Skills:** [`serverless-d1-discord`](skills/serverless-d1-discord/SKILL.md) e
[`sm2-repeticao-espacada`](skills/sm2-repeticao-espacada/SKILL.md).

**Execução:** revisão estática de `functions/**`, `migrations/0001_init.sql` e `wrangler.jsonc`.

**Verificou e aprovou:**
- imports e roteamento do Pages (`[id].js` ao lado de `[id]/`, `_lib` sem rotas);
- uso da API do D1 (`first`, `all`, `run`, `batch`, `meta.changes`, `RETURNING`, `ROW_NUMBER()`);
- fluxo OAuth com `state`, filtro por dono em todas as consultas, ausência de SQL interpolado;
- SM-2 conforme a tabela da skill.

**Achados e o que foi feito:**

| # | Achado | Ação |
|---|---|---|
| 1 | O limite de 20 novos/dia podia ser burlado trocando `X-Timezone` | **Corrigido.** O fuso agora fica em `users.timezone` e só pode mudar 1×/24h (`_middleware.js`, `todayFor`). |
| 2 | Verificação da cota e escritas da revisão não eram atômicas | **Corrigido.** `review.js` usa um único `batch`, com a cota dentro do `UPDATE` e o histórico gravado só se o update ocorreu. |
| 3 | Corrida no primeiro login podia duplicar o baralho de exemplo | **Corrigido.** O upsert usa `RETURNING created_at`, e o baralho e os cartões são criados num único `batch`. |
| 4 | Falha de rede com o Discord devolvia JSON 500 na navegação | **Corrigido.** `discordFetch` com `try/catch` redireciona para `/?login=token`. |
| 5 | `prompt=none` dificultava a troca de conta | **Corrigido.** Parâmetro removido. |
| 6 | API do Discord sem versão | **Corrigido.** Agora usa `https://discord.com/api/v10`. |
| 7 | Duas queries confiavam só em `loadDeck` para o dono | **Corrigido.** Adicionado `AND user_id = ?`. |
| 8 | Apagar o cartão apagava o histórico e "devolvia" a cota | **Corrigido.** FKs de `reviews` agora usam `ON DELETE SET NULL`. |
| 9 | `PRAGMA foreign_keys` redundante na migração | **Corrigido.** Removido. |
| 10 | `database_id` de exemplo no `wrangler.jsonc` | Mantido como placeholder. É substituído no deploy (README, passo 2). |
| 11 | Cookie de sessão sem prefixo `__Host-` | **Corrigido.** Agora é `__Host-sid`. |

## Agente 2 — Especialista em UI Vanilla (HTML5 + CSS3 + JS puro)

**Missão:** interface sem frameworks, com manipulação direta do DOM, animação CSS 3D de virar o cartão,
botões Difícil/Bom/Fácil, responsividade e acessibilidade.

**Skill:** [`vanilla-dom-ui`](skills/vanilla-dom-ui/SKILL.md).

**Execução:** revisão estática de `public/index.html`, `public/styles.css` e `public/app.js`, conferindo os
campos usados contra o JSON real das rotas em `functions/api/`.

**Verificou e aprovou:**
- todos os `#ids` existem;
- os campos batem com a API;
- não há `innerHTML` nem framework/CDN;
- a chave está no `<footer>`;
- o CSS do flip (`preserve-3d`, faces empilhadas no grid, `backface-visibility` com prefixo) está correto.

**Achados e o que foi feito:**

| # | Achado | Ação |
|---|---|---|
| 1 | Tecla repetida ou clique duplo avaliava o próximo cartão "às cegas" durante a animação | **Corrigido.** `busy` só é liberado depois que o novo cartão é exibido, e `ev.repeat` é ignorado. |
| 2 | Enter no diálogo acionava "Cancelar" (primeiro submit do DOM) | **Corrigido.** "Salvar" vem primeiro no DOM e a ordem visual é invertida no CSS. |
| 3 | Ctrl+Enter furava a proteção contra envio duplo | **Corrigido.** Checagem de `button.disabled` e `!ev.repeat`. |
| 4 | O leitor de tela não lia a pergunta/resposta | **Corrigido.** O `aria-label` do cartão agora contém o texto da face visível. |
| 5 | `route()` roubava o foco do cartão | **Corrigido.** |
| 6 | Toast de erro com contraste baixo no tema escuro | **Corrigido.** |
| 7 | Plural "mêses" | **Corrigido** para "meses". |
| 8 | Spinner infinito em `#/deck/0` e toasts de rotas abandonadas | **Corrigido.** |
| S | Hover preso no toque, links desabilitados focáveis, contraste do tema claro, Safari antigo, foco ao concluir a fila | **Todos aplicados.** |

## Agente 3 — Testador e Validador (teste e validação)

**Missão:** executar e conferir os testes, o teste de fumaça do deploy e o validador oficial, e auditar se as
regras são impostas no servidor. **Não edita código**, apenas reporta com arquivo:linha e severidade.

**Skills:** [`teste-validacao`](skills/teste-validacao/SKILL.md) e
[`sm2-repeticao-espacada`](skills/sm2-repeticao-espacada/SKILL.md).

**Artefatos de teste:**
- [`tests/sm2.test.mjs`](tests/sm2.test.mjs): 12 testes do algoritmo e das datas (EF, intervalos,
  invariante Difícil ≤ Bom ≤ Fácil, teto, estado corrompido, virada de mês/ano, fuso horário);
- [`tests/validate.test.mjs`](tests/validate.test.mjs): 8 testes de validação de entrada, cookies, ids,
  token/hash de sessão e avatar do Discord;
- [`tests/smoke.mjs`](tests/smoke.mjs): teste de fumaça contra o deploy (footer com chave, `/api/status`, redirect
  OAuth com `state`, callback rejeitando `state` inválido, 401 sem login, sessão forjada, CSRF → 403).

**Execução nesta rodada:**
- O Node.js não estava instalado, então o agente rastreou manualmente cada asserção dos 20 testes contra
  `functions/_lib/*.js`, incluindo os arredondamentos de ponto flutuante. Resultado: **20/20 testes PASS**.
- Revisou o `smoke.mjs` contra o middleware e as rotas e concluiu que todas as verificações passam num deploy correto.
- Simulou as 8 regras do `validar-local.mjs`.
  - Apontou como críticos a ausência de `README.md` e de `AGENTS.md`, que ainda estavam sendo escritos. Os dois foram criados.
  - Apontou 2 consultas em `decks/[id]/cards.js` sem filtro `user_id` (o mesmo achado do item 7 do Agente 1). Foram corrigidas.
- **2ª rodada (depois das correções):**
  - Recontou os parâmetros de bind do novo `review.js` (14 e 16) e do batch do callback.
  - Confirmou que não há imports quebrados nem TDZ em `app.js`.
  - Repetiu a simulação do validador oficial: **8/8 OK**.
  - Veredito: **APROVADO**, com o alerta de que, se um D1 remoto já tiver a migração antiga, é preciso recriá-lo ou aplicar um `ALTER TABLE`.

**Comandos para a validação no laboratório (Node via Scoop):**
```powershell
cd P26-2A-DF64-8C37-3512-F974
node --test tests/
node tests/smoke.mjs https://p26-2a-df64-8c37-3512-f974.pages.dev
cd ..; node validar-local.mjs P26-2A-DF64-8C37-3512-F974
```

---

## Fluxo de trabalho (Agent workflow)

```
Enunciado ──► Sessão principal (Claude Code) ──► web-fetch: lê o repositório oficial
                     │ escreve o código seguindo as skills
                     ▼
     ┌───────────────┼────────────────┐   (em paralelo, contextos isolados)
     ▼               ▼                ▼
 Agente 1        Agente 2         Agente 3
 backend/D1      UI vanilla       testes/validação
     └───────────────┼────────────────┘
                     ▼
     relatórios ──► sessão principal aplica as correções ──► Agente 3 valida de novo
```

Para repetir o ciclo, abra o projeto no Claude Code e peça, por exemplo: *"use o agente testador-validador para
validar o projeto"*. O harness carrega a definição em `.claude/agents/` e as skills que ela referencia.
