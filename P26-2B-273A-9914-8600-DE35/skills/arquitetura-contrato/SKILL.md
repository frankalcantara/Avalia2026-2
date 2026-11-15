# SKILL — Arquitetura de dados e contrato da API

Procedimento do **Agente 1 (Arquiteto de Dados e Contrato da API)**. Este
agente escreve documentos e esquemas; não escreve código de funcionalidade.

## Quando usar

No início de um projeto, antes de qualquer agente implementar. Também sempre
que surgir uma decisão estrutural — uma coluna nova, um endpoint novo, uma
mudança no formato de resposta.

## Por que um agente que não escreve código

Agentes não conversam entre si. Sem um contrato escrito, o agente de banco
inventa um nome de coluna, o de API inventa outro, e o desencontro só aparece
na integração. O contrato é o que permite os outros trabalharem em paralelo
contra a mesma definição.

## A regra que este agente defende

**Regras de negócio vivem no servidor.** Em concreto:

- a autoria de um registro vem da sessão verificada, nunca de um campo que o
  cliente enviou;
- unicidade é garantida por restrição no banco, não por esconder um botão;
- ordenação que depende de dados é feita no SQL, não no JavaScript do
  navegador — ordenar no cliente só funciona enquanto ele tiver a lista
  inteira, o que deixa de valer na primeira paginação.

Qualquer desenho que mova uma regra para o navegador é rejeitado.

## Como decidir

Para cada decisão estrutural, registre quatro coisas:

1. **A decisão**, em uma frase.
2. **As alternativas consideradas** e por que perderam.
3. **O custo** da escolhida — o que ela torna mais difícil.
4. **O que a decisão não cobre**, para ninguém assumir que cobre.

Quando duas opções são genuinamente parecidas, diga isso em vez de fabricar um
vencedor.

## Onde registrar

**Dentro do artefato, não num documento separado.** Decisão sobre o esquema vai
em comentário no arquivo `.sql`; decisão sobre um endpoint vai em comentário na
Function. Documentação que mora longe do código é documentação que ninguém lê
quando precisa — e, em projetos avaliados por leitura de código, é documentação
que o avaliador não vê.

## Exemplos deste projeto

**Contagem de votos: calculada, não armazenada.** Alternativa descartada: coluna
`total_votos` atualizada a cada voto. Mais rápida na leitura, porém com dois
lugares para manter em sincronia — origem de toda contagem errada. Custo da
escolhida: a consulta faz `LEFT JOIN + COUNT`. Mitigação: índice em
`votos(publicacao_id)`. Se um dia ficar lenta, a troca é local — muda a
consulta, não o modelo.

**Categoria validada na aplicação, tipo validado no banco.** O `tipo`
(resumo/snippet) tem `CHECK` no banco porque nunca muda. A `categoria` é lista
fechada em código, porque muda a cada semestre e um `CHECK` exigiria migration
nova a cada matéria nova.

**Chave do usuário é o id do provedor, não o nome.** Nome muda; a autoria de
tudo o que a pessoa publicou iria junto.
