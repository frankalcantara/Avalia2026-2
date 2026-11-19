# Documentação de Engenharia de Agentes e Harness (P26-2C-7E6D-B4F0-76A5-9594)

> Projeto #20: Gerenciador de Horas Complementares. Este documento descreve os agentes, o harness e as skills como realmente foram usados.

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness:** chat do Claude (claude.ai), sem modo agente. Os agentes não leem nem editam arquivos sozinhos. O aluno executa os comandos no PowerShell e cola os resultados na conversa.
- **Modelo base:** Claude, na versão selecionada no chat do claude.ai.
- **Tentativa anterior:** o GitHub Copilot Chat (modo Agent) no VS Code foi tentado, mas não iniciou ("Chat took too long to get ready") e não foi usado.
- **Estratégia de coordenação:** os três agentes são três papéis assumidos na mesma conversa, cada um seguindo a sua skill da pasta `skills/`. O código é do projeto em `P26-2C-7E6D-B4F0-76A5-9594/`. A verificação usa buscas no código (Select-String), requisições HTTP reais ao site publicado e o `validar-local.mjs`.

### Como o projeto foi construído
1. A primeira versão do backend (Cloudflare Pages Functions, D1 e login Discord) e da interface (HTML, CSS e JavaScript puro) foi escrita em conversa com o Claude, sem modo agente. As skills não participaram dessa escrita.
2. As skills foram aplicadas depois, na auditoria descrita abaixo. Os relatórios completos estão em `relatorios/`.
3. O aluno executou todos os comandos, criou o banco D1 e a aplicação no Discord, fez o deploy no Cloudflare Pages e testou o site no navegador.

---

## 2. Agentes e Responsabilidades

### Agente 1: Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Papel:** auditar o backend (`functions/` e `migrations/`) contra a skill.
- **Skill utilizada:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Relatório:** [`relatorios/agente1-backend.md`](./relatorios/agente1-backend.md)
- **Resultado:** as 3 regras da skill passam (validação no servidor, queries com `.bind()`, cookie de sessão assinado e `HttpOnly`). O relatório registra riscos menores que não foram corrigidos.

### Agente 2: Especialista em Interface Web Vanilla (HTML5, CSS3 e DOM)
- **Papel:** auditar a interface (`public/`) contra a skill.
- **Skill utilizada:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Relatório:** [`relatorios/agente2-interface.md`](./relatorios/agente2-interface.md)
- **Resultado:** as 3 regras da skill passam (sem frameworks, sem `text-shadow`, Chave no rodapé). O painel mostra perfil do Discord, formulário, lista e barras de progresso por categoria.

### Agente 3: Agente de Teste, Auditoria de Segurança e Validação (Obrigatório)
- **Papel:** verificação de ponta a ponta com testes executados pelo aluno, para reduzir o viés de quem escreveu o código.
- **Skill utilizada:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Relatório:** [`relatorios/agente3-testes.md`](./relatorios/agente3-testes.md)
- **Testes executados:** POST e GET sem login (401), GET com cookie forjado (401), `validar-local.mjs` (9 de 9 itens OK) e teste no navegador do teto de 60 h por categoria.
- **Achado corrigido:** a skill pede os códigos HTTP 400, 401, 403 e 409, e a API devolvia 422. Corrigido para 400 (validação) e 409 (teto excedido).

---

## 3. Limitações
- Os três agentes foram papéis de uma mesma conversa, e o autor do código também fez a auditoria. Por isso o Agente 3 se apoiou em testes executados, e não só em leitura de código.
- Os itens de agentes e skills do `validar-local.mjs` só conferem se os arquivos existem.
- Não há testes automatizados com cookie válido. Os testes autenticados foram feitos manualmente no navegador.