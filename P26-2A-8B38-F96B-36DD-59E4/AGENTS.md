# Documentação de Engenharia de Agentes e Harness (P26-2A-8B38-F96B-36DD-59E4)

Projeto #23: Gerador e Organizador de Referências Bibliográficas (ABNT e IEEE).

## 1. Ambiente de orquestração (harness utilizado)

- **Harness principal:** Claude (Anthropic) na interface web claude.ai, em uma conversa dentro de um Projeto do Claude. A ferramenta de arquivos e o sandbox Linux com Node.js do próprio Claude foram usados para gerar e testar o código.
- **Modelo base:** Claude Sonnet 5.5.
- **Operação local do aluno:** Windows PowerShell com Node.js, Git e Wrangler (`npx wrangler`) para migrações do D1, commit e push. Cloudflare Pages, Cloudflare D1 e Discord Developer Portal foram configurados pelo aluno seguindo o passo a passo do agente.
- **Estratégia de coordenação:** os agentes são **papéis especializados**, cada um com sua skill e suas regras, executados em sequência no mesmo harness e coordenados pelo aluno. Todos trabalharam sobre a subpasta `P26-2A-8B38-F96B-36DD-59E4/`, compartilhando o módulo `public/formatar.js` (regras de formatação usadas pelo navegador e pelo servidor), o esquema D1 e os contratos JSON das Functions.

## 2. Agentes criados e responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Entregas:**
  - `migrations/0002_pastas_referencias.sql`: tabelas `folders` e `refs`, com índice por pasta.
  - `functions/_lib/auth.js`: cookie de sessão **assinado com HMAC-SHA256** e com validade; um cookie forjado ou alterado é recusado.
  - `functions/api/folders.js` e `functions/api/references.js`: criar, listar e apagar. O `userId` vem **sempre da sessão do servidor**, nunca do corpo da requisição. Cada consulta confere se a pasta ou a referência pertence ao usuário. Limites de 50 pastas e 300 referências por pasta.
  - Validação refeita no servidor com `validar()` e `limpar()`; a formatação e a ordenação da compilação também são calculadas no servidor.
  - `functions/api/auth/discord/callback.js` (cookie assinado), `functions/api/auth/logout.js` e `functions/api/status.js`.

### Agente 2: Engenheiro de Front-end e do Formatador (Vanilla JS)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Entregas:**
  - `public/formatar.js`: regras de pontuação, caixa alta no sobrenome, grifo (negrito na ABNT, itálico na IEEE) para livro, artigo de periódico e página web, mais a chave de **ordem alfabética rigorosa** (sobrenome do primeiro autor, sem acento nem diferença de maiúscula).
  - `public/app.js` e `public/index.html`: formulário por tipo de mídia, prévia ao vivo, pastas, salvar, apagar, compilar e copiar (texto e HTML), usando apenas DOM e `fetch`, sem framework. Rodapé com a Chave Única.

### Agente 3: Designer de Interface
- **Skill:** [`skills/design-vidro-escuro/SKILL.md`](./skills/design-vidro-escuro/SKILL.md)
- **Entregas:**
  - `public/styles.css`: tema escuro com cartões de vidro (regra 60-30-10), destaque violeta, foco visível, responsividade mobile-first e respeito a `prefers-reduced-motion`.
  - Escolhas de visual feitas pelo aluno por múltipla escolha (estilo escuro com vidro, sem norma pré-selecionada).

### Agente 4: Agente de Teste, Auditoria de Segurança e Validação (obrigatório)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Entregas e casos executados:**
  - **Sandbox (Node.js):** saídas do formatador para ABNT livro, IEEE artigo e ABNT página web conferidas contra o resultado esperado; ordenação de `Zélia Alves`, `Álvaro Dias`, `Ana Lima` e `Éder Costa` resultou em Alves, Costa, Dias, Lima; norma inválida retorna `null`.
  - **Sessão:** cookie assinado aceito; cookie adulterado recusado; cookie sem assinatura (forjado) recusado.
  - **Auditoria do código inicial:** o cookie de sessão do template era apenas Base64 sem assinatura, e o `POST /api/status` confiava no `userId` enviado pelo navegador. Ambos foram corrigidos pelo Agente 1.
  - **Testes manuais no site publicado (aluno):** login com Discord, criar pasta, salvar 3 referências, compilar e conferir a ordem DIAS, GIL, LIMA.
  - **Defeito encontrado e corrigido:** campo escondido (Local) vazava texto para a referência de artigo; `limpar()` passou a descartar campos que não pertencem ao tipo.
  - `validar-local.mjs` executado antes do Pull Request, e o robô do repositório repete a conferência no PR.

## 3. Limitações conhecidas

- Ainda não há botão de editar uma referência (é preciso apagar e salvar de novo).
- O formatador não corrige o que o usuário digita (por exemplo `sao paulo` continua em minúsculo) e trata o último nome como sobrenome (partículas como "da" e "de" no IEEE saem como inicial).
- A IEEE normalmente numera as referências por ordem de citação; seguindo o enunciado, a compilação é alfabética nas duas normas.
