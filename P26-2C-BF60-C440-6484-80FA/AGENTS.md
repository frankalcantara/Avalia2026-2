# Engenharia de Agentes e Harness — P26-2C-BF60-C440-6484-80FA

Projeto #24 — Plataforma de Empréstimo e Troca de Livros Físicos · Roger Costa Moreira · Turma 2C

> Requisito da rubrica (25 pts): no mínimo **3 agentes diferentes**, sendo **1 de teste e validação**,
> documentando o **harness** e versionando as **skills** usadas em [`skills/`](./skills).

## 1. Harness

- **Harness:** [Claude Code](https://claude.com/claude-code) (aba Code do app desktop Claude, Windows 11).
- **Modelo:** Claude Opus 5.5 (`claude-opus-5-5`) para o orquestrador e para os três subagentes.
- **Mecanismo:** o orquestrador (sessão principal) usa a ferramenta **Agent** do Claude Code para
  disparar subagentes com contexto próprio e isolado. Cada subagente recebe como instrução inicial:
  ler sua definição em [`agents/`](./agents), seguir sua skill em [`skills/`](./skills) e
  respeitar o contrato [`docs/API.md`](./docs/API.md).
- **Ferramentas disponíveis aos agentes:** leitura/escrita de arquivos, busca (Grep/Glob) e shell
  (Bash/PowerShell) para rodar `wrangler` (D1 local, `pages dev`) e `node`.

## 2. Estratégia de coordenação

```
                 ┌──────────────────────────────────────────────┐
                 │  Orquestrador (sessão principal Claude Code) │
                 │  • esquema D1  (migrations/0001_init.sql)    │
                 │  • contrato    (docs/API.md)                 │
                 │  • skills + definições de agentes            │
                 └───────────────┬──────────────────────────────┘
              em paralelo        │                 depois
        ┌────────────────────────┼─────────────────────────┐
        ▼                        ▼                         ▼
 ┌──────────────┐        ┌───────────────┐        ┌──────────────────┐
 │ Agente 1     │        │ Agente 2      │        │ Agente 3         │
 │ Backend      │        │ Frontend      │        │ Teste/Validação  │
 │ functions/   │        │ public/       │        │ tests/           │
 │ src/         │        │               │        │ (só reporta bugs)│
 └──────────────┘        └───────────────┘        └──────────────────┘
```

1. **Contrato primeiro.** Antes de qualquer agente rodar, o orquestrador escreveu o esquema D1 e o
   contrato da API. Ele é a única fonte de verdade entre os agentes, e por isso Backend e Frontend
   puderam trabalhar **ao mesmo tempo** sem depender um do outro.
2. **Pastas exclusivas.** Cada agente escreve somente na sua área (`functions/`+`src/`, `public/`,
   `tests/`), então duas escritas nunca colidem.
3. **Separação de papéis no teste.** O Agente 3 não corrige o produto: ele reporta defeitos
   (arquivo:linha + reprodução) e o orquestrador devolve a correção ao agente responsável.
   Assim quem testa não "ajusta o teste ao código".

## 3. Agentes

### Agente 1: Backend Serverless (Cloudflare Pages Functions + D1 + Discord OAuth2)
- **Definição:** [`agents/backend-serverless.md`](./agents/backend-serverless.md)
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](./skills/serverless-d1-discord/SKILL.md)
- **Escopo:** `functions/api/**`, `src/**`
- **Entregas:**
  - Fluxo OAuth2 do Discord com `state` anti-CSRF; importação de `user_id`, handle, `global_name` e avatar.
  - Sessões opacas no D1 (substituiu o cookie base64 não assinado gerado pelo `iniciar.mjs`, que era forjável).
  - Rotas de livros e pedidos com toda a máquina de estados `Disponível → Reservado → Emprestado`
    validada no servidor, transições atômicas com `D1.batch()` + `WHERE status = ?`.
  - Autorização por recurso (dono/solicitante), limites (3 pedidos pendentes, 100 livros), validação de datas e tamanhos.

### Agente 2: Frontend Vanilla (HTML5, CSS3, JavaScript puro)
- **Definição:** [`agents/frontend-vanilla.md`](./agents/frontend-vanilla.md)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](./skills/vanilla-dom-ui/SKILL.md)
- **Escopo:** `public/**`
- **Entregas:**
  - "Estante Compartilhada": catálogo com busca (debounce + abort) e filtros, cartões estilo ficha de biblioteca.
  - Diálogo de detalhes com pedido de empréstimo ou proposta de troca (oferecendo um livro próprio).
  - "Meu painel": meus livros (cadastro, edição, exclusão, atraso destacado), pedidos recebidos
    (aprovar com data de devolução, recusar, registrar devolução) e meus pedidos (cancelar).
  - Zero frameworks, zero `innerHTML` com dados da API, modo escuro, responsivo a 360px, `aria-live`.
  - Chave Única no `<footer>` do HTML estático.

### Agente 3: Teste e Validação (obrigatório)
- **Definição:** [`agents/teste-validacao.md`](./agents/teste-validacao.md)
- **Skill:** [`skills/teste-validacao/SKILL.md`](./skills/teste-validacao/SKILL.md)
- **Escopo:** `tests/**` (somente leitura no restante)
- **Entregas:**
  - Suíte e2e [`tests/e2e.mjs`](./tests/e2e.mjs) em Node puro contra `wrangler pages dev` + D1 local,
    com sessões de teste inseridas direto no D1 (sem rota de login falsa no produto).
  - Tentativas de manipulação: autoria, estados inválidos, campos protegidos, corrida, SQL injection, XSS, CSRF.
  - Auditoria do frontend e da rubrica (`validar-local.mjs`).
  - Relatório [`tests/RELATORIO.md`](./tests/RELATORIO.md).

## 4. Ciclo real de validação

| Rodada | Agente | Resultado |
|---|---|---|
| 1 | Teste e Validação | e2e **265 PASS / 3 FAIL**, auditoria estática **130/130**, rubrica 1–8 OK. Defeitos: D1 `Content-Type` aceitava `application/jsonx` (`src/http.js`); D2 rotas só-POST respondiam 404 em vez de 405 JSON (`functions/api/_middleware.js`). Observações: O2 dono podia mudar `mode` com pedido pendente; O3 mensagens de erro de login genéricas. |
| 2 | Backend | Corrigiu D1, D2 e O2 (`409 mode_locked`, approve revalida `mode` no `WHERE`), atualizou `docs/API.md`. |
| 2 | Frontend | Corrigiu O3 (mensagens pt-BR para `token_exchange_failed`, `missing_code`, `fetch_user_failed`, `server_error`). |
| 3 | Teste (suíte reexecutada) | e2e **251 PASS / 0 FAIL** (1 grupo pulado: redirect OAuth com credenciais falsas, já validado na rodada 1). |
| Deploy | Orquestrador | `https://p26-2c-bf60-c440-6484-80fa.pages.dev`: `/api/status` com `d1:true`, `discord_configured:true`; login real com Discord confirmado manualmente pelo estudante. |

Relatório completo do agente de teste: [`tests/RELATORIO.md`](./tests/RELATORIO.md).

## 5. Skills versionadas

| Skill | Usada por | Conteúdo |
|---|---|---|
| [`serverless-d1-discord`](./skills/serverless-d1-discord/SKILL.md) | Agente 1 | Roteamento das Pages Functions, sessão opaca, OAuth `state`, SQL parametrizado, transições atômicas, CSRF |
| [`vanilla-dom-ui`](./skills/vanilla-dom-ui/SKILL.md) | Agente 2 | Sem frameworks, `textContent` para dados, rodapé com a chave, responsividade, acessibilidade, estados de UI |
| [`teste-validacao`](./skills/teste-validacao/SKILL.md) | Agente 3 | Ambiente de teste, 10 grupos de casos obrigatórios, formato do relatório |
