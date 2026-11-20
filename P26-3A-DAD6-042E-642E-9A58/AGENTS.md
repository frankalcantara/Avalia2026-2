# Engenharia de Agentes — Projeto #32 (RSVP)

Chave Única: `P26-3A-DAD6-042E-642E-9A58` · Turma 3A

Este documento descreve os agentes usados para construir o projeto, o harness
em que rodaram e as skills que cada um seguiu. Os arquivos das skills estão em
[`skills/`](skills/) e as definições dos agentes em [`agents/`](agents/).

## Harness

| Item | Valor |
|---|---|
| Harness | **Claude Code** (CLI da Anthropic), executado no terminal do macOS |
| Modelo | Claude Opus 5.5 (`claude-opus-5-5`) |
| Orquestração | Sessão principal do Claude Code (orquestrador) criando **subagentes** com a ferramenta `Agent` do próprio harness |
| Execução | Os três subagentes rodaram **em paralelo** e em segundo plano, cada um com contexto próprio e isolado |
| Ferramentas dos subagentes | Leitura/escrita de arquivos e terminal (`node --check`, `npm install`, `npm test`) |
| Restrições | Nenhum agente rodou comandos Git; commits, push e Pull Request foram feitos pelo estudante |

## Fluxo de trabalho

```
                 ┌───────────────────────────────────────────┐
                 │ Orquestrador (sessão principal)           │
                 │ escreve docs/contrato-api.md,             │
                 │ migrations/0001_init.sql e as 3 skills    │
                 └───────┬───────────────┬───────────────┬───┘
                         │ paralelo      │ paralelo      │ paralelo
          ┌──────────────▼───┐  ┌────────▼─────────┐  ┌──▼─────────────────────┐
          │ Agente 1         │  │ Agente 2         │  │ Agente 3               │
          │ Serverless + D1  │  │ Interface        │  │ Teste e Validação      │
          │ + Discord OAuth2 │  │ Vanilla JS       │  │ (obrigatório)          │
          │ → functions/     │  │ → public/        │  │ → tests/               │
          └──────────────┬───┘  └────────┬─────────┘  └──┬─────────────────────┘
                         └───────────────┴───────────────┤
                                                         ▼
                                   relatório de falhas → orquestrador
                                   → correção pelo agente responsável
                                   → nova rodada de testes até passar
```

1. O **orquestrador** fixou o contrato antes de qualquer código:
   [`docs/contrato-api.md`](docs/contrato-api.md) (rotas, JSON, erros e a regra
   da fila de espera) e o esquema [`migrations/0001_init.sql`](migrations/0001_init.sql).
   Com uma fonte única da verdade, os três agentes puderam trabalhar ao mesmo
   tempo sem se esperar.
2. Cada agente recebeu como primeira instrução **ler a sua skill** e o
   contrato, e só podia escrever na própria pasta.
3. O **Agente 3** testou o contrato (não a implementação). Falhas encontradas
   foram devolvidas ao orquestrador, que encaminhou a correção ao agente dono
   do código; o Agente 3 nunca corrigiu código de produto.

## Agente 1 — Arquiteto Serverless, Cloudflare D1 e Segurança Discord OAuth2

- **Definição:** [`agents/agente-1-serverless.md`](agents/agente-1-serverless.md)
- **Skill:** [`skills/serverless-d1-discord/SKILL.md`](skills/serverless-d1-discord/SKILL.md)
- **Escopo:** `functions/` (Cloudflare Pages Functions).
- **Entregas:**
  - Login OAuth2 do Discord em `/api/auth/discord` e
    `/api/auth/discord/callback` (escopo `identify`), com `state` de uso único
    guardado como SHA-256 no D1. Importa `user_id`, nome de usuário e avatar;
    revoga o access token logo depois de ler o perfil.
  - Sessão opaca em cookie `__Host-session` (`HttpOnly`, `Secure`); o D1 guarda
    só o resumo SHA-256.
  - API de eventos e inscrições com validação completa no servidor.
  - Regra de lotação atômica no D1: a decisão "confirmado ou fila" e a
    inserção acontecem na mesma instrução SQL. Cancelamento e promoção do
    primeiro da fila acontecem na mesma transação (`DB.batch`).

## Agente 2 — Especialista em Interface Web Vanilla

- **Definição:** [`agents/agente-2-interface.md`](agents/agente-2-interface.md)
- **Skill:** [`skills/vanilla-dom-ui/SKILL.md`](skills/vanilla-dom-ui/SKILL.md)
- **Escopo:** `public/` (HTML5, CSS3 e JavaScript puro, sem frameworks).
- **Entregas:**
  - SPA com roteamento por hash: lista de eventos, criação e detalhe.
  - Manipulação direta do DOM só com `createElement` e `textContent`, sem
    `innerHTML`, o que evita XSS com dados vindos do Discord.
  - Barra de lotação, selos de status, posição na fila e mensagens `aria-live`.
  - Layout mobile-first responsivo com tema escuro automático.
  - Chave única no `<footer>`.

## Agente 3 — Teste, Auditoria de Segurança e Validação (obrigatório)

- **Definição:** [`agents/agente-3-teste-validacao.md`](agents/agente-3-teste-validacao.md)
- **Skill:** [`skills/teste-validacao/SKILL.md`](skills/teste-validacao/SKILL.md)
- **Escopo:** `tests/`.
- **Método:** `node:test` executando os **handlers reais** de `functions/` contra
  um D1 simulado com `sql.js` (SQLite em WebAssembly, com `batch` transacional)
  e `fetch` do Discord simulado. Nenhum teste acessa a rede.
- **Cobertura:** lotação, ordem da fila, promoção, saída da fila, inscrições
  concorrentes, duplicidade, 401/403, permissão do criador, validação de
  entrada, `state` OAuth inválido ou reutilizado, callback válido, front sem
  `innerHTML` nem frameworks, e requisitos de entrega (chave, MIT, agentes e
  skills).
- **Como rodar:** `cd tests && npm install && npm test`

### Resultado das rodadas de teste

| Rodada | Resultado | Observação |
|---|---|---|
| 1 | 77/79 | Nenhum bug de produto. As 2 falhas eram de entrega: `README.md` e `LICENSE` ainda não existiam. |
| 2 | 79/79 | Rodada final, com os arquivos de entrega gerados. |

Na primeira versão da auditoria de logs, o Agente 3 marcou como vazamento um
`console.error` que registra só o código interno do erro. Ele corrigiu a
própria regra e incluiu um teste que captura os logs durante um login real
simulado. Esse teste confirma que nenhum segredo, `code`, `state`, token ou
cookie aparece nos logs.

Para provar que o teste de concorrência detecta condição de corrida, o Agente 3
rodou uma implementação ingênua, que lê a contagem em JS e só depois insere.
Num evento de 3 vagas, ela confirmou 10 pessoas. A implementação atômica do
projeto nunca passa da capacidade.
