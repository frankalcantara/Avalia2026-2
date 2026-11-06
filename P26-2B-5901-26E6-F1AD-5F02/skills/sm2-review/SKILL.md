---
name: sm2-review
description: Regras do algoritmo de repetição espaçada (SM-2 simplificado) usado em functions/_lib.js e como testá-lo.
---
Estado do cartão: `ease` (inicia 2,5), `interval_days`, `repetitions`, `due_at` (epoch em segundos).

- **dificil:** intervalo 1, repetições 0, ease −0,2 (mínimo 1,3).
- **bom:** 1ª vez 3 dias; depois `round(intervalo × ease)` (no mínimo intervalo + 1).
- **facil:** 1ª vez 4 dias; depois `round(intervalo × ease × 1,3)` (no mínimo intervalo + 2); ease +0,15.
- `due_at = agora + intervalo × 86400`.

Teste com `npm test`. Qualquer mudança na regra exige atualizar `tests/sm2.test.mjs` e a tabela do README.
