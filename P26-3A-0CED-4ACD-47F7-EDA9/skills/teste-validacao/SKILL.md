---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para verificar de forma independente a lógica do Cypher, tentar contornar as regras do servidor, conferir a integridade do D1 e auditar a conformidade com a rubrica de 100 pontos.
---

# Skill: Teste e Validação

## Quando usar
Depois que backend, interface e palavras estiverem prontos, e de novo após cada correção.

## Princípio
O agente de teste **não confia** no que os outros agentes dizem que fizeram. Ele executa o código, observa a saída real e registra evidências em `tests/RELATORIO-TESTES.md`.

## 1. Testes unitários (`node --test tests/unit.test.mjs`)
- Normalização (acentos, cedilha, caixa, caracteres inválidos).
- Feedback clássico com letras repetidas (ex.: resposta `CASCA`, chute `ACASO`).
- Feedback sombra (contagens `exact`/`misplaced`) coerente com o clássico.
- Datas no fuso `America/Sao_Paulo`, diferença de dias, validação de formato.
- Listas: tamanho 5, sem duplicatas, respostas contidas nas válidas, `COFRE` fora das respostas.

## 2. Testes de API contra o servidor local
Subir `wrangler pages dev public` com D1 local e migração aplicada. Criar a sessão de teste inserindo o hash do token direto no D1 local (simula um login já concluído, sem depender do Discord).

Tentativas de trapaça que **devem falhar**:
- Rotas protegidas sem cookie e com cookie forjado → `401`.
- Data futura → `403 future_date`; data antes do lançamento → `400`.
- Modo inexistente, chute com 4/6 letras, números ou palavra fora do dicionário → `400`/`422`.
- 7º chute no clássico (e 11º no sombra) → `409 game_over`.
- Resposta ausente (`answer = null`) e não contida em nenhum campo da resposta enquanto a partida está em andamento.
- Recarregar (novo GET) mantém as tentativas: a partida não reinicia.
- Criador jogando o próprio desafio → `403 own_challenge`.
- Ranking de guild de que o usuário não participa → `403`.
- Partida de cofre antigo não altera streak nem ranking.

## 3. Conformidade com a rubrica
- `node validar-local.mjs P26-3A-0CED-4ACD-47F7-EDA9` (na raiz do fork) sem pendências estruturais.
- Nenhum framework de UI em `public/` nem em `package.json`.
- Chave no `README.md` e no `<footer>` do HTML.
- `AGENTS.md` com no mínimo 3 agentes e o agente de teste; `skills/` com os `SKILL.md`.

## Saída
`tests/RELATORIO-TESTES.md` com data, comandos executados, resultado de cada caso (passou/falhou) e defeitos encontrados com o que foi corrigido.
