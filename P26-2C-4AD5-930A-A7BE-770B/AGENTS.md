# Documentação de Engenharia de Agentes e Harness (P26-2C-4AD5-930A-A7BE-770B)

> **Requisito da Rubrica (25 pontos):** uso de no mínimo **3 agentes diferentes** (sendo **1 dedicado a teste e validação**), documentando em qual _harness_ operaram e relacionando as _skills_ da pasta `skills/`.

## 1. Regras do projeto (lidas por todos os agentes)

- Cliente em HTML5, CSS3 e JavaScript puro. Nenhum framework de UI e nenhum `text-shadow`.
- Backend em Cloudflare Pages Functions (`functions/api/`) e banco Cloudflare D1. O esquema do banco fica só em `migrations/`.
- Login exclusivo via Discord OAuth2. A identidade do usuário vem sempre da sessão no servidor, nunca do corpo da requisição.
- O número de cada rolagem é gerado só na Function, com `crypto.getRandomValues`, e gravado no log com autor, data e hora. O modificador de atributo também é calculado no servidor.
- Dados aceitos: d4, d6, d8, d10, d12 e d20. Qualquer outro é recusado com 400.
- Toda consulta ao D1 usa `prepare(...).bind(...)`. Segredos ficam em variáveis do Cloudflare Pages, nunca no código.
- A Chave Única `P26-2C-4AD5-930A-A7BE-770B` aparece no README e no rodapé da interface.

## 2. Ambiente de Orquestração (Harness Utilizado)

- **Harness principal:** Visual Studio Code com GitHub Copilot em modo **Agent**, usando **agentes personalizados** definidos em `.github/agents/` (`backend.agent.md`, `frontend.agent.md` e `qa.agent.md`).
- **Modelo base:** os três agentes rodaram no modelo **GPT-6 Luna**, escolhido automaticamente pelo recurso **Copilot Fusion** do GitHub Copilot, segundo o aviso exibido no início das respostas ("selected GPT-6 Luna because it was the best choice out of the models available in your plan"). Não foi usado nenhum outro modelo ou ferramenta de IA.
- **Estratégia de coordenação:** os agentes trabalharam um de cada vez, em sequência (backend, frontend, QA), cada um restrito a uma parte do projeto pelas instruções do seu arquivo. O que um entrega serve de base para o seguinte: o backend define o banco e as rotas, o frontend lê as rotas em `functions/api/` e o QA audita o resultado publicado.
- **Controle humano:** o modo de permissões do Copilot ficou manual. Cada comando de terminal e cada leitura fora do projeto foi aprovada ou recusada individualmente (por exemplo, caminhos errados fora do workspace foram recusados e corrigidos). Nenhuma alteração foi aceita (**Keep**) antes de ser lida pelo autor.

## 3. Agentes Criados e Responsabilidades

### Agente 1: Backend (Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2)

- **Arquivo:** `.github/agents/backend.agent.md`
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Escopo permitido:** `functions/` e `migrations/`.
- **Entregas realizadas:**
  - Migration `migrations/0002_fichas.sql`, com as tabelas `sessions`, `characters` (nível de 1 a 20 e seis atributos de 1 a 30, com `CHECK`) e `roll_log` (`die` restrito a d4–d20), mais índices. O SQL foi validado em um banco SQLite temporário antes de ser aceito.
  - Correção do login Discord: parâmetro `state` aleatório conferido no callback, sessão opaca de 24 horas gravada na tabela `sessions`, cookie de sessão apenas com o ID aleatório (`HttpOnly`, `Secure`, `SameSite=Lax`), rotas `/api/me` e `/api/auth/logout`. O `POST /api/status` foi removido, e o `GET` ficou apenas como verificação de saúde.
  - Rotas `/api/characters` e `/api/characters/[id]` (listar, criar, ler, editar e apagar fichas, sempre filtradas pelo dono da sessão) e `/api/rolls`: o POST valida o dado e o atributo contra listas fixas, sorteia com `crypto.getRandomValues` descartando valores que causariam viés, calcula o modificador com o atributo salvo e grava no log; o GET devolve as últimas 50 rolagens de todos os jogadores. Apagar uma ficha que já tem rolagens retorna 409, para preservar o log de auditoria.

### Agente 2: Frontend (Interface Web em HTML5, CSS3 e JavaScript puro)

- **Arquivo:** `.github/agents/frontend.agent.md`
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Escopo permitido:** `public/`.
- **Entregas realizadas:**
  - Reescrita de `public/index.html`, `public/styles.css` e `public/app.js`: login com Discord e perfil vindos de `/api/me`, lista e formulário de fichas com modificadores de atributo calculados ao digitar (apenas exibição), botões de teste de atributo com seletor de dado, resultado devolvido pelo servidor e log da mesa atualizado a cada rolagem e a cada 10 segundos.
  - Textos vindos da API são inseridos com `textContent` (sem `innerHTML`), mensagens de erro para os casos 400 e 401, mensagem específica para o 409 ao apagar ficha com rolagens, layout responsivo e rodapé com a Chave Única, Turma 2C e licença MIT.
  - Verificação textual: nenhuma ocorrência de `/api/status`, `innerHTML`, `Math.random`, `text-shadow` ou `drop-shadow` em `public/`.

### Agente 3: QA (Teste, Auditoria de Segurança e Validação, obrigatório)

- **Arquivo:** `.github/agents/qa.agent.md`
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Escopo permitido:** somente leitura e relatório. Não corrige código.
- **Entregas realizadas:** o relatório [`docs/relatorio-qa.md`](./docs/relatorio-qa.md), dividido em três partes.
  - **Parte A, testes reais no site publicado, sem login:** rotas protegidas e cookies de sessão forjados responderam 401; o callback recusou `state` inventado (`auth_error=invalid_state`); `POST /api/status` respondeu 405; arquivos de configuração e migrations não ficaram expostos (retornam apenas a página inicial).
  - **Parte B, revisão estática de `functions/api/` e `public/`:** propriedade das fichas, validação de entradas, sorteio e modificador no servidor, SQL parametrizado, cookies e `state`, renderização segura e tratamento do 409. Nenhuma vulnerabilidade foi confirmada.
  - **Parte C, conferência da rubrica:** rodapé, ausência de frameworks, existência de agentes e skills. As verificações do `LICENSE` e do `README.md` ficaram pendentes no relatório porque o agente não leu esses arquivos, e foram conferidas manualmente pelo autor.
- **Limitações declaradas no relatório:** o agente não tem login do Discord, então os fluxos autenticados não foram executados por ele e foram avaliados apenas pelo código.

## 4. Testes manuais feitos pelo autor

Com o site publicado e login Discord real: criação de uma ficha, conferência dos modificadores exibidos (por exemplo, atributo 16 resulta em +3 e atributo 8 em -1), rolagens de d20 (Força) e de d6 (Destreza) com resultado, modificador e total corretos, e persistência do log da mesa após recarregar a página.
