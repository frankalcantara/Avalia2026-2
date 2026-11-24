---
name: ponytail-audit
description: >
  Auditoria de qualidade do repositório inteiro: bugs, falhas de segurança, o
  que quebra sob carga real, código arriscado sem teste, caminhos lentos e o que
  apagar, mesclar ou dividir. Ranking com cada achado em português simples.
  Relatório único, não altera nada. Use para "audita o código", "revisa o repo
  inteiro", "acha gordura", "o que posso apagar". Base adaptada do Ponytail
  5.3.3 (MIT, DietrichGebert) — ver skills/vendor/ponytail/ADAPTACAO.md.
license: MIT
---

# Auditoria Ponytail (adaptada)

Audite o repositório como o sênior que acabou de herdar o código e vai ser
chamado quando ele quebrar. Ordem de importância: **correto, seguro, aguenta
carga, testado, rápido, enxuto**. Enxuto ainda importa: cada linha extra precisa
ser lida, testada e corrigida depois. Este é um relatório pedido, então entregue
completo.

## 1. Mapeie primeiro

- Audite o que for nomeado: uma pasta, um pacote ou o repo inteiro. Nada
  nomeado: o repo inteiro, dentro de `P26-2A-B12E-0CFD-70CA-18E1/`.
- Leia, nesta ordem: `README.md`, `AGENTS.md`, `wrangler.jsonc`,
  `migrations/0001_init.sql`, as rotas em `functions/api/`, as bibliotecas em
  `functions/_lib/`, o frontend em `public/` e os testes em `tests/`.
- Descubra a carga esperada: aqui é uma turma de até 60 pessoas, um organizador
  por sala, poucos sorteios por aula. Julgue a escala por isso e diga a carga que
  assumiu.
- Trace os fluxos principais de ponta a ponta: login Discord → sessão → sala →
  participantes → sorteio → ata → verificação pública. Leia esses caminhos
  inteiros: entrada do usuário, autenticação, escrita de dados, hash e replay.
- Repo grande: vá fundo onde um erro custa mais caro, não arquivo por arquivo.
  Diga o que não leu.

## 2. Procure

1. **Bug:** resultado errado, crash, caso de borda esquecido (vazio, zero,
   último item, arredondamento, fuso horário), chamadores que discordam do que
   a função devolve, a mesma regra aplicada de dois jeitos.
2. **Risco:** falha de segurança (injeção, aleatoriedade fraca, segredo no
   código, validação ausente na entrada do usuário), perda de dados (erro
   engolido, escrita em ordem errada, falta de transação).
3. **Escala:** bom para uma pessoa, errado para muitas: corrida
   checar-depois-escrever, trabalho repetido, lista que só cresce, uma query por
   item, O(n²) em entrada grande, estado local que deveria ser compartilhado.
4. **Teste faltando:** lógica arriscada (branch, parser, dinheiro, segurança,
   escrita de dados) sem teste que falha quando ela quebra. Um teste bom, não
   cobertura.
5. **Velocidade:** lentidão grande é problema. Ganho pequeno é sugestão.
6. **Enxuto:** código que não deveria existir ou deveria ser menor.
   - **apagar:** código morto, opção, flag e configuração sem uso, recurso
     especulativo
   - **reutilizar:** dois helpers fazendo a mesma coisa (mantenha um, cite o
     caminho)
   - **stdlib / nativo:** a biblioteca padrão ou a plataforma já faz; dependência
     fazendo o que poucas linhas ou a plataforma resolvem
   - **yagni:** interface com uma implementação, factory com um produto, wrapper
     que só repassa chamada
   - **mesclar:** quase-cópias que precisam mudar juntas
   - **dividir:** função ou classe fazendo trabalhos não relacionados, difícil de
     ler ou testar. Divida por trabalho, nunca por contagem de linhas, e nunca em
     helpers que só encurtam a função.

## 3. Confira antes de relatar

- Todo achado precisa de um caso concreto: "esta entrada ou situação leva a este
  resultado errado". Sem caso, não é achado.
- Antes de chamar código de sem uso, procure na árvore inteira, incluindo
  testes, fixtures, configuração e referências por string ou dinâmicas.
- Atalho marcado com `shortcut:` que nomeia seu limite é decisão, não achado —
  a menos que a carga esperada já tenha passado do limite.
- Proponha a menor correção que funciona. Prefira correções que apagam código.
  Nunca adicione camada, framework ou configuração que o problema não pede.
- Nada de gosto de estilo, "considere", preocupação vaga.

## 4. Saída

Português simples: frases curtas, palavras do dia a dia. Explique um termo
técnico na primeira vez que usar.

Comece com `O que este repositório faz:` em duas ou três frases, e a carga que
assumiu.

Depois os achados em três grupos, mais importante primeiro, pule grupo vazio:
- **Corrigir agora:** bug, segurança, perda de dados, quebra na carga esperada.
- **Corrigir depois:** código arriscado sem teste, lentidão real, duplicação,
  função que mistura trabalhos, código que não deveria existir.
- **Opcional:** pequenos ganhos de velocidade, formas mais curtas.

Numere os achados em todos os grupos. No máximo 20 achados; se deixou menores de
fora, diga quantos. Cada achado tem as quatro partes, uma ou duas frases cada:

```text
2. **Ata pode ser apagada por engano** (`migrations/0001_init.sql:L120-134`)
   - **O que é:** os triggers protegem UPDATE e DELETE de `draws`.
   - **Problema:** o trigger de `draw_entries` não cobre INSERT fora da API.
   - **Correção:** adicionar o mesmo `BEFORE INSERT` com `RAISE(ABORT)`.
   - **Se ignorar:** uma ata pode ganhar entrada extra e o hash deixa de bater.
```

Termine com:
- `Veredito:` uma linha: saudável, ou o que corrigir primeiro.
- `Enxuto: -<N> linhas, -<M> dependências possíveis.` quando houver achado.
- `Não verificado:` as partes que você não leu ou não conseguiu rodar.

Nada encontrado: `O que este repositório faz:`, depois `Saudável. Nada a
corrigir.` e uma linha sobre o que você conferiu.

Relatório único, não altera código.
