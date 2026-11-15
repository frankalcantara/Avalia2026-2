---
name: serverless-d1-discord
description: Diretrizes e padrões para implementação de Cloudflare Pages Functions com persistência relacional no Cloudflare D1 e autenticação Discord OAuth2.
---

# Skill: Arquitetura Serverless Cloudflare Functions + D1 + Discord OAuth2

Procedimento do **Agente 2 (Backend Serverless e Persistência)**. Escrito
depois de construir e publicar a API deste projeto, não a partir da
documentação — por isso o que está aqui são as decisões e os tropeços reais.

## Regras Obrigatórias

1. **Validação na Borda:** Toda regra de negócio, pontuação, cronômetro ou verificação de permissão deve executar nas Cloudflare Pages Functions (`functions/api/*`).
2. **Queries Parametrizadas no D1:** Sempre utilizar `env.DB.prepare("...").bind(...)` para prevenir SQL Injection.
3. **Sessão Discord OAuth2:** Importar e validar `user_id`, `username` e `avatar` via fluxo OAuth2 do Discord, armazenando sessões assinadas em cookie `HttpOnly`.

## Onde cada regra realmente mora

A regra 1 é fácil de citar e difícil de cumprir, porque existe uma gradação
que ela não distingue:

- **No banco** fica tudo que não pode falhar por concorrência. Unicidade é o
  caso clássico: `UNIQUE (publicacao_id, usuario_id)`. Se a regra vivesse na
  Function, como uma consulta "já votou?" seguida de `INSERT`, duas
  requisições simultâneas poderiam passar as duas pela verificação antes de
  qualquer uma gravar. Com a restrição no banco, a segunda falha sempre.
- **Na Function** fica o que depende de contexto que o banco não tem: quem é o
  usuário, qual lista de categorias vale neste semestre, qual limite de
  tamanho de texto. E fica a **tradução** do erro do banco em resposta HTTP.
- **No cliente** não fica regra nenhuma. Botão desabilitado é cortesia com
  quem usa, não barreira — o navegador é da outra pessoa.

A Function de voto deste projeto é o exemplo: ela não implementa o voto único,
ela traduz a recusa do banco:

```js
try {
  await env.DB.prepare("INSERT INTO votos (publicacao_id, usuario_id) VALUES (?, ?)")
    .bind(publicacaoId, usuarioId).run();
} catch (erro) {
  if (/UNIQUE constraint failed/i.test(String(erro?.message || ""))) {
    return Response.json({ erro: "Você já votou nesta publicação." }, { status: 409 });
  }
  throw erro;
}
```

Traduzir para `409` em vez de deixar vazar `500` não é cosmético: `500` diz
"o servidor quebrou", e aqui o servidor funcionou exatamente como projetado.

## Roteamento por arquivo, e a pasta que não vira rota

Em Pages Functions o caminho do arquivo **é** a rota. Isso tem duas
consequências que pegam quem vem de Express:

- `functions/api/publicacoes/index.js` responde em `/api/publicacoes`, e o
  mesmo arquivo atende `GET` e `POST` exportando `onRequestGet` e
  `onRequestPost`. Não existe um roteador central para ler e entender o mapa:
  a árvore de arquivos é o mapa.
- Segmento dinâmico é pasta com colchetes: `functions/api/publicacoes/[id]/voto.js`
  responde em `/api/publicacoes/7/voto`, e o valor chega em `params.id`.
  **Sempre converta e valide**: `params.id` é texto vindo da URL, e
  `Number("abc")` é `NaN`, que passa despercebido numa consulta.
- Qualquer `.js` dentro de `functions/` vira rota. Código compartilhado que
  **não** deve ser endereçável fica em `functions/_lib/` — o sublinhado é o
  que impede virar rota. Neste projeto, `_lib/sessao.js` e `_lib/categorias.js`.

## Migrations: o erro que só aparece em produção

O wrangler mantém dois bancos distintos:

```
npx wrangler d1 migrations apply DB --local
npx wrangler d1 migrations apply DB --remote
```

Aplicar só no `--local` deixa tudo funcionando na sua máquina e derruba a
produção com `no such table` na primeira requisição. É o tipo de falha que não
aparece em nenhum teste local, por definição. Trate as duas linhas como uma
só operação.

Migrations são **somente para frente**: não edite um arquivo já aplicado, crie
o próximo. Editar funciona na sua máquina, porque você pode apagar o banco
local, e não funciona em produção, onde o registro de migrations já marcou
aquele arquivo como aplicado.

Rode o wrangler **de dentro** da pasta que contém o `wrangler.jsonc`, senão
ele responde "No configuration file found" sem dizer o que faltou.

## Segredos

O `wrangler.jsonc` é versionado, então ele só pode conter o que é público — o
Client ID, por exemplo. O segredo vai por outro caminho:

```
echo -n "$RESUMOS_DISCORD_CLIENT_SECRET" | npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name <projeto>
```

O `echo -n` com pipe existe para o valor não aparecer na linha de comando, que
fica no histórico do shell. Em desenvolvimento, o mesmo valor entra por
`--binding`, lido de uma variável de ambiente do sistema com prefixo por
projeto, para não colidir com outro trabalho na mesma máquina.

Segredo do Pages passa a valer **a partir do próximo deploy**, não na hora.

## Modelagem: calcular em vez de guardar

Contagem de votos é calculada com `LEFT JOIN + COUNT` numa view, não guardada
numa coluna `total_votos`. A coluna seria mais rápida de ler e criaria dois
lugares para manter em sincronia — origem de toda contagem errada. Se um dia a
consulta ficar lenta, a troca é local: muda a consulta, não o modelo.

Use `COUNT(v.id)` e não `COUNT(*)` nesse tipo de consulta. `COUNT(*)` conta a
linha que o `LEFT JOIN` gera mesmo sem correspondência e devolve 1 onde o
certo é 0.

A chave do usuário é o **id do provedor**, nunca o nome: `username` muda
quando a pessoa troca o apelido, e a autoria de tudo o que ela publicou iria
junto.

## O que esta skill não cobre

Paginação, cache, limites de taxa e migração de dados existentes. Nada disso
foi necessário neste projeto, e descrever de cabeça o que não foi feito seria
inventar procedimento.
