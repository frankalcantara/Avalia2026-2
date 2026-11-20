# AGENTS.md — Engenharia de Agentes (Projeto #29: Kudos Board)

Chave Única: `P26-2C-9700-D26E-48A3-4886`

## Resumo

O projeto foi construído por um **autor/coordenador** (Claude, em um chat do claude.ai) e revisado por **três agentes independentes**, cada um em uma ferramenta e conversa próprias, guiado por um skill da pasta `skills/`. O estudante executou os comandos, colou o código e o skill em cada agente, e registrou as respostas em `relatorios/`. Nenhum agente teve acesso direto à máquina ou ao repositório.

Os agentes **revisaram** o código; quem escreveu e aplicou as correções foi o autor/coordenador, depois de conferir cada apontamento contra o código real. Nem tudo que os agentes disseram estava certo, e isso está registrado abaixo.

## Harness (ambiente)

| Agente | Ferramenta | Skill usado | Relatório |
|---|---|---|---|
| 1. Backend | Gemini (gemini.google.com), chat próprio | `skills/serverless-d1-discord/SKILL.md` | `relatorios/agente-backend.md` |
| 2. Interface | ChatGPT (chatgpt.com), chat próprio | `skills/vanilla-dom-ui/SKILL.md` | `relatorios/agente-interface.md` |
| 3. Teste e validação | Claude (claude.ai), chat separado do autor | `skills/teste-validacao/SKILL.md` | `relatorios/agente-teste.md` |
| Autor/coordenador | Claude (claude.ai), chat principal | todos | — |

A versão exata de cada modelo não foi registrada. A execução foi feita pelo estudante em Git Bash, Node.js (Scoop) e Wrangler 4.x, sobre Cloudflare Pages + Functions + D1 e Discord OAuth2.

## Agente 1 — Backend (Gemini)

Revisou `functions/` e `migrations/`. Apontou 6 problemas:

| Apontamento | Resultado |
|---|---|
| Falta de `state` no OAuth2 (CSRF de login) | **Real. Corrigido**: `state` aleatório em cookie HttpOnly, verificado no callback |
| Callback engole erro ao gravar o usuário e não valida `SESSION_SECRET` | **Real em parte. Corrigido**: erro de banco redireciona com `db_error` e o segredo é validado |
| Remover `CREATE TABLE` do callback | Não aplicado, por não ter sido confirmado que a tabela existe nas migrações |
| Dados expostos em `health.js` | Exagerado: o arquivo se chama `status.js`; a chave já é pública no rodapé e no README |
| Rate limit não atômico | Procede, mas é irrelevante para o escopo; **não corrigido**. A parte sobre fuso horário está errada (tudo em UTC) |
| Sem paginação | Não é bug; o enunciado não pede |
| Mensagem só com espaços | Errado: o `.trim()` já elimina |

## Agente 2 — Interface (ChatGPT)

Revisou `public/index.html`, `styles.css` e `app.js`. Confirmou o uso seguro do DOM (`textContent`, sem `innerHTML` com dados de usuário) e o CSS Grid.

| Apontamento | Resultado |
|---|---|
| Logout ignora erro da API | **Real. Corrigido**: só recarrega se a chamada der certo; senão exibe aviso |
| `<section id="board">` sem nome acessível | **Real. Corrigido** com `aria-label` |
| Falta de `:focus-visible` nos controles | **Real. Corrigido** |
| `fmtDate` sem o `Z` | **Errado, não aplicado**: o D1 grava UTC sem fuso, e o `Z` é o que faz a conversão correta para o horário local |
| Contraste do botão principal | Não aplicado: o cálculo feito pelo coordenador deu cerca de 4,6:1, acima do mínimo de 4,5:1 |
| Validação do avatar | Não aplicado: a checagem do prefixo `https://cdn.discordapp.com/` já cobre o caso |
| Remover `novalidate`; validar JSON da API | Não aplicados: o servidor valida e os erros já aparecem na tela |

## Agente 3 — Teste e validação (Claude, chat separado)

Recebeu o skill, o `testes.mjs`, a saída de sua execução e o código de `/api/kudos`. Concluiu que os 8 testes cobrem autenticação, Origin, assinatura da sessão e validação do GET, e explicou que as regras de negócio do POST (selo, mensagem, destinatário, auto-elogio, limite) **não podem ser testadas sem login**, porque o servidor responde 401 antes de validá-las. Também apontou o que faltava (métodos PUT/PATCH/DELETE, limites do ID, formato dos erros) e **propôs** um `testes-extra.mjs`. Esse arquivo **não foi incorporado ao repositório nem executado**.

## Regras de negócio validadas no servidor

- O remetente vem de cookie assinado com HMAC-SHA256, nunca do corpo da requisição.
- Auto-elogio bloqueado (`self_kudos`), com `CHECK (from_id <> to_id)` também no banco.
- Selo validado contra lista fixa; mensagem de 3 a 280 caracteres; destinatário precisa existir.
- Verificação de `Origin` no POST; limite de 5 envios por minuto por usuário.
- Filtros `received`/`sent` validados por expressão regular e consultas parametrizadas.

## Resultados dos testes (20/11/2026)

- `node testes.mjs` contra `https://kudos-board-2c.pages.dev`: **8/8** antes e depois das correções dos agentes.
- Teste manual, logado, elogiando o próprio ID: resposta `self_kudos`.
- Login com `state` testado localmente e em produção.

## Limitações

- Os agentes fizeram revisão de código; não editaram o repositório.
- Não há teste automatizado para selo inválido, mensagem fora do tamanho, destinatário inexistente e limite de envios, que exigem sessão válida.
- O rate limit faz consulta e inserção separadas (não atômico).
