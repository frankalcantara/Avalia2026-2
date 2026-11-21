# Engenharia de Agentes e Harness (P26-2B-1768-7598-7D8E-716E)

Projeto #3: Batalha Naval Tático. Aluno: Lucas Carneiro Schuindt, Turma 2B.

## 1. Harness utilizado

- **Harness:** Claude (Anthropic) em chat na interface web claude.ai, sem acesso direto ao repositório. O aluno aplicou os arquivos gerados no VS Code e no GitHub, e conferiu o resultado no Cloudflare Pages.
- **Modelo:** Claude Sonnet 5.5.
- **Como os agentes foram usados:** os três papéis abaixo foram definidos como arquivos de agente em `.claude/agents/` e como skills em `skills/`. O trabalho foi conduzido em uma sessão de chat em que o Claude assumiu cada papel de forma sequencial (backend, interface, teste). Eles **não** rodaram como subagentes autônomos e independentes, e não há relatórios separados por agente.

## 2. Agentes e skills

| Agente | Arquivo do agente | Skills | Escopo |
|---|---|---|---|
| Arquiteto Backend | `.claude/agents/arquiteto-backend.md` | `skills/serverless-d1-discord/SKILL.md`, `skills/regras-batalha-naval/SKILL.md` | `functions/**`, `migrations/**` |
| Interface Vanilla | `.claude/agents/frontend-vanilla.md` | `skills/vanilla-dom-ui/SKILL.md`, `skills/regras-batalha-naval/SKILL.md` | `public/**` |
| Teste e Validação | `.claude/agents/qa-validador.md` | `skills/teste-validacao/SKILL.md`, `skills/regras-batalha-naval/SKILL.md` | `tests/**` (não corrige código de produção) |

### Agente 1: Arquiteto Backend
Escreveu as Cloudflare Pages Functions (`functions/api/**` e `functions/_lib/util.js`): login Discord OAuth2 com `state` anti-CSRF, sessões na tabela `sessions` do D1, validação da frota no servidor, processamento dos tiros (resposta apenas `agua`, `acerto` ou `afundado`), frota inimiga mantida só no servidor e placar em `users`. Todas as queries usam `prepare().bind()`.

### Agente 2: Interface Vanilla
Escreveu `public/index.html`, `public/styles.css` e `public/app.js` em HTML5, CSS3 e JavaScript puro: posicionamento horizontal e vertical com pré-visualização, combate com um `fetch` por disparo, avatar e nome do Discord, responsividade e rodapé com a Chave Única.

### Agente 3: Teste e Validação
Atuou como revisor independente do que foi entregue. O que foi executado de fato:

- `node validar-local.mjs P26-2B-1768-7598-7D8E-716E` (validador do professor) sobre o repositório.
- `node --check public/app.js` para validar a sintaxe do front-end.
- Inspeção do repositório e testes manuais no site publicado (login Discord e carregamento da interface).
- Script `tests/teste-api.mjs`, que testa por HTTP a autenticação e as rotas protegidas da API publicada (`node tests/teste-api.mjs`).

## 3. Defeitos encontrados na validação e corrigidos

| ID | Defeito | Correção |
|---|---|---|
| D1 | A pasta `functions/` estava na raiz do repositório e o Cloudflare (Root directory da subpasta) não a enxergava. As rotas `/api/*` devolviam HTML. | Funções movidas para `P26-2B-1768-7598-7D8E-716E/functions/`. |
| D2 | O arquivo `functions/api/auth/login.js` não existia. | Arquivo criado. |
| D3 | O login enviava `client_id=undefined` ao Discord: com `wrangler.jsonc` presente, o painel só aceita variáveis do tipo Secret. | `DISCORD_CLIENT_ID` e `DISCORD_CLIENT_SECRET` criados como Secrets. |
| D4 | `public/app.js` truncado (`SyntaxError`), deixando a página em branco. | Arquivo restaurado por inteiro e validado com `node --check`. |

## 4. Limitações conhecidas (não verificadas)

- Os testes automatizados cobrem só o que não exige login. Fluxos autenticados (posicionamento inválido, tiro repetido, `gameId` de outro jogador, ausência de `enemy_fleet` nas respostas) não têm teste automatizado registrado.
- Dois tiros simultâneos na mesma partida podem, em tese, contabilizar o fim da partida duas vezes. Não foi testado nem corrigido.
- Partidas abandonadas permanecem com status `playing` no banco.

## 5. Skills incluídos no repositório

- `skills/serverless-d1-discord/SKILL.md`
- `skills/vanilla-dom-ui/SKILL.md`
- `skills/teste-validacao/SKILL.md`
- `skills/regras-batalha-naval/SKILL.md`
