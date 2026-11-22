---
name: sm2-repeticao-espacada
description: Especificação do algoritmo simplificado de repetição espaçada (inspirado no SuperMemo SM-2) usado pelo Memorize, com a tabela de intervalos esperados. Use ao alterar functions/_lib/sm2.js, a fila diária ou os testes do algoritmo.
---

# Skill · SM-2 simplificado

## Entradas e saídas
`schedule(card, rating)` recebe `{ease_factor, interval_days, repetitions}` e `rating ∈ {hard, good, easy}`
e devolve `{ease_factor, interval_days, repetitions, quality}`. A função é pura; quem grava no D1 é `functions/api/review.js`.

## Qualidade (q) por botão
| Botão   | rating | q |
|---------|--------|---|
| Difícil | hard   | 3 |
| Bom     | good   | 4 |
| Fácil   | easy   | 5 |

## Fator de facilidade
`EF' = max(1.3, EF + 0.1 − (5 − q)·(0.08 + (5 − q)·0.02))`, arredondado em 2 casas.
Difícil −0,14 · Bom 0 · Fácil +0,10. Valor inicial 2,5.

## Intervalo (dias)
| repetições antes | Difícil | Bom | Fácil |
|---|---|---|---|
| 0 (novo) | 1 | 1 | 4 |
| 1 | 3 | 6 | 8 |
| ≥ 2 (intervalo I) | max(I+1, round(I·1,2)) | max(I+1, round(I·EF')) | max(I+1, round(I·EF'·1,3)) |

Teto: 3650 dias. `repetitions` sempre aumenta em 1. Próxima revisão = hoje (fuso do aluno) + intervalo.

## Invariantes (testadas em `tests/sm2.test.mjs`)
- Difícil ≤ Bom ≤ Fácil para qualquer estado.
- Intervalo ≥ 1 e nunca diminui em acertos consecutivos.
- EF nunca fica abaixo de 1,3.
- Estado corrompido (NaN, negativo) cai nos valores padrão, sem exceção.
- `rating` fora da lista lança `RangeError` (o endpoint responde 400 antes disso).

## Fila diária
- Revisões: `repetitions > 0 AND due_date <= hoje`, ordenadas por `due_date`.
- Novos: `repetitions = 0`, no máximo `20 − novos_estudados_hoje` por baralho.
- Após cada avaliação o cartão sai da fila porque `due_date` passa a ser ≥ amanhã.
