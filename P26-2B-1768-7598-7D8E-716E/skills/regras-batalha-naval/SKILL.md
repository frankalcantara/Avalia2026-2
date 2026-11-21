---
name: regras-batalha-naval
description: Regras oficiais da Batalha Naval Tático (malha 10x10, frota, posicionamento, combate e placar), usadas como fonte única de verdade por todos os agentes.
---

# Skill: Regras da Batalha Naval Tático

## Objetivo
Afundar toda a frota inimiga antes que o inimigo afunde a do jogador.

## Malha
- 10 linhas x 10 colunas. Coordenadas `r` (linha) e `c` (coluna) de 0 a 9, sempre inteiras.

## Frota (cada lado tem 5 navios)
| Navio | Tamanho |
|---|---|
| Porta-aviões | 5 |
| Encouraçado | 4 |
| Cruzador | 3 |
| Submarino | 3 |
| Destroyer | 2 |

## Fase 1: posicionamento
- Cada navio ocupa células consecutivas, a partir de `(r, c)`, na orientação `"H"` (horizontal, avança na coluna) ou `"V"` (vertical, avança na linha).
- Todos os 5 navios devem ser posicionados, cada um uma única vez.
- Nenhum navio pode sair da malha nem ocupar a mesma célula de outro.
- Formato enviado ao servidor: `{ "gameId": "...", "ships": [{ "name": "Destroyer", "r": 0, "c": 0, "o": "H" }] }`.
- O servidor valida tudo. Se for válido, gera a frota inimiga aleatória (sem sobreposição) e a partida passa de `placing` para `playing`.

## Fase 2: combate
- O jogador envia `{ "gameId": "...", "r": 3, "c": 5 }`.
- O servidor responde apenas:
  - `agua`: não havia navio na célula;
  - `acerto`: atingiu um navio que ainda não afundou;
  - `afundado`: todas as células do navio foram atingidas (o campo `ship` traz o nome).
- Depois de cada tiro do jogador, se a partida não acabou, o inimigo atira em uma célula ainda não atacada da frota do jogador. O resultado dele vem no campo `enemy`.
- É proibido atirar duas vezes na mesma célula (erro 409).

## Fim da partida
- Vence quem afundar os 5 navios do adversário primeiro (o jogador atira antes).
- Status final: `won` ou `lost`. Vitória soma 1 em `wins` e derrota soma 1 em `losses`, uma única vez por partida.
- Só ao fim da partida o servidor revela a frota inimiga (campo `enemyFleet`).

## Ciclo de vida do estado da partida
`placing` -> `playing` -> `won` ou `lost`
- Posicionar só é aceito em `placing`. Atirar só é aceito em `playing`.

## Regras de sigilo
- `enemy_fleet` jamais aparece em resposta durante a partida.
- O cliente não decide resultado de tiro nem fim de jogo.

## Códigos de erro esperados
| Situação | Código |
|---|---|
| Sem sessão | 401 |
| Coordenada ou frota inválida, JSON inválido | 400 |
| Partida de outro jogador ou inexistente | 404 |
| Tiro repetido, estado errado da partida | 409 |

## Uso pelos agentes
- arquiteto-backend: implementa e valida estas regras em `functions/`.
- frontend-vanilla: apresenta as regras e dá resposta rápida, sem ser a autoridade.
- qa-validador: transforma cada regra em um teste.
