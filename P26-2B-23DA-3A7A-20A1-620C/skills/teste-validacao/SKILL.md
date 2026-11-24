---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação: tentar burlar as regras do servidor, conferir o banco D1 e verificar a rubrica, com testes executáveis no repositório.
---

# Skill: Agente de Teste e Validação

## Postura
O agente de teste não confia no frontend. Ele chama a API diretamente e tenta quebrar as regras.

## Checklist obrigatório
1. **Isolamento de subpasta:** todos os arquivos do projeto ficam dentro de `P26-2B-23DA-3A7A-20A1-620C/`.
2. **Sem sessão:** todas as rotas protegidas (`/api/me`, `/api/game/*`) respondem `401` sem cookie e com cookie forjado.
3. **Método errado:** rota que só aceita `POST` não responde `200` a `GET`.
4. **OAuth2:** `/api/auth/discord` redireciona ao Discord com `state` na URL e cookie `HttpOnly`; o callback sem cookie de `state` é rejeitado (`invalid_state`).
5. **Segredo das cartas:** a resposta de `start` contém só `id` e `position`; `pair_key` e conteúdo oculto nunca aparecem em nenhuma resposta.
6. **Limite de turno:** a 3ª carta virada antes de um `check` é recusada (`409 turn_full`).
7. **Contador:** `check` sem exatamente 2 cartas viradas é recusado (`409 need_two_cards`); `moves` só sobe em jogadas válidas.
8. **Banco:** conferir no D1 (`wrangler d1 execute`) partidas, cartas e `moves` após cada cenário.
9. **Teste automatizado:** executar `node testes/producao.mjs` e exigir 100% de aprovação.
10. **Conformidade de entrega:** executar `node validar-local.mjs P26-2B-23DA-3A7A-20A1-620C` na raiz do repositório.

## Casos que exigem sessão (manuais)
`start`, `reveal` (3 cartas seguidas), `check` repetido e `state`, executados no console do navegador logado. Registrados em `AGENTS.md`.