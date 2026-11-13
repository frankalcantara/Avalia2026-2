# Agentes e harness — P26-2C-57E3-D257-CF08-28F5

## Harness

O trabalho foi desenvolvido no VS Code com Copilot SDK. Os papéis definidos nos `SKILL.md` foram coordenados no mesmo workspace, com escopos de edição separados e validação integrada. A identificação exata do modelo não é exposta pelo harness e, por isso, não é declarada aqui.

## Agentes utilizados

### Agente 1: Especialista de Backend Cloudflare

- **Escopo:** autenticação OAuth2 Discord, sessão assinada, Cloudflare Pages Functions, validação de movimentações e schema D1.
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Arquivos:** `functions/` e `migrations/0001_init.sql`.
- **Validações:** sintaxe dos módulos JavaScript, schema e queries D1, atomicidade da auditoria e rejeição de retirada acima do saldo.

### Agente 2: Especialista de Frontend Vanilla

- **Escopo:** interface responsiva em HTML/CSS e JavaScript puro, integração com os endpoints, sessão Discord, formulário de movimentação e aba de estoque crítico.
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Arquivos:** `public/index.html`, `public/styles.css` e `public/app.js`.
- **Validações:** sintaxe do JavaScript e conferência de acessibilidade, caminhos dos assets e ausência de frameworks de interface.

### Agente 3: Teste, Auditoria e Validação

- **Escopo:** conferir isolamento da pasta oficial, chave e licença, contratos de API, schema, sessão, saldo, histórico, estoque crítico e requisitos do validador oficial.
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Harness:** validação integrada no workspace VS Code/Copilot SDK e execução de `node validar-local.mjs P26-2C-57E3-D257-CF08-28F5` na raiz do fork.
- **Limite conhecido:** o critério de deploy online só pode ser aprovado depois que o projeto estiver publicado no Cloudflare com D1 e OAuth configurados.

## Coordenação

O frontend usa os contratos documentados no README. A camada serverless é a única responsável por validar o saldo e identificar o usuário; a atualização do item e a inserção da auditoria são executadas em batch no D1. A validação final verifica o conjunto integrado, sem incluir credenciais no repositório.
