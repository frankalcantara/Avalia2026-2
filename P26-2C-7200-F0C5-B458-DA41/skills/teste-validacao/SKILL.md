---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação do Issue Tracker — testes unitários das regras, testes de API contra o wrangler local com D1, tentativas de burlar o servidor e checagem da rubrica. Use antes de qualquer entrega ou Pull Request.
---

# Skill: Agente de Teste e Validação

O agente de teste **não escreve funcionalidades**: ele tenta quebrar o que os outros agentes fizeram e relata. Correções voltam para o agente responsável (backend ou UI).

## 1. Testes unitários das regras (sem Cloudflare)
```bash
node --test        # sem argumento: acha tests/*.test.mjs (no Node 22+ "node --test tests/" falha com MODULE_NOT_FOUND)
```
Cobrir no mínimo: validação de chamado (limites, severidade inválida, caracteres de controle), comentário vazio/longo, máquina de estados (todas as transições válidas e inválidas, `resolvido` final), permissões (técnico × autor × outro usuário), formato do código `CH-XXXXXX`, filtros da listagem e parser de cookies.

## 2. Testes de API contra o servidor local (wrangler + D1 local)
```bash
npx wrangler d1 migrations apply DB --local
npx wrangler pages dev public --port 8788
```
Como o login real exige o Discord, o teste cria usuários e sessões direto no D1 local (`wrangler d1 execute DB --local --command "..."`) e usa o cookie `it_session=<token>`; no banco vai o SHA-256 do token.

Casos obrigatórios:
| Caso | Esperado |
|---|---|
| `GET /api/tickets` sem cookie | 401 |
| `POST /api/tickets` sem header `Origin` | 403 |
| `POST /api/tickets` com título de 2 letras | 422 + `errors.title` |
| `POST /api/tickets` com severidade `"urgente"` | 422 + `errors.severity` |
| `POST /api/tickets` válido | 201 + `code` no formato `CH-XXXXXX` |
| Usuário comum move para `em_analise` | 403 |
| Técnico move aberto → aguardando (pula etapa) | 409 |
| Técnico aberto → em_analise → aguardando → resolvido | 200 em cada passo, 4 eventos na linha do tempo |
| Comentar em chamado resolvido | 409 |
| `GET /api/tickets/CH-ZZZZZZ` | 404 |
| Título com `<script>` | salvo como texto, nunca executado na UI |
| 11º chamado na mesma hora | 429 |

## 3. Rubrica
```bash
node validar-local.mjs P26-2C-7200-F0C5-B458-DA41   # na raiz do fork
```
Conferir: LICENSE MIT, chave no README e no `<footer>`, AGENTS.md com ≥3 agentes, pasta `skills/`, sem frameworks proibidos, functions + D1 + Discord.

## 4. Relatório
Registrar em `tests/RELATORIO-TESTES.md`: data, comandos executados, resultado de cada caso, bugs encontrados e como foram corrigidos.
