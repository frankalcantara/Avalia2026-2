# Documentação de Engenharia de Agentes e Harness (P26-3A-4CE1-8C26-8C01-F50F)

> **Requisito da Rubrica (25 pontos):** uso de no mínimo 3 agentes diferentes (1 dedicado a teste e validação), documentando o harness e as skills em `skills/`.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness Principal:** Codex (OpenAI), extensão do VS Code, com conta ChatGPT.
  - **Modelo(s) Base:** GPT-6.1 Sol, com esforço de raciocínio "Extra alto" (conforme exibido no seletor do Codex), nas conversas dos três agentes.
- **Estratégia de Coordenação:** cada agente rodou em uma conversa separada do Codex, com a pasta `P26-3A-4CE1-8C26-8C01-F50F/` aberta como workspace, lendo este `AGENTS.md` e a skill do seu papel. Os agentes compartilharam o esquema do D1 (`migrations/0002_bookmark_manager.sql`) e o contrato JSON das rotas (`{data: ...}` e `{error: {code, message}}`). Os Agentes 1 e 2 trabalharam em pastas diferentes (`functions/`, `lib/` e `public/`), o que permitiu rodá-los em paralelo.
- **Regras de operação:** os agentes foram instruídos a não executar `git`, `wrangler`, deploy nem comandos com `--remote`. Commits, migrações no D1 remoto, deploys e cadastro de segredos foram feitos manualmente pelo estudante.
- **Assistente de apoio (fora do harness):** Claude (Anthropic), em chat. Ajudou a interpretar o enunciado, resolver erros de configuração (D1, `wrangler.jsonc`, variáveis do Discord), revisar o plano do Agente 1 e redigir os pedidos dos agentes. Não editou arquivos do repositório.

---

## 2. Agentes e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Discord OAuth2
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Papel:** esquema do D1, autenticação Discord OAuth2 com sessão, regras de negócio e validações no servidor.
- **Entregas reais:**
  - Planejamento sem alterar arquivos (11/11, 21:24): leitura do esqueleto, diagnóstico do que existia (cookie sem assinatura, OAuth sem `state`, POST de `/api/status` aceitando identidade do cliente) e proposta de esquema, rotas e validações.
  - Etapa 1, autenticação (11/11, concluída às 23:10): migração `0002`, `lib/auth.js`, `functions/api/_middleware.js`, `state` do OAuth, sessão com token aleatório cujo hash fica no D1, `/api/auth/me`, logout e `tests/auth.test.mjs`.
  - Etapa 2 (12/11, antes das 17:09): CRUD de coleções e links, filtro combinado por coleção e status, rotas públicas de coleções, limpeza de dados pessoais no `GET /api/status` e `tests/api.test.mjs`. Entregou também uma tabela com cada consulta SQL e a cláusula que garante a propriedade do dado.
  - Correções (12/11, após o relatório do Agente 3): endurecimento do `POST /api/status` (tamanho do corpo, Content-Type e campos extras).

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Papel:** interface em HTML5, CSS3 e JavaScript puro, consumindo as rotas com `fetch`.
- **Entregas reais (12/11, início às 16:46, commit às 17:09):** `public/index.html`, página pública da coleção, `app.js`, JavaScript da página pública e `styles.css`; cabeçalho com avatar, nome e `user_id` do Discord; filtros por coleção e status; uso de `textContent` para dados do usuário; rodapé com a Chave Única em todas as páginas.
- Correções (12/11, após o relatório do Agente 3): reconstrução da URL do avatar do Discord.

### Agente 3: Teste, Auditoria de Segurança e Validação (obrigatório)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Papel:** verificação independente. Não implementa funcionalidades nem altera o código da aplicação; só escreve testes e relatório.
- **Entregas reais (12/11, início às 17:38, 9 min 22 s de trabalho):** `tests/qa.test.mjs` (casos adversariais) e `RELATORIO_VALIDACAO.md`. Resultado: 67 testes no total (38 já existiam), 61 aprovados e 6 reprovados: 2 de reconstrução da URL do avatar, 3 lacunas no `POST /api/status` (tamanho do corpo, Content-Type e campos extras) e 1 pendência de documentação (harness e modelo no `AGENTS.md`). O agente não alterou a aplicação e não verificou o site online; essa parte ficou com o `validar-local.mjs` e com testes manuais do estudante. As falhas de código foram corrigidas depois pelos Agentes 1 e 2, a pedido do estudante.

---

## 3. Decisões humanas sobre o trabalho dos agentes

- O plano do Agente 1 foi revisado antes de qualquer código. Foram cortados o HMAC com `SESSION_SECRET` (o hash do token no D1 já valida a sessão) e a paginação por cursor, para reduzir variáveis e risco.
- O `GET /api/status` foi mantido sem alterações até o validador do professor ser lido; só depois foram removidos dados pessoais.
- A migração foi testada primeiro com `--local` e só depois aplicada no banco remoto, por decisão do estudante.
- Os testes do Agente 1 foram escritos pelo mesmo agente que escreveu o código; por isso o Agente 3 foi criado como revisor independente.


---

## 4. Verificação
- `node --test tests/*.test.mjs`: todos os testes aprovados (0 falhas) em 12/11, depois das correções.
- `RELATORIO_VALIDACAO.md`: relatório do Agente 3 (estado antes das correções).
- `node validar-local.mjs P26-3A-4CE1-8C26-8C01-F50F`: todos os itens [OK] em 12/11.