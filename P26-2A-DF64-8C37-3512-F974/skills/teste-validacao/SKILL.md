---
name: teste-validacao
description: Procedimento do agente de teste e validação do Memorize, com testes unitários (node --test), teste de fumaça no deploy, validador oficial do repositório e revisão de segurança das regras de negócio. Use antes de cada commit/entrega.
---

# Skill · Teste e Validação

## 1. Testes unitários (sem dependências)
```powershell
cd P26-2A-DF64-8C37-3512-F974
node --test tests/
```
Cobrem `functions/_lib/sm2.js` (intervalos, EF, invariantes), `dates.js` (fuso, virada de mês/ano),
`validate.js` (limites, campos obrigatórios), `http.js` (cookies, ids) e `session.js` (token, hash, avatar).
**Todos precisam passar.**

## 2. Teste de fumaça no deploy
```powershell
node tests/smoke.mjs https://p26-2a-df64-8c37-3512-f974.pages.dev
```
Verifica: página 200 com a chave no `<footer>`, assets, `/api/status` (D1 migrado + segredos do Discord),
redirecionamento OAuth com `state`, callback rejeitando `state` inválido, 401 em todas as rotas protegidas,
sessão forjada rejeitada e bloqueio de CSRF (403).

## 3. Validador oficial
Na raiz do fork: `node validar-local.mjs P26-2A-DF64-8C37-3512-F974`. Todas as linhas devem ficar `[OK]`.

## 4. Roteiro manual (navegador)
1. Entrar com Discord. O nome e o avatar aparecem no topo, e o baralho de exemplo é criado.
2. Criar um baralho e adicionar 2 cartões (um pelo formulário, um pela importação `frente ; verso`).
3. Estudar: clicar no cartão vira com animação; os botões mostram 1d / 1d / 4d.
4. Avaliar "Fácil". O cartão some da fila, e em "Gerenciar" aparece "Próxima revisão: em 4 dias".
5. Repetir `POST /api/review` do mesmo cartão (DevTools > Copy as fetch) deve responder 409 `not_due`.
6. Sair e voltar. Os dados persistem (D1).
7. Testar em largura de celular (DevTools 375px).

## 5. Revisão de regras (checklist)
- [ ] Nenhuma rota usa `user_id` vindo do corpo/query.
- [ ] Toda query de recurso filtra por `user_id`.
- [ ] Entradas inválidas → 4xx com mensagem em português, nunca 500.
- [ ] Nenhum framework de UI em `public/` ou `package.json`.
- [ ] Chave no `README.md` e no `<footer>`; `LICENSE` MIT presente.

Reporte falhas como: **arquivo:linha · cenário · resultado esperado × obtido · severidade**.
