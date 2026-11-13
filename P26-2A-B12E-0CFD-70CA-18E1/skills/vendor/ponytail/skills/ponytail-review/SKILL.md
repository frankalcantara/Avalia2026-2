---
name: ponytail-review
description: >
  Revisão de qualidade de uma mudança: a lógica está certa, é segura, aguenta
  carga real, código arriscado tem teste, é rápida o suficiente e toda linha é
  necessária. Lê o código conectado, não só o diff. Cada achado explicado em
  português simples. Use para "revisa isso", "code review", "revisa o último
  commit", "revisa meu PR", "isso está exagerado". Base adaptada do Ponytail
  5.3.3 (MIT, DietrichGebert) — ver skills/vendor/ponytail/ADAPTACAO.md.
license: MIT
---

# Revisão Ponytail (adaptada)

Revise uma mudança como o sênior que vai ser chamado quando ela quebrar. Ordem
de importância: **correto, seguro, aguenta carga, testado, rápido, enxuto**.
Enxuto ainda importa: cada linha extra precisa ser lida, testada e corrigida
depois. Este é um relatório que a pessoa pediu, então entregue completo.

## 1. Entenda primeiro

- Revise o que foi nomeado: mudanças não commitadas, staged, um branch, um link
  de PR ou arquivos. Nada nomeado: `git diff`, ou o último commit se não houver.
- Leia o diff e depois o código que ele toca: chamadores de cada função
  alterada, funções que ela chama, testes e README.
- Trace o fluxo real: de onde o dado entra, o que é gravado, o que sai. Neste
  projeto: `request` → validação → query D1 → resposta JSON → DOM.
- Uma mudança pode quebrar código que ela não toca. Se assinatura, retorno ou
  comportamento mudou, procure todos os chamadores.
- Descubra a carga esperada (README, `wrangler.jsonc`): aqui é uma turma de até
  60 pessoas, um organizador por sala, sorteios ocasionais. Julgue a escala por
  isso e diga qual carga assumiu.

## 2. Procure

1. **Bug:** resultado errado, crash, caso de borda esquecido (vazio, zero,
   último item, arredondamento, fuso horário), chamador quebrado, correção
   aplicada só em um chamador enquanto a função compartilhada segue errada.
2. **Risco:** falha de segurança (injeção, aleatoriedade fraca, segredo exposto,
   validação ausente na entrada do usuário), perda de dados (erro engolido,
   escrita em ordem errada, falta de transação).
3. **Escala:** bom para uma pessoa, errado para muitas: corrida
   checar-depois-escrever, trabalho repetido em cada processo, lista que só
   cresce, uma query por item, O(n²) em entrada grande, estado local que
   deveria ser compartilhado.
4. **Teste faltando:** lógica nova arriscada (branch, parser, dinheiro,
   segurança, escrita de dados, correção de bug) sem teste que falha quando ela
   quebra. Um teste bom, não cobertura.
5. **Velocidade:** lentidão grande é problema. Ganho pequeno (trabalho repetido
   em laço quente) é sugestão.
6. **Enxuto:** código que não deveria existir ou deveria ser menor.
   - **apagar:** código morto, opção sem uso, recurso especulativo
   - **reutilizar:** o projeto já tem esse helper (cite o caminho)
   - **stdlib / nativo:** a biblioteca padrão ou a plataforma já faz; dependência
     nova para poucas linhas
   - **yagni:** abstração com uma implementação, configuração que ninguém usa
   - **mesclar:** quase-cópias que precisam mudar juntas
   - **dividir:** uma função fazendo trabalhos não relacionados, difícil de ler
     ou testar. Divida por trabalho, nunca por contagem de linhas, e nunca em
     helpers que só encurtam a função.

## 3. Confira antes de relatar

- Todo achado precisa de um caso concreto: "esta entrada ou situação leva a este
  resultado errado". Sem caso, não é achado.
- Releia as linhas e confirme: o chamador existe, o valor pode mesmo vir vazio,
  o código está mesmo sem uso.
- Atalho marcado com `shortcut:` que nomeia seu limite é decisão, não achado —
  a menos que a carga esperada já tenha passado do limite.
- Proponha a menor correção que funciona. Prefira correções que apagam código.
  Nunca adicione camada, framework ou configuração que o problema não pede.
- Nada de gosto de estilo, "considere", preocupação vaga.

## 4. Saída

Português simples: frases curtas, palavras do dia a dia. Explique um termo
técnico na primeira vez que usar. Quem lê pode nunca ter visto este código.

Comece com `O que esta mudança faz:` em duas ou três frases.

Depois os achados em três grupos, pule grupo vazio:
- **Corrigir agora:** bug, segurança, perda de dados, quebra na carga esperada.
- **Corrigir depois:** código arriscado sem teste, lentidão real, duplicação,
  função que mistura trabalhos, código que não deveria existir.
- **Opcional:** pequenos ganhos de velocidade, formas mais curtas.

Numere os achados em todos os grupos, para a pessoa poder dizer "corrige 2 e 5".
Cada achado tem as quatro partes, uma ou duas frases cada:

```text
2. **Pedidos caem no dia errado** (`functions/api/rooms/[code]/draw.js:L40-52`)
   - **O que é:** ao gravar a ata, este trecho usa a data do servidor.
   - **Problema:** o servidor roda em UTC; um sorteio às 22h em Brasília fica
     com data do dia seguinte.
   - **Correção:** gerar o ISO uma vez com o fuso de São Paulo, em uma linha.
   - **Se ignorar:** a ata mostra data errada e a coordenação corrige à mão.
```

Termine com:
- `Veredito: pode publicar.` ou `Veredito: corrigir 1 e 3 antes.`
- `Enxuto: -<N> linhas possíveis.` quando houver achado de enxutez.
- `Não verificado:` em uma linha, se algo importante não pôde ser conferido.

Nada encontrado: `O que esta mudança faz:`, depois `Está bom. Pode publicar.` e
uma linha sobre o que você conferiu.

Lista achados, não altera código.
