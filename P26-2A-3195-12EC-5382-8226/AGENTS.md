# Engenharia de Agentes e Harness — P26-2A-3195-12EC-5382-8226

Projeto #10: Rastreador de Hábitos (Habit Tracker) · Turma 2A · Henry Augusto Pereira Pupo

Este documento descreve os **três agentes** (exatamente 3) usados no desenvolvimento, sendo um deles **dedicado a teste e validação**. Também registra o harness em que operaram, as skills que cada um seguiu e o que cada um entregou.

---

## 1. Harness

- **Harness:** Claude (app do Claude em sessão agêntica). Esse ambiente roda sobre o **Claude Agent SDK**, a mesma base do **Claude Code**. A sessão tinha shell Linux, ferramentas de leitura e escrita de arquivos e a capacidade de iniciar subagentes isolados.
- **Modelo base:** Claude Opus 5.5 (Anthropic), usado na sessão principal e no subagente de validação.
- **Definições reutilizáveis:** cada agente está definido no formato de *subagent* do Claude Code em [`.claude/agents/`](./.claude/agents/). Abrindo esta pasta no Claude Code, os três agentes ficam disponíveis com o mesmo papel, as mesmas ferramentas e as mesmas skills.
- **Skills:** arquivos `SKILL.md` em [`skills/`](./skills/). Cada agente lê a sua skill antes de agir.
- **Ferramentas auxiliares usadas pelos agentes:** Node.js 22 (`node --test`, `node:sqlite`), Wrangler 4 (`wrangler pages dev` e D1 local, o mesmo runtime `workerd` da Cloudflare), Chrome headless via Playwright (capturas de tela e testes de clique) e o script `validar-local.mjs` do professor.

### Estratégia de coordenação

```
Sessão principal (orquestradora) — exatamente 3 agentes
 ├─ backend-d1-discord   → migrations/, functions/, src/lib/, tests/   (skill serverless-d1-discord)
 ├─ frontend-vanilla     → public/                                     (skill vanilla-dom-ui)
 └─ qa-validacao         → só lê e executa; não edita                  (skill teste-validacao)
        └─ defeitos encontrados voltam para o agente dono do arquivo
```

- **Contrato entre agentes:** o formato JSON das rotas está fixado no README e repetido na definição do agente frontend-vanilla. O front-end não inventa rotas e o back-end não mexe em `public/`.
- **Separação de escopo:** cada definição em `.claude/agents/` declara quais pastas o agente pode alterar. O agente qa-validacao recebe apenas ferramentas de leitura e execução, para que a validação seja independente de quem escreveu o código.
- **Ordem de execução:** agente backend-d1-discord (banco, regras e API com testes) → agente frontend-vanilla (interface sobre o contrato da API) → agente qa-validacao (auditoria) → correções → nova rodada do agente qa-validacao.

### Como os agentes rodaram nesta entrega

- **Os agentes backend-d1-discord e frontend-vanilla** foram executados pela sessão principal do harness, um de cada vez. Cada um carregou a sua skill e ficou restrito ao seu escopo.
- **O agente qa-validacao** foi executado como **subagente separado**, com contexto próprio. Ele não acompanhou a escrita do código e recebeu apenas a sua definição (`.claude/agents/qa-validacao.md`), a skill `teste-validacao` e o enunciado.

---

## 2. Agentes

### Agente 1: Arquiteto Serverless — Cloudflare D1 e Discord OAuth2

- **Definição:** [`.claude/agents/backend-d1-discord.md`](./.claude/agents/backend-d1-discord.md)
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Ferramentas:** Read, Write, Edit, Bash, Grep, Glob
- **Papel:** modelar o banco, implementar o login Discord OAuth2, os endpoints REST e todas as regras e métricas no servidor.
- **Entregas:**
  - `migrations/0001_init.sql`: tabelas `users`, `sessions`, `habits` e `completions`. A chave primária de `completions` é `(habit_id, date)`, com `ON DELETE CASCADE`, índices e `CHECK` de formato da data.
  - `functions/api/auth/discord.js` e `functions/api/auth/discord/callback.js`: OAuth2 com `state` anti-CSRF. O callback importa `user_id`, nome de usuário e avatar para o D1.
  - Sessões no servidor: o cookie `HttpOnly` leva um token aleatório e o D1 guarda só o hash SHA-256 (`src/lib/session.js`).
  - Endpoints REST de hábitos e marcações (`PUT`/`DELETE` idempotentes por data) e `/api/metrics`.
  - `src/lib/metrics.js`: streak máximo, sequência atual e taxa mensal. `src/lib/validate.js`: regras de nome, cor, limite, data não futura e mês não futuro.
  - `functions/api/_middleware.js`: bloqueio de origem cruzada, sessão e tratamento de erros.
  - Testes unitários e de integração (`tests/`), usando um adaptador SQLite que imita a API do D1.

### Agente 2: Especialista em Interface Vanilla (HTML5, CSS3 e DOM)

- **Definição:** [`.claude/agents/frontend-vanilla.md`](./.claude/agents/frontend-vanilla.md)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Ferramentas:** Read, Write, Edit, Bash, Grep, Glob
- **Papel:** construir a interface só com HTML, CSS e JavaScript puro, consumindo o contrato da API.
- **Entregas:**
  - `public/index.html`: telas de login e painel, `<dialog>` de edição e `<footer>` com a Chave Única.
  - `public/app.js`: estado em memória, renderização com `createElement`/`textContent` (sem `innerHTML` com dados do usuário) e delegação de eventos. A marcação é **otimista**: a barra CSS muda no clique e depois recebe os números oficiais do servidor; em caso de erro, a mudança é desfeita.
  - `public/styles.css`: grade com primeira coluna fixa e rolagem horizontal no celular, barras de progresso por variável CSS `--p` com transição, indicadores em 4 ou 2 colunas, foco visível e `prefers-reduced-motion`.
  - `public/_headers`: Content-Security-Policy restritiva (sem scripts ou estilos inline).
  - Verificação visual em 1366 px e 390 px com capturas de tela no Chrome headless. Ajustes feitos depois das capturas: alinhamento da coluna de nomes, largura para caber 31 dias, "Novembro de 2026", rolagem até o dia de hoje e quebra de nomes longos no celular.

### Agente 3: Teste e Validação (obrigatório)

- **Definição:** [`.claude/agents/qa-validacao.md`](./.claude/agents/qa-validacao.md)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Ferramentas:** Read, Bash, Grep, Glob (sem permissão de edição)
- **Papel:** verificação independente de ponta a ponta. Roda os testes, sobe o runtime real da Cloudflare localmente, tenta contornar as regras do servidor, confere a matemática das métricas à mão e audita a rubrica com `validar-local.mjs`.
- **Entregas:** relatório de validação (seção 3), com status por item, evidências e defeitos encaminhados aos agentes backend-d1-discord e frontend-vanilla.

---

## 3. Registro da validação

### Rodada 1: auditoria independente

O agente qa-validacao rodou a suíte de testes e subiu o runtime real da Cloudflare (`wrangler pages dev` com D1 local). Ele criou três usuários de teste e tentou contornar cada regra com `curl`, conferiu as métricas à mão e executou `validar-local.mjs`.

**Aprovado nesta rodada:**
- 36 de 36 testes passaram.
- 401 sem sessão, com sessão forjada ou expirada.
- 422 para datas futuras ou inexistentes e para `today` falsificado.
- 404 ao acessar hábitos de outro usuário.
- 403 para origem cruzada.
- 415, 400 e 413 para corpos inválidos.
- `state` do OAuth falso recusado.
- XSS bloqueado: só `textContent`, com CSP ativa.
- Métricas conferidas à mão, por exemplo 5/18 = 27,8%, sequência atual 3 e máxima 4 atravessando a virada de mês e de ano.

**Defeitos encontrados e correções:**

| # | Severidade | Defeito | Correção (agente responsável) |
|---|---|---|---|
| 1 | Alta | `AGENTS.md` ausente. A auditoria rodou enquanto o documento ainda estava sendo escrito. | Documento concluído; itens 4 e 5 da rubrica agora ✅ (orquestração) |
| 2 | Média | Com 40 POSTs simultâneos, o usuário ficava com 40 hábitos, acima do limite de 30, porque o COUNT e o INSERT eram separados | INSERT condicional atômico `INSERT ... SELECT ... WHERE (SELECT COUNT(*)) < 30` (agente backend-d1-discord) |
| 3 | Média | Nome duplicado contornável com acento decomposto (NFD) ou caractere de largura zero | `normalize("NFC")` e remoção de caracteres invisíveis em `validateHabitName` (agente backend-d1-discord) |
| 4 | Baixa | Duplicados enviados em paralelo retornavam 500 | Erro de índice único convertido em 409 (agente backend-d1-discord) |
| 5 | Baixa | Falha de rede com o Discord no callback virava JSON 500 | `try/catch` nos `fetch`, com redirecionamento para `?auth_error=...` (agente backend-d1-discord) |
| 6 | Baixa | Rotas `/api/*` inexistentes devolviam o HTML da página | `functions/api/[[catchall]].js` responde 404 em JSON (agente backend-d1-discord) |
| 7 | Baixa | `today` do cliente aceito com ±1 dia do UTC | Mantido por decisão de projeto: cobre os fusos de UTC-12 a UTC+14 e está documentado no README |
| 8 | Baixa | Taxa mensal penalizava hábito criado no meio do mês | A base passa a começar na criação do hábito, ou na primeira marcação retroativa, sem nunca passar de 100% (backend-d1-discord e frontend-vanilla) |
| 9 | Nit | `buildHabit` era código morto | Removido (agente backend-d1-discord) |
| — | Nota | Comportamento incerto de `prompt=none` no OAuth | Parâmetro removido (agente backend-d1-discord) |

### Rodada 2: reverificação das correções

As correções foram reverificadas com os mesmos comandos do protocolo do agente qa-validacao, no runtime real:

| Verificação | Resultado |
|---|---|
| `npm test` (agora com testes para NFD, largura zero e base da taxa) | 39 de 39 aprovados |
| 40 POSTs simultâneos | 30 × 201 e 10 × 409; banco com exatamente 30 hábitos |
| "corrida", "CORRIDA", "CoRRida"… em paralelo | 1 × 201 e 4 × 409, nenhum 500 |
| "água" em NFD e "á​gua" com largura zero, depois de "água" | 409 e 409 |
| `GET /api/nada`, `GET /api/auth/logout` | 404 em JSON |
| Callback com Discord inacessível | 302 para `/?auth_error=token_exchange_failed` |
| Fluxo no navegador (criar, duplicado, renomear, excluir, meses, sair) | Sem erros de JavaScript |
| `node validar-local.mjs P26-2A-3195-12EC-5382-8226` | Itens 1 a 8 ✅. O item 9 depende do deploy online |

---

## 4. Como reproduzir

1. Instale o Claude Code e abra o terminal dentro de `P26-2A-3195-12EC-5382-8226/`.
2. As definições de `.claude/agents/` são carregados automaticamente. Liste-os com `/agents`.
3. Para rodar a validação, peça: *"use o agente qa-validacao para auditar o projeto"*. O agente segue `skills/teste-validacao/SKILL.md` e devolve o relatório.
4. Para mudanças, peça ao agente dono do escopo, por exemplo: *"use o agente backend-d1-discord para adicionar ..."*. Depois, rode o `qa-validacao` de novo.
