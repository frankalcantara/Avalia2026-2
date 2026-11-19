# Documentação de Engenharia de Agentes e Harness (P26-2B-DEE4-F0F5-E242-5759)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Codex para a etapa do Agente 1.
- **Modelo(s) Base:** GPT-6 para a etapa do Agente 1.
- **Estratégia de Coordenação:** Os agentes operaram de forma modular sobre a subpasta `P26-2B-DEE4-F0F5-E242-5759/`, compartilhando especificações de banco de dados D1, contratos JSON das Cloudflare Pages Functions e verificação automatizada via `validar-local.mjs`.

---

## 2. Agentes Criados e Responsabilidades (Mínimo de 3 Agentes)

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** Modelagem do esquema relacional SQLite no Cloudflare D1 (`migrations/0001_init.sql`), implementação do fluxo de autenticação Discord OAuth2 e validação das regras de negócio no servidor (`functions/`).
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas Realizadas:**
  - Estruturação das tabelas e índices no Cloudflare D1.
  - Proteção das rotas serverless contra manipulação no cliente.
  - Implementação das rotas de cadastro, consulta, reserva e listagem de passageiros com a migração incremental `migrations/0002_caronas.sql`.
  - Validação do `state` OAuth2 e sessão Discord autenticada com HMAC-SHA-256. As escritas usam a identidade da sessão, inclusive no endpoint de diagnóstico.
  - Reserva condicionada à disponibilidade, à saída futura e à identidade do passageiro. O gatilho do SQLite decrementa a vaga no mesmo comando que cria a reserva, e a chave composta impede duplicatas.
- **Testes executados pelo Agente 1:** Node.js 26.13.1 com as duas migrações em SQLite em memória, adaptador para a interface D1 e respostas simuladas do Discord. Verificados o fluxo OAuth2 com `state` válido e ausente, rejeição de assinatura adulterada e de origem externa, validação de data e vagas, cadastro com identidade da sessão, filtros, reserva da última vaga por dois pedidos disparados juntos, idempotência, reversão de inserção que excederia a capacidade, rejeição de motorista e carona passada, acesso à lista de passageiros exclusivamente pelo proprietário e diagnóstico autenticado.
- **Verificações adicionais:** `node --check` nos módulos JavaScript das Functions e inspeção estrutural offline com `inspecionarSubpasta` de `validar-local.mjs`. A inspeção reconheceu Functions, D1, OAuth2, licença MIT e frontend Vanilla sem frameworks proibidos.
- **Cobertura da etapa:** O teste chamou os handlers diretamente com SQLite síncrono e pedidos iniciados via `Promise.all`. A execução das Pages Functions no Cloudflare, o binding D1 e a autorização no Discord real ficaram fora da verificação local. A implementação e os testes acima pertencem à etapa do Agente 1.

### Agente 2 — Especialista Frontend em HTML5, CSS3 e JavaScript Vanilla

- **Responsabilidade:** Implementar a interface responsiva e integrar os fluxos de estudante e motorista às Cloudflare Pages Functions do Agente 1.
- **Harness e modelo:** Codex da OpenAI, GPT-6.
- **Skill utilizado:** [vanilla-dom-ui](./skills/vanilla-dom-ui/SKILL.md).
- **Arquivos modificados:** `public/index.html`, `public/styles.css`, `public/app.js` e `AGENTS.md`.
- **Funcionalidades:** Tela inicial com login Discord, perfil com nome, avatar e ID, formulário de carona com horário de Brasília, busca de saídas do dia por origem e destino, reserva com nova consulta de disponibilidade, painel do motorista com nomes e IDs dos passageiros, mensagens de carregamento e resultado, layout responsivo e chave oficial no rodapé.
- **Integração:** Login em `/api/auth/discord`, leitura da sessão em `GET /api/status`, busca e cadastro em `GET/POST /api/rides`, painel em `GET /api/rides/mine` e passageiros e reserva em `GET/POST /api/rides/{id}`. As requisições usam o cookie de sessão da mesma origem.
- **Testes executados:** `node --check public/app.js` passou no Node.js 26.13.1. Em um teste local temporário com DOM de teste, handlers reais, sessões assinadas localmente e as duas migrações em SQLite em memória, passaram as verificações de perfil, visitante e erro de login, rejeição de entrada inválida, cadastro com conversão do horário de Brasília, filtros, identificação da própria carona, reserva sem corpo, atualização de 2 para 1 vaga, painel de passageiros e tratamento de sessão expirada. A inspeção offline com `inspecionarSubpasta` confirmou o rodapé com a chave, licença MIT e frontend Vanilla. A inspeção do CSS confirmou a ausência de sombras em textos.
- **Pendências registradas na etapa:** Validar o layout em navegadores e tamanhos de tela reais e executar o fluxo completo com Discord OAuth2 e D1 no runtime da Cloudflare. A confirmação original ficava em memória até o Agente 3 integrar a leitura da reserva persistida. O servidor já tratava uma repetição da mesma reserva sem descontar outra vaga.

### Agente 3 — Testes, segurança e validação

- **Harness e modelo:** Codex, família GPT-6 informada pelo harness. A variante específica não foi registrada.
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md).
- **Execução de 18/11/2026:** O agente principal `/root` executou a suíte local e o validador oficial. A sessão filha `/root/revisao_rubrica` verificou a documentação, o Git e as regras do validador. A sessão filha `/root/revisao_integracao` revisou integração e atomicidade e confirmou o comportamento do filtro acentuado em SQLite. As sessões filhas herdaram o modelo do agente principal.
- **Resultados:** Oito testes automatizados de API passaram em Node.js 26.13.1, usando SQLite em memória e respostas simuladas do Discord. Sete verificações passaram no Edge headless, incluindo cinco resoluções, recarga após a última vaga e tratamento de HTTP 503. O validador oficial aprovou oito itens estruturais e deixou o deploy pendente.
- **Correção:** A busca agora carrega as reservas do próprio passageiro no D1 e exibe a confirmação ao recarregar, inclusive após ocupar a última vaga. O filtro de maiúsculas acentuadas segue como falha de baixa gravidade.
- **Rastreabilidade:** As três execuções distintas desta auditoria constam da sessão Codex. As etapas históricas dos Agentes 1 e 2 são descritas acima. O projeto não contém identificadores que permitam confirmar a identidade e independência dessas duas sessões históricas.
- **Evidências e reprodução:** [Relatório de testes](./docs/RELATORIO_TESTES.md).
