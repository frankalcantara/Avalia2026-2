---
name: teste-validacao
description: Testar e validar o projeto RSVP (regras de lotação e fila de espera, autenticação, validação de entrada e requisitos de entrega) com testes automatizados que executam as Pages Functions de verdade contra um SQLite em memória. Usar depois de qualquer mudança em functions/, migrations/ ou public/, e antes da entrega.
---

# Skill: Teste, Auditoria e Validação

## Quando usar
Depois de qualquer alteração no backend ou no front e antes de abrir/atualizar
o Pull Request da entrega.

## Fonte da verdade
`docs/contrato-api.md` (comportamento esperado) e `migrations/0001_init.sql`.
O teste verifica o contrato, não a implementação: se o código diverge do
contrato, o teste falha e o agente relata a divergência.

## Como testar
1. Os testes ficam em `tests/` com `package.json` próprio (fora de `public/`
   e `functions/`). Usam `node:test` + `node:assert` e o `sql.js` (SQLite em
   WebAssembly) para simular o binding D1 (`prepare/bind/first/all/run/batch`,
   com `batch` em transação).
2. Os testes importam os handlers reais de `functions/` (`onRequestGet`,
   `onRequestPost`, …) e chamam com `{ request, env, params }`.
3. O login Discord é testado com `fetch` simulado (token, `/users/@me` e
   revogação); nenhum teste acessa a rede.
4. `npm test` dentro de `tests/` precisa passar sem erros.

## Casos obrigatórios
- **Lotação**: capacidade 2, três inscrições → 2 `confirmed` e 1 `waitlist`
  posição 1.
- **Ordem da fila**: quem pediu antes fica na frente (`requested_at`).
- **Promoção**: confirmado cancela → primeiro da fila vira `confirmed`;
  invariante `confirmados ≤ capacidade` sempre.
- **Cancelar da fila** não promove ninguém e reordena as posições.
- **Concorrência**: várias inscrições disparadas em paralelo nunca passam da
  capacidade.
- **Duplicidade**: segunda inscrição do mesmo usuário → 409.
- **Autorização**: sem sessão → 401; `Origin` diferente → 403; só o criador
  apaga o evento.
- **Validação**: título curto, capacidade 0/negativa/não inteira, data passada
  ou inválida → 400; cliente tentando mandar `status` é ignorado.
- **OAuth**: `state` errado ou reutilizado → recusado; callback válido cria
  usuário com `user_id`, nome e avatar e devolve cookie `__Host-session`.
- **Segurança do front**: `public/app.js` não usa `innerHTML` com dados do
  usuário; nenhum framework/CDN de UI no HTML.
- **Entrega**: chave no `README.md` e no `<footer>`, `LICENSE` MIT, `AGENTS.md`
  com 3+ agentes e 3+ `SKILL.md`.

## Saída do agente
Relatório curto: comando executado, total de testes, falhas com arquivo/linha e
a causa provável. Corrigir apenas os próprios testes; bugs do produto são
relatados ao orquestrador para o agente responsável corrigir.
