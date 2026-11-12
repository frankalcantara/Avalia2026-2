# AGENTS.md - Projeto #11: Controle Financeiro Pessoal

**Estudante:** Matheus de Araujo Pinho — Turma 2C

**Chave Única:** `P26-2C-7DDD-9039-3A0D-D491`

## Harness

- **Ambiente:** Copilot SDK no VS Code.
- **Fluxo:** Arquiteto/Backend → Construtor Frontend → Testador/Validador → publicação.
- **Execução desta entrega:** coordenada por um agente orquestrador em etapas sequenciais; os três papéis abaixo são definidos e documentados em `agents/`.
- **Modelos:** não aplicável; os papéis são especificações do fluxo, não alegação de execuções independentes.

## Agente 1: Arquiteto/Backend

- Responsável por `schema.sql`, `wrangler.toml` e Cloudflare Pages Functions.
- Implementa OAuth Discord, sessão assinada, validação no servidor e CRUD isolado por `user_id`.
- Skills: `discord-oauth`, `d1-crud`, `cloudflare-deploy`, `ambiente-fallback`.
- Aceite: consultas parametrizadas, autorização obrigatória, segredos fora do repositório e schema aplicável no D1.

## Agente 2: Construtor Frontend

- Responsável por `public/index.html`, `public/style.css` e `public/app.js`.
- Integra perfil, saldo, filtros, formulário e operações de transação.
- Constrói o gráfico somente com `div` e CSS, sem frameworks, SVG ou canvas.
- Skills: `grafico-div-css`, `ambiente-fallback`.
- Aceite: interface responsiva, dados inseridos como texto e erros comunicados ao usuário.

## Agente 3: Testador/Validador

- Responsável por executar a checklist e manter `docs/RELATORIO_TESTE.md`.
- Testa autenticação, CRUD, validação, isolamento, filtros, saldo, gráfico e publicação.
- Bloqueia a entrega quando uma verificação falha ou ainda não tem evidência.
- Skills: `teste-validacao`, `ambiente-fallback`.
- Aceite: cada resultado tem evidência; itens que exigem acesso ou conta permanecem pendentes.

## Ordem e recuperação

1. Implementar e verificar schema, binding e Functions.
2. Construir a interface Vanilla JS contra o contrato da API.
3. Executar os testes locais e atualizar o relatório.
4. Se houver falha, retornar ao papel responsável, corrigir e repetir a validação.
5. Publicar somente depois das verificações locais e testar novamente a URL HTTPS.

Os artefatos de cada papel ficam em `agents/`; as instruções reutilizáveis ficam em `skills/<nome>/SKILL.md`; o fluxo detalhado está em `docs/HARNESS.md`.
