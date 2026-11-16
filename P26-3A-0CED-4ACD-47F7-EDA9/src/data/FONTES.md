# Fontes das listas de palavras

Data da curadoria: 2026-11-15.

## Dicionário de chutes válidos (`valid.js`)

- **Fonte:** repositório `fserb/pt-br` — Fernando Serboncini
- **URL:** https://github.com/fserb/pt-br
- **Licença:** MIT (Copyright 2021 Fernando Serboncini), compatível com a licença MIT deste projeto. O aviso de copyright é preservado abaixo.
- **Arquivos usados:** `lexico` (léxico), `conjugações` (formas verbais) e `icf` (frequência em corpus, usada só para conferir formas derivadas).

### Tratamento aplicado
1. Normalização: remoção de acentos (NFD), `Ç → C`, caixa alta.
2. Filtro: somente palavras com exatamente 5 letras `A-Z` depois da normalização (descarta hífen, espaço e apóstrofo).
3. União de `lexico` + `conjugações`.
4. Inclusão de plurais regulares gerados a partir do léxico (vogal + `S`, `-M → -NS`, `-R/-Z/-S + ES`, `-L → -IS/-ÉIS/-ÓIS`, `-ÃO → -ÃOS`) e de `-ÃO → -ÕES/-ÃES` e femininos `-O → -A` somente quando a forma existe no arquivo `icf`.
5. Inclusão de todas as respostas.
6. Remoção de duplicatas e ordenação alfabética.

### Aviso de licença da fonte

```
Copyright 2021 Fernando Serboncini

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

## Respostas do sorteio diário (`answers.js`)

- **Curadoria própria do projeto** (Agente Curador de Palavras), publicada sob a licença MIT do repositório.
- **Método:** candidatos de 5 letras do léxico e da lista de verbos de `fserb/pt-br`, ordenados por frequência de uso (arquivo `icf`, do mais comum para o mais raro), revisados um a um.
- **Excluídos:** plurais, verbos conjugados, pronomes e contrações (ex.: `DESTE`, `NISSO`), nomes próprios e lugares, gentílicos, siglas, estrangeirismos não aportuguesados, palavras ofensivas, sexuais ou sensíveis (inclui a lista `listas/negativas` da fonte), grafias exclusivas de Portugal (ex.: `FACTO`, `TECTO`) e a palavra de demonstração `COFRE`.
- **Duplicatas após normalização** (ex.: `MARÇO`/`MARCO`, `FORÇA`/`FORCA`): mantida apenas a forma mais comum.
- **Mantidos:** substantivos, adjetivos e advérbios de uso comum e verbos no infinitivo.

## Contagens finais

| Lista | Total |
|---|---|
| Respostas (`ANSWERS`) | 1161 |
| Chutes válidos (`VALID`) | 10466 |
| Dias sem repetir palavra (2 por dia) | 580 |

Conferência automática: `node tests/conferir-palavras.mjs`.
