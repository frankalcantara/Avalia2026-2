---
name: sorteio-auditavel
description: >
  Projeta, implementa e revisa o núcleo auditável do sorteador: Fisher-Yates no
  servidor, trilha de swaps, hash SHA-256 canônico, cadeia prev_hash, código
  SORT-XXXX-XXXX e replay no navegador. Use em qualquer mudança no algoritmo,
  na ata ou na verificação pública.
license: MIT
---

# Sorteio auditável (Fisher-Yates + ata imutável)

Skill do Agente 3 (Auditoria do Sorteio). O objetivo é simples: qualquer aluno
deve conseguir provar, sozinho, que o resultado publicado é o que o servidor
sorteou — sem confiar na API.

## Invariantes

1. **Aleatoriedade só no servidor.** O cliente nunca envia ordem, seed ou
   resultado. `montarSorteio` recebe o snapshot do D1 e usa `randomInt`
   (WebCrypto com rejeição de módulo, sem viés).
2. **Trilha completa.** Toda troca efetiva vira `[i, j]` em `swaps`. Troca
   `i === j` não entra na trilha. `aplicarSwaps` valida limites e rejeita
   trilha malformada.
3. **Resultado determinístico a partir da trilha.** Reaplicar `swaps` sobre
   `participants` precisa produzir exatamente a ordem publicada em
   `result.order` ou `result.groups`.
4. **Hash canônico.** `canonicalJson` ordena chaves recursivamente, remove
   `undefined` e não usa espaços. `audit_hash = sha256(canonicalJson(payload))`.
5. **Cadeia append-only.** Cada ata tem `seq` crescente por sala e `prev_hash`
   igual ao `audit_hash` da anterior. Re-sorteio cria ata nova; nenhuma ata
   antiga é alterada.
6. **Código público único.** `SORT-XXXX-XXXX` com alfabeto Crockford
   (`0-9A-Z` sem I, L, O, U). Colisão é resolvida antes do INSERT.
7. **Snapshot imutável.** `participants_json`, `result_json`, `swaps_json` e
   `params_json` guardam o estado exato do momento. A ata não depende de
   tabelas mutáveis para ser verificável.
8. **Verificação no navegador.** `public/auditoria.js` recalcula o hash e
   reaplica as trocas com WebCrypto; não chama o servidor.

## Payload hasheado (ordem de chaves irrelevante)

```js
{
  algorithm: "fisher-yates", algorithmVersion: 1,
  drawId, room: { id, publicCode, title }, seq, mode, groupSize,
  participants: [{ participantId, userId, displayName, source }],
  swaps: [[i, j], ...], result, verificationCode, prevHash,
  createdAt, createdByUserId
}
```

`params_json` guarda `{ room, groupSize }` — o título e o código da sala ficam
congelados na ata. **Nunca** reconstrua o payload lendo `rooms` (a sala pode
ser renomeada e o hash quebraria).

## Distribuição de equipes

`distribuirGrupos(itens, tamanhoMaximo)` calcula
`quantidade = ceil(n / tamanho)`, `base = floor(n / quantidade)` e distribui o
resto nas primeiras equipes. A diferença entre a maior e a menor equipe é no
máximo 1. Com `groupSize = 2` e 7 pessoas: `[2, 2, 2, 1]`.

## Testes que não podem faltar

- permutação preserva todos os `participantId` exatamente uma vez;
- `aplicarSwaps(participants, swaps)` reproduz `result`;
- payload reconstruído do D1 tem o mesmo hash do payload original;
- mudar 1 byte (título, nome, seq, swap) muda o hash;
- segunda ata tem `prevHash === auditHash` da primeira e `seq + 1`;
- triggers bloqueiam `UPDATE`/`DELETE` em `draws` e `draw_entries`;
- replay no navegador (`public/auditoria.js`) devolve `hashConfere` e
  `replayConfere` verdadeiros.

## Erros clássicos

- Embaralhar no cliente “para economizar” — invalida a auditoria.
- Guardar só o resultado e não a trilha — impossibilita o replay.
- Usar `JSON.stringify` comum para o hash — a ordem das chaves muda o hash.
- Ler o título atual da sala na verificação — renomear a sala quebra a ata.
- Reutilizar `seq` ou código — o `UNIQUE` do D1 rejeita, mas a API deve
  responder 409 com mensagem clara.
- Confiar em `Math.random` — não é criptográfico.

## Critério de aceite

`GET /api/draws/SORT-XXXX-XXXX` devolve todos os campos do payload, mais
`auditHash`, `prevDrawCode`, `entries` e `verificationUrl`. Um script de 20
linhas com WebCrypto deve conseguir dizer “confere” sem usar nenhuma rota
adicional.
