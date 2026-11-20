# Documentação de Engenharia de Agentes e Harness (P26-2C-6503-DF96-B025-1EBF)

> Projeto #33 — Cápsula do Tempo e Livro de Visitas Digital · Turma 2C · Aluno: José Barichello Neto

## 1. Ambiente de Orquestração (Harness Utilizado)

- **Harness dos agentes:** GitHub Copilot em **modo Agent**, dentro do VS Code, operando sobre o repositório local (fork `Avalia2026-2`). Cada agente rodou em uma **conversa nova e isolada**, com um prompt que manda ler a skill correspondente em `skills/<nome>/SKILL.md` e seguir como guia.
- **Modelos:** Copilot Fusion (`gpt-6-luna`) nos Agentes 1 e 2; Copilot Fusion (`mai-code-2-flash`) no Agente 3. Usar um modelo diferente no agente de testes reduz o risco de ele repetir os mesmos pontos cegos dos agentes que revisaram o código.
- **Geração do código inicial:** o primeiro código (Functions, migração D1, interface e testes) foi escrito com apoio do assistente Claude (Anthropic) em conversa de chat, com explicações passo a passo, e colocado no repositório pelo aluno. Os três agentes abaixo **auditaram e ajustaram** esse código dentro do harness.
- **Estratégia de coordenação:** os agentes atuaram em sequência (backend → frontend → testes) sobre a pasta `P26-2C-6503-DF96-B025-1EBF/`, compartilhando o esquema D1, os contratos JSON das rotas e a suíte `tests/capsules.test.mjs`. Toda alteração foi revisada pelo aluno (botões Keep/Undo e `git diff`) antes do commit. Terminal com permissão manual (Allow Once).

---

## 2. Agentes Criados e Responsabilidades

### Agente 1: Backend Serverless, Cloudflare D1 e Segurança Discord OAuth2
- **Execução:** 20/11/2026, 13:58–13:59 · Copilot Fusion (`gpt-6-luna`) · modo Agent
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Papel:** revisar as Cloudflare Pages Functions (`functions/`), a migração D1 (`migrations/0002_mural_capsulas.sql`) e o login Discord quanto a segurança temporal, sessão, validação de entrada e checagem de origem.
- **Verificou:** o `SELECT` das cápsulas anula `content` via `CASE` enquanto `unlock_date` é futura e o JSON omite o campo; sessões usam token aleatório com hash SHA-256 no D1 e cookie HttpOnly; o OAuth valida `state` e pede apenas o escopo `identify`.
- **Achados:**
  1. (Média) `functions/api/status.js`, sobra do template, aceitava sessão forjada via cookie `discord_session`.
  2. (Baixa) `isSameOrigin` aceitava POST sem cabeçalho `Origin`.
- **Resultado:** o agente **não alterou arquivos**; rodou os 15 testes (todos passaram). As correções foram aplicadas por revisão do aluno: `status.js` removido e `isSameOrigin` passou a recusar requisição sem `Origin` (commit `e8a0d80`).

### Agente 2: Interface Web Vanilla (HTML5, CSS3 e JavaScript puro)
- **Execução:** 20/11/2026, por volta das 14h05–14h07 · Copilot Fusion (`gpt-6-luna`) · modo Agent
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Papel:** revisar `public/index.html`, `public/styles.css` e `public/app.js`: uso exclusivo de tecnologias nativas, ausência de XSS, acessibilidade, responsividade e rodapé com a chave de auditoria.
- **Confirmou:** HTML/CSS/JS nativos sem bibliotecas; conteúdo dinâmico via `textContent` (sem `innerHTML`); labels presentes; chave `P26-2C-6503-DF96-B025-1EBF` no rodapé.
- **Alterou (3 arquivos, +46 −10):** listas anunciam "carregando" em vez de "vazio" antes da resposta; avisos para erros de sessão e logout; abas navegáveis por setas, Home e End, com foco visível; contraste maior no selo "Trancada".
- **Resultado:** 15 testes, `node --check` e `git diff --check` passaram (commit `320bcc2`).

### Agente 3: Teste, Auditoria de Segurança e Validação (agente dedicado a testes)
- **Execução:** 20/11/2026, 14:10–14:12 · Copilot Fusion (`mai-code-2-flash`) · modo Agent
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Papel:** validar o projeto sem alterar código de produção: executar `node tests/capsules.test.mjs` e `node validar-local.mjs P26-2C-6503-DF96-B025-1EBF`, e conferir os pontos do enunciado (login Discord, mural, cápsulas, ausência de `content` em cápsula trancada, tecnologias, licença MIT, chave no README e rodapé, `AGENTS.md`, skills).
- **Alterou (2 arquivos, +47 −0):** adicionou 2 casos em `tests/capsules.test.mjs` e criou `tests/RELATORIO-QA.md`.
- **Resultado:** 17 testes passando; `validar-local.mjs` com todos os 9 itens aprovados; nenhum código de produção alterado.

---

## 3. Como reproduzir os testes

```bash
node --no-warnings tests/capsules.test.mjs        # 17 testes (Node 22+, sem dependências)
node validar-local.mjs P26-2C-6503-DF96-B025-1EBF  # na raiz do repositório
```

A prova da regra temporal está nos testes "GET anônimo: cápsula trancada só traz metadados e o texto não aparece no JSON" e "Virada no tempo: ao passar `unlock_date`, o mesmo registro passa a trazer o texto". O relatório completo está em [`tests/RELATORIO-QA.md`](./tests/RELATORIO-QA.md).
