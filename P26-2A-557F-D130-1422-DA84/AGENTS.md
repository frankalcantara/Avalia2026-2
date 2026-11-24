# Documentação de Engenharia de Agentes e Harness (P26-2A-557F-D130-1422-DA84)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

> Projeto #15: Lista de Tarefas Colaborativa (Shared To-Do). Estudante: Leonardo Ceratti dos Santos, RA 2026107850, turma 2A.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** VS Code no GitHub Codespaces (executado no navegador) com o **GitHub Copilot Chat**. Os três perfis de agente ficam em `.github/agents/*.agent.md`, e a tela *Personalizações do Agente → Agentes* do VS Code os reconheceu no workspace (evidência `03`).
- **Como os agentes foram acionados:** o seletor de modo do chat não apresentou os perfis como agentes selecionáveis. Cada sessão começou numa conversa nova, com o arquivo `.agent.md` correspondente **anexado como contexto** e o pedido "Atue como o agente descrito em `<perfil>.agent.md`, que está anexado. Leia a skill e siga as regras". A skill de cada agente fica em `skills/` e foi lida pelo próprio agente no início da tarefa.
- **Consequência e controle:** como o perfil entra como contexto, o Copilot **não impõe** a lista `tools` do perfil. O controle foi feito pelo estudante: o chat rodou em modo *Manual permissions*, cada pedido de leitura ou comando foi aprovado individualmente (*Allow Once*), sem usar "Permitir Tudo", e o pedido do agente `frontend` por um comando de terminal, que o perfil dele não prevê, foi negado (evidência `12`).
- **Modelo(s) Base:** **Copilot Fusion**, o único modelo disponível na conta (evidência `05`), que escolheu automaticamente **GPT-6 Luna** e **MAI-Code-1.1-Flash** conforme a etapa (evidências `07` e `11`).
- **Estratégia de Coordenação:** os agentes operaram de forma modular sobre a subpasta `P26-2A-557F-D130-1422-DA84/`, compartilhando o esquema do D1 (`migrations/`), os contratos JSON das Cloudflare Pages Functions e a verificação automatizada (`tests/api.test.mjs`, `skills/teste-validacao/scripts/auditar.mjs` e `validar-local.mjs`). O estudante revisou cada diff (`git diff`) e rodou os testes antes de cada commit; o agente de teste não edita arquivos.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Perfil:** [`.github/agents/backend.agent.md`](./.github/agents/backend.agent.md)
- **Papel:** Modelagem do esquema relacional no Cloudflare D1 (`migrations/0001_init.sql` e `0002_shared_todo.sql`), fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (`functions/`, `lib/util.js`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Tabelas `discord_users`, `lists`, `list_members` e `tasks` com índices.
  - Login Discord com `state` anti-CSRF e sessão em cookie assinado (HMAC), em `functions/api/auth/`.
  - Rotas de listas e tarefas que checam sessão, associação à lista e responsável no servidor.
- **Uso do agente (revisão de segurança):** pedi a revisão de `functions/api/lists/join.js` e `functions/api/tasks/[id].js`. O agente apontou um achado de severidade média (8/10): qualquer membro da lista podia excluir tarefas de outro membro. Decidi restringir **apenas a exclusão** ao autor da tarefa ou ao dono da lista (403 para os demais), mantendo que qualquer membro conclua, atribua e edite o título, porque o projeto exige colaboração. O agente alterou `tasks/[id].js` e `tests/api.test.mjs`; na primeira sessão também validou o formato do código de acesso em `join.js` e o tipo booleano do campo `done`. Li os diffs, rodei `node --no-warnings tests/api.test.mjs` (todos passaram) e fiz o commit `ab0193f`. Evidências: `06` a `11`.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Perfil:** [`.github/agents/frontend.agent.md`](./.github/agents/frontend.agent.md)
- **Papel:** Interface responsiva e acessível em HTML5, CSS3 e JavaScript puro, consumindo as rotas serverless via `fetch`; DOM montado sem `innerHTML` com texto de usuário.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas Realizadas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`: login, listas, código de acesso, tarefas, subtarefas, responsável com avatar do Discord e conclusão.
  - Perfil do Discord (nome e avatar) no cabeçalho e rodapé com a Chave Única `P26-2A-557F-D130-1422-DA84`.
- **Uso do agente (acessibilidade):** pedi a revisão de acessibilidade e responsividade em `public/`. O agente achou campos identificados só por `placeholder` e itens de lista clicáveis sem suporte de teclado, e aplicou `aria-label` nos campos e `role="button"`, `tabindex` e Enter/Espaço nos itens (commit `88b01a2`). Ele pediu para rodar um script de cálculo de contraste, o que o perfil dele não prevê; **neguei** o comando e informei os contrastes calculados (todos acima de 4,5:1). Numa segunda tarefa, a atualização automática da lista passou a não recarregar com o foco em `INPUT`, `SELECT` ou `TEXTAREA`, para não fechar o menu de responsável (commit `0a133df`). Conferi cada diff e rodei os testes antes do commit. Evidências: `12` a `15`.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Perfil:** [`.github/agents/testador.agent.md`](./.github/agents/testador.agent.md)
- **Papel:** Verificação independente: inspeção dos contratos de API, tentativas de contornar as validações do servidor, auditoria da rubrica de 100 pontos e execução dos testes. Não edita arquivos.
- **Skill Utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas Realizadas:**
  - `tests/api.test.mjs`: casos de sessão forjada ou expirada, não-membro, responsável inválido, subtarefa inválida, SQL injection, CSRF, exclusão restrita e fluxo do login.
  - `skills/teste-validacao/scripts/auditar.mjs`: confere rotas autenticadas, esquema e o site publicado (HTTPS, 401 sem login, `/api/status`).
- **Uso do agente:** pedi que rodasse, um por vez, os testes da API, o `auditar.mjs` contra `https://avalia2026-2-cz9.pages.dev` e o `validar-local.mjs`, e que revisasse `functions/` atrás de rotas sem `autenticar()` ou `ehMembro()`. Resultado: testes da API aprovados; `validar-local.mjs` com 9/9; auditoria com a única falha esperada na época (o `AGENTS.md` ainda tinha campos a preencher); nenhuma rota de dados desprotegida, e as rotas públicas (`/api/status`, início e callback do OAuth, logout, `lists/join`) foram explicadas como intencionais. O agente não editou arquivos. Relatório em `docs/evidencias/relatorio-testador.md` (transcrição feita por mim) e print `16`.

---

## 3. Evidências

Prints e logs das sessões ficam em `docs/evidencias/`:

- `01`, `02`: site publicado respondendo (`/api/status`) e login Discord funcionando.
- `03` a `05`: agentes reconhecidos pelo Copilot, perfil do `backend` e modelo disponível.
- `06` a `11`: sessão do agente `backend` (revisão, pedidos de permissão, achado, correção e resposta final).
- `12` a `15`: sessões do agente `frontend`, incluindo o comando negado.
- `16` e `relatorio-testador.md`: resposta e relatório do agente `testador`.

## 4. Limitações conhecidas

- Os perfis foram carregados como contexto, não como agente selecionável no chat; por isso as restrições de ferramentas foram aplicadas manualmente (ver seção 1).
- A lógica de compartilhamento entre usuários é coberta pelos testes automatizados com um banco simulado; o fluxo com duas contas reais do Discord no navegador não foi exercitado.
