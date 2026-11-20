---
name: escalonador-porcoes
description: Regra de cálculo e formatação do escalonador de porções, e como testá-lo.
---
- Quantidade nova = quantidade base x porções desejadas / porções da receita (`scaleAmount` em `public/scale.js`).
- Exiba com no máximo 2 casas e vírgula decimal (`formatAmount`).
- Limite as porções desejadas entre 1 e 99 e use o rendimento original se o campo estiver vazio.
- Teste em `tests/scale.test.mjs`: 2 para 5 porções (200 g viram 500 g), redução e mesmo rendimento.
