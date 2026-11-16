---
name: curadoria-palavras
description: Protocolo do Agente Curador de Palavras para montar a lista de respostas diárias e o dicionário de chutes válidos do Cypher em português do Brasil, com verificação de licença das fontes.
---

# Skill: Curadoria de Palavras (pt-BR, 5 letras)

## Quando usar
Ao criar ou alterar `src/data/answers.js`, `src/data/valid.js` ou `src/data/FONTES.md`.

## Duas listas, dois objetivos
1. **Respostas (`ANSWERS`)** — palavras que podem ser sorteadas. Precisam ser justas: qualquer pessoa alfabetizada no Brasil deve conhecer.
2. **Válidas (`VALID`)** — tudo que o jogador pode digitar como chute. Precisa ser ampla para não frustrar quem digita uma palavra real.

## Critérios das respostas
- Exatamente 5 letras depois de remover acentos e cedilha.
- Substantivos, adjetivos e verbos no infinitivo de uso comum.
- **Excluir:** plurais, verbos conjugados, nomes próprios, siglas, estrangeirismos não aportuguesados, palavras ofensivas ou de cunho sexual, termos regionais obscuros e a palavra de demonstração `COFRE`.
- Guardar na forma de exibição com acento correto (`LIMÃO`, `ÁRVORE` não entra por ter 6 letras).
- Sem duplicatas depois da normalização (ex.: `PÊLO`/`PELO` → manter uma só).
- Meta: cerca de 1000 palavras.

## Critérios das válidas
- Exatamente 5 letras A-Z depois da normalização; somente palavras reais do português.
- Inclui todas as respostas, mais plurais, conjugações e palavras menos comuns.
- Formato: string única com as chaves normalizadas separadas por espaço (arquivo leve para o Worker).

## Licença
- Só usar fonte externa com licença compatível com a licença MIT do repositório (MIT, BSD, Apache-2.0, CC0, CC-BY ou domínio público). Licenças copyleft (GPL/LGPL/MPL) só se a lista ficar com aviso próprio e isso for registrado.
- Registrar em `src/data/FONTES.md`: fonte, URL, licença, data e o tratamento aplicado.
- A lista de respostas curada é trabalho próprio do agente.

## Checklist antes de entregar
- [ ] Script/conferência mostrando: total de respostas, total de válidas, 0 respostas fora das válidas, 0 duplicatas, 0 palavras com tamanho diferente de 5.
- [ ] `COFRE` ausente das respostas.
- [ ] `FONTES.md` preenchido.
