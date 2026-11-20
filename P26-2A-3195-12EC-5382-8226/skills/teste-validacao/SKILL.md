---
name: teste-validacao
description: Protocolo do agente de teste e validação. Verifica de forma independente as regras do servidor, a segurança das rotas, a interface e a aderência à rubrica de 100 pontos. Use antes de qualquer commit de entrega.
---

# Skill: Teste e Validação

O agente de validação **não escreve funcionalidades**. Ele lê o código, executa testes, tenta quebrar as regras e relata o que encontrou com evidências (comando + saída). Só corrige o que for defeito comprovado e registra a correção.

## 1. Testes automatizados
```bash
npm test          # node --test tests/*.test.mjs
```
- `tests/metrics.test.mjs` e `tests/validate.test.mjs`: funções puras (streaks, taxa mensal, datas, validações, avatar do Discord).
- `tests/api.test.mjs`: integração — executa o middleware e os handlers reais das Functions contra um SQLite em memória com a mesma migration do D1 (`tests/helpers/d1-sqlite.mjs`). Requer Node com `node:sqlite` (22.5+); em versões antigas é pulado.

## 2. Teste no runtime real da Cloudflare (local)
```bash
npx wrangler d1 migrations apply DB --local
npx wrangler pages dev            # http://localhost:8788
curl -i http://localhost:8788/api/me            # esperado: 401
curl -i http://localhost:8788/api/status        # esperado: d1Connected true
```

## 3. Tentativas de contorno (devem falhar)
| Ataque | Esperado |
|---|---|
| Chamar `/api/habits` sem cookie ou com cookie inventado | 401 |
| Marcar dia futuro ou data inexistente (`2026-02-30`) | 422 |
| Enviar `today` falso a vários dias do UTC para liberar o futuro | 422 (servidor ignora) |
| Ler/alterar/excluir hábito de outro usuário | 404 |
| Cor fora da lista, nome vazio ou com mais de 60 caracteres | 422 |
| Nome duplicado (inclusive "ÁGUA" × "água") | 409 |
| Mais de 30 hábitos (inclusive 40 POSTs em paralelo) | 409; nunca mais de 30 no banco |
| Nome duplicado enviado em paralelo, com acento NFD ou caractere de largura zero | 409, nunca 500 |
| Rota `/api/*` inexistente | 404 em JSON |
| Discord inacessível durante o callback | redireciona com `auth_error`, sem 500 |
| POST com `Content-Type` diferente de JSON | 415 |
| Requisição de alteração com `Origin` de outro site | 403 |
| `state` do OAuth diferente do cookie | redireciona com `auth_error=invalid_state` |

## 4. Interface
- Abrir o painel em 1366 px e 390 px; marcar e desmarcar caixas; conferir barra e indicadores.
- Confirmar a chave `P26-2A-3195-12EC-5382-8226` dentro do `<footer>`.
- Console do navegador sem erros.

## 5. Rubrica e entrega
```bash
# na raiz do fork
node validar-local.mjs P26-2A-3195-12EC-5382-8226
```
Todos os itens devem ficar ✅ (o item 9 só fica ✅ depois do deploy com a URL correta no README).

## Formato do relatório
Para cada item: **status** (aprovado/reprovado), **evidência** (comando e trecho da saída) e, se reprovado, **arquivo:linha** e correção sugerida.
