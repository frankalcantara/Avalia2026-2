---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação — testes de ponta a ponta da API em D1 local, tentativas de manipulação das regras de negócio, auditoria do frontend e da rubrica. Use antes de qualquer commit de entrega e sempre que o backend ou o frontend mudar.
---

# Skill: Agente de Teste e Validação

O agente de teste **não escreve funcionalidades**. Ele verifica, reporta com evidência e só
corrige o próprio código de teste. Defeitos no produto voltam para o agente responsável.

## Ambiente de teste
1. `npx wrangler d1 migrations apply DB --local` e `npx wrangler pages dev public --port 8788` (em segundo plano).
2. Sessões de teste sem Discord: inserir usuários e sessões direto no D1 local
   (`npx wrangler d1 execute DB --local --command "INSERT ..."`) e enviar `Cookie: session=<token>`.
   Nunca adicionar rota de login falsa ao produto.
3. A suíte fica em `tests/e2e.mjs` (Node puro, `fetch` nativo, sem dependências) e é reexecutável:
   `node tests/e2e.mjs http://localhost:8788`. Saída: uma linha `PASS`/`FAIL` por caso e código de saída ≠ 0 se algo falhar.

## Casos obrigatórios
1. **Autenticação:** rotas de escrita sem cookie → 401; cookie com token inventado → 401; `/api/me` deslogado → `{ user: null }`.
2. **OAuth:** `/api/auth/discord` redireciona para discord.com com `state`; callback com `state` divergente é rejeitado.
3. **Autoria:** usuário B não edita, exclui, aprova, recusa nem registra devolução em livro/pedido de A (403).
4. **Regras de estado:** não pedir o próprio livro; não pedir livro `Reservado`/`Emprestado` (409); `mode` incompatível (400); limite de 3 pendentes (429); aprovar com `due_date` passada ou > 90 dias (400); excluir livro não-`Disponível` (409).
5. **Campos protegidos:** enviar `status`, `owner_id`, `holder_id` no POST/PATCH não altera nada.
6. **Fluxo feliz completo:** criar → pedir → aprovar (vira `Emprestado`, `holder` e `due_date` gravados) → devolver (vira `Disponível`); troca: pedir com livro oferecido → aprovar → donos trocados.
7. **Corrida:** dois pedidos simultâneos para o mesmo livro → exatamente um 201 e um 409.
8. **Entrada maliciosa:** `'; DROP TABLE books; --` e `<img src=x onerror=alert(1)>` em título são gravados literalmente; `q=%` não lista tudo indevidamente; JSON inválido → 400; sem `Content-Type` JSON → 415.
9. **Frontend:** nenhum framework em `public/`; nenhum `innerHTML` com dado da API; Chave no `<footer>` do HTML estático.
10. **Rubrica:** `node validar-local.mjs P26-2C-BF60-C440-6484-80FA` na raiz do repositório.

## Relatório
Ao final, escreva `tests/RELATORIO.md`: data, ambiente, tabela caso → resultado, defeitos encontrados
(arquivo:linha, reprodução, severidade) e o que não pôde ser testado (ex.: OAuth real com Discord).
