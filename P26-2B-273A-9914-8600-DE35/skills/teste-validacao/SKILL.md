---
name: teste-validacao
description: Protocolo do Agente de Teste e Validação para auditar segurança no servidor, integridade no banco D1 e aderência à rubrica de 100 pontos.
---

# Skill: Agente de Teste e Validação

Procedimento do **Agente 7 (Teste e Validação)**. Este agente não escreve
funcionalidade: ele tenta derrubar o que os outros escreveram e registra o
resultado, inclusive quando o resultado é desconfortável.

## Checklist de Verificação Obrigatória

1. **Isolamento de Subpasta:** Confirmar que todos os arquivos do projeto residem exclusivamente dentro de `P26-2B-273A-9914-8600-DE35/`.
2. **Teste Anti-Manipulação:** Verificar que chamadas `POST`/`PUT`/`PATCH` para `/api/*` rejeitam payloads inválidos ou não autenticados com códigos HTTP adequados (`400`, `401`, `403`, `409`).
3. **Conformidade de Entrega:** Executar `node validar-local.mjs P26-2B-273A-9914-8600-DE35` na raiz do repositório e assegurar 100% de aprovação nos itens determinísticos.

## A regra que dá valor ao registro: declare a falha antes do resultado

Toda entrada de validação escreve, **antes** de rodar, o que contaria como
falha. Sem isso, qualquer saída vira aprovação: a pessoa roda, olha, acha
razoável e escreve "funcionou". Declarar o critério antes é o que transforma
o teste em evidência em vez de impressão.

Formato usado em `docs/validacao.md`:

1. o que foi executado, com comando ou requisição literal;
2. **o que contaria como falha**;
3. o resultado observado;
4. a situação: aprovado ou reprovado;
5. **o que o teste não cobre**.

O item 5 é o que separa validação de propaganda. Uma lista só de acertos não
informa nada a quem lê depois.

## Teste pelo lado de fora da tela

Interface é a parte mais fácil de enganar: um botão desabilitado parece uma
regra. Para saber se a regra existe, chame o endpoint sem passar pela tela —
`curl`, ou `fetch` no console da própria página.

Os dois testes que importaram neste projeto:

**Autoria forjada.** `POST /api/publicacoes` com `autor_id: "999"` enfiado no
corpo, além dos campos legítimos. O esperado é que o campo seja ignorado e a
publicação apareça com o dono da sessão. Se aparecer com `999`, a autoria está
vindo do cliente.

**Voto repetido.** `POST` duas vezes no mesmo voto. Esperado: `409` na
segunda. `200` significa regra ausente; `500` significa regra existente e
erro vazando sem tratamento.

## Sondagem de injeção, com honestidade sobre o alcance

Busque literalmente `' OR 1=1 --`. Se a consulta for concatenada, a aspas
encerra a string, a condição fica sempre verdadeira e volta a tabela inteira.
Com parâmetro vinculado, volta **zero**, porque ele procurou esse texto dentro
dos títulos e não achou.

Registre o limite junto: isso é uma sondagem de um caso, não uma auditoria.

## Prova de sessão: chegar na página inicial não prova nada

Depois de um login OAuth2, o redirect para a tela inicial acontece mesmo que o
cookie não tenha sido gravado. A prova é um endpoint que responda **quem você
é numa requisição seguinte** — aqui, `GET /api/auth/eu` devolvendo id, nome e
avatar.

E teste nos dois ambientes. `localhost` e `127.0.0.1` são endereços diferentes
para o provedor, que compara como texto.

## O que o validador do professor realmente mede

`node validar-local.mjs` devolver 9/9 **não** significa que o projeto está
pronto. Ele mesmo diz que confere pré-requisitos **estruturais**:

- "Frontend Vanilla" passa porque existe um `.html` e não há framework
  proibido — ele não olha se há formulário, busca ou botão de copiar;
- "Backend + D1 + Discord" passa porque existem arquivos em `functions/`,
  existe algum `.sql`, e a palavra "discord" aparece em algum lugar;
- "Deploy Online" passa porque a URL respondeu 200 e a chave apareceu no HTML.

Um projeto pode marcar 9/9 servindo a página de diagnóstico do scaffold. Rode
o validador como última conferência de estrutura, nunca como prova de que a
funcionalidade existe — essa prova é a bateria manual, registrada.

## Repita em produção

Bateria que só rodou em `localhost` prova que funciona na máquina de quem
escreveu. O avaliador abre o endereço público, com o banco de produção, que
costuma estar vazio porque as migrations `--remote` e os segredos do Pages são
etapas separadas das locais.

## Registre os defeitos que você mesmo encontrou

Neste projeto, dois defeitos de texto apareceram na bateria da interface — um
plural errado na contagem e um rótulo de voto que não acompanhava o número.
Ambos foram anotados em `docs/validacao.md` junto com a correção.

Validação que só lista acertos não é validação. O registro dos defeitos é o
que mostra que a bateria foi de fato executada.
