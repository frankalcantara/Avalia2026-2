# Engenharia de agentes e harness (P26-2C-B0E6-32E6-33BF-F8F5)

Projeto #21: Sistema de Agendamento de Monitoria. Chave: `P26-2C-B0E6-32E6-33BF-F8F5`.

## 1. Harness e modelo

- **Harness:** Claude (Anthropic) na interface web claude.ai, em conversas de chat. Os agentes não tiveram acesso ao sistema de arquivos: o código gerado foi copiado para o PowerShell, executado e testado manualmente com Node.js, Wrangler e Cloudflare Pages.
- **Modelo:** Claude Sonnet, o único usado. Nenhuma outra IA participou.
- **Como os agentes foram separados:** cada agente atuou em uma **conversa nova**, sem ver o histórico das outras, com o `SKILL.md` do seu papel colado no início. O código produzido em uma conversa era colado na seguinte para revisão.
- **Orquestração:** uma conversa principal escreveu a primeira versão do backend e do frontend, guiou o passo a passo, decidiu o que aplicar de cada revisão e escreveu o script `tests/validar-api.mjs` a partir do plano do Agente 3. Todos os comandos foram executados por mim.

## 2. Agentes

### Agente 1: backend serverless, Cloudflare D1 e Discord OAuth2

- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entrada:** `migrations/0002_agendamento.sql`, `lib/session.js`, `lib/api.js` e as rotas de `slots` e `bookings`.
- **Achados da revisão (11 itens):** falta de teto de slots, reserva sobreposta do mesmo aluno, corpo JSON `null` ou array gerando erro 500, checagem de `Origin` que deixava passar requisições sem o header, remoção de slot apagando a reserva do aluno em silêncio, sessão sem validação de tipos.
- **Aplicado:**
  - limite de 200 slots futuros por monitor e horizonte de 60 dias;
  - aluno sem reservas sobrepostas e no máximo 10 reservas futuras, dentro da própria instrução `INSERT`;
  - corpo inválido retorna 400 e corpo grande retorna 413;
  - `Origin` obrigatório em requisições que alteram dados;
  - slot com aluno agendado não pode ser removido (409);
  - validação dos tipos do `uid` e `exp` da sessão.
- **Recusado:** restringir a criação de slots a uma lista de monitores, porque contraria a especificação (qualquer usuário autenticado pode ser monitor ou aluno).
- **Não aplicado:** `LIMIT` na listagem de slots, revogação de sessão e regra de rate limit no painel do Cloudflare.

### Agente 2: interface em HTML5, CSS3 e JavaScript vanilla

- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md). Também foi consultada a skill interna `frontend-design` do Claude para as decisões iniciais de layout e tipografia.
- **Entrada:** `public/index.html`, `public/styles.css` e `public/app.js`.
- **Achados da revisão:** nenhuma falha de XSS (todo dado da API entra por `textContent`); contraste insuficiente nas cores dos horários; grade recriada a cada 20 s, o que tirava o foco do teclado; mensagens de erro em inglês e falha de rede confundida com "deslogado"; diálogo que fechava e perdia o texto digitado em caso de erro; clique duplo enviando duas requisições; ARIA de abas incorreto; formulário de horários sem validação.
- **Aplicado:** contraste e ajustes para celular, rótulos acessíveis nos horários e botões, botões de papel com `aria-pressed`, validação do formulário, mensagens em português, diálogo que mantém o texto em caso de erro, bloqueio de clique duplo, grade que só é refeita quando os dados mudam, aviso quando menos horários foram criados que o pedido.
- **Recusado:** aviso "remover horário também cancela a reserva do aluno". O revisor não sabia que o backend passou a recusar essa remoção com 409, então o aviso diria algo falso.
- **Não aplicado:** cabeçalho `Content-Security-Policy` e confirmação extra antes de cancelar.

### Agente 3: teste, auditoria e validação

- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Papel:** não escreve funcionalidades. Recebeu o `README.md`, o `lib/api.js` e as rotas de `slots` e `bookings`.
- **Entregou:**
  - um plano com 11 blocos de testes e uma checklist da rubrica;
  - um relatório de validação a partir dos resultados que devolvi, em [`tests/RELATORIO-AGENTE3.md`](./tests/RELATORIO-AGENTE3.md).
- **Ajustes que fiz no plano:** rodar no `localhost` com banco local em vez do site publicado e usar 4 usuários de teste no banco (2 monitores e 2 alunos) com cookies de sessão assinados por script, em vez de 3 contas do Discord.
- **Observação do relatório tratada:** o aviso ao monitor quando `created < requested` em `POST /api/slots` já estava no frontend.

## 3. Testes executados

Script `tests/validar-api.mjs` (escrito a partir do plano do Agente 3), contra o `localhost` com D1 local. Resultado completo em [`tests/resultado-validacao.md`](./tests/resultado-validacao.md).

| Bloco | Cobertura |
|---|---|
| 1 | Sem login (401), sem `Origin` ou com `Origin` de outro site (403) |
| 2 | Criação e listagem de horários: tipos, múltiplos de 30 min, janela de 8 h, passado, 60 dias, JSON inválido, corpo grande (413) |
| 3 | Reservas: validação do tema, horário inexistente, próprio horário, duplicata, privacidade do tema |
| 4 | Corrida: 12 requisições simultâneas de 2 alunos diferentes no mesmo horário, com 1 × 201 e 11 × 409 |
| 5 | Sobreposição de horários do mesmo aluno |
| 6 | Cancelamento e autoria (403, 404, 204) |
| 7 | Remoção de horário com e sem aluno agendado |
| 8 | Limite de 10 reservas futuras, sequencial e em paralelo |
| 9 | Horários passados |
| 10 | Limite de 200 horários por monitor |
| 11 | Robustez: tema com HTML, métodos não suportados |

**Total: 70 testes, 70 aprovados.**

Testes manuais durante o desenvolvimento: login com o Discord no `localhost` e no site publicado, criação de horários no site publicado (D1 ligado), reserva e cancelamento pela interface. O `node validar-local.mjs` do professor aprovou 9 de 9 critérios.
