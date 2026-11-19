# Documentação de Engenharia de Agentes e Harness (P26-2A-567B-6EC5-D24D-9098)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

Projeto #42: Bookmark Manager. Estudante: Rogério Gapski da Silva. Horários em Brasília (UTC-3).

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness principal:** Claude, no aplicativo web **claude.ai** (plano gratuito). Cada agente é uma **conversa separada**, aberta com um texto de papel, regras do projeto e a skill do agente. Não foi usado agente de código instalado na máquina (Claude Code, Cursor, Cline etc.): o código foi gerado nas conversas e salvo e executado pelo estudante no terminal (WSL).
- **Modelo base:** Claude Sonnet 5.5 (modelo do plano gratuito), nos três agentes.
- **Estratégia de coordenação:** as conversas não compartilham memória. A passagem de trabalho entre elas foi feita por um **RESUMO DE ESTADO** (arquivos, nomes, tabelas, rotas, pendências) que o agente anterior gerou e o estudante colou na abertura do seguinte. Todos operaram sobre a subpasta `P26-2A-567B-6EC5-D24D-9098/`, compartilhando o esquema do D1, os contratos JSON da API e a verificação automatizada.
- **Papel do estudante:** salvar os arquivos entregues, executar os comandos e testes reais (`wrangler`, Discord real, navegador) e levar os resultados de volta aos agentes. Nenhum agente tinha acesso ao terminal ou ao Discord.
- **Agente de apoio (fora dos 3 agentes de código):** uma quarta conversa no claude.ai ajudou na organização: manteve as anotações destes registros, montou as mensagens de passagem entre as conversas, orientou os comandos de deploy na Cloudflare e redigiu o `README.md` e este `AGENTS.md` a partir das anotações. Não escreveu o código do projeto.

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2 (Backend)
- **Conversa:** claude.ai, Claude Sonnet 5.5. Aberta em 15/11/2026, por volta de 19:27.
- **Papel:** modelagem do esquema relacional no D1, login Discord OAuth2 com sessão no banco, API de coleções e links, e validação das regras de negócio no servidor (`functions/` e `migrations/`). Não altera `public/`.
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Etapas e resultados:**

| Etapa | Data e hora | Resultado |
|---|---|---|
| Reconhecer a base | 15/11, 19:30 | Descreveu os arquivos gerados pelo script oficial; decisões: manter `discord_users`, FKs para `discord_users(user_id)`, `/api/auth/me` devolve `{user_id, username, avatar}`, remover `status.js` |
| Banco D1 | 15/11, 19:35 | `migrations/0002_bookmarks.sql`: tabelas `sessions`, `collections` e `links`, `CHECK` de status e de tamanhos, índices, `DROP` da tabela de exemplo `project_records`. Aplicada no D1 local |
| Login Discord | 15/11, 19:47 | 6 arquivos: `functions/_lib/http.js`, `_lib/auth.js`, `api/auth/discord.js`, `discord/callback.js`, `me.js`, `logout.js`. Testado pelo agente com D1 simulado (11 verificações). Testado pelo estudante no wrangler real com Discord real em 16/11, ~19:09: login funcionou |
| API de coleções e links | 16/11, 19:42 | 7 arquivos (`functions/_lib/api.js` e 6 rotas): CRUD de coleções e links, visibilidade pública, rota pública, filtro combinado. Testado pelo agente com 26 grupos de verificação e 2 usuários simulados. Testado pelo estudante no wrangler real em 16/11, 19:51 (criar coleção, criar link, filtro combinado): passou |
| Resumo de estado | 17/11, 11:55 | Resumo de passagem para o Agente 2 |

- **Exemplo real de entrada e saída (etapa do banco):**
  - *Entrada:* pedido da migration 0002 com tabelas `sessions`, `collections` e `links`, chaves estrangeiras para `discord_users(user_id)`, `CHECK` de status ('Para Ler', 'Lendo', 'Concluído') e índices.
  - *Saída:* `migrations/0002_bookmarks.sql`, com a explicação das decisões: limites no banco como segunda barreira de validação, formato único para `expires_at` e o índice `idx_links_collection` para a listagem pública.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM) (Frontend)
- **Conversa:** claude.ai, Claude Sonnet 5.5. Aberta em 17/11/2026, por volta de 22:00, com o resumo de estado do Agente 1.
- **Papel:** interface em `public/` com HTML5 semântico, CSS3 mobile-first e JavaScript puro em módulos ES, consumindo a API existente. Não altera `functions/` nem `migrations/` e não cria rotas.
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Etapas e resultados:**

| Etapa | Data e hora | Resultado |
|---|---|---|
| HTML e CSS | 17/11, ~22:05 | `public/index.html`, `public/colecao.html` e `public/styles.css`, com a chave no `<footer>` das duas páginas e um contrato de ids e classes para o JavaScript. O agente conferiu no código (sem `innerHTML`, sem sombra em texto, sem CDN); não abriu em navegador |
| JavaScript | 17/11, ~22:17 | `public/app.js`, `public/colecao.js`, `public/js/api.js`, `public/js/ui.js` e `public/js/publica.js`. Testado pelo agente em DOM simulado (jsdom, 41 verificações). Testado pelo estudante no wrangler real com Discord real em 17/11, 22:45 (checklist da etapa): passou |
| Resumo de estado | 17/11, 22:51 | Resumo de passagem para o Agente 3 |

- **Exemplo real de entrada e saída (etapa de HTML e CSS):**
  - *Entrada:* pedido da interface (login, barra lateral de coleções, filtro de status, cards de links, `<dialog>` de edição, página pública), com o bloco do login e a tabela de rotas da API.
  - *Saída:* os três arquivos e o contrato de ids e classes (por exemplo `#collectionList`, `.filter-btn[data-status]`, `.link-card`, `#publicView`), usado depois pela etapa de JavaScript.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (QA) (obrigatório)
- **Conversa:** claude.ai, Claude Sonnet 5.5. Aberta em 18/11/2026, às 09:44, com o resumo de estado do Agente 2. Recebeu o código de `functions/`, `migrations/` e `public/` em quatro partes.
- **Papel:** criar testes e roteiros, revisar o código recebido e reportar bugs, falhas de segurança e violações dos requisitos, por gravidade, sem implementar funcionalidades nem alterar o código do projeto.
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md) (com `serverless-d1-discord` e `vanilla-dom-ui` como critérios de revisão)
- **Entregas (em `tests/`):**
  - `api.test.mjs`: 115 casos com `node:test` e `fetch` (autenticação, validação de URL, status e título, CRUD, filtro combinado, isolamento entre usuários, rota pública, XSS, métodos HTTP).
  - `seed-qa.sql` e `cleanup-qa.sql`: usuários e sessões fictícios só para o banco local.
  - `CHECKLIST_MANUAL.md`: 86 itens (fluxo completo, responsividade em 360/768/1280px, teclado, XSS, rodapé, requisitos estáticos e produção).
  - `RELATORIO_QA.md`: casos, resultados e achados.
- **Resultados reais dos testes automatizados (executados pelo estudante no wrangler local):**
  - 1ª execução, 18/11, 18:28: 114 de 115 passaram. A falha (HTTP-01) era um erro do próprio teste (o `fetch` recusa corpo em requisição GET), não da API.
  - Após corrigir a linha do teste, 18/11, 18:31: **115 de 115 passaram**, 0 falhas, 0 pulados.
- **Achados da revisão estática (resumo; detalhes em `tests/RELATORIO_QA.md`):** 0 críticos, 1 alto, 3 médios e 10 baixos.
  - O achado de gravidade alta (ENC-01, caracteres corrompidos em "Concluído") foi **descartado** após verificação: a corrupção veio da cópia do código para a conversa (codificação do Windows), não dos arquivos. `grep` não encontrou o padrão em `functions/`, `migrations/` nem `public/`, e os testes com "Concluído" passaram.
  - Os demais achados (cabeçalhos de segurança, avatar público com o ID do Discord, sessão em texto puro, entre outros) estão registrados no relatório. A URL do avatar público é uma limitação conhecida, documentada no `README.md`.
- **Exemplo real de entrada e saída:**
  - *Entrada:* pedido de testes automatizados (sem login → 401, URL `javascript:` ou `ftp:` → 400, status inválido → 400, acesso a dados de outro usuário → 403/404, coleção privada → 404 e pública → 200 sem login), checklist manual e revisão do código colado.
  - *Saída:* `tests/api.test.mjs` com 115 casos, mais o checklist e o relatório.

---

## 3. Skills (`skills/`)

| Skill | Usada por | Conteúdo |
|---|---|---|
| `skills/serverless-d1-discord/SKILL.md` | Agente 1 (e critério do Agente 3) | Pages Functions, D1 com consultas parametrizadas, migrations, login Discord com sessão, checklist de validação da API |
| `skills/vanilla-dom-ui/SKILL.md` | Agente 2 (e critério do Agente 3) | HTML/CSS/JS puro, DOM seguro (`textContent`), estados de tela, acessibilidade, chave no rodapé |
| `skills/teste-validacao/SKILL.md` | Agente 3 | Checklist de verificação, casos de teste do projeto e formato do relatório |

Cada skill foi colada integralmente na mensagem de abertura da conversa do agente correspondente.

## 4. Ocorrências durante o desenvolvimento

- 15/11, 19:37: erro "No configuration file found" ao rodar o wrangler na raiz do repositório; resolvido entrando na pasta do projeto.
- 17/11, ~22:05: o Agente 2 informou que a pasta `public/` não existia no ambiente dele e criou os arquivos do zero; o `colecao.html` carrega `/colecao.js`, o que a etapa de JavaScript original não previa, e a etapa foi ajustada.
- 18/11: caracteres de acentuação corrompidos ao copiar o código para a conversa do Agente 3 (causa: `clip.exe`); gerou o achado ENC-01, descartado com verificação nos arquivos reais.

## 5. Verificação final e publicação

- Publicado no Cloudflare Pages em 18/11/2026 por volta de 18:38: `https://projeto-p26-2a-567b-6ec5-d24d-9098.pages.dev`.
- Verificado pelo estudante em produção: `/api/auth/me` sem login devolve `401`, a página abre com a chave no rodapé e o login com o Discord funciona.
- A verificação de conformidade `node validar-local.mjs P26-2A-567B-6EC5-D24D-9098` é executada na raiz do repositório antes do Pull Request.