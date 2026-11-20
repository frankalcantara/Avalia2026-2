# Documentação de Engenharia de Agentes e Harness (P26-2B-8F20-6829-E280-0237)

> **Requisito da Rubrica (25 pontos):** Uso obrigatório de no mínimo **3 agentes diferentes** (sendo obrigatoriamente **1 agente dedicado a teste e validação**), documentando em qual *harness* operaram e relacionando as *skills* na pasta `skills/`.

> **Base deste registro:** Os agentes e as entregas abaixo foram conferidos nas sessões locais do projeto e nos arquivos efetivamente alterados. O modelo usado não aparece nos registros disponíveis e, por isso, não é presumido.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** GitHub Copilot SDK no Visual Studio Code, usado nas sessões locais de frontend, design/UX, backend e teste/validação deste projeto.
- **Modelo(s) Base:** Não identificados nos registros disponíveis das sessões; nenhum modelo foi presumido.
- **Estratégia de Coordenação:** O trabalho foi separado em sessões por escopo: frontend Vanilla; design, UX e CSS; backend Cloudflare/D1/Discord OAuth2; e teste/auditoria. As sessões trabalharam no mesmo checkout e consultaram os arquivos e Skills pertinentes. Não há registro de coordenação paralela ou de um protocolo formal de troca de contratos.

---

## 2. Agentes Utilizados e Responsabilidades

### Agente 1: Frontend Vanilla
- **Papel:** Implementação da interface e das interações do jogo no navegador.
- **Skill Utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md), consultada na sessão de frontend.
- **Entregas Realizadas:**
  - `public/index.html`, `public/styles.css` e `public/app.js`.
  - Tabuleiro, entrada por teclado e mouse, notas, destaques, temporizador visual e integração preparada para APIs.

### Agente 2: Design e UX
- **Papel:** Ajustes visuais, responsividade, acessibilidade e organização do CSS, sem alterar a lógica JavaScript ou as APIs.
- **Skill Utilizada:** Nenhuma Skill adicional foi registrada para esta sessão; `vanilla-dom-ui` está associada à sessão de frontend acima.
- **Entregas Realizadas:**
  - Ajustes em `public/styles.css` e `public/index.html` para layout, hierarquia visual, responsividade e acessibilidade.

### Agente 3: Cloudflare Functions, D1 e Discord OAuth2
- **Papel:** Implementação do backend serverless, autenticação, persistência, progresso, ranking e validação do Sudoku no servidor.
- **Skill Utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md), consultada na sessão de backend.
- **Entregas Realizadas:**
  - Rotas em `functions/api/` e helpers em `functions/_lib/`.
  - Migrações D1 para partidas, puzzles, progresso, resultados e duração mínima.
  - Sessão Discord assinada, proteção por `state` e consultas D1 parametrizadas.

### Agente 4: Teste, Auditoria de Segurança e Validação
- **Papel:** Revisão de contratos, validação server-side, segurança e critérios de entrega.
- **Skills Utilizadas:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md), [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md) e [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md), lidas para a auditoria do projeto.
- **Entregas Realizadas:**
  - Execução do `validar-local.mjs`; na última execução registrada, os 9 itens passaram após a URL do README apontar para `https://jogo-sudoku.pages.dev`.
  - Revisão estática dos endpoints e uso do agente especializado `security-review`.
  - Verificação do limite mínimo de 30 segundos para resultados do ranking. As chamadas dos endpoints não foram confirmadas por teste funcional contra um ambiente Cloudflare ativo.
