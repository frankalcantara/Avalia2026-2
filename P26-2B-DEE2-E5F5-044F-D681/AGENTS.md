# Engenharia de Agentes e Harness — P26-2B-DEE2-E5F5-044F-D681

Projeto #34 — Vitrine de Achados e Perdidos do Campus · Artur de Souza Tereza · Turma 2B

Este documento descreve os **3 agentes de IA** usados no desenvolvimento, em qual **harness** eles rodaram e quais **skills** (pasta [`skills/`](./skills)) cada um seguiu. Um dos agentes é dedicado exclusivamente a **teste e validação**.

## 1. Harness

- **Harness:** **Claude** (app claude.ai da Anthropic, em modo agente). É construído sobre o *Claude Agent SDK* / Claude Code e roda numa máquina Linux isolada na nuvem, com shell, leitura e escrita de arquivos, Node.js e a ferramenta `Agent` para criar subagentes.
- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`) nos três agentes.
- **Coordenação:** o padrão é **orquestrador + subagentes**.
  O Agente 1 (sessão principal) definiu o esquema do banco e o contrato da API e escreveu os skills.
  Em seguida, ele criou o Agente 2 e o Agente 3 como **subagentes independentes**, que rodaram **em paralelo**, cada um com seu próprio contexto.
  Cada subagente recebeu uma instrução própria e foi mandado ler primeiro o seu `SKILL.md`.
  Os agentes não compartilhavam memória: a comunicação entre eles foi feita só por arquivos (skills, código e relatórios).
- **Isolamento de recursos:** cada agente usou seu próprio banco D1 local (`--persist-to` diferente) e sua própria porta do `wrangler pages dev` (8788, 8789 e 8790), para não interferir nos outros.
- **Ferramentas comuns:** `wrangler` (D1 local + `pages dev`), Node.js 22 (`node:test`), `curl` e o `validar-local.mjs` do professor.

```
                ┌────────────────────────────────────┐
                │ Agente 1 — Arquiteto Serverless    │  (sessão principal / orquestrador)
                │ skill: serverless-d1-discord       │
                └───────┬───────────────────┬────────┘
       contrato da API  │                   │  código + checklist
                        ▼                   ▼
   ┌──────────────────────────┐   ┌──────────────────────────────┐
   │ Agente 2 — UI Vanilla    │   │ Agente 3 — Teste e Validação │
   │ skill: vanilla-dom-ui    │   │ skill: teste-validacao       │
   └──────────────────────────┘   └──────────────────────────────┘
              (rodaram em paralelo, contextos separados)
```

---

## 2. Agentes

### Agente 1 — Arquiteto Serverless (Cloudflare D1 + Pages Functions + Discord OAuth2)
- **Tipo:** sessão principal do harness (orquestrador).
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Responsabilidades e entregas:**
  - Leu os requisitos do professor e o repositório `Avalia2026-2` (`iniciar.mjs` e `validar-local.mjs`) e gerou a estrutura da pasta.
  - Modelou o D1 em `migrations/0001_init.sql`: `discord_users`, `sessions`, `items` e `claims`, com `CHECK`, chaves estrangeiras, índices e um `UNIQUE` parcial para reivindicação ativa.
  - Implementou o OAuth2 do Discord com `state` anti-CSRF e uma sessão por token aleatório, guardando só o SHA-256 dele no banco.
  - Implementou o middleware de autenticação e todas as rotas em `functions/api/`, com as regras de negócio e a máquina de estados das reivindicações usando `DB.batch` e updates condicionais.
  - Escreveu os três skills e criou os outros dois agentes.
  - Integrou os resultados, revisou as correções do Agente 3 e escreveu `README.md`, `DEPLOY.md` e este documento.

### Agente 2 — Especialista em Interface Web Vanilla (HTML5, CSS3, DOM)
- **Tipo:** subagente independente (`general-purpose`), criado pelo Agente 1.
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Restrição:** proibido alterar `functions/` e `migrations/`. Problemas no backend deviam ser só relatados.
- **Responsabilidades e entregas:** `public/index.html`, `public/styles.css`, `public/app.js`

  - Interface completa com abas Vitrine e Minhas reivindicações, cards coloridos por tipo, `<dialog>` de cadastro, de reivindicação e de confirmação (sem `alert`/`confirm` nativos) e toasts com `aria-live`.
  - **Filtros cruzados** no cliente (tipo × categoria × status × busca sem acento × "só meus"), com a contagem de cada opção considerando os demais filtros e atualização a cada tecla, sem novo request.
  - Contato do Discord das duas partes (@username, botão de copiar e link do perfil) nas reivindicações, com os botões permitidos para cada papel.
  - Todo dado da API entra por `createElement`/`textContent` (sem `innerHTML`). Rodapé estático com a Chave Única.
- **Como validou:** `node --check`, D1 local com sessões simuladas e Chrome headless (playwright-core) percorrendo o fluxo inteiro: cadastro com erro e com sucesso, reivindicar, aceitar, marcar como devolvido e sair. Também testou o layout em 360 px e XSS com `<script>` no título.
- **Problemas que relatou no backend** (o Agente 1 corrigiu):
  1. O servidor aceitava a data de amanhã por causa de uma tolerância de fuso. Agora a data máxima é "hoje" no horário de Brasília.
  2. "Encerrar caso" não devolvia 409 quando duas requisições chegavam juntas. Agora devolve.

### Agente 3 — Teste, Auditoria de Segurança e Validação (obrigatório)
- **Tipo:** subagente independente (`general-purpose`), criado pelo Agente 1. **Não escreveu o código que testou.**
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Responsabilidades e entregas:** `tests/seed-local.sql`, `tests/api.test.mjs`, `tests/README.md`, `tests/RELATORIO.md`

  - 81 testes automatizados (`node:test`, sem dependências) contra um D1 local real.
  - Cobertura: autenticação, validação de campos, CSRF (`Content-Type` e `Origin`), JSON inválido, permissões, duplicidade, máquina de estados completa, XSS, SQL injection, filtros, limite diário e callback OAuth com `state` inválido.
- **Bugs encontrados e corrigidos** (antes 75/80, depois 80/80; detalhes em [`tests/RELATORIO.md`](./tests/RELATORIO.md)):
  1. Uma busca `q` longa derrubava `GET /api/items` com 500, porque o D1 limita o padrão do LIKE a 50 bytes. Agora o termo é cortado em 48 bytes UTF-8.
  2. `{"acao":"constructor"}` em `PATCH /api/claims/:id` dava 500, por herança de `Object`. Corrigido com `Object.hasOwn`.
  3. `Content-Type: text/plain; application/json` era aceito, o que enfraquecia a proteção CSRF. Agora o tipo precisa ser exatamente `application/json`.
  4. Um cookie com `%` malformado dava 500 em toda a API. Agora a resposta é 401.
- **Validação final:** depois que a interface do Agente 2 ficou pronta e as correções foram aplicadas, a suíte rodou de novo e deu **81/81** (foi incluído o teste "data de amanhã"). O `node validar-local.mjs P26-2B-DEE2-E5F5-044F-D681` deu 8/9; o item 9 (deploy online) só passa depois da publicação na Cloudflare.

---

## 3. Skills

| Skill | Arquivo | Usado por |
|---|---|---|
| serverless-d1-discord | [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md) | Agente 1 |
| vanilla-dom-ui | [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md) | Agente 2 |
| teste-validacao | [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md) | Agente 3 |

Os skills seguem o formato `SKILL.md` com *frontmatter* YAML (`name` e `description`) e um corpo com as regras. O harness carrega esse arquivo no contexto do agente antes de ele começar a tarefa.

## 4. Papel do estudante

O estudante definiu o objetivo, revisou o resultado e fez o deploy na própria conta da Cloudflare: criou o banco D1, o aplicativo no Discord e os secrets.
Também validou o sistema online e abriu o Pull Request.
