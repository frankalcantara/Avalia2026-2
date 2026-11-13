# Documentação de Engenharia de Agentes e Harness (P26-2A-93BE-4A78-BC67-3577)

> **Requisito da Rubrica (25 pontos):** uso de no mínimo **3 agentes diferentes** (1 dedicado a teste e validação), documentando o *harness* e as *skills* em `skills/`.

## 1. Harness utilizado

- **Harness:** Claude (Anthropic) em sessão de agente, com shell em máquina virtual, navegador embutido e acesso controlado ao computador do estudante (pasta do repositório, PowerShell e VS Code).
- **Modelo base:** Claude Sonnet 5.5 (`claude-sonnet-5-5`).
- **Como os agentes foram organizados:** cada agente é um **papel** com uma skill própria (`skills/<nome>/SKILL.md`) e um contrato de entrega. Eles atuaram em passadas separadas sobre a subpasta `P26-2A-93BE-4A78-BC67-3577/`, passando adiante contratos explícitos: o esquema do D1 (`migrations/`), o contrato JSON da API (seção 3) e o checklist de testes.
- **Humano no ciclo:** o estudante executou os comandos de `git`, `wrangler` e de deploy, criou a aplicação no Discord Developer Portal e guardou o Client Secret em `.dev.vars` (fora do Git). Nenhum segredo é versionado.

## 2. Agentes, responsabilidades e entregas

### Agente 1 — Arquiteto Serverless, Cloudflare D1 e Discord OAuth2
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Papel:** esquema relacional, rotas serverless e toda a regra de jogo no servidor.
- **Entregas:**
  - `migrations/0001_init.sql` e `0002_batalha_naval.sql`: tabelas `discord_users`, `sessions`, `games`, `ships`, `shots`, `scores`, com `CHECK` e `UNIQUE` (ex.: um tiro por célula e por atirador).
  - Login Discord OAuth2 com `state` anti-CSRF e sessão guardada no D1 (cookie só com token aleatório, `HttpOnly`): `functions/api/auth/*`.
  - Posicionamento validado no servidor (limites, sobreposição, navios e tamanhos definidos pelo servidor): `functions/_lib/game.js`, `functions/api/games/[id]/fleet.js`.
  - Frota do computador sorteada e mantida **só no servidor**; `GET /api/games/:id` nunca devolve sua posição.
  - Tiros em `functions/api/games/[id]/shoot.js`: responde apenas `agua`, `acerto` ou `afundado`; escritas atômicas com `env.DB.batch`; ao fim da partida atualiza `scores`.

### Agente 2 — Interface Web Vanilla (HTML5, CSS3, DOM)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Papel:** cliente sem frameworks, que só pede ações ao servidor e desenha o resultado.
- **Entregas:** `public/index.html`, `public/styles.css`, `public/app.js`:
  - posicionamento horizontal/vertical (botão ou tecla R), pré-visualização válida/inválida e posição aleatória;
  - combate com duas malhas, mensagens de água/acerto/afundado e retomada da partida ao recarregar;
  - cabeçalho com avatar e nome do Discord, placar geral e rodapé com a chave `P26-2A-93BE-4A78-BC67-3577`.

### Agente 3 — Teste, Auditoria de Segurança e Validação (dedicado)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Papel:** verificar de forma independente o que os outros agentes entregaram, tentando **burlar** o servidor, e só então liberar o commit.
- **Entregas:**
  - `tests/regras.test.mjs` — `node tests/regras.test.mjs` (13.230 verificações; ver seção 4).
  - Protocolo de testes de API da seção 4, executado contra o servidor local (`wrangler pages dev`) com sessões de teste criadas direto no D1 e removidas ao final.
  - Achados que geraram correções (seção 5).
  - Conferência final com `node validar-local.mjs P26-2A-93BE-4A78-BC67-3577` (na raiz do repositório).

## 3. Contrato da API

| Rota | Método | Função |
|---|---|---|
| `/api/auth/discord` e `/api/auth/discord/callback` | GET | Login Discord OAuth2 (`identify`) |
| `/api/auth/logout` | POST | Apaga a sessão |
| `/api/status` | GET | Usuário logado e diagnóstico |
| `/api/games` | GET / POST | Partida em andamento / criar partida |
| `/api/games/:id` | GET | Estado da partida (sem a frota do computador) |
| `/api/games/:id/fleet` | POST | Valida e grava a frota; sorteia a do computador |
| `/api/games/:id/shoot` | POST | Tiro `{row, col}` → `agua` \| `acerto` \| `afundado` |
| `/api/scores` | GET | Placar geral |

Frota enviada: `{"ships":[{"name":"porta-avioes","row":0,"col":0,"orientation":"H"}, ...]}`.

## 4. Testes executados pelo Agente 3

**Regras puras (`node tests/regras.test.mjs`):** frota válida; fora do limite (H e V); sobreposição; frota incompleta, com navio a mais, duplicado ou desconhecido; coordenadas não inteiras, texto ou negativas; orientação inválida; entrada que não é lista; tamanho forjado pelo cliente ignorado; 300 frotas aleatórias do computador (17 células distintas, dentro do tabuleiro); resultados água/acerto/afundado; 200 partidas simuladas do computador sem tiro repetido e terminando em até 100 tiros.

**API contra o servidor local:**

| Caso | Esperado | Resultado |
|---|---|---|
| Criar partida sem login | 401 | OK |
| Criar partida logado | 201 | OK |
| Frota válida | 200, partida `em_combate` | OK |
| Reenviar frota | 409 | OK |
| Porta-aviões fora do tabuleiro / sobreposição / 4 navios / tamanho forjado | 400 | OK |
| Outro usuário lê a partida | 404 | OK |
| Tiro antes de posicionar a frota | 409 | OK |
| Coordenada 10 | 400 | OK |
| Tiro repetido | 409 | OK |
| Tiro após o fim da partida | 409 | OK |
| `GET` da partida mostra posições do computador? | não (só `shipsRemaining` e `sunk`) | OK |
| Fim da partida atualiza `scores` e `/api/scores` | sim | OK |
| Logout invalida a sessão | `sessionUser: null` | OK |

**Interface:** partida completa clicando nas células (posição aleatória → combate → fim), retomada após recarregar a página e conferência de que o HTML não contém posições do computador.

## 5. Falhas encontradas pelo Agente 3 e corrigidas

1. **Clique duplo na mesma célula** gerava erro 409 de "tiro repetido" na interface (a tela era redesenhada só depois da resposta). Correção: o cliente trava os botões até redesenhar; o servidor continua sendo a barreira (restrição `UNIQUE` no D1).
2. **Rota `/api/status` aceitava `userId` e `username` vindos do cliente**, o que permitia forjar identidade. Correção: a identidade vem só da sessão no D1.
3. **Teste do próprio agente usou o campo errado (`key` em vez de `name`)** e o servidor respondeu 400 "Navio desconhecido": confirmou que a validação rejeita entradas fora do contrato.
